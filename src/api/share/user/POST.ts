import { APIGatewayProxyEvent } from "aws-lambda";
import admin from "firebase-admin";
import * as serviceAccount from "../../../../firebase-admin-key.json";

import { getPayloadInJWT } from "../../../libs/JWTparser";
import { JwtPayload } from "jsonwebtoken";

import { createResponse } from "../../../libs/ResponseBuilder";

const firebaseAdmin = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});
const db = admin.firestore();

exports.handler = async (event: APIGatewayProxyEvent) => {
  if (!event.queryStringParameters) {
    return createResponse(400, { msg: "No query parameters" });
  }
  const { path } = event.queryStringParameters;

  const authorization = event.headers.authorization;
  const payload = getPayloadInJWT(authorization);

  if (!(payload as JwtPayload).id) {
    return createResponse(403, { msg: "Unauthorized" });
  }

  const userDocId = (payload as JwtPayload).id;

  return createResponse(200, {});
};
