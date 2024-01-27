import { verify } from "jsonwebtoken";
export const getPayloadInJWT = (authorization: string | undefined) => {
  if (!authorization) {
    return null;
  }

  const rawToken = authorization.split(" ");
  if (rawToken.length !== 2 || rawToken[0] !== "Bearer") {
    return null;
  }

  const token = rawToken[1];
  const secretKey = process.env.JWT_SIGN_KEY;

  if (!secretKey) {
    return null;
  }

  try {
    const verified = verify(token, secretKey);
    console.log(verified);
    return verified;
  } catch (error) {
    return null;
  }
};
