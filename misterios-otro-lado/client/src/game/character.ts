import * as THREE from 'three';
import type { AnimState, Appearance } from '../../../shared/protocol';

const OUTFITS: Record<string, { color: string; long: boolean }> = {
  abrigo_detective: { color: '#9c8156', long: true },
  abrigo_nocturno: { color: '#1b2230', long: true },
};

function label(text: string, color = '#f0d9a4', sub?: string) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.font = '600 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 6;
  ctx.fillStyle = color;
  ctx.fillText(text, 128, sub ? 22 : 32, 250);
  if (sub) {
    ctx.font = 'italic 400 18px Georgia, serif';
    ctx.fillStyle = '#8fb3c9';
    ctx.fillText(sub, 128, 48, 250);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true, fog: false }));
  s.scale.set(2.0, 0.5, 1);
  s.renderOrder = 10;
  return s;
}

/** Personaje humanoide procedural (se sustituirá por modelos riggeados con el arte final). */
export class Character {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private head = new THREE.Group();
  private torsoMat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  private coatTail: THREE.Mesh;
  private skinMat = new THREE.MeshStandardMaterial({ roughness: 0.7 });
  private hairMat = new THREE.MeshStandardMaterial({ roughness: 0.95 });
  private pantsMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
  private hatSlot = new THREE.Group();
  private handSlot = new THREE.Group();
  private tag: THREE.Sprite | null = null;
  private phase = 0;
  anim: AnimState = 'idle';
  /** Luz del farol (sólo para el propio jugador si lo equipa). */
  lanternLight: THREE.PointLight | null = null;
  lanternId: string | null = null;

