import * as THREE from 'three';
import { INTERACT, MOVE, NET, worldTimeOfDay } from '../../../shared/constants';
import type { AnimState, Appearance, DialogueLine, PuzzlePrompt, RewardSummary, ServerMsg, Vec3 } from '../../../shared/protocol';
import { CASA_MORALES, type Collider, heightAt, PLAZA, regionOf, SPAWN, zoneAt } from '../../../shared/world';
import { GameSocket } from '../net/socket';
import { store } from '../state';
import { AudioEngine } from './audio';
import { FollowCamera } from './camera';
import { Character } from './character';
import { CollisionGrid } from './collision';
import { EntityVisual } from './entities';
import { Input } from './input';
import { buildWorld, type Quality, type SponsorCampaign, type WorldBuild } from './world/buildWorld';
import { Environment } from './world/environment';

export interface GameUi {
  prompt(label: string | null): void;
  toast(level: 'info' | 'success' | 'warn' | 'error', text: string): void;
  discovery(kind: string, text: string): void;
  dialogue(lines: DialogueLine[], messages: string[]): void;
  puzzle(p: PuzzlePrompt): void;
  puzzleResult(ok: boolean, msg: string): void;
  missionComplete(title: string, rewards: RewardSummary): void;
  partyInvite(inviteId: string, from: string): void;
  kicked(reason: string): void;
  connection(status: 'connecting' | 'online' | 'offline' | 'fatal', info?: string): void;
  action(a: string): void;
  frame(): void;
}

interface Remote {
  char: Character;
  userId: string;
  samples: { t: number; p: Vec3; r: number; a: AnimState }[];
  speed: number;
}

interface Interactable {
  id: string;
  label: string;
  p: Vec3;
  radius: number;
}

const FLASHLIGHT: Record<string, { range: number; angle: number; intensity: number; color: string }> = {
  linterna_basica: { range: 22, angle: 0.42, intensity: 40, color: '#fff3dc' },
  linterna_potente: { range: 34, angle: 0.55, intensity: 70, color: '#f4f8ff' },
  farol_antiguo: { range: 16, angle: 1.2, intensity: 22, color: '#ffc36e' },
};

