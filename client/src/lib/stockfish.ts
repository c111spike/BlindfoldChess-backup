type MessageHandler = (line: string) => void;

export interface StockfishResult {
  bestMove: string;
  evaluation?: number;
  depth?: number;
  isFreeCapture?: boolean;
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
            // Configure hash table to 16MB for mobile memory management
            this.sendCommand('setoption name Hash value 16');
            console.log('[ClientStockfish] Set Hash table to 16MB for mobile optimization');
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
   * Get a move for a bot at a specific Elo rating.
   * Uses UCI_LimitStrength, UCI_Elo, and Skill Level for calibrated play.
   * Uses MultiPV for variation to prevent identical games.
   * @param fen - Current board position
   * @param elo - Target Elo rating (400-2600)
   * @returns Best move with optional variation
   */
  async getBotMove(
    fen: string,
    elo: number
  ): Promise<StockfishResult> {
    // Skill Level mapping based on Elo for more human-like play
    // Skill Level controls move randomization and error frequency
    const getSkillLevel = (targetElo: number): number => {
      if (targetElo <= 400) return 0;   // Pure chaos/blunders
      if (targetElo <= 600) return 2;   // Basic hanging pieces
      if (targetElo <= 800) return 4;   // Developing phase
      if (targetElo <= 1000) return 6;  // 1-2 move tactics
      if (targetElo <= 1200) return 8;  // Solid club player
      if (targetElo <= 1400) return 11; // Stronger focus
      if (targetElo <= 1600) return 14; // High positional pressure
      if (targetElo <= 1800) return 17; // Deep calculation
      if (targetElo <= 2000) return 18; // Elite phase
      if (targetElo <= 2200) return 19; // Master precision
      return 20; // GM/Boss level for 2400+
    };

    // MultiPV mapping - higher Elo uses fewer lines for deeper analysis
    const getMultiPV = (targetElo: number): number => {
      if (targetElo <= 600) return 5;   // Maximum chaos/variety
      if (targetElo <= 1000) return 4;  // Starting to narrow options
      if (targetElo <= 1400) return 3;  // Focus on best 3 lines
      if (targetElo <= 1800) return 2;  // High focus, rarely blunders
      return 1; // Elite: max depth, single best line for 2000+
    };

    // Nodes mapping - scales calculation depth with Elo
    const getNodes = (targetElo: number): number => {
      if (targetElo <= 400) return 500;      // Very low = pure chaos
      if (targetElo <= 600) return 1000;     // See basic hanging pieces
      if (targetElo <= 800) return 2000;     // Developing phase
      if (targetElo <= 1000) return 5000;    // 1-2 move tactics
      if (targetElo <= 1200) return 10000;   // Avoids simple mistakes
      if (targetElo <= 1400) return 20000;   // Stronger focus
      if (targetElo <= 1600) return 50000;   // Rarely blunders
      if (targetElo <= 1800) return 100000;  // Punishes mistakes
      if (targetElo <= 2000) return 250000;  // Elite calculation
      if (targetElo <= 2200) return 500000;  // Master precision
      if (targetElo <= 2400) return 1000000; // GM calculation
      return 1500000; // Boss: focused, deep, relentless
    };
    
    // Depth mapping for depth-limited bots (400-1600 Elo)
    const getDepth = (targetElo: number): number => {
      if (targetElo <= 400) return 1;
      if (targetElo <= 600) return 1;
      if (targetElo <= 800) return 2;
      if (targetElo <= 1000) return 3;
      if (targetElo <= 1200) return 4;
      if (targetElo <= 1400) return 5;
      if (targetElo <= 1600) return 6;
      return 0; // Unleashed mode for 1800+
    };

    const executeRequest = (): Promise<StockfishResult> => {
      return new Promise(async (resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('getBotMove timeout'));
        }, 30000);

        try {
          if (!this.isReady) {
            await this.init();
          }

          // Configure Stockfish for limited strength play
          const skillLevel = getSkillLevel(elo);
          const multiPV = getMultiPV(elo);
          const nodes = getNodes(elo);
          const depth = getDepth(elo);
          
          this.sendCommand(`setoption name Skill Level value ${skillLevel}`);
          this.sendCommand('setoption name UCI_LimitStrength value true');
          this.sendCommand(`setoption name UCI_Elo value ${Math.min(Math.max(elo, 400), 3200)}`);
          this.sendCommand(`setoption name MultiPV value ${multiPV}`);
          
          this.sendCommand('ucinewgame');
          this.sendCommand(`position fen ${fen}`);
          
          this.isSearching = true;
          // Depth-limited bots (400-1600): use depth + nodes, stops at whichever comes first
          // Unleashed bots (1800+): use nodes only for full calculation
          if (depth > 0) {
            this.sendCommand(`go depth ${depth} nodes ${nodes}`);
          } else {
            this.sendCommand(`go nodes ${nodes}`);
          }

          const results: Map<number, { move: string; eval?: number }> = new Map();

          const handler = (line: string) => {
            if (line.startsWith('info depth') && line.includes(' pv ')) {
              const multipvMatch = line.match(/multipv (\d+)/);
              const pvMatch = line.match(/ pv (\S+)/);
              const scoreMatch = line.match(/score cp (-?\d+)/);

              const pvIndex = multipvMatch ? parseInt(multipvMatch[1]) : 1;
              const move = pvMatch ? pvMatch[1] : null;
              const evaluation = scoreMatch ? parseInt(scoreMatch[1]) / 100 : undefined;

              if (move) {
                results.set(pvIndex, { move, eval: evaluation });
              }
            }

            if (line.startsWith('bestmove')) {
              clearTimeout(timeout);
              this.removeHandler(handler);
              this.isSearching = false;
              
              // Reset MultiPV, strength, and skill settings
              this.sendCommand('setoption name MultiPV value 1');
              this.sendCommand('setoption name UCI_LimitStrength value false');
              this.sendCommand('setoption name Skill Level value 20');

              // Select move with weighted randomness based on Elo
              // Lower Elo = more likely to pick suboptimal move
              let selectedMove: string | undefined;
              
              const topMoves = Array.from(results.values()).slice(0, multiPV);
              
              if (topMoves.length === 0) {
                // Fallback to bestmove line
                const moveMatch = line.match(/bestmove (\S+)/);
                selectedMove = moveMatch ? moveMatch[1] : undefined;
              } else if (topMoves.length === 1) {
                selectedMove = topMoves[0].move;
              } else {
                // Weighted random selection based on Elo
                // Higher Elo = more likely to pick best move
                const rand = Math.random() * 100;
                
                if (elo <= 600) {
                  // 40% best, 30% 2nd, 20% 3rd, 10% others
                  if (rand < 40) selectedMove = topMoves[0].move;
                  else if (rand < 70 && topMoves[1]) selectedMove = topMoves[1].move;
                  else if (rand < 90 && topMoves[2]) selectedMove = topMoves[2].move;
                  else selectedMove = topMoves[Math.min(Math.floor(rand / 25), topMoves.length - 1)].move;
                } else if (elo <= 1000) {
                  // 55% best, 25% 2nd, 15% 3rd, 5% others
                  if (rand < 55) selectedMove = topMoves[0].move;
                  else if (rand < 80 && topMoves[1]) selectedMove = topMoves[1].move;
                  else if (rand < 95 && topMoves[2]) selectedMove = topMoves[2].move;
                  else selectedMove = topMoves[Math.min(Math.floor(rand / 25), topMoves.length - 1)].move;
                } else if (elo <= 1400) {
                  // 70% best, 20% 2nd, 10% 3rd
                  if (rand < 70) selectedMove = topMoves[0].move;
                  else if (rand < 90 && topMoves[1]) selectedMove = topMoves[1].move;
                  else if (topMoves[2]) selectedMove = topMoves[2].move;
                  else selectedMove = topMoves[0].move;
                } else if (elo <= 1800) {
                  // 85% best, 12% 2nd, 3% 3rd
                  if (rand < 85) selectedMove = topMoves[0].move;
                  else if (rand < 97 && topMoves[1]) selectedMove = topMoves[1].move;
                  else if (topMoves[2]) selectedMove = topMoves[2].move;
                  else selectedMove = topMoves[0].move;
                } else {
                  // 95%+ best move for 2000+
                  if (rand < 95) selectedMove = topMoves[0].move;
                  else if (topMoves[1]) selectedMove = topMoves[1].move;
                  else selectedMove = topMoves[0].move;
                }
              }

              if (selectedMove) {
                resolve({
                  bestMove: selectedMove,
                  evaluation: results.get(1)?.eval,
                  isFreeCapture: false
                });
              } else {
                reject(new Error('Failed to get bot move'));
              }
            }
          };

          this.addHandler(handler);
        } catch (error) {
          clearTimeout(timeout);
          this.isSearching = false;
          this.sendCommand('setoption name MultiPV value 1');
          this.sendCommand('setoption name UCI_LimitStrength value false');
          this.sendCommand('setoption name Skill Level value 20');
          reject(error);
        }
      });
    };

    const thisRequest = this.requestQueue.then(executeRequest, executeRequest);
    this.requestQueue = thisRequest.catch(() => {});
    return thisRequest;
  }

  /**
   * Get a move using depth-limited search.
   * This provides more predictable difficulty than node-based search.
   * @param fen - Current board position
   * @param depth - Search depth (1-6)
   * @returns Best move at that depth
   */
  async getDepthLimitedMove(
    fen: string,
    depth: number
  ): Promise<StockfishResult> {
    const executeRequest = (): Promise<StockfishResult> => {
      return new Promise(async (resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('getDepthLimitedMove timeout'));
        }, 30000);

        try {
          if (!this.isReady) {
            await this.init();
          }

          // Reset to full strength for depth-limited search
          this.sendCommand('setoption name UCI_LimitStrength value false');
          this.sendCommand('setoption name Skill Level value 20');
          this.sendCommand('setoption name MultiPV value 1');
          
          this.sendCommand('ucinewgame');
          this.sendCommand(`position fen ${fen}`);
          
          this.isSearching = true;
          this.sendCommand(`go depth ${depth}`);

          let bestMove: string | undefined;
          let evaluation: number | undefined;

          const handler = (line: string) => {
            if (line.startsWith('info depth') && line.includes(' pv ')) {
              const pvMatch = line.match(/ pv (\S+)/);
              const scoreMatch = line.match(/score cp (-?\d+)/);
              const mateMatch = line.match(/score mate (-?\d+)/);

              if (pvMatch) {
                bestMove = pvMatch[1];
              }
              if (scoreMatch) {
                evaluation = parseInt(scoreMatch[1]) / 100;
              } else if (mateMatch) {
                const mateValue = parseInt(mateMatch[1]);
                evaluation = mateValue > 0 ? 100 : -100;
              }
            }

            if (line.startsWith('bestmove')) {
              clearTimeout(timeout);
              this.removeHandler(handler);
              this.isSearching = false;

              const moveMatch = line.match(/bestmove (\S+)/);
              if (moveMatch) {
                bestMove = moveMatch[1];
              }

              if (bestMove) {
                resolve({
                  bestMove,
                  evaluation,
                  isFreeCapture: false
                });
              } else {
                reject(new Error('Failed to get depth-limited move'));
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
