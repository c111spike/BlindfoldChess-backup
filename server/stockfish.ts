import { spawn, ChildProcess } from 'child_process';
import { Chess } from 'chess.js';

interface StockfishResult {
  bestMove: string;
  evaluation?: number;
  depth?: number;
}

interface PositionAnalysis {
  evaluation: number;
  bestMove: string;
  bestMoveEval: number;
  principalVariation: string[];
  depth: number;
  isMate: boolean;
  mateIn?: number;
}

interface TopMoveResult {
  move: string;
  evaluation: number;
  isMate: boolean;
  mateIn?: number;
  principalVariation: string[];
}

interface MoveAnalysisResult {
  moveNumber: number;
  color: 'white' | 'black';
  move: string;
  fen: string;
  evalBefore: number;
  evalAfter: number;
  normalizedEvalBefore: number;
  normalizedEvalAfter: number;
  bestMove: string;
  bestMoveEval: number;
  centipawnLoss: number;
  normalizedCentipawnLoss: number;
  principalVariation: string[];
  isBestMove: boolean;
  isMateBefore: boolean;
  isMateAfter: boolean;
  mateInBefore?: number;
  mateInAfter?: number;
  capturedPiece?: string;
  movedPiece: string;
}

const MAX_EVAL = 10;
const MAX_CENTIPAWN_LOSS = 500;

function normalizeEvaluation(rawEval: number): number {
  return Math.max(-MAX_EVAL, Math.min(MAX_EVAL, rawEval));
}

function normalizeCentipawnLoss(rawLoss: number): number {
  return Math.min(MAX_CENTIPAWN_LOSS, Math.max(0, rawLoss));
}

class StockfishService {
  private process: ChildProcess | null = null;
  private isReady: boolean = false;
  private outputBuffer: string = '';
  private resolveQueue: Array<(value: string) => void> = [];

