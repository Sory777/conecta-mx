import type { Dir, Grid, Point } from './types';
import { DELTA, shortestStep } from './maze';

export interface Mover {
  cx: number;
  cy: number;
  px: number;
  py: number;
  fromPx: number;
  fromPy: number;
  toPx: number;
  toPy: number;
  startT: number;
  duration: number;
  facing: Dir;
  moving: boolean;
}

export function newMover(cx: number, cy: number, cell: number, facing: Dir = 'S'): Mover {
  const px = cx * cell + cell / 2;
  const py = cy * cell + cell / 2;
  return { cx, cy, px, py, fromPx: px, fromPy: py, toPx: px, toPy: py, startT: 0, duration: 1, facing, moving: false };
}

export function canMove(grid: Grid, cell: Point, dir: Dir): boolean {
  return !grid[cell.y][cell.x].walls[dir];
}

export function beginMove(m: Mover, cellSize: number, dir: Dir, t: number, duration: number) {
  const d = DELTA[dir];
  m.fromPx = m.px;
  m.fromPy = m.py;
  m.cx += d.x;
  m.cy += d.y;
  m.toPx = m.cx * cellSize + cellSize / 2;
  m.toPy = m.cy * cellSize + cellSize / 2;
  m.startT = t;
  m.duration = duration;
  m.facing = dir;
  m.moving = true;
}

export function updateMover(m: Mover, t: number) {
  if (!m.moving) return;
  const elapsed = t - m.startT;
  const ratio = Math.min(1, elapsed / m.duration);
  m.px = m.fromPx + (m.toPx - m.fromPx) * ratio;
  m.py = m.fromPy + (m.toPy - m.fromPy) * ratio;
  if (ratio >= 1) m.moving = false;
}

export function directionTowards(grid: Grid, from: Point, to: Point): Dir | null {
  const next = shortestStep(grid, from, to);
  if (next.x === from.x && next.y === from.y) return null;
  for (const dir of Object.keys(DELTA) as Dir[]) {
    const d = DELTA[dir];
    if (from.x + d.x === next.x && from.y + d.y === next.y) return dir;
  }
  return null;
}

export function cellDistance(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
