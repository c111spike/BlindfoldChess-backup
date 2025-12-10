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
- **Rating System**: Separate rating pools for various modes (Bullet, Blitz, Rapid, Classical, OTB, Blindfold, Simul), with new users starting at 1200 (Simul/OTB at 1000). Matchmaking is FIFO within ±300 Elo.
- **Disconnect Handling**: 30-second grace period; auto-abort or auto-resign.

### Training Modes
- **Standard Mode**: Traditional multiplayer chess.
- **OTB Tournament Mode**: Simulates OTB tournaments with features like manual clock taps, touch-move, and an arbiter warning system.
- **Blindfold Mode**: Memory and visualization training with a press-and-hold peek system.
- **Simul Mode**: Multi-board management training for simultaneous exhibitions.
- **Simul vs Simul Tournaments**: Structured events for multi-board simultaneous play.

### Training Tools
- **Training Notes System**: In-game notes based on chess principles.
- **Bot Training System**: AI opponents with 7 personalities and 7 Elo levels (400-2000).
- **Board Spin**: Memory and tactics training game using Stockfish for position generation.

### Voice Control System
Available in Standard and Simul modes, using Web Speech API for voice announcements and commands (e.g., "knight to f3").

### User-Created Puzzles
A community-driven system for creating, sharing, solving, and moderating chess puzzles with a 3-step creation wizard, puzzle browser, interactive solving, and a community voting/moderation system.

### Post-Game Analysis System
Provides two tabbed modes for game analysis:
- **Analyze Tab**: Stockfish-powered engine analysis with interactive board, evaluation bar, move classification (Genius, Fantastic, Best, Good, Imprecise, Mistake, Blunder), and accuracy scores.
- **Review Tab**: Psychology-focused coaching analysis with Focus Check, Efficiency Factor, Time Trouble detection, Burnout Line, VSS Mismatch alerts, and personalized suggestions.
- **Thinking Time Tracking**: Records per-move thinking times for all game modes, used in analysis.

### User Systems
- **Profile System**: User profiles with statistics and rating history.
- **Alt Account System**: Allows one alt account for practice without affecting main rating.
- **Admin System**: For platform administration and moderation.

### Anti-Cheat System
Uses a risk score based on move accuracy, think time, Simul performance anomalies, and community reports.

### Player Analysis Framework
Focuses on annotating player psychology and time management through diagnostic markers like Focus Check, Efficiency Factor, VSS Mismatch Alert, and Burnout Line.

### Simul ELO Calculation
ELO change calculated per-board, aggregated, and adjusted by a K-factor (K = 32 ÷ number of boards).

### Simul vs Simul Timer Implementation
Uses a 30-second per-move server-authoritative timer with client-side countdown and focus-based synchronization.

### Infrastructure
- **Cloudflare Waiting Room Strategy**: Activates Cloudflare waiting room based on CPU load via a `/health-status` endpoint.

### Stockfish Scaling Infrastructure
Server-side Stockfish analysis managed by `analysisService.ts` and `analysisQueueManager.ts`, with adaptive scaling (2M nodes per position, adaptive to 1M under load), PostgreSQL caching, and performance monitoring via an Admin Performance Dashboard.

**Scaling Recommendations**:
- Consider Redis when: cache lookups exceed 50ms, cache size hits 100k+ positions, or hit rate drops below 50%
- Monitor Admin Performance tab for real-time metrics

**Future Optimization (not yet implemented)**:
- Opening books: Could integrate Lichess opening database API or polyglot format for instant opening evaluations
- Endgame tablebases: Syzygy tablebases provide mathematically perfect endgame solutions (5-piece ~1GB, 6-piece ~150GB)
- Would query these first, only falling back to Stockfish for middlegame positions

**Redis Upgrade Instructions (When Ready)**:
When metrics show Redis is needed (cache lookups >50ms, cache size >100k, hit rate <50%), follow these steps:

1. **Create Upstash Account**: Go to upstash.com and sign up (Google/GitHub/email)
2. **Create Redis Database**:
   - Click "Create Database"
   - Name it "simulchess-cache"
   - Choose region closest to your users
   - Select "Regional" type (faster, $20/month Pro plan recommended)
3. **Get Connection Credentials**:
   - Copy `UPSTASH_REDIS_REST_URL` from dashboard
   - Copy `UPSTASH_REDIS_REST_TOKEN` from dashboard
4. **Add to Replit Secrets**: Add both values as secrets in Replit
5. **Implementation**: Install `@upstash/redis` package and update analysisQueueManager.ts to use Redis instead of PostgreSQL for cache operations

Benefits: Sub-millisecond lookups (vs 10-50ms PostgreSQL), better concurrency, automatic expiration policies

### Engagement Features
- **This Day in Chess History**: Displays historical chess facts.

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