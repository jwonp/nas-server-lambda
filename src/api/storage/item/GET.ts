import { APIGatewayProxyEvent } from "aws-lambda";
import admin from "firebase-admin";
import * as serviceAccount from "../../../../firebase-admin-key.json";
import { FIREBASE_COLLECTION } from "../../../libs/firebase/collections";
import { getPayloadInJWT } from "../../../libs/JWTparser";
import { JwtPayload } from "jsonwebtoken";
import { MetaData } from "../../../types/MetaData";
import { createResponse } from "../../../libs/ResponseBuilder";

const firebaseAdmin = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});
const db = admin.firestore();

exports.handler = async (event: APIGatewayProxyEvent) => {
  let body = {};

  if (!event.queryStringParameters) {
    return createResponse(400, { msg: "No Query Parameter" });
  }
  const { path } = event.queryStringParameters;

  const authorization = event.headers.authorization;
  const payload = getPayloadInJWT(authorization);

  if (!(payload as JwtPayload).id) {
    return createResponse(403, { msg: "Unauthorized" });
  }

  const userDocId = (payload as JwtPayload).id;
  const storageRef = db
    .collection(FIREBASE_COLLECTION.USERS)
    .doc(userDocId)
    .collection(FIREBASE_COLLECTION.STORAGES);

  if (!path) {
    return createResponse(400, { msg: "No Query Parameter" });
  }

  // path = /a => ["" => rest ,"a" => splitedPath]

  const [rest, ...splitedPath] = path.split("/");

  const directory =
    splitedPath.length > 1
      ? splitedPath
          .filter((_, index) => index !== splitedPath.length - 1)
          .join("/")
      : "";
  const folder = "folder$" + splitedPath[splitedPath.length - 1];

  const rowHistories = path
    .split("/")
    .filter((_, index) => index !== 0)
    .map((history) => `folder$${history}`);

  const historyDocs = await storageRef.where("key", "in", rowHistories).get();

  const histories = historyDocs.docs.map((doc) => doc.data()) as MetaData[];
  const isRootDirectory = splitedPath.length === 1;
  const isVaildDirectory =
    isRootDirectory ||
    histories.filter(
      (history) =>
        history.directory === `/${directory}` && history.key === folder
    ).length === 1;

  if (
    !isRootDirectory &&
    (histories?.length !== rowHistories.length || !isVaildDirectory)
  ) {
    return createResponse(404, { msg: "Invaild Directory" });
  }

  const displayHistories = histories.map((doc) => {
    return { key: doc.key, title: doc.fileName };
  });
  body = { ...body, histories: [...displayHistories] };

  const directoryQuery = path === "/" ? "" : path;
  const fileDocs = await storageRef
    .where("directory", "==", directoryQuery)
    .get();
  const files = fileDocs.docs.map((doc) => doc.data()) as Omit<
    MetaData,
    "ownerId"
  >[];
  files.sort((a, b) => (a.type === "folder" ? -1 : 1));
  const items = {
    id: userDocId,
    username: (payload as JwtPayload).name,
    image: (payload as JwtPayload).image,
    files: files,
  };
  if (Object.keys(body).includes("histories") === false) {
    body = { ...body, histories: [] };
  }
  body = { ...body, items: items };

  return createResponse(200, { ...body });
};
