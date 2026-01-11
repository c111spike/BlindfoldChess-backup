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
  private resumeDelayMs = 350; // 350ms delay for Galaxy S9+ audio system to settle
  
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
   * Clear pending restarts for a specific session (prevents stale restart attempts)
   */
  clearPendingForSession(sessionId: string): void {
    const before = this.pendingRestarts.length;
    this.pendingRestarts = this.pendingRestarts.filter(id => id !== sessionId);
    if (before !== this.pendingRestarts.length) {
      console.log(`[VoiceController] Cleared pending restart for: ${sessionId}`);
    }
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
    const sessionCount = this.sessions.size;
    const sessionIds = Array.from(this.sessions.keys()).join(', ');
    console.log(`[VoiceController] TTS ended, state -> SETTLING, waiting ${this.resumeDelayMs}ms, sessions: [${sessionIds}] (${sessionCount})`);
    
    this.settlingTimeout = setTimeout(() => {
      if (!this.isSpeaking) {
        this.micState = MicState.LISTENING;
        console.log('[VoiceController] Settling complete, state -> LISTENING');
        
        // Log session states for debugging
        Array.from(this.sessions.entries()).forEach(([id, session]) => {
          console.log(`[VoiceController] Session '${id}' shouldBeActive=${session.shouldBeActive}`);
        });
        
        // Process pending restarts first (these are non-session restarts like VoiceRecognition)
        // Track which sessions have been resumed to avoid double-resume
        const resumedSessionIds = new Set<string>();
        const hadPendingRestarts = this.pendingRestarts.length > 0;
        
        if (hadPendingRestarts) {
          console.log(`[VoiceController] Processing ${this.pendingRestarts.length} pending restarts: ${this.pendingRestarts.join(', ')}`);
          this.playMicLiveClick();
          // Signal that pending restarts should execute
          this.pendingRestarts.forEach(id => {
            const session = this.sessions.get(id);
            if (session && session.shouldBeActive) {
              console.log(`[VoiceController] Executing pending restart for: ${id}`);
              session.resume();
              resumedSessionIds.add(id);
            } else {
              console.log(`[VoiceController] Skipping pending restart for '${id}' - session=${!!session}, shouldBeActive=${session?.shouldBeActive}`);
            }
          });
          this.pendingRestarts = [];
        }
        
        // Resume remaining active sessions (exclude those already resumed from pending restarts)
        const sessionsToResume = Array.from(this.sessions.values()).filter(
          s => s.shouldBeActive && !resumedSessionIds.has(s.id)
        );
        console.log(`[VoiceController] Sessions to resume: ${sessionsToResume.length}`);
        if (sessionsToResume.length > 0) {
          // Play mic-live click sound before resuming (if not already played)
          if (!hadPendingRestarts) {
            this.playMicLiveClick();
          }
          sessionsToResume.forEach(session => {
            console.log(`[VoiceController] Resuming session: ${session.id}`);
            session.resume();
          });
        } else {
          console.log('[VoiceController] No sessions to resume');
        }
      } else {
        console.log('[VoiceController] Skipping resume - TTS started again during settling');
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

// ========================================
// VOICE REGISTRY - TWO-LANE LIFECYCLE ARCHITECTURE
// Lane A (Protected): Game + Reconstruction - persistent, never killed by training purge
// Lane B (Disposable): Training modes - aggressive cleanup between games
// ========================================

class VoiceRegistryImpl {
  // TWO-LANE ARCHITECTURE: Protected lane for game, disposable lane for training
  private protectedSessionId: string | null = null;  // 'game', 'reconstruction'
  private disposableSessionId: string | null = null; // 'color-blitz', 'voice-move-master', etc.
  private isPurging: boolean = false;
  
  // Session types for lane routing
  private static readonly PROTECTED_SESSIONS = ['game', 'reconstruction'];
  
  /**
   * Register a session in the appropriate lane.
   * Protected sessions (game/reconstruction) go to Lane A.
   * Training sessions go to Lane B (disposable).
   */
  register(sessionId: string): void {
    const isProtected = VoiceRegistryImpl.PROTECTED_SESSIONS.includes(sessionId);
    
    if (isProtected) {
      // Game→Reconstruction handover: don't touch anything, just update the ID
      const isHandover = this.protectedSessionId === 'game' && sessionId === 'reconstruction';
      if (isHandover) {
        console.log(`[VoiceRegistry] HANDOVER: game → reconstruction (mic stays warm)`);
      }
      this.protectedSessionId = sessionId;
      console.log(`[VoiceRegistry] Protected lane: ${sessionId}`);
    } else {
      this.disposableSessionId = sessionId;
      console.log(`[VoiceRegistry] Disposable lane: ${sessionId}`);
    }
  }
  
  /**
   * Unregister a session from its lane
   */
  unregister(sessionId: string): void {
    const isProtected = VoiceRegistryImpl.PROTECTED_SESSIONS.includes(sessionId);
    
    if (isProtected && this.protectedSessionId === sessionId) {
      this.protectedSessionId = null;
      console.log(`[VoiceRegistry] Unregistered protected: ${sessionId}`);
    } else if (!isProtected && this.disposableSessionId === sessionId) {
      this.disposableSessionId = null;
      console.log(`[VoiceRegistry] Unregistered disposable: ${sessionId}`);
    }
  }
  
  /**
   * TRAINING PURGE: Kill DISPOSABLE lane sessions (trainingVoice, voiceMaster).
   * If protected lane is active, leaves voiceRecognition alone so game mic stays alive.
   * This allows training cleanup to work even after a game has been played.
   */
  async purge(): Promise<void> {
    if (this.isPurging) {
      console.log('[VoiceRegistry] Already purging, skipping');
      return;
    }
    
    this.isPurging = true;
    const hasProtected = !!this.protectedSessionId;
    console.log(`[VoiceRegistry] PURGE: Killing disposable lane${hasProtected ? ' (game protected)' : ''}`);
    
    // Always stop training voice engines (trainingVoice wraps voiceMaster)
    try {
      trainingVoice.stop();
    } catch (e) {
      console.log('[VoiceRegistry] trainingVoice.stop error:', e);
    }
    
    try {
      voiceMaster.stop();
    } catch (e) {
      console.log('[VoiceRegistry] voiceMaster.stop error:', e);
    }
    
    // Only stop voiceRecognition if NO protected session (don't kill game mic)
    if (!hasProtected) {
      try {
        voiceRecognition.stop();
      } catch (e) {
        console.log('[VoiceRegistry] voiceRecognition.stop error:', e);
      }
    }
    
    // Remove native listeners only if no protected session
    if (isNative && !hasProtected) {
      try {
        await CapacitorSpeechRecognition.stop();
        await CapacitorSpeechRecognition.removeAllListeners();
        console.log('[VoiceRegistry] Removed native listeners');
      } catch (e) {
        console.log('[VoiceRegistry] removeAllListeners error:', e);
      }
    }
    
    // Reset micBusy flags on training engines
    try {
      voiceMaster.resetMicBusy();
    } catch (e) {
      console.log('[VoiceRegistry] resetMicBusy error:', e);
    }
    
    // CRITICAL: Reset isStarted flags to enable back-to-back games
    // Without this, the wrapper thinks it's "already started" and won't restart
    try {
      voiceRecognition.resetStartedFlag();
    } catch (e) {
      console.log('[VoiceRegistry] resetStartedFlag error:', e);
    }
    
    this.disposableSessionId = null;
    
    // MANDATORY 500ms SILENCE WINDOW for S9+ audio flinger to settle
    await new Promise(resolve => setTimeout(resolve, 500));
    
    this.isPurging = false;
    console.log('[VoiceRegistry] PURGE complete - disposable lane cleared, flags reset');
  }
  
  /**
   * NUCLEAR PURGE: Kill ALL sessions including protected lane.
   * Only use when leaving the app or on critical errors.
   */
  async purgeAll(): Promise<void> {
    if (this.isPurging) {
      console.log('[VoiceRegistry] Already purging, skipping');
      return;
    }
    
    this.isPurging = true;
    console.log(`[VoiceRegistry] NUCLEAR PURGE: Killing ALL sessions`);
    
    // Stop ALL voice engines
    try { voiceRecognition.stop(); } catch (e) {}
    try { trainingVoice.stop(); } catch (e) {}
    try { voiceMaster.stop(); } catch (e) {}
    
    if (isNative) {
      try {
        await CapacitorSpeechRecognition.stop();
        await CapacitorSpeechRecognition.removeAllListeners();
      } catch (e) {}
    }
    
    try { voiceMaster.resetMicBusy(); } catch (e) {}
    
    // Reset isStarted flags for fresh state
    try { voiceRecognition.resetStartedFlag(); } catch (e) {}
    
    this.protectedSessionId = null;
    this.disposableSessionId = null;
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    this.isPurging = false;
    console.log('[VoiceRegistry] NUCLEAR PURGE complete');
  }
  
  /**
   * Clear protected lane (when leaving game entirely)
   */
  clearProtectedLane(): void {
    if (this.protectedSessionId) {
      console.log(`[VoiceRegistry] Clearing protected lane: ${this.protectedSessionId}`);
      this.protectedSessionId = null;
    }
  }
  
  getProtectedSession(): string | null {
    return this.protectedSessionId;
  }
  
  getDisposableSession(): string | null {
    return this.disposableSessionId;
  }
  
  getActiveSession(): string | null {
    return this.protectedSessionId || this.disposableSessionId;
  }
}

export const VoiceRegistry = new VoiceRegistryImpl();

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

// ========================================
// O(1) PHONETIC LOOKUP - PRO-TIER EFFICIENCY
// Single hash map lookups instead of chained regex scans
// ========================================

const PHONETIC_FILE_MAP: Record<string, string> = {
  'a': 'Ay', 'b': 'Bee', 'c': 'See', 'd': 'Dee',
  'e': 'e', 'f': 'f', 'g': 'Gee', 'h': 'h'
};

const PHONETIC_PIECE_MAP: Record<string, string> = {
  'N': 'Knight', 'B': 'Bishop', 'R': 'Rook', 'Q': 'Queen', 'K': 'King'
};

const PROTECTED_FEEDBACK_WORDS = new Set([
  'correct', 'wrong', 'next', 'say', 'the', 'move', 'look', 'okay', 'continue',
  'seconds', 'remaining', 'are', 'you', 'sure', 'want', 'resign', 'yes', 'no',
  'can', 'play', 'legal', 'moves', 'for', 'material', 'is', 'equal', 'white',
  'black', 'up', 'point', 'points', 'at', 'highlighted', 'squares', 'on', 'board'
]);

function toPhonetic(text: string): string {
  const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 0);
  const allProtected = words.length > 0 && words.every(w => PROTECTED_FEEDBACK_WORDS.has(w));
  if (allProtected) return text;
  
  const hasChessPattern = /[a-h]\s*[1-8]|[NBRQK][a-h]|O-O/.test(text);
  if (!hasChessPattern) return text;
  
  let result = text
    .replace(/O-O-O/gi, 'queenside castle')
    .replace(/O-O/gi, 'kingside castle')
    .replace(/x/g, ' takes ')
    .replace(/\+/g, ' check')
    .replace(/#/g, ' checkmate');
  
  for (const [piece, name] of Object.entries(PHONETIC_PIECE_MAP)) {
    result = result.replace(new RegExp(`\\b${piece}([a-h])([1-8])`, 'g'), `${name} $1$2`);
    result = result.replace(new RegExp(`\\b${piece}\\s*takes\\s*([a-h])([1-8])`, 'gi'), `${name} takes $1$2`);
    result = result.replace(new RegExp(`\\b${piece}([a-h1-8])([a-h])([1-8])`, 'g'), `${name} $1$2$3`);
  }
  
  for (const [letter, phonetic] of Object.entries(PHONETIC_FILE_MAP)) {
    result = result.replace(new RegExp(`\\b${letter}\\s*([1-8])`, 'gi'), `${phonetic} $1`);
  }
  
  // SPECIAL FIX: Handle lowercase standalone "a" that didn't get replaced (edge case)
  // This catches "a 4" that might have been missed if there's extra whitespace
  result = result.replace(/\ba\s+([1-8])\b/gi, 'Ay $1');
  
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
      // PREMATURE RESUME FIX: Don't trust the speak() promise - it resolves immediately on Android
      // Instead, wait for the 'end' EVENT which fires when TTS actually finishes
      await new Promise<void>(async (resolve) => {
        let hasResolved = false;
        
        // FAILSAFE: If the event never fires (rare Android bug), force resume after timeout
        // Calculation: ~150ms per character + 2500ms base buffer
        const timeoutDuration = Math.max(2500, phoneticText.length * 150);
        const timer = setTimeout(() => {
          if (!hasResolved) {
            console.warn('[Voice] TTS Event timeout - forcing resume after', timeoutDuration, 'ms');
            hasResolved = true;
            // Clean up listener to avoid leaking native listeners
            if (listener) listener.remove().catch(() => {});
            resolve();
          }
        }, timeoutDuration);

        // LISTENER: The only source of truth for when TTS actually finishes
        let listener: { remove: () => Promise<void> } | null = null;
        try {
          listener = await CapacitorSpeechSynthesis.addListener('end', () => {
            if (!hasResolved) {
              console.log('[Voice] TTS End detected via event - mic resume now safe');
              clearTimeout(timer);
              hasResolved = true;
              if (listener) listener.remove().catch(() => {});
              resolve();
            }
          });
        } catch (setupErr) {
          console.warn('[Voice] Failed to setup TTS listener:', setupErr);
        }

        // SPEAK: Fire off the TTS (promise may resolve immediately - that's OK, we're waiting for event)
        try {
          await CapacitorSpeechSynthesis.speak({
            text: phoneticText,
            language: 'en-US',
            rate,
            pitch: 1.0,
            volume: 1.0
          });
        } catch (speakErr) {
          console.error('[Voice] Speak error:', speakErr);
          clearTimeout(timer);
          if (listener) listener.remove().catch(() => {});
          hasResolved = true;
          resolve();
        }
        
        // If listener setup failed, rely on the timer (or fallback to old behavior)
        if (!listener) {
          console.log('[Voice] No listener available, using fallback timing');
          // Wait a reasonable time for speech to complete
          await new Promise(r => setTimeout(r, Math.max(1000, phoneticText.length * 100)));
          if (!hasResolved) {
            clearTimeout(timer);
            hasResolved = true;
            resolve();
          }
        }
      });
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
  private isMuted: boolean = false;
  private unmuteTimeout: ReturnType<typeof setTimeout> | null = null;
  
  /**
   * CONTINUOUS LOOP: Pause the auto-restart loop for TTS
   * Stops mic hardware and prevents auto-restart until resumeLoop() is called
   * Use this BEFORE speak() calls
   */
  async pauseLoop(): Promise<void> {
    console.log('[VoiceRecognition] pauseLoop');
    await voiceMaster.pauseLoop();
    this.isMuted = true;
  }
  
  /**
   * CONTINUOUS LOOP: Resume the auto-restart loop after TTS
   * Kicks off fresh mic start and enables auto-restart (fire-and-forget)
   * Use this AFTER speak() calls
   */
  resumeLoop(): void {
    console.log('[VoiceRecognition] resumeLoop');
    this.isMuted = false;
    voiceMaster.resumeLoop();
  }
  
  /**
   * DEPRECATED: Use pauseLoop()/resumeLoop() for TTS coordination
   * Software mute without hardware control - kept for backward compat
   */
  setMute(val: boolean, tailMs: number = 400): void {
    // Clear any pending unmute
    if (this.unmuteTimeout) {
      clearTimeout(this.unmuteTimeout);
      this.unmuteTimeout = null;
    }
    
    if (val) {
      this.isMuted = true;
      console.log('[VoiceRecognition] Software MUTE: transcripts will be ignored');
    } else {
      // Apply "Mute Tail" - delay unmute to let audio flinger clear
      this.unmuteTimeout = setTimeout(() => {
        this.isMuted = false;
        this.unmuteTimeout = null;
        console.log('[VoiceRecognition] Software UNMUTE: mic LIVE');
      }, tailMs);
    }
  }
  
  getMuted(): boolean {
    return this.isMuted;
  }
  
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
    // REINSTATED: Guard prevents hardware crashes from double-start
    if (this.isStarted) {
      console.log('[VoiceRecognition] Already started, skipping duplicate start');
      return;
    }
    
    await this.startInternal();
  }
  
  /**
   * Internal start logic - shared by start() and forceRestart()
   */
  private async startInternal(): Promise<void> {
    try {
      const started = await voiceMaster.start({
        mode: 'move',
        legalMoves: this.legalMoves,
        onTranscript: (transcript, parsedMove) => {
          // ALWAYS-ON MIC: Filter transcripts when software-muted
          if (this.isMuted) {
            console.log('[VoiceRecognition] Ignored while muted:', transcript);
            return;
          }
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
      console.log('[VoiceRecognition] startInternal result:', started);
    } catch (e) {
      console.log('[VoiceRecognition] startInternal failed:', e);
      this.isStarted = false;
    }
  }
  
  /**
   * Force restart the mic - bypasses isStarted guard for post-TTS restart
   * Call this when you KNOW the mic needs to restart (e.g., after bot speaks)
   * Goes directly to startInternal(), bypassing the guard
   */
  async forceRestart(): Promise<void> {
    console.log('[VoiceRecognition] Force restart - bypassing guard');
    // Don't check isStarted, go directly to hardware
    await this.startInternal();
  }
  
  stop(): void {
    if (!this.isStarted) return; // Reinstated guard
    this.isStarted = false;
    voiceMaster.stop();
  }
  
  async stopAndWait(): Promise<void> {
    if (!this.isStarted) return; // Reinstated guard
    this.isStarted = false;
    await voiceMaster.stopAndWait();
  }
  
  /**
   * Force reset the isStarted flag - called by VoiceRegistry.purge()
   * to enable back-to-back games
   */
  resetStartedFlag(): void {
    this.isStarted = false;
  }
  
  abort(): void {
    this.stop();
  }
  
  async reset(): Promise<void> {
    // Use stopAndWait for clean hardware release during cleanup
    await this.stopAndWait();
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
  
  // GOLD STANDARD: Mutex-based restart serialization
  // shouldRestart controls if loop should continue (false during TTS)
  // restartPromise acts as mutex - only one restart at a time
  private shouldRestart: boolean = true;
  private restartPromise: Promise<void> | null = null;
  
  // GATEKEEPER FIX: Prevent UI and background loop collision
  private isStarting: boolean = false;
  
  // GHOST BUSTER: Counter for intentional stops - ignore late 'stopped' events
  private expectedStops: number = 0;
  
  // STEALTH MIC: Mute window to avoid stop/start beeps
  private isMuted: boolean = false;
  private muteTimeout: ReturnType<typeof setTimeout> | null = null;
  
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
   * STEALTH MIC: Mute input for specified duration without stopping hardware
   * Eliminates Android system beeps by keeping mic hot but ignoring input
   */
  mute(durationMs: number = 400): void {
    this.isMuted = true;
    if (this.muteTimeout) clearTimeout(this.muteTimeout);
    this.muteTimeout = setTimeout(() => {
      this.isMuted = false;
      this.muteTimeout = null;
      console.log('[VoiceMaster] Mute window ended, listening again');
    }, durationMs);
    console.log(`[VoiceMaster] Mute window started: ${durationMs}ms`);
  }
  
  /**
   * ALWAYS-ON MIC: Toggle-style mute with optional mute tail
   * @param val - true to mute, false to unmute
   * @param tailMs - delay before unmuting (400ms default for S9+ audio flinger latency)
   */
  setMute(val: boolean, tailMs: number = 400): void {
    if (this.muteTimeout) {
      clearTimeout(this.muteTimeout);
      this.muteTimeout = null;
    }
    
    if (val) {
      this.isMuted = true;
      console.log('[VoiceMaster] Software MUTE: transcripts will be ignored');
    } else {
      // Apply "Mute Tail" - delay unmute to let audio flinger clear
      this.muteTimeout = setTimeout(() => {
        this.isMuted = false;
        this.muteTimeout = null;
        console.log('[VoiceMaster] Software UNMUTE: mic LIVE');
      }, tailMs);
    }
  }
  
  /**
   * Check if currently muted (for transcript filtering)
   */
  getIsMuted(): boolean {
    return this.isMuted;
  }
  
  /**
   * GOLD STANDARD: The "Mutex" Restart Logic (FIRE-AND-FORGET)
   * If a restart is already in progress, skip this request
   * Otherwise: STOP → BUFFER 50ms → START (if shouldRestart)
   * Does NOT block callers - runs in background
   */
  private triggerRestart(): void {
    // 1. LOCK: If a restart is already queued, ignore this request
    if (this.restartPromise) {
      console.log('[VoiceMaster] Restart already in progress, skipping duplicate.');
      return;
    }

    this.restartPromise = (async () => {
      try {
        console.log('[VoiceMaster] Serialized restart sequence initiating...');
        
        // GHOST BUSTER: Signal we're stopping intentionally - ignore the resulting event
        this.expectedStops++;
        console.log('[VoiceMaster] triggerRestart: expectedStops incremented to', this.expectedStops);
        
        // 2. STOP: Ensure the hardware is truly released
        // Note: isListening may be stale, always try to stop
        try {
          await CapacitorSpeechRecognition.stop();
          console.log('[VoiceMaster] triggerRestart: hardware stopped');
        } catch (e) {
          // If stop failed, we didn't actually cause a stop event, so decrement
          this.expectedStops = Math.max(0, this.expectedStops - 1);
          console.log('[VoiceMaster] triggerRestart stop error, expectedStops decremented to', this.expectedStops);
        }

        // 3. BUFFER: 100ms mandatory breathing room for S9+ AudioFlinger (increased from 50ms)
        await new Promise(resolve => setTimeout(resolve, 100));

        // 4. CHECK: Only start if the loop is still active (didn't get paused during the wait)
        if (this.shouldRestart && !this.micBusy) {
          console.log('[VoiceMaster] triggerRestart: starting fresh session');
          try {
            await this.startNative();
          } catch (startErr) {
            console.warn('[VoiceMaster] triggerRestart start failed, scheduling retry:', startErr);
            // Schedule a retry after delay
            setTimeout(() => {
              if (this.shouldRestart && !this.micBusy && !this.restartPromise) {
                this.triggerRestart();
              }
            }, 200);
          }
        } else {
          console.log('[VoiceMaster] triggerRestart: shouldRestart=false or micBusy, skipping start');
        }
      } catch (err) {
        console.warn('[VoiceMaster] Restart sequence failed:', err);
        // Schedule a retry on any error
        setTimeout(() => {
          if (this.shouldRestart && !this.micBusy && !this.restartPromise) {
            this.triggerRestart();
          }
        }, 200);
      } finally {
        // 5. RELEASE: Unlock the mutex so future restarts can happen
        this.restartPromise = null;
      }
    })(); // Execute immediately, no await - fire and forget
  }
  
  /**
   * GOLD STANDARD: Pause the loop for TTS
   * Sets shouldRestart=false and kills the hardware immediately
   * Call BEFORE speak() to prevent mic from hearing TTS
   * NOTE: Does not manually set isListening - let native events handle it
   */
  async pauseLoop(): Promise<void> {
    console.log('[VoiceMaster] Pausing Loop for TTS');
    this.shouldRestart = false;
    
    // Kill the hardware immediately - native listeningState handler will set isListening=false
    if (isNative) {
      try {
        await CapacitorSpeechRecognition.stop();
        console.log('[VoiceMaster] pauseLoop: hardware stopped');
      } catch (e) {
        console.log('[VoiceMaster] pauseLoop stop error:', e);
      }
    }
  }
  
  /**
   * GOLD STANDARD: Resume the loop after TTS
   * Sets shouldRestart=true and uses the safe serializer to restart
   * Call AFTER speak() to resume listening
   * NOTE: Fire-and-forget - does not await restart completion
   */
  resumeLoop(): void {
    console.log('[VoiceMaster] Resuming Loop after TTS');
    this.shouldRestart = true;
    
    // Only restart if we still have a valid config (session not ended)
    if (!this.config) {
      console.log('[VoiceMaster] resumeLoop: no config, skipping');
      return;
    }
    
    // Use the safe serializer to restart (fire-and-forget)
    this.triggerRestart();
  }
  
  /**
   * Check if loop should restart
   */
  getShouldRestartLoop(): boolean {
    return this.shouldRestart;
  }
  
  /**
   * Start the unified voice engine
   * ATOMIC RESET: Forces clean state at the START of every call (treats as fresh boot)
   * Respects voiceController state machine for TTS coordination (S9+ 250ms settling)
   */
  async start(config: VoiceMasterConfig): Promise<boolean> {
    // ATOMIC RESET: Force clean state FIRST - treat every start() as fresh boot
    // This prevents stale state from blocking new sessions
    this.micBusy = false;
    this.isListening = false;
    this.consecutiveFailures = 0;
    this.isPaused = false;
    this.shouldRestart = true; // GOLD STANDARD: Enable auto-restart loop
    this.isMuted = false; // Ensure unmuted on fresh start
    console.log('[VoiceMaster] Atomic reset: state cleared for fresh start, loop enabled');
    
    // Clean handoff: stop any existing session first
    if (this.listenerHandle || this.webRecognition || this.shouldBeListening) {
      console.log('[VoiceMaster] Clean handoff: stopping previous session');
      await this.stop();
      // Small delay for Android audio flinger to release
      await new Promise(r => setTimeout(r, 100));
    }
    
    // Set config after cleanup
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
    
    // Register with VoiceRegistry for global teardown (Zombie Killer)
    VoiceRegistry.register(this.sessionId);
    
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
    
    // STEALTH MIC: Ignore input during mute window (TTS playback)
    if (this.isMuted) {
      console.log('[VoiceMaster] Ignoring transcript during mute window:', transcript);
      return;
    }
    
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
    console.log(`[VoiceMaster] pauseInternal called - isListening=${this.isListening}, shouldBeListening=${this.shouldBeListening}`);
    
    // CRITICAL FIX: Kill the auto-restart loop immediately to prevent Audio Focus War
    this.shouldRestart = false;
    
    if (!this.isListening) {
      console.log('[VoiceMaster] Not pausing - already not listening');
      return;
    }
    this.isPaused = true;
    console.log('[VoiceMaster] Pausing for TTS');
    
    if (isNative) {
      CapacitorSpeechRecognition.stop()
        .then(() => console.log('[VoiceMaster] Native stop succeeded during pause'))
        .catch(e => console.log('[VoiceMaster] Pause stop error:', e));
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
    console.log('[VoiceMaster] pauseInternal complete - isListening now false');
  }
  
  private async resumeInternal(): Promise<void> {
    console.log(`[VoiceMaster] resumeInternal called - shouldBeListening=${this.shouldBeListening}, isListening=${this.isListening}, isPaused=${this.isPaused}`);
    
    if (!this.shouldBeListening) {
      console.log('[VoiceMaster] Not resuming - shouldBeListening is false');
      return;
    }
    if (this.isListening) {
      console.log('[VoiceMaster] Already listening, skipping resume');
      return;
    }
    
    this.isPaused = false;
    
    // CRITICAL FIX: Re-enable auto-restart loop
    this.shouldRestart = true;
    
    console.log('[VoiceMaster] Resuming after TTS');
    
    if (isNative) {
      // Wait for any pending restart to complete before triggering new one
      if (this.restartPromise) {
        console.log('[VoiceMaster] Waiting for pending restart to complete...');
        try {
          await this.restartPromise;
        } catch (e) {
          // Ignore errors from previous restart
        }
      }
      
      // Now trigger a fresh restart - guaranteed to run since restartPromise is null
      this.triggerRestart();
    } else {
      this.startWeb();
    }
  }
  
  private async startNative(): Promise<boolean> {
    // GATEKEEPER FIX: Prevent re-entrant start calls (UI + background collision)
    if (this.isStarting) {
      console.log('[VoiceMaster] startNative blocked: Already starting');
      return false;
    }
    
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
    
    this.isStarting = true; // LOCK
    
    try {
      // Clean up existing listeners
      if (this.listenerHandle) {
        await this.listenerHandle.remove();
        this.listenerHandle = null;
      }
      
      // Add result listener - GOLD STANDARD: Process transcript + mutex restart
      this.listenerHandle = await CapacitorSpeechRecognition.addListener('partialResults', (data: { matches: string[] }) => {
        // GATE: Don't process if loop is paused (prevents stray results during pause window)
        if (!this.shouldRestart) {
          console.log('[VoiceMaster] Loop paused, ignoring partial result');
          return;
        }
        
        if (data.matches && data.matches.length > 0 && this.shouldBeListening) {
          const transcript = data.matches[0];
          this.consecutiveFailures = 0;
          this.processTranscript(transcript);
          
          // GOLD STANDARD: Trigger the mutex restart after processing
          if (this.shouldRestart) {
            this.triggerRestart();
          }
        }
      });
      
      // Add state listener
      if (this.stateListenerHandle) {
        await this.stateListenerHandle.remove();
        this.stateListenerHandle = null;
      }
      this.stateListenerHandle = await CapacitorSpeechRecognition.addListener('listeningState', (state: { status: string }) => {
        console.log('[VoiceMaster] State changed:', state.status, 'shouldRestart:', this.shouldRestart, 'isListening:', this.isListening, 'expectedStops:', this.expectedStops);
        if (state.status === 'stopped') {
          // GHOST BUSTER: Was this stop caused by us (triggerRestart)?
          if (this.expectedStops > 0) {
            console.log('[VoiceMaster] Ignoring expected stop event (expectedStops=' + this.expectedStops + ')');
            this.expectedStops--;
            // Still update state, but DON'T trigger restart - we're handling it ourselves
            this.isListening = false;
            if (this.config?.onListeningChange) {
              this.config.onListeningChange(false);
            }
            return; // Don't trigger restart - triggerRestart will handle start
          }
          
          // GENUINE OS STOP: This is an unexpected stop from the system
          console.log('[VoiceMaster] Genuine OS stop detected');
          this.isListening = false;
          if (this.config?.onListeningChange) {
            this.config.onListeningChange(false);
          }
          // GOLD STANDARD: If loop should continue, trigger restart
          // This handles genuine OS stops and cases where partialResults didn't fire
          if (this.shouldBeListening && this.shouldRestart && !this.micBusy) {
            console.log('[VoiceMaster] Restart via listeningState handler (genuine stop)');
            this.triggerRestart();
          }
        } else if (state.status === 'started') {
          // NATIVE EVENT: Mic is now listening
          this.isListening = true;
          if (this.config?.onListeningChange) {
            this.config.onListeningChange(true);
          }
        }
      });
      
      console.log('[VoiceMaster] Calling CapacitorSpeechRecognition.start()...');
      await CapacitorSpeechRecognition.start({
        language: 'en-US',
        partialResults: true,
        popup: false,
      });
      
      this.isListening = true;
      this.consecutiveFailures = 0;
      console.log('[VoiceMaster] Started native - isListening=true, shouldBeListening=' + this.shouldBeListening);
      
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
    } finally {
      this.isStarting = false; // UNLOCK
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
    
    this.restartTimeout = setTimeout(() => {
      if (this.shouldBeListening && !this.micBusy) {
        console.log('[VoiceMaster] Scheduled restart firing via Gatekeeper');
        if (isNative) {
          // GATEKEEPER FIX: Use triggerRestart() so we respect 'shouldRestart' (TTS flag) and the mutex
          this.triggerRestart();
        } else {
          this.startWeb();
        }
      }
    }, 500); // Faster restart than before (500ms vs 3s)
  }
  
  async stop(): Promise<void> {
    console.log('[VoiceMaster] stop() called - beginning full cleanup');
    
    // FULL STATE RESET - prevent Session Zombies
    this.shouldBeListening = false;
    this.isPaused = false;
    this.micBusy = false;
    this.consecutiveFailures = 0;
    this.lastErrorTime = 0;
    
    // Clear debounce
    if (this.captureDebounceTimeout) {
      clearTimeout(this.captureDebounceTimeout);
      this.captureDebounceTimeout = null;
    }
    this.pendingCaptureTranscript = '';
    
    // CRITICAL: Clear voiceController state BEFORE unregistering
    // This prevents zombie sessions from triggering stale restarts
    voiceController.setActive(this.sessionId, false);
    voiceController.clearPendingForSession(this.sessionId);
    
    // Unregister from voiceController and VoiceRegistry
    if (this.isRegistered) {
      voiceController.unregister(this.sessionId);
      VoiceRegistry.unregister(this.sessionId);
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
    console.log('[VoiceMaster] Stopped - all state reset, session fully cleaned');
  }
  
  /**
   * BULLETPROOF stopAndWait: Never hangs, always cleans up
   * Fast path: If no listener exists, returns immediately (nothing to stop)
   * Slow path: 800ms hard timeout - forces cleanup regardless of hardware state
   */
  async stopAndWait(): Promise<void> {
    // Set intent first
    this.shouldBeListening = false;
    
    // FAST PATH: If there's literally nothing to stop, return immediately
    // Only check listenerHandle/webRecognition - these are the actual hardware resources
    if (!this.listenerHandle && !this.webRecognition) {
      console.log('[VoiceMaster] stopAndWait: nothing to stop, fast path');
      // Reset ALL state flags to ensure clean slate
      this.micBusy = false;
      this.isListening = false;
      this.consecutiveFailures = 0;
      this.isPaused = false;
      this.config = null;
      return;
    }
    
    console.log('[VoiceMaster] stopAndWait: active session, stopping...');
    
    // SLOW PATH with 800ms HARD TIMEOUT - never hang forever
    const slowPathCleanup = async () => {
      // Step 1: Try normal stop with 500ms timeout
      let stopCompleted = false;
      const stopPromise = this.stop().then(() => { stopCompleted = true; });
      
      await Promise.race([
        stopPromise,
        new Promise(resolve => setTimeout(resolve, 500))
      ]);
      
      // Step 2: If normal stop didn't complete, force native stop
      if (!stopCompleted) {
        console.warn('[VoiceMaster] Normal stop timed out, forcing native stop');
        if (isNative) {
          try {
            await CapacitorSpeechRecognition.stop();
          } catch (e) {
            // Expected if not running
          }
        }
        // Clean up listeners directly
        if (this.listenerHandle) {
          try {
            await this.listenerHandle.remove();
          } catch (e) {}
          this.listenerHandle = null;
        }
        if (this.stateListenerHandle) {
          try {
            await this.stateListenerHandle.remove();
          } catch (e) {}
          this.stateListenerHandle = null;
        }
        if (this.webRecognition) {
          try {
            this.webRecognition.stop();
          } catch (e) {}
          this.webRecognition = null;
        }
      }
    };
    
    // 800ms HARD TIMEOUT - UI never waits longer than this
    await Promise.race([
      slowPathCleanup(),
      new Promise<void>(resolve => setTimeout(() => {
        console.warn('[VoiceMaster] 800ms hard timeout - forcing cleanup');
        resolve();
      }, 800))
    ]);
    
    // ALWAYS cleanup state (runs regardless of timeout or success)
    this.micBusy = false;
    this.isListening = false;
    this.consecutiveFailures = 0;
    this.isPaused = false;
    this.listenerHandle = null;
    this.stateListenerHandle = null;
    this.webRecognition = null;
    if (this.config?.onListeningChange) {
      this.config.onListeningChange(false);
    }
    this.config = null;
    
    console.log('[VoiceMaster] stopAndWait complete - state reset');
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
  /**
   * NAVIGATION INTERCEPTOR: Stop and wait for hardware release
   * Call this BEFORE screen transitions to prevent Session Zombies
   */
  async stopAndWait(): Promise<void> {
    return voiceMaster.stopAndWait();
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
  },
  /**
   * STEALTH MIC: Mute input for specified duration without stopping hardware
   */
  mute(durationMs: number = 400): void {
    voiceMaster.mute(durationMs);
  },
  /**
   * ALWAYS-ON MIC: Toggle-style mute with optional mute tail
   */
  setMute(val: boolean, tailMs: number = 400): void {
    voiceMaster.setMute(val, tailMs);
  },
  getIsMuted(): boolean {
    return voiceMaster.getIsMuted();
  },
  /**
   * CONTINUOUS LOOP: Pause the auto-restart loop for TTS
   */
  async pauseLoop(): Promise<void> {
    return voiceMaster.pauseLoop();
  },
  /**
   * CONTINUOUS LOOP: Resume the auto-restart loop after TTS (fire-and-forget)
   */
  resumeLoop(): void {
    voiceMaster.resumeLoop();
  }
};
