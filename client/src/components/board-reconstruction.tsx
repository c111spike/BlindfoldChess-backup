import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, RotateCcw, Send, Mic, MicOff, Trash2 } from "lucide-react";
import { SpeechRecognition as CapacitorSpeechRecognition } from "@capacitor-community/speech-recognition";
import { Capacitor } from "@capacitor/core";
import { handleMicPermission, checkMicPermission, voiceRecognition, pulseHapticLight } from "@/lib/voice";

// Web Speech API types (local interface to avoid global conflicts)
interface WebSpeechRecognitionLocal {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

const PIECE_IMAGES: Record<string, string> = {
  'wK': '/pieces/wK.svg',
  'wQ': '/pieces/wQ.svg',
  'wR': '/pieces/wR.svg',
  'wB': '/pieces/wB.svg',
  'wN': '/pieces/wN.svg',
  'wP': '/pieces/wP.svg',
  'bK': '/pieces/bK.svg',
  'bQ': '/pieces/bQ.svg',
  'bR': '/pieces/bR.svg',
  'bB': '/pieces/bB.svg',
  'bN': '/pieces/bN.svg',
  'bP': '/pieces/bP.svg',
};

const ALL_PIECES = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];

const PIECE_NAMES: Record<string, string[]> = {
  'K': ['king'],
  'Q': ['queen'],
  'R': ['rook', 'castle'],
  'B': ['bishop'],
  'N': ['knight', 'horse'],
  'P': ['pawn'],
};

const FILE_PHONETICS: Record<string, string> = {
  'alpha': 'a', 'alfa': 'a',
  'bravo': 'b',
  'charlie': 'c',
  'delta': 'd',
  'echo': 'e',
  'foxtrot': 'f', 'fox': 'f',
  'golf': 'g',
  'hotel': 'h',
};

interface BoardReconstructionProps {
  actualFen: string;
  playerColor: 'white' | 'black';
  onComplete: (score: number, voicePurity: number, voiceInputs: number, touchInputs: number) => void;
  onSkip: () => void;
  onContinue?: () => void;
}

function fenToBoard(fen: string): (string | null)[][] {
  const board: (string | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
  const [position] = fen.split(' ');
  const rows = position.split('/');
  
  const pieceMap: Record<string, string> = {
    'K': 'wK', 'Q': 'wQ', 'R': 'wR', 'B': 'wB', 'N': 'wN', 'P': 'wP',
    'k': 'bK', 'q': 'bQ', 'r': 'bR', 'b': 'bB', 'n': 'bN', 'p': 'bP',
  };
  
  rows.forEach((row, rowIdx) => {
    let colIdx = 0;
    for (const char of row) {
      if (/\d/.test(char)) {
        colIdx += parseInt(char);
      } else if (pieceMap[char]) {
        board[rowIdx][colIdx] = pieceMap[char];
        colIdx++;
      }
    }
  });
  
  return board;
}

function calculateScore(userBoard: (string | null)[][], actualBoard: (string | null)[][]): number {
  let correct = 0;
  let total = 0;
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const actual = actualBoard[row][col];
      const user = userBoard[row][col];
      
      if (actual !== null) {
        total++;
        if (actual === user) {
          correct++;
        }
      }
    }
  }
  
  if (total === 0) return 100;
  return Math.round((correct / total) * 100);
}

function parseSquare(text: string): { file: string; rank: string } | null {
  const normalized = text.toLowerCase().trim();
  
  for (const [phonetic, file] of Object.entries(FILE_PHONETICS)) {
    if (normalized.includes(phonetic)) {
      const rankMatch = normalized.match(/[1-8]/);
      if (rankMatch) {
        return { file, rank: rankMatch[0] };
      }
    }
  }
  
  const directMatch = normalized.match(/([a-h])\s*([1-8])/);
  if (directMatch) {
    return { file: directMatch[1], rank: directMatch[2] };
  }
  
  return null;
}

function parsePieceType(text: string): string | null {
  const normalized = text.toLowerCase();
  
  for (const [piece, names] of Object.entries(PIECE_NAMES)) {
    for (const name of names) {
      if (normalized.includes(name)) {
        return piece;
      }
    }
  }
  
  return null;
}

function parseColor(text: string): 'w' | 'b' | null {
  const normalized = text.toLowerCase();
  if (normalized.includes('white')) return 'w';
  if (normalized.includes('black')) return 'b';
  return null;
}

