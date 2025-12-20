import { useState, useEffect, useCallback, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications } from "@/hooks/useNotifications";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Play,
  RotateCcw,
  Undo2,
  Redo2,
  Trophy,
  Clock,
  Target,
  CheckCircle,
  ChevronDown,
  Sparkles,
  Settings,
  Home,
  Menu,
} from "lucide-react";
import { useLocation } from "wouter";
import {
  PieceType,
  BoardSize,
  Position,
  BOARD_SIZES,
  PIECE_NAMES,
  PIECE_SYMBOLS,
  MAX_PIECES,
  SOLUTION_COUNTS,
  MAX_TRACKABLE_SOLUTIONS,
  getTrackableSolutionCount,
  isAttacking,
  getAttackSquares,
  isValidSolution,
  positionsToCanonical,
  canonicalToPositions,
  hasConflicts,
  getConflictingPieces,
} from "@shared/nPieceChallengeData";
import type { NPieceChallengeProgress, NPieceChallengeSolution } from "@shared/schema";

const PIECE_TYPES: PieceType[] = ["rook", "knight", "bishop", "queen", "king"];

export default function NPieceChallenge() {
  const { toast } = useNotifications();
  const [, setLocation] = useLocation();
  
  // Game configuration
  const [pieceType, setPieceType] = useState<PieceType>("queen");
  const [boardSize, setBoardSize] = useState<BoardSize>(8);
  
  // Game state
  const [gameStarted, setGameStarted] = useState(false);
  const [pieces, setPieces] = useState<Position[]>([]);
  const [selectedPiece, setSelectedPiece] = useState<Position | null>(null);
  const [history, setHistory] = useState<Position[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Timer
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isSolved, setIsSolved] = useState(false);
  const [solveTime, setSolveTime] = useState<number | null>(null);
  
  // Solution browser
  const [showSolutionBrowser, setShowSolutionBrowser] = useState(false);
  const [viewingSolution, setViewingSolution] = useState<number | null>(null);
  
  // Mobile sidebar
  const [mobileInfoOpen, setMobileInfoOpen] = useState(false);
  
  // Derived values
  const maxPieces = MAX_PIECES[pieceType][boardSize];
  const totalSolutions = SOLUTION_COUNTS[pieceType][boardSize];
  const trackableSolutions = getTrackableSolutionCount(pieceType, boardSize);
  
  // Fetch user progress (always fetch when piece type or board size changes)
  const { data: progressData } = useQuery<{
    progress: NPieceChallengeProgress | null;
    solutions: NPieceChallengeSolution[];
    overallProgress: { total: number; found: number };
  }>({
    queryKey: ["/api/n-piece-challenge/progress", pieceType, boardSize],
  });
  
  const progress = progressData?.progress;
  const userSolutions = progressData?.solutions || [];
  const overallProgress = progressData?.overallProgress || { total: 0, found: 0 };
  
  // Save solution mutation
  const saveSolutionMutation = useMutation({
    mutationFn: async (data: {
      pieceType: PieceType;
      boardSize: BoardSize;
      positions: string;
      solveTime: number;
    }): Promise<{ isNew: boolean; solutionIndex: number }> => {
      const response = await apiRequest("POST", "/api/n-piece-challenge/solution", data);
      return await response.json();
    },
    onSuccess: (data: { isNew: boolean; solutionIndex: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/n-piece-challenge/progress"] });
      if (data.isNew) {
        toast({
          title: "New Solution Found!",
          description: `You discovered solution #${data.solutionIndex + 1}!`,
        });
      } else {
        toast({
          title: "Solution Already Found",
          description: `This was solution #${data.solutionIndex + 1}.`,
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save solution",
        variant: "destructive",
      });
    },
  });
  
  // Timer effect
  useEffect(() => {
    if (!gameStarted || isSolved || !startTime) return;
    
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 100);
    
    return () => clearInterval(interval);
  }, [gameStarted, isSolved, startTime]);
  
  // Check for solution
  useEffect(() => {
    if (!gameStarted || isSolved) return;
    
    if (isValidSolution(pieceType, pieces, boardSize)) {
      const time = Date.now() - (startTime || Date.now());
      setIsSolved(true);
      setSolveTime(time);
      
      // Save the solution
      const canonical = positionsToCanonical(pieces);
      saveSolutionMutation.mutate({
        pieceType,
        boardSize,
        positions: canonical,
        solveTime: time,
      });
    }
  }, [pieces, gameStarted, isSolved, pieceType, boardSize, startTime]);
  
  // Start game
  const handleStartGame = () => {
    setPieces([]);
    setSelectedPiece(null);
    setHistory([[]]);
    setHistoryIndex(0);
    setStartTime(Date.now());
    setElapsedTime(0);
    setIsSolved(false);
    setSolveTime(null);
    setViewingSolution(null);
    setGameStarted(true);
  };
  
  // Reset current game
  const handleReset = () => {
    setPieces([]);
    setSelectedPiece(null);
    setHistory([[]]);
    setHistoryIndex(0);
    setStartTime(Date.now());
    setElapsedTime(0);
    setIsSolved(false);
    setSolveTime(null);
    setViewingSolution(null);
  };
  
  // Play again with same settings
  const handlePlayAgain = () => {
    setPieces([]);
    setSelectedPiece(null);
    setHistory([[]]);
    setHistoryIndex(0);
    setStartTime(Date.now());
    setElapsedTime(0);
    setIsSolved(false);
    setSolveTime(null);
    setViewingSolution(null);
  };
  
  // Go back to configuration to change difficulty
  const handleChangeDifficulty = () => {
    setGameStarted(false);
    setPieces([]);
    setSelectedPiece(null);
    setHistory([[]]);
    setHistoryIndex(0);
    setStartTime(null);
    setElapsedTime(0);
    setIsSolved(false);
    setSolveTime(null);
    setViewingSolution(null);
  };
  
  // Go to main dashboard
  const handleMainMenu = () => {
    setLocation("/");
  };
  
  // Add to history
  const addToHistory = useCallback((newPieces: Position[]) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push([...newPieces]);
      return newHistory;
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);
  
  // Undo
  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      setPieces([...history[historyIndex - 1]]);
      setSelectedPiece(null);
      setIsSolved(false);
      setSolveTime(null);
    }
  };
  
  // Redo
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      setPieces([...history[historyIndex + 1]]);
      setSelectedPiece(null);
    }
  };
  
  // Handle square click
  const handleSquareClick = (row: number, col: number) => {
    if (isSolved || viewingSolution !== null) return;
    
    const clickedPos = { row, col };
    const existingPieceIndex = pieces.findIndex(
      p => p.row === row && p.col === col
    );
    
    if (existingPieceIndex !== -1) {
      // Clicked on existing piece - toggle selection to show/hide attacks
      if (selectedPiece?.row === row && selectedPiece?.col === col) {
        setSelectedPiece(null);
      } else {
        setSelectedPiece(clickedPos);
      }
    } else {
      // Empty square - place a piece if we haven't reached max
      if (pieces.length < maxPieces) {
        const newPieces = [...pieces, clickedPos];
        setPieces(newPieces);
        addToHistory(newPieces);
        setSelectedPiece(null); // Clear any selection when placing
      }
    }
  };
  
  // Remove piece
  const handleRemovePiece = (row: number, col: number) => {
    if (isSolved || viewingSolution !== null) return;
    
    const newPieces = pieces.filter(p => p.row !== row || p.col !== col);
    setPieces(newPieces);
    addToHistory(newPieces);
    setSelectedPiece(null);
  };
  
  // View a solved solution
  const handleViewSolution = (solutionIndex: number) => {
    const solution = userSolutions.find(s => s.solutionIndex === solutionIndex);
    if (solution) {
      setViewingSolution(solutionIndex);
      setPieces(canonicalToPositions(solution.positions));
      setSelectedPiece(null);
    }
    setShowSolutionBrowser(false);
  };
  
  // Exit solution viewing
  const handleExitSolutionView = () => {
    setViewingSolution(null);
    handleReset();
  };
  
  // Format time
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}.${tenths}`;
  };
  
  // Get attack highlights for selected piece
  const attackSquares = selectedPiece
    ? getAttackSquares(pieceType, selectedPiece, boardSize)
    : [];
  
  // Get conflicting pieces
  const conflictingPieces = getConflictingPieces(pieceType, pieces);
  
  // Calculate overall progress percentage
  const overallProgressPercent = overallProgress.total > 0
    ? (overallProgress.found / overallProgress.total) * 100
    : 0;
  
  // Render the board
  const renderBoard = () => {
    const squares = [];
    const displayPieces = viewingSolution !== null ? pieces : pieces;
    
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        const isLight = (row + col) % 2 === 0;
        const piece = displayPieces.find(p => p.row === row && p.col === col);
        const isSelected = selectedPiece?.row === row && selectedPiece?.col === col;
        const isAttacked = attackSquares.some(a => a.row === row && a.col === col);
        const isConflicting = conflictingPieces.has(`${row},${col}`);
        
        let bgColor = isLight ? "bg-amber-100 dark:bg-amber-900/40" : "bg-amber-700 dark:bg-amber-800";
        if (isSelected) {
          bgColor = "bg-blue-400 dark:bg-blue-600";
        } else if (isAttacked) {
          bgColor = "bg-red-300 dark:bg-red-700/60";
        }
        
        squares.push(
          <div
            key={`${row}-${col}`}
            className={`
              ${bgColor}
              flex items-center justify-center
              cursor-pointer
              transition-colors
              relative
              aspect-square
            `}
            onClick={() => handleSquareClick(row, col)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (piece) handleRemovePiece(row, col);
            }}
            data-testid={`square-${row}-${col}`}
          >
            {piece && (
              <span 
                className={`text-2xl sm:text-3xl md:text-4xl select-none ${
                  isConflicting ? "text-red-600 dark:text-red-400" : "text-gray-800 dark:text-gray-200"
                }`}
              >
                {PIECE_SYMBOLS[pieceType]}
              </span>
            )}
          </div>
        );
      }
    }
    
    return (
      <div 
        className="grid gap-0 border-2 border-amber-900 dark:border-amber-700 rounded-sm"
        style={{ 
          gridTemplateColumns: `repeat(${boardSize}, 1fr)`,
          width: "min(500px, 90vw)",
          aspectRatio: "1 / 1",
        }}
        data-testid="game-board"
      >
        {squares}
      </div>
    );
  };
  
  return (
    <div className="h-full flex">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="flex-1 flex items-center justify-center p-4 bg-muted/30 overflow-auto">
        <div className="w-full max-w-2xl space-y-4">
          <div>
            <h1 className="text-2xl font-bold" data-testid="heading-n-piece-challenge">N-Piece Challenge</h1>
            <p className="text-sm text-muted-foreground">
              Place {maxPieces} {PIECE_NAMES[pieceType].toLowerCase()}s without any attacking each other
            </p>
          </div>
          
          {!gameStarted ? (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-xl font-semibold">Configure Challenge</h2>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Piece Type</label>
                    <Select 
                      value={pieceType} 
                      onValueChange={(v) => setPieceType(v as PieceType)}
                    >
                      <SelectTrigger data-testid="select-piece-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PIECE_TYPES.map(type => (
                          <SelectItem key={type} value={type}>
                            <span className="flex items-center gap-2">
                              <span>{PIECE_SYMBOLS[type]}</span>
                              <span>{PIECE_NAMES[type]}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Board Size</label>
                    <Select 
                      value={boardSize.toString()} 
                      onValueChange={(v) => setBoardSize(parseInt(v) as BoardSize)}
                    >
                      <SelectTrigger data-testid="select-board-size">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BOARD_SIZES.map(size => (
                          <SelectItem key={size} value={size.toString()}>
                            {size} x {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <Card className="bg-muted/50">
                  <CardContent className="pt-4 pb-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Max Pieces:</span>
                        <span className="ml-2 font-semibold">{maxPieces}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total Solutions:</span>
                        <span className="ml-2 font-semibold">
                          {totalSolutions > MAX_TRACKABLE_SOLUTIONS 
                            ? `${MAX_TRACKABLE_SOLUTIONS}+` 
                            : totalSolutions.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Button 
                  onClick={handleStartGame} 
                  className="w-full" 
                  size="lg"
                  data-testid="button-start-challenge"
                >
                  <Play className="mr-2 h-5 w-5" />
                  Start Challenge
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Game header */}
              <Card>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        <span className="font-medium">
                          {pieces.length} / {maxPieces}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono" data-testid="text-timer">
                          {formatTime(isSolved && solveTime ? solveTime : elapsedTime)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleUndo}
                        disabled={historyIndex <= 0 || viewingSolution !== null}
                        data-testid="button-undo"
                      >
                        <Undo2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleRedo}
                        disabled={historyIndex >= history.length - 1 || viewingSolution !== null}
                        data-testid="button-redo"
                      >
                        <Redo2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReset}
                        disabled={viewingSolution !== null}
                        data-testid="button-reset"
                      >
                        <RotateCcw className="mr-1 h-4 w-4" />
                        Reset
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Solution found banner */}
              {isSolved && (
                <Card className="border-green-500 bg-green-500/10">
                  <CardContent className="py-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <Trophy className="h-6 w-6 text-green-500" />
                      <div>
                        <p className="font-semibold text-green-700 dark:text-green-400">
                          Solution Found!
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Time: {formatTime(solveTime || 0)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button
                        onClick={handlePlayAgain}
                        className="gap-2"
                        data-testid="button-play-again"
                      >
                        <Play className="w-4 h-4" />
                        Play Again
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleChangeDifficulty}
                        className="gap-2"
                        data-testid="button-change-difficulty"
                      >
                        <Settings className="w-4 h-4" />
                        Change Difficulty
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleMainMenu}
                        className="gap-2"
                        data-testid="button-main-menu"
                      >
                        <Home className="w-4 h-4" />
                        Main Menu
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Viewing solution banner */}
              {viewingSolution !== null && (
                <Card className="border-blue-500 bg-blue-500/10">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-6 w-6 text-blue-500" />
                        <p className="font-semibold">
                          Viewing Solution #{viewingSolution + 1}
                        </p>
                      </div>
                      <Button
                        onClick={handleExitSolutionView}
                        variant="outline"
                        data-testid="button-exit-view"
                      >
                        Continue Playing
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Board */}
              <div className="flex justify-center">
                {renderBoard()}
              </div>
              
              <p className="text-xs text-center text-muted-foreground">
                Click to place • Click piece to show attacks • Right-click to remove
              </p>
            </>
          )}
        </div>
      </div>
      
      {/* Mobile Info Button - shows on small screens when game is started */}
      {gameStarted && (
        <div className="fixed bottom-4 right-4 md:hidden z-50">
          <Sheet open={mobileInfoOpen} onOpenChange={setMobileInfoOpen}>
            <SheetTrigger asChild>
              <Button 
                size="lg" 
                className="rounded-full shadow-lg h-14 w-14"
                data-testid="button-mobile-info"
              >
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <SheetHeader className="p-3 border-b">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{PIECE_SYMBOLS[pieceType]}</span>
                  <div>
                    <SheetTitle>{PIECE_NAMES[pieceType]} Challenge</SheetTitle>
                    <p className="text-xs text-muted-foreground">{boardSize}x{boardSize} board</p>
                  </div>
                </div>
              </SheetHeader>
              
              {/* Solutions Browser */}
              <div className="p-3 border-b">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full justify-between"
                      data-testid="button-solutions-browser-mobile"
                    >
                      <span>
                        {progress?.solutionsFound || 0} of {trackableSolutions} solutions
                      </span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-64 max-h-80">
                    <ScrollArea className="h-72">
                      {Array.from({ length: trackableSolutions }, (_, i) => {
                        const isSolvedSolution = userSolutions.some(s => s.solutionIndex === i);
                        return (
                          <DropdownMenuItem
                            key={i}
                            disabled={!isSolvedSolution}
                            onClick={() => {
                              if (isSolvedSolution) {
                                handleViewSolution(i);
                                setMobileInfoOpen(false);
                              }
                            }}
                            className="flex items-center justify-between"
                          >
                            <span>Solution {i + 1}</span>
                            {isSolvedSolution && (
                              <Badge variant="secondary" className="ml-2">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                solved
                              </Badge>
                            )}
                          </DropdownMenuItem>
                        );
                      })}
                    </ScrollArea>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              {/* Personal Best */}
              {progress?.bestTime && (
                <div className="p-3 border-b">
                  <h4 className="text-sm font-medium mb-1">Personal Best</h4>
                  <p className="text-lg font-mono text-primary">
                    {formatTime(progress.bestTime)}
                  </p>
                </div>
              )}
              
              {/* Overall Progress */}
              <div className="p-3 border-b">
                <h4 className="text-sm font-medium mb-2">Overall Progress</h4>
                <Progress value={overallProgressPercent} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {overallProgress.found} / {overallProgress.total} solutions across all challenges
                </p>
              </div>
              
              {/* Rules */}
              <div className="p-3 flex-1">
                <h4 className="text-xs font-semibold mb-2">Rules</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>Place {maxPieces} {PIECE_NAMES[pieceType].toLowerCase()}s</li>
                  <li>No piece can attack another</li>
                  <li>Red pieces are in conflict</li>
                  <li>Click a piece to see its attacks</li>
                </ul>
              </div>
              
              {/* Back to menu */}
              <div className="p-3 border-t">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setGameStarted(false);
                    setViewingSolution(null);
                    setMobileInfoOpen(false);
                  }}
                  data-testid="button-back-to-menu-mobile"
                >
                  Back to Menu
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}
      
      {/* Desktop Sidebar - hidden on mobile */}
      {gameStarted && (
        <div className="hidden md:flex w-72 border-l bg-card flex-col">
          <div className="p-3 border-b">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{PIECE_SYMBOLS[pieceType]}</span>
              <div>
                <h3 className="font-semibold">{PIECE_NAMES[pieceType]} Challenge</h3>
                <p className="text-xs text-muted-foreground">{boardSize}x{boardSize} board</p>
              </div>
            </div>
          </div>
          
          {/* Solutions Browser */}
          <div className="p-3 border-b">
            <DropdownMenu open={showSolutionBrowser} onOpenChange={setShowSolutionBrowser}>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-between"
                  data-testid="button-solutions-browser"
                >
                  <span>
                    {progress?.solutionsFound || 0} of {trackableSolutions} solutions
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 max-h-80">
                <ScrollArea className="h-72">
                  {Array.from({ length: trackableSolutions }, (_, i) => {
                    const isSolvedSolution = userSolutions.some(s => s.solutionIndex === i);
                    return (
                      <DropdownMenuItem
                        key={i}
                        disabled={!isSolvedSolution}
                        onClick={() => isSolvedSolution && handleViewSolution(i)}
                        className="flex items-center justify-between"
                        data-testid={`solution-item-${i}`}
                      >
                        <span>Solution {i + 1}</span>
                        {isSolvedSolution && (
                          <Badge variant="secondary" className="ml-2">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            solved
                          </Badge>
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          {/* Personal Best */}
          {progress?.bestTime && (
            <div className="p-3 border-b">
              <h4 className="text-sm font-medium mb-1">Personal Best</h4>
              <p className="text-lg font-mono text-primary" data-testid="text-personal-best">
                {formatTime(progress.bestTime)}
              </p>
            </div>
          )}
          
          {/* Overall Progress */}
          <div className="p-3 border-b">
            <h4 className="text-sm font-medium mb-2">Overall Progress</h4>
            <Progress value={overallProgressPercent} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {overallProgress.found} / {overallProgress.total} solutions across all challenges
            </p>
          </div>
          
          {/* Rules */}
          <div className="p-3 flex-1">
            <h4 className="text-xs font-semibold mb-2">Rules</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>Place {maxPieces} {PIECE_NAMES[pieceType].toLowerCase()}s</li>
              <li>No piece can attack another</li>
              <li>Red pieces are in conflict</li>
              <li>Click a piece to see its attacks</li>
            </ul>
          </div>
          
          {/* Back to menu */}
          <div className="p-3 border-t">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setGameStarted(false);
                setViewingSolution(null);
              }}
              data-testid="button-back-to-menu"
            >
              Back to Menu
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
