import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import admin from "firebase-admin";
import * as serviceAccount from "../../../../firebase-admin-key.json";

import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { FIREBASE_COLLECTION } from "../../../libs/firebase/collections";
import { VolumeSize } from "../../../entity/Volume";
import { FieldValue } from "firebase-admin/firestore";

const firebaseAdmin = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});
const db = admin.firestore();
const client = new S3Client({});
exports.handler = async (event: APIGatewayProxyEvent) => {
  const response: APIGatewayProxyResult = {
    statusCode: 200,
    body: JSON.stringify({}),
  };
  if (!event.body) {
    response.statusCode = 400;
    return response;
  }
  const { fileId, fileSize, userId } = JSON.parse(event.body);
  const userVolumeDocs = await db
    .collection(FIREBASE_COLLECTION.USERS)
    .doc(userId)
    .collection(FIREBASE_COLLECTION.VOLUME)
    .get();
  if (userVolumeDocs.size !== 1) {
    response.statusCode = 400;
    response.body = JSON.stringify({ error: "Error on loading user volume" });
    return response;
  }

  if (!fileId) {
    response.statusCode = 400;
    return response;
  }
  console.log(fileId);

  const command = new DeleteObjectCommand({
    Bucket: process.env.BUCKET_NAME as string,
    Key: fileId,
  });

  try {
    const response = await client.send(command);
    console.log(response);
  } catch (err) {
    console.error(err);
  }

  const deleteDocs = await db
    .collection(FIREBASE_COLLECTION.USERS)
    .doc(userId)
    .collection(FIREBASE_COLLECTION.STORAGES)
    .where("key", "==", fileId)
    .get();
  if (deleteDocs.size !== 1) {
    response.statusCode = 400;
    response.body = JSON.stringify({ error: "Target file is not unique" });
    return response;
  }

  const target = deleteDocs.docs.map((doc) => doc.id)[0];
  console.log(target);
  db.collection(FIREBASE_COLLECTION.USERS)
    .doc(userId)
    .collection(FIREBASE_COLLECTION.STORAGES)
    .doc(target)
    .delete();

  const userVolumeDocId = userVolumeDocs.docs.map((doc) => doc.id)[0];
  const userVolume = userVolumeDocs.docs.map((doc) =>
    doc.data()
  )[0] as VolumeSize;

  db.collection(FIREBASE_COLLECTION.USERS)
    .doc(userId)
    .collection(FIREBASE_COLLECTION.VOLUME)
    .doc(userVolumeDocId)
    .update({ now: FieldValue.increment(-1 * fileSize) });

  return response;
};
