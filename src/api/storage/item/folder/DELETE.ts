import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import admin from "firebase-admin";
import * as serviceAccount from "../../../../../firebase-admin-key.json";

import { DeleteObjectsCommand, S3Client } from "@aws-sdk/client-s3";

import { FIREBASE_COLLECTION } from "../../../../libs/firebase/collections";

import { FieldValue } from "firebase-admin/firestore";
import { getStartsWithCode } from "../../../../libs/firebase/FirebaseUtils";
import { MetaData } from "../../../../types/MetaData";
import { createResponse } from "../../../../libs/ResponseBuilder";

const firebaseAdmin = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});
const db = admin.firestore();
const client = new S3Client({});
exports.handler = async (event: APIGatewayProxyEvent) => {
  if (!event.body) {
    return createResponse(400, { msg: "No body" });
  }
  const { fileId, userId, directory } = JSON.parse(event.body);

  console.log(`fielId : ${fileId}`);
  // 유저의 저장 공간 확인
  const userVolumeDocs = await db
    .collection(FIREBASE_COLLECTION.USERS)
    .doc(userId)
    .collection(FIREBASE_COLLECTION.VOLUME)
    .get();
  if (userVolumeDocs.size !== 1) {
    return createResponse(400, { msg: "Error on loading user volume" });
  }

  if (!fileId) {
    return createResponse(400, { msg: "No file id" });
  }
  ///

  // 삭제하려는 파일 가져오기
  const storageRef = db
    .collection(FIREBASE_COLLECTION.USERS)
    .doc(userId)
    .collection(FIREBASE_COLLECTION.STORAGES);
  const folder = (await storageRef.where("key", "==", fileId).get()).docs.map(
    (doc) => doc.id
  )[0];

  const searchQuery = `${directory}/${
    (fileId as string).split("folder$", 2)[1]
  }`;
  console.log(`search query is ${searchQuery}`);
  const searchQueryCodes = getStartsWithCode(searchQuery);
  const targetDocs = await storageRef
    .where("directory", ">=", searchQueryCodes.startCode)
    .where("directory", "<", searchQueryCodes.endCode)
    .get();
  const files = targetDocs.docs.map((doc) => doc.data() as unknown as MetaData);
  console.log(
    `target files : ${files
      .map((file) => `${file.type}#${file.fileName}`)
      .join(", ")}`
  );
  const batch = db.batch();

  const filesWithoutFolders = files.filter(
    (file) => !(file.type === "folder" && file.size === 0)
  );
  if (filesWithoutFolders.length > 0) {
    const command = new DeleteObjectsCommand({
      Bucket: process.env.BUCKET_NAME as string,
      Delete: {
        Objects: filesWithoutFolders.map((file) => {
          return { Key: file.key };
        }),
      },
    });
    ///

    // S3에 파일 삭제 요청
    try {
      const { Deleted } = await client.send(command);
      console.log(Deleted);
    } catch (err) {
      console.error(err);
      return createResponse(500, { msg: "Fail to delete files" });
    }

    ///

    // 삭제한 파일 메타 데이터 불러오기
    const deleteDocs = await storageRef
      .where(
        "key",
        "in",
        files.map((file) => file.key)
      )
      .get();

    const targetFileMetas = deleteDocs.docs.map((doc) => {
      return { id: doc.id, fileSize: (doc.data() as unknown as MetaData).size };
    });
    console.log(targetFileMetas);

    targetFileMetas.forEach((meta) => {
      batch.delete(storageRef.doc(meta.id));
    });

    const userVolumeDocId = userVolumeDocs.docs.map((doc) => doc.id)[0];

    const fileTotalSize = targetFileMetas
      .map((meta) => meta.fileSize)
      .reduce((acc, cur) => acc + cur, 0);
    batch.update(
      db
        .collection(FIREBASE_COLLECTION.USERS)
        .doc(userId)
        .collection(FIREBASE_COLLECTION.VOLUME)
        .doc(userVolumeDocId),
      {
        now: FieldValue.increment(-1 * fileTotalSize),
      }
    );
  }
  ///

  // 불러온 메타 데이터 일괄 삭제 요청

  batch.delete(storageRef.doc(folder));

  await batch.commit();

  return createResponse(200, { isSuccess: true });
};
