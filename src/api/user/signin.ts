import { APIGatewayProxyEvent } from "aws-lambda";
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
    return createResponse(500, { msg: " Fail to process to sign in" });
  }
  if (!event.body) {
    return createResponse(400, { msg: "No user data" });
  }

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
    return createResponse(400, { msg: "No matched user detail" });
  }

  const storedUserDetail = storedUserDetailDocs.docs.map((doc) => {
    return {
      id: doc.id,
      ...(doc.data() as Omit<UserDetail, "id"> & { expiredIn?: number }),
    };
  })[0];

  if (storedUserDetail.expiredIn && storedUserDetail.expiredIn < Date.now()) {
    return createResponse(403, { msg: "This account is expired" });
  }

  const volumeRef = db
    .collection(FIREBASE_COLLECTION.USERS)
    .doc(storedUserDetail.id)
    .collection(FIREBASE_COLLECTION.VOLUME);
  const storedUserVolumeDocs = await volumeRef.get();
  if (storedUserVolumeDocs.size !== 1) {
    if (storedUserVolumeDocs.empty === false) {
      return createResponse(400, { msg: "No matched user volume" });
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

      return createResponse(200, { ...responseData });
    }

    return createResponse(403, { msg: "Fail to sign in" });
  } catch (err) {
    return createResponse(500, { msg: "Fail to process to sign in" });
  }
};
