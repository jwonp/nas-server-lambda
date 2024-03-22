import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { decrypt } from "eccrypto";
import { FIREBASE_COLLECTION } from "../../libs/firebase/collections";

import admin from "firebase-admin";
import * as serviceAccount from "../../../firebase-admin-key.json";
import { UserDetail } from "../../entity/UserDetail";
import { VolumeSize } from "../../entity/Volume";
import { createResponse } from "../../libs/ResponseBuilder";

const firebaseAdmin = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});
const db = admin.firestore();

exports.handler = async (event: APIGatewayProxyEvent) => {
  //@ts-ignore
  console.log(event.requestContext.http.path);

  if (!process.env.ECCRYPTO_PRIVATE_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error 501: Fail to process to sign in" }),
    };
  }
  if (!event.body) {
    return { statusCode: 400, body: JSON.stringify({ error: "No user data" }) };
  }

  const response: APIGatewayProxyResult = {
    statusCode: 200,
    body: JSON.stringify({}),
  };
  const ECCRYPTO_PRIVATE_KEY = Buffer.from(
    process.env.ECCRYPTO_PRIVATE_KEY,
    "hex"
  );
  const userDetail: Omit<UserDetail, "id"> = JSON.parse(event.body);

  const storedUserDetailDocs = await db
    .collection(FIREBASE_COLLECTION.USERS)
    .where("username", "==", userDetail.username)
    .get();

  if (storedUserDetailDocs.size !== 1) {
    response.statusCode === 400;
    response.body = JSON.stringify({ error: "No matched user detail" });
    return response;
  }

  const storedUserDetail = storedUserDetailDocs.docs.map((doc) => {
    return {
      id: doc.id,
      ...(doc.data() as Omit<UserDetail, "id"> & { expiredIn?: number }),
    };
  })[0];

  if (storedUserDetail.expiredIn && storedUserDetail.expiredIn < Date.now()) {
    return createResponse(403, { status: 403, msg: "This account is expired" });
  }

  const volumeRef = db
    .collection(FIREBASE_COLLECTION.USERS)
    .doc(storedUserDetail.id)
    .collection(FIREBASE_COLLECTION.VOLUME);
  const storedUserVolumeDocs = await volumeRef.get();
  if (storedUserVolumeDocs.size !== 1) {
    if (storedUserVolumeDocs.empty === false) {
      response.statusCode === 400;
      response.body = JSON.stringify({ error: "No matched user volume" });
      return response;
    }
    const initVolumeSize = 128 * 1024 * 1024;
    const initVolume: VolumeSize = {
      max: initVolumeSize,
      now: 0,
    };
    await volumeRef.add(initVolume);
  }
  const storedUserVolume = storedUserVolumeDocs.docs.map((doc) =>
    doc.data()
  )[0] as VolumeSize;
  const storedUserPassword = storedUserDetail.password;

  const encryptedPassword: eccrypto.Ecies = {
    iv: Buffer.from(userDetail.password.iv, "hex"),
    ephemPublicKey: Buffer.from(userDetail.password.ephemPublicKey, "hex"),
    ciphertext: Buffer.from(userDetail.password.ciphertext, "hex"),
    mac: Buffer.from(userDetail.password.mac, "hex"),
  };
  const storedEncryptedPassword: eccrypto.Ecies = {
    iv: Buffer.from(storedUserPassword.iv, "hex"),
    ephemPublicKey: Buffer.from(storedUserPassword.ephemPublicKey, "hex"),
    ciphertext: Buffer.from(storedUserPassword.ciphertext, "hex"),
    mac: Buffer.from(storedUserPassword.mac, "hex"),
  };

  try {
    const decryptedPassword = await decrypt(
      ECCRYPTO_PRIVATE_KEY,
      encryptedPassword
    );
    const decryptedStoredPassword = await decrypt(
      ECCRYPTO_PRIVATE_KEY,
      storedEncryptedPassword
    );

    console.log(decryptedPassword.toString());
    console.log(decryptedStoredPassword.toString());

    if (decryptedPassword.toString() === decryptedStoredPassword.toString()) {
      const responseData: Omit<UserDetail, "password"> & {
        volume: VolumeSize;
      } = {
        id: storedUserDetail.id,
        username: storedUserDetail.username,
        name: storedUserDetail.name,
        icon: storedUserDetail.icon,
        phone: storedUserDetail.phone,
        volume: storedUserVolume,
      };
      console.log(responseData);
      response.body = JSON.stringify(responseData);
      return response;
    }
    response.statusCode = 403;
    response.body = JSON.stringify({ error: "Fail to sign in" });
    return response;
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Error 502: Fail to process to sign in" }),
    };
  }
};
