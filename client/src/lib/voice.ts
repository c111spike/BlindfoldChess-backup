import { Capacitor } from '@capacitor/core';
import { SpeechRecognition as CapacitorSpeechRecognition } from '@capacitor-community/speech-recognition';
import { SpeechSynthesis as CapacitorSpeechSynthesis } from '@capgo/capacitor-speech-synthesis';

// Cached Haptics module for efficient haptic feedback
let cachedHapticsModule: typeof import('@capacitor/haptics') | null = null;

async function pulseHaptic(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    if (!cachedHapticsModule) {
      cachedHapticsModule = await import('@capacitor/haptics');
    }
    const { Haptics, NotificationType } = cachedHapticsModule;
    await Haptics.notification({ type: NotificationType.Success });
  } catch (e) {
    // Haptics not available
  }
}

export async function pulseHapticLight(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    if (!cachedHapticsModule) {
      cachedHapticsModule = await import('@capacitor/haptics');
    }
    const { Haptics, ImpactStyle } = cachedHapticsModule;
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (e) {
    // Haptics not available
  }
}

// ========================================
// CENTRALIZED VOICE SESSION CONTROLLER
// Coordinates mic and TTS to prevent beep loops and overlapping audio
// ========================================

interface VoiceSession {
  id: string;
  pause: () => void;
  resume: () => void;
  shouldBeActive: boolean;
}

// Mic state machine to prevent beep loops
enum MicState {
  SPEAKING = 'SPEAKING',   // TTS active, mic hard-locked OFF
  SETTLING = 'SETTLING',   // TTS ended, waiting 250ms for audio system
  LISTENING = 'LISTENING', // Mic ON, ready to receive
}

class VoiceSessionController {
  private sessions: Map<string, VoiceSession> = new Map();
  private isSpeaking = false;
  private micState: MicState = MicState.LISTENING;
  private pendingRestarts: string[] = []; // Session IDs queued for restart after TTS
  private settlingTimeout: ReturnType<typeof setTimeout> | null = null;
  private resumeDelayMs = 250; // 250ms delay for Galaxy S9+ audio system to settle
  
  /**
   * Register a voice session (game voice, training voice, reconstruction, etc.)
   */
  register(session: VoiceSession): void {
    this.sessions.set(session.id, session);
    console.log(`[VoiceController] Registered session: ${session.id}`);
  }
  
  /**
   * Unregister a voice session
   */
  unregister(id: string): void {
    this.sessions.delete(id);
    console.log(`[VoiceController] Unregistered session: ${id}`);
  }
  
  /**
   * Mark a session as should be active (will resume after TTS)
   */
  setActive(id: string, active: boolean): void {
    const session = this.sessions.get(id);
    if (session) {
      session.shouldBeActive = active;
    }
  }
  
  /**
   * Called when TTS is about to start - pauses all active sessions
   * State: LISTENING/SETTLING -> SPEAKING
   */
  onTTSStart(): void {
    // Clear any pending settling timeout
    if (this.settlingTimeout) {
      clearTimeout(this.settlingTimeout);
      this.settlingTimeout = null;
    }
    
    this.isSpeaking = true;
    this.micState = MicState.SPEAKING;
    console.log('[VoiceController] TTS starting, state -> SPEAKING, pausing all voice sessions');
    Array.from(this.sessions.values()).forEach(session => {
      if (session.shouldBeActive) {
        session.pause();
      }
    });
  }
  
  /**
   * Called when TTS ends - transitions to SETTLING then LISTENING
   * State: SPEAKING -> SETTLING -> LISTENING
   */
  onTTSEnd(): void {
    this.isSpeaking = false;
    this.micState = MicState.SETTLING;
    console.log(`[VoiceController] TTS ended, state -> SETTLING, waiting ${this.resumeDelayMs}ms`);
    
    this.settlingTimeout = setTimeout(() => {
      if (!this.isSpeaking) {
        this.micState = MicState.LISTENING;
        console.log('[VoiceController] Settling complete, state -> LISTENING');
        
        // Process pending restarts first (these are non-session restarts like VoiceRecognition)
        // Track which sessions have been resumed to avoid double-resume
        const resumedSessionIds = new Set<string>();
        const hadPendingRestarts = this.pendingRestarts.length > 0;
        
        if (hadPendingRestarts) {
          console.log(`[VoiceController] Processing ${this.pendingRestarts.length} pending restarts`);
          this.playMicLiveClick();
          // Signal that pending restarts should execute
          this.pendingRestarts.forEach(id => {
            const session = this.sessions.get(id);
            if (session && session.shouldBeActive) {
              console.log(`[VoiceController] Executing pending restart for: ${id}`);
              session.resume();
              resumedSessionIds.add(id);
            }
          });
          this.pendingRestarts = [];
        }
        
        // Resume remaining active sessions (exclude those already resumed from pending restarts)
        const sessionsToResume = Array.from(this.sessions.values()).filter(
          s => s.shouldBeActive && !resumedSessionIds.has(s.id)
        );
        if (sessionsToResume.length > 0) {
          // Play mic-live click sound before resuming (if not already played)
          if (!hadPendingRestarts) {
            this.playMicLiveClick();
          }
          sessionsToResume.forEach(session => {
            console.log(`[VoiceController] Resuming session: ${session.id}`);
            session.resume();
          });
        }
      }
    }, this.resumeDelayMs);
  }
  
  /**
   * Queue a restart request - will execute immediately if LISTENING, otherwise queued
   */
  queueRestart(sessionId: string): void {
    if (this.micState === MicState.LISTENING) {
      // Safe to restart immediately
      const session = this.sessions.get(sessionId);
      if (session && session.shouldBeActive) {
        console.log(`[VoiceController] Instant restart for session: ${sessionId}`);
        this.playMicLiveClick();
        session.resume();
      }
    } else {
      // Queue for after TTS ends
      if (!this.pendingRestarts.includes(sessionId)) {
        this.pendingRestarts.push(sessionId);
        console.log(`[VoiceController] Queued restart for session: ${sessionId} (state: ${this.micState})`);
      }
    }
  }
  
  /**
   * Get current mic state
   */
  getMicState(): MicState {
    return this.micState;
  }
  
  /**
   * Check if it's safe to start the mic (not in SPEAKING or SETTLING state)
   */
  canStartMic(): boolean {
    return this.micState === MicState.LISTENING;
  }
  
  /**
   * Play a subtle click sound to indicate mic is live (green light audio cue)
   */
  private async playMicLiveClick(): Promise<void> {
    try {
      // Use haptic feedback as the "click" - more reliable than audio
      if (Capacitor.isNativePlatform()) {
        const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
        await Haptics.impact({ style: ImpactStyle.Light });
      }
      console.log('[VoiceController] Mic live click');
    } catch (e) {
      // Haptics not available, that's okay
    }
  }
  
  /**
   * Check if TTS is currently speaking
   */
  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }
}

// Global singleton instance
export const voiceController = new VoiceSessionController();

