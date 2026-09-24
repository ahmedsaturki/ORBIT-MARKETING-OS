export {
  createRedactingLogger,
  formatLogLine,
  redactDeep,
  redactText,
  type RedactingLogger,
} from "./redaction.js";
export {
  createVault,
  openVault,
  VaultError,
  VAULT_HEADER_SIZE,
  type Vault,
} from "./vault.js";
export {
  issueLicense,
  verifyLicense,
  LicenseError,
  type LicenseClaims,
  type LicenseFailureReason,
  type LicenseTier,
  type LicenseVerification,
} from "./license.js";
