import { Canvas } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { useMemo, useRef, useState, useCallback, useEffect, Suspense } from "react";
import * as THREE from "three";
import { ChessBoard } from "@/components/chess-board";

// Path to the wooden chess set GLB model
const CHESS_MODEL_PATH = "/attached_assets/wooden_chess_set_1766401857181.glb";

// Mesh name mappings from the GLB file structure
// Format: Object3D name -> child Mesh name
const PIECE_MESH_NAMES = {
  whitePawn: "Object_6",
  whiteRook: "Object_16",
  whiteKnight: "Object_10",
  whiteBishop: "Object_20",
  whiteQueen: "Object_14",
  whiteKing: "Object_24",
  blackPawn: "Object_54",
  blackRook: "Object_8",
  blackKnight: "Object_22",
  blackBishop: "Object_12",
  blackQueen: "Object_18",
  blackKing: "Object_26",
};

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

// Piece positioning - these values make pieces appear centered on squares
// (3D geometry hides small positioning errors)
const PIECE_OFFSET_X = 0.02;
const PIECE_OFFSET_Z = -0.05;
const PIECE_SPACING_SCALE = 0.95;

// Highlight positioning - use same values as pieces for perfect alignment
const HIGHLIGHT_OFFSET_X = PIECE_OFFSET_X;
const HIGHLIGHT_OFFSET_Z = PIECE_OFFSET_Z;
const HIGHLIGHT_SPACING_SCALE = PIECE_SPACING_SCALE;

const LIGHT_SQUARE_COLOR = "#f0d9b5";
const DARK_SQUARE_COLOR = "#b58863";
const SELECTED_COLOR = "#ffff00";
const LEGAL_MOVE_COLOR = "#00ff00";
const LAST_MOVE_COLOR = "#aaaaff";

const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
const ranks = ["1", "2", "3", "4", "5", "6", "7", "8"];

// Base helper to get raw square position
function getSquareBaseXZ(square: string, orientation: "white" | "black"): [number, number] {
  const file = square[0];
  const rank = square[1];
  const fileIndex = files.indexOf(file);
  const rankIndex = ranks.indexOf(rank);
  
  if (orientation === "white") {
    return [(fileIndex - 3.5) * SQUARE_SIZE, (3.5 - rankIndex) * SQUARE_SIZE];
  } else {
    return [(3.5 - fileIndex) * SQUARE_SIZE, (3.5 - rankIndex) * SQUARE_SIZE];
  }
}

// Get world position for pieces
function getPieceWorldXZ(square: string, orientation: "white" | "black"): [number, number] {
  const [baseX, baseZ] = getSquareBaseXZ(square, orientation);
  return [
    baseX * PIECE_SPACING_SCALE + PIECE_OFFSET_X,
    baseZ * PIECE_SPACING_SCALE + PIECE_OFFSET_Z
  ];
}

// Get world position for highlights
function getHighlightWorldXZ(square: string, orientation: "white" | "black"): [number, number] {
  const [baseX, baseZ] = getSquareBaseXZ(square, orientation);
  return [
    baseX * HIGHLIGHT_SPACING_SCALE + HIGHLIGHT_OFFSET_X,
    baseZ * HIGHLIGHT_SPACING_SCALE + HIGHLIGHT_OFFSET_Z
  ];
}

