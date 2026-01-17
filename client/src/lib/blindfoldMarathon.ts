export interface MarathonScenario {
  id: string;
  white: string;
  black: string;
  pgnMoves: string[];
  solution: string;
  description: string;
}

function countMoves(moves: string[]): number {
  return moves.length;
}

export const MARATHON_SCENARIOS: MarathonScenario[] = [
  {
    id: "scholars_mate",
    white: "Training",
    black: "Puzzle",
    description: "Scholar's Mate Defense",
    pgnMoves: [
      "e4", "e5", "Bc4", "Nc6", "Qh5", "g6", "Qf3", "Nf6", "Qb3", "Nd4"
    ],
    solution: "Qxf7#"
  },
  {
    id: "legal_trap",
    white: "Training", 
    black: "Puzzle",
    description: "Legal's Mate Trap",
    pgnMoves: [
      "e4", "e5", "Nf3", "d6", "Bc4", "Bg4", "Nc3", "g6", "Nxe5", "Bxd1", "Bxf7+", "Ke7"
    ],
    solution: "Nd5#"
  },
  {
    id: "blackburne_shilling",
    white: "Training",
    black: "Puzzle", 
    description: "Blackburne Shilling Gambit",
    pgnMoves: [
      "e4", "e5", "Nf3", "Nc6", "Bc4", "Nd4", "Nxe5", "Qg5", "Nxf7", "Qxg2",
      "Rf1", "Qxe4+", "Be2", "Nf3+"
    ],
    solution: "Kf1"
  },
  {
    id: "fried_liver",
    white: "Training",
    black: "Puzzle",
    description: "Fried Liver Attack",
    pgnMoves: [
      "e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "Ng5", "d5", "exd5", "Nxd5",
      "Nxf7", "Kxf7", "Qf3+", "Ke6", "Nc3", "Nb4"
    ],
    solution: "Qe4+"
  },
  {
    id: "opera_game",
    white: "Paul Morphy",
    black: "Duke of Brunswick",
    description: "The Opera Game - A brilliant attack",
    pgnMoves: [
      "e4", "e5", "Nf3", "d6", "d4", "Bg4", "dxe5", "Bxf3", "Qxf3", "dxe5", 
      "Bc4", "Nf6", "Qb3", "Qe7", "Nc3", "c6", "Bg5", "b5", "Nxb5", "cxb5", 
      "Bxb5+", "Nbd7", "O-O-O", "Rd8", "Rxd7", "Rxd7", "Rd1", "Qe6", "Bxd7+", "Nxd7"
    ],
    solution: "Qb8+"
  },
  {
    id: "short_trap",
    white: "Training",
    black: "Puzzle",
    description: "A quick opening trap",
    pgnMoves: [
      "e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6", "d4", "exd4", 
      "cxd4", "Bb4+", "Nc3", "Nxe4", "O-O", "Nxc3", "bxc3", "Bxc3", "Ba3", "Bxa1", 
      "Re1+", "Ne7"
    ],
    solution: "Rxe7+"
  },
  {
    id: "immortal_game",
    white: "Adolf Anderssen",
    black: "Lionel Kieseritzky",
    description: "The Immortal Game",
    pgnMoves: [
      "e4", "e5", "f4", "exf4", "Bc4", "Qh4+", "Kf1", "b5", "Bxb5", "Nf6", 
      "Nf3", "Qh6", "d3", "Nh5", "Nh4", "Qg5", "Nf5", "c6", "g4", "Nf6", 
      "Rg1", "cxb5", "h4", "Qg6", "h5", "Qg5", "Qf3", "Ng8", "Bxf4", "Qf6", 
      "Nc3", "Bc5", "Nd5", "Qxb2", "Bd6", "Bxg1", "e5", "Qxa1+", "Ke2", "Na6", 
      "Nxg7+", "Kd8", "Qf6+", "Nxf6", "Be7+"
    ],
    solution: "Kc7"
  },
  {
    id: "evergreen_game",
    white: "Adolf Anderssen",
    black: "Jean Dufresne",
    description: "The Evergreen Game",
    pgnMoves: [
      "e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "b4", "Bxb4", "c3", "Ba5",
      "d4", "exd4", "O-O", "d3", "Qb3", "Qf6", "e5", "Qg6", "Re1", "Nge7",
      "Ba3", "b5", "Qxb5", "Rb8", "Qa4", "Bb6", "Nbd2", "Bb7", "Ne4", "Qf5",
      "Bxd3", "Qh5", "Nf6+", "gxf6", "exf6", "Rg8", "Rad1", "Qxf3", "Rxe7+", "Nxe7",
      "Qxd7+", "Kxd7", "Bf5+", "Ke8", "Bd7+", "Kf8"
    ],
    solution: "Bxe7#"
  },
  {
    id: "game_of_century",
    white: "Donald Byrne",
    black: "Bobby Fischer",
    description: "The Game of the Century",
    pgnMoves: [
      "Nf3", "Nf6", "c4", "g6", "Nc3", "Bg7", "d4", "O-O", "Bf4", "d5",
      "Qb3", "dxc4", "Qxc4", "c6", "e4", "Nbd7", "Rd1", "Nb6", "Qc5", "Bg4",
      "Bg5", "Na4", "Qa3", "Nxc3", "bxc3", "Nxe4", "Bxe7", "Qb6", "Bc4", "Nxc3",
      "Bc5", "Rfe8+", "Kf1", "Be6", "Bxb6", "Bxc4+", "Kg1", "Ne2+", "Kf1", "Nxd4+",
      "Kg1", "Ne2+", "Kf1", "Nc3+", "Kg1", "axb6", "Qb4", "Ra4", "Qxb6", "Nxd1",
      "h3", "Rxa2", "Kh2", "Nxf2", "Re1", "Rxe1", "Qd8+", "Bf8", "Nxe1", "Bd5",
      "Nf3", "Ne4", "Qb8", "b5", "h4", "h5", "Ne5", "Kg7"
    ],
    solution: "Kg1"
  },
  {
    id: "kasparov_topalov",
    white: "Garry Kasparov",
    black: "Veselin Topalov",
    description: "Kasparov's Immortal",
    pgnMoves: [
      "e4", "d6", "d4", "Nf6", "Nc3", "g6", "Be3", "Bg7", "Qd2", "c6",
      "f3", "b5", "Nge2", "Nbd7", "Bh6", "Bxh6", "Qxh6", "Bb7", "a3", "e5",
      "O-O-O", "Qe7", "Kb1", "a6", "Nc1", "O-O-O", "Nb3", "exd4", "Rxd4", "c5",
      "Rd1", "Nb6", "g3", "Kb8", "Na5", "Ba8", "Bh3", "d5", "Qf4+", "Ka7",
      "Rhe1", "d4", "Nd5", "Nbxd5", "exd5", "Qd6", "Rxd4", "cxd4", "Re7+", "Kb6",
      "Qxd4+", "Kxa5", "b4+", "Ka4", "Qc3", "Qxd5", "Ra7", "Bb7", "Rxb7", "Qc4",
      "Qxf6", "Kxa3", "Qxa6+", "Kxb4", "c3+", "Kxc3", "Qa1+", "Kd2", "Qb2+", "Kd1",
      "Bf1", "Rd2", "Rd7", "Rxd7", "Bxc4", "bxc4", "Qxh8", "Rd3"
    ],
    solution: "Qa8"
  },
  {
    id: "deep_blue_game6",
    white: "Deep Blue",
    black: "Garry Kasparov",
    description: "Deep Blue vs Kasparov Game 6",
    pgnMoves: [
      "e4", "c6", "d4", "d5", "Nc3", "dxe4", "Nxe4", "Nd7", "Ng5", "Ngf6",
      "Bd3", "e6", "N1f3", "h6", "Nxe6", "Qe7", "O-O", "fxe6", "Bg6+", "Kd8",
      "Bf4", "b5", "a4", "Bb7", "Re1", "Nd5", "Bg3", "Kc8", "axb5", "cxb5",
      "Qd3", "Bc6", "Bf5", "exf5", "Rxe7", "Bxe7"
    ],
    solution: "c4"
  },
  {
    id: "tal_larsen",
    white: "Mikhail Tal",
    black: "Bent Larsen",
    description: "Tal's Brilliant Exchange Sacrifice",
    pgnMoves: [
      "e4", "c5", "Nf3", "Nc6", "d4", "cxd4", "Nxd4", "e6", "Nc3", "d6",
      "Be3", "Nf6", "f4", "Be7", "Qf3", "O-O", "O-O-O", "Qc7", "Nb3", "a6",
      "g4", "b5", "g5", "Nd7", "Bd3", "Nb6", "Qh3", "b4", "Na4", "Nxa4",
      "f5", "e5", "f6", "gxf6", "gxf6", "Bxf6", "Bxh7+", "Kxh7", "Qh5+", "Kg7",
      "Rdg1+", "Kf8", "Bh6+", "Bg7", "Rxg7", "Qb6", "Nd4", "Qxd4", "Rxf7+", "Kxf7",
      "Qh7+", "Ke8", "Re1", "Qf6", "Qxc2", "Ra7", "Qg6+", "Rf7", "Qg8+", "Rf8",
      "Bg7", "Qf1", "Rxf1", "Rxg8"
    ],
    solution: "Qe6+"
  }
];

