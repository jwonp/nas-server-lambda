import { APIGatewayProxyEvent } from "aws-lambda";
import { FIREBASE_COLLECTION } from "../../libs/firebase/collections";
import admin from "firebase-admin";
import * as serviceAccount from "../../../firebase-admin-key.json";
import { MetaData } from "../../types/MetaData";
import { JwtPayload } from "jsonwebtoken";
import { getPayloadInJWT } from "../../libs/JWTparser";
import { VolumeSize } from "../../entity/Volume";
import { createResponse } from "../../libs/ResponseBuilder";

const firebaseAdmin = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});
const db = admin.firestore();

exports.handler = async (event: APIGatewayProxyEvent) => {
  if (!event.body) {
    return createResponse(400, { msg: "No body" });
  }

  const authorization = event.headers.authorization;
  const payload = getPayloadInJWT(authorization);

  if (!(payload as JwtPayload).id) {
    return createResponse(403, { msg: "Unauthorized" });
  }
  const userDocId = (payload as JwtPayload).id;
  const metas: Omit<MetaData, "isFavorite">[] = JSON.parse(event.body) as Omit<
    MetaData,
    "isFavorite"
  >[];
  console.log(metas);
  const userVolumeDocs = await db
    .collection(FIREBASE_COLLECTION.USERS)
    .doc(userDocId)
    .collection(FIREBASE_COLLECTION.VOLUME)
    .get();
  if (userVolumeDocs.size !== 1) {
    return createResponse(400, { msg: "Error on loading user volume" });
  }
  const userVolumeDocId = userVolumeDocs.docs.map((doc) => doc.id)[0];
  const userVolume = userVolumeDocs.docs.map((doc) =>
    doc.data()
  )[0] as VolumeSize;

  const volumeCost = metas
    .map((meta) => meta.size)
    .reduce((acc, cur, idx) => {
      return (acc += cur);
    }, 0);

  if (userVolume.now + volumeCost > userVolume.max) {
    return createResponse(400, { msg: "Not enough storage volume" });
  }

  const batch = db.batch();
  const userRef = db
    .collection(FIREBASE_COLLECTION.USERS)
    .doc(userDocId)
    .collection(FIREBASE_COLLECTION.VOLUME)
    .doc(userVolumeDocId);

  const metaRef = metas.map((meta) => {
    const { ownerId: _, ...rest } = meta;
    return {
      ref: db
        .collection(FIREBASE_COLLECTION.USERS)
        .doc(meta.ownerId)
        .collection(FIREBASE_COLLECTION.STORAGES)
        .doc(),
      rest: { ...rest, isFavorite: false },
    };
  });
  metaRef.forEach((meta) => {
    batch.set(meta.ref, meta.rest);
  });
  batch.update(userRef, { now: userVolume.now + volumeCost });
  await batch.commit();

  const body = {
    metas: metas,
    volume: {
      max: userVolume.max,
      now: userVolume.now + volumeCost,
    },
  };

  return createResponse(200, { ...body });
};
