import { APIGatewayProxyResult } from "aws-lambda";
export const createResponse = (statusCode: number, body: any) => {
  const response: APIGatewayProxyResult = {
    statusCode: statusCode,
    body: JSON.stringify(body),
  };

  return response;
};
