import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import admin from "firebase-admin";
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
  let body = {};
  const response: APIGatewayProxyResult = {
    statusCode: 200,
    body: JSON.stringify(body),
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
  const storageRef = db
    .collection(FIREBASE_COLLECTION.USERS)
    .doc(userDocId)
    .collection(FIREBASE_COLLECTION.STORAGES);

  if (!path) {
    response.statusCode = 400;
    response.body = JSON.stringify({ error: "No Parameter" });
    return response;
  }

  // path = /a => ["" => rest ,"a" => splitedPath]
  console.log(`path is ${path}`);
  const [rest, ...splitedPath] = path.split("/");
  console.log(`splitPath ${JSON.stringify(splitedPath)}`);
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

  console.log("histories");
  console.log(histories);
  console.log(`directory + folder ? ${directory} + ${folder}`);
  console.log(`is vaild directory ? ${isVaildDirectory}`);

  if (
    !isRootDirectory &&
    (histories?.length !== rowHistories.length || !isVaildDirectory)
  ) {
    response.statusCode = 404;
    response.body = JSON.stringify({ error: "Invaild Directory" });
    return response;
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

  console.log("body");
  console.log(body);
  response.body = JSON.stringify(body);
  return response;
};
