import { APIGatewayProxyEvent } from "aws-lambda";
import { verify } from "jsonwebtoken";

export async function handler(event: APIGatewayProxyEvent) {
  const authorization = event.headers.authorization;
  const response = {
    isAuthorized: false,
  };
  console.log(`event ${JSON.stringify(event)}`);
  console.log(`headers ${JSON.stringify(event.headers)}`);
  console.log(`authorization ${authorization}`);
  if (
    //@ts-ignore
    event.requestContext.http.path === "/user/signin" ||
    //@ts-ignore
    event.requestContext.http.path === "/user/signup"||
    //@ts-ignore
    event.requestContext.http.path === "/user/account/temporary"
  ) {
    response.isAuthorized = true;
    return response;
  }
  if (authorization === undefined || !process.env.JWT_SIGN_KEY) {
    return response;
  }

  const rawToken = authorization.split(" ");
  if (rawToken.length !== 2 || rawToken[0] !== "Bearer") {
    return response;
  }

  const token = rawToken[1];
  const secretKey = process.env.JWT_SIGN_KEY;
  try {
    const verified = verify(token, secretKey);
    console.log("verified");
    console.log(verified);
    response.isAuthorized = true;
    return response;
  } catch (error) {
    return response;
  }
}
