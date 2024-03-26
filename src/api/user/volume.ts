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
  console.log(userDocId);
  const volumeDocs = await db
    .collection(FIREBASE_COLLECTION.USERS)
    .doc(userDocId)
    .collection(FIREBASE_COLLECTION.VOLUME)
    .get();
  if (volumeDocs.size !== 1) {
    response.statusCode = 400;
    response.body = JSON.stringify({ error: "Error on loading user volume" });
    return response;
  }
  const volume = volumeDocs.docs.map((doc) => doc.data())[0];

  response.body = JSON.stringify({ ...volume });
  return response;
};
