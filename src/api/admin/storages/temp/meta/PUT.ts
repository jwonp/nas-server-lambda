import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { FIREBASE_COLLECTION } from "../../../../../libs/firebase/collections";
import admin from "firebase-admin";
import * as serviceAccount from "../../../../../../firebase-admin-key.json";
import { MetaData } from "../../../../../types/MetaData";
import { JwtPayload } from "jsonwebtoken";
import { getPayloadInJWT } from "../../../../../libs/JWTparser";

import { createResponse } from "../../../../../libs/ResponseBuilder";
import { TempFileItem } from "../../../../../types/TempFileItem";

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
  if (isAdmin === false) {
    return createResponse(403, {
      status: 403,
      msg: "Unauthorized admin",
    });
  }

  const metas = JSON.parse(event.body) as (MetaData & { id: string })[];

  const batch = db.batch();

  const metaRef = metas.map((meta) => {
    const { id, ...rest } = meta;
    return {
      ref: db
        .collection(FIREBASE_COLLECTION.USERS)
        .doc("temp")
        .collection(FIREBASE_COLLECTION.STORAGES)
        .doc(id),
      meta: rest as MetaData,
    };
  });
  metaRef.forEach((meta) => {
    batch.update(meta.ref, meta.meta);
  });

  await batch.commit();

  return createResponse(200, { uploadedMetas: metas });
};