type SpeechRecognitionEvent = Event & {
  results: SpeechRecognitionResultList;
  resultIndex: number;
};

type SpeechRecognitionErrorEvent = Event & {
  error: string;
  message: string;
};

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
  length: number;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
  length: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

const PIECE_NAMES: Record<string, string> = {
  'K': 'King',
  'Q': 'Queen',
  'R': 'Rook',
  'B': 'Bishop',
  'N': 'Knight',
  'P': 'Pawn',
  'k': 'King',
  'q': 'Queen',
  'r': 'Rook',
  'b': 'Bishop',
  'n': 'Knight',
  'p': 'Pawn',
};

const PIECE_LETTERS: Record<string, string> = {
  'king': 'K',
  'queen': 'Q',
  'rook': 'R',
  'bishop': 'B',
  'bish': 'B',
  'bishup': 'B',
  'bishep': 'B',
  'bashop': 'B',
  'knight': 'N',
  'night': 'N',
  'horse': 'N',
  'pawn': '',
  'castle': 'R',
};

// Filler words to strip from voice input
const FILLER_WORDS = ['um', 'uh', 'the', 'a', 'an', 'like', 'so', 'well', 'just', 'actually', 'basically'];

// Strip filler words from transcript
function stripFillerWords(transcript: string): string {
  const words = transcript.toLowerCase().split(/\s+/);
  const filtered = words.filter(word => !FILLER_WORDS.includes(word));
  return filtered.join(' ');
}

const FILE_NAMES: Record<string, string> = {
  'a': 'a', 'alpha': 'a', 'able': 'a', 'apple': 'a', 'ay': 'a',
  'b': 'b', 'bravo': 'b', 'boy': 'b', 'baker': 'b', 'bee': 'b',
  'c': 'c', 'charlie': 'c', 'cat': 'c', 'see': 'c', 'sea': 'c',
  'd': 'd', 'delta': 'd', 'dog': 'd', 'dee': 'd',
  'e': 'e', 'echo': 'e', 'easy': 'e', 'edward': 'e',
  'f': 'f', 'foxtrot': 'f', 'fox': 'f', 'frank': 'f', 'eff': 'f',
  'g': 'g', 'golf': 'g', 'george': 'g', 'gee': 'g',
  'h': 'h', 'hotel': 'h', 'henry': 'h', 'aitch': 'h',
};

const RANK_NAMES: Record<string, string> = {
  '1': '1', 'one': '1', 'won': '1', 'first': '1',
  '2': '2', 'two': '2', 'to': '2', 'too': '2', 'second': '2',
  '3': '3', 'three': '3', 'free': '3', 'third': '3',
  '4': '4', 'four': '4', 'for': '4', 'forth': '4', 'fourth': '4',
  '5': '5', 'five': '5', 'fifth': '5',
  '6': '6', 'six': '6', 'sixth': '6', 'sicks': '6',
  '7': '7', 'seven': '7', 'seventh': '7',
  '8': '8', 'eight': '8', 'ate': '8', 'eighth': '8',
};

export function moveToSpeech(move: string, isCapture: boolean = false, isCheck: boolean = false, isCheckmate: boolean = false): string {
  if (!move) return '';
  
  if (move === 'O-O' || move === '0-0') {
    return isCheckmate ? 'Castles kingside, checkmate!' : isCheck ? 'Castles kingside, check' : 'Castles kingside';
  }
  if (move === 'O-O-O' || move === '0-0-0') {
    return isCheckmate ? 'Castles queenside, checkmate!' : isCheck ? 'Castles queenside, check' : 'Castles queenside';
  }
  
  let spoken = '';
  let cleanMove = move.replace(/[+#=].*$/, '');
  
  const pieceMatch = cleanMove.match(/^([KQRBN])/);
  if (pieceMatch) {
    spoken = PIECE_NAMES[pieceMatch[1]] + ' ';
    cleanMove = cleanMove.substring(1);
  } else {
    spoken = '';
  }
  
  const hasCapture = cleanMove.includes('x');
  cleanMove = cleanMove.replace('x', '');
  
  const squares = cleanMove.match(/([a-h])([1-8])/g);
  if (squares && squares.length > 0) {
    const targetSquare = squares[squares.length - 1];
    const file = targetSquare[0];
    const rank = targetSquare[1];
    
    if (hasCapture || isCapture) {
      if (squares.length > 1 || !pieceMatch) {
        const fromFile = cleanMove[0];
        if (fromFile && fromFile.match(/[a-h]/)) {
          spoken += fromFile + ' ';
        }
      }
      spoken += 'takes ' + file + rank;
    } else {
      spoken += file + rank;
    }
  }
  
  if (move.includes('=')) {
    const promoMatch = move.match(/=([QRBN])/);
    if (promoMatch) {
      spoken += ', promotes to ' + PIECE_NAMES[promoMatch[1]];
    }
  }
  
  if (isCheckmate || move.includes('#')) {
    spoken += ', checkmate!';
  } else if (isCheck || move.includes('+')) {
    spoken += ', check';
  }
  
  return spoken.trim();
}

let cachedVoices: SpeechSynthesisVoice[] = [];
let voicesLoaded = false;
let voicesLoadPromise: Promise<SpeechSynthesisVoice[]> | null = null;

let isBotSpeaking = false;

export function getIsBotSpeaking(): boolean {
  return isBotSpeaking;
}

const isNative = Capacitor.isNativePlatform();

// Permission status type for microphone access
export type MicPermissionStatus = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'unknown';

/**
 * Check microphone permission status without requesting
 */
export async function checkMicPermission(): Promise<MicPermissionStatus> {
  if (!isNative) {
    // Web: Check using navigator.permissions if available
    try {
      if (navigator.permissions) {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        if (result.state === 'granted') return 'granted';
        if (result.state === 'denied') return 'denied';
        return 'prompt';
      }
    } catch (e) {
      // Fallback - assume prompt is available
    }
    return 'prompt';
  }
  
  try {
    const status = await CapacitorSpeechRecognition.checkPermissions();
    return status.speechRecognition as MicPermissionStatus;
  } catch (e) {
    console.error('[Voice] Error checking permissions:', e);
    return 'unknown';
  }
}

/**
 * Handle microphone permission with 3-state flow:
 * - granted: Returns true, proceed with voice
 * - denied: Triggers permission popup, returns result
 * - prompt-with-rationale (permanently denied): Shows guidance alert
 */
export async function handleMicPermission(): Promise<boolean> {
  if (!isNative) {
    // Web: Try to get permission via getUserMedia
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (e) {
      console.warn('[Voice] Web microphone permission denied');
      return false;
    }
  }
  
  try {
    const status = await CapacitorSpeechRecognition.checkPermissions();
    
    if (status.speechRecognition === 'granted') {
      return true;
    }
    
    if (status.speechRecognition === 'denied' || status.speechRecognition === 'prompt') {
      // Trigger the standard Android permission popup
      const request = await CapacitorSpeechRecognition.requestPermissions();
      return request.speechRecognition === 'granted';
    }
    
    // If they clicked "Don't ask again" (permanently denied)
    if (status.speechRecognition === 'prompt-with-rationale') {
      // Return false - caller should show guidance to settings
      return false;
    }
    
    return false;
  } catch (e) {
    console.error('[Voice] Permission handling error:', e);
    return false;
  }
}

/**
 * Request microphone permission (used from settings)
 * Returns the new status after request attempt
 */
export async function requestMicPermission(): Promise<{ granted: boolean; status: MicPermissionStatus }> {
  const granted = await handleMicPermission();
  const status = await checkMicPermission();
  return { granted, status };
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (isNative) {
    return Promise.resolve([]);
  }
  
  if (voicesLoaded && cachedVoices.length > 0) {
    return Promise.resolve(cachedVoices);
  }
  
  if (voicesLoadPromise) {
    return voicesLoadPromise;
  }
  
  voicesLoadPromise = new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      cachedVoices = voices;
      voicesLoaded = true;
      voicesLoadPromise = null;
      resolve(voices);
      return;
    }
    
    const handleVoicesChanged = () => {
      cachedVoices = window.speechSynthesis.getVoices();
      voicesLoaded = true;
      voicesLoadPromise = null;
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      resolve(cachedVoices);
    };
    
    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
    
    setTimeout(() => {
      if (!voicesLoaded) {
        cachedVoices = window.speechSynthesis.getVoices();
        voicesLoaded = cachedVoices.length > 0;
        voicesLoadPromise = null;
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
        resolve(cachedVoices);
      }
    }, 1000);
  });
  
  return voicesLoadPromise;
}

