# SimulChess - Professional Chess Training Platform

## Overview
SimulChess is a professional chess training platform designed to enhance over-the-board (OTB) chess habits, strengthen memory skills, and master simultaneous exhibition gameplay. It offers three core training modes: OTB Tournament Mode (with bullet, blitz, and rapid time controls), Blindfold Mode (memory-focused), and Simul Mode (managing multiple concurrent games). The platform aims for serious skill development, combining precision and clarity with organized information density, featuring rating systems, daily game limits, puzzle training, comprehensive statistics, and a premium subscription model.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
**Framework**: React 18 with TypeScript, using Vite.
**UI Components**: Radix UI primitives with shadcn/ui components, styled with Tailwind CSS ("new-york" style variant).
**State Management**: TanStack Query for server state (aggressive caching with `staleTime: Infinity`).
**Routing**: Wouter for lightweight client-side routing.
**Chess Logic**: `chess.js` for game validation and move generation.
**Styling**: Tailwind CSS with custom theme (light/dark modes), Inter font for UI, JetBrains Mono for chess notation.

### Backend Architecture
**Runtime**: Node.js with Express.js (TypeScript).
**API Design**: RESTful endpoints with WebSocket support for real-time features.
**Session Management**: Express sessions with PostgreSQL store (`connect-pg-simple`), 7-day TTL.
**Game State**: Games persist in the database, supporting restoration and time tracking.
**Real-time Communication**: WebSocket server (`/ws`) for multiplayer synchronization, using match-based rooms, authenticated connections, and move broadcasting.

### Authentication & Authorization
**Provider**: Replit OpenID Connect (OIDC) via Passport.js.
**Session Strategy**: Server-side sessions in PostgreSQL, HTTP-only secure cookies.
**User Model**: OIDC subject claim, profiles include email, name, image, premium status.
**Authorization**: Route-level middleware (`isAuthenticated`).
**Development Mode**: Supports test users (`test-player-1` to `test-player-4`) via `x-test-user-id` header for solo multiplayer testing, disabled in production.

### Data Storage
**Database**: PostgreSQL via Neon's serverless driver.
**ORM**: Drizzle ORM for type-safe queries and schema management.
**Schema Design**: Includes `users`, `ratings` (separate per mode), `games`, `matches`, `simulGames`, `puzzles`, `puzzleAttempts`, `userSettings`, `statistics`, and `sessions`.
**Migrations**: Drizzle Kit.

### Game Mechanics
**Time Controls**: Various options (e.g., 3+0, 5+0, 10+0) with increment.
**Move Validation**: `chess.js` validation.
**Game Completion**: Games end via checkmate, resignation, timeout, or draw; updates ratings and statistics.
**Daily Limits**: Free users have daily limits (5 standard, 3 blindfold), reset at midnight.
**Rating System**: Separate rating pools per mode, new users start at 1200 (Simul starts at 1000).

### Training Modes
**OTB Tournament Mode**: Simulates tournament play with clocks, move recording, and time controls.
**Blindfold Mode**: Memory training with configurable "peek" limits and difficulty levels.
**Simul Mode**: Manages multiple concurrent games with sequential move-making.
**Puzzle Training**: Random puzzles with tracking of attempts and success rates.

### Design System
**Typography**: Defined scale, monospace for chess notation.
**Spacing**: 4px base unit system.
**Color Strategy**: High-contrast, semantic color tokens.
**Components**: Multiple variants for buttons, badges, cards.
**Responsive Design**: Mobile-first approach with breakpoints.

## External Dependencies
**Neon Database**: Serverless PostgreSQL.
**Replit Auth**: OpenID Connect authentication.
**Radix UI**: Headless UI component primitives.
**chess.js**: Chess game logic library.
**TanStack Query**: Server state management.
**Tailwind CSS**: Utility-first CSS framework.
**Wouter**: Client-side routing library.
**Vite**: Build tool and dev server.
**date-fns**: Date manipulation utilities.