import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import admin from "firebase-admin";
import * as serviceAccount from "../../../../firebase-admin-key.json";
import { FIREBASE_COLLECTION } from "../../../libs/firebase/collections";
import { JwtPayload } from "jsonwebtoken";
import { getPayloadInJWT } from "../../../libs/JWTparser";

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

  const authorization = event.headers.authorization;
  const payload = getPayloadInJWT(authorization);

  if (!(payload as JwtPayload).id) {
    response.statusCode = 403;
    return response;
  }

  const userDocId = (payload as JwtPayload).id;
  const { directory, folder } = params;
  const path = directory !== "" ? `/${directory}` : "";
  const docs = await db
    .collection(FIREBASE_COLLECTION.USERS)
    .doc(userDocId)
    .collection(FIREBASE_COLLECTION.STORAGES)
    .where("directory", "==", path)
    .where("key", "==", folder)
    .get();
  if (docs.size === 0) {
    response.body = JSON.stringify({ isExistDirectory: false });
    return response;
  }
  
  response.body = JSON.stringify({ isExistDirectory: true });
  return response;
};