// voiceRecognitionInstance is set after VoiceRecognitionWrapper is created (below)
let voiceRecognitionInstance: { abort: () => void } | null = null;

function abortRecognitionIfReady() {
  if (voiceRecognitionInstance) {
    voiceRecognitionInstance.abort();
  }
}

function resumeRecognitionAfterTTS() {
  // VoiceController handles resume via registered sessions
  // This function is now a no-op - resume is handled by the session's resume() callback
}

async function waitForTTSCompletion(): Promise<void> {
  if (!isNative) return;
  
  const maxWaitMs = 30000;
  const pollIntervalMs = 200;
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      const state = await CapacitorSpeechSynthesis.isSpeaking();
      if (!state.isSpeaking) {
        return;
      }
    } catch {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
}

// Phonetic mapping for TTS clarity - prevents "a" sounding like "uh"
function toPhonetic(text: string): string {
  // Map chess file letters to clearer pronunciations
  const filePhoneticMap: Record<string, string> = {
    'a': 'Ay',
    'b': 'Bee', 
    'c': 'See',
    'd': 'Dee',
    'g': 'Gee'
  };
  
  // Map piece abbreviations to full names
  const pieceMap: Record<string, string> = {
    'N': 'Knight',
    'B': 'Bishop',
    'R': 'Rook',
    'Q': 'Queen',
    'K': 'King'
  };
  
  let result = text;
  
  // First, handle chess notation symbols
  // Replace 'x' with 'takes' (capture notation)
  result = result.replace(/x/g, ' takes ');
  // Replace '+' with 'check'
  result = result.replace(/\+/g, ' check');
  // Replace '#' with 'checkmate'
  result = result.replace(/#/g, ' checkmate');
  
  // Handle piece abbreviations at start of moves (e.g., "Nf3" -> "Knight f3")
  // Match piece letter followed by file and rank
  for (const [piece, name] of Object.entries(pieceMap)) {
    // Piece moves like Nf3, Be5, Qd8
    result = result.replace(new RegExp(`\\b${piece}([a-h])([1-8])`, 'g'), `${name} $1$2`);
    // Piece captures like Nxe5, Bxa3
    result = result.replace(new RegExp(`\\b${piece}\\s*takes\\s*([a-h])([1-8])`, 'gi'), `${name} takes $1$2`);
    // Disambiguation like Nbd2, R1a3
    result = result.replace(new RegExp(`\\b${piece}([a-h1-8])([a-h])([1-8])`, 'g'), `${name} $1$2$3`);
  }
  
  // Handle castling
  result = result.replace(/O-O-O/gi, 'queenside castle');
  result = result.replace(/O-O/gi, 'kingside castle');
  
  // Replace file letters followed by ranks (e.g., "a8" -> "Ay 8", "e5" -> "e 5")
  for (const [letter, phonetic] of Object.entries(filePhoneticMap)) {
    result = result.replace(new RegExp(`\\b${letter}\\s*([1-8])`, 'gi'), `${phonetic} $1`);
  }
  
  // Clean up extra spaces
  result = result.replace(/\s+/g, ' ').trim();
  
  return result;
}

export async function speak(text: string, rate: number = 0.9): Promise<void> {
  // CRITICAL: Pause all mics SYNCHRONOUSLY BEFORE any TTS is queued
  // This prevents the Android beep loop where mic hears TTS output
  voiceController.onTTSStart(); // Pause all registered voice sessions FIRST
  isBotSpeaking = true;
  abortRecognitionIfReady();
  console.log('[Voice] Mic muted: Bot is speaking');
  
  // Apply phonetic mapping for clearer TTS pronunciation
  const phoneticText = toPhonetic(text);
  
  try {
    if (isNative) {
      await CapacitorSpeechSynthesis.speak({
        text: phoneticText,
        language: 'en-US',
        rate,
        pitch: 1.0,
        volume: 1.0
      });
      
      await waitForTTSCompletion();
    } else {
      // Debug: check what speechSynthesis looks like
      console.log('[Voice] speechSynthesis in window:', 'speechSynthesis' in window);
      console.log('[Voice] window.speechSynthesis:', typeof window.speechSynthesis);
      
      if (!('speechSynthesis' in window) || !window.speechSynthesis) {
        console.warn('Speech synthesis not supported');
        return;
      }
      
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        console.warn('[Voice] Failed to cancel previous speech:', e);
      }
      await new Promise(r => setTimeout(r, 50));
      
      const voices = await loadVoices();
      console.log('[Voice] Loaded voices:', voices.length);
      
      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(phoneticText);
        utterance.rate = rate;
        utterance.pitch = 1;
        utterance.volume = 1;
        
        const englishVoice = voices.find(v => v.lang.startsWith('en-'));
        if (englishVoice) {
          utterance.voice = englishVoice;
          utterance.lang = englishVoice.lang;
        } else {
          utterance.lang = 'en-US';
        }
        
        utterance.onend = () => {
          console.log('[Voice] Speech ended successfully');
          resolve();
        };
        utterance.onerror = (e) => {
          console.error('[Voice] Speech error:', e);
          resolve();
        };
        
        console.log('[Voice] Speaking:', phoneticText);
        window.speechSynthesis.speak(utterance);
      });
    }
  } finally {
    isBotSpeaking = false;
    voiceController.onTTSEnd(); // Resume all registered voice sessions
    setTimeout(() => {
      if (!isBotSpeaking) {
        resumeRecognitionAfterTTS();
        console.log('[Voice] Mic active: Listening for your move');
      }
    }, 100);
  }
}

