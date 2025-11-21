# SimulChess - Professional Chess Training Platform

## Overview

SimulChess is a professional chess training platform designed to help players develop better over-the-board (OTB) habits, strengthen memory skills, and master simultaneous exhibition gameplay. The application focuses on three core training modes: OTB Tournament Mode (with bullet, blitz, and rapid time controls), Blindfold Mode (memory-focused training), and Simul Mode (simultaneous game management).

The platform emphasizes serious skill development over casual play, with a design philosophy that combines Linear's precision and clarity with Notion's organized information density. It features rating systems, daily game limits, puzzle training, comprehensive statistics tracking, and a premium subscription model.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React 18 with TypeScript, using Vite as the build tool and development server.

**UI Component System**: Radix UI primitives with shadcn/ui components, providing accessible, customizable components. The design system uses the "new-york" style variant with Tailwind CSS for styling.

**State Management**: TanStack Query (React Query) for server state management with aggressive caching strategies (staleTime: Infinity). No global client state management library is used; component-level state handles local UI interactions.

**Routing**: Wouter for lightweight client-side routing. The application uses a simple route configuration with authentication-based conditional rendering.

**Chess Logic**: chess.js library handles game validation, move generation, and board state management. Custom ChessBoard component renders positions from FEN strings.

**Styling**: Tailwind CSS with custom theme configuration supporting light/dark modes. Design tokens defined in CSS custom properties for consistent theming. Typography uses Inter for UI elements and JetBrains Mono for chess notation.

### Backend Architecture

**Runtime**: Node.js with Express.js framework, using TypeScript throughout.

**Development vs Production**: Two separate entry points (index-dev.ts and index-prod.ts). Development mode integrates Vite middleware for HMR; production serves pre-built static assets.

**API Design**: RESTful endpoints with WebSocket support for real-time game features. Authentication required for all game-related endpoints.

**Session Management**: Express sessions with PostgreSQL session store (connect-pg-simple). Sessions persist across server restarts and have 7-day TTL.

**Game State**: Games persist in the database with support for restoration. Ongoing games can be retrieved and continued. Time tracking uses client-side intervals with periodic server synchronization.

**Real-time Communication**: WebSocket server for live game updates, move synchronization, and clock management across multiple simultaneous games.

### Authentication & Authorization

**Provider**: Replit OpenID Connect (OIDC) for authentication. The system uses Passport.js with the OpenID Client strategy.

**Session Strategy**: Server-side sessions stored in PostgreSQL. Session cookies are HTTP-only, secure, and have 7-day expiration.

**Token Management**: Access tokens and refresh tokens stored in user sessions. Automatic token refresh when expired using refresh tokens.

**User Model**: Users identified by OIDC subject claim. User profiles include email, name, profile image, and premium subscription status.

**Authorization**: Route-level middleware (isAuthenticated) protects all application endpoints. Unauthorized requests redirect to login flow.

### Data Storage

**Database**: PostgreSQL accessed via Neon's serverless driver with WebSocket connections.

**ORM**: Drizzle ORM for type-safe database queries and schema management. Schema definitions in TypeScript with Zod validation.

**Schema Design**:
- `users`: Core user profiles with premium status, daily game counters, and reset timestamps
- `ratings`: Separate rating records per user with OTB bullet/blitz/rapid and blindfold ratings (default 1200)
- `games`: Individual game records with FEN positions, move history, time controls, and results
- `simulGames`: Tracks games within simultaneous exhibitions with opponent info and board states
- `puzzles`: Chess puzzles with FEN, solutions, difficulty ratings, and themes
- `puzzleAttempts`: User puzzle solve history and performance tracking
- `userSettings`: Preferences for board themes, sound, auto-queen, and piece styles
- `statistics`: Aggregated performance metrics per game mode (games played, wins/losses/draws, time spent)
- `sessions`: Passport session storage

**Migrations**: Drizzle Kit manages schema migrations. Migrations stored in `/migrations` directory.

### Game Mechanics

**Time Controls**: Multiple time control options (3+0, 5+0, 10+0, etc.) with increment support. Clocks managed client-side with server validation.

**Move Validation**: chess.js validates all moves before persistence. Legal move highlighting available on demand.

**Game Completion**: Games end via checkmate, resignation, timeout, or draw offers. Results update user ratings and statistics.

**Daily Limits**: Free users limited to 5 standard games and 3 blindfold games per day. Counters reset at midnight local time.

**Rating System**: Separate rating pools for each game mode. New users start at 1200 rating. Rating calculations happen server-side on game completion.

### Training Modes

**OTB Tournament Mode**: Simulates tournament conditions with clock management, move recording, and strict time controls. Supports game restoration after disconnection.

**Blindfold Mode**: Memory training with configurable "peek" limits. Voice input support planned. Difficulty levels (beginner to expert) adjust peek count and assistance.

**Simul Mode**: Manage multiple concurrent games against different opponents. Tracks material balance and time per board. Sequential move-making across active boards.

**Puzzle Training**: Random puzzle selection from database. Tracks solve attempts, success rates, and time spent per puzzle.

### External Dependencies

**Neon Database**: Serverless PostgreSQL hosting with WebSocket support for connection pooling.

**Replit Auth**: OpenID Connect authentication provider integrated via Passport.js. Handles user identity, login flows, and session management.

**Radix UI**: Headless UI component primitives for accessibility and customization (accordion, dialog, dropdown, popover, tabs, etc.).

**chess.js**: Chess game logic library for move validation, legal move generation, and game state management.

**TanStack Query**: Server state management with caching, background refetching, and optimistic updates.

**Tailwind CSS**: Utility-first CSS framework with custom theme configuration and design tokens.

**Wouter**: Minimal routing library for client-side navigation (chosen over React Router for size).

**Vite**: Build tool and dev server with HMR, TypeScript support, and optimized production builds.

**date-fns**: Date manipulation and formatting utilities for timestamps and daily reset logic.

### Performance Considerations

**Query Optimization**: Aggressive caching with TanStack Query reduces redundant API calls. Queries marked with `staleTime: Infinity` for user settings and ratings.

**Database Indexing**: Session expiration indexed for efficient cleanup. Game queries likely need user_id indexes for performance.

**Asset Loading**: Vite code-splitting and lazy loading for route-based chunks. Static assets served with caching headers in production.

**WebSocket Efficiency**: Single WebSocket connection per user supports multiple concurrent games. Message format likely JSON-based for move updates.

### Design System

**Typography Scale**: Defined hierarchy from hero text (5xl/6xl) to small metadata (sm). Monospace font for chess notation and timers.

**Spacing System**: 4px base unit with multiples (4, 8, 16, 24, 32) for consistent vertical and horizontal rhythm.

**Color Strategy**: High-contrast theme with clear state differentiation. No specific colors defined - relies on semantic color tokens (primary, secondary, destructive, muted, accent).

**Component Variants**: Buttons, badges, and cards have multiple variants (default, outline, ghost, secondary, destructive) for different contexts.

**Responsive Design**: Mobile-first approach with breakpoints. Sidebar collapses on mobile devices.

### Premium Features

**Subscription Model**: Premium tiers unlock unlimited daily games, advanced statistics, and additional features.

**Billing Integration**: Premium status tracked with expiration timestamp. Pricing tier stored for future monetization options.

**Feature Gating**: Daily game limits enforced for free users. Premium checks occur at game creation time.