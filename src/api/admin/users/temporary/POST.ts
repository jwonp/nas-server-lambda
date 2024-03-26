import { APIGatewayProxyEvent } from "aws-lambda";
import { FIREBASE_COLLECTION } from "../../../../libs/firebase/collections";
import admin from "firebase-admin";
import * as serviceAccount from "../../../../../firebase-admin-key.json";
import { JwtPayload } from "jsonwebtoken";
import { getPayloadInJWT } from "../../../../libs/JWTparser";
import { decryptObject, encryptObject } from "../../../../libs/crypto";
import { createResponse } from "../../../../libs/ResponseBuilder";
import { UserCredentials } from "../../../../types/UserCredentials";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { TemporaryAccount } from "../../../../types/TemporaryAccount";

const firebaseAdmin = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});
const db = admin.firestore();
const client = new S3Client({});
exports.handler = async (event: APIGatewayProxyEvent) => {
  if (!event.body) {
    return createResponse(400, {
      msg: "No body",
    });
  }

  const authorization = event.headers.authorization;
  const payload = getPayloadInJWT(authorization);

  if (!(payload as JwtPayload).id) {
    return createResponse(403, {
      msg: "Unauthorized",
    });
  }
  const userDocId = (payload as JwtPayload).id;

  const adminCheckRef = db
    .collection(FIREBASE_COLLECTION.ADMINS)
    .where("userId", "==", userDocId);
  const adminDocs = await adminCheckRef.get();

  const isAdmin = adminDocs.size === 1;
  if (isAdmin === false) {
    return createResponse(403, {
      msg: "Unauthorized admin",
    });
  }

  const { account } = JSON.parse(event.body) as { account: string };

  const decryptedAccount = decryptObject(account);
  if (!decryptedAccount) {
    return createResponse(400, {
      msg: "Invaild Cipher text",
    });
  }
  const parsedtemporaryAccount = decryptedAccount as UserCredentials & {
    expireIn: number;
  };
  const ONE_DAY = 86400000;

  const temporaryAccount: Omit<TemporaryAccount, "accountCode"> & {
    password: string;
  } = {
    ...parsedtemporaryAccount,
    expireIn: Date.now() + parsedtemporaryAccount.expireIn * ONE_DAY,
    isRegisted: false,
    isGotTemplate: false,
    admin: userDocId,
  };
  try {
    const adminRef = db.collection(FIREBASE_COLLECTION.ADMINS);
    const adminDocs = await adminRef.where("userId", "==", userDocId).get();
    if (adminDocs.size !== 1) {
      return createResponse(400, { msg: "Invaild admin user" });
    }
    const temporaryAccountRef = db
      .collection(FIREBASE_COLLECTION.ADMINS)
      .doc(adminDocs.docs.map((doc) => doc.id)[0])
      .collection(FIREBASE_COLLECTION.TemporaryAccounts);

    await temporaryAccountRef.add(temporaryAccount);

    const accountCodeObject: UserCredentials & {
      admin: string;
      expireIn: number;
    } = {
      username: temporaryAccount.username,
      password: temporaryAccount.password,
      phone: temporaryAccount.phone,
      name: temporaryAccount.name,
      icon: temporaryAccount.icon,
      admin: temporaryAccount.admin,
      expireIn: temporaryAccount.expireIn,
    };

    return createResponse(200, {
      accountCode: encryptObject(accountCodeObject),
    });
  } catch (e) {
    const command = new DeleteObjectCommand({
      Bucket: process.env.BUCKET_NAME as string,
      Key: temporaryAccount.icon,
    });

    try {
      const res = await client.send(command);
      console.log(res);
    } catch (err) {
      console.error(err);
    }

    return createResponse(400, {
      msg: "Fail to add temporary account",
    });
  }
};
