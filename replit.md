# SimulChess - Professional Chess Training Platform

## Overview
SimulChess is a professional chess training platform designed to enhance over-the-board (OTB) chess habits, strengthen memory, and master simultaneous exhibition gameplay. It offers four core training modes: Standard, OTB Tournament, Blindfold, and Simul, alongside AI bot opponents. The platform aims to complement existing chess sites by focusing on training and skill improvement, positioning itself as "where you go to be better at chess." Key capabilities include simulated OTB tournaments, Simul vs Simul championships, and a unique blindfold training system.

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
- **Chess Logic**: `chess.js`.

### Backend
- **Runtime**: Node.js with Express.js (TypeScript).
- **API**: RESTful endpoints with WebSocket support for real-time features.
- **Authentication**: Better Auth with email/password, integrated with React via `better-auth/react`.
- **Real-time**: WebSocket server (`/ws`) for multiplayer synchronization using match-based rooms.

### Data Storage
- **Database**: PostgreSQL via Neon's serverless driver.
- **ORM**: Drizzle ORM.
- **Schema**: Includes `users`, `ratings`, `games`, `matches`, `simulGames`, `puzzles`, `puzzleAttempts`, `userSettings`, `statistics`, and `sessions`.

### Game Mechanics
- **Time Controls**: Various options.
- **Rating System**: Separate rating pools for various modes, with new users starting at 1200. Matchmaking is FIFO within ±300 Elo.
- **Disconnect Handling**: 30-second grace period; auto-abort or auto-resign thereafter.

### Training Modes
- **Standard Mode**: Traditional multiplayer chess.
- **OTB Tournament Mode**: Simulates OTB tournaments with manual clock taps, touch-move, and arbiter warning system.
- **Blindfold Mode**: Memory and visualization training with a press-and-hold peek system.
- **Simul Mode**: Multi-board management training for simultaneous exhibitions.

### Bot Engine
A hybrid client-side bot engine leveraging Lichess opening database, Stockfish WASM, and custom minimax with personality-aware move selection. Supports 8 Elo levels (400-2500) and 7 distinct personalities (Fortress Defender, Positional Grandmaster, Bishop Specialist, Knight Specialist, Tal Attacker, Tactician, Balanced). Features tiered checkmate vision and draw-seeking behavior. Includes a human-like move delay system.

### Bot Personality: Tal Attacker (Aggressive)
The Aggressive personality implements Mikhail Tal's philosophy - calculated sacrifices, coordinated attacks, and sensing when the position is "ripe" for assault:

**Core Mechanics:**
1. **Capture Bonus**: +80 for captures, +100 for checks
2. **Forward March**: +40 for moves toward enemy king's side of the board
3. **Pawn Storm**: 3x bonus for pawn advances on enemy king's flank

**Tal Enhancements:**
1. **Attack Unit Density ("Sense of Ripeness")**: Count attacking units within 3 squares of enemy king (Q=4, R=3, Minor=2, P=1). When attack units ≥8, enter "Tal Moment" with extra bonuses (+50 for checks, +30 for captures).
2. **Initiative Multiplier (Sacrifice Logic)**: Flat bonuses for justified sacrifices (capped at 120): +80 for checking sacrifices, +100 during Tal Moment, +60 for sacrifices landing within 2 squares of king.
3. **Coordination ("Reload" Mechanic)**: Tiered bonuses for moves landing near enemy king when pieces are converging: +25 at 4+ attack units, +35 at 6+ units, +50 during Tal Moment.
4. **King in Center Hunting**: If enemy king hasn't castled by move 12 (still on d8/e8 or d1/e1), activate "Kill Mode" with +90 for center pawn breaks (d4, e4, d5, e5) and +30 for any central piece activity.

**Philosophy**: "A sacrifice is best refuted by accepting it" - but Tal made them accept and crushed them anyway. Values tempo and attack over material.

### Post-Game Analysis System
Provides two tabbed modes: Stockfish-powered engine analysis (`Analyze Tab`) and psychology-focused coaching analysis (`Review Tab`). Features interactive board, evaluation, move classification (Genius, Fantastic, Best, Good, Imprecise, Mistake, Blunder), accuracy scores, and tactical motif detection for personalized coaching.

### User Systems
- **Profile System**: User profiles with statistics and rating history.
- **User-Created Puzzles**: Community-driven system for creating, sharing, solving, and moderating chess puzzles.

### Anti-Cheat & Report System
- **Cheat Reports**: User-submitted reports with reason, details, and screenshot evidence (uploaded to Replit Object Storage).
- **Admin Moderation**: Interface for managing reports, suspending/banning users, and issuing rating refunds.

### Infrastructure
- **Cloudflare CDN**: Configured for performance and caching.
- **PostgreSQL Scaling Optimizations**: Database indexes, connection pooling, and in-memory caching.
- **Stockfish Scaling**: Primarily client-side via WebAssembly.

### In-Memory Caching System
A TTL-based cache (`server/memoryCache.ts`) for frequently accessed data with centralized invalidation helpers.

### Design System
- **Typography**: Defined scale, monospace for notation.
- **Spacing**: 4px base unit system.
- **Color Strategy**: High-contrast, semantic color tokens.
- **Responsive Design**: Mobile-first approach.

### Position Cache Architecture
The engine layer uses FEN-only caching for "Pure Engine Truth" in `positionCache` (Stockfish analysis) and `syzygyCache` (endgame tablebase results).

## External Dependencies
- **Neon Database**: Serverless PostgreSQL.
- **Replit Auth**: OpenID Connect authentication.
- **Radix UI**: Headless UI component primitives.
- **chess.js**: Chess game logic library.
- **TanStack Query**: Server state management.
- **Tailwind CSS**: Utility-first CSS framework.
- **Wouter**: Client-side routing library.
- **Vite**: Build tool and dev server.