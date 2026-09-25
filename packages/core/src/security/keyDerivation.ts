/**
 * Platform boundary for deriving encryption keys from a user secret.
 *
 * ORBIT intentionally does not ship a home-grown password KDF. Desktop/native
 * adapters must provide Argon2id with an independently generated salt and
 * explicit memory/time/parallelism parameters. Browser/mobile adapters may
 * provide an equivalent reviewed implementation behind this interface.
 */
export interface Argon2idParameters {
  readonly memoryKiB: number;
  readonly iterations: number;
  readonly parallelism: number;
  readonly hashLength: 32;
}

export interface KeyDerivationProvider {
  deriveKey(
    secret: string,
    salt: Uint8Array,
    parameters: Argon2idParameters,
  ): Promise<Uint8Array>;
}

export function validateArgon2idParameters(
  parameters: Argon2idParameters,
): void {
  if (
    !Number.isInteger(parameters.memoryKiB) ||
    parameters.memoryKiB < 8 * 1024
  ) {
    throw new RangeError("Argon2id memory must be at least 8192 KiB");
  }
  if (!Number.isInteger(parameters.iterations) || parameters.iterations < 1) {
    throw new RangeError("Argon2id iterations must be positive");
  }
  if (!Number.isInteger(parameters.parallelism) || parameters.parallelism < 1) {
    throw new RangeError("Argon2id parallelism must be positive");
  }
  if (parameters.hashLength !== 32) {
    throw new RangeError("ORBIT requires a 256-bit derived key");
  }
}
