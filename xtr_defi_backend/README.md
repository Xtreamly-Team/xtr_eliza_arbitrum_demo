## Setup

Requirements

- Node.js v18+
- pnpm 10
- Docker (wip)
- typescript
- pm2 (optional)
-

1. Clone the repo
2. cd into it
3. pnpm install
4. pnpm dev

## Dev Log & Dev Deps

### Winston

Logging Lib for node supporting multiple transport layers

config@
`src/utils/logger.ts`

### Morgan

HTTP request logger middleware for Node.
Simplifie loggingo of incoming HTTP requests,

config@
`src/app.ts`
