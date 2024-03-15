import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import admin from "firebase-admin";
import * as serviceAccount from "../../../../firebase-admin-key.json";
import { FIREBASE_COLLECTION } from "../../../libs/firebase/collections";
import { getPayloadInJWT } from "../../../libs/JWTparser";
import { JwtPayload } from "jsonwebtoken";


const firebaseAdmin = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});
const db = admin.firestore();

exports.handler = async (event: APIGatewayProxyEvent) => {
  let body = {};
  const response: APIGatewayProxyResult = {
    statusCode: 200,
    body: JSON.stringify(body),
  };
  if (!event.queryStringParameters) {
    response.statusCode = 400;
    return response;
  }
  const { query } = event.queryStringParameters;

  const authorization = event.headers.authorization;
  const payload = getPayloadInJWT(authorization);

  if (!(payload as JwtPayload).id) {
    response.statusCode = 403;
    return response;
  }
  if (!query) {
    response.statusCode = 400;
    response.body = JSON.stringify({ error: "No Parameter" });
    return response;
  }

  response.body = JSON.stringify(body);
  return response;
};
