import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { UserDetail, userDetailKeys } from "../../entity/UserDetail";
import { FIREBASE_COLLECTION } from "../../libs/firebase/collections";
import { FieldValue } from "firebase-admin/firestore";

import admin from "firebase-admin";
import * as serviceAccount from "../../../firebase-admin-key.json";

const firebaseAdmin = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});
const db = admin.firestore();
exports.handler = async (event: APIGatewayProxyEvent) => {
  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "No request body" }),
    };
  }
  const userDetail = JSON.parse(event.body) as UserDetail;

  const response: APIGatewayProxyResult = {
    statusCode: 200,
    body: JSON.stringify({}),
  };

  const pre = await db
    .collection(FIREBASE_COLLECTION.USERS)
    .where(userDetailKeys.username, "==", userDetail.username)
    .get();
  if (pre.size > 0) {
    response.statusCode = 204;
    return response;
  }
  const res = await db
    .collection(FIREBASE_COLLECTION.USERS)
    .add({ ...userDetail, createdTime: FieldValue.serverTimestamp() });

  const responseData: Omit<UserDetail, "password"> = {
    id: res.id,
    username: userDetail.username,
    name: userDetail.name,
    icon: userDetail.icon,
    phone: userDetail.phone,
  };
  console.log(responseData);
  response.body = JSON.stringify(responseData);
  return response;
};
