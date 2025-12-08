# SimulChess - Professional Chess Training Platform

## Overview
SimulChess is a professional chess training platform designed to enhance over-the-board (OTB) chess habits, strengthen memory skills, and master simultaneous exhibition gameplay. It offers four core training modes: Standard (multiplayer), OTB Tournament Mode, Blindfold Mode, and Simul Mode, alongside AI bot opponents with distinct personalities and difficulty levels. Its brand positioning is "Chess.com and Lichess is where you go to play chess. SimulChess is where you go to be better at chess," aiming to complement existing platforms rather than compete. Key capabilities include the only platform offering simulated OTB tournaments online, the world's first Simul vs Simul championships, and a unique blindfold training system.

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
- **Rating System**: Separate rating pools for Bullet, Blitz, Rapid, Classical, OTB, Blindfold, and Simul, with new users starting at 1200 (Simul/OTB at 1000). Matchmaking is FIFO within ±300 Elo.
- **Disconnect Handling**: 30-second grace period; auto-abort or auto-resign based on moves made.

### Training Modes
- **Standard Mode**: Traditional multiplayer chess with simplified time controls (Blitz 3|0, Rapid 15|10).
- **OTB Tournament Mode**: OTB-authentic tournament simulation, featuring ready handshakes, manual clock taps, touch-move enforcement, optional touch-capture, king-first castling, touch highlight for opponent (shows which piece opponent touched in real-time), and an arbiter warning system. Training wheels toggles available (highlight last move, show legal moves).
- **Blindfold Mode**: Memory and visualization training with a unique press-and-hold peek system and progressive difficulty.
- **Simul Mode**: Multi-board management training, starting with 5 boards per player. Supports playing against bots or humans, and scheduled tournaments.
- **Simul vs Simul Tournaments**: Structured events where all players in a group play each other simultaneously across multiple boards, with scaling formats for increasing participants.

### Training Tools
- **Training Notes System**: Optional reminder notes based on user-selected chess principles (opening, middlegame, tactics, endgame, psychology) displayed during games.
- **Bot Training System**: AI opponents with 7 distinct personalities (Balanced, Tactician, Positional, Bishop/Knight Specialist, Aggressor, Defender) and 7 Elo levels (400-2000) for unrated practice.
- **Board Spin**: Memory and tactics training game. Step 1: Memorize a position. Step 2: Recreate it from memory. Step 3 (optional): Find the best move. Uses Stockfish as a separate process (UCI protocol) for infinite random position generation and best move evaluation. No GPL exposure since Stockfish runs as independent executable.

