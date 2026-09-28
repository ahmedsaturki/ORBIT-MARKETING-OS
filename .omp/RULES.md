# ORBIT OMP Sticky Rules

- Never claim L3_PRODUCTION_PROVEN without durable evidence references and an exact verification timestamp.
- Never turn a fixture, source contract, prior commit, or reachable deployment into external production proof.
- Never bypass or weaken a failed security, quality, or release gate.
- Never report a rollback drill unless both rollback and return-to-current paths were actually observed.
- Never report 24-hour stability from a short soak.
- Never claim store distribution from a debug package.
- Never print, commit, upload, or post credentials, cookies, tokens, private keys, session payloads, or vault contents.
- Durable release documents may retain historical exact-SHA evidence, but must never describe a moving current `main` commit by hard-coded SHA.
- When release/provenance or production-web behavior changes, land the change through the reviewed PR/merge path rather than pushing it directly to `main`, so governed Git deployment provenance can observe the release event.
- Treat `release/PRODUCTION_RELEASE.json` as the explicit production-release control plane: ordinary main commits must not deploy solely because release documents changed. Only a reviewed non-bootstrap marker update may trigger production deployment/provenance verification.
- Challenges, authentication uncertainty, permission failures, and unexpected platform behavior fail closed and require human intervention.
- When the next step requires owner-controlled credentials, devices, signing identities, billing activation, legal approval, or elapsed time, emit OWNER_ACTION and continue all unrelated local engineering work.
