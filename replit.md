# SimulChess - Professional Chess Training Platform

## Overview
SimulChess is a professional chess training platform designed to enhance over-the-board (OTB) chess habits, strengthen memory skills, and master simultaneous exhibition gameplay. It offers four core training modes: Standard (multiplayer), OTB Tournament Mode, Blindfold Mode, and Simul Mode, alongside AI bot opponents with distinct personalities and difficulty levels.

**Brand Positioning:** "Chess.com and Lichess is where you go to play chess. SimulChess is where you go to be better at chess."

**Market Position:** Complementary to Chess.com/Lichess, not competing. SimulChess is the "batting cage" to their "major league baseball."

**Unique Value Propositions:**
- Only platform offering simulated OTB tournaments online
- World's first Simul vs Simul championships
- Blindfold training with progressive difficulty and press-and-hold peek system

## User Preferences
Preferred communication style: Simple, everyday language.

## Business Model

### Monetization Strategy: Ads-Only (Launch)
- **Model:** 100% free access to all features + ads
- **Positioning:** Between Lichess (100% free, no ads) and Chess.com (freemium + ads)
- **Ads:** 3 rotating ads every 37.5 seconds
- **Projected Revenue:** $69K-101K/year at 5K daily active users ($0.20-0.25 CPM)
- **Hosting Costs:** $80-150/month on Replit (~$1.5K/year)
- **Premium Tier:** May be added later based on demand once user base is established

### Marketing Channels
- Reddit (r/chess, r/chessbeginners)
- Discord (chess server communities)
- X (Twitter) - chess content creators, tournament clips
- YouTube Shorts - quick clips of Simul/Blindfold moments
- TikTok - short-form viral potential

### Marketing Hooks
1. "Can you manage 5 chess games at once?"
2. "Play blindfold chess with training wheels"
3. "Practice OTB tournaments without leaving home"
4. "The world's first Simul vs Simul championship"

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

#### Standard Mode
- **Purpose**: Traditional multiplayer chess
- **Time Controls**: Blitz (3|0) and Rapid (15|10) only - simplified for queue concentration
- **Matchmaking**: FIFO within ±300 Elo

#### OTB Tournament Mode
- **Purpose**: FIDE-authentic tournament simulation - the only platform offering this online
- **Features**:
  - Ready handshake button to start game (simulates real tournament etiquette)
  - Manual clock tap after each move
  - Touch-move enforcement (own pieces)
  - Optional touch-capture rule (opponent pieces) - toggle in settings
  - King-first castling requirement
  - Arbiter warning system
  - Forfeit for no-show (30-second timeout on ready)
- **Customizable Settings** (per player):
  - Touch-capture rule (ON/OFF) - default OFF for mobile users
  - Highlight last move (ON/OFF)
  - Show legal moves (ON/OFF)
  - Training reminder notes (ON/OFF with selectable notes)

#### Blindfold Mode
- **Purpose**: Memory and visualization training
- **Peek System**: Press-and-hold to see board (not timer-based) - better for learning
- **Tracking**: Total peek time tracked as improvement metric
- **Difficulty Levels**: Progressive difficulty scaling

#### Simul Mode
- **Purpose**: Multi-board management training
- **Structure**: 5 boards per player (accessible entry point)
- **Vs Bots**: Always available - solves cold start problem
- **Vs Humans (Casual)**: Queue-based when players online
- **Tournaments**: Scheduled events with scaling structure

#### Simul vs Simul Tournament Structure
- **Format**: All players in a group play each other simultaneously (each manages multiple boards)
- **Move Timer**: 30 seconds per move
- **Season 1 (121 players)**:
  - 11 groups of 11 players (10 boards each)
  - 11 winners advance to championship
  - 1 World Champion crowned
- **Season 2 Scaling (1,331 players)**:
  - Quarter Finals: 121 groups of 11 players → 121 winners
  - Semi Finals: 11 groups of 11 players → 11 winners
  - Championship: 11 finalists → 1 World Champion
- **Tiebreakers**: Win % → Fewest moves → Least time used

#### Training Notes System
- **Purpose**: Develop good thinking habits during games
- **Display**: Optional reminder notes shown above game board
- **Limit**: Up to 10 notes displayed at once
- **Selection**: User chooses from 49 chess principles across categories:
  - Opening principles
  - Middlegame strategy
  - Tactical awareness
  - Endgame technique
  - Psychology/discipline
- **Learning Progression**: Beginners use all notes, advanced players turn them off

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

### Profile System
- **Purpose**: User profiles with avatar, game statistics, and account management.
- **Features**: Profile picture upload, win/loss/draw statistics by mode, rating history display, alt account management.
- **Profile Display**: Avatar shown next to player names during games (top for opponent, bottom for user).
- **Statistics Tracking**: Games played, win rate, rating progression across all 7 rating pools.

### Alt Account System
- **Purpose**: Allows players to practice new openings, create rating climb content, and experiment without affecting main account rating.
- **Account Limit**: Each user gets 1 alt account (not multiple).
- **Alt Account Creation**: User chooses custom name (profanity filtered) and starting ELO (400 to main account's current rating).
- **Account Switching**: Manual switch between main/alt (cannot switch during active games). User can only be logged into one account at a time.
- **Allowed Modes**: Alts can play in Standard and Blindfold modes only (NOT in OTB Tournament or Simul modes).
- **Rating System**: Alt has separate ratings for Bullet/Blitz/Rapid/Classical/Blindfold. Alt cannot exceed main account's rating (dynamic hard cap per rating pool).
- **ELO Reset**: 
  - Free users: 1 reset per 30 days (rolling window from last reset).
  - Premium users: Unlimited resets.
  - User chooses new starting ELO (400-main) on each reset.
  - No alt deletion - alts exist forever, can only reset ELO.
- **Loss Protection (Anti-Smurf)**:
  - When losing to an alt, system compares main account ratings in the same rating pool (Blitz-to-Blitz, Rapid-to-Rapid).
  - Rating difference 500+: Lose 0% ELO.
  - Rating difference 300-499: Lose 25% ELO.
  - Rating difference 150-299: Lose 50% ELO.
  - Rating difference 0-149: Lose 100% (normal) ELO.
  - When WINNING against alt: Normal ELO gain (no bonus).
  - Alt vs Alt: No loss protection, normal ELO calculation for both players.
- **Profile Images**: Alt accounts can have separate profile pictures from main account.
- **Use Cases**: Practice new openings without tanking main rating, YouTube rating climb content, experimenting with specific strategies.

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