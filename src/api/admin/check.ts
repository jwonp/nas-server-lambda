import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { FIREBASE_COLLECTION } from "../../libs/firebase/collections";
import admin from "firebase-admin";
import * as serviceAccount from "../../../firebase-admin-key.json";
import { JwtPayload } from "jsonwebtoken";
import { getPayloadInJWT } from "../../libs/JWTparser";

const firebaseAdmin = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});
const db = admin.firestore();

exports.handler = async (event: APIGatewayProxyEvent) => {
  const response: APIGatewayProxyResult = {
    statusCode: 200,
    body: JSON.stringify({}),
  };

  const authorization = event.headers.authorization;
  const payload = getPayloadInJWT(authorization);

  if (!(payload as JwtPayload).id) {
      response.statusCode = 403;
    return response;
  }
  const userDocId = (payload as JwtPayload).id;

  const adminCheckRef = db
  .collection(FIREBASE_COLLECTION.ADMINS)
  .where("userId", "==", userDocId);
  const adminDocs = await adminCheckRef.get();


  const isAdmin = adminDocs.size === 1;

  response.body = JSON.stringify({ isAdmin: isAdmin });
  return response;
};
