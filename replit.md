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
- **Blindfold Challenge**: Memory and visualization training with a press-and-hold peek system.
- **Simul Mode**: Multi-board management training for simultaneous exhibitions.

### Training Gym (Coordinate Drills)
Dedicated training page (`client/src/pages/training.tsx`) with two mini-games for coordinate mastery:
- **Color Blitz**: 60-second timed mode - identify Light/Dark square colors as fast as possible. Uses parity formula: `(fileIndex + rankIndex) % 2 === 0` → Dark. Tracks streak with special haptics at 10-streak milestone.
- **Coordinate Sniper**: Find 10 squares as fast as possible. Voice announces target squares, tap detection with green/red flash feedback, correction loop with voice. Lower times are better.
- **Training Stats** (`client/src/lib/trainingStats.ts`): SQLite table with localStorage fallback. Tracks personal bests and session history.
- **Trophy Tiers**: Color Blitz (Gold 40+, Silver 20+), Coordinate Sniper (Gold ≤10s, Silver ≤20s)
- **Stats Dashboard Training Tab**: 4th tab shows personal bests with trophy badges
- **Daily Goals**: Toggle in Settings with localStorage persistence

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

### Bot Personality: Tactician (Pattern Recognition Engine)
The Tactician uses pattern recognition heuristics instead of extra search depth (which causes node starvation). It "sees" tactical geometries and prioritizes moves that create them:

**Core Mechanics:**
1. **Check Love**: +60 for checks, +1000 for checkmate
2. **Capture Bonus**: +20% of captured piece value
3. **Pawn Storm**: 1.5x bonus for pawn advances toward enemy king
4. **Lever Play**: +40 for pawn exchanges (opens files)

**Pattern Recognition (Heuristic Sniper):**
1. **Fork Finder (+40)**: Bonus when move attacks 2+ pieces of higher value simultaneously (uses `getAttackedSquares` helper)
2. **Pin/Skewer Bonus (+30)**: X-ray attack through lower-value piece to higher-value piece (or king). Detects both pins and skewers.
3. **Discovery Threat (+50)**: Moving a piece that unveils a rook/bishop attack behind it. Only applies if target is king, queen, or value ≥ attacker.

**Aggression Engine:**
4. **King Safety Ghost Bonus (+60)**: When enemy king has <2 pawn protectors, attacking moves get bonus. Safety valve: only if move doesn't lose >100cp (1 pawn).

**Chaos Multiplier:**
5. **Complexity Weight (+20/+35)**: Favor positions with more possible captures (4+ captures = +20, 6+ = +35). Keeps tension high, forces human opponents into tactical minefields.

**Engine Bonuses (Retained):**
- +1 checkmate vision depth, +25% probability for deeper mates
- Fights harder: enters survival mode at -3.0 eval instead of -1.0

**Philosophy**: "Tactics flow from a superior position" - Capablanca. But the Tactician creates that position by recognizing patterns and maintaining maximum tension.

### Post-Game Analysis System
Provides client-side Stockfish-powered engine analysis with interactive board navigation, evaluation bar, and move-by-move review.

### User Systems
- **Profile System**: User profiles with statistics and rating history.
- **User-Created Puzzles**: Community-driven system for creating, sharing, solving, and moderating chess puzzles.
- **Guest Mode**: Anonymous play without signup friction using Better Auth's anonymous plugin:
  - "Play as Guest" button on landing page creates anonymous session
  - Guest users can play games, solve puzzles, and build statistics
  - Post-game prompt (GuestSignupPrompt) encourages conversion after first game
  - Data migration on signup: games, ratings, puzzle attempts, statistics, settings transfer atomically
  - Safe migration: uses NOT EXISTS guards to preserve existing user data

### Anti-Cheat & Report System
- **Cheat Reports**: User-submitted reports with reason, details, and screenshot evidence (uploaded to Replit Object Storage).
- **Admin Moderation**: Interface for managing reports, suspending/banning users, and issuing rating refunds.

### Infrastructure
- **Cloudflare CDN**: Configured for performance and caching.
- **PostgreSQL Scaling Optimizations**: Database indexes, connection pooling, and in-memory caching.
- **Stockfish Scaling**: Primarily client-side via WebAssembly.
- **Redis Integration**: Upstash Redis for horizontal scaling via Replit autoscaling:
  - `server/redis.ts`: Redis client wrapper with health checks, connection pooling, and session store
  - `server/redisPubSub.ts`: Pub/sub messaging for cross-instance WebSocket synchronization
  - `server/wsManager.ts`: WebSocket manager for distributed state across multiple server instances
  - `server/queueManager.ts`: Matchmaking queue using Redis sorted sets with local fallback
  - **Session Storage**: Redis-backed express sessions (~1-5ms vs 50-100ms PostgreSQL), frees DB connections
  - **Simul Sessions**: Redis-backed with local fallback for graceful degradation
  - Supports 5,000-10,000 concurrent users with autoscaling (vs 50-80 on single instance)

