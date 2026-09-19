export type Dir = 'N' | 'S' | 'E' | 'W';

export interface Cell {
  x: number;
  y: number;
  walls: Record<Dir, boolean>;
  visited: boolean;
}

export type Grid = Cell[][];

export interface Point {
  x: number;
  y: number;
}

export interface PlayerState {
  id: string;
  name: string;
  color: string;
  cx: number;
  cy: number;
  px: number;
  py: number;
  facing: Dir;
  moving: boolean;
}

export type GamePhase = 'menu' | 'lobby' | 'playing' | 'win' | 'gameover';
export type GameMode = 'solo' | 'multi';

export interface JumpscareEvent {
  kind: 'ambient' | 'monster' | 'trap' | 'sanity' | 'prank';
  at: number;
}
