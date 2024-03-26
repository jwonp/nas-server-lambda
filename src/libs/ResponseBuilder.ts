import { APIGatewayProxyResult } from "aws-lambda";
import { Error, Success } from "../types/Responses";
type ReturnResponse = {};
export const createResponse = <T = Success | Error>(
  statusCode: number,
  body: T,
  headers?:
    | {
        [header: string]: boolean | number | string;
      }
    | undefined,
  multiValueHeaders?:
    | {
        [header: string]: Array<boolean | number | string>;
      }
    | undefined,
  isBase64Encoded?: boolean | undefined
) => {
  const response: APIGatewayProxyResult = {
    statusCode: statusCode,
    body: JSON.stringify(body),
    headers,
    multiValueHeaders,
    isBase64Encoded,
  };

  return response;
};
