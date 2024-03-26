import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import admin from "firebase-admin";
import * as serviceAccount from "../../../../../firebase-admin-key.json";

import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createResponse } from "../../../../libs/ResponseBuilder";

import { JwtPayload } from "jsonwebtoken";
import { getPayloadInJWT } from "../../../../libs/JWTparser";
import { FIREBASE_COLLECTION } from "../../../../libs/firebase/collections";
import { TemporaryAccount } from "../../../../types/TemporaryAccount";
const firebaseAdmin = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});
const db = admin.firestore();
const client = new S3Client({});
exports.handler = async (event: APIGatewayProxyEvent) => {
  if (!event.queryStringParameters) {
    return createResponse(400, {
      msg: "No user",
    });
  }
  const authorization = event.headers.authorization;
  const payload = getPayloadInJWT(authorization);
  if (!(payload as JwtPayload).id) {
    return createResponse(403, { msg: "Unauthorized" });
  }
  const { user } = event.queryStringParameters;

  const userDocId = (payload as JwtPayload).id;

  const adminRef = db
    .collection(FIREBASE_COLLECTION.ADMINS)
    .where("userId", "==", userDocId);
  const result: {
    isError: boolean;
    res:
      | APIGatewayProxyResult
      | {
          id: string;
          data: TemporaryAccount;
        };
  } = await db.runTransaction(async (t) => {
    const adminDocs = await t.get(adminRef);
    if (adminDocs.size !== 1) {
      return {
        isError: true,
        res: createResponse(403, { msg: "Unauthorized admin" }),
      };
    }
    const adminDocId = adminDocs.docs.map((doc) => doc.id)[0];
    const tempUserRef = db
      .collection(FIREBASE_COLLECTION.ADMINS)
      .doc(adminDocId)
      .collection(FIREBASE_COLLECTION.TemporaryAccounts)
      .where("username", "==", user);
    const tempUserDocs = await t.get(tempUserRef);
    if (tempUserDocs.size !== 1) {
      return {
        isError: true,
        res: createResponse(400, {
          msg: "Can not find target temp user",
        }),
      };
    }
    const tempUser = tempUserDocs.docs.map((doc) => {
      return { id: doc.id, data: doc.data() as TemporaryAccount };
    })[0];

    const deleteRef = db
      .collection(FIREBASE_COLLECTION.ADMINS)
      .doc(adminDocId)
      .collection(FIREBASE_COLLECTION.TemporaryAccounts)
      .doc(tempUser.id);
    t.delete(deleteRef);
    return { isError: false, res: tempUser };
  });

  if (result.isError === true) {
    return result.res;
  }

  const { id, data } = result.res as { id: string; data: TemporaryAccount };
  if (data.icon.length > 0) {
    const command = new DeleteObjectCommand({
      Bucket: process.env.BUCKET_NAME as string,
      Key: data.icon,
    });

    try {
      const res = await client.send(command);
      console.log(res);
    } catch (err) {
      console.error(err);
      return createResponse(400, { msg: "fail to delete icon" });
    }
  }

  return createResponse(200, { isSucessed: true });
};
