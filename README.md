# kanban-hono-datastar

A Kanban board application built with Hono, Bun, and Datastar - ported from the Go+templ implementation.

## Features

- 100% functional parity with Go version
- Identical Datastar patterns and drag/drop UX
- Same database schema (via Drizzle ORM)
- Server-Sent Events (SSE) for real-time updates
- No page reloads - all updates via Datastar

## Tech Stack

- **Runtime**: Bun
- **Framework**: Hono
- **Database**: PostgreSQL with Drizzle ORM
- **Frontend**: Datastar with vanilla JavaScript
- **Styling**: Tailwind CSS + DaisyUI
- **Event Store**: Orisun (external event sourcing service)
- **Message Queue**: NATS

## Architecture

This application uses **Event Sourcing** architecture with the following components:

- **Orisun Event Store**: External event sourcing service that stores all domain events
- **Event Handlers**: Process domain events and update read models
- **Checkpointing**: Tracks event processing position to prevent reprocessing
- **Projections**: Build read models from event streams

All state changes are stored as immutable events, enabling complete replay and audit trails.

## Setup

### Prerequisites

You need access to:
- **Orisun event store** instance: https://github.com/oexza/Orisun?tab=readme-ov-file#quick-start
- **PostgreSQL database**
- **NATS server** (default: localhost:4224, already runs with Orisun)

### Environment Configuration

Create a `.env` file with the following variables:

```bash
# Orisun Event Store Configuration
ORISUN_HOST=localhost
ORISUN_PORT=5005
ORISUN_USERNAME=admin
ORISUN_PASSWORD=changeit
ORISUN_BOUNDARY=orisun_test_1

# PostgreSQL Database Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5434
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password@1
POSTGRES_DB=kanban_db
POSTGRES_USE_SSL=false

# NATS Configuration
NATS_URL=nats://localhost:4224

# Application Configuration
NODE_ENV=development
LOG_LEVEL=debug
```

### Installation Steps

1. Install dependencies:

```bash
bun install
```

2. Run database migrations:

```bash
bun run db:migrate
```

3. Seed the database:

```bash
bun run db:seed
```

4. Build CSS:

```bash
bun run css:build
```

5. Start the development server:

```bash
bun run dev
```

The app will be available at `http://localhost:3000`

## Routes

Exact match with Go version:

- `GET /` - Home page with boards list
- `POST /board` - Create new board
- `GET /board/:boardId` - View board
- `POST /board/:boardId/card` - Create card
- `POST /board/:boardId/card/:cardId` - Update card
- `DELETE /board/:boardId/card/:cardId` - Delete card
- `POST /board/:boardId/card/:cardId/comment` - Add comment
- `PUT /board/:boardId/card/:cardId/list` - Move card to different list
- `PUT /board/:boardId/list/:listId/positions` - Reorder cards in list

## Development

- `bun run dev` - Start development server with hot reload
- `bun run css:watch` - Watch and rebuild CSS
- `bun run db:generate` - Generate new migration
- `bun run db:migrate` - Run migrations
- `bun run db:seed` - Seed database

## Production

```bash
bun run build
bun run start
```
