# Commercial Connector Proof

This harness performs an owner-authorized live connector smoke test.

It intentionally requires:

- `--confirm-live`;
- local environment variables only;
- no secrets in command output or logs.

Required local inputs:

- `ORBIT_TELEGRAM_TEST_TOKEN`
- `ORBIT_TELEGRAM_TEST_CHAT_ID`
- `ORBIT_LINKEDIN_TEST_TOKEN`
- `ORBIT_LINKEDIN_TEST_AUTHOR_URN`
- optional `ORBIT_LINKEDIN_API_VERSION` (defaults to `202609`)

Run:

`pnpm exec tsx scripts/commercial-connector-proof.ts --confirm-live`

The Telegram test sends a clearly labeled test message to the supplied test chat. The LinkedIn test publishes the clearly labeled test post using the supplied author URN.

The script exits with:

- `0` only when both authorization and delivery succeed;
- `2` when confirmation or local test inputs are missing;
- `1` for an actual connector failure.

Never paste credentials into chat. Store them only in the local environment/vault used by the controlled test environment.

The resulting report binds the proof result to the triggering Git SHA (`GITHUB_SHA`) and contains pass/fail metadata only; it does not print tokens or secret values.
