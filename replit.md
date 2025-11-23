# SimulChess - Professional Chess Training Platform

## Overview
SimulChess is a professional chess training platform designed to enhance over-the-board (OTB) chess habits, strengthen memory skills, and master simultaneous exhibition gameplay. It offers three core training modes: OTB Tournament Mode (authentic FIDE-based tournament play with manual clock, touch-move enforcement, and arbiter system), Blindfold Mode (memory-focused visualization training), and Simul Mode (managing multiple concurrent games). The platform features separate rating systems for each mode (Bullet, Blitz, Rapid, Classical, OTB, Blindfold, Simul), dedicated matchmaking queues, daily game limits, puzzle training, comprehensive statistics, and a premium subscription model.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
**Framework**: React 18 with TypeScript, using Vite.
**UI Components**: Radix UI primitives with shadcn/ui components, styled with Tailwind CSS ("new-york" style variant).
**State Management**: TanStack Query for server state (aggressive caching with `staleTime: Infinity`).
**Routing**: Wouter for lightweight client-side routing.
**Chess Logic**: `chess.js` for game validation and move generation.
**Styling**: Tailwind CSS with custom theme (light/dark modes), Inter font for UI, JetBrains Mono for chess notation.

### Backend Architecture
**Runtime**: Node.js with Express.js (TypeScript).
**API Design**: RESTful endpoints with WebSocket support for real-time features.
**Session Management**: Express sessions with PostgreSQL store (`connect-pg-simple`), 7-day TTL.
**Game State**: Games persist in the database, supporting restoration and time tracking.
**Real-time Communication**: WebSocket server (`/ws`) for multiplayer synchronization, using match-based rooms, authenticated connections, and move broadcasting.

### Authentication & Authorization
**Provider**: Replit OpenID Connect (OIDC) via Passport.js.
**Session Strategy**: Server-side sessions in PostgreSQL, HTTP-only secure cookies.
**User Model**: OIDC subject claim, profiles include email, name, image, premium status.
**Authorization**: Route-level middleware (`isAuthenticated`).
**Development Mode**: Supports test users (`test-player-1` to `test-player-4`) via `x-test-user-id` header for solo multiplayer testing, disabled in production.

### Data Storage
**Database**: PostgreSQL via Neon's serverless driver.
**ORM**: Drizzle ORM for type-safe queries and schema management.
**Schema Design**: Includes `users`, `ratings` (separate per mode), `games`, `matches`, `simulGames`, `puzzles`, `puzzleAttempts`, `userSettings`, `statistics`, and `sessions`.
**Migrations**: Drizzle Kit.

### Game Mechanics
**Time Controls**: Various options (e.g., 3+0, 5+0, 10+0) with increment.
**Move Validation**: `chess.js` validation.
**Game Completion**: Games end via checkmate, resignation, timeout, draw, or disconnect; updates ratings and statistics.
**Daily Limits**: Free users have daily limits (5 standard, 3 blindfold), reset at midnight.
**Rating System**: Separate rating pools per mode - Bullet, Blitz, Rapid, Classical, OTB, Blindfold, and Simul. New users start at 1200 (Simul and OTB start at 1000). Each mode has its own matchmaking queue with FIFO (First In First Out) matching within ±300 Elo range.
**Disconnect Handling**: 30-second grace period when players disconnect. Auto-abort (no rating change) if no moves made; auto-resign (normal rating update) if moves made. Players can reconnect within grace period to continue. Move tracking via `whiteMoveCount` and `blackMoveCount` columns determines abort vs resign behavior.

### Training Modes
**OTB Tournament Mode**: Authentic FIDE-based tournament play with realistic features including manual clock system (must press clock after each move), touch-move enforcement (clicked piece must be moved), king-first castling, arbiter system for claims, and strict time management (flag fall = loss). Board is visible with optional visual aids (move highlights, last move indicator). Has dedicated OTB Elo rating and separate matchmaking queue (FIFO ±300 Elo). Cannot be combined with Blindfold mode. See Planned Features for full implementation roadmap.

**Blindfold Mode**: Memory training with configurable "peek" limits and difficulty levels. Board is always hidden behind overlay; difficulty controls peek allowances (Easy = unlimited 3s peeks, Grandmaster = 0 peeks). Blindfold players see both their own last move (for confirmation) and the opponent's last move in a single "Last Move" card (not full move history) to prevent position reconstruction. Each player's view is independent - one can play blindfolded while their opponent sees the board normally. The interface shows "Last Move" panel for blindfold players and "Score Sheet" for non-blindfold players. Cannot be combined with OTB mode.

**Simul Mode**: Manages multiple concurrent games with sequential move-making.

**Puzzle Training**: Random puzzles with tracking of attempts and success rates.

### Design System
**Typography**: Defined scale, monospace for chess notation.
**Spacing**: 4px base unit system.
**Color Strategy**: High-contrast, semantic color tokens.
**Components**: Multiple variants for buttons, badges, cards.
**Responsive Design**: Mobile-first approach with breakpoints.

## External Dependencies
**Neon Database**: Serverless PostgreSQL.
**Replit Auth**: OpenID Connect authentication.
**Radix UI**: Headless UI component primitives.
**chess.js**: Chess game logic library.
**TanStack Query**: Server state management.
**Tailwind CSS**: Utility-first CSS framework.
**Wouter**: Client-side routing library.
**Vite**: Build tool and dev server.
**date-fns**: Date manipulation utilities.

## Planned Features

