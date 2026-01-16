# Blindfold Chess - Android Training App

## Overview
Blindfold Chess is an Android app designed to strengthen chess memory and visualization skills. Play chess without seeing the pieces, using voice commands to make moves. The app includes training drills and AI opponents to help players master blindfold chess.

## User Preferences
Preferred communication style: Simple, everyday language.

## Core Features

### Blindfold Chess Mode
- Play without seeing pieces on the board
- Voice commands to make moves (e.g., "knight c3", "e4")
- Press-and-hold to peek at the position
- AI bot opponents at various skill levels
- Game state persistence: unfinished games save automatically and can be resumed

### Training Gym
Coordinate mastery drills:
- **Color Blitz**: 60-second timed mode - identify Light/Dark square colors as fast as possible. Trophy tiers: Gold 40+, Silver 20+.
- **Coordinate Sniper**: Find 10 squares as fast as possible. Voice announces target squares. Trophy tiers: Gold ≤10s, Silver ≤20s.

### AI Bot Engine
Client-side engine with continuous Elo slider:
- Elo range: 400-2600 (step 50) with non-linear skill curve
- Stockfish Skill Level parameter (0-20) for authentic strength variation
- Dynamic labels: Beginner (400-800) → Casual (800-1200) → Club (1200-1800) → Master (1800-2600)
- Lichess opening database + Stockfish WASM

### Post-Game Analysis
Stockfish-powered analysis with evaluation bar, move-by-move review, and PGN export (Share/Copy buttons).

### Game History
- View all past games with results, dates, and move counts
- Favorite games for quick access
- Share or copy PGN for any saved game
- Full Stockfish analysis for historical games

## Technical Architecture

### Frontend
- **Framework**: React 18 with TypeScript (Vite)
- **UI**: Radix UI, shadcn/ui, Tailwind CSS
- **Chess Logic**: chess.js
- **State**: TanStack Query

### Backend
- **Runtime**: Node.js with Express.js (serves web assets)
- **Storage**: Local/on-device only (no accounts, no cloud sync)

### Voice System (Android)
- **Engine**: Vosk offline speech recognition (vosk-model-small-en-us)
- **Service**: VoskVoiceService.java - AudioRecord + Vosk Recognizer
- **TTS**: Android TextToSpeech with mic coordination via speakAndListen()
- **Continuous listening**: After each speech result, BlindfoldNative.startListening() restarts mic
- **Training modes**: Color Blitz and VoiceMoveMaster use same BlindfoldNative plugin

## Android Build Instructions

**Environment (via android-shell.nix):**
- JDK 17, Android SDK 34, AGP 8.1.4, Gradle 8.11.1

**Build commands:**
```bash
npm run build
npx cap sync android
node scripts/patch-capacitor-android.cjs
nix-shell android-shell.nix --run "cd android && ./gradlew assembleDebug --no-daemon"
```
APK output: `android/app/build/outputs/apk/debug/app-debug.apk` (~67MB with Vosk model)

**Important**: Run patch script after every `npx cap sync` or `npm install`.

## Key Files
- `android/app/src/main/java/com/blindfoldchess/app/VoskVoiceService.java` - Voice recognition
- `android/app/src/main/java/com/blindfoldchess/app/BlindfoldPlugin.java` - Capacitor bridge
- `client/src/pages/game.tsx` - Main game UI
- `client/src/pages/training.tsx` - Training drills
- `client/src/lib/botEngine.ts` - AI opponent logic
- `client/src/lib/pgnExport.ts` - PGN share/copy utilities

## External Dependencies
- Vosk (Apache 2.0, Alpha Cephei) - Offline speech recognition
- chess.js - Chess game logic
- Stockfish WASM - Engine analysis
