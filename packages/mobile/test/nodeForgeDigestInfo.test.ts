import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

/**
 * Regression guard for CVE-2026-85393 (GHSA-86w9-cpqp-85rv).
 *
 * node-forge 1.4.0 fixed CVE-2026-33894 by checking the element count of the
 * outer `DigestInfo` SEQUENCE only. `asn1.validate` still ignored extra
 * children of the nested `DigestAlgorithm` SEQUENCE, so garbage bytes could be
 * embedded there to forge a PKCS#1 v1.5 signature for a low-exponent (e.g.
 * e=3) key.
 *
 * Upstream has no released fix: 1.4.0 is the latest release, the advisory
 * records `Patched versions: None`, and the maintainer-endorsed fix
 * (digitalbazaar/forge#1152) is an unmerged, unreleased PR. This repo
 * backports it through pnpm `patchedDependencies`.
 *
 * `pnpm audit` matches on declared version, so it keeps reporting this
 * advisory whether or not the patch is applied. These tests are what prove the
 * patched code is installed and enforcing the stricter check, so the backport
 * cannot be silently dropped.
 */

/** A forge message-digest object: carries its algorithm and its digest. */
interface Md {
  update(value: string): Md;
  digest(): { bytes(): Uint8Array; getBytes(): string };
}

interface RsaPublicKey {
  /**
   * `verify` compares the recovered digest against a raw byte string, so the
   * caller must pass `md.digest().getBytes()` rather than the md object.
   */
  verify(
    digest: string,
    signature: Uint8Array,
    scheme?: unknown,
    options?: { _parseAllDigestBytes?: boolean; _skipPaddingChecks?: boolean },
  ): boolean;
}

interface RsaKeyPair {
  publicKey: RsaPublicKey;
  /** `sign` builds the DigestInfo itself, so it takes the md object. */
  privateKey: { sign(digest: Md): Uint8Array };
}

/** The node-forge surface these tests use. */
interface Forge {
  util: { binary: { hex: { decode(value: string): Uint8Array } } };
  jsbn: { BigInteger: new (value: string, radix: number) => unknown };
  pki: {
    setRsaPublicKey(n: unknown, e: unknown): RsaPublicKey;
    rsa: { generateKeyPair(bits: number): RsaKeyPair };
  };
  md: { sha256: { create(): Md } };
}

const require_ = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

/** Load node-forge exactly as @expo/code-signing-certificates resolves it. */
const forge: Forge = (() => {
  const expoPkg = require_.resolve("expo/package.json", { paths: [here] });
  const cscPkg = require_.resolve(
    "@expo/code-signing-certificates/package.json",
    { paths: [dirname(expoPkg)] },
  );
  return require_("node-forge", { paths: [dirname(cscPkg)] });
})();

const N_HEX =
  "E932AC92252F585B3A80A4DD76A897C8B7652952FE788F6EC8DD640587A1EE56" +
  "47670A8AD4C2BE0F9FA6E49C605ADF77B5174230AF7BD50E5D6D6D6D28CCF0A8" +
  "86A514CC72E51D209CC772A52EF419F6A953F3135929588EBE9B351FCA61CED7" +
  "8F346FE00DBB6306E5C2A4C6DFC3779AF85AB417371CF34D8387B9B30AE46D7A" +
  "5FF5A655B8D8455F1B94AE736989D60A6F2FD5CADBFFBD504C5A756A2E6BB5CE" +
  "CC13BCA7503F6DF8B52ACE5C410997E98809DB4DC30D943DE4E812A47553DCE5" +
  "4844A78E36401D13F77DC650619FED88D8B3926E3D8E319C80C744779AC5D6AB" +
  "E252896950917476ECE5E8FC27D5F053D6018D91B502C4787558A002B9283DA7";

// Signature over MESSAGE whose encoded message carries an extra, unconsumed
// garbage OCTET STRING inside the nested DigestAlgorithm SEQUENCE, after its
// OID and NULL parameters. This is the digitalbazaar/forge#1152 vector.
const FORGED_SIG =
  "a4ae63dd5e7712b78f4870d0f51e294df5503d4f16c5d27ae33370981fb57f0de49f" +
  "50f3d6a04666774cd984cd13972db9bf8e12bd294ef0ddc916c7c86cbae63efd7b6b" +
  "97885e69760c208a40f1aecc76a90d7af5145177efce1bb55807a8d05c20b1596753" +
  "ba710642fc9acdde6c160232654662c77cc4466c8257a38edb49f894e8845d0fd987" +
  "b857ced88f4b62505a080bd87ef700d35d392a6e8f6fde34250c50b86fae606cb551" +
  "215e8f4813239b77651d5565ad453698c071d48c31e8e526fb4a37610f64b3e1fb8e" +
  "5be5898e408ad08197a0947794a530b54f84485377ce4a7488ed485ce4e5e105dd89" +
  "698a472f390c3b1b76bc16b73276c4d1c81d";

const MESSAGE = "hello world!";

test("node-forge rejects forged PKCS#1 v1.5 signatures with nested DigestAlgorithm garbage", () => {
  const publicKey = forge.pki.setRsaPublicKey(
    new forge.jsbn.BigInteger(N_HEX, 16),
    new forge.jsbn.BigInteger("3"),
  );

  const md = forge.md.sha256.create();
  md.update(MESSAGE);

  // The patched validator must refuse this: the nested DigestAlgorithm
  // sequence has three children (OID, NULL, garbage) where only two are legal.
  assert.throws(
    () =>
      publicKey.verify(
        md.digest().getBytes(),
        forge.util.binary.hex.decode(FORGED_SIG),
        undefined,
        { _parseAllDigestBytes: true, _skipPaddingChecks: true },
      ),
    /does not contain a valid RSASSA-PKCS1-v1_5 DigestInfo value/,
    "forged signature was accepted: the CVE-2026-85393 patch is not installed",
  );
});

test("node-forge still verifies genuine signatures after the patch", () => {
  const keypair = forge.pki.rsa.generateKeyPair(512);
  const md = forge.md.sha256.create();
  md.update(MESSAGE);
  const signature = keypair.privateKey.sign(md);

  const md2 = forge.md.sha256.create();
  md2.update(MESSAGE);

  // Guards against the backport breaking legitimate verification.
  assert.equal(
    keypair.publicKey.verify(md2.digest().getBytes(), signature),
    true,
    "genuine signature was rejected: the CVE-2026-85393 patch regressed verification",
  );
});
