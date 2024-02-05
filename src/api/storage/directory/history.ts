import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import admin from "firebase-admin";
import * as serviceAccount from "../../../../firebase-admin-key.json";
import { FIREBASE_COLLECTION } from "../../../libs/firebase/collections";
import { JwtPayload } from "jsonwebtoken";
import { getPayloadInJWT } from "../../../libs/JWTparser";
import { MetaData } from "../../../types/MetaData";

const firebaseAdmin = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});
const db = admin.firestore();

exports.handler = async (event: APIGatewayProxyEvent) => {
  const response: APIGatewayProxyResult = {
    statusCode: 200,
    body: JSON.stringify({}),
  };

  const params = event.queryStringParameters;
  if (!params) {
    response.statusCode = 400;
    response.body = JSON.stringify({ error: "No required params" });
    return response;
  }
  const { path } = params;
  console.log(params);
  const authorization = event.headers.authorization;
  const payload = getPayloadInJWT(authorization);

  if (!(payload as JwtPayload).id) {
    response.statusCode = 403;
    return response;
  }
  const userDocId = (payload as JwtPayload).id;
  const histories = path
    ?.split("/")
    .filter((_, index) => index !== 0)
    .map((history) => `folder$${history}`);
  console.log(histories);
  const docs = await db
    .collection(FIREBASE_COLLECTION.USERS)
    .doc(userDocId)
    .collection(FIREBASE_COLLECTION.STORAGES)
    .where("key", "in", histories)
    .get();
  const result = docs.docs.map((doc) => doc.data()) as MetaData[];
  console.log(result);
  const displayHistories = result.map((doc) => {
    return { key: doc.key, title: doc.fileName };
  });
  response.body = JSON.stringify(displayHistories);
  return response;
};