### Voice Control System
Voice control is a general feature available in Standard and Simul modes, configurable via Settings > Preferences > Voice Control:
- **Voice Announcements**: Hear opponent moves spoken aloud during games
- **Voice Commands**: Speak moves instead of clicking (auto-listens on your turn)
- **Supported Modes**: Standard mode (including when blindfold toggle is on), Simul mode
- **Not Available in OTB Mode**: OTB mode simulates real tournaments where you must physically move pieces
- **Implementation**: Uses Web Speech API (browser's native speech synthesis and recognition) - no external costs
- **Features**: Natural language move parsing (e.g., "knight to f3", "castle kingside", "pawn takes d5")

### User-Created Puzzles
Community-driven puzzle system allowing players to create, share, solve, and moderate puzzles:

- **Puzzle Creator** (`/puzzles/create`): 3-step wizard with:
  - Drag-and-drop board editor for position setup
  - Puzzle types: Mate in 1/2/3/4+, Win a Piece, Positional Advantage, Endgame, Opening Trap, Defensive, Sacrifice
  - Difficulty levels: Beginner (800-1200), Intermediate (1200-1600), Advanced (1600-2000), Expert (2000+)
  - Solution moves input with hints system
  - Source attribution: Original, Book, YouTube, Other

- **Puzzle Browser** (`/puzzles`): Three tabs:
  - Train: Random puzzle training with progress tracking
  - Browse: Community puzzles with filtering (type, difficulty, sort by newest/popular/rating)
  - My Puzzles: Puzzles created by the current user

- **Puzzle Solving** (`/puzzle/:id`): Interactive solving with:
  - Click-to-move interface with legal move highlighting
  - Progressive hint system
  - Solution validation with multiple move format support (SAN, LAN, UCI)
  - Share functionality via unique share codes

- **Community Voting**: Upvote/downvote system with:
  - Auto-verification: 5+ net upvotes AND upvotes > 2x downvotes
  - Auto-flagging: 5+ net downvotes AND downvotes > upvotes
  - User reputation system (gain/lose reputation from votes)
  - Solve streak tracking

- **Moderation System**:
  - Report reasons: Incorrect Solution, Duplicate, Impossible Position, Inappropriate, Other
  - Admin endpoints for flagged puzzles, report resolution, verification, and removal
  - Ownership checks: Only creators or admins can edit/delete puzzles

- **Database Tables**: `puzzles` (with metadata), `puzzleVotes`, `puzzleReports`, plus user fields (`isAdmin`, `puzzleReputation`, `puzzleSolveStreak`)

### Post-Game Analysis System
After each game, players access the analysis page from Game History with two tabbed modes:

- **Analyze Tab**: Stockfish-powered engine analysis featuring:
  - Interactive chessboard with position navigation
  - Vertical evaluation bar next to chessboard (±10 pawn scale, mate scores shown as "M")
  - Evaluation graph showing engine assessment over time (clickable for move navigation)
  - Move list with 7-tier classification badges:
    - Genius: Sacrifice (≥2 pawns not recaptured) with compensation (≥1.5 pawn improvement or forced mate)
    - Fantastic: Big advantage swing (≥2 pawns) or checkmate without sacrifice
    - Best: Matches engine's top move (within 10cp tolerance)
    - Good: ≤50cp normalized loss
    - Imprecise: ≤120cp normalized loss
    - Mistake: ≤250cp normalized loss
    - Blunder: >250cp normalized loss
  - Quick Summary card with accuracy percentages (formula: 100 - avgCPL/5, max CPL=500)
  - Phase Breakdown showing opening/middlegame/endgame accuracy
  - Best move suggestions and centipawn loss display
  - Keyboard navigation (arrow keys, Home, End)

- **Review Tab**: Psychology-focused coaching analysis featuring:
  - Focus Check score (consistency in move quality)
  - Efficiency Factor (time spent vs. move quality correlation)
  - Time Trouble detection (when rushing started)
  - Burnout Line (performance degradation in longer games)
  - VSS Mismatch alerts (position misjudgment points)
  - Personalized improvement suggestions

Both modes include shareable analysis links and use Stockfish as a subprocess (UCI protocol), keeping all application code private.

### User Systems
- **Profile System**: User profiles with avatar, game statistics (win/loss/draw by mode), rating history, and account management.
- **Alt Account System**: Allows users to create one alt account for practicing new openings or experimenting without affecting their main rating. Alts have separate ratings, can be reset, and have loss protection against higher-rated main accounts.
- **Admin System**: For platform administration, including user management, moderation, and premium grants, protected by `isAdmin` flags and middleware.

### Anti-Cheat System
- Uses a risk score formula based on move accuracy anomalies, think time anomalies, Simul performance anomalies, and community reports to detect and triage suspicious activity.

### Player Analysis Framework
- Focuses on annotating player psychology and time management rather than just moves. Diagnostic markers include Focus Check (disruption window), Efficiency Factor (time-per-move divergence), VSS Mismatch Alert (pattern recognition), and Burnout Line (CPL degradation in longer games). Provides actionable coaching redirects.

### Simul ELO Calculation
- ELO change is calculated per-board, aggregated, and then adjusted by a K-factor (K = 32 ÷ number of boards) to reflect multi-tasking skills.

### Simul vs Simul Timer Implementation
- **Current approach**: 30-second per-move timer with client-side countdown that syncs with server `simul_timer_state` updates. Client sends `simul_focus_ack` when focusing on a board, and server starts/stops timers based on turn and focus state.
- **How it works**: Server is authoritative for timeouts. Client countdown provides smooth visual updates between server messages. Timer only runs when it's the player's turn AND they have confirmed focus on that board.
- **Known limitation**: Minor display drift possible (1-2 seconds) between client countdown and server time. This is cosmetic only - server remains authoritative for actual timeout decisions.
- **Future enhancement (if needed)**: If timer accuracy issues arise with real users, consider having server send a `deadline` timestamp instead of remaining seconds. Client would then derive countdown from `deadline - Date.now()`, eliminating any drift. Low priority since 30-second per-move timer resets each move.

### Infrastructure
- **Cloudflare Waiting Room Strategy**: Uses a `/health-status` endpoint to trigger Cloudflare's waiting room when CPU load exceeds 90%, ensuring user experience during high traffic.

### Engagement Features
- **This Day in Chess History**: Displays random historical chess facts on page refresh to increase engagement.

### Design System
- **Typography**: Defined scale, monospace for chess notation.
- **Spacing**: 4px base unit system.
- **Color Strategy**: High-contrast, semantic color tokens.
- **Responsive Design**: Mobile-first approach.

## Pre-Publishing Checklist
Before publishing the application, ensure the following legal documents are in place:
- **Privacy Policy** (`/privacy`): Required page explaining data collection, storage, and usage practices
- **Terms of Service** (`/terms`): Required page outlining user responsibilities, content ownership, DMCA takedown process, and liability disclaimers
- **Note**: The puzzle creator requires users to confirm they have rights to share content and agree to Terms of Service before submission

## External Dependencies
- **Neon Database**: Serverless PostgreSQL.
- **Replit Auth**: OpenID Connect authentication.
- **Radix UI**: Headless UI component primitives.
- **chess.js**: Chess game logic library.
- **TanStack Query**: Server state management.
- **Tailwind CSS**: Utility-first CSS framework.
- **Wouter**: Client-side routing library.
- **Vite**: Build tool and dev server.