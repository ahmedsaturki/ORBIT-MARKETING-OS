export interface AccountFormInput {
  readonly id: string;
  readonly platform: string;
  readonly displayName: string;
}

const SUPPORTED_PLATFORMS = new Set([
  "facebook",
  "instagram",
  "telegram",
  "whatsapp",
  "linkedin",
  "tiktok",
]);

export function validateAccountForm(input: AccountFormInput): string[] {
  const errors: string[] = [];
  if (!input.id.trim() || input.id.trim().length > 200)
    errors.push("invalid id");
  if (!SUPPORTED_PLATFORMS.has(input.platform.trim().toLowerCase()))
    errors.push("unsupported platform");
  if (!input.displayName.trim() || input.displayName.trim().length > 200)
    errors.push("invalid display name");
  return errors;
}
