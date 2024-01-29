export interface EncryptedPassword {
  iv: string;
  ephemPublicKey: string;
  ciphertext: string;
  mac: string;
}