### Audio + Keyboard Input for Blindfold Mode (Future Enhancement)
**Status**: Planned - 7 tasks defined, ready for implementation  
**Goal**: Enable triple input methods (mouse, keyboard, voice) for true blindfold chess experience

**Key Features:**
- **Voice Input**: Web Speech API for hands-free move entry ("e4", "knight f3", "castle kingside")
- **Keyboard Input**: Text field for typing moves in standard algebraic notation
- **Audio Feedback**: Speech Synthesis API for move confirmations and opponent move announcements
- **Multiple Notation Support**: Standard algebraic, coordinate pairs, NATO phonetic alphabet
- **Browser Native**: $0 cost using Web Speech API (Chrome, Edge, Safari - not Firefox)
- **All Difficulty Levels**: Works with existing peek system (Easy → Grandmaster)

**Implementation Tasks:**
1. Add voice and keyboard input UI to blindfold mode: microphone button, move input field, status indicator, enable/disable toggle
2. Implement keyboard move input parser for standard chess notation (e4, Nf3, O-O, etc.)
3. Implement Web Speech API integration for voice recognition (with browser compatibility checks)
4. Build voice move parser to handle multiple notation formats (standard, coordinate pairs, NATO phonetic)
5. Add Speech Synthesis API for audio feedback (move played, opponent moves, errors)
6. Integrate keyboard and voice inputs with existing game logic and WebSocket for real-time play
7. Test keyboard and voice inputs end-to-end across all difficulty levels

**Testing Strategy**: Use cheap/budget microphone ($10-20 range) to ensure quality experience for all users, not just ideal conditions

**Market Differentiation**: Will be the first web-based platform combining multiplayer blindfold chess with dedicated rating system, progressive peek difficulty, AND triple input methods (mouse, keyboard, voice).

---

### Ultra-Realistic OTB Tournament Mode (Future Enhancement)
**Status**: Planned - 12 tasks defined, ready for implementation  
**Goal**: Implementation roadmap for OTB Tournament Mode features. This mode represents the authentic over-the-board chess experience, following FIDE Laws of Chess (worldwide tournament standard).

**Core Philosophy**: Strict, realistic, worldwide tournament standards. Flag fall = loss. Learn your time management!

**Mode Details:**
- Separate OTB Elo rating (starts at 1000)
- Dedicated matchmaking queue (FIFO ±300 Elo)
- Cannot be combined with Blindfold mode
- Board visible (unlike Blindfold mode)

**Key Features:**

1. **Touch-Move Rule (FIDE Art. 4.3)**
   - Once player clicks a piece, they MUST move it (cannot select another)
   - Visual lock indicator shows committed piece
   - No takebacks - just like physical OTB

2. **Manual Clock System (FIDE Art. 6)**
   - Physical clock button to press after each move
   - Spacebar keyboard shortcut
   - Clock sound effects ("clack")
   - Clock only advances when player manually presses

3. **Realistic Castling (FIDE Art. 4.4)**
   - King-first method: Click king → then click rook
   - Once king touched, must castle that side (if legal) or move king

4. **Free Piece Placement**
   - Client-side validation disabled in OTB mode
   - Pieces can move anywhere on board (illegal moves possible)
   - Simulates physical board where illegal moves are physically possible

5. **Arbiter System (FIDE Art. 13)**
   - "Call Arbiter" button pauses clocks
   - Claims: Illegal move, threefold repetition, 50-move rule, draw offer
   - Arbiter reviews and makes binding decisions

6. **Illegal Move Penalties (FIDE Art. 7)**
   - First illegal move: Warning + restore position + 2min to opponent
   - Second illegal move: Instant loss
   - Opponent must call arbiter to claim illegal move

7. **Strict Time Management (FIDE Standard)**
   - Flag fall = instant loss, even with insufficient mating material (K+B vs K)
   - No USCF exceptions - learn your time management!

8. **Draw Claim Mechanisms (FIDE Art. 9)**
   - Threefold repetition claim (arbiter verifies)
   - 50-move rule claim (arbiter verifies)
   - Draw by agreement (mutual consent)
   - Dead position auto-detection (insufficient material)

9. **Score Sheet (FIDE Art. 8)**
   - Automatic move recording
   - Grays out when time < 5 minutes (recording optional in time trouble)
   - Full game notation available for review

**Optional Visual Aids (Player Preferences):**
- Move Highlights (toggle on/off) - Show legal squares
- Last Move Highlight (toggle on/off) - Highlight opponent's last move
- Arrow Drawing (coming later) - Right-click to draw arrows (with mobile/tablet toggle)
- No Premoves in OTB mode (premoves for Standard mode only, added later)

**Implementation Tasks:**
1. Add OTB Mode toggle to game creation with rules explanation
2. Touch-move enforcement system with visual lock indicator
3. Manual clock with press button and spacebar shortcut
4. King-first castling mechanics
5. Disable client-side move validation (allow illegal moves)
6. Arbiter call system with clock pause
7. Illegal move penalty tracking (first warning, second loss)
8. Draw claim mechanisms (threefold, 50-move, agreement)
9. Database schema updates (otbMode, illegalMoveCount, touchMoveEnabled fields)
10. OTB-specific UI components (clock button, arbiter panel, score sheet)
11. WebSocket sync for OTB features (manual clock, arbiter calls, claims)
12. End-to-end testing of all OTB features

**Market Differentiation**: First online chess platform to faithfully recreate authentic FIDE-standard OTB tournament conditions with touch-move enforcement, manual clock, arbiter system, and strict time management. No "easy mode" exceptions - pure tournament realism.