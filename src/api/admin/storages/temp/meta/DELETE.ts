import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { FIREBASE_COLLECTION } from "../../../../../libs/firebase/collections";
import admin from "firebase-admin";
import * as serviceAccount from "../../../../../../firebase-admin-key.json";
import { MetaData } from "../../../../../types/MetaData";
import { JwtPayload } from "jsonwebtoken";
import { getPayloadInJWT } from "../../../../../libs/JWTparser";

import { createResponse } from "../../../../../libs/ResponseBuilder";
import { DeleteObjectsCommand, S3Client } from "@aws-sdk/client-s3";


const client = new S3Client({});
const firebaseAdmin = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});
const db = admin.firestore();

exports.handler = async (event: APIGatewayProxyEvent) => {
  if (!event.body) {
    return createResponse(400, { msg: "No body" });
  }

  const authorization = event.headers.authorization;
  const payload = getPayloadInJWT(authorization);

  if (!(payload as JwtPayload).id) {
    return createResponse(403, { msg: "Unauthorized" });
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

  const { metas } = JSON.parse(event.body) as {
    metas: (MetaData & { id: string })[];
  };

  const batch = db.batch();

  const metaRef = metas.map((meta) => {
    const { id, ...rest } = meta;
    return {
      ref: db
        .collection(FIREBASE_COLLECTION.USERS)
        .doc("temp")
        .collection(FIREBASE_COLLECTION.STORAGES)
        .doc(id),

      meta: rest as MetaData,
    };
  });

  let s3FileKeys: string[] = [];
  metaRef.forEach((meta) => {
    if (meta.meta.type === "file") {
      s3FileKeys.push(meta.meta.key);
    }
    batch.delete(meta.ref);
  });
  if (s3FileKeys.length > 0) {
    const command = new DeleteObjectsCommand({
      Bucket: process.env.BUCKET_NAME as string,
      Delete: {
        Objects: s3FileKeys.map((key) => {
          return { Key: key };
        }),
      },
    });
    // S3에 파일 삭제 요청
    try {
      const { Deleted } = await client.send(command);
      console.log(Deleted);
    } catch (err) {
      console.error(err);

      return createResponse(500, { msg: "Fail to delete files" });
    }
  }
  await batch.commit();

  return createResponse(200, { isDeleted: true });
};
