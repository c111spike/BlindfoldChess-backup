import { Canvas } from "@react-three/fiber";
import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import * as THREE from "three";
import { ChessBoard } from "@/components/chess-board";

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch (e) {
    return false;
  }
}

interface ChessBoard3DProps {
  fen?: string;
  orientation?: "white" | "black";
  highlightedSquares?: string[];
  legalMoveSquares?: string[];
  lastMoveSquares?: string[];
  selectedSquare?: string | null;
  onSquareClick?: (square: string) => void;
  onMove?: (from: string, to: string) => boolean;
  className?: string;
}

const SQUARE_SIZE = 1;
const BOARD_SIZE = 8 * SQUARE_SIZE;
const PIECE_SCALE = 0.4;

const LIGHT_SQUARE_COLOR = "#f0d9b5";
const DARK_SQUARE_COLOR = "#b58863";
const SELECTED_COLOR = "#ffff00";
const LEGAL_MOVE_COLOR = "#00ff00";
const LAST_MOVE_COLOR = "#aaaaff";

const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
const ranks = ["1", "2", "3", "4", "5", "6", "7", "8"];

function squareToPosition(square: string, orientation: "white" | "black"): [number, number] {
  const file = square[0];
  const rank = square[1];
  const fileIndex = files.indexOf(file);
  const rankIndex = ranks.indexOf(rank);
  
  if (orientation === "white") {
    return [
      (fileIndex - 3.5) * SQUARE_SIZE,
      (rankIndex - 3.5) * SQUARE_SIZE
    ];
  } else {
    return [
      (3.5 - fileIndex) * SQUARE_SIZE,
      (3.5 - rankIndex) * SQUARE_SIZE
    ];
  }
}

function positionToSquare(x: number, z: number, orientation: "white" | "black"): string | null {
  let fileIndex: number;
  let rankIndex: number;
  
  if (orientation === "white") {
    fileIndex = Math.floor(x / SQUARE_SIZE + 4);
    rankIndex = Math.floor(z / SQUARE_SIZE + 4);
  } else {
    fileIndex = Math.floor(4 - x / SQUARE_SIZE);
    rankIndex = Math.floor(4 - z / SQUARE_SIZE);
  }
  
  if (fileIndex >= 0 && fileIndex < 8 && rankIndex >= 0 && rankIndex < 8) {
    return files[fileIndex] + ranks[rankIndex];
  }
  return null;
}

function parseFen(fen: string): Map<string, { type: string; color: "w" | "b" }> {
  const pieces = new Map<string, { type: string; color: "w" | "b" }>();
  const position = fen.split(" ")[0];
  const rows = position.split("/");
  
  for (let rankIdx = 0; rankIdx < 8; rankIdx++) {
    const row = rows[rankIdx];
    let fileIdx = 0;
    
    for (const char of row) {
      if (char >= "1" && char <= "8") {
        fileIdx += parseInt(char);
      } else {
        const file = files[fileIdx];
        const rank = ranks[7 - rankIdx];
        const square = file + rank;
        const color = char === char.toUpperCase() ? "w" : "b";
        const type = char.toLowerCase();
        pieces.set(square, { type, color });
        fileIdx++;
      }
    }
  }
  
  return pieces;
}

