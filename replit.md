# SimulChess - Professional Chess Training Platform

## Overview
SimulChess is a professional chess training platform designed to enhance over-the-board (OTB) chess habits, strengthen memory skills, and master simultaneous exhibition gameplay. It offers three core training modes: OTB Tournament Mode, Blindfold Mode, and Simul Mode, alongside AI bot opponents with distinct personalities and difficulty levels. The platform aims to provide a unique, realistic, and competitive chess training experience with features like separate rating systems, matchmaking, daily game limits, puzzle training, and comprehensive statistics, while adhering to strict legal compliance for a global user base.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Core Design Principles
The platform prioritizes authenticity for OTB play, memory training for blindfold chess, and efficient multi-game management for simul, using a modern web stack for responsiveness and scalability.

### Frontend
- **Framework**: React 18 with TypeScript (Vite).
- **UI**: Radix UI primitives, shadcn/ui components, Tailwind CSS ("new-york" style).
- **State Management**: TanStack Query.
- **Routing**: Wouter.
- **Chess Logic**: `chess.js` for validation and move generation.

### Backend
- **Runtime**: Node.js with Express.js (TypeScript).
- **API**: RESTful endpoints with WebSocket support for real-time features.
- **Session Management**: Express sessions with PostgreSQL store.
- **Real-time**: WebSocket server (`/ws`) for multiplayer synchronization using match-based rooms.

### Authentication & Authorization
- **Provider**: Replit OpenID Connect (OIDC) via Passport.js.
- **Session Strategy**: Server-side sessions in PostgreSQL, HTTP-only secure cookies.

### Data Storage
- **Database**: PostgreSQL via Neon's serverless driver.
- **ORM**: Drizzle ORM for type-safe queries and schema management.
- **Schema**: Includes `users`, `ratings`, `games`, `matches`, `simulGames`, `puzzles`, `puzzleAttempts`, `userSettings`, `statistics`, and `sessions`.

### Game Mechanics
- **Time Controls**: Various options (e.g., 3+0, 5+0, 10+0).
- **Rating System**: Separate rating pools for Bullet, Blitz, Rapid, Classical, OTB, Blindfold, and Simul. New users start at 1200 (Simul/OTB at 1000). Matchmaking is FIFO within ±300 Elo.
- **Disconnect Handling**: 30-second grace period; auto-abort or auto-resign based on moves made.

### Training Modes
- **OTB Tournament Mode**: FIDE-based play with manual clock, touch-move enforcement, king-first castling, arbiter system, and strict time management.
- **Blindfold Mode**: Memory training with configurable "peek" limits and difficulty levels.
- **Simul Mode**: Manages multiple concurrent games with sequential move-making, auto-cycle system, and a 30-second timer reset per board.
- **Puzzle Training**: Random puzzles with tracking.

### Bot Training System
- **Purpose**: AI bot opponents with distinct personalities to provide training and fill matchmaking queues.
- **Personalities**: 7 types (Balanced, Tactician, Positional, Bishop Specialist, Knight Specialist, Aggressor, Defender) across 7 Elo levels (400-2000).
- **Features**: Unrated games, simple evaluation engine with personality-specific piece value overrides, difficulty scaling.
- **Monetization**: Free users get 3 basic bots; Premium users access 4 specialist bots.

### Admin System
- **Purpose**: Platform administration for user management, moderation, and premium grants.
- **Access Control**: Database `isAdmin` flag, middleware protected routes.
- **Features**: Manual premium grants, user suspension (temporary), permanent banning, user search, audit log of admin actions.
- **Security**: All admin actions logged, no hardcoded credentials, strong authentication.

### Legal Compliance (Pre-Launch Requirements)
- **Legal Pages**: Mandatory Terms of Service, Privacy Policy, and Cookie Consent.
- **GDPR Features**: Account deletion, data export (JSON), age verification (13+ requirement).
- **Process**: Legal documents generated via services, lawyer review required, technical features implemented, legal pages linked.
- **Risk Mitigation**: Strong limitation of liability, "use at own risk" clauses due to individual ownership.

### Design System
- **Typography**: Defined scale, monospace for chess notation.
- **Spacing**: 4px base unit system.
- **Color Strategy**: High-contrast, semantic color tokens.
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