// Homophone corrections for common speech recognition errors
function applyHomophoneCorrections(text: string): string {
  let corrected = text;
  // "rookie" → "rook e" (common speech recognition error)
  corrected = corrected.replace(/\brookie\b/gi, 'rook e');
  corrected = corrected.replace(/\brookies\b/gi, 'rook e');
  // "rook he" → "rook e" (another common mishearing)
  corrected = corrected.replace(/\brook\s+he\b/gi, 'rook e');
  // "rock e" → "rook e"
  corrected = corrected.replace(/\brock\s+([a-h])\b/gi, 'rook $1');
  return corrected;
}

export function speechToMove(transcript: string, legalMoves: string[]): string | null {
  // Strip filler words and apply homophone corrections before processing
  const cleaned = stripFillerWords(transcript);
  const input = applyHomophoneCorrections(cleaned.toLowerCase().trim());
  
  // FIX: Bare coordinate detection for pawn moves (e.g., "c4", "e 4")
  const bareCoord = input.replace(/\s+/g, '').match(/^([a-h])([1-8])$/);
  if (bareCoord) {
    const targetSquare = bareCoord[1] + bareCoord[2];
    // Find a legal pawn move to this square (no piece letter = pawn)
    const pawnMove = legalMoves.find(m => 
      !/^[KQRBN]/i.test(m) && // No piece letter = pawn move
      m.includes(targetSquare)
    );
    if (pawnMove) return pawnMove;
  }
  
  if (input.includes('castle') || input.includes('castles')) {
    if (input.includes('queen') || input.includes('long')) {
      if (legalMoves.includes('O-O-O')) return 'O-O-O';
    } else if (input.includes('king') || input.includes('short')) {
      if (legalMoves.includes('O-O')) return 'O-O';
    } else {
      if (legalMoves.includes('O-O')) return 'O-O';
      if (legalMoves.includes('O-O-O')) return 'O-O-O';
    }
  }
  
  let piece = '';
  let targetFile = '';
  let targetRank = '';
  let sourceFile = '';
  let sourceRank = '';
  let isCapture = false;
  let promotion = '';
  
  const words = input.split(/\s+/);
  
  for (const word of words) {
    const lowerWord = word.toLowerCase();
    
    if (PIECE_LETTERS[lowerWord] !== undefined) {
      piece = PIECE_LETTERS[lowerWord];
    }
    
    if (lowerWord === 'takes' || lowerWord === 'captures' || lowerWord === 'x') {
      isCapture = true;
    }
    
    if (lowerWord === 'promotes' || lowerWord === 'promotion') {
      continue;
    }
    
    if (FILE_NAMES[lowerWord]) {
      if (!targetFile) {
        targetFile = FILE_NAMES[lowerWord];
      } else if (!sourceFile) {
        sourceFile = targetFile;
        targetFile = FILE_NAMES[lowerWord];
      }
    }
    
    if (RANK_NAMES[lowerWord]) {
      if (targetRank && !sourceRank) {
        sourceRank = targetRank;
      }
      targetRank = RANK_NAMES[lowerWord];
    }
    
    if (['queen', 'rook', 'bishop', 'knight'].includes(lowerWord) && (input.includes('promote') || input.includes('equals'))) {
      promotion = PIECE_LETTERS[lowerWord] || 'Q';
    }
  }
  
  for (const word of words) {
    const match = word.match(/^([a-h])([1-8])$/i);
    if (match) {
      if (targetFile && !sourceFile) {
        sourceFile = targetFile;
      }
      if (targetRank && !sourceRank) {
        sourceRank = targetRank;
      }
      targetFile = match[1].toLowerCase();
      targetRank = match[2];
    }
  }
  
  // Shorthand promotion: detect piece at end of command when target is rank 1 or 8
  // e.g. "e8 queen", "d1 knight", "takes d8 rook"
  if (!promotion && (targetRank === '1' || targetRank === '8')) {
    const lastWord = words[words.length - 1].toLowerCase();
    if (['queen', 'rook', 'bishop', 'knight'].includes(lastWord)) {
      promotion = PIECE_LETTERS[lastWord] || 'Q';
    }
  }
  
  if (!targetFile || !targetRank) {
    return null;
  }
  
  const targetSquare = targetFile + targetRank;
  
  const candidates = legalMoves.filter(move => {
    const cleanMove = move.replace(/[+#]/g, '');
    
    if (!cleanMove.includes(targetSquare)) return false;
    
    if (piece) {
      if (!cleanMove.startsWith(piece)) return false;
    } else {
      if (cleanMove.match(/^[KQRBN]/)) return false;
    }
    
    if (sourceFile) {
      const moveSource = cleanMove.match(/^[KQRBN]?([a-h])?([1-8])?x?[a-h][1-8]/);
      if (moveSource && moveSource[1] && moveSource[1] !== sourceFile) {
        return false;
      }
    }
    
    if (sourceRank) {
      const moveSource = cleanMove.match(/^[KQRBN]?([a-h])?([1-8])?x?[a-h][1-8]/);
      if (moveSource && moveSource[2] && moveSource[2] !== sourceRank) {
        return false;
      }
    }
    
    return true;
  });
  
  if (candidates.length === 1) {
    let result = candidates[0];
    if (promotion && result.includes('=')) {
      result = result.replace(/=[QRBN]/, '=' + promotion);
    }
    return result;
  }
  
  if (candidates.length > 1) {
    const withCapture = candidates.filter(m => m.includes('x'));
    const withoutCapture = candidates.filter(m => !m.includes('x'));
    
    if (isCapture && withCapture.length === 1) {
      return withCapture[0];
    }
    if (!isCapture && withoutCapture.length === 1) {
      return withoutCapture[0];
    }
    
    return candidates[0];
  }
  
  return null;
}

export interface AmbiguousMoveResult {
  move: string | null;
  isAmbiguous: boolean;
  candidates: string[];
  piece: string;
  targetSquare: string;
}

export function speechToMoveWithAmbiguity(transcript: string, legalMoves: string[]): AmbiguousMoveResult {
  // Apply homophone corrections before processing
  const input = applyHomophoneCorrections(transcript.toLowerCase().trim());
  
  if (input.includes('castle') || input.includes('castles')) {
    if (input.includes('queen') || input.includes('long')) {
      if (legalMoves.includes('O-O-O')) return { move: 'O-O-O', isAmbiguous: false, candidates: [], piece: '', targetSquare: '' };
    } else if (input.includes('king') || input.includes('short')) {
      if (legalMoves.includes('O-O')) return { move: 'O-O', isAmbiguous: false, candidates: [], piece: '', targetSquare: '' };
    } else {
      if (legalMoves.includes('O-O')) return { move: 'O-O', isAmbiguous: false, candidates: [], piece: '', targetSquare: '' };
      if (legalMoves.includes('O-O-O')) return { move: 'O-O-O', isAmbiguous: false, candidates: [], piece: '', targetSquare: '' };
    }
  }
  
  let piece = '';
  let targetFile = '';
  let targetRank = '';
  let sourceFile = '';
  let sourceRank = '';
  let isCapture = false;
  let promotion = '';
  
  const words = input.split(/\s+/);
  
  for (const word of words) {
    const lowerWord = word.toLowerCase();
    
    if (PIECE_LETTERS[lowerWord] !== undefined) {
      piece = PIECE_LETTERS[lowerWord];
    }
    
    if (lowerWord === 'takes' || lowerWord === 'captures' || lowerWord === 'x') {
      isCapture = true;
    }
    
    if (lowerWord === 'promotes' || lowerWord === 'promotion') {
      continue;
    }
    
    if (FILE_NAMES[lowerWord]) {
      if (!targetFile) {
        targetFile = FILE_NAMES[lowerWord];
      } else if (!sourceFile) {
        sourceFile = targetFile;
        targetFile = FILE_NAMES[lowerWord];
      }
    }
    
    if (RANK_NAMES[lowerWord]) {
      if (targetRank && !sourceRank) {
        sourceRank = targetRank;
      }
      targetRank = RANK_NAMES[lowerWord];
    }
    
    if (['queen', 'rook', 'bishop', 'knight'].includes(lowerWord) && (input.includes('promote') || input.includes('equals'))) {
      promotion = PIECE_LETTERS[lowerWord] || 'Q';
    }
  }
  
  for (const word of words) {
    const match = word.match(/^([a-h])([1-8])$/i);
    if (match) {
      if (targetFile && !sourceFile) {
        sourceFile = targetFile;
      }
      if (targetRank && !sourceRank) {
        sourceRank = targetRank;
      }
      targetFile = match[1].toLowerCase();
      targetRank = match[2];
    }
  }
  
  // Shorthand promotion: detect piece at end of command when target is rank 1 or 8
  // e.g. "e8 queen", "d1 knight", "takes d8 rook"
  if (!promotion && (targetRank === '1' || targetRank === '8')) {
    const lastWord = words[words.length - 1].toLowerCase();
    if (['queen', 'rook', 'bishop', 'knight'].includes(lastWord)) {
      promotion = PIECE_LETTERS[lastWord] || 'Q';
    }
  }
  
  if (!targetFile || !targetRank) {
    return { move: null, isAmbiguous: false, candidates: [], piece: '', targetSquare: '' };
  }
  
  const targetSquare = targetFile + targetRank;
  
  const candidates = legalMoves.filter(move => {
    const cleanMove = move.replace(/[+#]/g, '');
    
    if (!cleanMove.includes(targetSquare)) return false;
    
    if (piece) {
      if (!cleanMove.startsWith(piece)) return false;
    } else {
      if (cleanMove.match(/^[KQRBN]/)) return false;
    }
    
    if (sourceFile) {
      const moveSource = cleanMove.match(/^[KQRBN]?([a-h])?([1-8])?x?[a-h][1-8]/);
      if (moveSource && moveSource[1] && moveSource[1] !== sourceFile) {
        return false;
      }
    }
    
    if (sourceRank) {
      const moveSource = cleanMove.match(/^[KQRBN]?([a-h])?([1-8])?x?[a-h][1-8]/);
      if (moveSource && moveSource[2] && moveSource[2] !== sourceRank) {
        return false;
      }
    }
    
    return true;
  });
  
  if (candidates.length === 1) {
    let result = candidates[0];
    if (promotion && result.includes('=')) {
      result = result.replace(/=[QRBN]/, '=' + promotion);
    }
    return { move: result, isAmbiguous: false, candidates: [], piece, targetSquare };
  }
  
  if (candidates.length > 1) {
    const withCapture = candidates.filter(m => m.includes('x'));
    const withoutCapture = candidates.filter(m => !m.includes('x'));
    
    if (isCapture && withCapture.length === 1) {
      return { move: withCapture[0], isAmbiguous: false, candidates: [], piece, targetSquare };
    }
    if (!isCapture && withoutCapture.length === 1) {
      return { move: withoutCapture[0], isAmbiguous: false, candidates: [], piece, targetSquare };
    }
    
    return { move: null, isAmbiguous: true, candidates, piece, targetSquare };
  }
  
  return { move: null, isAmbiguous: false, candidates: [], piece, targetSquare };
}

const DISAMBIGUATION_MAP: Record<string, string> = {
  'one': '1', 'won': '1', 'want': '1',
  'two': '2', 'too': '2', 'to': '2',
  'three': '3', 'tree': '3', 'free': '3',
  'four': '4', 'for': '4', 'fore': '4',
  'five': '5', 'fife': '5',
  'six': '6', 'sick': '6', 'sicks': '6',
  'seven': '7',
  'eight': '8', 'ate': '8', 'ait': '8',
  'a': 'a', 'alpha': 'a', 'ay': 'a',
  'b': 'b', 'bee': 'b', 'be': 'b', 'bravo': 'b',
  'c': 'c', 'see': 'c', 'sea': 'c', 'charlie': 'c',
  'd': 'd', 'dee': 'd', 'delta': 'd', 'the': 'd', 'tea': 'd',
  'e': 'e', 'echo': 'e', 'ee': 'e',
  'f': 'f', 'if': 'f', 'eff': 'f', 'foxtrot': 'f', 'off': 'f',
  'g': 'g', 'gee': 'g', 'golf': 'g',
  'h': 'h', 'aitch': 'h', 'hotel': 'h',
};

export interface DisambiguationResult {
  file: string | null;
  rank: string | null;
}

export function parseDisambiguation(voiceInput: string): DisambiguationResult {
  const input = voiceInput.toLowerCase().trim();
  const words = input.split(/\s+/);
  
  let file: string | null = null;
  let rank: string | null = null;
  
  for (const word of words) {
    const mapped = DISAMBIGUATION_MAP[word];
    if (mapped) {
      if (/^[a-h]$/.test(mapped)) {
        if (!file) file = mapped;
      } else if (/^[1-8]$/.test(mapped)) {
        if (!rank) rank = mapped;
      }
    } else if (word.length === 1) {
      if (/^[a-h]$/i.test(word)) {
        if (!file) file = word.toLowerCase();
      } else if (/^[1-8]$/.test(word)) {
        if (!rank) rank = word;
      }
    }
  }
  
  if (DISAMBIGUATION_MAP[input]) {
    const mapped = DISAMBIGUATION_MAP[input];
    if (/^[a-h]$/.test(mapped)) {
      file = mapped;
    } else if (/^[1-8]$/.test(mapped)) {
      rank = mapped;
    }
  }
  
  if (input.length === 1) {
    if (/^[a-h]$/i.test(input)) {
      file = input.toLowerCase();
    } else if (/^[1-8]$/.test(input)) {
      rank = input;
    }
  }
  
  return { file, rank };
}

export function findMoveByDisambiguation(candidates: string[], disambig: DisambiguationResult): string | null {
  for (const move of candidates) {
    const cleanMove = move.replace(/[+#]/g, '');
    const match = cleanMove.match(/^[KQRBN]([a-h])?([1-8])?x?[a-h][1-8]/);
    
    if (match) {
      const moveFile = match[1] || null;
      const moveRank = match[2] || null;
      
      if (disambig.file && disambig.rank) {
        if (moveFile === disambig.file && moveRank === disambig.rank) {
          return move;
        }
      } else if (disambig.file) {
        if (moveFile === disambig.file) {
          return move;
        }
      } else if (disambig.rank) {
        if (moveRank === disambig.rank) {
          return move;
        }
      }
    }
  }
  
  return null;
}

export function getSourceSquaresFromCandidates(candidates: string[]): string[] {
  const sources: string[] = [];
  
  for (const move of candidates) {
    const cleanMove = move.replace(/[+#]/g, '');
    const match = cleanMove.match(/^[KQRBN]([a-h])?([1-8])?x?[a-h][1-8]/);
    if (match) {
      const file = match[1] || '';
      const rank = match[2] || '';
      if (file || rank) {
        sources.push(file + rank);
      }
    }
  }
  
  return sources;
}

// VoiceRecognition class - now a wrapper around voiceMaster for unified mic handling
// Maintains backward-compatible API for game.tsx
class VoiceRecognitionWrapper {
  private onResult: ((move: string | null, transcript: string) => void) | null = null;
  private onListeningChange: ((listening: boolean) => void) | null = null;
  private legalMoves: string[] = [];
  private isStarted: boolean = false;
  
  setLegalMoves(moves: string[]) {
    this.legalMoves = moves;
    // Update voiceMaster if it's already running in 'move' mode
    if (this.isStarted) {
      voiceMaster.setLegalMoves(moves);
    }
  }
  
  setOnResult(callback: (move: string | null, transcript: string) => void) {
    this.onResult = callback;
  }
  
  setOnListeningChange(callback: (listening: boolean) => void) {
    this.onListeningChange = callback;
  }
  
  async start(): Promise<void> {
    if (this.isStarted) return;
    
    const started = await voiceMaster.start({
      mode: 'move',
      legalMoves: this.legalMoves,
      onTranscript: (transcript, parsedMove) => {
        if (this.onResult) {
          this.onResult(parsedMove || null, transcript);
        }
      },
      onListeningChange: (listening) => {
        if (this.onListeningChange) {
          this.onListeningChange(listening);
        }
      }
    });
    
    this.isStarted = started;
  }
  
  stop(): void {
    if (!this.isStarted) return;
    this.isStarted = false;
    voiceMaster.stop();
  }
  
  async stopAndWait(): Promise<void> {
    if (!this.isStarted) return;
    this.isStarted = false;
    await voiceMaster.stop();
  }
  
  abort(): void {
    this.stop();
  }
  
  reset(): void {
    this.stop();
    this.onResult = null;
    this.onListeningChange = null;
    this.legalMoves = [];
  }
  
  isSupported(): boolean {
    return true; // voiceMaster handles availability checking
  }
  
  getIsListening(): boolean {
    return voiceMaster.getIsListening() && voiceMaster.getMode() === 'move';
  }
  
  async waitForInitialization(): Promise<void> {
    // voiceMaster handles initialization internally
    await voiceMaster.checkAvailability();
  }
}

// Backward-compatible export
export const voiceRecognition = new VoiceRecognitionWrapper();
// Set the instance for abortRecognitionIfReady() (declared earlier in file)
voiceRecognitionInstance = voiceRecognition;

// ========================================
// UNIFIED VOICE MASTER ENGINE
// Single mic handler with mode-based parsing
// Modes: 'move' (game), 'raw' (training), 'placement' (reconstruction)
// ========================================

export type VoiceMode = 'move' | 'raw' | 'placement';

export interface VoiceMasterConfig {
  mode: VoiceMode;
  onTranscript: (transcript: string, parsed?: string | null) => void;
  onListeningChange?: (listening: boolean) => void;
  legalMoves?: string[]; // Required for 'move' mode
}

class VoiceMasterEngine {
  private isListening: boolean = false;
  private shouldBeListening: boolean = false;
  private config: VoiceMasterConfig | null = null;
  private listenerHandle: { remove: () => Promise<void> } | null = null;
  private stateListenerHandle: { remove: () => Promise<void> } | null = null;
  private webRecognition: SpeechRecognition | null = null;
  private restartTimeout: ReturnType<typeof setTimeout> | null = null;
  private availabilityChecked: boolean = false;
  private isAvailable: boolean = false;
  
  // Android S9+ stability
  private lastErrorTime: number = 0;
  private consecutiveFailures: number = 0;
  private micBusy: boolean = false;
  private onMicBusyChange: ((busy: boolean) => void) | null = null;
  private onRetryNeeded: (() => void) | null = null;
  
  // Session management
  private sessionId: string = 'master';
  private isRegistered: boolean = false;
  private isPaused: boolean = false;
  
  // Move mode debouncing (2s for piece keywords)
  private captureDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingCaptureTranscript: string = '';
  private static readonly CAPTURE_DEBOUNCE_MS = 2000;
  private static readonly MAX_CONSECUTIVE_FAILURES = 3;
  
  async checkAvailability(): Promise<boolean> {
    if (this.availabilityChecked) {
      return this.isAvailable;
    }
    
    if (isNative) {
      try {
        const { available } = await CapacitorSpeechRecognition.available();
        if (!available) {
          console.log('[VoiceMaster] Speech recognition not available');
          this.isAvailable = false;
          this.availabilityChecked = true;
          return false;
        }
        
        const { speechRecognition } = await CapacitorSpeechRecognition.checkPermissions();
        if (speechRecognition !== 'granted') {
          const result = await CapacitorSpeechRecognition.requestPermissions();
          if (result.speechRecognition !== 'granted') {
            console.log('[VoiceMaster] Permission denied');
            this.isAvailable = false;
            this.availabilityChecked = true;
            return false;
          }
        }
        
        this.isAvailable = true;
        this.availabilityChecked = true;
        return true;
      } catch (e) {
        console.error('[VoiceMaster] Error checking availability:', e);
        this.isAvailable = false;
        this.availabilityChecked = true;
        return false;
      }
    } else {
      const SpeechRecognitionAPI = typeof window !== 'undefined' 
        ? (window.SpeechRecognition || window.webkitSpeechRecognition) 
        : null;
      this.isAvailable = !!SpeechRecognitionAPI;
      this.availabilityChecked = true;
      return this.isAvailable;
    }
  }
  
  setOnMicBusyChange(callback: ((busy: boolean) => void) | null) {
    this.onMicBusyChange = callback;
  }
  
  setOnRetryNeeded(callback: (() => void) | null): void {
    this.onRetryNeeded = callback;
  }
  
  isMicBusy(): boolean {
    return this.micBusy;
  }
  
  resetMicBusy(): void {
    this.micBusy = false;
    this.consecutiveFailures = 0;
    this.lastErrorTime = 0;
    if (this.onMicBusyChange) {
      this.onMicBusyChange(false);
    }
  }
  
  /**
   * Start the unified voice engine
   * Clean session handoff: stops any previous session before starting
   * Respects voiceController state machine for TTS coordination (S9+ 250ms settling)
   */
  async start(config: VoiceMasterConfig): Promise<boolean> {
    // Clean handoff: stop any existing session first
    if (this.isListening || this.shouldBeListening) {
      console.log('[VoiceMaster] Clean handoff: stopping previous session');
      await this.stop();
      // Small delay for Android audio flinger to release
      await new Promise(r => setTimeout(r, 100));
    }
    
    // Reset state
    this.consecutiveFailures = 0;
    this.micBusy = false;
    this.isPaused = false;
    this.config = config;
    
    const available = await this.checkAvailability();
    if (!available) {
      console.log('[VoiceMaster] Not available, cannot start');
      return false;
    }
    
    // Register with voiceController for TTS coordination
    if (!this.isRegistered) {
      voiceController.register({
        id: this.sessionId,
        pause: () => this.pauseInternal(),
        resume: () => this.resumeInternal(),
        shouldBeActive: true
      });
      this.isRegistered = true;
    }
    voiceController.setActive(this.sessionId, true);
    
    this.shouldBeListening = true;
    console.log(`[VoiceMaster] Starting in '${config.mode}' mode`);
    
    // S9+ critical fix: Check voiceController state machine before starting mic
    // If TTS is speaking or in settling phase, queue the start for after TTS ends
    if (!voiceController.canStartMic()) {
      console.log('[VoiceMaster] TTS active or settling, queueing start for after TTS');
      voiceController.queueRestart(this.sessionId);
      // FIX: Notify UI to show mic as "queued" (red indicator) while waiting for TTS
      // But do NOT set isListening=true - that would cause resumeInternal() to skip
      if (config.onListeningChange) {
        config.onListeningChange(true);
      }
      // Return true because we've queued the start - it will happen after TTS
      return true;
    }
    
    if (isNative) {
      return this.startNative();
    } else {
      return this.startWeb();
    }
  }
  
  /**
   * Update legal moves (for 'move' mode)
   */
  setLegalMoves(moves: string[]): void {
    if (this.config) {
      this.config.legalMoves = moves;
    }
  }
  
  /**
   * Process transcript based on mode
   */
  private processTranscript(transcript: string): void {
    if (!this.config || !this.shouldBeListening) return;
    
    const mode = this.config.mode;
    console.log(`[VoiceMaster] Processing in '${mode}' mode:`, transcript);
    
    switch (mode) {
      case 'raw':
        // Raw mode: immediate callback with transcript only
        this.config.onTranscript(transcript);
        break;
        
      case 'move':
        // Move mode: parse with legal moves, handle debouncing
        this.processMoveMode(transcript);
        break;
        
      case 'placement':
        // Placement mode: parse piece + square for reconstruction
        this.processPlacementMode(transcript);
        break;
    }
  }
  
  private processMoveMode(transcript: string): void {
    if (!this.config) return;
    
    const lowerTranscript = transcript.toLowerCase();
    const hasCaptureWord = lowerTranscript.includes('takes') || lowerTranscript.includes('captures');
    const hasPieceKeyword = /\b(knight|bishop|rook|queen|king|horse|castle)\b/.test(lowerTranscript);
    const hasTargetSquare = /[a-h]\s*[1-8]/.test(lowerTranscript);
    
    // Debounce for piece/capture phrases without target square
    if ((hasPieceKeyword || hasCaptureWord) && !hasTargetSquare) {
      console.log('[VoiceMaster] Piece/capture detected, waiting for target square...');
      this.pendingCaptureTranscript = transcript;
      
      if (this.captureDebounceTimeout) {
        clearTimeout(this.captureDebounceTimeout);
      }
      
      this.captureDebounceTimeout = setTimeout(() => {
        console.log('[VoiceMaster] Debounce timeout, processing:', this.pendingCaptureTranscript);
        const move = speechToMove(this.pendingCaptureTranscript, this.config?.legalMoves || []);
        this.config?.onTranscript(this.pendingCaptureTranscript, move);
        this.pendingCaptureTranscript = '';
      }, VoiceMasterEngine.CAPTURE_DEBOUNCE_MS);
      return;
    }
    
    // Complete phrase or pawn move - process immediately
    if (this.pendingCaptureTranscript && hasTargetSquare) {
      if (this.captureDebounceTimeout) {
        clearTimeout(this.captureDebounceTimeout);
        this.captureDebounceTimeout = null;
      }
      this.pendingCaptureTranscript = '';
    }
    
    const move = speechToMove(transcript, this.config.legalMoves || []);
    this.config.onTranscript(transcript, move);
  }
  
  private processPlacementMode(transcript: string): void {
    if (!this.config) return;
    // For placement mode, just pass transcript - caller handles parsing
    this.config.onTranscript(transcript);
  }
  
  private pauseInternal(): void {
    if (!this.isListening) return;
    this.isPaused = true;
    console.log('[VoiceMaster] Pausing for TTS');
    
    if (isNative) {
      CapacitorSpeechRecognition.stop().catch(e => console.log('[VoiceMaster] Pause stop error:', e));
    } else if (this.webRecognition) {
      try {
        this.webRecognition.stop();
      } catch (e) {
        console.log('[VoiceMaster] Web pause error:', e);
      }
    }
    this.isListening = false;
    if (this.config?.onListeningChange) {
      this.config.onListeningChange(false);
    }
  }
  
  private resumeInternal(): void {
    if (!this.shouldBeListening) return;
    if (this.isListening) {
      console.log('[VoiceMaster] Already listening, skipping resume');
      return;
    }
    
    this.isPaused = false;
    console.log('[VoiceMaster] Resuming after TTS');
    
    if (isNative) {
      this.startNative();
    } else {
      this.startWeb();
    }
  }
  
  private async startNative(): Promise<boolean> {
    if (this.micBusy) {
      console.log('[VoiceMaster] Mic is busy, not starting');
      return false;
    }
    
    // 3-second lockout after errors
    const timeSinceLastError = Date.now() - this.lastErrorTime;
    if (timeSinceLastError < 3000 && this.lastErrorTime > 0) {
      console.log(`[VoiceMaster] Lockout: ${3000 - timeSinceLastError}ms remaining, queueing restart`);
      if (!this.restartTimeout) {
        this.scheduleRestart();
      }
      // Return true so UI shows "listening" while we wait for lockout to expire
      return true;
    }
    
    try {
      // Clean up existing listeners
      if (this.listenerHandle) {
        await this.listenerHandle.remove();
        this.listenerHandle = null;
      }
      
      // Add result listener
      this.listenerHandle = await CapacitorSpeechRecognition.addListener('partialResults', (data: { matches: string[] }) => {
        if (data.matches && data.matches.length > 0 && this.shouldBeListening) {
          const transcript = data.matches[0];
          this.consecutiveFailures = 0;
          this.processTranscript(transcript);
        }
      });
      
      // Add state listener
      if (this.stateListenerHandle) {
        await this.stateListenerHandle.remove();
        this.stateListenerHandle = null;
      }
      this.stateListenerHandle = await CapacitorSpeechRecognition.addListener('listeningState', (state: { status: string }) => {
        console.log('[VoiceMaster] State changed:', state.status);
        if (state.status === 'stopped' && this.shouldBeListening && !this.micBusy) {
          this.isListening = false;
          if (this.config?.onListeningChange) {
            this.config.onListeningChange(false);
          }
          this.scheduleRestart();
        }
      });
      
      await CapacitorSpeechRecognition.start({
        language: 'en-US',
        partialResults: true,
        popup: false,
      });
      
      this.isListening = true;
      this.consecutiveFailures = 0;
      console.log('[VoiceMaster] Started native');
      
      if (this.config?.onListeningChange) {
        this.config.onListeningChange(true);
      }
      
      await pulseHapticLight();
      return true;
    } catch (e) {
      console.error('[VoiceMaster] Failed to start native:', e);
      this.lastErrorTime = Date.now();
      this.consecutiveFailures++;
      
      if (this.consecutiveFailures >= VoiceMasterEngine.MAX_CONSECUTIVE_FAILURES) {
        console.log('[VoiceMaster] Too many failures, mic is busy');
        this.micBusy = true;
        this.isListening = false;
        if (this.onMicBusyChange) {
          this.onMicBusyChange(true);
        }
        if (this.onRetryNeeded) {
          this.onRetryNeeded();
        }
        return false;
      }
      
      if (this.shouldBeListening) {
        this.scheduleRestart();
      }
      return false;
    }
  }
  
  private startWeb(): boolean {
    try {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognitionAPI) {
        return false;
      }
      
      this.webRecognition = new SpeechRecognitionAPI();
      this.webRecognition.continuous = true;
      this.webRecognition.interimResults = false;
      this.webRecognition.lang = 'en-US';
      
      this.webRecognition.onresult = (event: SpeechRecognitionEvent) => {
        const lastResult = event.results[event.results.length - 1];
        if (lastResult.isFinal && this.shouldBeListening) {
          const transcript = lastResult[0].transcript;
          this.processTranscript(transcript);
        }
      };
      
      this.webRecognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.log('[VoiceMaster] Web error:', event.error);
        if (event.error !== 'aborted' && event.error !== 'not-allowed' && this.shouldBeListening) {
          this.scheduleRestart();
        }
      };
      
      this.webRecognition.onend = () => {
        this.isListening = false;
        if (this.config?.onListeningChange) {
          this.config.onListeningChange(false);
        }
        if (this.shouldBeListening) {
          this.scheduleRestart();
        }
      };
      
      this.webRecognition.onstart = () => {
        this.isListening = true;
        if (this.config?.onListeningChange) {
          this.config.onListeningChange(true);
        }
      };
      
      this.webRecognition.start();
      console.log('[VoiceMaster] Started web');
      return true;
    } catch (e) {
      console.error('[VoiceMaster] Failed to start web:', e);
      return false;
    }
  }
  
  private scheduleRestart(): void {
    const timeSinceLastError = Date.now() - this.lastErrorTime;
    if (timeSinceLastError < 3000 && this.lastErrorTime > 0) {
      if (this.restartTimeout) {
        clearTimeout(this.restartTimeout);
      }
      this.restartTimeout = setTimeout(() => {
        this.scheduleRestart();
      }, 3000 - timeSinceLastError + 100);
      return;
    }
    
    if (this.micBusy) {
      console.log('[VoiceMaster] Mic busy, not scheduling restart');
      return;
    }
    
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
    }
    
    this.restartTimeout = setTimeout(async () => {
      if (this.shouldBeListening && !this.micBusy) {
        console.log('[VoiceMaster] Restarting after delay');
        if (isNative) {
          await this.startNative();
        } else {
          this.startWeb();
        }
      }
    }, 500); // Faster restart than before (500ms vs 3s)
  }
  
  async stop(): Promise<void> {
    this.shouldBeListening = false;
    this.isPaused = false;
    
    // Clear debounce
    if (this.captureDebounceTimeout) {
      clearTimeout(this.captureDebounceTimeout);
      this.captureDebounceTimeout = null;
    }
    this.pendingCaptureTranscript = '';
    
    // Unregister from voiceController
    if (this.isRegistered) {
      voiceController.unregister(this.sessionId);
      this.isRegistered = false;
    }
    
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    
    if (isNative) {
      try {
        await CapacitorSpeechRecognition.stop();
        if (this.listenerHandle) {
          await this.listenerHandle.remove();
          this.listenerHandle = null;
        }
        if (this.stateListenerHandle) {
          await this.stateListenerHandle.remove();
          this.stateListenerHandle = null;
        }
      } catch (e) {
        console.log('[VoiceMaster] Stop error:', e);
      }
    } else if (this.webRecognition) {
      try {
        this.webRecognition.stop();
      } catch (e) {
        console.log('[VoiceMaster] Web stop error:', e);
      }
      this.webRecognition = null;
    }
    
    this.isListening = false;
    if (this.config?.onListeningChange) {
      this.config.onListeningChange(false);
    }
    this.config = null;
    console.log('[VoiceMaster] Stopped');
  }
  
  getIsListening(): boolean {
    return this.isListening;
  }
  
  getMode(): VoiceMode | null {
    return this.config?.mode || null;
  }
}

// Singleton instance
export const voiceMaster = new VoiceMasterEngine();

// Legacy compatibility - trainingVoice is now an alias for voiceMaster in 'raw' mode
export const trainingVoice = {
  async start(onTranscript: (text: string) => void, onListeningChange?: (listening: boolean) => void): Promise<boolean> {
    return voiceMaster.start({
      mode: 'raw',
      onTranscript,
      onListeningChange
    });
  },
  async stop(): Promise<void> {
    return voiceMaster.stop();
  },
  async checkAvailability(): Promise<boolean> {
    return voiceMaster.checkAvailability();
  },
  getIsListening(): boolean {
    return voiceMaster.getIsListening();
  },
  setOnMicBusyChange(callback: ((busy: boolean) => void) | null): void {
    voiceMaster.setOnMicBusyChange(callback);
  },
  setOnRetryNeeded(callback: (() => void) | null): void {
    voiceMaster.setOnRetryNeeded(callback);
  },
  isMicBusy(): boolean {
    return voiceMaster.isMicBusy();
  },
  resetMicBusy(): void {
    voiceMaster.resetMicBusy();
  }
};