function squareToPosition(square: string, orientation: "white" | "black"): [number, number] {
  const file = square[0];
  const rank = square[1];
  const fileIndex = files.indexOf(file);
  const rankIndex = ranks.indexOf(rank);
  
  if (orientation === "white") {
    return [
      (fileIndex - 3.5) * SQUARE_SIZE,
      (3.5 - rankIndex) * SQUARE_SIZE
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
    rankIndex = Math.floor(4 - z / SQUARE_SIZE);
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

// GLB wooden board component
function GLBBoard({ orientation, highlightedSquares, legalMoveSquares, lastMoveSquares, selectedSquare, onSquareClick }: {
  orientation: "white" | "black";
  highlightedSquares: string[];
  legalMoveSquares: string[];
  lastMoveSquares: string[];
  selectedSquare: string | null;
  onSquareClick: (square: string) => void;
}) {
  const { nodes, materials } = useGLTF(CHESS_MODEL_PATH) as { 
    nodes: Record<string, THREE.Object3D>;
    materials: Record<string, THREE.Material>;
  };
  const boardMesh = nodes["Object_4"] as THREE.Mesh;
  
  // Calculate board geometry, material, scale and surface height
  const { geometry, material, scale, offset, boardSurfaceY } = useMemo(() => {
    if (!boardMesh || !boardMesh.geometry) {
      return { geometry: null, material: null, scale: 1, offset: [0, 0, 0], boardSurfaceY: 0.1 };
    }
    
    const geo = boardMesh.geometry.clone();
    const mat = boardMesh.material as THREE.Material;
    const box = new THREE.Box3().setFromBufferAttribute(geo.attributes.position as THREE.BufferAttribute);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    // Center geometry
    geo.translate(-center.x, -box.min.y, -center.z);
    
    // Scale to match our board size (8 units for the playing area)
    // The board in the model includes a border, so we need to scale larger
    // to make the inner playing area match the 8-unit piece grid
    const targetSize = BOARD_SIZE + 1.5; // 9.5 units to account for border
    const calculatedScale = targetSize / Math.max(size.x, size.z);
    
    // Calculate the actual board surface Y position after scaling and offset
    // Use same Y as pieces (0.60) so highlights project to same screen position
    const boardOffset = -0.45;
    const surfaceY = 0.60; // Same as pieces to eliminate perspective offset
    
    return { 
      geometry: geo, 
      material: mat,
      scale: calculatedScale,
      offset: [0, -0.45, 0] as [number, number, number],
      boardSurfaceY: surfaceY
    };
  }, [boardMesh]);

  // Calculate interactive squares for click detection and highlighting
  // Uses shared getSquareWorldXZ helper for consistent positioning with pieces
  const squares = useMemo(() => {
    const result: { square: string; position: [number, number, number]; isHighlighted: boolean; isLegalMove: boolean; isLastMove: boolean; isSelected: boolean }[] = [];
    
    for (let fileIdx = 0; fileIdx < 8; fileIdx++) {
      for (let rankIdx = 0; rankIdx < 8; rankIdx++) {
        const square = files[fileIdx] + ranks[rankIdx];
        // Use highlight-specific positioning
        const [worldX, worldZ] = getHighlightWorldXZ(square, orientation);
        const isSelected = selectedSquare === square;
        const isHighlighted = highlightedSquares.includes(square);
        const isLegalMove = legalMoveSquares.includes(square);
        const isLastMove = lastMoveSquares.includes(square);
        
        result.push({
          square,
          position: [worldX, 0.01, worldZ],
          isHighlighted,
          isLegalMove,
          isLastMove,
          isSelected
        });
      }
    }
    
    return result;
  }, [orientation, highlightedSquares, legalMoveSquares, lastMoveSquares, selectedSquare]);

  if (!geometry || !material) {
    // Fall back to primitive board
    return <FallbackBoard 
      orientation={orientation}
      highlightedSquares={highlightedSquares}
      legalMoveSquares={legalMoveSquares}
      lastMoveSquares={lastMoveSquares}
      selectedSquare={selectedSquare}
      onSquareClick={onSquareClick}
    />;
  }

  return (
    <group>
      {/* Wooden board from GLB with original textures */}
      <mesh 
        geometry={geometry} 
        material={material}
        scale={[scale, scale, scale]}
        position={offset as [number, number, number]}
        receiveShadow
      />
      
      {/* Interactive overlay squares (invisible, just for clicking and highlighting) */}
      {squares.map(({ square, position, isLegalMove, isHighlighted, isSelected, isLastMove }) => {
        const scaledSquareSize = SQUARE_SIZE * HIGHLIGHT_SPACING_SCALE;
        return (
          <group key={square}>
            {/* Invisible click target - taller for better click detection */}
            <mesh
              position={[position[0], 0.3, position[2]]}
              onClick={(e) => {
                e.stopPropagation();
                onSquareClick(square);
              }}
            >
              <boxGeometry args={[scaledSquareSize * 0.98, 0.6, scaledSquareSize * 0.98]} />
              <meshBasicMaterial transparent opacity={0} />
            </mesh>
            
            {/* Selection highlight - yellow box - matches piece grid */}
            {isSelected && (
              <mesh position={[position[0], boardSurfaceY, position[2]]} renderOrder={100}>
                <boxGeometry args={[scaledSquareSize * 0.80, 0.03, scaledSquareSize * 0.80]} />
                <meshBasicMaterial 
                  color={SELECTED_COLOR} 
                  transparent 
                  opacity={0.5}
                  depthTest={false}
                  depthWrite={false}
                />
              </mesh>
            )}
            
            {/* Last move highlight - blue box - matches piece grid */}
            {isLastMove && !isSelected && (
              <mesh position={[position[0], boardSurfaceY, position[2]]} renderOrder={100}>
                <boxGeometry args={[scaledSquareSize * 0.80, 0.03, scaledSquareSize * 0.80]} />
                <meshBasicMaterial 
                  color={LAST_MOVE_COLOR} 
                  transparent 
                  opacity={0.4}
                  depthTest={false}
                  depthWrite={false}
                />
              </mesh>
            )}
            
            {/* Check/highlighted square indicator - red box */}
            {isHighlighted && (
              <mesh position={[position[0], boardSurfaceY + 0.01, position[2]]} renderOrder={101}>
                <boxGeometry args={[scaledSquareSize * 0.75, 0.03, scaledSquareSize * 0.75]} />
                <meshBasicMaterial 
                  color="#ff4444" 
                  transparent 
                  opacity={0.5}
                  depthTest={false}
                  depthWrite={false}
                />
              </mesh>
            )}
            
            {/* Legal move indicator - green dot */}
            {isLegalMove && (
              <mesh position={[position[0], boardSurfaceY + 0.05, position[2]]} renderOrder={102}>
                <sphereGeometry args={[0.18, 16, 16]} />
                <meshBasicMaterial 
                  color={LEGAL_MOVE_COLOR} 
                  transparent 
                  opacity={0.6}
                  depthTest={false}
                  depthWrite={false}
                />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

// Fallback board with colored squares (when GLB not available)
function FallbackBoard({ orientation, highlightedSquares, legalMoveSquares, lastMoveSquares, selectedSquare, onSquareClick }: {
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

// Board wrapper that tries GLB first
function Board({ orientation, highlightedSquares, legalMoveSquares, lastMoveSquares, selectedSquare, onSquareClick }: {
  orientation: "white" | "black";
  highlightedSquares: string[];
  legalMoveSquares: string[];
  lastMoveSquares: string[];
  selectedSquare: string | null;
  onSquareClick: (square: string) => void;
}) {
  return (
    <Suspense fallback={
      <FallbackBoard 
        orientation={orientation}
        highlightedSquares={highlightedSquares}
        legalMoveSquares={legalMoveSquares}
        lastMoveSquares={lastMoveSquares}
        selectedSquare={selectedSquare}
        onSquareClick={onSquareClick}
      />
    }>
      <GLBBoard 
        orientation={orientation}
        highlightedSquares={highlightedSquares}
        legalMoveSquares={legalMoveSquares}
        lastMoveSquares={lastMoveSquares}
        selectedSquare={selectedSquare}
        onSquareClick={onSquareClick}
      />
    </Suspense>
  );
}

function Pawn({ position, color }: { position: [number, number, number]; color: "w" | "b" }) {
  const pieceColor = color === "w" ? "#f5f5f0" : "#1a1a1a";
  const accentColor = color === "w" ? "#e8e8e0" : "#2a2a2a";
  return (
    <group position={position}>
      {/* Wide base plate */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.29, 0.32, 0.1, 24]} />
        <meshStandardMaterial color={accentColor} />
      </mesh>
      {/* Base collar */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.29, 0.12, 24]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Tapered neck */}
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.28, 0.3, 20]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Collar ring */}
      <mesh position={[0, 0.52, 0]} castShadow>
        <torusGeometry args={[0.16, 0.04, 12, 24]} />
        <meshStandardMaterial color={accentColor} />
      </mesh>
      {/* Round head */}
      <mesh position={[0, 0.68, 0]} castShadow>
        <sphereGeometry args={[0.22, 20, 20]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
    </group>
  );
}

function Rook({ position, color }: { position: [number, number, number]; color: "w" | "b" }) {
  const pieceColor = color === "w" ? "#f5f5f0" : "#1a1a1a";
  const accentColor = color === "w" ? "#e8e8e0" : "#2a2a2a";
  return (
    <group position={position}>
      {/* Wide base plate */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.35, 0.1, 24]} />
        <meshStandardMaterial color={accentColor} />
      </mesh>
      {/* Base collar */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.27, 0.32, 0.12, 24]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Tower body */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.32, 0.6, 24]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Tower rim */}
      <mesh position={[0, 0.82, 0]} castShadow>
        <cylinderGeometry args={[0.34, 0.28, 0.08, 24]} />
        <meshStandardMaterial color={accentColor} />
      </mesh>
      {/* Battlements - 4 corners */}
      {[0, Math.PI/2, Math.PI, Math.PI*1.5].map((angle, i) => (
        <mesh key={i} position={[Math.cos(angle) * 0.22, 0.95, Math.sin(angle) * 0.22]} castShadow>
          <boxGeometry args={[0.16, 0.18, 0.16]} />
          <meshStandardMaterial color={pieceColor} />
        </mesh>
      ))}
    </group>
  );
}

function Knight({ position, color }: { position: [number, number, number]; color: "w" | "b" }) {
  const pieceColor = color === "w" ? "#f5f5f0" : "#1a1a1a";
  const accentColor = color === "w" ? "#e8e8e0" : "#2a2a2a";
  return (
    <group position={position}>
      {/* Wide base plate */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.35, 0.1, 24]} />
        <meshStandardMaterial color={accentColor} />
      </mesh>
      {/* Base collar */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.32, 0.12, 24]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Neck column */}
      <mesh position={[0, 0.38, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.30, 0.38, 20]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Horse neck - angled */}
      <mesh position={[0.08, 0.65, 0]} rotation={[0, 0, 0.4]} castShadow>
        <cylinderGeometry args={[0.16, 0.20, 0.45, 16]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Horse head */}
      <mesh position={[0.22, 0.88, 0]} rotation={[0, 0, 0.8]} castShadow>
        <boxGeometry args={[0.35, 0.18, 0.22]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Horse snout */}
      <mesh position={[0.38, 0.82, 0]} rotation={[0, 0, 0.3]} castShadow>
        <boxGeometry args={[0.22, 0.12, 0.16]} />
        <meshStandardMaterial color={accentColor} />
      </mesh>
      {/* Ears */}
      <mesh position={[0.12, 1.0, 0.06]} rotation={[0.3, 0, 0.5]} castShadow>
        <coneGeometry args={[0.06, 0.14, 8]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      <mesh position={[0.12, 1.0, -0.06]} rotation={[-0.3, 0, 0.5]} castShadow>
        <coneGeometry args={[0.06, 0.14, 8]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Mane */}
      <mesh position={[-0.02, 0.78, 0]} rotation={[0, 0, -0.3]} castShadow>
        <boxGeometry args={[0.08, 0.35, 0.18]} />
        <meshStandardMaterial color={accentColor} />
      </mesh>
    </group>
  );
}

function Bishop({ position, color }: { position: [number, number, number]; color: "w" | "b" }) {
  const pieceColor = color === "w" ? "#f5f5f0" : "#1a1a1a";
  const accentColor = color === "w" ? "#e8e8e0" : "#2a2a2a";
  return (
    <group position={position}>
      {/* Wide base plate */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.35, 0.1, 24]} />
        <meshStandardMaterial color={accentColor} />
      </mesh>
      {/* Base collar */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.32, 0.12, 24]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Lower body */}
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.32, 0.32, 20]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Collar ring */}
      <mesh position={[0, 0.52, 0]} castShadow>
        <torusGeometry args={[0.22, 0.04, 12, 24]} />
        <meshStandardMaterial color={accentColor} />
      </mesh>
      {/* Tapered upper body */}
      <mesh position={[0, 0.72, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.22, 0.38, 20]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Mitre head - teardrop shape */}
      <mesh position={[0, 0.98, 0]} castShadow>
        <sphereGeometry args={[0.18, 20, 20]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Mitre point */}
      <mesh position={[0, 1.15, 0]} castShadow>
        <coneGeometry args={[0.14, 0.2, 16]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Diagonal slit on mitre */}
      <mesh position={[0.08, 1.02, 0]} rotation={[0, 0, 0.5]} castShadow>
        <boxGeometry args={[0.22, 0.04, 0.08]} />
        <meshStandardMaterial color={accentColor} />
      </mesh>
      {/* Top ball */}
      <mesh position={[0, 1.28, 0]} castShadow>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial color={accentColor} />
      </mesh>
    </group>
  );
}

function Queen({ position, color }: { position: [number, number, number]; color: "w" | "b" }) {
  const pieceColor = color === "w" ? "#f5f5f0" : "#1a1a1a";
  const accentColor = color === "w" ? "#e8e8e0" : "#2a2a2a";
  return (
    <group position={position}>
      {/* Wide base plate */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.38, 0.1, 24]} />
        <meshStandardMaterial color={accentColor} />
      </mesh>
      {/* Base collar */}
      <mesh position={[0, 0.16, 0]} castShadow>
        <cylinderGeometry args={[0.30, 0.35, 0.14, 24]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Lower body - curved */}
      <mesh position={[0, 0.40, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.38, 0.40, 24]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Waist ring */}
      <mesh position={[0, 0.62, 0]} castShadow>
        <torusGeometry args={[0.26, 0.05, 12, 24]} />
        <meshStandardMaterial color={accentColor} />
      </mesh>
      {/* Upper body - elegant taper */}
      <mesh position={[0, 0.88, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.26, 0.48, 20]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Crown base */}
      <mesh position={[0, 1.15, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.16, 0.10, 24]} />
        <meshStandardMaterial color={accentColor} />
      </mesh>
      {/* Crown points - 8 spikes around */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const angle = (i * Math.PI * 2) / 8;
        return (
          <mesh key={i} position={[Math.cos(angle) * 0.16, 1.28, Math.sin(angle) * 0.16]} castShadow>
            <sphereGeometry args={[0.05, 10, 10]} />
            <meshStandardMaterial color={pieceColor} />
          </mesh>
        );
      })}
      {/* Crown orb on top */}
      <mesh position={[0, 1.38, 0]} castShadow>
        <sphereGeometry args={[0.10, 16, 16]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
    </group>
  );
}

