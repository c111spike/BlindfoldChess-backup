# SimulChess - Professional Chess Training Platform

## Overview
SimulChess is a professional chess training platform designed to enhance over-the-board (OTB) chess habits, strengthen memory, and master simultaneous exhibition gameplay. It offers four core training modes: Standard, OTB Tournament, Blindfold, and Simul, alongside AI bot opponents. The platform aims to complement existing chess sites by focusing on training and skill improvement, positioning itself as "where you go to be better at chess." Key capabilities include simulated OTB tournaments, Simul vs Simul championships, and a unique blindfold training system.

## User Preferences
Preferred communication style: Simple, everyday language.

## Monetization Model
**Ads-Only Model**: All training modes (OTB, Blindfold, Board Spin, N-Piece Challenge, Knight Tours) are fully free with no daily limits. Revenue comes from advertising only - no premium membership tiers.

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

### OTB Castling Implementation
OTB mode uses authentic over-the-board castling which requires clicking the king first, then clicking the rook (not the destination square). This simulates real tournament play where players physically pick up both pieces.

**Technical Flow:**
1. User clicks king (e1), then clicks rook (h1 for kingside)
2. Guard detects king moving >1 square to own rook
3. Castling validated against `legalChessGame` (pre-castled FEN)
4. Visual board updated: king to g1, rook to f1
5. Move record stored: `{from: e1, to: g1, notation: "O-O"}`
6. User presses clock → `executeBotTurn` validates the move
7. For bot games: `legalChessGame` is NOT updated during castling; validation happens in `executeBotTurn`
8. For multiplayer: `legalChessGame` is updated immediately and move sent via WebSocket

**Safety Guards:**
- King moving >1 square without clicking own rook is blocked
- `completeMove` has a fail-safe that rejects any king two-square move

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

#### Cloudflare CDN Configuration (Free Tier)
When deploying with a custom domain through Cloudflare, use these recommended settings:

**Speed > Optimization:**
- Brotli Compression: Enabled by default (no toggle needed as of 2024)
- Auto Minify: Removed in 2024 (Vite handles this during build)
- Rocket Loader: Leave OFF (conflicts with React)

**Caching > Configuration:**
- Browser Cache TTL: 8 hours (or longer for static assets)
- Caching Level: Standard
- Always Online: ON

**SSL/TLS:**
- Mode: Full (strict)

**Page Rules (3 free):**
1. `yourdomain.com/api/*` → Cache Level: Bypass
2. `yourdomain.com/ws/*` → Cache Level: Bypass
3. `yourdomain.com/assets/*` → Cache Level: Cache Everything, Edge TTL: 1 month

**Server-side Headers:**
API routes automatically include `Cache-Control: no-store` headers to prevent Cloudflare from caching dynamic content.

**Future (Paid Features):**
- **Cloudflare Waiting Room Strategy**: Activates Cloudflare waiting room based on CPU load via a `/health-status` endpoint (requires Business plan).

### Stockfish Scaling Infrastructure

**Hybrid Architecture** (Client-Side Primary):
The platform uses a hybrid client-side + server-side Stockfish architecture for infinite scalability:

**Client-Side Stockfish (Primary - NEW)**:
- Uses `stockfish` npm package (v17.1 lite-single WASM, 7MB download)
- Runs entirely in browser via Web Worker for zero server load
- Implements request queue serialization to prevent WebAssembly crashes
- Files: `client/src/lib/stockfish.ts`, `client/src/lib/gameAnalysis.ts`, `client/src/hooks/useClientAnalysis.ts`

**Client-Side Features**:
- **Game Analysis**: Full move-by-move analysis with accuracy scores, move classification (Genius, Fantastic, Best, Good, Imprecise, Mistake, Blunder)
- **Board Spin**: Position generation and best move calculation run entirely client-side
- Trade-offs: ~2x slower than native Stockfish, 7MB WASM download, device-dependent performance
- Files: `client/src/lib/boardSpinClient.ts`

**Server-Side Stockfish (Secondary)**:
Server-side Stockfish analysis managed by `analysisService.ts` and `analysisQueueManager.ts`, with adaptive scaling (2M nodes per position, adaptive to 1M under load), PostgreSQL caching, and performance monitoring via an Admin Performance Dashboard.

**Redis Caching** (Active):
- Upstash Redis caching is live with 30-day TTL for position evaluations
- All 404 historical positions migrated from PostgreSQL to Redis
- Sub-millisecond lookups (vs 10-50ms PostgreSQL), automatic TTL expiration
- Fallback to PostgreSQL if Redis unavailable (graceful degradation)
- Files: server/redisCache.ts, server/analysisQueueManager.ts, server/migrations/migrate-to-redis.ts

**Scaling Capacity**:
- Client-side analysis: Unlimited concurrent users (no server load)
- Server-side with Redis: 100-1000 concurrent users with cache hits
- Monitor Admin Performance tab for cache hit rates and response times

**Future Optimization (not yet implemented)**:

**Lichess Opening Database Integration**:
- Free API at lichess.org/api for instant opening evaluations (~100ms)
- Shows master game statistics and popular continuations
- Cuts Stockfish workload by ~25-40% (most analyzed positions are openings)
- **For Analysis**: Instant opening evaluations, shows "masters played this"
- **For Bots**: Access millions of master games; personality affects line choice (aggressive → sharp lines, defensive → solid lines)
- Cache results in Redis for reuse

**Syzygy Endgame Tablebases**:
- 5-piece: ~1GB storage, covers most practical endgames
- 6-piece: ~150GB (use remote API instead of local)
- Sub-millisecond perfect endgame evaluations
- **For Analysis**: Mathematically infallible endgame assessments
- **For Bots**: Perfect endgame play at high difficulty; lower difficulty bots can still "miss" tablebase moves (intentional mistakes preserved)

**Hybrid Move Pipeline (for bots)**:
```
1. Opening phase? → Check Lichess API → pick move matching personality
2. Endgame (≤5 pieces)? → Check Syzygy → perfect move (or intentional miss for lower Elo)
3. Middlegame? → Use Stockfish cache/minimax as now
```

**Implementation Order**:
1. Redis caching (prerequisite for all optimizations)
2. Lichess Opening API (easy, free, big impact)
3. 5-piece Syzygy tablebases (1GB, one-time setup)
4. Optional: 6-piece Syzygy via remote API

**Redis Configuration Notes**:
- Environment variables: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Replit Secrets
- Auto-swap logic handles if URL/TOKEN values are accidentally swapped in the secrets UI
- To disable Redis temporarily: remove the environment variables (PostgreSQL fallback activates automatically)

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