  constructor(appearance: Appearance, name?: string, sub?: string) {
    const shoe = new THREE.MeshStandardMaterial({ color: '#16120e', roughness: 0.6 });
    const leg = (g: THREE.Group, x: number) => {
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.62, 4, 8), this.pantsMat);
      m.position.y = -0.42;
      m.castShadow = true;
      g.add(m);
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.3), shoe);
      f.position.set(0, -0.83, -0.05);
      g.add(f);
      g.position.set(x, 0.92, 0);
      this.body.add(g);
    };
    leg(this.legL, -0.13);
    leg(this.legR, 0.13);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.5, 4, 10), this.torsoMat);
    torso.scale.set(1, 1, 0.72);
    torso.position.y = 1.28;
    torso.castShadow = true;
    this.body.add(torso);
    this.coatTail = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.34, 0.6, 10, 1, true), this.torsoMat);
    this.coatTail.position.y = 0.82;
    this.coatTail.scale.z = 0.75;
    this.coatTail.castShadow = true;
    (this.coatTail.material as THREE.Material).side = THREE.DoubleSide;
    this.body.add(this.coatTail);
    const arm = (g: THREE.Group, x: number) => {
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.52, 4, 8), this.torsoMat);
      m.position.y = -0.3;
      m.castShadow = true;
      g.add(m);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), this.skinMat);
      hand.position.y = -0.62;
      g.add(hand);
      g.position.set(x, 1.55, 0);
      this.body.add(g);
    };
    arm(this.armL, -0.33);
    arm(this.armR, 0.33);
    this.handSlot.position.set(0, -0.62, -0.05);
    this.armR.add(this.handSlot);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), this.skinMat);
    skull.scale.set(0.95, 1.08, 1);
    skull.castShadow = true;
    this.head.add(skull);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), this.hairMat);
    hair.position.set(0, 0.02, 0.01);
    this.head.add(hair);
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#0d0d0d' });
    for (const x of [-0.06, 0.06]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), eyeMat);
      eye.position.set(x, 0.02, -0.155);
      this.head.add(eye);
    }
    this.head.add(this.hatSlot);
    this.head.position.y = 1.78;
    this.body.add(this.head);
    this.root.add(this.body);
    this.apply(appearance);
    if (name) this.setName(name, sub);
  }

  setName(name: string, sub?: string, color?: string) {
    if (this.tag) {
      this.root.remove(this.tag);
      (this.tag.material as THREE.SpriteMaterial).map?.dispose();
    }
    this.tag = label(name, color, sub);
    this.tag.position.y = 2.35;
    this.root.add(this.tag);
  }

  showTag(v: boolean) {
    if (this.tag) this.tag.visible = v;
  }

  apply(a: Appearance) {
    this.skinMat.color.set(a.skin);
    this.hairMat.color.set(a.hair);
    this.pantsMat.color.set(a.pants);
    const outfit = a.outfit ? OUTFITS[a.outfit] : undefined;
    this.torsoMat.color.set(outfit?.color ?? a.coat);
    this.coatTail.visible = !!outfit?.long;
    this.hatSlot.clear();
    if (a.hat === 'sombrero_fedora') {
      const m = new THREE.MeshStandardMaterial({ color: '#4a4a4a', roughness: 0.8 });
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.16, 14), m);
      crown.position.y = 0.17;
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 20), m);
      brim.position.y = 0.1;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.172, 0.172, 0.04, 14), new THREE.MeshStandardMaterial({ color: '#1a1a1a' }));
      band.position.y = 0.12;
      this.hatSlot.add(crown, brim, band);
    } else if (a.hat === 'gorro_lana') {
      const m = new THREE.MeshStandardMaterial({ color: '#6b2f2a', roughness: 1 });
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), m);
      cap.position.y = 0.03;
      const fold = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.035, 6, 16), m);
      fold.rotation.x = Math.PI / 2;
      fold.position.y = 0.04;
      this.hatSlot.add(cap, fold);
    } else if (a.hat === 'insignia_investigador') {
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), new THREE.MeshStandardMaterial({ color: '#e0a33a', emissive: '#6b4a10', metalness: 0.9, roughness: 0.3 }));
      star.position.set(0.12, -0.45, -0.16);
      this.hatSlot.add(star);
    }
    this.handSlot.clear();
    this.lanternId = a.lantern ?? null;
    if (a.lantern === 'farol_antiguo') {
      const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.18, 6), new THREE.MeshStandardMaterial({ color: '#2a2218', metalness: 0.6 }));
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshStandardMaterial({ color: '#ffcc80', emissive: '#ffae45', emissiveIntensity: 2 }));
      frame.position.y = -0.1;
      glow.position.y = -0.1;
      this.handSlot.add(frame, glow);
    } else if (a.lantern) {
      const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.22, 8), new THREE.MeshStandardMaterial({ color: a.lantern === 'linterna_potente' ? '#202a30' : '#3a3a3a', metalness: 0.7, roughness: 0.4 }));
      torch.rotation.x = Math.PI / 2;
      this.handSlot.add(torch);
    }
  }

  update(dt: number, speed: number) {
    const moving = this.anim !== 'idle' && speed > 0.1;
    const freq = this.anim === 'run' ? 11 : 7;
    this.phase += dt * (moving ? freq : 1.2);
    const amp = moving ? (this.anim === 'run' ? 0.75 : 0.5) : 0;
    const s = Math.sin(this.phase);
    this.legL.rotation.x = s * amp;
    this.legR.rotation.x = -s * amp;
    this.armL.rotation.x = -s * amp * 0.8;
    this.armR.rotation.x = s * amp * 0.8 - (this.lanternId ? 0.5 : 0);
    this.body.position.y = moving ? Math.abs(Math.cos(this.phase)) * 0.05 : Math.sin(this.phase) * 0.008;
    this.body.rotation.x = moving && this.anim === 'run' ? -0.12 : 0;
    this.head.rotation.y = moving ? 0 : Math.sin(this.phase * 0.3) * 0.25;
  }

  /** Instante del paso (para sonido de pisadas). */
  stepPhase() {
    return this.phase;
  }

  dispose() {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
    });
  }
}
