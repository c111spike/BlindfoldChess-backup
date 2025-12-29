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
- **Rating System**: Separate rating pools for various modes, with new users starting at 1200 (Simul/OTB at 1000). Matchmaking is FIFO within ±300 Elo.
- **Disconnect Handling**: 30-second grace period for all game modes; auto-abort or auto-resign thereafter.

### Training Modes
- **Standard Mode**: Traditional multiplayer chess.
- **OTB Tournament Mode**: Simulates OTB tournaments with manual clock taps, touch-move, and arbiter warning system.
- **Blindfold Mode**: Memory and visualization training with a press-and-hold peek system.
- **Simul Mode**: Multi-board management training for simultaneous exhibitions.

### Bot Engine
A hybrid client-side bot engine leveraging Lichess opening database, Stockfish WASM, and custom minimax with personality-aware move selection. Supports 8 Elo levels (400-2500) and 7 distinct personalities. Features tiered checkmate vision and draw-seeking behavior (survival mode) based on difficulty.

### Standardized Difficulty Naming
All game modes use consistent difficulty naming:
- **Patzer** (~400 Elo): Beginner level, basic evaluation
- **Novice** (~600 Elo): Minimal heuristics, slight awareness
- **Intermediate** (~900 Elo): Basic search heuristics
- **Club Player** (~1200 Elo): Full heuristics, decent evaluation
- **Advanced** (~1500 Elo): Strong heuristics
- **Expert** (~1800 Elo): Full strength
- **Master** (~2000 Elo): Near-perfect play
- **Grandmaster** (~2500 Elo): Maximum difficulty

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

## External Dependencies
- **Neon Database**: Serverless PostgreSQL.
- **Replit Auth**: OpenID Connect authentication.
- **Radix UI**: Headless UI component primitives.
- **chess.js**: Chess game logic library.
- **TanStack Query**: Server state management.
- **Tailwind CSS**: Utility-first CSS framework.
- **Wouter**: Client-side routing library.
- **Vite**: Build tool and dev server.