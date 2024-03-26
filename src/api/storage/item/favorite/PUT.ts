import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import admin from "firebase-admin";
import * as serviceAccount from "../../../../../firebase-admin-key.json";
import { getPayloadInJWT } from "../../../../libs/JWTparser";
import { JwtPayload } from "jsonwebtoken";
import { FIREBASE_COLLECTION } from "../../../../libs/firebase/collections";
import { MetaData } from "../../../../types/MetaData";
import { createResponse } from "../../../../libs/ResponseBuilder";
const firebaseAdmin = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});
const db = admin.firestore();
exports.handler = async (event: APIGatewayProxyEvent) => {
  const authorization = event.headers.authorization;
  const payload = getPayloadInJWT(authorization);

  if (!(payload as JwtPayload).id) {
    return createResponse(403, { msg: "Unauthorized" });
  }
  if (!event.body) {
    return createResponse(400, { msg: "No body" });
  }
  const reqBody = JSON.parse(event.body);
  if (
    Object.keys(reqBody).includes("directory") === false ||
    Object.keys(reqBody).includes("folder") === false
  ) {
    return createResponse(400, { msg: "Invaild body" });
  }
  const favoriteFolder = reqBody as {
    directory: string;
    folder: string;
  };
  const userDocId = (payload as JwtPayload).id;
  const storageRef = db
    .collection(FIREBASE_COLLECTION.USERS)
    .doc(userDocId)
    .collection(FIREBASE_COLLECTION.STORAGES);

  try {
    await db.runTransaction(async (t) => {
      const favoriteDocs = await t.get(
        storageRef.where("key", "==", favoriteFolder.folder)
      );

      if (favoriteDocs.size !== 1) {
        return createResponse(400, { msg: "Invaild folder" });
      }
      const storedFavoriteFolder = favoriteDocs.docs.map((doc) => {
        return { id: doc.id, isFavorite: (doc.data() as MetaData).isFavorite };
      })[0];
      console.log(
        `storage favorite folder ${storedFavoriteFolder.id} ${storedFavoriteFolder.isFavorite}`
      );
      t.update(storageRef.doc(storedFavoriteFolder.id), {
        isFavorite: !storedFavoriteFolder.isFavorite,
      });
    });
  } catch (e) {
    return createResponse(500, {
      msg: "Error occured during mutate isFavorite",
    });
  }

  return createResponse(200, { isSuccess: true });
};
