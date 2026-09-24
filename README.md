# ORBIT Marketing OS

Local-first social operations system: campaigns, inbox, CRM, content studio, automation and approvals in one console.

> Status: v2 architecture in progress. Core domain logic is under `packages/core` with unit tests. The web console lives in `src/`.

## Architecture

See [docs/PRODUCT_ARCHITECTURE_V2.md](docs/PRODUCT_ARCHITECTURE_V2.md) for planes, invariants and domain modules. For the end-user walkthrough of the console, see [docs/USER_GUIDE.md](docs/USER_GUIDE.md).

Key invariants:

1. Credentials never enter analytics events.
2. Renderer never receives unrestricted filesystem/database capabilities.
3. No automation task executes before policy evaluation.
4. Every task has a deterministic lifecycle and terminal state.
5. Connectors expose only capabilities they implement.
6. Unknown/changing UI states fail closed.
7. Sync transports carry encrypted application updates, not raw credentials.
8. Local AI optional; content model provider-independent.
9. Backup restore verifies integrity before replacing active state.
10. Releases are immutable, versioned and checksummed.

## Prerequisites

- Node.js 20+ (22 recommended)
- npm 10+
- `GEMINI_API_KEY` for AI features (see `.env.example`)

## Quick start

```bash
npm install
npm install --prefix packages/core
cp .env.example .env   # then set GEMINI_API_KEY
npm run dev            # http://localhost:3000
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server with Vite middleware |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run lint` | TypeScript typecheck (no emit) |
| `npm test --prefix packages/core` | Core unit tests (vitest) |
| `npm run typecheck --prefix packages/core` | Core typecheck |
| `npm run checksums` | Write `dist/SHA256SUMS.txt` release evidence |

## Packages

### `packages/core`

Pure TypeScript domain logic (no framework dependencies):

- `workflows` — fail-closed content approval gate
- `queue` — bounded retries, backoff, execution gate
- `policy` — policy evaluation + circuit breaker
- `connectors` — capability handshake, challenge safe-stop
- `audit` — hash-chained audit log with tamper detection

```bash
npm test --prefix packages/core
```

## PWA

Production builds register a service worker (`public/sw.js`) and ship a web app manifest (`public/manifest.webmanifest`) for installability and offline shell caching.

## Security model

- Secrets are expected to be handled by the host environment (AI Studio secrets / local `.env`).
- `.env` is gitignored; only `.env.example` is committed.
- Automation safety controls (rate budgets, circuit breaker, challenge detection) exist for reliability and policy compliance — not for evading platform enforcement.
- Audit entries form a SHA-256 hash chain; tampering is detectable.

## Acceptance

Runtime requirements and evidence rules are tracked in [docs/ACCEPTANCE_MATRIX_V2.md](docs/ACCEPTANCE_MATRIX_V2.md). Features are not marked PASS from source inspection alone.

## License

Private / unlicensed unless otherwise stated.
