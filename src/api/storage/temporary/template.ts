import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { FIREBASE_COLLECTION } from "../../../libs/firebase/collections";
import admin from "firebase-admin";
import * as serviceAccount from "../../../../firebase-admin-key.json";
import { randomUUID } from "crypto";
import { JwtPayload } from "jsonwebtoken";
import { getPayloadInJWT } from "../../../libs/JWTparser";
import { CopyObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createResponse } from "../../../libs/ResponseBuilder";

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

  const authorization = event.headers.authorization;
  const payload = getPayloadInJWT(authorization);

  if (!(payload as JwtPayload).id) {
    response.statusCode = 403;
    return response;
  }
  const userDocId = (payload as JwtPayload).id;

  const key = `storage/temp/${randomUUID()}.pdf`;

  if (process.env.BUCKET_NAME === undefined) {
    return createResponse(500, {
      status: 500,
      msg: "Fail to load template files for guest",
    });
  }
  const command = new CopyObjectCommand({
    CopySource: `${process.env.BUCKET_NAME}/`, // "SOURCE_BUCKET/SOURCE_OBJECT_KEY",
    Bucket: `${process.env.BUCKET_NAME}`,
    Key: "NEW_OBJECT_KEY",
  });

  try {
    const response = await client.send(command);
    console.log(response);
  } catch (err) {
    console.error(err);
  }

  return response;
};