function King({ position, color }: { position: [number, number, number]; color: "w" | "b" }) {
  const pieceColor = color === "w" ? "#f5f5f0" : "#1a1a1a";
  const accentColor = color === "w" ? "#e8e8e0" : "#2a2a2a";
  return (
    <group position={position}>
      {/* Wide base plate */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.36, 0.39, 0.1, 24]} />
        <meshStandardMaterial color={accentColor} />
      </mesh>
      {/* Base collar */}
      <mesh position={[0, 0.16, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.36, 0.14, 24]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Lower body */}
      <mesh position={[0, 0.42, 0]} castShadow>
        <cylinderGeometry args={[0.30, 0.40, 0.44, 24]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Waist ring */}
      <mesh position={[0, 0.66, 0]} castShadow>
        <torusGeometry args={[0.28, 0.05, 12, 24]} />
        <meshStandardMaterial color={accentColor} />
      </mesh>
      {/* Upper body */}
      <mesh position={[0, 0.92, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.28, 0.48, 20]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Crown band */}
      <mesh position={[0, 1.18, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.18, 0.08, 24]} />
        <meshStandardMaterial color={accentColor} />
      </mesh>
      {/* Crown dome */}
      <mesh position={[0, 1.28, 0]} castShadow>
        <sphereGeometry args={[0.16, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Cross - vertical beam */}
      <mesh position={[0, 1.52, 0]} castShadow>
        <boxGeometry args={[0.08, 0.40, 0.08]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
      {/* Cross - horizontal beam */}
      <mesh position={[0, 1.58, 0]} castShadow>
        <boxGeometry args={[0.28, 0.08, 0.08]} />
        <meshStandardMaterial color={pieceColor} />
      </mesh>
    </group>
  );
}

// Get the mesh name for a piece type and color
function getPieceMeshName(type: string, color: "w" | "b"): string {
  const colorPrefix = color === "w" ? "white" : "black";
  const pieceNameMap: Record<string, string> = {
    p: "Pawn",
    r: "Rook",
    n: "Knight",
    b: "Bishop",
    q: "Queen",
    k: "King",
  };
  const pieceName = pieceNameMap[type] || "Pawn";
  const key = `${colorPrefix}${pieceName}` as keyof typeof PIECE_MESH_NAMES;
  return PIECE_MESH_NAMES[key];
}

// GLB-based chess piece that uses the wooden chess set model
function GLBChessPiece({ type, color, position, onClick, nodes }: { 
  type: string; 
  color: "w" | "b"; 
  position: [number, number, number];
  onClick: () => void;
  nodes: Record<string, THREE.Object3D>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  
  const meshName = getPieceMeshName(type, color);
  const meshNode = nodes[meshName] as THREE.Mesh;
  
  // Calculate geometry, material and scale once
  const { geometry, material, scale } = useMemo(() => {
    if (!meshNode || !meshNode.geometry) {
      return { geometry: null, material: null, scale: 0.012 };
    }
    
    const geo = meshNode.geometry.clone();
    const mat = meshNode.material as THREE.Material;
    
    // Calculate scale to normalize piece heights
    const box = new THREE.Box3().setFromBufferAttribute(geo.attributes.position as THREE.BufferAttribute);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    // Center the geometry at origin
    geo.translate(-center.x, -box.min.y, -center.z);
    
    // Target heights for different piece types (scaled down 10% to fit board squares)
    const targetHeights: Record<string, number> = {
      k: 1.44,
      q: 1.26,
      r: 0.81,
      b: 1.08,
      n: 0.99,
      p: 0.72,
    };
    const targetHeight = targetHeights[type] || 0.81;
    const calculatedScale = targetHeight / size.y;
    
    return { geometry: geo, material: mat, scale: calculatedScale };
  }, [meshNode, type]);
  
  if (!geometry || !material) {
    // Fallback to primitive piece if mesh not found
    return <FallbackChessPiece type={type} color={color} position={position} onClick={onClick} />;
  }
  
  const adjustedPosition: [number, number, number] = [
    position[0],
    position[1] + (hovered ? 0.1 : 0),
    position[2]
  ];
  
  return (
    <group 
      ref={groupRef}
      position={adjustedPosition}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={() => {
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      <mesh 
        geometry={geometry} 
        material={material}
        scale={[scale, scale, scale]}
        castShadow
      />
    </group>
  );
}

// Fallback piece using primitive geometry (when GLB not available)
function FallbackChessPiece({ type, color, position, onClick }: { 
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
      onPointerOver={() => {
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

// Pieces container that loads GLB and renders all pieces
function GLBPieces({ fen, orientation, onSquareClick }: {
  fen: string;
  orientation: "white" | "black";
  onSquareClick: (square: string) => void;
}) {
  const { nodes } = useGLTF(CHESS_MODEL_PATH) as { nodes: Record<string, THREE.Object3D> };
  const pieces = useMemo(() => parseFen(fen), [fen]);
  
  return (
    <group>
      {Array.from(pieces.entries()).map(([square, { type, color }]) => {
        // Use piece-specific positioning
        const [worldX, worldZ] = getPieceWorldXZ(square, orientation);
        const pieceKey = `${square}-${type}-${color}`;
        return (
          <GLBChessPiece
            key={pieceKey}
            type={type}
            color={color}
            position={[worldX, 0.60, worldZ]}
            onClick={() => onSquareClick(square)}
            nodes={nodes}
          />
        );
      })}
    </group>
  );
}

// Fallback pieces container (primitive geometry)
function FallbackPieces({ fen, orientation, onSquareClick }: {
  fen: string;
  orientation: "white" | "black";
  onSquareClick: (square: string) => void;
}) {
  const pieces = useMemo(() => parseFen(fen), [fen]);
  
  return (
    <group>
      {Array.from(pieces.entries()).map(([square, { type, color }]) => {
        const [x, z] = squareToPosition(square, orientation);
        const pieceKey = `${square}-${type}-${color}`;
        return (
          <FallbackChessPiece
            key={pieceKey}
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

// Wrapper that tries GLB first, falls back to primitives
function Pieces({ fen, orientation, onSquareClick }: {
  fen: string;
  orientation: "white" | "black";
  onSquareClick: (square: string) => void;
}) {
  return (
    <Suspense fallback={<FallbackPieces fen={fen} orientation={orientation} onSquareClick={onSquareClick} />}>
      <GLBPieces fen={fen} orientation={orientation} onSquareClick={onSquareClick} />
    </Suspense>
  );
}

// Preload the GLB model
useGLTF.preload(CHESS_MODEL_PATH);


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
  const [webglSupported, setWebglSupported] = useState<boolean | null>(null);
  
  useEffect(() => {
    setWebglSupported(isWebGLAvailable());
  }, []);
  
  const handleSquareClick = useCallback((square: string) => {
    if (onSquareClick) {
      onSquareClick(square);
    }
  }, [onSquareClick]);

  // Camera position adjusted for better mobile accessibility - steeper angle and closer zoom makes pieces easier to tap
  const cameraPosition: [number, number, number] = orientation === "white" 
    ? [0, 11, 7]
    : [0, 11, -7];
  
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
        selectedSquare={selectedSquare}
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
          selectedSquare={selectedSquare}
          onSquareClick={handleSquareClick}
        />
      </Canvas>
    </div>
  );
}
