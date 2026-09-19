import type { Cell, Dir, Grid, Point } from './types';
import type { RNG } from './rng';

export const OPPOSITE: Record<Dir, Dir> = { N: 'S', S: 'N', E: 'W', W: 'E' };
export const DELTA: Record<Dir, Point> = {
  N: { x: 0, y: -1 },
  S: { x: 0, y: 1 },
  E: { x: 1, y: 0 },
  W: { x: -1, y: 0 },
};
export const DIRS: Dir[] = ['N', 'S', 'E', 'W'];

export function generateMaze(width: number, height: number, rng: RNG): Grid {
  const grid: Grid = [];
  for (let y = 0; y < height; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < width; x++) {
      row.push({ x, y, walls: { N: true, S: true, E: true, W: true }, visited: false });
    }
    grid.push(row);
  }

  const stack: Cell[] = [];
  const start = grid[0][0];
  start.visited = true;
  stack.push(start);

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const candidates: { dir: Dir; cell: Cell }[] = [];
    for (const dir of DIRS) {
      const d = DELTA[dir];
      const nx = current.x + d.x;
      const ny = current.y + d.y;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const neighbor = grid[ny][nx];
      if (!neighbor.visited) candidates.push({ dir, cell: neighbor });
    }
    if (candidates.length === 0) {
      stack.pop();
      continue;
    }
    const choice = candidates[Math.floor(rng() * candidates.length)];
    current.walls[choice.dir] = false;
    choice.cell.walls[OPPOSITE[choice.dir]] = false;
    choice.cell.visited = true;
    stack.push(choice.cell);
  }

  const extraPasses = Math.floor((width * height) / 12);
  for (let i = 0; i < extraPasses; i++) {
    const x = Math.floor(rng() * width);
    const y = Math.floor(rng() * height);
    const dir = DIRS[Math.floor(rng() * DIRS.length)];
    const d = DELTA[dir];
    const nx = x + d.x;
    const ny = y + d.y;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
    grid[y][x].walls[dir] = false;
    grid[ny][nx].walls[OPPOSITE[dir]] = false;
  }

  return grid;
}

export function neighborsOf(grid: Grid, cell: Point): Point[] {
  const c = grid[cell.y][cell.x];
  const out: Point[] = [];
  for (const dir of DIRS) {
    if (c.walls[dir]) continue;
    const d = DELTA[dir];
    const nx = c.x + d.x;
    const ny = c.y + d.y;
    if (ny >= 0 && ny < grid.length && nx >= 0 && nx < grid[0].length) {
      out.push({ x: nx, y: ny });
    }
  }
  return out;
}

export function bfsDistances(grid: Grid, start: Point): number[][] {
  const height = grid.length;
  const width = grid[0].length;
  const dist: number[][] = Array.from({ length: height }, () => new Array(width).fill(-1));
  dist[start.y][start.x] = 0;
  const queue: Point[] = [start];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    for (const n of neighborsOf(grid, cur)) {
      if (dist[n.y][n.x] === -1) {
        dist[n.y][n.x] = dist[cur.y][cur.x] + 1;
        queue.push(n);
      }
    }
  }
  return dist;
}

export function findFarthest(grid: Grid, start: Point): Point {
  const dist = bfsDistances(grid, start);
  let best = start;
  let bestDist = -1;
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[0].length; x++) {
      if (dist[y][x] > bestDist) {
        bestDist = dist[y][x];
        best = { x, y };
      }
    }
  }
  return best;
}

export function shortestStep(grid: Grid, from: Point, to: Point): Point {
  if (from.x === to.x && from.y === to.y) return from;
  const dist = bfsDistances(grid, to);
  let best = from;
  let bestDist = dist[from.y][from.x];
  for (const n of neighborsOf(grid, from)) {
    const d = dist[n.y][n.x];
    if (d !== -1 && d < bestDist) {
      bestDist = d;
      best = n;
    }
  }
  return best;
}

export function pickFarPoints(grid: Grid, start: Point, count: number, minDistance: number): Point[] {
  const dist = bfsDistances(grid, start);
  const candidates: { p: Point; d: number }[] = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[0].length; x++) {
      if (dist[y][x] >= minDistance) candidates.push({ p: { x, y }, d: dist[y][x] });
    }
  }
  candidates.sort((a, b) => b.d - a.d);
  const out: Point[] = [];
  const step = Math.max(1, Math.floor(candidates.length / (count * 3 || 1)));
  for (let i = 0; i < candidates.length && out.length < count; i += step) {
    out.push(candidates[i].p);
  }
  let i = 0;
  while (out.length < count && candidates.length > 0) {
    out.push(candidates[i % candidates.length].p);
    i++;
  }
  return out;
}