function Board({ orientation, highlightedSquares, legalMoveSquares, lastMoveSquares, selectedSquare, onSquareClick }: {
  orientation: "white" | "black";
  highlightedSquares: string[];
  legalMoveSquares: string[];
  lastMoveSquares: string[];
  selectedSquare: string | null;
  onSquareClick: (square: string) => void;
}) {
  const squares = useMemo(() => {
    const result: { square: string; position: [number, number, number]; color: string; isHighlighted: boolean; isLegalMove: boolean; isLastMove: boolean; isSelected: boolean }[] = [];
    
    for (let fileIdx = 0; fileIdx < 8; fileIdx++) {
      for (let rankIdx = 0; rankIdx < 8; rankIdx++) {
        const square = files[fileIdx] + ranks[rankIdx];
        const [x, z] = squareToPosition(square, orientation);
        const isLight = (fileIdx + rankIdx) % 2 === 1;
        const isSelected = selectedSquare === square;
        const isHighlighted = highlightedSquares.includes(square);
        const isLegalMove = legalMoveSquares.includes(square);
        const isLastMove = lastMoveSquares.includes(square);
        
        let color = isLight ? LIGHT_SQUARE_COLOR : DARK_SQUARE_COLOR;
        if (isSelected) color = SELECTED_COLOR;
        else if (isLastMove) color = LAST_MOVE_COLOR;
        
        result.push({
          square,
          position: [x, -0.05, z],
          color,
          isHighlighted,
          isLegalMove,
          isLastMove,
          isSelected
        });
      }
    }
    
    return result;
  }, [orientation, highlightedSquares, legalMoveSquares, lastMoveSquares, selectedSquare]);

  return (
    <group>
      {/* Board base */}
      <mesh position={[0, -0.15, 0]} receiveShadow>
        <boxGeometry args={[BOARD_SIZE + 0.4, 0.2, BOARD_SIZE + 0.4]} />
        <meshStandardMaterial color="#5c4033" />
      </mesh>
      
      {/* Squares */}
      {squares.map(({ square, position, color, isLegalMove, isHighlighted }) => (
        <group key={square}>
          <mesh
            position={position as [number, number, number]}
            onClick={(e) => {
              e.stopPropagation();
              onSquareClick(square);
            }}
            receiveShadow
          >
            <boxGeometry args={[SQUARE_SIZE * 0.98, 0.1, SQUARE_SIZE * 0.98]} />
            <meshStandardMaterial color={color} />
          </mesh>
          
          {/* Highlighted square indicator (for check, custom highlights) */}
          {isHighlighted && (
            <mesh position={[position[0], 0.06, position[2]]}>
              <boxGeometry args={[SQUARE_SIZE * 0.9, 0.02, SQUARE_SIZE * 0.9]} />
              <meshStandardMaterial color="#ff4444" transparent opacity={0.6} />
            </mesh>
          )}
          
          {/* Legal move indicator */}
          {isLegalMove && (
            <mesh position={[position[0], 0.06, position[2]]}>
              <cylinderGeometry args={[0.15, 0.15, 0.02, 16]} />
              <meshStandardMaterial color={LEGAL_MOVE_COLOR} transparent opacity={0.7} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

function Pawn({ position, color }: { position: [number, number, number]; color: "w" | "b" }) {
  const pieceColor = color === "w" ? "#eeeeee" : "#222222";
  return (
    <group position={position}>
      {/* Base */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.3 * PIECE_SCALE, 0.35 * PIECE_SCALE, 0.15, 16]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Body */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.2 * PIECE_SCALE, 0.28 * PIECE_SCALE, 0.4, 16]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.65, 0]} castShadow>
        <sphereGeometry args={[0.18 * PIECE_SCALE, 16, 16]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
    </group>
  );
}

function Rook({ position, color }: { position: [number, number, number]; color: "w" | "b" }) {
  const pieceColor = color === "w" ? "#eeeeee" : "#222222";
  return (
    <group position={position}>
      {/* Base */}
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.32 * PIECE_SCALE, 0.38 * PIECE_SCALE, 0.2, 16]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Tower */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.25 * PIECE_SCALE, 0.28 * PIECE_SCALE, 0.6, 16]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Top */}
      <mesh position={[0, 0.8, 0]} castShadow>
        <boxGeometry args={[0.35 * PIECE_SCALE, 0.15, 0.35 * PIECE_SCALE]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
    </group>
  );
}

function Knight({ position, color }: { position: [number, number, number]; color: "w" | "b" }) {
  const pieceColor = color === "w" ? "#eeeeee" : "#222222";
  return (
    <group position={position}>
      {/* Base */}
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.32 * PIECE_SCALE, 0.38 * PIECE_SCALE, 0.2, 16]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Body */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.22 * PIECE_SCALE, 0.28 * PIECE_SCALE, 0.5, 16]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Head (angled box for horse shape) */}
      <mesh position={[0.05, 0.7, 0]} rotation={[0, 0, 0.3]} castShadow>
        <boxGeometry args={[0.18 * PIECE_SCALE, 0.35, 0.25 * PIECE_SCALE]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Mane */}
      <mesh position={[-0.02, 0.75, 0]} rotation={[0, 0, -0.2]} castShadow>
        <boxGeometry args={[0.08 * PIECE_SCALE, 0.25, 0.2 * PIECE_SCALE]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
    </group>
  );
}

function Bishop({ position, color }: { position: [number, number, number]; color: "w" | "b" }) {
  const pieceColor = color === "w" ? "#eeeeee" : "#222222";
  return (
    <group position={position}>
      {/* Base */}
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.32 * PIECE_SCALE, 0.38 * PIECE_SCALE, 0.2, 16]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Body */}
      <mesh position={[0, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.15 * PIECE_SCALE, 0.28 * PIECE_SCALE, 0.6, 16]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Mitre */}
      <mesh position={[0, 0.8, 0]} castShadow>
        <coneGeometry args={[0.18 * PIECE_SCALE, 0.3, 16]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Top ball */}
      <mesh position={[0, 0.98, 0]} castShadow>
        <sphereGeometry args={[0.06 * PIECE_SCALE, 12, 12]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
    </group>
  );
}

