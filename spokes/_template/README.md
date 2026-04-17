# Spoke Template — {{SPOKE_NAME}}

This is a starter template for building a new industry spoke on the Ayan.ai Hub.

## Quick Start

```bash
# 1. Copy this template
cp -r spokes/_template spokes/your-vertical

# 2. Update spoke-config.yaml with your spoke details

# 3. Install dependencies
cd spokes/your-vertical/admin && pnpm install
cd ../client-app && pnpm install

# 4. Create spoke-specific database tables
psql $DATABASE_URL -f spokes/your-vertical/database/schema.sql

# 5. Run with hub
docker compose -f docker/compose.hub.yml -f docker/compose.your-vertical.yml up
```

## What the Hub Provides (you get for free)

- AI Vision, Audio, Behavior analysis
- Autonomous agent runtime (auto-proctor mode)
- Human-in-the-loop workflows (hybrid-proctor mode)
- Gatekeeper entry approval
- Ghost proctor supervision
- Decision support recommendations
- Learning engine (AI improves from human corrections)
- Real-time WebSocket events
- Multi-tenant auth and RBAC

## What You Build (spoke-specific)

- Admin UI customized for your industry
- Client application (the monitored app)
- Industry-specific database tables
- Custom violation rules (if needed)
- Domain-specific reporting
