import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import type { AnimState, Appearance } from '../../../shared/protocol';
import { Character, type CharacterLike } from './character';

/**
 * Modelos humanos profesionales (.glb con esqueleto y animaciones: Mixamo, Ready Player Me,
 * escaneos fotogramétricos, arte propio…).
 *
 * Para activarlo, copia el modelo en `client/public/models/` y crea `client/public/models/manifest.json`:
 * {
 *   "character": {
 *     "url": "/models/investigador.glb",
 *     "height": 1.78,                 // altura deseada en metros
 *     "rotateY": 3.1416,              // el juego mira hacia -Z (Mixamo mira hacia +Z)
 *     "clips": { "idle": "Idle", "walk": "Walk", "run": "Run" },
 *     "tint": ["coat", "jacket"]      // materiales que toman el color del abrigo elegido
 *   }
 * }
 * Si el archivo no existe o falla, se usa el personaje procedural. Revisa la licencia del modelo:
 * muchos (p. ej. Mixamo) permiten usarlo en juegos pero no redistribuirlo suelto en un repositorio público.
 */

interface Manifest {
  character?: { url: string; height?: number; rotateY?: number; clips?: Partial<Record<AnimState, string>>; tint?: string[] };
}

let asset: { gltf: GLTF; cfg: NonNullable<Manifest['character']> } | null = null;

export async function loadCharacterModel(): Promise<boolean> {
  try {
    const res = await fetch('/models/manifest.json', { cache: 'no-cache' });
    if (!res.ok) return false;
    const m = (await res.json()) as Manifest;
    if (!m.character?.url) return false;
    const gltf = await new GLTFLoader().loadAsync(m.character.url);
    asset = { gltf, cfg: m.character };
    return true;
  } catch (e) {
    console.warn('[modelos] no se pudo cargar el personaje .glb; se usa el procedural', e);
    return false;
  }
}

export function createCharacter(appearance: Appearance, name?: string, sub?: string): CharacterLike {
  if (asset) return new GltfCharacter(appearance, name, sub);
  return new Character(appearance, name, sub);
}

class GltfCharacter implements CharacterLike {
  readonly root = new THREE.Group();
  anim: AnimState = 'idle';
  lanternId: string | null = null;
  holding = false;
  private model: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private actions = new Map<AnimState, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private tintMats: THREE.MeshStandardMaterial[] = [];
  private tagHost: Character;
  private phase = 0;

  constructor(appearance: Appearance, name?: string, sub?: string) {
    const { gltf, cfg } = asset!;
    this.model = SkeletonUtils.clone(gltf.scene);
    // Normalizar altura y orientación
    const box = new THREE.Box3().setFromObject(this.model);
    const h = box.max.y - box.min.y || 1;
    const s = (cfg.height ?? 1.78) / h;
    this.model.scale.setScalar(s);
    this.model.position.y = -box.min.y * s;
    this.model.rotation.y = cfg.rotateY ?? Math.PI;
    this.root.add(this.model);
    const tint = (cfg.tint ?? ['coat', 'jacket']).map((t) => t.toLowerCase());
    this.model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat && tint.some((t) => mat.name.toLowerCase().includes(t))) {
        m.material = mat.clone();
        this.tintMats.push(m.material as THREE.MeshStandardMaterial);
      }
    });
    this.mixer = new THREE.AnimationMixer(this.model);
    const find = (want: string | undefined, fallback: RegExp) =>
      gltf.animations.find((a) => (want ? a.name === want : false)) ?? gltf.animations.find((a) => fallback.test(a.name));
    const map: [AnimState, RegExp][] = [
      ['idle', /idle|stand/i],
      ['walk', /walk/i],
      ['run', /run|jog/i],
    ];
    for (const [k, re] of map) {
      const clip = find(cfg.clips?.[k], re);
      if (clip) this.actions.set(k, this.mixer.clipAction(clip));
    }
    // Reutiliza la etiqueta de nombre del personaje procedural (sin añadir su cuerpo)
    this.tagHost = new Character(appearance);
    if (name) this.setName(name, sub);
    this.apply(appearance);
    this.play('idle');
  }

  private play(a: AnimState) {
    const next = this.actions.get(a) ?? this.actions.get('walk') ?? this.actions.get('idle');
    if (!next || next === this.current) return;
    next.reset().fadeIn(0.25).play();
    this.current?.fadeOut(0.25);
    this.current = next;
  }

  setName(name: string, sub?: string, color?: string) {
    this.tagHost.setName(name, sub, color);
    const tag = this.tagHost.root.children.find((c) => (c as THREE.Sprite).isSprite);
    for (const c of [...this.root.children]) if ((c as THREE.Sprite).isSprite) this.root.remove(c);
    if (tag) this.root.add(tag);
  }

  showTag(v: boolean) {
    for (const c of this.root.children) if ((c as THREE.Sprite).isSprite) c.visible = v;
  }

  apply(a: Appearance) {
    for (const m of this.tintMats) m.color.set(a.coat);
    this.lanternId = a.lantern ?? null;
  }

  update(dt: number, speed: number) {
    const moving = this.anim !== 'idle' && speed > 0.1;
    this.play(moving ? (this.anim === 'run' && this.actions.has('run') ? 'run' : 'walk') : 'idle');
    if (this.current && moving) this.current.timeScale = THREE.MathUtils.clamp(speed / (this.anim === 'run' ? 6 : 3.2), 0.6, 1.6);
    this.phase += dt * (moving ? 2.3 + speed : 0);
    this.mixer.update(dt);
  }

  stepPhase() {
    return this.phase;
  }

  dispose() {
    this.mixer.stopAllAction();
  }
}
