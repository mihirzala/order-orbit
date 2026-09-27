import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV, standard for GCM

/**
 * AES-256-GCM encryption for retailer credentials at rest.
 * ENCRYPTION_KEY must be 32 bytes, supplied as 64 hex chars or base64.
 * Wire format: base64(iv) + ":" + base64(authTag) + ":" + base64(ciphertext)
 */
function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("ENCRYPTION_KEY is not set");
  }
  const trimmed = raw.trim();
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    key = Buffer.from(trimmed, "hex");
  } else {
    key = Buffer.from(trimmed, "base64");
  }
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  return key;
}

export function encrypt(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decrypt(payload: string): string {
  const key = getKey();
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed encrypted payload");
  }
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return plain.toString("utf8");
}

/**
 * Mask a username for display: keep the first 2 chars and any domain part.
 * Example: "shopper99@gmail.com" -> "sh••••••@gmail.com"
 */
export function maskUsername(username: string): string {
  const at = username.indexOf("@");
  if (at > 0) {
    const local = username.slice(0, at);
    const domain = username.slice(at);
    const visible = local.slice(0, 2);
    return `${visible}${"•".repeat(Math.max(2, local.length - 2))}${domain}`;
  }
  const visible = username.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(2, username.length - 2))}`;
}
