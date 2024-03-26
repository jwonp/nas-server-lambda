import { APIGatewayProxyEvent } from "aws-lambda";
import admin from "firebase-admin";
import * as serviceAccount from "../../../firebase-admin-key.json";
import { FIREBASE_COLLECTION } from "../../libs/firebase/collections";
import { getPayloadInJWT } from "../../libs/JWTparser";
import { JwtPayload } from "jsonwebtoken";
import { getStartsWithCode } from "../../libs/firebase/FirebaseUtils";
import { UserDetail } from "../../entity/UserDetail";
import { SearchedUser } from "../../types/SearchedUser";
import { createResponse } from "../../libs/ResponseBuilder";

const firebaseAdmin = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});
const db = admin.firestore();

exports.handler = async (event: APIGatewayProxyEvent) => {
  let body = {};

  if (!event.queryStringParameters) {
    return createResponse(400, { msg: "No query parameters" });
  }
  const { query } = event.queryStringParameters;

  const authorization = event.headers.authorization;
  const payload = getPayloadInJWT(authorization);

  if (!(payload as JwtPayload).id) {
    return createResponse(403, { msg: "Unauthorized" });
  }

  if (!query) {
    return createResponse(400, { msg: "No query parameters" });
  }
  const searchQueryCodes = getStartsWithCode(query);
  const searchedUserDocs = await db
    .collection(FIREBASE_COLLECTION.USERS)
    .where("username", ">=", searchQueryCodes.startCode)
    .where("username", "<", searchQueryCodes.endCode)
    .get();
  const searchedUsers: SearchedUser[] = searchedUserDocs.docs.map((doc) => {
    const user = doc.data() as UserDetail;
    const searchedUser: SearchedUser = {
      iconURL: user.icon ?? "",
      userId: doc.id,
      username: user.name ?? "",
      email: user.username,
    };
    return searchedUser;
  });
  body = { searchedUsers: searchedUsers };

  return createResponse(200, { ...body });
};
