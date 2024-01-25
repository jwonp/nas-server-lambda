import { EncryptedPassword } from "../types/EncryptedPassword";

export interface UserDetail {
  id:string;
  username: string;
  password: EncryptedPassword;
  name?: string;
  icon?: string;
  phone?: string;
}
export const userDetailKeys = {
  id:"id",
  username: "username",
  password: "password",
  name: "name",
  icon: "icon",
  phone: "phone",
} as const;
