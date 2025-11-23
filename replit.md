# SimulChess - Professional Chess Training Platform

## Overview
SimulChess is a professional chess training platform designed to enhance over-the-board (OTB) chess habits, strengthen memory skills, and master simultaneous exhibition gameplay. It offers three core training modes: OTB Tournament Mode (authentic FIDE-based tournament play), Blindfold Mode (memory-focused visualization training), and Simul Mode (managing multiple concurrent games). Key capabilities include separate rating systems for each mode, dedicated matchmaking, daily game limits, puzzle training, comprehensive statistics, and a premium subscription model. The platform aims to provide a unique, realistic, and competitive chess training experience.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Core Design Principles
The platform prioritizes authenticity for OTB play, memory training for blindfold chess, and efficient multi-game management for simul. It uses a modern web stack for responsiveness and scalability.

### Frontend
- **Framework**: React 18 with TypeScript (Vite).
- **UI**: Radix UI primitives, shadcn/ui components, Tailwind CSS ("new-york" style).
- **State Management**: TanStack Query (aggressive caching).
- **Routing**: Wouter.
- **Chess Logic**: `chess.js` for validation and move generation.
- **Styling**: Tailwind CSS with custom theme (light/dark modes), Inter font for UI, JetBrains Mono for chess notation.

### Backend
- **Runtime**: Node.js with Express.js (TypeScript).
- **API**: RESTful endpoints with WebSocket support for real-time features.
- **Session Management**: Express sessions with PostgreSQL store (7-day TTL).
- **Real-time**: WebSocket server (`/ws`) for multiplayer synchronization, using match-based rooms and authenticated connections.

### Authentication & Authorization
- **Provider**: Replit OpenID Connect (OIDC) via Passport.js.
- **Session Strategy**: Server-side sessions in PostgreSQL, HTTP-only secure cookies.
- **User Model**: OIDC subject claim, including premium status.
- **Authorization**: Route-level middleware.
- **Development**: Supports test users via `x-test-user-id` header.

### Data Storage
- **Database**: PostgreSQL via Neon's serverless driver.
- **ORM**: Drizzle ORM for type-safe queries and schema management.
- **Schema**: Includes `users`, `ratings` (per mode), `games`, `matches`, `simulGames`, `puzzles`, `puzzleAttempts`, `userSettings`, `statistics`, and `sessions`.
- **Migrations**: Drizzle Kit.

### Game Mechanics
- **Time Controls**: Various options (e.g., 3+0, 5+0, 10+0).
- **Game Completion**: Ends via checkmate, resignation, timeout, draw, or disconnect; updates ratings and statistics.
- **Daily Limits**: Free users have daily limits (5 standard, 3 blindfold).
- **Rating System**: Separate rating pools for Bullet, Blitz, Rapid, Classical, OTB, Blindfold, and Simul. New users start at 1200 (Simul/OTB at 1000). Matchmaking is FIFO within ±300 Elo.
- **Disconnect Handling**: 30-second grace period; auto-abort (no rating change) if no moves, auto-resign (rating update) if moves made.

### Training Modes
- **OTB Tournament Mode**: FIDE-based play with manual clock, touch-move enforcement, king-first castling, and an arbiter system for claims. Dedicated OTB Elo rating and matchmaking.
- **Blindfold Mode**: Memory training with configurable "peek" limits and difficulty levels. Board is hidden, showing only the "Last Move" for confirmation. Each player's view is independent.
- **Simul Mode**: Manages multiple concurrent games with sequential move-making.
- **Puzzle Training**: Random puzzles with tracking.

### Design System
- **Typography**: Defined scale, monospace for chess notation.
- **Spacing**: 4px base unit system.
- **Color Strategy**: High-contrast, semantic color tokens.
- **Components**: Multiple variants for UI elements.
- **Responsive Design**: Mobile-first approach.

## External Dependencies
- **Neon Database**: Serverless PostgreSQL.
- **Replit Auth**: OpenID Connect authentication.
- **Radix UI**: Headless UI component primitives.
- **chess.js**: Chess game logic library.
- **TanStack Query**: Server state management.
- **Tailwind CSS**: Utility-first CSS framework.
- **Wouter**: Client-side routing library.
- **Vite**: Build tool and dev server.
- **date-fns**: Date manipulation utilities.