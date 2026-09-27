# ORBIT Watchdog Review Notes

Prioritize review of:

- Release-truth drift between release/readiness.json, scorecards, and actual CI/runtime evidence.
- Any L3 claim lacking an exact SHA, evidence reference, and verification time.
- Changes that weaken workspace/RBAC boundaries, local secret protection, queue idempotency/recovery, or connector approval gates.
- Production code that introduces TODO/FIXME/HACK/placeholder markers or unsafe Rust error handling.
- Search changes that cross workspace boundaries or expose vault/session data.
- OMP delegation that loses committed work, mixes incompatible scopes, or lets a worker redefine release policy.
- Attempts to satisfy external evidence with synthetic fixtures, copied historical artifacts, or unverifiable assertions.

Require a clear disposition for every review finding: fixed, explicitly accepted as non-blocking, or OWNER_ACTION.
