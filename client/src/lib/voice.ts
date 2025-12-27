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
    const file = targetSquare[0]; // Keep lowercase for better TTS pronunciation
    const rank = targetSquare[1];
    
    if (hasCapture || isCapture) {
      if (squares.length > 1 || !pieceMatch) {
        const fromFile = cleanMove[0];
        if (fromFile && fromFile.match(/[a-h]/)) {
          spoken += fromFile + ' ';
        }
      }
      spoken += 'takes ' + file + rank; // No space between file and rank for natural speech
    } else {
      spoken += file + rank; // Remove "to" and space for cleaner pronunciation like "e4"
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

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
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

export function speak(text: string, rate: number = 0.9): Promise<void> {
  return new Promise(async (resolve) => {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported');
      resolve();
      return;
    }
    
    window.speechSynthesis.cancel();
    
    await new Promise(r => setTimeout(r, 50));
    
    const voices = await loadVoices();
    
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
    utterance.onerror = (e) => {
      console.error('Speech error:', e);
      resolve();
    };
    
    window.speechSynthesis.speak(utterance);
  });
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
      targetRank = RANK_NAMES[lowerWord];
    }
    
    if (['queen', 'rook', 'bishop', 'knight'].includes(lowerWord) && (input.includes('promote') || input.includes('equals'))) {
      promotion = PIECE_LETTERS[lowerWord] || 'Q';
    }
  }
  
  for (const word of words) {
    const match = word.match(/^([a-h])([1-8])$/i);
    if (match) {
      if (targetFile && targetRank) {
        sourceFile = targetFile;
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
      const moveSource = cleanMove.match(/^[KQRBN]?([a-h])?x?[a-h][1-8]/);
      if (moveSource && moveSource[1] && moveSource[1] !== sourceFile) {
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

export class VoiceRecognition {
  private recognition: SpeechRecognition | null = null;
  private isListening: boolean = false;
  private onResult: ((move: string | null, transcript: string) => void) | null = null;
  private onListeningChange: ((listening: boolean) => void) | null = null;
  private legalMoves: string[] = [];
  private restartTimeout: ReturnType<typeof setTimeout> | null = null;
  private shouldBeListening: boolean = false;
  private instanceId: number = 0;
  
  constructor() {
    this.setupRecognition();
  }
  
  private setupRecognition() {
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
      }
    }
  }
  
  private scheduleRestart() {
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
    }
    this.restartTimeout = setTimeout(() => {
      if (this.shouldBeListening && this.recognition && !this.isListening) {
        try {
          this.recognition.start();
        } catch (e) {
          console.log('Failed to restart recognition:', e);
        }
      }
    }, 500);
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
    if (!this.recognition) {
      console.warn('Speech recognition not supported');
      return;
    }
    
    this.shouldBeListening = true;
    
    if (!this.isListening) {
      try {
        this.recognition.start();
      } catch (e) {
        console.log('Recognition already started or error:', e);
      }
    }
  }
  
  stop() {
    this.shouldBeListening = false;
    this.instanceId++;
    
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    
    if (this.recognition && this.isListening) {
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
  
  reset() {
    this.stop();
    this.onResult = null;
    this.onListeningChange = null;
    this.legalMoves = [];
  }
  
  isSupported(): boolean {
    return this.recognition !== null;
  }
  
  getIsListening(): boolean {
    return this.isListening;
  }
}

export const voiceRecognition = new VoiceRecognition();