export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly input: Input;
  readonly audio = new AudioEngine();
  readonly follow: FollowCamera;
  readonly socket = new GameSocket();
  private env: Environment;
  private world: WorldBuild;
  private grid: CollisionGrid;
  private clock = new THREE.Clock();
  ui: GameUi | null = null;

  mode: 'attract' | 'preview' | 'play' = 'attract';
  me: Character | null = null;
  myCharId: string | null = null;
  pos = new THREE.Vector3(SPAWN.x, 0, SPAWN.z);
  rotY = 0;
  private speed = 0;
  private anim: AnimState = 'idle';
  private remotes = new Map<string, Remote>();
  private npcs = new Map<string, Character>();
  private entities = new Map<string, EntityVisual>();
  private flashlight: THREE.SpotLight;
  flashlightOn = false;
  private lampLights: THREE.PointLight[] = [];
  private lampAssignT = 0;
  private sendT = 0;
  private lastSent = { x: 0, z: 0, r: 0, a: 'idle' as AnimState, t: 0 };
  private seq = 0;
  private serverOffset = 0;
  private nearest: Interactable | null = null;
  private beacon: THREE.Mesh;
  private mysteryT = 40;
  private bellSwing = 0;
  private shadowFigure: Character;
  private shadowT = 0;
  private lastStep = 0;
  private attractT = 0;
  private flickerT = 0;
  private flickerLamp = -1;
  private fps = 60;
  paused = false;

  constructor(canvas: HTMLCanvasElement, quality: Quality) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 600);
    this.follow = new FollowCamera(this.camera);
    this.input = new Input(canvas);

    this.env = new Environment(this.scene, quality);
    this.env.onThunder = (d, s) => this.audio.thunder(d, s);
    this.world = buildWorld(quality);
    this.scene.add(this.world.group);
    this.grid = new CollisionGrid(this.world.colliders);

    const nLamps = quality === 'low' ? 2 : quality === 'medium' ? 4 : 6;
    for (let i = 0; i < nLamps; i++) {
      const l = new THREE.PointLight('#ffc070', 0, 16, 1.6);
      this.scene.add(l);
      this.lampLights.push(l);
    }

    this.flashlight = new THREE.SpotLight('#fff3dc', 0, 22, 0.42, 0.45, 1.4);
    this.flashlight.castShadow = quality === 'high';
    this.flashlight.shadow.mapSize.set(512, 512);
    this.scene.add(this.flashlight, this.flashlight.target);

    this.beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.9, 60, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: '#d9b56b', transparent: true, opacity: 0.035, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }),
    );
    this.beacon.visible = false;
    this.scene.add(this.beacon);

    const black = '#050506';
    this.shadowFigure = new Character({ skin: black, hair: black, coat: black, pants: black });
    this.shadowFigure.root.scale.setScalar(1.15);
    this.shadowFigure.root.visible = false;
    this.scene.add(this.shadowFigure.root);

    this.socket.on((m) => this.onMessage(m));
    this.socket.onStatus = (s, info) => this.ui?.connection(s, info);
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.env.timeOfDay = worldTimeOfDay(Date.now());
    this.renderer.setAnimationLoop(() => this.frame());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  get serverNow() {
    return Date.now() + this.serverOffset;
  }

  get inCave() {
    return regionOf(this.pos.x, this.pos.z) === 'cave';
  }

  get zone() {
    return zoneAt(this.pos.x, this.pos.z);
  }

  get timeOfDay() {
    return this.env.timeOfDay;
  }

  get weather() {
    return this.env.weather;
  }

  get night() {
    return this.env.night;
  }

  get fpsEstimate() {
    return this.fps;
  }

  get nearestInteractable() {
    return this.nearest;
  }

  setSponsors(list: SponsorCampaign[]) {
    for (const slot of this.world.sponsorMeshes.keys()) this.world.setSponsor(slot, list.find((c) => c.slot === slot) ?? null);
  }

  // ------------------------------------------------------------------ modos

  showPreview(appearance: Appearance) {
    this.mode = 'preview';
    if (!this.me) {
      this.me = new Character(appearance);
      this.scene.add(this.me.root);
    } else this.me.apply(appearance);
    this.pos.set(3, 0, 3);
    this.me.root.position.copy(this.pos);
    this.me.root.rotation.y = Math.PI * 0.75;
  }

  enterWorld() {
    this.mode = 'play';
    this.socket.connect();
  }

  leaveWorld() {
    this.socket.close();
    for (const r of this.remotes.values()) this.scene.remove(r.char.root);
    this.remotes.clear();
    this.mode = 'attract';
  }

  send = (m: Parameters<GameSocket['send']>[0]) => this.socket.send(m);

  toggleFlashlight() {
    this.flashlightOn = !this.flashlightOn;
    this.audio.click();
  }

  interact() {
    if (this.nearest) this.socket.send({ t: 'interact', entityId: this.nearest.id });
  }

  // ------------------------------------------------------------------ red

  private onMessage(m: ServerMsg) {
    switch (m.t) {
      case 'welcome': {
        this.serverOffset = m.world.serverTime - Date.now();
        store.world = m.world;
        this.env.weather = m.world.weather;
        this.myCharId = m.you.id;
        if (!this.me) {
          this.me = new Character(m.you.appearance);
          this.scene.add(this.me.root);
        } else this.me.apply(m.you.appearance);
        this.me.setName(m.you.name);
        this.me.showTag(false);
        this.pos.set(m.you.p[0], m.you.p[1], m.you.p[2]);
        this.rotY = m.you.r;
        this.follow.yaw = m.you.r;
        this.follow.snap();
        for (const r of this.remotes.values()) this.scene.remove(r.char.root);
        this.remotes.clear();
        store.players.clear();
        for (const p of m.players) this.addRemote(p);
        store.players.set(m.you.id, m.you);
        this.applyMissions();
        store.missions = m.missions;
        this.applyMissions();
        store.wallet = m.wallet;
        store.party = m.party;
        store.chat = m.chat;
        this.flashlightOn = this.env.night > 0.5 || this.inCave;
        store.emit('world');
        store.emit('missions');
        store.emit('wallet');
        store.emit('party');
        store.emit('chat');
        store.emit('players');
        break;
      }
      case 'snapshot': {
        const now = performance.now();
        for (const s of m.players) {
          const r = this.remotes.get(s.id);
          if (!r) continue;
          r.samples.push({ t: now, p: s.p, r: s.r, a: s.a });
          if (r.samples.length > 20) r.samples.shift();
        }
        break;
      }
      case 'player_join':
        this.addRemote(m.player);
        store.emit('players');
        break;
      case 'player_update': {
        store.players.set(m.player.id, m.player);
        if (m.player.id === this.myCharId) this.me?.apply(m.player.appearance);
        else this.remotes.get(m.player.id)?.char.apply(m.player.appearance);
        this.refreshTags();
        store.emit('players');
        break;
      }
      case 'player_leave': {
        const r = this.remotes.get(m.id);
        if (r) {
          this.scene.remove(r.char.root);
          r.char.dispose();
          this.remotes.delete(m.id);
        }
        store.players.delete(m.id);
        store.emit('players');
        break;
      }
      case 'interact_result': {
        if (m.discovered) {
          for (const c of m.discovered.clues) this.ui?.discovery('Nueva pista', c);
          for (const it of m.discovered.items) this.ui?.discovery('Objeto encontrado', it);
          if (m.discovered.clues.length || m.discovered.items.length) this.audio.clue();
        }
        if (m.puzzle) this.ui?.puzzle(m.puzzle);
        if (m.dialogue?.length || m.messages.length) this.ui?.dialogue(m.dialogue ?? [], m.messages);
        if (/abre|cede|chirrido/.test(m.messages.join(' '))) this.audio.creak();
        break;
      }
      case 'solve_result':
        this.ui?.puzzleResult(m.ok, m.message);
        if (m.ok) this.audio.clue();
        else this.audio.fail();
        break;
      case 'missions':
        store.missions = m.missions;
        this.applyMissions();
        store.emit('missions');
        break;
      case 'mission_complete':
        this.audio.success();
        this.ui?.missionComplete(m.title, m.rewards);
        break;
      case 'wallet':
        store.wallet = m.wallet;
        store.emit('wallet');
        break;
      case 'inventory_changed':
        store.inventoryDirty = true;
        store.emit('inventory');
        break;
      case 'chat':
        store.chat.push(m.line);
        if (store.chat.length > 80) store.chat.shift();
        store.emit('chat');
        break;
      case 'party':
        store.party = m.party;
        this.refreshTags();
        store.emit('party');
        break;
      case 'party_invite':
        this.ui?.partyInvite(m.inviteId, m.from);
        break;
      case 'notice':
        this.ui?.toast(m.level, m.text);
        break;
      case 'teleport':
        this.pos.set(m.p[0], m.p[1], m.p[2]);
        this.rotY = m.r;
        this.follow.yaw = m.r;
        this.follow.snap();
        if (this.inCave) this.flashlightOn = true;
        break;
      case 'correct':
        this.pos.set(m.p[0], m.p[1], m.p[2]);
        break;
      case 'world':
        this.serverOffset = m.world.serverTime - Date.now();
        store.world = m.world;
        this.env.weather = m.world.weather;
        store.emit('world');
        break;
      case 'pong':
        this.serverOffset = m.serverTime - Date.now();
        break;
      case 'kicked':
        this.ui?.kicked(m.reason);
        break;
      case 'error':
        if (m.code === 'auth' || m.code === 'no_character' || m.code === 'version') this.ui?.kicked(m.message);
        else this.ui?.toast('error', m.message);
        break;
    }
  }

  private addRemote(p: import('../../../shared/protocol').PublicPlayer) {
    if (p.id === this.myCharId || this.remotes.has(p.id)) return;
    const char = new Character(p.appearance, p.name);
    char.root.position.set(p.p[0], p.p[1], p.p[2]);
    char.root.rotation.y = p.r;
    this.scene.add(char.root);
    this.remotes.set(p.id, { char, userId: p.userId, samples: [{ t: performance.now(), p: p.p, r: p.r, a: p.a }], speed: 0 });
    store.players.set(p.id, p);
    this.refreshTags();
  }

  private refreshTags() {
    const partyIds = new Set(store.party?.members.map((m) => m.userId) ?? []);
    for (const [id, r] of this.remotes) {
      const p = store.players.get(id);
      if (!p) continue;
      r.char.setName(p.name, partyIds.has(p.userId) ? 'Tu grupo' : undefined, partyIds.has(p.userId) ? '#8fd0ff' : '#f0d9a4');
    }
  }

  private applyMissions() {
    const payload = store.missions;
    const seen = new Set<string>();
    for (const e of payload.entities) {
      seen.add(e.id);
      let v = this.entities.get(e.id);
      if (!v) {
        v = new EntityVisual(e);
        this.entities.set(e.id, v);
        this.scene.add(v.root);
      } else v.sync(e);
    }
    for (const [id, v] of this.entities) {
      if (!seen.has(id)) {
        this.scene.remove(v.root);
        this.entities.delete(id);
      }
    }
    // Colisionadores dinámicos (puertas cerradas)
    this.grid.dynamic = payload.entities
      .filter((e) => e.blocking && e.visible && e.blockSize)
      .map((e): Collider => {
        const [w, d] = e.blockSize!;
        const rot = Math.abs(Math.sin(e.rotY ?? 0)) > 0.5;
        const hw = (rot ? d : w) / 2;
        const hd = (rot ? w : d) / 2;
        return { type: 'box', minX: e.p[0] - hw, maxX: e.p[0] + hw, minZ: e.p[2] - hd, maxZ: e.p[2] + hd, id: e.id };
      });
    // NPC
    const markers = payload.missions.filter((m) => (m.status === 'active' || m.status === 'available') && m.marker).map((m) => m.marker!);
    for (const n of payload.npcs) {
      let c = this.npcs.get(n.id);
      if (!c) {
        c = new Character(n.appearance, n.name, 'Vecino de San Bartolo');
        c.root.position.set(n.p[0], heightAt(n.p[0], n.p[2]), n.p[2]);
        c.root.rotation.y = n.rotY;
        this.scene.add(c.root);
        this.npcs.set(n.id, c);
      }
      const marked = markers.some((mk) => Math.hypot(mk[0] - n.p[0], mk[2] - n.p[2]) < 0.5);
      c.setName(marked ? `❗ ${n.name}` : n.name, 'Vecino de San Bartolo', marked ? '#ffd27a' : '#f0d9a4');
    }
    const tracked = store.tracked();
    if (tracked?.marker && (tracked.status === 'active' || tracked.status === 'available')) {
      this.beacon.visible = true;
      this.beacon.position.set(tracked.marker[0], tracked.marker[1] + 30, tracked.marker[2]);
    } else this.beacon.visible = false;
  }

  private interactables(): Interactable[] {
    const list: Interactable[] = [];
    for (const e of store.missions.entities) if (e.visible) list.push({ id: e.id, label: e.label, p: e.p, radius: e.radius });
    for (const n of store.missions.npcs) list.push({ id: n.id, label: `Hablar con ${n.name}`, p: n.p, radius: 2.8 });
    return list;
  }

  // ------------------------------------------------------------------ bucle principal

  private frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    this.fps = this.fps * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
    this.env.timeOfDay = worldTimeOfDay(this.serverNow, store.world?.dayLengthSec);
    this.input.poll();
    const actions = this.input.consumeActions();
    const camDelta = this.input.consumeCamera();
    const zoom = this.input.consumeZoom();

    if (this.mode === 'play' && !this.paused) {
      this.follow.rotate(camDelta.x, camDelta.y);
      if (zoom) this.follow.zoom(zoom);
      this.updatePlayer(dt);
      for (const a of actions) {
        if (a === 'interact') this.interact();
        else if (a === 'flashlight') this.toggleFlashlight();
        else this.ui?.action(a);
      }
      this.follow.update(this.pos, dt);
      this.sendMovement(dt);
    } else if (this.mode === 'play') {
      for (const a of actions) if (a === 'escape') this.ui?.action(a);
      this.follow.update(this.pos, dt);
    } else if (this.mode === 'preview') {
      this.attractT += dt;
      const target = new THREE.Vector3(3, 1.1, 3);
      this.camera.position.set(3 + Math.sin(this.attractT * 0.25) * 0.4 - 2.2, 1.7, 3 - 2.4);
      this.camera.lookAt(target);
      this.me?.update(dt, 0);
      if (this.me) this.me.root.rotation.y += dt * 0.35;
    } else {
      this.attractT += dt * 0.04;
      const r = 26;
      this.camera.position.set(Math.sin(this.attractT) * r, 9 + Math.sin(this.attractT * 2) * 1.5, Math.cos(this.attractT) * r - 20);
      this.camera.lookAt(0, 3, -40);
    }

    const center = this.mode === 'play' ? this.pos : this.camera.position;
    const inCave = this.mode === 'play' && this.inCave;
    this.env.update(dt, center, inCave);
    this.updateLights(dt, inCave);
    this.updateRemotes(dt);
    for (const v of this.entities.values()) v.update(dt, this.env.night);
    for (const n of this.npcs.values()) n.update(dt, 0);
    for (const w of this.world.water) w.position.y = 0.55 + Math.sin(performance.now() * 0.001) * 0.005;
    this.world.dust.rotation.y += dt * 0.01;
    this.updateMystery(dt);
    const tracked = store.tracked();
    if (this.beacon.visible && this.mode === 'play') {
      const bd = Math.hypot(this.beacon.position.x - this.pos.x, this.beacon.position.z - this.pos.z);
      (this.beacon.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.clamp((bd - 6) / 30, 0, 1) * 0.04;
    }
    let tension = 0;
    if (this.mode === 'play' && tracked?.marker && tracked.status === 'active') {
      const d = Math.hypot(tracked.marker[0] - this.pos.x, tracked.marker[2] - this.pos.z);
      tension = THREE.MathUtils.clamp(1 - d / 40, 0, 1) * 0.6;
    }
    if (this.mode === 'play' && Math.hypot(this.pos.x - CASA_MORALES.x, this.pos.z - CASA_MORALES.z) < 20) tension += 0.25;
    this.audio.update({ night: this.env.night, weather: this.env.weather, inCave, tension, dt });
    this.renderer.render(this.scene, this.camera);
    if (this.mode === 'play') this.ui?.frame();
  }

  private updatePlayer(dt: number) {
    if (!this.me) return;
    const f = this.follow.forward();
    const right = new THREE.Vector3(-f.z, 0, f.x);
    const mv = this.input.move;
    const dir = new THREE.Vector3().addScaledVector(f, mv.y).addScaledVector(right, mv.x);
    const mag = Math.min(1, dir.length());
    const run = this.input.run;
    const target = mag > 0.05 ? (run ? MOVE.runSpeed : MOVE.walkSpeed) * Math.max(mag, 0.4) : 0;
    this.speed += (target - this.speed) * Math.min(1, dt * 10);
    if (mag > 0.05) {
      dir.normalize();
      const desired = Math.atan2(-dir.x, -dir.z);
      let delta = desired - this.rotY;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      this.rotY += delta * Math.min(1, dt * 12);
      let nx = this.pos.x + dir.x * this.speed * dt;
      let nz = this.pos.z + dir.z * this.speed * dt;
      [nx, nz] = this.grid.resolve(nx, nz, MOVE.playerRadius);
      this.pos.x = nx;
      this.pos.z = nz;
    }
    this.pos.y = heightAt(this.pos.x, this.pos.z);
    this.anim = this.speed < 0.2 ? 'idle' : run && this.speed > MOVE.walkSpeed + 0.3 ? 'run' : 'walk';
    this.me.anim = this.anim;
    this.me.root.position.copy(this.pos);
    this.me.root.rotation.y = this.rotY;
    this.me.update(dt, this.speed);
    // Pasos
    const ph = this.me.stepPhase();
    const step = Math.floor(ph / Math.PI);
    if (this.anim !== 'idle' && step !== this.lastStep) {
      const inside = this.pos.x > CASA_MORALES.minX && this.pos.x < CASA_MORALES.maxX && this.pos.z > CASA_MORALES.minZ && this.pos.z < CASA_MORALES.maxZ;
      const surface = inside ? 'wood' : this.inCave || Math.hypot(this.pos.x - PLAZA.x, this.pos.z - PLAZA.z) < PLAZA.r ? 'stone' : 'grass';
      this.audio.footstep(this.anim === 'run', surface);
    }
    this.lastStep = step;

    // Objeto interactuable más cercano
    let best: Interactable | null = null;
    let bestD = Infinity;
    const reg = regionOf(this.pos.x, this.pos.z);
    for (const it of this.interactables()) {
      if (regionOf(it.p[0], it.p[2]) !== reg) continue;
      const d = Math.hypot(it.p[0] - this.pos.x, it.p[2] - this.pos.z);
      if (d <= Math.min(it.radius, INTERACT.clientRange + 0.6) && d < bestD) {
        best = it;
        bestD = d;
      }
    }
    if (best?.id !== this.nearest?.id) this.ui?.prompt(best ? best.label : null);
    this.nearest = best;
  }

  private sendMovement(dt: number) {
    this.sendT += dt;
    if (this.sendT < 1 / NET.clientSendRate) return;
    this.sendT = 0;
    const l = this.lastSent;
    const now = performance.now();
    const changed = Math.hypot(l.x - this.pos.x, l.z - this.pos.z) > 0.02 || Math.abs(l.r - this.rotY) > 0.02 || l.a !== this.anim;
    if (!changed && now - l.t < 1000) return;
    this.socket.send({ t: 'move', p: [this.pos.x, this.pos.y, this.pos.z], r: this.rotY, a: this.anim, seq: ++this.seq });
    this.lastSent = { x: this.pos.x, z: this.pos.z, r: this.rotY, a: this.anim, t: now };
    if (this.seq % 60 === 0) this.socket.send({ t: 'ping', ts: now });
  }

  private updateRemotes(dt: number) {
    const renderT = performance.now() - 1000 / NET.snapshotRate - 30;
    for (const r of this.remotes.values()) {
      const s = r.samples;
      let a = s[0];
      let b = s[s.length - 1];
      for (let i = 0; i < s.length - 1; i++) {
        if (s[i].t <= renderT && s[i + 1].t >= renderT) {
          a = s[i];
          b = s[i + 1];
          break;
        }
      }
      const k = b.t === a.t ? 1 : THREE.MathUtils.clamp((renderT - a.t) / (b.t - a.t), 0, 1);
      const prev = r.char.root.position.clone();
      r.char.root.position.set(a.p[0] + (b.p[0] - a.p[0]) * k, a.p[1] + (b.p[1] - a.p[1]) * k, a.p[2] + (b.p[2] - a.p[2]) * k);
      let dr = b.r - a.r;
      dr = Math.atan2(Math.sin(dr), Math.cos(dr));
      r.char.root.rotation.y = a.r + dr * k;
      r.speed = prev.distanceTo(r.char.root.position) / Math.max(dt, 1e-3);
      r.char.anim = b.a;
      r.char.update(dt, r.speed);
      const d = r.char.root.position.distanceTo(this.pos);
      r.char.root.visible = d < NET.interestRadius + 10;
    }
  }

  private updateLights(dt: number, inCave: boolean) {
    const night = this.env.night;
    const dim = this.env.weather === 'storm' ? 1.1 : 1;
    this.world.windowMat.emissiveIntensity = night * 1.8;
    this.world.lampGlassMat.emissiveIntensity = night * 2.2;
    this.world.chapelGlassMat.emissiveIntensity = night * 0.9;
    // Farolas: asignar las luces disponibles a las farolas más cercanas
    this.lampAssignT -= dt;
    const center = this.mode === 'play' ? this.pos : this.camera.position;
    if (this.lampAssignT <= 0) {
      this.lampAssignT = 0.5;
      const sorted = this.world.lamps.map((l, i) => ({ i, d: l.pos.distanceTo(center) })).sort((a, b) => a.d - b.d);
      this.lampLights.forEach((light, k) => {
        const lamp = sorted[k] ? this.world.lamps[sorted[k].i] : null;
        if (lamp) {
          light.position.copy(lamp.pos).add(new THREE.Vector3(0, -0.2, 0));
          light.userData.lamp = sorted[k].i;
        }
      });
    }
    this.flickerT -= dt;
    if (this.flickerT <= 0) {
      this.flickerT = 6 + Math.random() * 20;
      this.flickerLamp = Math.floor(Math.random() * this.world.lamps.length);
      setTimeout(() => (this.flickerLamp = -1), 1600);
    }
    const t = performance.now() * 0.001;
    for (const light of this.lampLights) {
      const idx = light.userData.lamp as number | undefined;
      const lamp = idx !== undefined ? this.world.lamps[idx] : null;
      let f = 1;
      if (lamp?.broken || idx === this.flickerLamp) f = Math.sin(t * 37) > 0.2 && Math.sin(t * 5.3) > -0.4 ? 1 : 0.05;
      light.intensity = inCave ? 0 : night * 14 * f * dim;
    }
    // Linterna
    const cfg = FLASHLIGHT[this.me?.lanternId ?? 'linterna_basica'] ?? FLASHLIGHT.linterna_basica;
    const has = !!this.me?.lanternId;
    this.flashlight.intensity = this.mode === 'play' && this.flashlightOn && has ? cfg.intensity : 0;
    this.flashlight.distance = cfg.range;
    this.flashlight.angle = cfg.angle;
    this.flashlight.color.set(cfg.color);
    if (this.me) {
      const f = this.follow.forward();
      const origin = this.pos.clone().add(new THREE.Vector3(0, 1.45, 0)).addScaledVector(f, 0.3);
      this.flashlight.position.copy(origin);
      const aim = origin.clone().addScaledVector(f, 10);
      aim.y -= 1.5 + this.follow.pitch * 4;
      this.flashlight.target.position.copy(aim);
    }
  }

  private updateMystery(dt: number) {
    if (this.mode !== 'play') return;
    // Balanceo de la campana
    this.bellSwing = Math.max(0, this.bellSwing - dt * 0.15);
    this.world.bell.rotation.z = Math.sin(performance.now() * 0.004) * 0.35 * this.bellSwing;
    // Figura en la niebla
    if (this.shadowT > 0) {
      this.shadowT -= dt;
      const d = this.shadowFigure.root.position.distanceTo(this.pos);
      if (this.shadowT <= 0 || d < 14) {
        this.shadowFigure.root.visible = false;
        this.shadowT = 0;
      }
    }
    this.mysteryT -= dt;
    if (this.mysteryT > 0) return;
    this.mysteryT = 45 + Math.random() * 75;
    const night = this.env.night > 0.5;
    const nearHouse = Math.hypot(this.pos.x - CASA_MORALES.x, this.pos.z - CASA_MORALES.z) < 35;
    const roll = Math.random();
    if (this.inCave) {
      this.audio.whisper();
    } else if (night && roll < 0.3) {
      this.audio.bell(3);
      this.bellSwing = 1;
    } else if (nearHouse && roll < 0.6) {
      this.audio.whisper();
    } else if (night && roll < 0.85) {
      // Silueta inmóvil al borde del bosque, fuera del centro de la vista
      const f = this.follow.forward();
      const side = new THREE.Vector3(-f.z, 0, f.x).multiplyScalar(Math.random() < 0.5 ? -1 : 1);
      const p = this.pos.clone().addScaledVector(f, 24).addScaledVector(side, 12);
      if (regionOf(p.x, p.z) === 'outdoor') {
        p.y = heightAt(p.x, p.z);
        this.shadowFigure.root.position.copy(p);
        this.shadowFigure.root.lookAt(this.pos.x, p.y, this.pos.z);
        this.shadowFigure.root.rotateY(Math.PI);
        this.shadowFigure.root.visible = true;
        this.shadowT = 2.2;
      }
    } else {
      this.audio.creak();
    }
  }
}
