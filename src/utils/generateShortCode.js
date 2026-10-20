import { randomInt } from "node:crypto";

const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const LENGTH = 7;

/**
 * Returns a cryptographically random 7-character base62 code
 * (62^7 ≈ 3.5 trillion combinations), always exactly LENGTH characters.
 */
export function generateShortCode() {
  let code = "";
  for (let i = 0; i < LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}
