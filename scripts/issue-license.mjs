import { readFile } from "node:fs/promises";
import { createPrivateKey, sign } from "node:crypto";

const privateKeyPath = process.env.ORBIT_LICENSE_PRIVATE_KEY_PATH;
if (!privateKeyPath) {
  throw new Error("Set ORBIT_LICENSE_PRIVATE_KEY_PATH to a local PKCS#8 Ed25519 private-key PEM file.");
}

const [
  licenseId = "lic-" + Date.now(),
  subject = "customer",
  plan = "basic",
  expiresAt = "",
  maxDevices = "1",
  accountLimit = "5",
  featuresCsv = "",
] = process.argv.slice(2);

if (!["basic", "pro", "agency", "lifetime"].includes(plan)) {
  throw new Error("plan must be basic, pro, agency, or lifetime");
}

const payload = {
  licenseId,
  plan,
  subject,
  issuedAt: new Date().toISOString(),
  expiresAt: expiresAt || null,
  maxDevices: Number.parseInt(maxDevices, 10),
  accountLimit: Number.parseInt(accountLimit, 10),
  features: featuresCsv ? featuresCsv.split(",").map((value) => value.trim()).filter(Boolean) : [],
};

if (!Number.isSafeInteger(payload.maxDevices) || payload.maxDevices < 1) throw new Error("invalid maxDevices");
if (!Number.isSafeInteger(payload.accountLimit) || payload.accountLimit < 1) throw new Error("invalid accountLimit");
if (payload.licenseId.length > 200 || payload.subject.length > 200) throw new Error("licenseId/subject too long");

const privateKey = createPrivateKey(await readFile(privateKeyPath, "utf8"));
const canonicalObject = {
  licenseId: payload.licenseId,
  plan: payload.plan,
  subject: payload.subject,
  issuedAt: payload.issuedAt,
  expiresAt: payload.expiresAt,
  maxDevices: payload.maxDevices,
  accountLimit: payload.accountLimit,
  features: [...payload.features],
};
const canonical = Buffer.from(JSON.stringify(canonicalObject), "utf8");
const signature = sign(null, canonical, privateKey);

const base64url = (value) => Buffer.from(value).toString("base64url");
const token = base64url(JSON.stringify(canonicalObject)) + "." + base64url(signature);
process.stdout.write(token + "\n");
