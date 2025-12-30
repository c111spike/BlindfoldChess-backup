type MessageHandler = (line: string) => void;

export interface StockfishResult {
  bestMove: string;
  evaluation?: number;
  depth?: number;
}

export interface PositionAnalysis {
  evaluation: number;
  bestMove: string;
  bestMoveEval: number;
  principalVariation: string[];
  depth: number;
  isMate: boolean;
  mateIn?: number;
}

export interface TopMoveResult {
  move: string;
  evaluation: number;
  isMate: boolean;
  mateIn?: number;
  principalVariation: string[];
}

const MAX_EVAL = 10;

function normalizeEvaluation(rawEval: number): number {
  return Math.max(-MAX_EVAL, Math.min(MAX_EVAL, rawEval));
}

class ClientStockfish {
  private worker: Worker | null = null;
  private isReady: boolean = false;
  private isSearching: boolean = false;
  private messageHandlers: MessageHandler[] = [];
  private initPromise: Promise<void> | null = null;
  private requestQueue: Promise<any> = Promise.resolve();

  async init(): Promise<void> {
    if (this.isReady) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      try {
        const wasmSupported = typeof WebAssembly === 'object' &&
          WebAssembly.validate(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));

        if (!wasmSupported) {
          console.warn('[ClientStockfish] WebAssembly not supported, using slower JS fallback');
        }

        const stockfishPath = '/stockfish/stockfish-17.1-lite-single-03e3232.js';

        this.worker = new Worker(stockfishPath);

        this.worker.onmessage = (e: MessageEvent) => {
          const line = typeof e.data === 'string' ? e.data : '';
          for (const handler of this.messageHandlers) {
            handler(line);
          }
        };

        this.worker.onerror = (err) => {
          console.error('[ClientStockfish] Worker error:', err);
          reject(err);
        };

        this.sendCommand('uci');

        let receivedUciOk = false;
        const initHandler = (line: string) => {
          if (line === 'uciok') {
            receivedUciOk = true;
            this.sendCommand('isready');
          }
          if (line === 'readyok' && receivedUciOk) {
            this.removeHandler(initHandler);
            this.isReady = true;
            console.log('[ClientStockfish] Engine ready');
            resolve();
          }
        };

        this.addHandler(initHandler);

        setTimeout(() => {
          if (!this.isReady) {
            reject(new Error('Stockfish initialization timeout'));
          }
        }, 30000);
      } catch (err) {
        reject(err);
      }
    });

    return this.initPromise;
  }

  private addHandler(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  private removeHandler(handler: MessageHandler): void {
    const index = this.messageHandlers.indexOf(handler);
    if (index > -1) {
      this.messageHandlers.splice(index, 1);
    }
  }

  private sendCommand(cmd: string): void {
    if (this.worker) {
      this.worker.postMessage(cmd);
    }
  }

  async getBestMove(
    fen: string,
    options: {
      depth?: number;
      nodes?: number;
      moveTime?: number;
      skillLevel?: number;
    } = {}
  ): Promise<StockfishResult> {
    const executeRequest = (): Promise<StockfishResult> => {
      return new Promise(async (resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('getBestMove timeout'));
        }, 30000);

        try {
          if (!this.isReady) {
            await this.init();
          }

          if (options.skillLevel !== undefined) {
            this.sendCommand(`setoption name Skill Level value ${options.skillLevel}`);
          }

          this.sendCommand('ucinewgame');
          this.sendCommand(`position fen ${fen}`);

          let goCommand = 'go';
          if (options.depth) goCommand += ` depth ${options.depth}`;
          else if (options.nodes) goCommand += ` nodes ${options.nodes}`;
          else if (options.moveTime) goCommand += ` movetime ${options.moveTime}`;
          else goCommand += ' depth 15';

          this.isSearching = true;
          this.sendCommand(goCommand);

          let evaluation: number | undefined;
          let depth: number | undefined;

          const handler = (line: string) => {
            if (line.startsWith('info depth')) {
              const depthMatch = line.match(/depth (\d+)/);
              const scoreMatch = line.match(/score cp (-?\d+)/);
              const mateMatch = line.match(/score mate (-?\d+)/);

              if (depthMatch) depth = parseInt(depthMatch[1]);
              if (scoreMatch) evaluation = parseInt(scoreMatch[1]) / 100;
              if (mateMatch) evaluation = parseInt(mateMatch[1]) > 0 ? 100 : -100;
            }

            if (line.startsWith('bestmove')) {
              clearTimeout(timeout);
              this.removeHandler(handler);
              this.isSearching = false;

              const moveMatch = line.match(/bestmove (\S+)/);
              if (moveMatch) {
                resolve({
                  bestMove: moveMatch[1],
                  evaluation,
                  depth
                });
              } else {
                reject(new Error('Failed to parse bestmove'));
              }
            }
          };

          this.addHandler(handler);
        } catch (error) {
          clearTimeout(timeout);
          this.isSearching = false;
          reject(error);
        }
      });
    };

    const thisRequest = this.requestQueue.then(executeRequest, executeRequest);
    this.requestQueue = thisRequest.catch(() => {});
    return thisRequest;
  }

  async analyzePosition(fen: string, nodes: number = 1000000): Promise<PositionAnalysis> {
    const executeRequest = (): Promise<PositionAnalysis> => {
      return new Promise(async (resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('analyzePosition timeout'));
        }, 60000);

        try {
          if (!this.isReady) {
            await this.init();
          }

          this.sendCommand('ucinewgame');
          this.sendCommand(`position fen ${fen}`);
          this.isSearching = true;
          this.sendCommand(`go nodes ${nodes}`);

          let evaluation = 0;
          let currentDepth = 0;
          let bestMove = '';
          let pv: string[] = [];
          let isMate = false;
          let mateIn: number | undefined;

          const handler = (line: string) => {
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
              clearTimeout(timeout);
              this.removeHandler(handler);
              this.isSearching = false;

              const moveMatch = line.match(/bestmove (\S+)/);
              if (moveMatch) {
                bestMove = moveMatch[1];
                resolve({
                  evaluation: normalizeEvaluation(evaluation),
                  bestMove,
                  bestMoveEval: normalizeEvaluation(evaluation),
                  principalVariation: pv,
                  depth: currentDepth,
                  isMate,
                  mateIn
                });
              } else {
                reject(new Error('Failed to parse bestmove'));
              }
            }
          };

          this.addHandler(handler);
        } catch (error) {
          clearTimeout(timeout);
          this.isSearching = false;
          reject(error);
        }
      });
    };

    const thisRequest = this.requestQueue.then(executeRequest, executeRequest);
    this.requestQueue = thisRequest.catch(() => {});
    return thisRequest;
  }

  async getTopMoves(
    fen: string, 
    numMoves: number = 3, 
    nodes: number = 1000000,
    sideToMove?: 'w' | 'b'
  ): Promise<TopMoveResult[]> {
    // When sideToMove is provided, normalize evaluations to White's perspective
    // Stockfish returns evals from side-to-move POV:
    // - Positive = good for side to move
    // - Negative = bad for side to move
    // We want: Positive = good for White, Negative = good for Black
    const perspectiveMultiplier = sideToMove === undefined ? 1 : (sideToMove === 'w' ? 1 : -1);
    
    const executeRequest = (): Promise<TopMoveResult[]> => {
      return new Promise(async (resolve, reject) => {
        const timeout = setTimeout(() => {
          this.sendCommand('setoption name MultiPV value 1');
          resolve([]);
        }, 30000);

        try {
          if (!this.isReady) {
            await this.init();
          }

          this.sendCommand('stop');
          this.sendCommand('ucinewgame');
          this.sendCommand(`setoption name MultiPV value ${numMoves}`);
          this.sendCommand(`position fen ${fen}`);
          this.isSearching = true;
          this.sendCommand(`go nodes ${nodes}`);

          const results: Map<number, TopMoveResult> = new Map();

          const handler = (line: string) => {
            if (line.startsWith('info depth') && line.includes(' pv ')) {
              const multipvMatch = line.match(/multipv (\d+)/);
              const scoreMatch = line.match(/score cp (-?\d+)/);
              const mateMatch = line.match(/score mate (-?\d+)/);
              const pvMatch = line.match(/ pv (.+)/);

              const pvIndex = multipvMatch ? parseInt(multipvMatch[1]) : 1;

              if (pvMatch) {
                const pv = pvMatch[1].trim().split(' ');
                const move = pv[0];

                let evaluation = 0;
                let isMate = false;
                let mateIn: number | undefined;

                if (scoreMatch) {
                  // Raw centipawn score from Stockfish (side-to-move perspective)
                  const rawEval = parseInt(scoreMatch[1]) / 100;
                  // Normalize to White's perspective if sideToMove was provided
                  evaluation = rawEval * perspectiveMultiplier;
                }
                if (mateMatch) {
                  const mateValue = parseInt(mateMatch[1]);
                  // Raw mate value from Stockfish:
                  // Positive = side to move delivers mate
                  // Negative = side to move gets mated
                  // Normalize to White's perspective if sideToMove was provided
                  const rawMateEval = mateValue > 0 ? 999 : -999;
                  evaluation = rawMateEval * perspectiveMultiplier;
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
              clearTimeout(timeout);
              this.removeHandler(handler);
              this.isSearching = false;
              this.sendCommand('setoption name MultiPV value 1');

              const topMoves: TopMoveResult[] = [];
              for (let i = 1; i <= numMoves; i++) {
                const result = results.get(i);
                if (result) {
                  topMoves.push(result);
                }
              }

              resolve(topMoves);
            }
          };

          this.addHandler(handler);
        } catch (error) {
          clearTimeout(timeout);
          this.isSearching = false;
          this.sendCommand('setoption name MultiPV value 1');
          reject(error);
        }
      });
    };

    const thisRequest = this.requestQueue.then(executeRequest, executeRequest);
    this.requestQueue = thisRequest.catch(() => {});
    return thisRequest;
  }

  /**
   * Stop any active search immediately.
   * Call this before starting a new search or when navigating away from the game.
   * Keeps WASM module loaded for fast restart, just halts CPU-intensive calculation.
   */
  stopAnalysis(): void {
    if (this.worker && this.isSearching) {
      this.sendCommand('stop');
      this.isSearching = false;
      console.debug('[ClientStockfish] Analysis halted safely.');
    }
  }

  shutdown(): void {
    if (this.worker) {
      this.sendCommand('quit');
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
      this.initPromise = null;
    }
  }

  isInitialized(): boolean {
    return this.isReady;
  }
}

export const clientStockfish = new ClientStockfish();
