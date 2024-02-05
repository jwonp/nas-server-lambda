import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { FIREBASE_COLLECTION } from "../../../libs/firebase/collections";
import admin from "firebase-admin";
import * as serviceAccount from "../../../../firebase-admin-key.json";

const firebaseAdmin = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});
const db = admin.firestore();

exports.handler = async (event: APIGatewayProxyEvent) => {
  const response: APIGatewayProxyResult = {
    statusCode: 200,
    body: JSON.stringify({}),
  };
  if (!event.body) {
    response.statusCode = 400;
    return response;
  }
  const { fileId, userId, title } = JSON.parse(event.body);
  const ref = db
    .collection(FIREBASE_COLLECTION.USERS)
    .doc(userId)
    .collection(FIREBASE_COLLECTION.STORAGES)
    .where("key", "==", fileId);

  const docs = await ref.get();
  const files = docs.docs.map((doc) => {
    return { id: doc.id, type: doc.data().type };
  });
  if (files.length !== 1) {
    response.statusCode = 400;
    response.body = JSON.stringify({ error: "The file is not unique" });
    return response;
  }

  const file = files[0];
  const batch = db.batch();

  const uniqueRef = db
    .collection(FIREBASE_COLLECTION.USERS)
    .doc(userId)
    .collection(FIREBASE_COLLECTION.STORAGES)
    .doc(file.id);
  batch.update(uniqueRef, { fileName: title });

  

  await batch.commit();
  return response;
};