function Queen({ position, color }: { position: [number, number, number]; color: "w" | "b" }) {
  const pieceColor = color === "w" ? "#eeeeee" : "#222222";
  return (
    <group position={position}>
      {/* Base */}
      <mesh position={[0, 0.12, 0]} castShadow>
        <cylinderGeometry args={[0.35 * PIECE_SCALE, 0.42 * PIECE_SCALE, 0.24, 16]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Body */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.18 * PIECE_SCALE, 0.32 * PIECE_SCALE, 0.7, 16]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Crown */}
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.22 * PIECE_SCALE, 0.15 * PIECE_SCALE, 0.2, 8]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Top ball */}
      <mesh position={[0, 1.05, 0]} castShadow>
        <sphereGeometry args={[0.08 * PIECE_SCALE, 12, 12]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
    </group>
  );
}

function King({ position, color }: { position: [number, number, number]; color: "w" | "b" }) {
  const pieceColor = color === "w" ? "#eeeeee" : "#222222";
  return (
    <group position={position}>
      {/* Base */}
      <mesh position={[0, 0.12, 0]} castShadow>
        <cylinderGeometry args={[0.35 * PIECE_SCALE, 0.42 * PIECE_SCALE, 0.24, 16]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Body */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.2 * PIECE_SCALE, 0.32 * PIECE_SCALE, 0.7, 16]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Collar */}
      <mesh position={[0, 0.88, 0]} castShadow>
        <cylinderGeometry args={[0.22 * PIECE_SCALE, 0.18 * PIECE_SCALE, 0.1, 16]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Cross vertical */}
      <mesh position={[0, 1.08, 0]} castShadow>
        <boxGeometry args={[0.06 * PIECE_SCALE, 0.35, 0.06 * PIECE_SCALE]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Cross horizontal */}
      <mesh position={[0, 1.15, 0]} castShadow>
        <boxGeometry args={[0.2 * PIECE_SCALE, 0.08, 0.06 * PIECE_SCALE]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
    </group>
  );
}

