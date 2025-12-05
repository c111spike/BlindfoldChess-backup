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

### Post-Game Options
After each game, players choose between two modes:
- **Review**: SimulChess's unique coaching system analyzing player psychology and time management (Focus Check, Efficiency Factor, VSS Mismatch, Burnout Line). Answers "How did YOU play?"
- **Analyze**: Traditional Stockfish-powered engine analysis with line-by-line evaluation, variation exploration, and centipawn loss. Answers "What were the best moves?"
Both options use Stockfish as a separate process, keeping all application code private.

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

### Infrastructure
- **Cloudflare Waiting Room Strategy**: Uses a `/health-status` endpoint to trigger Cloudflare's waiting room when CPU load exceeds 90%, ensuring user experience during high traffic.

### Engagement Features
- **This Day in Chess History**: Displays random historical chess facts on page refresh to increase engagement.

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