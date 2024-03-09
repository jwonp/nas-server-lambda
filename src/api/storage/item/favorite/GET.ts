import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import admin from "firebase-admin";
import * as serviceAccount from "../../../../../firebase-admin-key.json";
import { getPayloadInJWT } from "../../../../libs/JWTparser";
import { JwtPayload } from "jsonwebtoken";
import { FIREBASE_COLLECTION } from "../../../../libs/firebase/collections";
import { MetaData } from "../../../../types/MetaData";
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
  const favoriteDocs = await db
    .collection(FIREBASE_COLLECTION.USERS)
    .doc(userDocId)
    .collection(FIREBASE_COLLECTION.STORAGES)
    .where("isFavorite", "==", true)
    .get();

  const favorites = favoriteDocs.docs.map((doc) => {
    const meta = doc.data() as MetaData;
    const favorite: Omit<
      MetaData,
      "uploadTime" | "size" | "isFavorite" | "ownerId"
    > = {
      type: meta.type,
      directory: meta.directory,
      key: meta.key,
      fileName: meta.fileName,
    };
    return favorite;
  });

  response.body = JSON.stringify({ favorites: favorites });
  return response;
};
