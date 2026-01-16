import { Chess } from 'chess.js';
import { Browser } from '@capacitor/browser';

export interface GameExportData {
  pgn: string;
  playerColor: 'white' | 'black';
  botElo: number;
  result: string;
  date?: Date;
}

export function generatePgn(
  moveHistory: string[],
  playerColor: 'white' | 'black',
  botElo: number,
  result: 'white_win' | 'black_win' | 'draw' | null,
  date?: Date
): string {
  const game = new Chess();
  
  for (const move of moveHistory) {
    try {
      game.move(move);
    } catch (e) {
      console.warn('Failed to replay move:', move, e);
    }
  }
  
  const gameDate = date || new Date();
  const dateStr = gameDate.toISOString().split('T')[0].replace(/-/g, '.');
  
  const playerName = playerColor === 'white' ? 'Player' : `Bot ${botElo}`;
  const opponentName = playerColor === 'white' ? `Bot ${botElo}` : 'Player';
  
  let resultStr = '*';
  if (result === 'white_win') resultStr = '1-0';
  else if (result === 'black_win') resultStr = '0-1';
  else if (result === 'draw') resultStr = '1/2-1/2';
  
  const headers = [
    `[Event "Blindfold Chess Training"]`,
    `[Site "Blindfold Chess App"]`,
    `[Date "${dateStr}"]`,
    `[White "${playerColor === 'white' ? 'Player' : `Bot ${botElo}`}"]`,
    `[Black "${playerColor === 'black' ? 'Player' : `Bot ${botElo}`}"]`,
    `[Result "${resultStr}"]`,
    `[WhiteElo "${playerColor === 'white' ? '?' : botElo}"]`,
    `[BlackElo "${playerColor === 'black' ? '?' : botElo}"]`,
  ];
  
  const movesText = game.pgn().split('\n\n').pop() || '';
  
  return headers.join('\n') + '\n\n' + movesText + ' ' + resultStr;
}

export async function sharePgn(pgn: string, filename?: string): Promise<boolean> {
  const fname = filename || `blindfold-chess-${Date.now()}.pgn`;
  
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      const blob = new Blob([pgn], { type: 'application/vnd.chess-pgn' });
      const file = new File([blob], fname, { type: 'application/vnd.chess-pgn' });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Blindfold Chess Game',
        });
        return true;
      }
      
      await navigator.share({
        text: pgn,
        title: 'Blindfold Chess Game',
      });
      return true;
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        return false;
      }
      console.warn('Share API failed, falling back to clipboard:', e);
    }
  }
  
  return copyPgnToClipboard(pgn);
}

export async function copyPgnToClipboard(pgn: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(pgn);
      return true;
    }
    
    const textarea = document.createElement('textarea');
    textarea.value = pgn;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (e) {
    console.error('Failed to copy PGN to clipboard:', e);
    return false;
  }
}

export async function downloadPgn(pgn: string, filename?: string): Promise<boolean> {
  const fname = filename || `blindfold-chess-${Date.now()}.pgn`;
  
  try {
    const blob = new Blob([pgn], { type: 'application/vnd.chess-pgn' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fname;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    return true;
  } catch (e) {
    console.error('Failed to download PGN:', e);
    return false;
  }
}
