import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Copy,
  DoorOpen,
  Ghost,
  Heart,
  KeyRound,
  LogOut,
  Skull,
  Users,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { useToast } from '../components/Toast';
import { JumpscareOverlay } from '../components/JumpscareOverlay';
import { generateMaze, pickFarPoints, findFarthest, DELTA } from '../lib/horrorGame/maze';
import { mulberry32, seedFromString, pick as pickRng } from '../lib/horrorGame/rng';
import { beginMove, canMove, cellDistance, directionTowards, newMover, updateMover, type Mover } from '../lib/horrorGame/engine';
import { horrorSound } from '../lib/horrorGame/soundEngine';
import { HorrorRoom, PLAYER_COLORS, randomPlayerId, type RemotePlayerInfo } from '../lib/horrorGame/multiplayer';
import type { Dir, GamePhase, GameMode, Grid, Point } from '../lib/horrorGame/types';

const MAZE_W = 13;
const MAZE_H = 13;
const CELL = 42;
const CANVAS_W = 640;
const CANVAS_H = 400;
const KEY_COUNT = 3;
const PLAYER_MOVE_MS = 150;
const MAX_SANITY = 100;
const CATCH_SANITY_LOSS = 30;
const CATCH_INVULN_MS = 2500;
const PRANK_COOLDOWN_MS = 15000;

type RemoteMover = Mover & { color: string; name: string };

interface KeyItem {
  id: number;
  x: number;
  y: number;
}

function dirFromKey(key: string): Dir | null {
  if (key === 'ArrowUp' || key === 'w' || key === 'W') return 'N';
  if (key === 'ArrowDown' || key === 's' || key === 'S') return 'S';
  if (key === 'ArrowLeft' || key === 'a' || key === 'A') return 'W';
  if (key === 'ArrowRight' || key === 'd' || key === 'D') return 'E';
  return null;
}

function drawMaze(ctx: CanvasRenderingContext2D, grid: Grid, camX: number, camY: number) {
  ctx.strokeStyle = '#c4b5fd';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.shadowColor = '#7c3aed';
  ctx.shadowBlur = 4;
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[0].length; x++) {
      const cell = grid[y][x];
      const px = x * CELL - camX;
      const py = y * CELL - camY;
      if (px < -CELL || py < -CELL || px > CANVAS_W + CELL || py > CANVAS_H + CELL) continue;
      ctx.fillStyle = (x + y) % 2 === 0 ? '#3d3050' : '#332844';
      ctx.fillRect(px, py, CELL, CELL);
      ctx.beginPath();
      if (cell.walls.N) {
        ctx.moveTo(px, py);
        ctx.lineTo(px + CELL, py);
      }
      if (cell.walls.S) {
        ctx.moveTo(px, py + CELL);
        ctx.lineTo(px + CELL, py + CELL);
      }
      if (cell.walls.W) {
        ctx.moveTo(px, py);
        ctx.lineTo(px, py + CELL);
      }
      if (cell.walls.E) {
        ctx.moveTo(px + CELL, py);
        ctx.lineTo(px + CELL, py + CELL);
      }
      ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

function drawGlowCircle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawPerson(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, label?: string) {
  drawGlowCircle(ctx, x, y, 26, `${color}55`);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fill();
  if (label) {
    ctx.fillStyle = '#e5e7eb';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y - 16);
  }
}

