import { spawn, ChildProcess } from 'child_process';

interface StockfishResult {
  bestMove: string;
  evaluation?: number;
  depth?: number;
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
}

export const stockfishService = new StockfishService();
