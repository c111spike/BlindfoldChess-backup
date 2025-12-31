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
- **Rating System**: Separate rating pools for various modes, with new users starting at 1200 (all modes including Simul/OTB). Matchmaking is FIFO within ±300 Elo.
- **Disconnect Handling**: 30-second grace period for all game modes; auto-abort or auto-resign thereafter.

### Training Modes
- **Standard Mode**: Traditional multiplayer chess.
- **OTB Tournament Mode**: Simulates OTB tournaments with manual clock taps, touch-move, and arbiter warning system.
- **Blindfold Mode**: Memory and visualization training with a press-and-hold peek system.
- **Simul Mode**: Multi-board management training for simultaneous exhibitions.

### Bot Engine
A hybrid client-side bot engine leveraging Lichess opening database, Stockfish WASM, and custom minimax with personality-aware move selection. Supports 8 Elo levels (400-2500) and 7 distinct personalities. Features tiered checkmate vision and draw-seeking behavior (survival mode) based on difficulty.

### Bot Personality: Fortress Defender
The Defensive personality implements a "Fortress" philosophy - actively trading down, coordinating pieces around the king, and punishing overextension:

**Core Mechanics:**
1. **Trade-Seeking**: +35 bonus for equal trades, extra bonus for Q/R trades (removes attacking potential)
2. **Zone Defense**: King-proximity bonus for N/B within 2-3 squares of king (+40/+20), penalty for distant pieces
3. **Infiltration Detection**: Scans for enemy N/R/Q on 3rd/4th rank with threat scoring (Q=60, R=40, N=30, scaled by king proximity)
4. **Urgency System**: All moves penalized when infiltrators exist (creates urgency to deal with threats)
5. **Counter-Punch**: Capturing infiltrator = +80 bonus + full penalty removal; Attacking infiltrator = +35 + partial relief
6. **Iron Fortress**: 2x pawn shield protection penalty (never weaken king cover)
7. **Rook Coordination**: Bonus for rooks on back ranks (defensive positioning)

**Priority Ladder**: Capture infiltrator > Attack infiltrator > Ignore (full penalty applies)

### Bot Personality: Positional Grandmaster (Iron Tigran)
The Positional personality implements Petrosian-style strategic play - patient, prophylactic, and focused on long-term advantages:

**Core Mechanics:**
1. **Center Control**: +50 bonus for pieces on c3-f6 central squares
2. **Structure Preservation**: +30 for quiet pawn moves, -25 for doubled pawn creation
3. **Pawn Shield Awareness**: -30 penalty for weakening pawns near own king
4. **Development**: +40 for moving N/B off back rank, +30 for castling

**Petrosian Enhancements:**
1. **Exchange Sacrifice Awareness**: +70 for R-for-minor trades that remove attackers near king (≤3 squares), +50 for capturing central pieces. Strong enough to override 0.5 eval gap in MultiPV.
2. **Bad Bishop Tax**: Penalty (up to -40) when own pawns block bishop on same color squares (4+ pawns = "tall pawn")
3. **Over-Protection (Nimzowitsch)**: +10 per extra defender on already-defended central pawns. Creates rock-solid structures.

**Philosophy**: Patient accumulation of small advantages, prophylactic defense, and structural superiority over tactical chaos.

### Bot Move Delay System
Human-like thinking time simulation with priority-based delay logic:

**Priority Order (Standard/OTB):**
1. Recapture available → 1 second (reflexive move)
2. Clock pressure (<60s) → 1 second (time trouble)
3. Piece count (endgame detection):
   - Lone king (1 piece) → 1s
   - 2-5 pieces → 2-3s
   - 6-11 pieces → 3-4s
4. Move count (opening/middlegame):
   - Moves 1-5 → 1s (opening book)
   - Moves 6-11 → 2-3s (development)
   - Moves 12+ → 3-6s (middlegame thinking)

**Simul Mode (30-second turn timer, no clock pressure):**
1. Recapture available → 1 second
2. Piece count:
   - Lone king → 1s
   - 2-5 pieces → 3-5s
   - 6-10 pieces → 3-7s
3. Move count:
   - Moves 1-5 → 1s
   - Moves 6-10 → 2-4s
   - Moves 11+ → 3-10s

Helper functions in `botEngine.ts`:
- `countBotPieces(fen, botColor)`: Counts bot's pieces from FEN
- `detectRecapture(lastMove, fen)`: Detects recapture opportunities

