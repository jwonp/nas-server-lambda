export interface BasicResponse {
  status: number;
}
export interface Error {
  body: { msg: string };
}
export interface Success<T = any> {
  body: T;
}
export interface ErrorResponse extends BasicResponse, Error {}
export interface SuccessResponse<T = any> extends BasicResponse, Success<T> {}