type DisambiguationState = {
  type: 'color';
  pieceType: string;
  square: { file: string; rank: string };
} | null;

export function BoardReconstruction({ actualFen, playerColor, onComplete, onSkip, onContinue }: BoardReconstructionProps) {
  const [userBoard, setUserBoard] = useState<(string | null)[][]>(
    Array(8).fill(null).map(() => Array(8).fill(null))
  );
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [voicePurity, setVoicePurity] = useState<number>(100);
  
  const [isListening, setIsListening] = useState(false);
  const [disambiguation, setDisambiguation] = useState<DisambiguationState>(null);
  const [lastVoiceCommand, setLastVoiceCommand] = useState<string>('');
  
  const [draggedPiece, setDraggedPiece] = useState<string | null>(null);
  
  // Sticky color for hybrid voice/touch input - defaults to white
  const [stickyColor, setStickyColor] = useState<'w' | 'b'>('w');
  
  // Ref to avoid stale closure in voice command callback
  const stickyColorRef = useRef<'w' | 'b'>('w');
  
  // Track recently voice-placed squares for animation
  const [recentVoicePlacements, setRecentVoicePlacements] = useState<Set<string>>(new Set());
  
  const voicePlacementsRef = useRef(0);
  const touchPlacementsRef = useRef(0);
  const listenerRef = useRef<any>(null);
  const stateListenerRef = useRef<any>(null);
  const webRecognitionRef = useRef<WebSpeechRecognitionLocal | null>(null);
  const submitRef = useRef<(() => void) | null>(null);
  const shouldBeListeningRef = useRef(false);
  const isRestartingRef = useRef(false);
  // Android beep loop prevention
  const lastErrorTimeRef = useRef(0);
  const consecutiveFailuresRef = useRef(0);
  
  const actualBoard = fenToBoard(actualFen);
  
  // Keep ref in sync with state to avoid stale closures in voice callbacks
  useEffect(() => {
    stickyColorRef.current = stickyColor;
  }, [stickyColor]);
  
  const squareToIndices = useCallback((file: string, rank: string): { row: number; col: number } => {
    const col = file.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = 8 - parseInt(rank);
    return { row, col };
  }, []);
  
  const placePiece = useCallback((piece: string, row: number, col: number, isVoice: boolean) => {
    setUserBoard(prev => {
      const newBoard = prev.map(r => [...r]);
      newBoard[row][col] = piece;
      return newBoard;
    });
    
    // Update sticky color based on the piece color just placed
    const pieceColor = piece.charAt(0) as 'w' | 'b';
    setStickyColor(pieceColor);
    stickyColorRef.current = pieceColor;
    
    if (isVoice) {
      voicePlacementsRef.current++;
      // Track for animation - add square key and remove after animation
      const squareKey = `${row}-${col}`;
      setRecentVoicePlacements(prev => new Set(prev).add(squareKey));
      setTimeout(() => {
        setRecentVoicePlacements(prev => {
          const next = new Set(prev);
          next.delete(squareKey);
          return next;
        });
      }, 300);
    } else {
      touchPlacementsRef.current++;
    }
  }, []);
  
  const removePiece = useCallback((row: number, col: number, isVoice: boolean) => {
    setUserBoard(prev => {
      const newBoard = prev.map(r => [...r]);
      if (newBoard[row][col]) {
        if (isVoice) {
          voicePlacementsRef.current++;
        } else {
          touchPlacementsRef.current++;
        }
        newBoard[row][col] = null;
      }
      return newBoard;
    });
  }, []);
  
  const processVoiceCommand = useCallback((transcript: string) => {
    const normalized = transcript.toLowerCase().trim();
    setLastVoiceCommand(transcript);
    
    if (normalized.includes('clear all') || normalized.includes('reset board') || normalized.includes('reset')) {
      setUserBoard(Array(8).fill(null).map(() => Array(8).fill(null)));
      setDisambiguation(null);
      return;
    }
    
    if (normalized.includes('done') || normalized.includes('submit') || normalized.includes('check position')) {
      if (submitRef.current) {
        submitRef.current();
      }
      return;
    }
    
    // Handle color switching commands - "switch to white/black" or just "white/black"
    if (normalized === 'white' || normalized === 'switch to white' || normalized === 'white pieces') {
      setStickyColor('w');
      stickyColorRef.current = 'w';
      return;
    }
    if (normalized === 'black' || normalized === 'switch to black' || normalized === 'black pieces') {
      setStickyColor('b');
      stickyColorRef.current = 'b';
      return;
    }
    
    // Legacy disambiguation handling (still respond to color if user was in that state)
    if (disambiguation) {
      const color = parseColor(normalized);
      if (color) {
        const piece = color + disambiguation.pieceType;
        const { row, col } = squareToIndices(disambiguation.square.file, disambiguation.square.rank);
        placePiece(piece, row, col, true);
        setDisambiguation(null);
        return;
      }
    }
    
    if (normalized.includes('clear') || normalized.includes('remove') || normalized.includes('delete')) {
      const square = parseSquare(normalized);
      if (square) {
        const { row, col } = squareToIndices(square.file, square.rank);
        removePiece(row, col, true);
      }
      return;
    }
    
    const pieceType = parsePieceType(normalized);
    const square = parseSquare(normalized);
    const color = parseColor(normalized);
    
    // If a color is mentioned, update sticky color immediately (even in combined commands like "Black King E8")
    if (color) {
      setStickyColor(color);
      stickyColorRef.current = color;
    }
    
    if (pieceType && square) {
      // Use explicit color if provided, otherwise use sticky color from ref (avoids stale closure)
      const finalColor = color || stickyColorRef.current;
      const piece = finalColor + pieceType;
      const { row, col } = squareToIndices(square.file, square.rank);
      placePiece(piece, row, col, true);
      setDisambiguation(null);
    }
  }, [disambiguation, squareToIndices, placePiece, removePiece]);
  
  // Track the startup timeout for cleanup
  const startupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  
  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (startupTimeoutRef.current) {
        clearTimeout(startupTimeoutRef.current);
        startupTimeoutRef.current = null;
      }
    };
  }, []);
  
  const startListening = useCallback(async () => {
    if (submitted) return;
    shouldBeListeningRef.current = true;
    
    // Immediately update UI to show we're trying to listen
    // This lets the UI turn red before the heavy speech engine starts
    setIsListening(true);
    
    // Haptic feedback immediately on button press
    await pulseHapticLight();
    
    // Clear any previous startup timeout
    if (startupTimeoutRef.current) {
      clearTimeout(startupTimeoutRef.current);
    }
    
    // Use setTimeout to let the UI update before starting the speech engine
    startupTimeoutRef.current = setTimeout(async () => {
      if (!isMountedRef.current) return;
      
      try {
        // Use unified permission handler for both platforms
        const hasPermission = await handleMicPermission();
        if (!hasPermission) {
          console.warn('[Reconstruction] Microphone permission not granted');
          if (isMountedRef.current) setIsListening(false);
          // Check if permanently denied
          const status = await checkMicPermission();
          if (status === 'prompt-with-rationale') {
            alert("Voice control requires microphone access. Please enable it in your device Settings > Apps > Blindfold Chess > Permissions.");
          }
          return;
        }
        
        await startListeningInternal();
      } catch (e) {
        console.error('[Reconstruction] Failed to start listening:', e);
        if (isMountedRef.current) setIsListening(false);
      }
    }, 100);
  }, [submitted]);
  
  const startListeningInternal = useCallback(async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        // NATIVE: Use Capacitor SDK
        const { available } = await CapacitorSpeechRecognition.available();
        if (!available) {
          console.warn('[Reconstruction] Native speech not available');
          return;
        }
        
        // Stop the game's voice singleton first and wait for cleanup to complete
        try {
          await voiceRecognition.stopAndWait();
        } catch (e) {
          // Ignore - may not be running
        }
        
        // Defensively stop any lingering Capacitor session
        try {
          await CapacitorSpeechRecognition.stop();
          // Wait for native layer to fully release the microphone
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (e) {
          // Ignore - may not be listening
        }
        
        // Only add listeners once - check if they're already set up
        if (!listenerRef.current) {
          listenerRef.current = await CapacitorSpeechRecognition.addListener('partialResults', (data: any) => {
            if (data.matches && data.matches.length > 0 && shouldBeListeningRef.current) {
              processVoiceCommand(data.matches[0]);
            }
          });
        }
        
        // Add listener for when native speech ends - auto-restart for continuous listening
        if (!stateListenerRef.current) {
          stateListenerRef.current = await CapacitorSpeechRecognition.addListener('listeningState', async (state: any) => {
            if (state.status === 'stopped' && shouldBeListeningRef.current && !isRestartingRef.current) {
              // 3-second lockout: If last error was within 3 seconds, wait longer
              const now = Date.now();
              const timeSinceLastError = now - lastErrorTimeRef.current;
              if (timeSinceLastError < 3000 && lastErrorTimeRef.current > 0) {
                console.log(`[Reconstruction] Lockout active: ${3000 - timeSinceLastError}ms remaining`);
                return;
              }
              
              // Check consecutive failures - stop after 3
              if (consecutiveFailuresRef.current >= 3) {
                console.log('[Reconstruction] Too many failures, mic busy');
                setIsListening(false);
                return;
              }
              
              // Auto-restart after a brief pause with guard against double-restart
              isRestartingRef.current = true;
              setTimeout(async () => {
                if (shouldBeListeningRef.current && consecutiveFailuresRef.current < 3) {
                  try {
                    await CapacitorSpeechRecognition.start({
                      language: 'en-US',
                      partialResults: true,
                      popup: false,
                    });
                    setIsListening(true);
                    consecutiveFailuresRef.current = 0; // Reset on success
                    console.log('[Reconstruction] Native speech auto-restarted');
                    // Haptic pulse on successful restart
                    try {
                      const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
                      await Haptics.impact({ style: ImpactStyle.Light });
                    } catch (e) {}
                  } catch (e) {
                    // Track failure
                    lastErrorTimeRef.current = Date.now();
                    consecutiveFailuresRef.current++;
                    console.log('[Reconstruction] Auto-restart failed:', e, 'Failures:', consecutiveFailuresRef.current);
                  }
                }
                isRestartingRef.current = false;
              }, 3000); // Use 3-second delay to prevent beep loop
            }
          });
        }
        
        await CapacitorSpeechRecognition.start({
          language: 'en-US',
          partialResults: true,
          popup: false,
        });
        
        setIsListening(true);
        console.log('[Reconstruction] Native speech started (continuous mode)');
      } else {
        // WEB: Use Web Speech API for browser testing
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognitionAPI) {
          console.warn('[Reconstruction] Speech Recognition not supported in this browser');
          return;
        }
        
        if (!webRecognitionRef.current) {
          const recognition = new SpeechRecognitionAPI();
          recognition.continuous = true;
          recognition.interimResults = false;
          recognition.lang = 'en-US';
          
          recognition.onresult = (event: any) => {
            const lastResult = event.results[event.results.length - 1];
            if (lastResult.isFinal && shouldBeListeningRef.current) {
              const transcript = lastResult[0].transcript;
              console.log('[Reconstruction Web] Transcript:', transcript);
              processVoiceCommand(transcript);
            }
          };
          
          recognition.onerror = (event: any) => {
            console.log('[Reconstruction Web] Error:', event.error);
            // Don't restart on 'aborted' (explicit stop) - all other errors should trigger restart
            if (event.error !== 'aborted') {
              // Auto-restart on recoverable errors - check shouldBeListening inside timeout
              setTimeout(() => {
                if (shouldBeListeningRef.current && webRecognitionRef.current) {
                  try {
                    webRecognitionRef.current.start();
                    console.log('[Reconstruction Web] Auto-restarted after error');
                  } catch (e) {
                    // Already started
                  }
                }
              }, 300);
            }
          };
          
          recognition.onend = () => {
            console.log('[Reconstruction Web] Recognition ended, shouldBeListening:', shouldBeListeningRef.current);
            // Auto-restart if should still be listening - check inside timeout
            // Don't set isListening to false here since we'll restart immediately
            setTimeout(() => {
              if (shouldBeListeningRef.current && webRecognitionRef.current) {
                try {
                  webRecognitionRef.current.start();
                  setIsListening(true);
                  console.log('[Reconstruction Web] Auto-restarted');
                } catch (e) {
                  // Already started - this is fine
                  console.log('[Reconstruction Web] Already started or error:', e);
                }
              } else {
                setIsListening(false);
              }
            }, 200);
          };
          
          recognition.onstart = () => {
            setIsListening(true);
          };
          
          webRecognitionRef.current = recognition;
        }
        
        // Stop the game's voice singleton first for web mode too
        try {
          await voiceRecognition.stopAndWait();
        } catch (e) {
          // Ignore - may not be running
        }
        
        // Defensively stop any existing session first
        try {
          webRecognitionRef.current.stop();
        } catch (e) {
          // Ignore - may not be running
        }
        
        try {
          webRecognitionRef.current.start();
          setIsListening(true);
          console.log('[Reconstruction] Web speech started');
        } catch (e) {
          console.log('[Reconstruction] Web speech already running');
        }
      }
    } catch (e) {
      console.error('[Reconstruction] Speech recognition error:', e);
      setIsListening(false);
    }
  }, [processVoiceCommand]);
  
  const stopListening = useCallback(async () => {
    shouldBeListeningRef.current = false;
    isRestartingRef.current = false;
    
    try {
      if (Capacitor.isNativePlatform()) {
        // NATIVE: Stop Capacitor SDK
        await CapacitorSpeechRecognition.stop();
        if (listenerRef.current) {
          await listenerRef.current.remove();
          listenerRef.current = null;
        }
        if (stateListenerRef.current) {
          await stateListenerRef.current.remove();
          stateListenerRef.current = null;
        }
      } else {
        // WEB: Stop Web Speech API
        if (webRecognitionRef.current) {
          webRecognitionRef.current.stop();
        }
      }
      setIsListening(false);
      setDisambiguation(null);
    } catch (e) {
      console.error('[Reconstruction] Stop listening error:', e);
    }
  }, []);
  
  useEffect(() => {
    return () => {
      if (isListening) {
        stopListening();
      }
    };
  }, [isListening, stopListening]);
  
  // Auto-start voice recognition when component mounts (both native and web)
  const hasAutoStartedRef = useRef(false);
  useEffect(() => {
    if (!submitted && !hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true;
      // Small delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        startListening();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [submitted, startListening]);

  const handleSquareClick = useCallback((row: number, col: number) => {
    if (submitted) return;
    
    if (selectedPiece) {
      placePiece(selectedPiece, row, col, false);
    } else if (userBoard[row][col]) {
      removePiece(row, col, false);
    }
  }, [selectedPiece, userBoard, submitted, placePiece, removePiece]);
  
  const handleDragStart = useCallback((e: React.DragEvent, piece: string) => {
    if (submitted) return;
    e.dataTransfer.setData('piece', piece);
    e.dataTransfer.effectAllowed = 'copy';
    setDraggedPiece(piece);
  }, [submitted]);
  
  const handleDragEnd = useCallback(() => {
    setDraggedPiece(null);
  }, []);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent, row: number, col: number) => {
    e.preventDefault();
    if (submitted) return;
    
    const piece = e.dataTransfer.getData('piece');
    if (piece) {
      placePiece(piece, row, col, false);
    }
    setDraggedPiece(null);
  }, [submitted, placePiece]);
  
  const handleTouchStart = useCallback((e: React.TouchEvent, piece: string) => {
    if (submitted) return;
    setSelectedPiece(piece);
  }, [submitted]);
  
  const handleReset = () => {
    setUserBoard(Array(8).fill(null).map(() => Array(8).fill(null)));
    setSelectedPiece(null);
    voicePlacementsRef.current = 0;
    touchPlacementsRef.current = 0;
  };
  
  const handleSubmit = useCallback(() => {
    const calculatedScore = calculateScore(userBoard, actualBoard);
    setScore(calculatedScore);
    
    const totalPlacements = voicePlacementsRef.current + touchPlacementsRef.current;
    const purity = totalPlacements > 0 
      ? Math.round((voicePlacementsRef.current / totalPlacements) * 100)
      : 0;
    setVoicePurity(purity);
    
    setSubmitted(true);
    stopListening();
    onComplete(calculatedScore, purity, voicePlacementsRef.current, touchPlacementsRef.current);
  }, [userBoard, actualBoard, stopListening, onComplete]);
  
  useEffect(() => {
    submitRef.current = handleSubmit;
  }, [handleSubmit]);
  
  const files = playerColor === "white" 
    ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'];
  const ranks = playerColor === "white"
    ? ['8', '7', '6', '5', '4', '3', '2', '1']
    : ['1', '2', '3', '4', '5', '6', '7', '8'];
  
  const disambiguationBorderClass = disambiguation?.type === 'color' 
    ? 'animate-pulse ring-4 ring-amber-400' 
    : '';
  
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Reconstruct the Board</span>
          <div className="flex items-center gap-2">
            {score !== null && (
              <Badge variant={score >= 80 ? "default" : score >= 50 ? "secondary" : "destructive"}>
                {score}%
              </Badge>
            )}
            {submitted && voicePurity > 0 && (
              <Badge variant="outline" className="text-amber-600 border-amber-400">
                Voice: {voicePurity}%
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!submitted && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                {disambiguation 
                  ? `Say "White" or "Black" for ${disambiguation.pieceType === 'K' ? 'King' : disambiguation.pieceType === 'Q' ? 'Queen' : disambiguation.pieceType === 'R' ? 'Rook' : disambiguation.pieceType === 'B' ? 'Bishop' : disambiguation.pieceType === 'N' ? 'Knight' : 'Pawn'} on ${disambiguation.square.file}${disambiguation.square.rank}`
                  : isListening 
                    ? `"${lastVoiceCommand || 'Knight f3'}"` 
                    : 'Drag pieces or use voice commands'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {/* Sticky color indicator - shows which color next voice command will use */}
              <button
                onClick={() => setStickyColor(prev => prev === 'w' ? 'b' : 'w')}
                className={`w-7 h-7 rounded flex items-center justify-center transition-all border-2 ${
                  stickyColor === 'w' 
                    ? 'bg-white border-stone-400' 
                    : 'bg-stone-800 border-stone-600'
                }`}
                title={`Placing ${stickyColor === 'w' ? 'White' : 'Black'} pieces - tap to switch`}
                data-testid="button-sticky-color"
              >
                <span className={`text-xs font-bold ${stickyColor === 'w' ? 'text-stone-800' : 'text-white'}`}>
                  {stickyColor === 'w' ? 'W' : 'B'}
                </span>
              </button>
              <Button
                size="icon"
                variant={isListening ? "destructive" : "outline"}
                onClick={isListening ? stopListening : startListening}
                className={isListening ? "animate-pulse" : ""}
                data-testid="button-reconstruction-mic"
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}
        
        <div 
          className="flex flex-wrap gap-1 justify-center p-2 bg-muted rounded-md"
          style={{ touchAction: 'none' }}
        >
          {ALL_PIECES.map(piece => (
            <div
              key={piece}
              draggable={!submitted}
              onDragStart={(e) => handleDragStart(e, piece)}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => handleTouchStart(e, piece)}
              onClick={() => !submitted && setSelectedPiece(selectedPiece === piece ? null : piece)}
              className={`w-8 h-8 rounded transition-all cursor-grab active:cursor-grabbing ${
                selectedPiece === piece 
                  ? 'ring-2 ring-amber-400 bg-amber-100' 
                  : draggedPiece === piece
                    ? 'opacity-50'
                    : 'hover:bg-muted-foreground/20'
              } ${submitted ? 'opacity-50 cursor-not-allowed' : ''}`}
              data-testid={`piece-palette-${piece}`}
            >
              <img 
                src={PIECE_IMAGES[piece]} 
                alt={piece} 
                className="w-full h-full pointer-events-none" 
                draggable={false}
              />
            </div>
          ))}
          <div
            className="w-8 h-8 rounded flex items-center justify-center bg-red-100 hover:bg-red-200 cursor-pointer"
            onClick={() => setSelectedPiece(null)}
            data-testid="piece-palette-eraser"
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </div>
        </div>
        
        <div className={`aspect-square w-full max-w-xs mx-auto rounded ${disambiguationBorderClass}`}>
          <div 
            className="grid grid-cols-8 grid-rows-8 w-full h-full border border-stone-400"
            style={{ touchAction: 'none' }}
          >
            {Array.from({ length: 64 }).map((_, i) => {
              const displayRow = Math.floor(i / 8);
              const displayCol = i % 8;
              const boardRow = playerColor === "white" ? displayRow : 7 - displayRow;
              const boardCol = playerColor === "white" ? displayCol : 7 - displayCol;
              
              const isLight = (displayRow + displayCol) % 2 === 0;
              const userPiece = userBoard[boardRow][boardCol];
              const actualPiece = actualBoard[boardRow][boardCol];
              const squareKey = `${boardRow}-${boardCol}`;
              const isRecentVoicePlacement = recentVoicePlacements.has(squareKey);
              
              let squareClass = isLight ? 'bg-amber-100' : 'bg-amber-700';
              let indicator = null;
              
              // Determine if this square has an error
              const isCorrect = userPiece === actualPiece;
              const isMissed = !userPiece && actualPiece; // User missed a piece
              const isWrong = userPiece && userPiece !== actualPiece; // User placed wrong or no piece should be here
              
              if (submitted) {
                if (isCorrect) {
                  if (userPiece !== null) {
                    squareClass = isLight ? 'bg-green-200' : 'bg-green-600';
                  }
                } else {
                  squareClass = isLight ? 'bg-red-200' : 'bg-red-500';
                }
              }
              
              return (
                <div
                  key={i}
                  onClick={() => handleSquareClick(boardRow, boardCol)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, boardRow, boardCol)}
                  className={`relative flex items-center justify-center cursor-pointer ${squareClass} ${
                    !submitted && (selectedPiece || draggedPiece) ? 'hover:ring-2 hover:ring-amber-400 hover:ring-inset' : ''
                  }`}
                  style={{ touchAction: 'none' }}
                  data-testid={`reconstruction-square-${files[displayCol]}${ranks[displayRow]}`}
                >
                  {/* Ghost piece showing actual position at 30% opacity */}
                  {submitted && actualPiece && !isCorrect && (
                    <img 
                      src={PIECE_IMAGES[actualPiece]} 
                      alt={`actual-${actualPiece}`} 
                      className="absolute w-[85%] h-[85%] opacity-30 pointer-events-none" 
                      draggable={false}
                    />
                  )}
                  
                  {/* User's piece - animate pop for voice placement, shake if wrong on submit */}
                  {userPiece && (
                    <img 
                      src={PIECE_IMAGES[userPiece]} 
                      alt={userPiece} 
                      className={`w-[85%] h-[85%] pointer-events-none z-10 transition-transform ${
                        isRecentVoicePlacement ? 'animate-[voicePop_0.2s_ease-out]' : ''
                      } ${submitted && !isCorrect ? 'animate-[shake_0.5s_ease-in-out]' : ''}`} 
                      draggable={false}
                    />
                  )}
                  
                  {/* Error indicator with sliding animation for missed pieces */}
                  {submitted && isMissed && (
                    <div 
                      className="absolute inset-0 flex items-center justify-center animate-[fadeSlideIn_0.6s_ease-out_forwards]"
                      style={{ animationDelay: `${(boardRow * 8 + boardCol) * 30}ms` }}
                    >
                      <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                    </div>
                  )}
                  {displayCol === 0 && (
                    <span className="absolute top-0.5 left-0.5 text-[8px] font-semibold select-none opacity-70">
                      {ranks[displayRow]}
                    </span>
                  )}
                  {displayRow === 7 && (
                    <span className="absolute bottom-0.5 right-0.5 text-[8px] font-semibold select-none opacity-70">
                      {files[displayCol]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="flex gap-2">
          {!submitted ? (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleReset}
                className="flex-1"
                data-testid="button-reconstruction-reset"
              >
                <RotateCcw className="mr-1 h-4 w-4" />
                Reset
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => { stopListening(); onSkip(); }}
                className="flex-1"
                data-testid="button-reconstruction-skip"
              >
                Skip
              </Button>
              <Button 
                size="sm" 
                onClick={handleSubmit}
                className="flex-1 bg-amber-400 hover:bg-amber-500 text-stone-900"
                data-testid="button-reconstruction-submit"
              >
                <Send className="mr-1 h-4 w-4" />
                Check
              </Button>
            </>
          ) : (
            <Button 
              size="sm" 
              onClick={onContinue || onSkip}
              className="w-full bg-amber-400 hover:bg-amber-500 text-stone-900"
              data-testid="button-reconstruction-continue"
            >
              Continue
            </Button>
          )}
        </div>
        
        {submitted && (
          <div className="text-center text-sm">
            {score !== null && score >= 80 ? (
              <p className="text-green-600 flex items-center justify-center gap-1">
                <Check className="h-4 w-4" /> Excellent memory!
              </p>
            ) : score !== null && score >= 50 ? (
              <p className="text-amber-600">Good effort! Keep practicing.</p>
            ) : (
              <p className="text-red-600 flex items-center justify-center gap-1">
                <X className="h-4 w-4" /> Keep training your visualization!
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