  async init(): Promise<void> {
    if (this.process) return;

    return new Promise((resolve, reject) => {
      this.process = spawn('stockfish', [], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.process.stdout?.on('data', (data: Buffer) => {
        this.outputBuffer += data.toString();
        this.processOutput();
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        console.error('[Stockfish Error]:', data.toString());
      });

      this.process.on('error', (err) => {
        console.error('[Stockfish] Failed to start:', err);
        reject(err);
      });

      this.process.on('close', (code) => {
        console.log('[Stockfish] Process exited with code:', code);
        this.process = null;
        this.isReady = false;
      });

      this.sendCommand('uci');
      this.waitForResponse('uciok').then(() => {
        this.sendCommand('isready');
        this.waitForResponse('readyok').then(() => {
          this.isReady = true;
          console.log('[Stockfish] Engine ready');
          resolve();
        });
      });
    });
  }

  private sendCommand(command: string): void {
    if (!this.process?.stdin) {
      throw new Error('Stockfish process not initialized');
    }
    this.process.stdin.write(command + '\n');
  }

  private processOutput(): void {
    const lines = this.outputBuffer.split('\n');
    this.outputBuffer = lines.pop() || '';

    for (const line of lines) {
      if (this.resolveQueue.length > 0) {
        const resolve = this.resolveQueue[0];
        resolve(line);
      }
    }
  }

  private waitForResponse(keyword: string): Promise<string> {
    return new Promise((resolve) => {
      const checkBuffer = () => {
        const lines = this.outputBuffer.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(keyword)) {
            this.outputBuffer = lines.slice(i + 1).join('\n');
            resolve(lines[i]);
            return true;
          }
        }
        return false;
      };

      if (checkBuffer()) return;

      const originalOnData = this.process?.stdout?.listeners('data')[0] as any;
      const handler = (data: Buffer) => {
        this.outputBuffer += data.toString();
        if (checkBuffer()) {
          this.process?.stdout?.removeListener('data', handler);
          if (originalOnData) {
            this.process?.stdout?.on('data', originalOnData);
          }
        }
      };
      
      this.process?.stdout?.removeAllListeners('data');
      this.process?.stdout?.on('data', handler);
    });
  }

  async getBestMove(fen: string, depth: number = 15): Promise<StockfishResult> {
    if (!this.isReady) {
      await this.init();
    }

    this.sendCommand(`position fen ${fen}`);
    this.sendCommand(`go depth ${depth}`);

    const result = await this.waitForBestMove();
    return result;
  }

  private waitForBestMove(): Promise<StockfishResult> {
    return new Promise((resolve) => {
      let evaluation: number | undefined;
      let depth: number | undefined;
      let collectedOutput = '';

      const handler = (data: Buffer) => {
        collectedOutput += data.toString();
        const lines = collectedOutput.split('\n');

        for (const line of lines) {
          if (line.startsWith('info depth')) {
            const depthMatch = line.match(/depth (\d+)/);
            const scoreMatch = line.match(/score cp (-?\d+)/);
            const mateMatch = line.match(/score mate (-?\d+)/);
            
            if (depthMatch) depth = parseInt(depthMatch[1]);
            if (scoreMatch) evaluation = parseInt(scoreMatch[1]) / 100;
            if (mateMatch) evaluation = parseInt(mateMatch[1]) > 0 ? 100 : -100;
          }

          if (line.startsWith('bestmove')) {
            const moveMatch = line.match(/bestmove (\S+)/);
            if (moveMatch) {
              this.process?.stdout?.removeListener('data', handler);
              this.process?.stdout?.on('data', (d: Buffer) => {
                this.outputBuffer += d.toString();
                this.processOutput();
              });
              resolve({
                bestMove: moveMatch[1],
                evaluation,
                depth
              });
              return;
            }
          }
        }
      };

      this.process?.stdout?.removeAllListeners('data');
      this.process?.stdout?.on('data', handler);
    });
  }

  async validateMove(fen: string, move: string): Promise<boolean> {
    if (!this.isReady) {
      await this.init();
    }

    try {
      this.sendCommand(`position fen ${fen} moves ${move}`);
      this.sendCommand('d');
      
      const response = await this.waitForResponse('Checkers:');
      return !response.includes('Illegal');
    } catch {
      return false;
    }
  }

  shutdown(): void {
    if (this.process) {
      this.sendCommand('quit');
      this.process = null;
      this.isReady = false;
    }
  }

  async analyzePosition(fen: string, depth: number = 20): Promise<PositionAnalysis> {
    if (!this.isReady) {
      await this.init();
    }

    this.sendCommand('ucinewgame');
    this.sendCommand(`position fen ${fen}`);
    this.sendCommand(`go depth ${depth}`);

    return new Promise((resolve) => {
      let evaluation = 0;
      let currentDepth = 0;
      let bestMove = '';
      let pv: string[] = [];
      let isMate = false;
      let mateIn: number | undefined;
      let collectedOutput = '';

      const handler = (data: Buffer) => {
        collectedOutput += data.toString();
        const lines = collectedOutput.split('\n');

        for (const line of lines) {
          if (line.startsWith('info depth') && line.includes(' pv ')) {
            const depthMatch = line.match(/depth (\d+)/);
            const scoreMatch = line.match(/score cp (-?\d+)/);
            const mateMatch = line.match(/score mate (-?\d+)/);
            const pvMatch = line.match(/ pv (.+)/);

            if (depthMatch) currentDepth = parseInt(depthMatch[1]);
            if (scoreMatch) {
              evaluation = parseInt(scoreMatch[1]) / 100;
              isMate = false;
              mateIn = undefined;
            }
            if (mateMatch) {
              const mateValue = parseInt(mateMatch[1]);
              evaluation = mateValue > 0 ? 999 : -999;
              isMate = true;
              mateIn = Math.abs(mateValue);
            }
            if (pvMatch) {
              pv = pvMatch[1].trim().split(' ');
            }
          }

          if (line.startsWith('bestmove')) {
            const moveMatch = line.match(/bestmove (\S+)/);
            if (moveMatch) {
              bestMove = moveMatch[1];
              this.process?.stdout?.removeListener('data', handler);
              this.process?.stdout?.on('data', (d: Buffer) => {
                this.outputBuffer += d.toString();
                this.processOutput();
              });
              resolve({
                evaluation,
                bestMove,
                bestMoveEval: evaluation,
                principalVariation: pv,
                depth: currentDepth,
                isMate,
                mateIn
              });
              return;
            }
          }
        }
      };

      this.process?.stdout?.removeAllListeners('data');
      this.process?.stdout?.on('data', handler);
    });
  }

  async analyzeGame(moves: string[], startFen: string = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', depth: number = 12): Promise<MoveAnalysisResult[]> {
    if (!this.isReady) {
      await this.init();
    }

    const results: MoveAnalysisResult[] = [];
    let currentFen = startFen;
    
    const chess = new Chess(startFen);
    
    let cachedBeforeAnalysis = await this.analyzePosition(currentFen, depth);
    
    for (let i = 0; i < moves.length; i++) {
      const sanMove = moves[i];
      const moveNumber = Math.floor(i / 2) + 1;
      const color: 'white' | 'black' = i % 2 === 0 ? 'white' : 'black';

      const beforeAnalysis = cachedBeforeAnalysis;

      const moveResult = chess.move(sanMove);
      if (!moveResult) {
        throw new Error(`Invalid move: ${sanMove} at position ${currentFen}`);
      }
      
      const uciMove = moveResult.from + moveResult.to + (moveResult.promotion || '');
      const afterFen = chess.fen();

      const afterAnalysis = await this.analyzePosition(afterFen, depth);

      // Stockfish always reports from side-to-move perspective
      // 
      // For CENTIPAWN LOSS: we need evaluations from the MOVER's perspective
      // - beforeAnalysis.evaluation is already from the mover's perspective
      // - afterAnalysis.evaluation is from opponent's perspective, so negate it to get mover's view
      const moverEvalBefore = beforeAnalysis.evaluation;
      const moverEvalAfter = -afterAnalysis.evaluation; // Flip to mover's perspective
      
      const normalizedMoverEvalBefore = normalizeEvaluation(moverEvalBefore);
      const normalizedMoverEvalAfter = normalizeEvaluation(moverEvalAfter);
      
      // Centipawn loss: how much the mover's position got worse
      const rawCentipawnLoss = Math.max(0, Math.round((normalizedMoverEvalBefore - normalizedMoverEvalAfter) * 100));
      const centipawnLoss = rawCentipawnLoss;
      const normalizedCentipawnLoss = normalizeCentipawnLoss(rawCentipawnLoss);
      
      // For DISPLAY: normalize evaluations to WHITE's perspective
      // Positive = good for white, Negative = good for black
      const isWhiteMove = color === 'white';
      const evalBefore = isWhiteMove ? moverEvalBefore : -moverEvalBefore;
      const evalAfter = isWhiteMove ? moverEvalAfter : -moverEvalAfter;
      
      // Also normalize bestMoveEval to white's perspective
      // beforeAnalysis.bestMoveEval is from mover's perspective
      const bestMoveEvalWhitePerspective = isWhiteMove 
        ? beforeAnalysis.bestMoveEval 
        : -beforeAnalysis.bestMoveEval;
      
      const normalizedEvalBefore = normalizeEvaluation(evalBefore);
      const normalizedEvalAfter = normalizeEvaluation(evalAfter);

      const isBestMove = uciMove === beforeAnalysis.bestMove || 
        (beforeAnalysis.principalVariation.length > 0 && uciMove === beforeAnalysis.principalVariation[0]);

      results.push({
        moveNumber,
        color,
        move: sanMove,
        fen: afterFen,
        evalBefore,
        evalAfter,
        normalizedEvalBefore,
        normalizedEvalAfter,
        bestMove: beforeAnalysis.bestMove,
        bestMoveEval: bestMoveEvalWhitePerspective,
        centipawnLoss,
        normalizedCentipawnLoss,
        principalVariation: beforeAnalysis.principalVariation,
        isBestMove,
        isMateBefore: beforeAnalysis.isMate,
        isMateAfter: afterAnalysis.isMate,
        mateInBefore: beforeAnalysis.mateIn,
        mateInAfter: afterAnalysis.mateIn,
        capturedPiece: moveResult.captured,
        movedPiece: moveResult.piece,
      });

      currentFen = afterFen;
      cachedBeforeAnalysis = afterAnalysis;
    }

    return results;
  }

  private waitForFen(): Promise<string> {
    return new Promise((resolve) => {
      let collectedOutput = '';
      
      const handler = (data: Buffer) => {
        collectedOutput += data.toString();
        const lines = collectedOutput.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('Fen:')) {
            const fen = line.substring(4).trim();
            this.process?.stdout?.removeListener('data', handler);
            this.process?.stdout?.on('data', (d: Buffer) => {
              this.outputBuffer += d.toString();
              this.processOutput();
            });
            resolve(fen);
            return;
          }
        }
      };

      this.process?.stdout?.removeAllListeners('data');
      this.process?.stdout?.on('data', handler);
    });
  }

  async getEvaluation(fen: string, depth: number = 15): Promise<number> {
    const analysis = await this.analyzePosition(fen, depth);
    return analysis.evaluation;
  }

  async getTopMoves(fen: string, numMoves: number = 3, depth: number = 18): Promise<TopMoveResult[]> {
    if (!this.isReady) {
      await this.init();
    }

    this.sendCommand('ucinewgame');
    this.sendCommand(`setoption name MultiPV value ${numMoves}`);
    this.sendCommand(`position fen ${fen}`);
    this.sendCommand(`go depth ${depth}`);

    return new Promise((resolve) => {
      const results: Map<number, TopMoveResult> = new Map();
      let collectedOutput = '';

      const handler = (data: Buffer) => {
        collectedOutput += data.toString();
        const lines = collectedOutput.split('\n');

        for (const line of lines) {
          // Parse info lines with multipv
          if (line.startsWith('info depth') && line.includes(' pv ')) {
            const depthMatch = line.match(/depth (\d+)/);
            const multipvMatch = line.match(/multipv (\d+)/);
            const scoreMatch = line.match(/score cp (-?\d+)/);
            const mateMatch = line.match(/score mate (-?\d+)/);
            const pvMatch = line.match(/ pv (.+)/);

            const currentDepth = depthMatch ? parseInt(depthMatch[1]) : 0;
            const pvIndex = multipvMatch ? parseInt(multipvMatch[1]) : 1;

            if (currentDepth >= depth - 2 && pvMatch) {
              const pv = pvMatch[1].trim().split(' ');
              const move = pv[0];
              
              let evaluation = 0;
              let isMate = false;
              let mateIn: number | undefined;

              if (scoreMatch) {
                evaluation = parseInt(scoreMatch[1]) / 100;
              }
              if (mateMatch) {
                const mateValue = parseInt(mateMatch[1]);
                evaluation = mateValue > 0 ? 999 : -999;
                isMate = true;
                mateIn = Math.abs(mateValue);
              }

              results.set(pvIndex, {
                move,
                evaluation,
                isMate,
                mateIn,
                principalVariation: pv,
              });
            }
          }

          if (line.startsWith('bestmove')) {
            this.process?.stdout?.removeListener('data', handler);
            this.process?.stdout?.on('data', (d: Buffer) => {
              this.outputBuffer += d.toString();
              this.processOutput();
            });

            // Reset MultiPV to 1 for future single-line analyses
            this.sendCommand('setoption name MultiPV value 1');

            // Convert map to sorted array
            const topMoves: TopMoveResult[] = [];
            for (let i = 1; i <= numMoves; i++) {
              const result = results.get(i);
              if (result) {
                topMoves.push(result);
              }
            }

            resolve(topMoves);
            return;
          }
        }
      };

      this.process?.stdout?.removeAllListeners('data');
      this.process?.stdout?.on('data', handler);
    });
  }
}

export const stockfishService = new StockfishService();
export type { PositionAnalysis, MoveAnalysisResult, TopMoveResult };
