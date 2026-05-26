# DONI Operations

## Overview

- Repository: `https://github.com/intothewhitecloud-doni/DONI`
- Local path: `/home/chw970320/project/DONI`
- Stack: Next.js 16, React 19, TypeScript, Tailwind CSS
- Runtime: Docker Compose, single `app` service
- Host binding: `127.0.0.1:3002` only

The app is currently a front-end prototype. It stores prototype workspace/session data in browser local storage. There is no database, no object storage, and no project-specific backup requirement yet beyond preserving source/configuration.

## Initial setup

```bash
cd /home/chw970320/project/DONI
npm ci
npm run check
npm audit --audit-level=moderate
```

## Local development

```bash
npm run dev
```

Default dev URL:

```text
http://localhost:3000
```

## Production-style Docker runtime

Validate config:

```bash
docker compose config --quiet
```

Build and start:

```bash
docker compose up -d --build
```

Check status:

```bash
docker compose ps
docker compose logs --tail 80 app
curl -fsS http://127.0.0.1:3002/ >/dev/null
```

Stop without deleting images or volumes:

```bash
docker compose down
```

Do not use `docker compose down -v`; the stack currently has no named volumes, but the server policy still forbids destructive volume deletion without explicit approval.

## Verification gate

```bash
./scripts/harness.sh
```

Harness checks:

1. `npm ci`
2. `npm run check`
3. `npm audit --audit-level=moderate`
4. `docker compose config --quiet`
5. HTTP smoke test if the compose service is running

## Public exposure

The service is intentionally local-only at `127.0.0.1:3002`. To expose publicly later, choose a domain/subdomain and add reverse-proxy routing separately after confirming TLS, access policy, and whether this prototype should be public.

## Current security note

The upstream dependency `next@16.2.5` had a high-severity advisory. This local setup updates `next` to `16.2.6`, after which `npm audit --audit-level=moderate` reports zero vulnerabilities.
