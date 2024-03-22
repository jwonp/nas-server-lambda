import { APIGatewayProxyEvent } from "aws-lambda";
import { FIREBASE_COLLECTION } from "../../../../../libs/firebase/collections";
import admin from "firebase-admin";
import * as serviceAccount from "../../../../../../firebase-admin-key.json";
import { JwtPayload } from "jsonwebtoken";
import { getPayloadInJWT } from "../../../../../libs/JWTparser";
import { TemporaryAccount } from "../../../../../types/TemporaryAccount";
import { createResponse } from "../../../../../libs/ResponseBuilder";
import { FieldPath } from "firebase-admin/firestore";

import { UserCredentials } from "../../../../../types/UserCredentials";

const firebaseAdmin = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});
const db = admin.firestore();

exports.handler = async (event: APIGatewayProxyEvent) => {
  const authorization = event.headers.authorization;
  const payload = getPayloadInJWT(authorization);

  if (!(payload as JwtPayload).id) {
    return createResponse(403, { status: 403, msg: "Unauthorized" });
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

  const tempStoargeRef = db
    .collection(FIREBASE_COLLECTION.USERS)
    .doc("temp")
    .collection(FIREBASE_COLLECTION.STORAGES);
  const tempStorageDocs = await tempStoargeRef.get();

  const tempMetas = tempStorageDocs.docs.map((doc) => {
    return { id: doc.id, ...doc.data() };
  });

  return createResponse(200, { tempMetas });
};
