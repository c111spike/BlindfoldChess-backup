import { Capacitor } from '@capacitor/core';
import { SpeechRecognition as CapacitorSpeechRecognition } from '@capacitor-community/speech-recognition';
import { SpeechSynthesis as CapacitorSpeechSynthesis } from '@capgo/capacitor-speech-synthesis';

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
  'knight': 'N',
  'night': 'N',
  'horse': 'N',
  'pawn': '',
  'castle': 'R',
};

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

let voiceRecognitionInstance: VoiceRecognition | null = null;

function abortRecognitionIfReady() {
  if (voiceRecognitionInstance) {
    voiceRecognitionInstance.abort();
  }
}

function resumeRecognitionAfterTTS() {
  if (voiceRecognitionInstance) {
    voiceRecognitionInstance.resumeAfterTTS();
  }
}

async function waitForTTSCompletion(): Promise<void> {
  if (!isNative) return;
  
  const maxWaitMs = 30000;
  const pollIntervalMs = 200;
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      const state = await CapacitorSpeechSynthesis.isPlaying();
      if (!state.value) {
        return;
      }
    } catch {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
}

export async function speak(text: string, rate: number = 0.9): Promise<void> {
  isBotSpeaking = true;
  abortRecognitionIfReady();
  console.log('[Voice] Mic muted: Bot is speaking');
  
  try {
    if (isNative) {
      await CapacitorSpeechSynthesis.speak({
        text,
        lang: 'en-US',
        rate,
        pitch: 1.0,
        volume: 1.0,
        category: 'playback'
      });
      
      await waitForTTSCompletion();
    } else {
      if (!('speechSynthesis' in window)) {
        console.warn('Speech synthesis not supported');
        return;
      }
      
      window.speechSynthesis.cancel();
      await new Promise(r => setTimeout(r, 50));
      
      const voices = await loadVoices();
      
      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
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
        
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        
        window.speechSynthesis.speak(utterance);
      });
    }
  } finally {
    isBotSpeaking = false;
    setTimeout(() => {
      if (!isBotSpeaking) {
        resumeRecognitionAfterTTS();
        console.log('[Voice] Mic active: Listening for your move');
      }
    }, 100);
  }
}

