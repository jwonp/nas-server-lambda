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
import { MetaData } from "../../../types/MetaData";
import { randomUUID } from "crypto";
import { CopyObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { VolumeSize } from "../../../entity/Volume";
import { RefIds } from "../../../types/RefIds";
import { TempFileItem } from "../../../types/TempFileItem";

const firebaseAdmin = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});
const db = admin.firestore();
const client = new S3Client({});
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

  const adminRef = db
    .collection(FIREBASE_COLLECTION.ADMINS)
    .where("userId", "==", admin);

  const userRef = db.collection(FIREBASE_COLLECTION.USERS).doc();
  const volumeRef = userRef.collection(FIREBASE_COLLECTION.VOLUME).doc();

  const initVolumeSize = 128 * 1024 * 1024;
  const initVolume: VolumeSize = {
    max: initVolumeSize,
    now: 0,
  };
  let refIds: RefIds | undefined = undefined;
  try {
    refIds = await db.runTransaction(async (t) => {
      const adminDoc = await t.get(adminRef);
      //발급한 admin id가 존재하지 않을 경우
      if (adminDoc.size !== 1) {
        return undefined;
      }
      const adminRefId = adminDoc.docs[0].id;
      const adminDocRef = adminDoc.docs.map((doc) => doc.ref)[0];
      const temporaryAccountRef = adminDocRef
        .collection(FIREBASE_COLLECTION.TemporaryAccounts)
        .where("username", "==", credentials.username);

      const temporaryAccountDocs = await t.get(temporaryAccountRef);

      //발급한 임시 계정이 존재하지 않을 경우
      if (temporaryAccountDocs.size !== 1) {
        return undefined;
      }

      //임시 계정을 가져옴
      const temporaryAccountRefId = temporaryAccountDocs.docs[0].id;
      const temporaryAccount = temporaryAccountDocs.docs.map(
        (doc) => doc.data() as TemporaryAccount
      )[0];

      //임시 계정이 없는 경우
      if (temporaryAccount.isRegisted === false) {
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
        t.set(volumeRef, initVolume);
        return {
          userRefId: userRef.id,
          volumeRefId: volumeRef.id,
          temporaryAccountRefId: temporaryAccountRefId,
          adminRefId: adminRefId,
        };
      }
    });
  } catch (error) {
    return createResponse(500, {
      ststus: 500,
      msg: "Fail to update temporary account",
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

  /////////////// temp template
  if (refIds) {
    const tempFileRef = db
      .collection(FIREBASE_COLLECTION.USERS)
      .doc("temp")
      .collection(FIREBASE_COLLECTION.STORAGES);

    const tempUserRef = db
      .collection(FIREBASE_COLLECTION.USERS)
      .doc(refIds.userRefId);
    const temporaryAccountRef = db
      .collection(FIREBASE_COLLECTION.ADMINS)
      .doc(refIds.adminRefId)
      .collection(FIREBASE_COLLECTION.TemporaryAccounts)
      .doc(refIds.temporaryAccountRefId);

    let docs = undefined;
    try {
      docs = await db.runTransaction(async (t) => {
        const temporaryAccountDocs = await t.get(temporaryAccountRef);
        const tempUserDocs = await t.get(tempUserRef);
        const tempFileDocs = await t.get(tempFileRef);
        return { temporaryAccountDocs, tempFileDocs, tempUserDocs };
      });
    } catch (error) {
      console.log(error);
      return createResponse(400, { status: 400, msg: "No docs" });
    }

    const { tempFileDocs, temporaryAccountDocs, tempUserDocs } = docs;

    if (temporaryAccountDocs.exists === false) {
      return createResponse(400, { status: 400, msg: "Invaild temp account" });
    }
    if (tempUserDocs.exists === false) {
      return createResponse(400, { status: 400, msg: "Invaild temp user" });
    }
    const { isGotTemplate } = temporaryAccountDocs.data() as TemporaryAccount;
    if (isGotTemplate) {
      return createResponse(200, {
        userDetail: encryptObject(encryptUserDetail),
      });
    }
    const codeRef = temporaryAccountDocs.ref;

    const tempUserId = tempUserDocs.id;

    const userRef = db.collection(FIREBASE_COLLECTION.USERS).doc(tempUserId);

    const tempFileMetas = tempFileDocs.docs.map<MetaData>(
      (doc) => doc.data() as MetaData
    );
    // temp 파일 복사
    const originFileKeys = tempFileMetas.map((meta) => {
      if (meta.type === "folder") {
        return meta.key.split("folder$")[1];
      }
      return meta.key.split("storage/temp/")[1].split(".")[0];
    });

    const fileKeyMap = new Map<string, string>();

    originFileKeys.forEach((key) => {
      fileKeyMap.set(key, randomUUID());
    });

    const batch = db.batch();

    const itemMetas = tempFileMetas.map((meta) => {
      const storageRef = userRef.collection(FIREBASE_COLLECTION.STORAGES).doc();
      const splitedDirectory = meta.directory.split("/");
      const directory = splitedDirectory
        .filter(
          (_, index) => index !== 0 && index !== splitedDirectory.length - 1
        )
        .map((dir) => fileKeyMap.get(dir) ?? "")
        .join("/");

      let key = "";
      if (meta.type === "folder") {
        const originKey = meta.key.split("folder$")[1];
        key = `folder$${fileKeyMap.get(originKey) ?? ""}`;
      }
      if (meta.type !== "folder") {
        const [originKey, fileType, ...rest] = meta.key
          .split("storage/temp/")[1]
          .split(".");

        key = `storage/${userRef.id}/${
          fileKeyMap.get(originKey) ?? ""
        }.${fileType}`;
      }

      fileKeyMap.set(meta.key, key);

      const newMeta: MetaData = {
        ...meta,
        directory: directory.length === 0 ? directory : `/${directory}`,
        key: key,
      };

      batch.set(storageRef, {
        ...newMeta,
      });
      return newMeta;
    });

    batch.set(volumeRef, {
      max: initVolumeSize,
      now: itemMetas
        .map((meta) => meta.size)
        .reduce((acc, cur) => acc + cur, 0),
    });
    batch.update(codeRef, { isGotTemplate: true });
    const batchCommited = await batch.commit();

    const fileMetas = tempFileMetas.filter((meta) => meta.type !== "folder");

    for (let i = 0; i < fileMetas.length; i += 1) {
      const meta = fileMetas[i];
      const copyToKey = fileKeyMap.get(meta.key);
      if (!copyToKey) {
        continue;
      }
      const command = new CopyObjectCommand({
        CopySource: `/${process.env.BUCKET_NAME as string}/${meta.key}`,
        Bucket: process.env.BUCKET_NAME as string,
        Key: copyToKey,
      });
      try {
        console.log(`${meta} copy`);
        const res = await client.send(command);
        console.log(res);
        console.log(`${meta} copy end`);
      } catch (err) {
        return createResponse(500, {
          status: 500,
          msg: "Fail to copy template files",
        });
      } finally {
        console.log("file is processed");
      }
    }
  }

  return createResponse(200, {
    userDetail: encryptObject(encryptUserDetail),
  });
};