function drawMonster(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const wobble = Math.sin(t / 90) * 2;
  drawGlowCircle(ctx, x, y, 46, 'rgba(139,0,0,0.35)');
  ctx.fillStyle = '#150404';
  ctx.beginPath();
  ctx.ellipse(x, y + 4 + wobble, 15, 19, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff1a1a';
  ctx.beginPath();
  ctx.arc(x - 5, y - 3 + wobble, 2.6, 0, Math.PI * 2);
  ctx.arc(x + 5, y - 3 + wobble, 2.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawKey(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const bob = Math.sin(t / 260) * 4;
  drawGlowCircle(ctx, x, y + bob, 22, 'rgba(250,204,21,0.5)');
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(x - 6, y + bob, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - 2, y - 2 + bob, 12, 3);
  ctx.fillRect(x + 6, y - 2 + bob, 3, 6);
}

function drawExitDoor(ctx: CanvasRenderingContext2D, x: number, y: number, ready: boolean) {
  drawGlowCircle(ctx, x, y, 34, ready ? 'rgba(74,222,128,0.5)' : 'rgba(120,53,15,0.35)');
  ctx.fillStyle = ready ? '#16a34a' : '#3f2d1a';
  ctx.fillRect(x - 12, y - 20, 24, 40);
  ctx.strokeStyle = '#000';
  ctx.strokeRect(x - 12, y - 20, 24, 40);
}

function applyFlashlight(
  ctx: CanvasRenderingContext2D,
  maskCanvas: HTMLCanvasElement,
  facing: Dir,
  radius: number,
  flicker: number,
) {
  const cx = CANVAS_W / 2;
  const cy = CANVAS_H / 2;
  const maskCtx = maskCanvas.getContext('2d');
  if (!maskCtx) return;

  maskCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  maskCtx.globalCompositeOperation = 'source-over';
  maskCtx.fillStyle = 'rgba(2,1,4,0.93)';
  maskCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  maskCtx.globalCompositeOperation = 'destination-out';

  const r = radius * flicker;
  const grad = maskCtx.createRadialGradient(cx, cy, r * 0.15, cx, cy, r);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  maskCtx.fillStyle = grad;
  maskCtx.beginPath();
  maskCtx.arc(cx, cy, r, 0, Math.PI * 2);
  maskCtx.fill();

  const angleMap: Record<Dir, number> = { E: 0, S: Math.PI / 2, W: Math.PI, N: -Math.PI / 2 };
  const angle = angleMap[facing];
  const coneR = radius * 2.1 * flicker;
  const grad2 = maskCtx.createRadialGradient(cx, cy, coneR * 0.1, cx, cy, coneR);
  grad2.addColorStop(0, 'rgba(0,0,0,0.9)');
  grad2.addColorStop(1, 'rgba(0,0,0,0)');
  maskCtx.fillStyle = grad2;
  maskCtx.beginPath();
  maskCtx.moveTo(cx, cy);
  maskCtx.arc(cx, cy, coneR, angle - 0.5, angle + 0.5);
  maskCtx.closePath();
  maskCtx.fill();
  maskCtx.globalCompositeOperation = 'source-over';

  ctx.drawImage(maskCanvas, 0, 0);
}

function drawVignette(ctx: CanvasRenderingContext2D, intensity: number) {
  if (intensity <= 0) return;
  const grad = ctx.createRadialGradient(
    CANVAS_W / 2,
    CANVAS_H / 2,
    CANVAS_H / 3,
    CANVAS_W / 2,
    CANVAS_H / 2,
    CANVAS_H / 1.1,
  );
  grad.addColorStop(0, 'rgba(120,0,0,0)');
  grad.addColorStop(1, `rgba(120,0,0,${0.55 * intensity})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function drawEdgeIndicator(ctx: CanvasRenderingContext2D, dx: number, dy: number, color: string) {
  const margin = 26;
  const maxX = CANVAS_W / 2 - margin;
  const maxY = CANVAS_H / 2 - margin;
  const scale = Math.min(maxX / (Math.abs(dx) || 1e-6), maxY / (Math.abs(dy) || 1e-6), 1);
  const ex = CANVAS_W / 2 + dx * scale;
  const ey = CANVAS_H / 2 + dy * scale;
  const angle = Math.atan2(dy, dx);
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-6, -7);
  ctx.lineTo(-6, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

interface SelfInfo {
  id: string;
  name: string;
  color: string;
  joinedAt: number;
}

export function HorrorGamePage() {
  const { toast } = useToast();
  const [phase, setPhase] = useState<GamePhase>('menu');
  const [mode, setMode] = useState<GameMode>('solo');
  const [playerName, setPlayerName] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [roomPlayers, setRoomPlayers] = useState<RemotePlayerInfo[]>([]);
  const [muted, setMuted] = useState(false);
  const [sanityDisplay, setSanityDisplay] = useState(MAX_SANITY);
  const [keysCollectedCount, setKeysCollectedCount] = useState(0);
  const [jumpscare, setJumpscare] = useState<{ active: boolean; intensity: 'small' | 'big' }>({
    active: false,
    intensity: 'small',
  });
  const [prankBanner, setPrankBanner] = useState<string | null>(null);
  const [prankReady, setPrankReady] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const gridRef = useRef<Grid | null>(null);
  const exitRef = useRef<Point>({ x: 0, y: 0 });
  const keysRef = useRef<KeyItem[]>([]);
  const collectedRef = useRef<Set<number>>(new Set());
  const localMoverRef = useRef<Mover>(newMover(0, 0, CELL));
  const monsterMoverRef = useRef<Mover>(newMover(0, 0, CELL));
  const remoteMoversRef = useRef<Map<string, RemoteMover>>(new Map());
  const keysHeldRef = useRef<string[]>([]);
  const touchDirRef = useRef<Dir | null>(null);
  const sanityRef = useRef(MAX_SANITY);
  const sanityDisplayTimerRef = useRef(0);
  const nextMonsterMoveAtRef = useRef(0);
  const nextAmbientAtRef = useRef(0);
  const nextWhisperAtRef = useRef(0);
  const catchInvulnUntilRef = useRef(0);
  const gameStartTimeRef = useRef(0);
  const phaseRef = useRef<GamePhase>('menu');
  const modeRef = useRef<GameMode>('solo');
  const totalKeysRef = useRef(KEY_COUNT);
  const flickerRef = useRef(1);
  const roomRef = useRef<HorrorRoom | null>(null);
  const roomCodeRef = useRef<string | null>(null);
  const selfInfoRef = useRef<SelfInfo | null>(null);
  const isHostRef = useRef(true);
  const roundRef = useRef(0);
  const monsterDistRef = useRef(999);
  const roomPlayersRef = useRef<RemotePlayerInfo[]>([]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const stopGameLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    horrorSound.stopHeartbeat();
    horrorSound.stopAmbient();
  }, []);

  const playFootstepFor = useCallback((mover: Mover, ownVolumeBase: number) => {
    const local = localMoverRef.current;
    const pan = Math.max(-1, Math.min(1, (mover.px - local.px) / 260));
    const dist = Math.hypot(mover.px - local.px, mover.py - local.py) / CELL;
    const volume = Math.max(0.04, Math.min(ownVolumeBase, 1 - dist / 7));
    horrorSound.playFootstep(pan, volume);
  }, []);

  const triggerJumpscare = useCallback((intensity: 'small' | 'big') => {
    horrorSound.playJumpscare(intensity);
    setJumpscare({ active: true, intensity });
  }, []);

  const setupWorld = useCallback((seedKey: string) => {
    const rng = mulberry32(seedFromString(seedKey));
    const grid = generateMaze(MAZE_W, MAZE_H, rng);
    const start: Point = { x: 0, y: 0 };
    const exit = findFarthest(grid, start);
    const spots = pickFarPoints(grid, start, KEY_COUNT, Math.floor((MAZE_W + MAZE_H) / 2));
    const keys: KeyItem[] = spots.map((p, i) => ({ id: i, x: p.x, y: p.y }));
    const monsterStart = findFarthest(grid, exit);

    gridRef.current = grid;
    exitRef.current = exit;
    keysRef.current = keys;
    collectedRef.current = new Set();
    totalKeysRef.current = keys.length;
    localMoverRef.current = newMover(start.x, start.y, CELL, 'S');
    monsterMoverRef.current = newMover(monsterStart.x, monsterStart.y, CELL, 'N');
    remoteMoversRef.current.clear();
    sanityRef.current = MAX_SANITY;
    setSanityDisplay(MAX_SANITY);
    setKeysCollectedCount(0);
    catchInvulnUntilRef.current = 0;
    const t = performance.now();
    gameStartTimeRef.current = t;
    nextMonsterMoveAtRef.current = t + 900;
    nextAmbientAtRef.current = t + 14000 + Math.random() * 12000;
    nextWhisperAtRef.current = t + 6000 + Math.random() * 8000;
  }, []);

  const handleLocalCatch = useCallback(
    (t: number) => {
      if (t < catchInvulnUntilRef.current) return;
      catchInvulnUntilRef.current = t + CATCH_INVULN_MS;
      sanityRef.current = Math.max(0, sanityRef.current - CATCH_SANITY_LOSS);
      triggerJumpscare('big');
      if (modeRef.current === 'solo' && gridRef.current) {
        const relocated = pickFarPoints(gridRef.current, { x: localMoverRef.current.cx, y: localMoverRef.current.cy }, 1, 6)[0];
        if (relocated) monsterMoverRef.current = newMover(relocated.x, relocated.y, CELL, 'N');
      }
      if (sanityRef.current <= 0) {
        phaseRef.current = 'gameover';
        setPhase('gameover');
        horrorSound.stopHeartbeat();
        horrorSound.stopAmbient();
        horrorSound.playGameOverDrone();
      }
    },
    [triggerJumpscare],
  );

  const handleWin = useCallback(() => {
    phaseRef.current = 'win';
    setPhase('win');
    horrorSound.stopHeartbeat();
    horrorSound.stopAmbient();
    horrorSound.playWin();
    if (roomRef.current) roomRef.current.sendGameEnd({ result: 'win' });
  }, []);

  const collectKey = useCallback((keyId: number, broadcast: boolean) => {
    if (collectedRef.current.has(keyId)) return;
    collectedRef.current.add(keyId);
    setKeysCollectedCount(collectedRef.current.size);
    horrorSound.playKeyPickup();
    if (broadcast && roomRef.current && selfInfoRef.current) {
      roomRef.current.sendKeyCollected({ keyId, by: selfInfoRef.current.id });
    }
  }, []);

  const gameLoop = useCallback(
    (t: number) => {
      const grid = gridRef.current;
      const canvas = canvasRef.current;
      if (!grid || !canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if (!maskCanvasRef.current) {
        const mc = document.createElement('canvas');
        mc.width = CANVAS_W;
        mc.height = CANVAS_H;
        maskCanvasRef.current = mc;
      }

      if (phaseRef.current === 'playing') {
        const localMover = localMoverRef.current;
        const monsterMover = monsterMoverRef.current;

        if (!localMover.moving) {
          const desired = touchDirRef.current ?? dirFromKey(keysHeldRef.current[keysHeldRef.current.length - 1] || '');
          if (desired && canMove(grid, { x: localMover.cx, y: localMover.cy }, desired)) {
            beginMove(localMover, CELL, desired, t, PLAYER_MOVE_MS);
            horrorSound.playFootstep(0, 0.12);
            if (roomRef.current && selfInfoRef.current) {
              roomRef.current.sendMove({
                id: selfInfoRef.current.id,
                cx: localMover.cx,
                cy: localMover.cy,
                facing: localMover.facing,
                moving: true,
              });
            }
          } else if (desired) {
            localMover.facing = desired;
          }
        }
        updateMover(localMover, t);
        updateMover(monsterMover, t);
        for (const rm of remoteMoversRef.current.values()) updateMover(rm, t);

        monsterDistRef.current = cellDistance({ x: localMover.cx, y: localMover.cy }, { x: monsterMover.cx, y: monsterMover.cy });

        if (isHostRef.current && t >= nextMonsterMoveAtRef.current && !monsterMover.moving) {
          const targets: Point[] = [{ x: localMover.cx, y: localMover.cy }];
          for (const rm of remoteMoversRef.current.values()) targets.push({ x: rm.cx, y: rm.cy });
          let best = targets[0];
          let bestDist = Infinity;
          for (const target of targets) {
            const d = cellDistance({ x: monsterMover.cx, y: monsterMover.cy }, target);
            if (d < bestDist) {
              bestDist = d;
              best = target;
            }
          }
          const dir = directionTowards(grid, { x: monsterMover.cx, y: monsterMover.cy }, best);
          const elapsedSec = (t - gameStartTimeRef.current) / 1000;
          const duration = Math.max(260, 650 - elapsedSec * 4);
          if (dir) {
            beginMove(monsterMover, CELL, dir, t, duration);
            playFootstepFor(monsterMover, 0.55);
            if (roomRef.current) roomRef.current.sendMonster({ cx: monsterMover.cx, cy: monsterMover.cy });
          }
          nextMonsterMoveAtRef.current = t + duration;
        }

        if (localMover.cx === monsterMover.cx && localMover.cy === monsterMover.cy) {
          handleLocalCatch(t);
        }

        for (const key of keysRef.current) {
          if (!collectedRef.current.has(key.id) && key.x === localMover.cx && key.y === localMover.cy) {
            collectKey(key.id, true);
          }
        }

        if (
          localMover.cx === exitRef.current.x &&
          localMover.cy === exitRef.current.y &&
          collectedRef.current.size >= totalKeysRef.current
        ) {
          handleWin();
        }

        const proximity = Math.max(0, 1 - monsterDistRef.current / 8);
        const decay = 1.0 + proximity * 3.6;
        const dt = sanityDisplayTimerRef.current === 0 ? 16 : Math.min(60, t - sanityDisplayTimerRef.current);
        sanityRef.current = Math.max(0, sanityRef.current - (decay * dt) / 1000);
        sanityDisplayTimerRef.current = t;
        if (sanityRef.current <= 0) {
          phaseRef.current = 'gameover';
          setPhase('gameover');
          horrorSound.stopHeartbeat();
          horrorSound.stopAmbient();
          horrorSound.playGameOverDrone();
        }

        if (t >= nextAmbientAtRef.current) {
          nextAmbientAtRef.current = t + 13000 + Math.random() * 14000;
          triggerJumpscare('small');
        }
        if (t >= nextWhisperAtRef.current) {
          nextWhisperAtRef.current = t + 6000 + Math.random() * 9000;
          horrorSound.playWhisper();
        }

        flickerRef.current = 0.9 + Math.sin(t / 220) * 0.06 + (Math.random() - 0.5) * 0.05;

        setSanityDisplay((prev) => {
          const rounded = Math.round(sanityRef.current);
          return prev === rounded ? prev : rounded;
        });

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#05040a';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        const camX = localMover.px - CANVAS_W / 2;
        const camY = localMover.py - CANVAS_H / 2;
        drawMaze(ctx, grid, camX, camY);
        for (const key of keysRef.current) {
          if (collectedRef.current.has(key.id)) continue;
          drawKey(ctx, key.x * CELL + CELL / 2 - camX, key.y * CELL + CELL / 2 - camY, t);
        }
        drawExitDoor(
          ctx,
          exitRef.current.x * CELL + CELL / 2 - camX,
          exitRef.current.y * CELL + CELL / 2 - camY,
          collectedRef.current.size >= totalKeysRef.current,
        );
        for (const rm of remoteMoversRef.current.values()) {
          drawPerson(ctx, rm.px - camX, rm.py - camY, rm.color, rm.name);
        }
        drawMonster(ctx, monsterMover.px - camX, monsterMover.py - camY, t);
        drawPerson(ctx, localMover.px - camX, localMover.py - camY, selfInfoRef.current?.color || '#38bdf8');

        const sanityRatio = sanityRef.current / MAX_SANITY;
        const radius = 95 * (0.55 + 0.45 * sanityRatio);
        applyFlashlight(ctx, maskCanvasRef.current, localMover.facing, radius, flickerRef.current);
        drawVignette(ctx, 1 - sanityRatio);

        for (const rm of remoteMoversRef.current.values()) {
          drawEdgeIndicator(ctx, rm.px - localMover.px, rm.py - localMover.py, rm.color);
        }
        if (collectedRef.current.size >= totalKeysRef.current) {
          drawEdgeIndicator(
            ctx,
            exitRef.current.x * CELL + CELL / 2 - localMover.px,
            exitRef.current.y * CELL + CELL / 2 - localMover.py,
            '#4ade80',
          );
        }
      }

      rafRef.current = requestAnimationFrame(gameLoop);
    },
    [collectKey, handleLocalCatch, handleWin, playFootstepFor, triggerJumpscare],
  );

  const startGameLoop = useCallback(() => {
    stopGameLoop();
    horrorSound.resume();
    horrorSound.startAmbient();
    horrorSound.startHeartbeat(() => {
      const sanityRatio = sanityRef.current / MAX_SANITY;
      const proximity = Math.max(0, 1 - monsterDistRef.current / 8);
      const bpm = 55 + (1 - sanityRatio) * 65 + proximity * 25;
      const volume = 0.12 + (1 - sanityRatio) * 0.4 + proximity * 0.35;
      return { bpm, volume: Math.min(0.85, volume) };
    });
    rafRef.current = requestAnimationFrame(gameLoop);
  }, [gameLoop, stopGameLoop]);

  const beginRound = useCallback(() => {
    roundRef.current += 1;
    const seedKey =
      modeRef.current === 'multi' && roomCodeRef.current
        ? `${roomCodeRef.current}:${roundRef.current}`
        : `solo:${Date.now()}:${Math.random()}`;
    setupWorld(seedKey);
    phaseRef.current = 'playing';
    setPhase('playing');
    startGameLoop();
  }, [setupWorld, startGameLoop]);

  useEffect(() => {
    horrorSound.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const dir = dirFromKey(e.key);
      if (!dir || e.repeat) return;
      if (!keysHeldRef.current.includes(e.key)) keysHeldRef.current.push(e.key);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysHeldRef.current = keysHeldRef.current.filter((k) => k !== e.key);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    return () => {
      stopGameLoop();
      roomRef.current?.leave();
      horrorSound.dispose();
    };
  }, [stopGameLoop]);

  const ensureSelf = useCallback(() => {
    if (!selfInfoRef.current) {
      selfInfoRef.current = {
        id: randomPlayerId(),
        name: playerName.trim() || 'Jugador',
        color: pickRng(Math.random, PLAYER_COLORS),
        joinedAt: Date.now(),
      };
    }
    return selfInfoRef.current;
  }, [playerName]);

  const connectRoom = useCallback(
    async (code: string) => {
      const self = ensureSelf();
      setConnecting(true);
      const room = new HorrorRoom(code, self, {
        onPlayers: (players) => {
          setRoomPlayers(players);
          isHostRef.current = room.isHost(players);
          const ids = new Set(players.map((p) => p.id));
          for (const id of Array.from(remoteMoversRef.current.keys())) {
            if (id !== self.id && !ids.has(id)) remoteMoversRef.current.delete(id);
          }
        },
        onMove: (payload) => {
          if (payload.id === self.id) return;
          const info = roomPlayersRef.current.find((p) => p.id === payload.id);
          let rm = remoteMoversRef.current.get(payload.id);
          if (!rm) {
            rm = { ...newMover(payload.cx, payload.cy, CELL, payload.facing), color: info?.color || '#38bdf8', name: info?.name || '?' };
            remoteMoversRef.current.set(payload.id, rm);
            return;
          }
          const dx = payload.cx - rm.cx;
          const dy = payload.cy - rm.cy;
          const dir = (Object.keys(DELTA) as Dir[]).find((d) => DELTA[d].x === dx && DELTA[d].y === dy);
          if (dir) {
            beginMove(rm, CELL, dir, performance.now(), PLAYER_MOVE_MS);
          } else if (dx !== 0 || dy !== 0) {
            const snapped = newMover(payload.cx, payload.cy, CELL, payload.facing);
            rm.cx = snapped.cx;
            rm.cy = snapped.cy;
            rm.px = snapped.px;
            rm.py = snapped.py;
            rm.moving = false;
          }
        },
        onMonster: (payload) => {
          if (isHostRef.current) return;
          const mm = monsterMoverRef.current;
          const dx = payload.cx - mm.cx;
          const dy = payload.cy - mm.cy;
          const dir = (Object.keys(DELTA) as Dir[]).find((d) => DELTA[d].x === dx && DELTA[d].y === dy);
          const t = performance.now();
          if (dir) {
            beginMove(mm, CELL, dir, t, 480);
            playFootstepFor(mm, 0.5);
          } else if (dx !== 0 || dy !== 0) {
            monsterMoverRef.current = newMover(payload.cx, payload.cy, CELL, mm.facing);
          }
        },
        onKeyCollected: (payload) => {
          collectKey(payload.keyId, false);
        },
        onJumpscare: (payload) => {
          if (payload.kind === 'prank' && payload.targetId === self.id) {
            setPrankBanner(payload.fromName || 'un compañero');
            triggerJumpscare('small');
            window.setTimeout(() => setPrankBanner(null), 2200);
          }
        },
        onGameEnd: (payload) => {
          if (payload.result === 'win' && phaseRef.current === 'playing') {
            phaseRef.current = 'win';
            setPhase('win');
            horrorSound.stopHeartbeat();
            horrorSound.stopAmbient();
            horrorSound.playWin();
          }
        },
        onStart: () => {
          beginRound();
        },
      });
      roomRef.current = room;
      roomCodeRef.current = code;
      const timedOut = await Promise.race([
        room.join().then(() => false),
        new Promise<boolean>((resolve) => window.setTimeout(() => resolve(true), 9000)),
      ]);
      if (timedOut) {
        room.leave();
        roomRef.current = null;
        roomCodeRef.current = null;
        setConnecting(false);
        toast('No se pudo conectar a la sala. Intenta de nuevo.', 'error');
        return;
      }
      setConnecting(false);
      setRoomCode(code);
      phaseRef.current = 'lobby';
      setPhase('lobby');
    },
    [beginRound, collectKey, ensureSelf, playFootstepFor, toast, triggerJumpscare],
  );

  useEffect(() => {
    roomPlayersRef.current = roomPlayers;
  }, [roomPlayers]);

  const selfIsHost = useMemo(() => {
    if (!selfInfoRef.current) return true;
    const sorted = [...roomPlayers].sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
    return sorted.length === 0 || sorted[0].id === selfInfoRef.current.id;
  }, [roomPlayers]);

  const startSolo = () => {
    setMode('solo');
    modeRef.current = 'solo';
    isHostRef.current = true;
    beginRound();
  };

  const createRoom = async () => {
    setMode('multi');
    modeRef.current = 'multi';
    const code = Math.random().toString(36).slice(2, 7).toUpperCase();
    await connectRoom(code);
  };

  const joinRoom = async () => {
    if (!roomCodeInput.trim()) return;
    setMode('multi');
    modeRef.current = 'multi';
    await connectRoom(roomCodeInput.trim().toUpperCase());
  };

  const copyRoomCode = () => {
    if (!roomCode) return;
    navigator.clipboard?.writeText(roomCode).catch(() => {});
    toast('Código copiado', 'success');
  };

  const leaveToMenu = () => {
    stopGameLoop();
    roomRef.current?.leave();
    roomRef.current = null;
    roomCodeRef.current = null;
    selfInfoRef.current = null;
    setRoomCode(null);
    setRoomPlayers([]);
    phaseRef.current = 'menu';
    setPhase('menu');
  };

  const respawn = () => {
    if (!gridRef.current) return;
    sanityRef.current = 60;
    setSanityDisplay(60);
    localMoverRef.current = newMover(0, 0, CELL, 'S');
    catchInvulnUntilRef.current = performance.now() + CATCH_INVULN_MS;
    phaseRef.current = 'playing';
    setPhase('playing');
    startGameLoop();
  };

  const sendPrank = () => {
    if (!roomRef.current || !prankReady || !selfInfoRef.current) return;
    const others = roomPlayers.filter((p) => p.id !== selfInfoRef.current!.id);
    if (others.length === 0) return;
    const target = others[Math.floor(Math.random() * others.length)];
    roomRef.current.sendJumpscare({ kind: 'prank', targetId: target.id, fromName: selfInfoRef.current.name });
    toast(`Asustaste a ${target.name}`, 'success');
    setPrankReady(false);
    window.setTimeout(() => setPrankReady(true), PRANK_COOLDOWN_MS);
  };

  const sanityColor = sanityDisplay > 60 ? '#4ade80' : sanityDisplay > 30 ? '#facc15' : '#ef4444';

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#050308] text-slate-100">
      <JumpscareOverlay
        active={jumpscare.active}
        intensity={jumpscare.intensity}
        onDone={() => setJumpscare((j) => ({ ...j, active: false }))}
      />

      {phase === 'menu' && (
        <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-16 text-center">
          <Skull className="h-16 w-16 text-red-500" />
          <div>
            <h1 className="text-3xl font-extrabold tracking-wide text-red-500">La Casa Sin Luz</h1>
            <p className="mt-2 text-sm text-slate-400">
              Explora un caserón a oscuras, recoge las llaves y escapa antes de que tu cordura se apague. Juega solo o
              en equipo: cada susto tiene su propio sonido.
            </p>
          </div>
          <input
            className="input"
            placeholder="Tu nombre"
            maxLength={16}
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />
          <button onClick={startSolo} className="btn-primary w-full">
            <Ghost className="h-4 w-4" /> Jugar solo
          </button>
          <div className="flex w-full items-center gap-2 text-xs text-slate-500">
            <div className="h-px flex-1 bg-slate-700" /> o en equipo <div className="h-px flex-1 bg-slate-700" />
          </div>
          <button onClick={createRoom} disabled={connecting} className="btn-outline w-full border-slate-600 text-slate-200">
            <Users className="h-4 w-4" /> Crear sala
          </button>
          <div className="flex w-full gap-2">
            <input
              className="input"
              placeholder="Código de sala"
              maxLength={5}
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
            />
            <button onClick={joinRoom} disabled={connecting} className="btn-outline shrink-0 border-slate-600 text-slate-200">
              Unirse
            </button>
          </div>
          <p className="text-xs text-slate-600">Usa flechas o WASD para moverte. Sonido recomendado con audífonos.</p>
        </div>
      )}

      {phase === 'lobby' && (
        <div className="mx-auto flex max-w-md flex-col items-center gap-5 px-4 py-16 text-center">
          <Users className="h-12 w-12 text-slate-300" />
          <h2 className="text-xl font-bold">Sala de espera</h2>
          <button
            onClick={copyRoomCode}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-2xl font-black tracking-[0.3em] text-white"
          >
            {roomCode} <Copy className="h-4 w-4 text-slate-400" />
          </button>
          <p className="text-sm text-slate-400">Comparte este código para que tu equipo se una.</p>
          <div className="w-full space-y-2">
            {roomPlayers.map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm">
                <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
                <span>{p.name}</span>
                {selfInfoRef.current?.id === p.id && <span className="text-xs text-slate-500">(tú)</span>}
              </div>
            ))}
            {roomPlayers.length === 0 && <p className="text-xs text-slate-600">Conectando...</p>}
          </div>
          {selfIsHost ? (
            <button onClick={beginRound} className="btn-primary w-full">
              <Zap className="h-4 w-4" /> Iniciar partida
            </button>
          ) : (
            <p className="text-sm text-slate-400">Esperando a que el anfitrión inicie la partida...</p>
          )}
          <button onClick={leaveToMenu} className="btn-ghost text-slate-400">
            <LogOut className="h-4 w-4" /> Salir
          </button>
        </div>
      )}

      {(phase === 'playing' || phase === 'win' || phase === 'gameover') && (
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-3 py-5">
          <div className="flex w-full items-center justify-between text-sm">
            <button onClick={leaveToMenu} className="flex items-center gap-1 text-slate-400 hover:text-slate-200">
              <LogOut className="h-4 w-4" /> Salir
            </button>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Heart className="h-4 w-4" style={{ color: sanityColor }} />
                <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${sanityDisplay}%`, background: sanityColor }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-1 text-yellow-400">
                <KeyRound className="h-4 w-4" />
                {keysCollectedCount}/{KEY_COUNT}
              </div>
              <button onClick={() => setMuted((m) => !m)} className="text-slate-400 hover:text-slate-200">
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="relative w-full overflow-hidden rounded-2xl border border-slate-800 bg-black" style={{ aspectRatio: `${CANVAS_W}/${CANVAS_H}` }}>
            <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="h-full w-full" />

            {prankBanner && (
              <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-red-900/80 px-3 py-1 text-xs font-semibold text-red-100">
                ¡{prankBanner} te asustó!
              </div>
            )}

            {phase === 'win' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 text-center">
                <DoorOpen className="h-12 w-12 text-green-400" />
                <h3 className="text-2xl font-bold text-green-400">¡Escaparon con vida!</h3>
                <button onClick={leaveToMenu} className="btn-primary">
                  Volver al menú
                </button>
              </div>
            )}

            {phase === 'gameover' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 text-center">
                <Skull className="h-12 w-12 text-red-500" />
                <h3 className="text-2xl font-bold text-red-500">Perdiste la cordura...</h3>
                {mode === 'multi' ? (
                  <button onClick={respawn} className="btn-primary">
                    Reaparecer
                  </button>
                ) : (
                  <button onClick={startSolo} className="btn-primary">
                    Reintentar
                  </button>
                )}
                <button onClick={leaveToMenu} className="btn-ghost text-slate-400">
                  Menú
                </button>
              </div>
            )}
          </div>

          {phase === 'playing' && mode === 'multi' && (
            <button
              onClick={sendPrank}
              disabled={!prankReady}
              className="btn-outline border-red-900 text-red-300 disabled:opacity-40"
            >
              <Ghost className="h-4 w-4" /> Asustar a un compañero
            </button>
          )}

          {phase === 'playing' && (
            <div className="grid grid-cols-3 gap-1.5 md:hidden">
              <div />
              <button
                className="btn-outline aspect-square border-slate-700"
                onPointerDown={() => (touchDirRef.current = 'N')}
                onPointerUp={() => (touchDirRef.current = null)}
                onPointerLeave={() => (touchDirRef.current = null)}
              >
                <ArrowUp className="h-5 w-5" />
              </button>
              <div />
              <button
                className="btn-outline aspect-square border-slate-700"
                onPointerDown={() => (touchDirRef.current = 'W')}
                onPointerUp={() => (touchDirRef.current = null)}
                onPointerLeave={() => (touchDirRef.current = null)}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <button
                className="btn-outline aspect-square border-slate-700"
                onPointerDown={() => (touchDirRef.current = 'S')}
                onPointerUp={() => (touchDirRef.current = null)}
                onPointerLeave={() => (touchDirRef.current = null)}
              >
                <ArrowDown className="h-5 w-5" />
              </button>
              <button
                className="btn-outline aspect-square border-slate-700"
                onPointerDown={() => (touchDirRef.current = 'E')}
                onPointerUp={() => (touchDirRef.current = null)}
                onPointerLeave={() => (touchDirRef.current = null)}
              >
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
