# Development Workflow (Fast Iteration)

Use this workflow for near-instant local iteration in the monorepo.

## Why

`docker/compose.full.yml` with `--build` is a full image rebuild path.
It is intentionally slower (dependency install + image export) and is not suitable for normal code-edit loops.

`docker/compose.dev.yml` is the hot-reload path with bind mounts and targeted rebuilds.

## Commands

### One-time boot (initial image build)

```bash
npm run dev:bootstrap
```

### Daily start (no rebuild)

```bash
npm run dev:up
```

### App-only run

```bash
npm run dev:admin
npm run dev:quiz
npm run dev:simulator
```

### Rebuild only when dependencies changed

```bash
npm run dev:admin:rebuild
npm run dev:quiz:rebuild
npm run dev:simulator:rebuild
```

### Stop / logs

```bash
npm run dev:logs
npm run dev:down
```

## Rules

1. For normal development, do not use `docker compose -f docker/compose.full.yml up --build`.
2. Use `compose.dev.yml` + bind mounts so `.ts`/`.tsx` edits hot reload without rebuild.
3. Run `*:rebuild` only when package dependencies or lockfiles changed.

## Quick Reminder

```bash
npm run dev:help
```
