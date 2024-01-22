import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { FIREBASE_COLLECTION } from "../../libs/firebase/collections";
import admin from "firebase-admin";
import * as serviceAccount from "../../../firebase-admin-key.json";
import { MetaData } from "../../types/MetaData";

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
  const metas: MetaData[] = JSON.parse(event.body) as MetaData[];
  console.log(metas);
  const batch = db.batch();

  const results = metas.map(async (meta) => {
    const { ownerId: _, ...rest } = meta;
    return await db
      .collection(FIREBASE_COLLECTION.USERS)
      .doc(meta.ownerId)
      .collection(FIREBASE_COLLECTION.STORAGES)
      .add(rest);
  });

  await batch.commit();

  response.body = JSON.stringify(results);
  return response;
};