export function speechToMove(transcript: string, legalMoves: string[]): string | null {
  const input = transcript.toLowerCase().trim();
  
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
  const input = transcript.toLowerCase().trim();
  
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

export class VoiceRecognition {
  private recognition: SpeechRecognition | null = null;
  private isListening: boolean = false;
  private onResult: ((move: string | null, transcript: string) => void) | null = null;
  private onListeningChange: ((listening: boolean) => void) | null = null;
  private legalMoves: string[] = [];
  private restartTimeout: ReturnType<typeof setTimeout> | null = null;
  private shouldBeListening: boolean = false;
  private instanceId: number = 0;
  private removeNativeListener: (() => Promise<void>) | null = null;
  private nativeAvailable: boolean = false;
  private initializationComplete: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private pendingStartAfterInit: boolean = false;
  
  constructor() {
    this.initializationPromise = this.initialize();
  }
  
  private async initialize(): Promise<void> {
    if (isNative) {
      await this.setupNativeRecognitionAsync();
    } else {
      this.setupWebRecognition();
    }
    this.initializationComplete = true;
    
    if (this.pendingStartAfterInit && this.shouldBeListening) {
      this.pendingStartAfterInit = false;
      this.startInternal();
    }
  }
  
  private setupWebRecognition(): boolean {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognitionAPI) {
        this.recognition = new SpeechRecognitionAPI();
        this.recognition.continuous = true;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';
        
        this.recognition.onresult = (event: SpeechRecognitionEvent) => {
          console.log('[VoiceRecognition] onresult triggered, results count:', event.results.length);
          const lastResult = event.results[event.results.length - 1];
          console.log('[VoiceRecognition] isFinal:', lastResult.isFinal, 'shouldBeListening:', this.shouldBeListening);
          if (lastResult.isFinal && this.shouldBeListening) {
            const transcript = lastResult[0].transcript;
            console.log('[VoiceRecognition] Transcript:', transcript);
            console.log('[VoiceRecognition] Legal moves:', this.legalMoves.slice(0, 10), '...');
            const move = speechToMove(transcript, this.legalMoves);
            console.log('[VoiceRecognition] Matched move:', move);
            if (this.onResult) {
              this.onResult(move, transcript);
            }
          }
        };
        
        this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.log('Speech recognition error:', event.error);
          if (event.error === 'no-speech' || event.error === 'audio-capture' || event.error === 'network') {
            if (this.shouldBeListening) {
              this.scheduleRestart();
            }
          } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            console.warn('Microphone access denied');
            this.shouldBeListening = false;
          }
        };
        
        this.recognition.onend = () => {
          this.isListening = false;
          if (this.onListeningChange) {
            this.onListeningChange(false);
          }
          if (this.shouldBeListening) {
            this.scheduleRestart();
          }
        };
        
        this.recognition.onstart = () => {
          this.isListening = true;
          if (this.onListeningChange) {
            this.onListeningChange(true);
          }
        };
        
        return true;
      }
    }
    return false;
  }
  
  private async setupNativeRecognitionAsync(): Promise<void> {
    try {
      const { available } = await CapacitorSpeechRecognition.available();
      if (!available) {
        console.warn('Native speech recognition not available, falling back to web');
        this.nativeAvailable = false;
        this.setupWebRecognition();
        return;
      }
      
      const { speechRecognition } = await CapacitorSpeechRecognition.checkPermissions();
      if (speechRecognition !== 'granted') {
        const result = await CapacitorSpeechRecognition.requestPermissions();
        if (result.speechRecognition !== 'granted') {
          console.warn('Speech recognition permission denied, falling back to web');
          this.nativeAvailable = false;
          this.setupWebRecognition();
          return;
        }
      }
      
      this.nativeAvailable = true;
      console.log('[VoiceRecognition] Native speech recognition initialized');
    } catch (e) {
      console.error('Error setting up native speech recognition, falling back to web:', e);
      this.nativeAvailable = false;
      this.setupWebRecognition();
    }
  }
  
  private scheduleRestart() {
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
    }
    this.restartTimeout = setTimeout(() => {
      if (isBotSpeaking) {
        return;
      }
      if (this.shouldBeListening && !this.isListening) {
        this.startInternal();
      }
    }, 500);
  }
  
  private startInternal() {
    if (isNative && this.nativeAvailable) {
      this.startNative();
    } else if (this.recognition) {
      try {
        this.recognition.start();
      } catch (e) {
        console.log('Failed to start recognition:', e);
      }
    }
  }
  
  private async startNative() {
    if (!this.nativeAvailable) {
      console.warn('Native speech recognition not available');
      return;
    }
    
    try {
      if (this.removeNativeListener) {
        await this.removeNativeListener();
        this.removeNativeListener = null;
      }
      
      const listener = await CapacitorSpeechRecognition.addListener('result', (data: { matches: string[] }) => {
        if (data.matches && data.matches.length > 0 && this.shouldBeListening) {
          const transcript = data.matches[0];
          console.log('[VoiceRecognition Native] Transcript:', transcript);
          const move = speechToMove(transcript, this.legalMoves);
          console.log('[VoiceRecognition Native] Matched move:', move);
          if (this.onResult) {
            this.onResult(move, transcript);
          }
        }
      });
      
      this.removeNativeListener = async () => {
        await listener.remove();
      };
      
      this.isListening = true;
      if (this.onListeningChange) {
        this.onListeningChange(true);
      }
      
      await CapacitorSpeechRecognition.start({
        language: 'en-US',
        maxResults: 5,
        prompt: 'Say your chess move',
        partialResults: false,
        popup: false
      });
    } catch (e) {
      console.error('Error starting native speech recognition:', e);
      this.isListening = false;
      if (this.onListeningChange) {
        this.onListeningChange(false);
      }
      if (this.shouldBeListening) {
        this.scheduleRestart();
      }
    }
  }
  
  private async stopNative() {
    try {
      await CapacitorSpeechRecognition.stop();
      if (this.removeNativeListener) {
        await this.removeNativeListener();
        this.removeNativeListener = null;
      }
    } catch (e) {
      console.log('Error stopping native speech recognition:', e);
    }
    this.isListening = false;
    if (this.onListeningChange) {
      this.onListeningChange(false);
    }
  }
  
  setLegalMoves(moves: string[]) {
    this.legalMoves = moves;
  }
  
  setOnResult(callback: (move: string | null, transcript: string) => void) {
    this.onResult = callback;
  }
  
  setOnListeningChange(callback: (listening: boolean) => void) {
    this.onListeningChange = callback;
  }
  
  start() {
    this.shouldBeListening = true;
    
    if (!this.initializationComplete) {
      this.pendingStartAfterInit = true;
      return;
    }
    
    if (!this.isListening) {
      this.startInternal();
    }
  }
  
  stop() {
    this.shouldBeListening = false;
    this.pendingStartAfterInit = false;
    this.instanceId++;
    
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    
    if (isNative && this.nativeAvailable) {
      this.stopNative();
    } else if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.log('Error stopping recognition:', e);
      }
    }
    
    this.isListening = false;
    if (this.onListeningChange) {
      this.onListeningChange(false);
    }
  }
  
  abort() {
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    
    if (isNative && this.nativeAvailable) {
      this.stopNative();
    } else if (this.recognition && this.isListening) {
      try {
        this.recognition.abort();
      } catch (e) {
        console.log('Error aborting recognition:', e);
      }
    }
    
    this.isListening = false;
    if (this.onListeningChange) {
      this.onListeningChange(false);
    }
  }
  
  resumeAfterTTS() {
    if (this.shouldBeListening && !this.isListening) {
      if (this.initializationComplete) {
        this.startInternal();
      } else {
        this.pendingStartAfterInit = true;
      }
    }
  }
  
  reset() {
    this.stop();
    this.onResult = null;
    this.onListeningChange = null;
    this.legalMoves = [];
  }
  
  isSupported(): boolean {
    if (!this.initializationComplete) {
      return true;
    }
    if (isNative) {
      return this.nativeAvailable;
    }
    return this.recognition !== null;
  }
  
  getIsListening(): boolean {
    return this.isListening;
  }
  
  async waitForInitialization(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
  }
}

export const voiceRecognition = new VoiceRecognition();
voiceRecognitionInstance = voiceRecognition;