### Standardized Difficulty Naming
All game modes use consistent difficulty naming:
- **Patzer** (~400 Elo): Beginner level, basic evaluation
- **Novice** (~600 Elo): Minimal heuristics, slight awareness
- **Intermediate** (~900 Elo): Basic search heuristics
- **Club Player** (~1200 Elo): Full heuristics, decent evaluation
- **Advanced** (~1500 Elo): Strong heuristics
- **Expert** (~1800 Elo): Full strength
- **Master** (~2000 Elo): Near-perfect play, 10 depth, 2M nodes
- **Grandmaster** (~2500 Elo): Maximum difficulty, 11 depth, 3M nodes, MultiPV=2 for reliable depth with personality

### Post-Game Analysis System
Provides two tabbed modes for game analysis:
- **Analyze Tab**: Stockfish-powered engine analysis with interactive board, evaluation, move classification, and accuracy scores.
- **Review Tab**: Psychology-focused coaching analysis with diagnostic markers like Focus Check, Efficiency Factor, Time Trouble detection, and VSS Mismatch alerts.
- **Move Classification System**: Categorizes moves (Genius, Fantastic, Best, Good, Imprecise, Mistake, Blunder) based on centipawn loss and strategic impact.
- **Tactical Motif Detection**: Client-side engine detects 35+ tactical patterns for personalized coaching and puzzle auto-tagging. Integrates with user motif statistics and provides clickable training links.

### User Systems
- **Profile System**: User profiles with statistics and rating history.
- **User-Created Puzzles**: Community-driven system for creating, sharing, solving, and moderating chess puzzles, including optional YouTube video URL support.

### Anti-Cheat & Report System
- **Cheat Reports**: User-submitted reports with reason selection, details, and screenshot evidence. Screenshots are compressed and uploaded to Replit Object Storage.
- **Admin Moderation**: Interface for managing reports, suspending/banning users, and issuing rating refunds.

### Infrastructure
- **Cloudflare CDN**: Configured for performance and caching.
- **PostgreSQL Scaling Optimizations**: Database indexes, connection pooling, and in-memory caching.
- **Stockfish Scaling**: Primarily client-side via WebAssembly.

### In-Memory Caching System
A TTL-based cache (`server/memoryCache.ts`) for frequently accessed data (platform stats, leaderboards, puzzle counts) with centralized invalidation helpers to ensure consistency.

### Design System
- **Typography**: Defined scale, monospace for notation.
- **Spacing**: 4px base unit system.
- **Color Strategy**: High-contrast, semantic color tokens.
- **Responsive Design**: Mobile-first approach.

### Position Cache Architecture
The engine layer uses FEN-only caching for "Pure Engine Truth":
- **positionCache**: Stores Stockfish analysis results keyed by FEN hash (SHA-256). Contains evaluation, depth, bestMove, hitCount, and expiration.
- **syzygyCache**: Stores endgame tablebase results keyed by FEN hash. Contains DTZ (distance to zeroing), WDL (win/draw/loss), and optimal moves.

This design is intentional—the best move doesn't change based on who's playing; only the player's ability to find it varies by skill level.

### Future Enhancement: Human Performance Analytics
When the player base diversifies beyond the starting 1200 Elo, a `humanPerformance` table can be added to track behavioral data without polluting the engine cache:

| Column | What it stores | Why it matters |
|--------|----------------|----------------|
| `fenHash` | Links to positionCache | Connects "Truth" to "Behavior" |
| `eloRange` | Elo bucket (e.g., 1000-1200) | Identify which skill levels reach this position |
| `blunderRate` | % who missed the bestMove | Training module gold mine |
| `commonMistake` | Most frequent wrong move | Valuable for targeted coaching |
| `sampleSize` | Number of games analyzed | Statistical confidence |

**Buyout Value**: A database showing "Players at 1100 Elo have a 70% fail rate on this Rook endgame" is premium analytics data.

**Implementation Note**: Not built yet—all players currently start at 1200 Elo, so meaningful Elo-stratified data requires time for the player base to spread across rating ranges.

## External Dependencies
- **Neon Database**: Serverless PostgreSQL.
- **Replit Auth**: OpenID Connect authentication.
- **Radix UI**: Headless UI component primitives.
- **chess.js**: Chess game logic library.
- **TanStack Query**: Server state management.
- **Tailwind CSS**: Utility-first CSS framework.
- **Wouter**: Client-side routing library.
- **Vite**: Build tool and dev server.