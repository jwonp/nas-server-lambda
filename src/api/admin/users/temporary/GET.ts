import { APIGatewayProxyEvent } from "aws-lambda";
import { FIREBASE_COLLECTION } from "../../../../libs/firebase/collections";
import admin from "firebase-admin";
import * as serviceAccount from "../../../../../firebase-admin-key.json";
import { JwtPayload } from "jsonwebtoken";
import { getPayloadInJWT } from "../../../../libs/JWTparser";
import { TemporaryAccount } from "../../../../types/TemporaryAccount";
import { createResponse } from "../../../../libs/ResponseBuilder";
import { FieldPath } from "firebase-admin/firestore";
import { encryptObject, encryptString } from "../../../../libs/crypto";
import { AccountCodeObject } from "../../../../types/AccountCodeObject";
import { UserCredentials } from "../../../../types/UserCredentials";

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

  const adminUserRef = db.collection(FIREBASE_COLLECTION.USERS);
  const temporaryAccountRef = db.collectionGroup(
    FIREBASE_COLLECTION.TemporaryAccounts
  );

  const temporaryAccountDocs = await temporaryAccountRef.get();
  if (temporaryAccountDocs.empty) {
    return createResponse(200, { accounts: [] });
  }

  const adminIdSet = new Set<string>();

  const temporaryAccountsWithAdminId =
    temporaryAccountDocs.docs.map<TemporaryAccount>((doc) => {
      const data = doc.data() as Omit<TemporaryAccount, "accountCode"> & {
        password: string;
      };
      const accountCodeObject: UserCredentials & {
        admin: string;
        expireIn: number;
      } = {
        username: data.username,
        password: data.password,
        phone: data.phone,
        name: data.name,
        icon: data.icon,
        admin: data.admin,
        expireIn: data.expireIn,
      };
      const { password, ...dataWithoutPassword } = data;
      const docData = {
        ...dataWithoutPassword,
        accountCode: encryptObject(accountCodeObject) ?? "",
      };
      adminIdSet.add(docData.admin);

      return docData;
    });

  const adminsDocs = await adminUserRef
    .where(FieldPath.documentId(), "in", Array.from(adminIdSet))
    .get();

  const adminMap = new Map<string, string>();

  adminsDocs.docs.forEach((doc) => {
    adminMap.set(doc.id, (doc.data() as any).name ?? "");
  });

  const temporaryAccountsWithAdminName: TemporaryAccount[] =
    temporaryAccountsWithAdminId.map((account) => {
      return { ...account, admin: adminMap.get(account.admin) ?? "" };
    });

  if (
    temporaryAccountsWithAdminName.filter((account) => account.admin === "")
      .length > 0
  ) {
    return createResponse(400, {
      status: 400,
      msg: "Error on loading accounts",
    });
  }

  return createResponse(200, { accounts: temporaryAccountsWithAdminName });
};
