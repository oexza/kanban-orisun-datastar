# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Development Server
- `bun run dev` - Start development server with hot reload on port 3000
- `bun run build` - Build for production 
- `bun run start` - Start production server (runs on port 3011)
- `bun run type-check` - Run TypeScript compiler in watch mode

### Database Operations
- `bun run db:generate` - Generate new Drizzle migration
- `bun run db:migrate` - Run database migrations
- `bun run db:seed` - Seed database with sample data
- `bun run setup` - Run migrate + seed + CSS build (one-time setup)

### CSS/Styling
- `bun run css:build` - Build Tailwind CSS to static/style.css
- `bun run css:watch` - Watch and rebuild CSS during development

## Architecture Overview

This is a Kanban board application built with event sourcing architecture. The system maintains 100% functional parity with a Go+templ version.

### Core Technologies
- **Runtime**: Bun with TypeScript
- **Web Framework**: Hono.js
- **Database**: SQLite with Drizzle ORM
- **Frontend**: Datastar (SSE-based) with vanilla JavaScript
- **Styling**: Tailwind CSS + DaisyUI
- **Event Store**: Orisun (external event sourcing service)

### Event Sourcing Architecture

The application uses a comprehensive event sourcing pattern with the following key components:

- **Orisun Event Store**: External event sourcing service (`src/event-sourcing-utils/orisun-event-sourcing.ts`)
- **Event Handlers**: Process domain events and update read models
- **Checkpoints**: Track event processing position to prevent reprocessing (`projector_checkpoint` table)
- **Event Types**: Defined in `src/events/events.ts`

### Database Schema

Uses Drizzle ORM with SQLite (`drizzle/schema.ts`):
- Core entities: users, boards, lists, cards, tags, comments
- Event sourcing support: projector_checkpoint table
- Relations defined between all entities with proper foreign keys

### Application Structure

- **Routes**: `src/routes/index.ts` - Hono app with SSE endpoints and API routes
- **Components**: `src/components/` - JSX components for server-side rendering
- **Database**: `src/db/` - Database access layer and seeding scripts
- **Event Sourcing**: `src/event-sourcing-utils/` - Event store integration and checkpointing
- **Slices**: `src/slices/` - Modular route handlers (e.g., create_board)

### Datastar Integration

The application uses Datastar for real-time UI updates without page reloads:
- SSE helpers in `src/lib/datastar.ts`
- HTML morphing for seamless updates
- Drag-and-drop functionality with immediate feedback
- Hot reload support via `/hotreload` endpoint

### API Routes Pattern

All routes follow the same pattern:
1. Receive HTTP request
2. Perform database operation or emit event
3. Re-fetch updated data
4. Render JSX component to HTML
5. Return SSE response to morph the DOM

Routes return either full HTML pages (for navigation) or SSE patches (for Datastar requests).

### Development Notes

- The application expects an Orisun event store to be available
- Environment variables: `ORISUN_BOUNDARY`, `PORT`
- Both TypeScript (.ts) and JavaScript (.js) files exist during development
- Uses Hono's streaming capabilities for SSE responses