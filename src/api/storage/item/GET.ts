import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import admin, { auth } from "firebase-admin";
import * as serviceAccount from "../../../../firebase-admin-key.json";
import { FIREBASE_COLLECTION } from "../../../libs/firebase/collections";
import { getPayloadInJWT } from "../../../libs/JWTparser";
import { JwtPayload } from "jsonwebtoken";
import { MetaData } from "../../../types/MetaData";

const firebaseAdmin = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});
const db = admin.firestore();

exports.handler = async (event: APIGatewayProxyEvent) => {
  console.log("item");
  const response: APIGatewayProxyResult = {
    statusCode: 200,
    body: JSON.stringify({}),
  };
  if (!event.queryStringParameters) {
    response.statusCode = 400;
    return response;
  }
  const { path } = event.queryStringParameters;

  const authorization = event.headers.authorization;
  const payload = getPayloadInJWT(authorization);

  if (!(payload as JwtPayload).id) {
    response.statusCode = 403;
    return response;
  }

  const userDocId = (payload as JwtPayload).id;
  console.log(`path is ${path ?? "root"}`);
  const fileDocs = await db
    .collection(FIREBASE_COLLECTION.USERS)
    .doc(userDocId)
    .collection(FIREBASE_COLLECTION.STORAGES)
    .where("directory", "==", path)
    .get();
  const files = fileDocs.docs.map((doc) => doc.data()) as Omit<
    MetaData,
    "ownerId"
  >[];
  files.sort((a, b) => (a.type === "folder" ? -1 : 1));
  response.body = JSON.stringify({
    id: userDocId,
    username: (payload as JwtPayload).name,
    image: (payload as JwtPayload).image,
    files: files,
  });
  return response;
};