export type DifficultyTier = '10-20' | '20-30' | '30-40' | '40-50' | '50-60' | '60-70';

export function getDifficultyTiers(): { value: DifficultyTier; label: string; minMoves: number; maxMoves: number }[] {
  return [
    { value: '10-20', label: '10-20 moves', minMoves: 10, maxMoves: 20 },
    { value: '20-30', label: '20-30 moves', minMoves: 20, maxMoves: 30 },
    { value: '30-40', label: '30-40 moves', minMoves: 30, maxMoves: 40 },
    { value: '40-50', label: '40-50 moves', minMoves: 40, maxMoves: 50 },
    { value: '50-60', label: '50-60 moves', minMoves: 50, maxMoves: 60 },
    { value: '60-70', label: '60-70 moves', minMoves: 60, maxMoves: 70 }
  ];
}

export function getRandomMarathon(minMoves: number, maxMoves: number): MarathonScenario {
  const candidates = MARATHON_SCENARIOS.filter(s => {
    const moves = countMoves(s.pgnMoves);
    return moves >= minMoves && moves < maxMoves;
  });

  if (candidates.length > 0) {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  const sortedByLength = [...MARATHON_SCENARIOS].sort((a, b) => b.pgnMoves.length - a.pgnMoves.length);
  const longest = sortedByLength[0];
  
  return {
    ...longest,
    description: `${longest.description} (Best available for ${minMoves}-${maxMoves} moves)`
  };
}
