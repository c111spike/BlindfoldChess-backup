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
- **Chess Logic**: `chess.js` for validation and move generation.

### Backend
- **Runtime**: Node.js with Express.js (TypeScript).
- **API**: RESTful endpoints with WebSocket support for real-time features.
- **Authentication**: Replit OpenID Connect (OIDC) via Passport.js, server-side sessions in PostgreSQL, HTTP-only secure cookies.
- **Real-time**: WebSocket server (`/ws`) for multiplayer synchronization using match-based rooms.

### Data Storage
- **Database**: PostgreSQL via Neon's serverless driver.
- **ORM**: Drizzle ORM for type-safe queries and schema management.
- **Schema**: Includes `users`, `ratings`, `games`, `matches`, `simulGames`, `puzzles`, `puzzleAttempts`, `userSettings`, `statistics`, and `sessions`.

### Game Mechanics
- **Time Controls**: Various options (e.g., 3+0, 5+0, 10+0).
- **Rating System**: Separate rating pools for various modes, with new users starting at 1200 (Simul/OTB at 1000). Matchmaking is FIFO within ±300 Elo.
- **Disconnect Handling**: 30-second grace period; auto-abort or auto-resign.

### Training Modes
- **Standard Mode**: Traditional multiplayer chess.
- **OTB Tournament Mode**: Simulates OTB tournaments with features like manual clock taps, touch-move, and an arbiter warning system, including authentic castling mechanics.
- **Blindfold Mode**: Memory and visualization training with a press-and-hold peek system.
- **Simul Mode**: Multi-board management training for simultaneous exhibitions and Simul vs Simul tournaments.

### Bot Engine
A hybrid client-side bot engine leveraging Lichess opening database, Stockfish WASM (client-side), and custom minimax with personality-aware move selection. It supports 8 Elo levels (400-2300) and 7 distinct personalities.

**Draw-Seeking Behavior (Survival Mode):**
- Bots seek draws via threefold repetition when losing significantly after move 20
- Tiered thresholds by difficulty: Intermediate (-5.0), Expert/Advanced (-3.5), Master (-2.5), Grandmaster (-2.0)
- Position history tracking: Uses FEN key (pieces + color + castling + en passant) to detect repetitions
- Repetition bonuses: 3rd occurrence +50000 (forced draw), 2nd +10000, 1st +2000, +500 for checks
- Recapture integration: Recaptures first if position improves above survival threshold
- Implemented in `client/src/lib/botEngine.ts` via `recordPosition()`, `clearPositionHistory()`, `getPositionHistory()`

### Post-Game Analysis System
Provides two tabbed modes for game analysis:
- **Analyze Tab**: Stockfish-powered engine analysis with interactive board, evaluation bar, move classification, and accuracy scores.
- **Review Tab**: Psychology-focused coaching analysis with diagnostic markers like Focus Check, Efficiency Factor, Time Trouble detection, Burnout Line, and VSS Mismatch alerts.

**Move Classification System (Master-Level Thresholds):**
- **Forced**: Only one legal move available
- **Genius**: Best move that delivers mate OR sound sacrifice (evalAfter > -1.0)
- **Fantastic**: Best move that is the only winning move (second-best drops 100+ cp) and maintains position
- **Best**: Matches engine's top recommendation
- **Good**: 1-40 centipawn loss
- **Imprecise**: 41-90 centipawn loss
- **Mistake**: 91-200 centipawn loss
- **Blunder**: 201+ centipawn loss

**Special Move Safeguards:**
- No Genius/Fantastic in crushing positions (|eval| >= 5.0)
- Sacrifice detection: Trade-down by 2+ piece values or piece move with 50cp+ gain
- Only-winning-move detection: Second-best move drops eval by 100+ cp

### User Systems
- **Profile System**: User profiles with statistics and rating history.
- **User-Created Puzzles**: Community-driven system for creating, sharing, solving, and moderating chess puzzles.
  - Optional YouTube video URL support for all puzzle source types (educational supplementary content)
  - YouTube URLs normalized to canonical format to prevent duplicate video submissions across different URL formats

### Infrastructure
- **Cloudflare CDN**: Configured for performance and caching.
- **PostgreSQL Scaling Optimizations**: Database indexes, connection pooling, and in-memory caching for high-concurrency.
- **Stockfish Scaling**: Primarily client-side via WebAssembly for infinite scalability.

### In-Memory Caching System (`server/memoryCache.ts`)
A TTL-based cache for frequently accessed data to reduce database load:

**Cache Keys:**
- `stats:platform` (30s TTL) - Platform-wide statistics
- `leaderboard:{mode}` (60s TTL) - Rating leaderboards by mode
- `boardspin:leaderboard:{difficulty}` (60s TTL) - Board Spin high scores
- `stats:training` (30s TTL) - Training challenge counts
- `puzzles:count` (120s TTL) - Puzzle counts

**Centralized Invalidation Helpers:**
- `invalidateCaches.puzzles()` - Clears puzzle and training counts
- `invalidateCaches.training()` - Clears training stats, game stats, and board spin leaderboards
- `invalidateCaches.gameComplete()` - Clears game stats and all rating leaderboards

**All mutation endpoints use these helpers** to ensure cache consistency on writes.

### Design System
- **Typography**: Defined scale, monospace for notation.
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