function ChessPiece({ type, color, position, onClick }: { 
  type: string; 
  color: "w" | "b"; 
  position: [number, number, number];
  onClick: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  
  const adjustedPosition: [number, number, number] = [
    position[0],
    position[1] + (hovered ? 0.1 : 0),
    position[2]
  ];
  
  const pieceComponents: Record<string, typeof Pawn> = {
    p: Pawn,
    r: Rook,
    n: Knight,
    b: Bishop,
    q: Queen,
    k: King,
  };
  
  const PieceComponent = pieceComponents[type];
  if (!PieceComponent) return null;
  
  return (
    <group 
      ref={groupRef}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      <PieceComponent position={adjustedPosition} color={color} />
    </group>
  );
}

function Pieces({ fen, orientation, onSquareClick }: {
  fen: string;
  orientation: "white" | "black";
  onSquareClick: (square: string) => void;
}) {
  const pieces = useMemo(() => parseFen(fen), [fen]);
  
  return (
    <group>
      {Array.from(pieces.entries()).map(([square, { type, color }]) => {
        const [x, z] = squareToPosition(square, orientation);
        return (
          <ChessPiece
            key={square}
            type={type}
            color={color}
            position={[x, 0.05, z]}
            onClick={() => onSquareClick(square)}
          />
        );
      })}
    </group>
  );
}

function Scene({ fen, orientation, highlightedSquares, legalMoveSquares, lastMoveSquares, selectedSquare, onSquareClick }: {
  fen: string;
  orientation: "white" | "black";
  highlightedSquares: string[];
  legalMoveSquares: string[];
  lastMoveSquares: string[];
  selectedSquare: string | null;
  onSquareClick: (square: string) => void;
}) {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-5, 8, -5]} intensity={0.3} />
      
      {/* Board and pieces */}
      <Board
        orientation={orientation}
        highlightedSquares={highlightedSquares}
        legalMoveSquares={legalMoveSquares}
        lastMoveSquares={lastMoveSquares}
        selectedSquare={selectedSquare}
        onSquareClick={onSquareClick}
      />
      <Pieces
        fen={fen}
        orientation={orientation}
        onSquareClick={onSquareClick}
      />
    </>
  );
}

export function ChessBoard3D({
  fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  orientation = "white",
  highlightedSquares = [],
  legalMoveSquares = [],
  lastMoveSquares = [],
  selectedSquare = null,
  onSquareClick,
  onMove,
  className = "",
}: ChessBoard3DProps) {
  const [internalSelected, setInternalSelected] = useState<string | null>(null);
  const [webglSupported, setWebglSupported] = useState<boolean | null>(null);
  
  useEffect(() => {
    setWebglSupported(isWebGLAvailable());
  }, []);
  
  const effectiveSelected = selectedSquare ?? internalSelected;
  
  const handleSquareClick = useCallback((square: string) => {
    if (onSquareClick) {
      onSquareClick(square);
    }
    
    if (onMove && effectiveSelected && effectiveSelected !== square) {
      const success = onMove(effectiveSelected, square);
      if (success) {
        setInternalSelected(null);
        return;
      }
    }
    
    setInternalSelected(square);
  }, [onSquareClick, onMove, effectiveSelected]);

  const cameraPosition: [number, number, number] = orientation === "white" 
    ? [0, 8, 8]
    : [0, 8, -8];
  
  const lookAt: [number, number, number] = [0, 0, 0];

  if (webglSupported === null) {
    return <div className={`w-full aspect-square ${className}`} data-testid="chess-board-3d-loading" />;
  }

  if (!webglSupported) {
    const lastMove = lastMoveSquares.length === 2 
      ? { from: lastMoveSquares[0], to: lastMoveSquares[1] } 
      : undefined;
    return (
      <ChessBoard
        fen={fen}
        orientation={orientation}
        highlightedSquares={highlightedSquares}
        legalMoveSquares={legalMoveSquares}
        lastMove={lastMove}
        selectedSquare={effectiveSelected}
        onSquareClick={onSquareClick}
        onMove={onMove}
        className={className}
        noCard={true}
      />
    );
  }

  return (
    <div className={`w-full aspect-square ${className}`} data-testid="chess-board-3d">
      <Canvas
        shadows
        camera={{
          position: cameraPosition,
          fov: 45,
          near: 0.1,
          far: 100,
        }}
        onCreated={({ camera }) => {
          camera.lookAt(...lookAt);
        }}
      >
        <Scene
          fen={fen}
          orientation={orientation}
          highlightedSquares={highlightedSquares}
          legalMoveSquares={legalMoveSquares}
          lastMoveSquares={lastMoveSquares}
          selectedSquare={effectiveSelected}
          onSquareClick={handleSquareClick}
        />
      </Canvas>
    </div>
  );
}
