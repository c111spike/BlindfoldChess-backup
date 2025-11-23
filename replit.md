# SimulChess - Professional Chess Training Platform

## Overview
SimulChess is a professional chess training platform designed to enhance over-the-board (OTB) chess habits, strengthen memory skills, and master simultaneous exhibition gameplay. It offers three core training modes: OTB Tournament Mode, Blindfold Mode, and Simul Mode. The platform aims to provide a unique, realistic, and competitive chess training experience with features like separate rating systems, matchmaking, daily game limits, puzzle training, and comprehensive statistics.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Core Design Principles
The platform prioritizes authenticity for OTB play, memory training for blindfold chess, and efficient multi-game management for simul. It uses a modern web stack for responsiveness and scalability.

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
- **OTB Tournament Mode**: FIDE-based play with manual clock, touch-move enforcement, king-first castling, arbiter system, and strict time management.
- **Blindfold Mode**: Memory training with configurable "peek" limits and difficulty levels. Board is hidden.
- **Simul Mode**: Manages multiple concurrent games with sequential move-making, auto-cycle system, and a 30-second timer reset per board.
- **Puzzle Training**: Random puzzles with tracking.

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

## Bot Training System

### Overview
AI bot opponents with distinct personalities to provide training value and fill matchmaking queues when player pool is small. Bots available in Standard, Blindfold, and OTB modes. Simul vs Simul mode uses bots to fill empty opponent slots.

### Bot Personalities

**Free Tier (3 Bots):**
1. **Balanced Bot** - Standard play, no special preferences. Teaches fundamentals.
2. **Tactician Bot** - Favors combinations, willing to sacrifice material for activity. Practices defensive tactics.
3. **Positional Bot** - Values pawn structure and piece coordination. Teaches long-term planning.

**Premium Tier (4 Specialist Bots):** 🔒
4. **Bishop Specialist** - Overvalues bishops (value = 4 instead of 3). Seeks open diagonals, maintains bishop pair, avoids bishop-for-knight trades. Teaches exploiting/neutralizing strong bishops.
5. **Knight Specialist** - Overvalues knights (value = 4 instead of 3). Creates closed positions, establishes outposts, avoids knight-for-bishop trades. Teaches knight tactics and closed position play.
6. **Aggressor Bot** - Early king attacks, active queen, willing to sacrifice for initiative. Teaches defending under pressure.
7. **Defender Bot** - Overvalues king safety, trades when ahead, solid structure. Teaches breaking down solid defenses.

### Difficulty Levels (Elo-Based)
- **400 Elo** - Complete beginners (just learned rules): Random blunders, misses simple tactics, no planning
- **800 Elo** - Novice players
- **1000 Elo** - Casual players
- **1200 Elo** - Intermediate
- **1500 Elo** - Advanced
- **1800 Elo** - Expert
- **2000 Elo** - Master level

**Total variations**: 49 bots (7 personalities × 7 Elo levels)

### Key Features
- **Unrated games only** - Maintains competitive integrity, no rating inflation
- **Playtester Hall of Fame** - Top bug finders during beta get bots named after them (e.g., "JohnSmith_Bot - #1 Beta Tester, 47 bugs found")
- **Simple evaluation engine** - Chess.js + custom position evaluation for easy personality implementation and tuning
- **Always available** - Solves empty queue problem, provides instant practice

### Technical Implementation
- Custom position evaluation with personality-specific piece value overrides
- Specialist bots use piece value = 4 for their preferred piece (vs standard 3)
- Difficulty scaling adjusts evaluation depth and introduces intentional errors at lower Elos
- Available across all game modes: Standard, Blindfold, OTB Tournament, Simul vs Simul (as filler opponents)

### Monetization Integration
- Free users: 3 fundamental bot personalities (Balanced, Tactician, Positional)
- Premium users: Access to 4 specialist bots for advanced training scenarios
- Complements freemium model: Unlimited bot practice, limited human matchmaking for free tier

## Admin System

### Overview
Platform administration tools for user management, moderation, and premium grants. Single admin access (platform owner) with database-backed permissions.

### Admin Access Control
- **Authentication**: Database `isAdmin` flag in users table (boolean field)
- **Security**: No hardcoded credentials in source code
- **Grant/Revoke**: SQL command to update `isAdmin` flag
- **Access Check**: Middleware validates `req.user.isAdmin` before allowing admin routes
- **UI Access**: Admin panel button visible only to admin users in sidebar

### Premium Management
**Manual Premium Grants:**
- 7 days - Testing/rewards
- 30 days - Monthly trials
- 60 days - Playtester rewards
- 90 days - Special promotions
- 1 year - Annual subscriptions

**Implementation:**
- Set `premiumUntil` date field in users table
- Simple expiration tracking (no payment integration needed for manual grants)
- Admin can extend/modify expiration dates

### User Moderation

**Suspension (Temporary Block):**
- **Fixed Duration Options**: 1 day, 7 days, 30 days
- **Effect**: User cannot access account during suspension
- **Active Games**: Auto-resign all active games immediately
- **Reason Required**: Admin must provide reason visible to user
- **User Message**:
  ```
  ❌ Account Suspended
  Reason: Inappropriate behavior
  Duration: Until Jan 30, 2025
  ```
- **No Appeals**: Duration displayed to inform user when they can return

**Ban (Permanent Block):**
- **Effect**: User cannot access account permanently
- **Active Games**: Auto-resign all active games immediately
- **Reason Required**: Admin must provide reason visible to user
- **User Message**:
  ```
  ❌ Account Banned
  Reason: Cheating detected
  This ban is permanent.
  ```

### Admin Panel Features

**User Search:**
- Search by username or email
- View user profile (stats, games played, recent activity)

**Moderation Actions:**
- Grant premium (select duration: 7/30/60/90/365 days)
- Suspend user (select duration: 1/7/30 days + reason)
- Ban user (permanent + reason)
- View user's active games
- View moderation history per user

**Audit Log:**
- Track all admin actions with timestamps
- Log format: "Admin [name] [action] for User [username] on [date]: [reason]"
- Examples:
  - "Admin granted 30-day premium to User123 on 2025-01-15"
  - "Admin suspended User456 for 7 days on 2025-01-16: Inappropriate behavior"

### Database Schema Requirements
**Users Table Additions:**
- `isAdmin` (boolean, default false) - Admin flag
- `isSuspended` (boolean, default false) - Suspension status
- `suspendedUntil` (timestamp, nullable) - Suspension expiration
- `suspensionReason` (text, nullable) - Reason for suspension
- `isBanned` (boolean, default false) - Permanent ban status
- `banReason` (text, nullable) - Reason for ban

**Admin Actions Table (Audit Log):**
- `id` (primary key)
- `adminId` (admin user ID)
- `targetUserId` (affected user ID)
- `action` (enum: grant_premium, suspend, ban, unsuspend)
- `reason` (text)
- `duration` (integer, days - for suspensions/premium)
- `createdAt` (timestamp)

### Security Considerations
- Admin routes protected by middleware checking `isAdmin` flag
- Database access required to grant initial admin status
- All admin actions logged for accountability
- No hardcoded credentials in codebase
- Admin status can be revoked via database SQL command