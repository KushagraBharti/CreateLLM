"use node";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function base64UrlToBuffer(value: string) {
  return Buffer.from(value, "base64url");
}

function getMasterKey() {
  const encoded = process.env.PROVIDER_VAULT_MASTER_KEY;
  if (!encoded) {
    throw new Error("PROVIDER_VAULT_MASTER_KEY is not configured");
  }
  const key = base64UrlToBuffer(encoded);
  if (key.length !== 32) {
    throw new Error("PROVIDER_VAULT_MASTER_KEY must decode to 32 bytes");
  }
  return key;
}

export function fingerprintSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex").slice(0, 16);
}

export function encryptSecret(secret: string) {
  const masterKey = getMasterKey();
  const dek = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", dek, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const wrapIv = randomBytes(12);
  const wrapCipher = createCipheriv("aes-256-gcm", masterKey, wrapIv);
  const wrappedDek = Buffer.concat([wrapCipher.update(dek), wrapCipher.final()]);
  const wrapTag = wrapCipher.getAuthTag();

  return {
    ciphertext: Buffer.concat([ciphertext, authTag]).toString("base64url"),
    iv: iv.toString("base64url"),
    wrappedDek: Buffer.concat([wrapIv, wrappedDek, wrapTag]).toString("base64url"),
    keyVersion: "v1",
    fingerprint: fingerprintSecret(secret),
  };
}

export function decryptSecret(input: {
  ciphertext: string;
  iv: string;
  wrappedDek: string;
}) {
  const masterKey = getMasterKey();
  const wrapped = base64UrlToBuffer(input.wrappedDek);
  const wrapIv = wrapped.subarray(0, 12);
  const wrapTag = wrapped.subarray(wrapped.length - 16);
  const wrappedDek = wrapped.subarray(12, wrapped.length - 16);
  const wrapDecipher = createDecipheriv("aes-256-gcm", masterKey, wrapIv);
  wrapDecipher.setAuthTag(wrapTag);
  const dek = Buffer.concat([wrapDecipher.update(wrappedDek), wrapDecipher.final()]);

  const payload = base64UrlToBuffer(input.ciphertext);
  const tag = payload.subarray(payload.length - 16);
  const data = payload.subarray(0, payload.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", dek, base64UrlToBuffer(input.iv));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
