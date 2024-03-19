import { UserCredentials } from "./UserCredentials";

export type TemporaryAccount = Omit<UserCredentials, "password"> & {
  expireIn: number;
  isRegisted: boolean;
  accountCode: string;
  admin: string;
};
