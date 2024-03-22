import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import admin from "firebase-admin";
import * as serviceAccount from "../../../../../firebase-admin-key.json";

import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createResponse } from "../../../../libs/ResponseBuilder";

const firebaseAdmin = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});
const db = admin.firestore();
const client = new S3Client({});
exports.handler = async (event: APIGatewayProxyEvent) => {
  if (!event.body) {
    return createResponse(400, {
      status: 400,
      msg: "No body",
    });
  }

  const command = new DeleteObjectCommand({
    Bucket: process.env.BUCKET_NAME as string,
    Key: "",
  });

  try {
    const res = await client.send(command);
    console.log(res);
  } catch (err) {
    console.error(err);
  }

  return createResponse(200, {});
};