### In-Memory Caching System
A TTL-based cache (`server/memoryCache.ts`) for frequently accessed data with centralized invalidation helpers.

### Design System
- **Typography**: Defined scale, monospace for notation.
- **Spacing**: 4px base unit system.
- **Color Strategy**: High-contrast, semantic color tokens.
- **Responsive Design**: Mobile-first approach.

### Position Cache Architecture
The engine layer uses FEN-only caching for "Pure Engine Truth" in `positionCache` (Stockfish analysis) and `syzygyCache` (endgame tablebase results).

## Android Build Instructions
The app uses Capacitor 8 for native Android builds, patched for SDK 34 compatibility.

**Environment (via android-shell.nix):**
- **JDK 17**: Required (JDK 21 has AGP 8.1.4 jlink bugs)
- **Android SDK 34**: Nix stable-24_05 channel constraint
- **AGP 8.1.4**: Compatible with SDK 34 (AGP 8.9+ requires SDK 35+)
- **Gradle 8.11.1**: Bundled

**Required Patches (after `npx cap sync`):**
1. **Java 21 → 17**: Patch all Capacitor modules
   ```bash
   for f in node_modules/@capacitor*/*/android/build.gradle node_modules/@capgo/*/android/build.gradle; do
     sed -i 's/VERSION_21/VERSION_17/g; s/jvmTarget = "21"/jvmTarget = "17"/g' "$f" 2>/dev/null
   done
   ```
2. **VANILLA_ICE_CREAM → 35**: Patch SDK 35 constant in SystemBars.java
   ```bash
   sed -i 's/Build.VERSION_CODES.VANILLA_ICE_CREAM/35/g' node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/plugin/SystemBars.java
   ```

**Build commands:**
```bash
npm run build                    # Build web assets
npx cap sync android             # Sync to Android
node scripts/patch-capacitor-android.cjs  # Apply JDK 17 / SDK 34 patches
nix-shell android-shell.nix --run "cd android && ./gradlew assembleDebug --no-daemon"
```
APK output: `android/app/build/outputs/apk/debug/app-debug.apk` (~9MB)

**Important**: The patch script (`scripts/patch-capacitor-android.cjs`) must be run after every `npx cap sync` or `npm install` because it modifies node_modules files that get overwritten.

**Unified Voice System (Android):**
- Uses `@capacitor-community/speech-recognition` v7.0.1
- AndroidManifest.xml includes `<queries>` for speech services (required for Android 11+)

**VoiceMasterEngine** (`client/src/lib/voice.ts`): Single unified mic handler with mode-based parsing
- All voice recognition routes through one engine to eliminate code duplication
- **Modes**: 'move' (in-game chess moves), 'raw' (training drills), 'placement' (board reconstruction)
- **Clean Session Handoff**: `voiceMaster.start()` stops previous sessions before starting
- **Compatibility Wrappers**:
  - `voiceRecognition`: Wrapper for game.tsx (maintains existing API)
  - `trainingVoice`: Wrapper for training.tsx

**Voice State Machine**: SPEAKING→SETTLING→LISTENING coordination via `voiceController`
- 250ms settling delay for Galaxy S9+ hardware after TTS ends
- `voiceMaster.start()` checks `voiceController.canStartMic()` before starting
- If TTS active, queues start via `voiceController.queueRestart()`
- Prevents Android beep loops from rapid mic start/stop

**S9+ Stability Fixes** (applied universally via VoiceMasterEngine):
- **3-Strike Retry**: After 3 consecutive mic failures, `micBusy` flag set
  - `setOnRetryNeeded(callback)` triggers UI state for manual retry
  - `resetMicBusy()` clears failure state for fresh start
- **In-Game Voice Debouncing**: 2-second timeout for piece moves (knight, bishop, rook, queen, king)
  - Prevents truncation of phrases like "knight c3" - waits for complete phrase
  - Pawn moves process immediately when coordinate pattern detected
- **Clean Slate Pattern**: `voiceMaster.start()` stops any previous session
- **Ready Screens**: Voice Move Master and Reconstruction have Ready screens
  - Heartbeat animation indicates mic readiness
  - Start button initiates voice recognition fresh

## External Dependencies
- **Neon Database**: Serverless PostgreSQL.
- **Replit Auth**: OpenID Connect authentication.
- **Radix UI**: Headless UI component primitives.
- **chess.js**: Chess game logic library.
- **TanStack Query**: Server state management.
- **Tailwind CSS**: Utility-first CSS framework.
- **Wouter**: Client-side routing library.
- **Vite**: Build tool and dev server.