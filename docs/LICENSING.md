# ORBIT Offline Licensing

## Model

ORBIT uses an offline Ed25519-signed license token.

The shipped application contains only the public verification key. The private signing key stays outside the repository and outside customer installations.

A license token contains:

- license id;
- plan;
- subject;
- issued/expiry timestamps;
- maximum devices;
- account limit;
- feature identifiers.

## Issue a license

Keep the private key in a protected local path and set:

```bash
export ORBIT_LICENSE_PRIVATE_KEY_PATH=/secure/path/orbit-license-private-key.pem
```

Issue a token:

```bash
node scripts/issue-license.mjs LIC-001 customer-001 pro 2027-09-24T00:00:00Z 1 25 analytics,inbox,crm
```

The script writes only the signed token to stdout.

## Customer activation

The Desktop application accepts the token in the local licensing panel. The native runtime verifies:

- token structure;
- payload constraints;
- Ed25519 signature;
- issue/expiry dates;
- account limit.

No licensing network service is required for activation.

## Key custody

Never commit the private signing key, place it in `.env`, or attach it to application releases.

The public key is safe to distribute with the application. Key rotation requires a new public key rollout and an explicit migration plan.

## Current boundary

The current native implementation supports one local device context. `maxDevices` is validated as a positive capability but global multi-device seat counting is not claimed without a coordinating licensing service.

Payments, invoicing, taxes, refunds, and store billing are separate commercial operations and are not implemented by the offline verifier itself.
