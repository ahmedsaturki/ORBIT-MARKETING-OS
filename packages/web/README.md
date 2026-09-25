# @orbit/web

Next.js 16 static web/PWA surface.

Includes product landing, pricing configuration, legal pages, and offline caching. It does not store platform passwords, cookies, or sensitive session material.

The package uses the Next.js 16 CLI model with the flat ESLint configuration from `eslint-config-next/core-web-vitals`.

Checks:
```bash
pnpm --filter @orbit/web typecheck
pnpm --filter @orbit/web lint
pnpm --filter @orbit/web build
```
