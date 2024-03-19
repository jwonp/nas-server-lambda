import { APIGatewayProxyEvent } from "aws-lambda";
import { FIREBASE_COLLECTION } from "../../../libs/firebase/collections";
import admin from "firebase-admin";
import * as serviceAccount from "../../../../firebase-admin-key.json";

import { TemporaryAccount } from "../../../types/TemporaryAccount";
import { createResponse } from "../../../libs/ResponseBuilder";
import { encryptObject } from "../../../libs/crypto";
import { UserDetail } from "../../../entity/UserDetail";
import { FieldValue } from "firebase-admin/firestore";
import { decrypt } from "eccrypto";

const firebaseAdmin = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});
const db = admin.firestore();

exports.handler = async (event: APIGatewayProxyEvent) => {
  if (!event.body) {
    return createResponse(400, {
      statusCode: 400,
      body: JSON.stringify({ error: "No request body" }),
    });
  }

  const { credentials, admin, expireIn } = JSON.parse(event.body) as {
    credentials: UserDetail;
    admin: string;
    expireIn: number;
  };
  if (expireIn < Date.now()) {
    return createResponse(401, {
      statusCode: 401,
      body: JSON.stringify({ error: "Expired account" }),
    });
  }
  try {
    const res = await db.runTransaction(async (t) => {
      const adminRef = db
        .collection(FIREBASE_COLLECTION.ADMINS)
        .where("userId", "==", admin);
      const adminDoc = await t.get(adminRef);
      //발급한 admin id가 존재하지 않을 경우
      if (adminDoc.size !== 1) {
        return createResponse(403, { status: 403, msg: "Invaild provider" });
      }
      const adminDocRef = adminDoc.docs.map((doc) => doc.ref)[0];
      const temporaryAccountRef = adminDocRef
        .collection(FIREBASE_COLLECTION.TemporaryAccounts)
        .where("username", "==", credentials.username);

      //발급한 임시 계정이 존재하지 않을 경우
      const temporaryAccountDocs = await t.get(temporaryAccountRef);
      if (temporaryAccountDocs.size !== 1) {
        return createResponse(400, { status: 400, msg: "Invaild account" });
      }
      const temporaryAccount = temporaryAccountDocs.docs.map(
        (doc) => doc.data() as TemporaryAccount
      )[0];
      if (temporaryAccount.isRegisted === false) {
        const userRef = db.collection(FIREBASE_COLLECTION.USERS).doc();
        // 임시 계정의 isRegisted를 true로 변경
        const temporaryAccountDocRef = temporaryAccountDocs.docs.map(
          (doc) => doc.ref
        )[0];
        t.update(temporaryAccountDocRef, { isRegisted: true });

        // 임시 계정 등록, 계정 정보와 expireIn을 추가
        t.set(userRef, {
          ...credentials,
          createdTime: FieldValue.serverTimestamp(),
          expireIn: expireIn,
        });
      }

      // 임시 계정 비밀번호를 복호화해서 {사용자 ID, 비밀 번호}를 다시 암호화 해서 보냄
      const encryptedPassword: eccrypto.Ecies = {
        iv: Buffer.from(credentials.password.iv, "hex"),
        ephemPublicKey: Buffer.from(credentials.password.ephemPublicKey, "hex"),
        ciphertext: Buffer.from(credentials.password.ciphertext, "hex"),
        mac: Buffer.from(credentials.password.mac, "hex"),
      };

      if (!process.env.ECCRYPTO_PRIVATE_KEY) {
        return {
          statusCode: 500,
          body: JSON.stringify({
            error: "Fail to get password key",
          }),
        };
      }
      const ECCRYPTO_PRIVATE_KEY = Buffer.from(
        process.env.ECCRYPTO_PRIVATE_KEY,
        "hex"
      );
      const decryptedPassword = await decrypt(
        ECCRYPTO_PRIVATE_KEY,
        encryptedPassword
      );

      const encryptUserDetail = {
        username: credentials.username,
        password: decryptedPassword.toString(),
      };

      return createResponse(200, {
        userDetail: encryptObject(encryptUserDetail),
      });
    });
    return res;
  } catch (error) {
    return createResponse(500, {
      ststus: 500,
      msg: "Fail to update temporary account",
    });
  }
};
