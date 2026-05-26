# DONI Project Guide

DONI is a Next.js/React/TypeScript B2B SaaS decision-console prototype.

## Runtime

- Preferred server runtime: Docker Compose from this project directory.
- Local-only host binding: `127.0.0.1:3002 -> container 3000`.
- Do not expose publicly through Caddy or another reverse proxy until the user chooses the domain and exposure policy.
- Current app state is browser-local prototype state; there is no server database or persistent Docker volume.

## Verification

Run before claiming a change is ready:

```bash
npm run check
npm audit --audit-level=moderate
./scripts/harness.sh
```

For Docker/runtime changes:

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
curl -fsS http://127.0.0.1:3002/ >/dev/null
```

## Operational constraints

- Do not print or commit `.env` values.
- Do not add auth, databases, external AI APIs, or public routing unless requested.
- Keep operational notes in `docs/operations.md` and non-trivial work reports under `/home/chw970320/project/_ops/reports/`.
- Follow `/home/chw970320/project/_ops/commit-convention.md` for commits on this server.
