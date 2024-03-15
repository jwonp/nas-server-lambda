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
  let body = {};
  const response: APIGatewayProxyResult = {
    statusCode: 200,
    body: JSON.stringify(body),
  };
  const authorization = event.headers.authorization;
  const payload = getPayloadInJWT(authorization);

  if (!(payload as JwtPayload).id) {
    response.statusCode = 403;
    return response;
  }
  if (!event.body) {
    response.statusCode = 400;
    response.body = JSON.stringify({ error: "No body" });
    return response;
  }
  const reqBody = JSON.parse(event.body);
  if (
    Object.keys(reqBody).includes("directory") === false ||
    Object.keys(reqBody).includes("folder") === false
  ) {
    response.statusCode = 400;
    response.body = JSON.stringify({ error: "Invaild body" });
    return response;
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
        response.statusCode = 400;
        response.body = JSON.stringify({ error: "Invaild folder" });
        return response;
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
    response.statusCode = 500;
    response.body = JSON.stringify({
      error: "Error occured during mutate isFavorite",
    });
    return response;
  }

  return response;
};
