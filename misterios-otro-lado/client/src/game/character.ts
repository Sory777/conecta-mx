import * as THREE from 'three';
import type { AnimState, Appearance } from '../../../shared/protocol';
import * as CT from './characterTextures';

// Personaje humano procedural de proporciones realistas (≈1.78 m):
// esqueleto jerárquico (pelvis, columna, cuello, cabeza, hombros, codos, muñecas, caderas, rodillas, tobillos),
// rostro esculpido por vértices, ojos con iris y parpadeo, peinados, barba, ropa en capas y materiales PBR.
// Si se instala un modelo .glb profesional (ver gltfCharacter.ts) se usa ese en su lugar.

const OUTFITS: Record<string, { color: string; long: boolean }> = {
  abrigo_detective: { color: '#9c8156', long: true },
  abrigo_nocturno: { color: '#1b2230', long: true },
};

export interface CharacterLike {
  readonly root: THREE.Group;
  anim: AnimState;
  lanternId: string | null;
  /** El personaje sostiene la linterna al frente (sólo lo sabe el jugador local). */
  holding: boolean;
  setName(name: string, sub?: string, color?: string): void;
  showTag(v: boolean): void;
  apply(a: Appearance): void;
  update(dt: number, speed: number): void;
  stepPhase(): number;
  dispose(): void;
}

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

/** Sólido de revolución a partir de un perfil [y, radio] (de abajo a arriba), cerrado en los extremos. */
function lathe(profile: [number, number][], segs = 16, phiStart = 0, phiLength = Math.PI * 2, closed = true) {
  const pts: THREE.Vector2[] = [];
  if (closed) pts.push(new THREE.Vector2(0, profile[0][0]));
  for (const [y, r] of profile) pts.push(new THREE.Vector2(r, y));
  if (closed) pts.push(new THREE.Vector2(0, profile[profile.length - 1][0]));
  return new THREE.LatheGeometry(pts, segs, phiStart, phiLength);
}

function smooth(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Moldea una esfera como cráneo/rostro humano (mandíbula, pómulos, mentón, nuca, cuencas). */
function sculptHead(g: THREE.BufferGeometry, r: number, face = false, hairline = false) {
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().divideScalar(r);
    let { x, y, z } = v;
    x *= 0.8;
    y *= 1.1;
    const front = Math.max(0, -n.z);
    // Mandíbula más estrecha y mentón adelantado
    const low = smooth(-0.05, -0.95, n.y);
    x *= 1 - 0.17 * low;
    z *= 1 - 0.12 * low * (n.z > 0 ? 1 : 0.4);
    if (n.y < -0.55 && n.z < -0.2) z -= 0.012 * smooth(-0.55, -0.9, n.y) * front;
    // Pómulos
    x *= 1 + 0.05 * Math.exp(-((n.y + 0.05) ** 2) * 30) * front;
    // Nuca más amplia
    if (n.z > 0.2 && n.y > -0.3) z *= 1.07;
    // Cara algo más plana
    if (n.z < -0.55) z *= 0.94;
    // Cuencas de los ojos
    for (const ex of [-0.38, 0.38]) {
      const d = Math.hypot(n.x - ex, n.y - 0.08);
      if (n.z < -0.6 && d < 0.2) z += 0.007 * (1 - d / 0.2);
    }
    if (face && n.z < -0.2) {
      const fx = n.x;
      // Nariz: puente -> punta -> base
      const ridge = Math.exp(-((fx / 0.11) ** 2));
      const along = smooth(0.12, -0.28, n.y) * (1 - smooth(-0.3, -0.42, n.y));
      z -= 0.024 * ridge * along * front;
      // Aletas nasales
      const wing = Math.exp(-(((Math.abs(fx) - 0.1) / 0.06) ** 2)) * Math.exp(-(((n.y + 0.33) / 0.06) ** 2));
      z -= 0.007 * wing * front;
      // Arco superciliar
      z -= 0.006 * Math.exp(-(((n.y - 0.3) / 0.08) ** 2)) * Math.exp(-((fx / 0.5) ** 2)) * front;
      // Labios y mentón
      z -= 0.006 * Math.exp(-(((n.y + 0.56) / 0.07) ** 2)) * Math.exp(-((fx / 0.22) ** 2)) * front;
      z -= 0.006 * Math.exp(-(((n.y + 0.86) / 0.08) ** 2)) * Math.exp(-((fx / 0.25) ** 2)) * front;
      // Surco entre labios
      z += 0.003 * Math.exp(-(((n.y + 0.615) / 0.018) ** 2)) * Math.exp(-((fx / 0.2) ** 2)) * front;
    }
    if (hairline && n.z < -0.25 && n.y < 0.62) {
      // Nacimiento del pelo: la parte delantera baja se recoge sobre la frente
      const k = smooth(0.62, 0.3, n.y);
      y = y + (0.075 - y) * k;
      z *= 1 - 0.08 * k;
    }
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

export class Character implements CharacterLike {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private pelvis = new THREE.Group();
  private spine = new THREE.Group();
  private neck = new THREE.Group();
  private head = new THREE.Group();
  private eyes = new THREE.Group();
  private thigh: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
  private shin: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
  private foot: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
  private upperArm: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
  private forearm: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
  private handR = new THREE.Group();
  private torso!: THREE.Mesh;
  private skirt!: THREE.Mesh;
  private hairGroup = new THREE.Group();
  private hatSlot = new THREE.Group();
  private chestSlot = new THREE.Group();
  private handSlot = new THREE.Group();
  private tag: THREE.Sprite | null = null;

  private skinMat: THREE.MeshStandardMaterial;
  private lipMat: THREE.MeshStandardMaterial;
  private coatMat: THREE.MeshStandardMaterial;
  private pantsMat: THREE.MeshStandardMaterial;
  private hairMat: THREE.MeshStandardMaterial;
  private bootMat: THREE.MeshStandardMaterial;
  private shirtMat = new THREE.MeshStandardMaterial({ color: '#d8d2c4', roughness: 0.8 });

  private phase = 0;
  private t = Math.random() * 100;
  private walkW = 0;
  private runW = 0;
  private blinkT = 2 + Math.random() * 3;
  private blink = 0;
  anim: AnimState = 'idle';
  lanternId: string | null = null;
  holding = false;
  lanternLight: THREE.PointLight | null = null;

  constructor(appearance: Appearance, name?: string, sub?: string) {
    const skinT = CT.skin();
    const twill = CT.twill();
    const denim = CT.denim();
    const leather = CT.leather();
    const hairT = CT.hair();
    this.skinMat = new THREE.MeshStandardMaterial({ map: skinT.map, normalMap: skinT.normal, normalScale: new THREE.Vector2(0.25, 0.25), roughness: 0.58 });
    this.lipMat = new THREE.MeshStandardMaterial({ roughness: 0.45 });
    this.coatMat = new THREE.MeshStandardMaterial({ map: twill.map, normalMap: twill.normal, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.88 });
    this.pantsMat = new THREE.MeshStandardMaterial({ map: denim.map, normalMap: denim.normal, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.92 });
    this.hairMat = new THREE.MeshStandardMaterial({ map: hairT.map, normalMap: hairT.normal, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.55 });
    this.bootMat = new THREE.MeshStandardMaterial({ color: '#2a1d14', map: leather.map, normalMap: leather.normal, roughness: 0.45, metalness: 0.05 });

    this.buildBody();
    this.buildHead();
    this.root.add(this.body);
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    this.apply(appearance);
    if (name) this.setName(name, sub);
  }

  private mesh(geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, pos?: [number, number, number], rot?: [number, number, number], scale?: [number, number, number]) {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    if (scale) m.scale.set(...scale);
    parent.add(m);
    return m;
  }

  private buildBody() {
    // Pelvis
    this.pelvis.position.y = 0.94;
    this.body.add(this.pelvis);
    this.mesh(new THREE.SphereGeometry(0.165, 20, 14), this.pantsMat, this.pelvis, [0, 0.02, 0], undefined, [1, 0.72, 0.72]);
    // Belt
    this.mesh(new THREE.TorusGeometry(0.155, 0.018, 6, 28), this.bootMat, this.pelvis, [0, 0.085, 0], [Math.PI / 2, 0, 0], [1, 0.68, 1]);
    this.mesh(new THREE.BoxGeometry(0.05, 0.035, 0.012), new THREE.MeshStandardMaterial({ color: '#8c7a4a', metalness: 0.9, roughness: 0.3 }), this.pelvis, [0, 0.085, -0.107]);

    // Piernas
    for (const s of [0, 1] as const) {
      const side = s === 0 ? -1 : 1;
      const th = this.thigh[s];
      th.position.set(side * 0.092, -0.02, 0);
      this.pelvis.add(th);
      this.mesh(lathe([[-0.46, 0.05], [-0.42, 0.056], [-0.25, 0.068], [-0.1, 0.078], [-0.02, 0.082], [0.02, 0.07]]), this.pantsMat, th, undefined, undefined, [1, 1, 0.95]);
      const sh = this.shin[s];
      sh.position.y = -0.45;
      th.add(sh);
      this.mesh(new THREE.SphereGeometry(0.052, 12, 10), this.pantsMat, sh, [0, 0, -0.008]);
      this.mesh(lathe([[-0.42, 0.04], [-0.3, 0.044], [-0.15, 0.055], [-0.08, 0.057], [0, 0.052]]), this.pantsMat, sh, undefined, undefined, [1, 1, 1.05]);
      // Bota
      const ft = this.foot[s];
      ft.position.y = -0.42;
      sh.add(ft);
      this.mesh(lathe([[-0.06, 0.05], [0.1, 0.047], [0.14, 0.049]], 14, 0, Math.PI * 2, false), this.bootMat, ft);
      const shoe = new THREE.Group();
      ft.add(shoe);
      this.mesh(new THREE.BoxGeometry(0.1, 0.075, 0.2), this.bootMat, shoe, [0, -0.045, -0.04]);
      this.mesh(new THREE.SphereGeometry(0.052, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), this.bootMat, shoe, [0, -0.08, -0.14], undefined, [0.95, 1, 1.25]);
      this.mesh(new THREE.BoxGeometry(0.108, 0.022, 0.29), new THREE.MeshStandardMaterial({ color: '#141010', roughness: 0.7 }), shoe, [0, -0.083, -0.07]);
      this.mesh(new THREE.SphereGeometry(0.05, 10, 8), this.bootMat, shoe, [0, -0.045, 0.045], undefined, [1, 0.9, 0.9]);
      // Dobladillo del pantalón sobre la bota
      this.mesh(new THREE.CylinderGeometry(0.047, 0.05, 0.05, 14, 1, true), this.pantsMat, sh, [0, -0.3, 0]);
    }

    // Columna / torso
    this.spine.position.y = 1.0;
    this.body.add(this.spine);
    this.torso = this.mesh(
      lathe([[-0.05, 0.13], [0.0, 0.148], [0.08, 0.152], [0.16, 0.158], [0.26, 0.172], [0.34, 0.186], [0.4, 0.19], [0.45, 0.176], [0.5, 0.13], [0.53, 0.07]], 22),
      this.coatMat,
      this.spine,
      undefined,
      undefined,
      [1.12, 1, 0.64],
    );
    // Faldón del abrigo (abierto al frente)
    const gap = 0.55;
    this.skirt = this.mesh(
      lathe([[-0.55, 0.235], [-0.3, 0.2], [-0.1, 0.17], [0.03, 0.152]], 20, Math.PI + gap / 2, Math.PI * 2 - gap, false),
      this.coatMat,
      this.spine,
      undefined,
      undefined,
      [1.1, 1, 0.72],
    );
    (this.skirt.material as THREE.Material).side = THREE.DoubleSide;
    // Camisa en el escote, corbata, solapas, cuello y botones
    const v = new THREE.Shape();
    v.moveTo(-0.055, 0.5);
    v.lineTo(0.055, 0.5);
    v.lineTo(0, 0.33);
    v.closePath();
    this.mesh(new THREE.ShapeGeometry(v), this.shirtMat, this.spine, [0, 0, -0.115], [0.18, Math.PI, 0]);
    this.mesh(new THREE.BoxGeometry(0.022, 0.13, 0.006), new THREE.MeshStandardMaterial({ color: '#3a1f1f', roughness: 0.6 }), this.spine, [0, 0.415, -0.118], [0.18, 0, 0]);
    for (const side of [-1, 1]) {
      const lap = new THREE.Shape();
      lap.moveTo(0, 0.5);
      lap.lineTo(side * 0.075, 0.49);
      lap.lineTo(side * 0.085, 0.4);
      lap.lineTo(side * 0.012, 0.3);
      lap.closePath();
      const lg = new THREE.ShapeGeometry(lap);
      const m = this.mesh(lg, this.coatMat, this.spine, [0, 0, -0.121], [0.2, Math.PI, 0]);
      (m.material as THREE.Material).side = THREE.DoubleSide;
    }
    this.mesh(new THREE.CylinderGeometry(0.075, 0.095, 0.065, 18, 1, true, Math.PI * 0.25, Math.PI * 1.5), this.coatMat, this.spine, [0, 0.525, 0.01], [0.15, 0, 0]);
    const btn = new THREE.MeshStandardMaterial({ color: '#1c1712', roughness: 0.4 });
    for (let i = 0; i < 3; i++) this.mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.006, 10), btn, this.spine, [0.03, 0.26 - i * 0.09, -0.123 + i * 0.004], [Math.PI / 2, 0, 0]);
    this.chestSlot.position.set(0.09, 0.4, -0.125);
    this.spine.add(this.chestSlot);

    // Brazos
    for (const s of [0, 1] as const) {
      const side = s === 0 ? -1 : 1;
      const sh = new THREE.Group();
      sh.position.set(side * 0.205, 0.45, 0.005);
      this.spine.add(sh);
      this.mesh(new THREE.SphereGeometry(0.062, 14, 10), this.coatMat, sh, [side * -0.008, 0.005, 0], undefined, [1, 0.9, 0.95]);
      const ua = this.upperArm[s];
      sh.add(ua);
      this.mesh(lathe([[-0.3, 0.041], [-0.2, 0.045], [-0.08, 0.052], [0.0, 0.055]]), this.coatMat, ua);
      const fa = this.forearm[s];
      fa.position.y = -0.29;
      ua.add(fa);
      this.mesh(new THREE.SphereGeometry(0.043, 10, 8), this.coatMat, fa);
      this.mesh(lathe([[-0.25, 0.036], [-0.12, 0.04], [0, 0.043]]), this.coatMat, fa);
      this.mesh(new THREE.CylinderGeometry(0.038, 0.037, 0.02, 12), this.shirtMat, fa, [0, -0.255, 0]);
      // Mano: palma, dedos y pulgar
      const hand = s === 1 ? this.handR : new THREE.Group();
      hand.position.y = -0.265;
      fa.add(hand);
      this.mesh(new THREE.SphereGeometry(0.03, 12, 10), this.skinMat, hand, [0, -0.045, 0], undefined, [0.55, 1.2, 1.05]);
      for (let f = 0; f < 4; f++) {
        const fz = -0.022 + f * 0.0145;
        const len = f === 1 || f === 2 ? 0.05 : 0.042;
        this.mesh(new THREE.CapsuleGeometry(0.0075, len, 3, 6), this.skinMat, hand, [side * -0.004, -0.095 - len / 2 + 0.01, fz], [0.25, 0, side * 0.08]);
      }
      this.mesh(new THREE.CapsuleGeometry(0.009, 0.035, 3, 6), this.skinMat, hand, [side * -0.012, -0.055, -0.03], [0.6, 0, side * -0.4]);
    }
    this.handSlot.position.set(0, -0.1, -0.02);
    this.handR.add(this.handSlot);

    // Cuello
    this.neck.position.y = 0.53;
    this.spine.add(this.neck);
    this.mesh(lathe([[0, 0.052], [0.07, 0.046], [0.14, 0.047]]), this.skinMat, this.neck);
  }

  private buildHead() {
    this.head.position.y = 0.175;
    this.neck.add(this.head);
    const R = 0.1;
    this.mesh(sculptHead(new THREE.SphereGeometry(R, 72, 56), R, true), this.skinMat, this.head);
    // Orejas
    for (const side of [-1, 1]) {
      this.mesh(new THREE.SphereGeometry(0.026, 12, 10), this.skinMat, this.head, [side * 0.078, -0.012, 0.01], [0, side * 0.35, 0], [0.32, 1, 0.68]);
    }
    // Fosas nasales y labios (sutiles; el volumen de nariz y boca está esculpido en la malla)
    for (const side of [-1, 1]) this.mesh(new THREE.SphereGeometry(0.0035, 8, 6), new THREE.MeshBasicMaterial({ color: '#2b1a14' }), this.head, [side * 0.0065, -0.0405, -0.1055], undefined, [1.3, 0.7, 1]);
    this.mesh(new THREE.SphereGeometry(0.019, 16, 8), this.lipMat, this.head, [0, -0.0655, -0.0915], undefined, [1.05, 0.2, 0.32]);
    this.mesh(new THREE.SphereGeometry(0.018, 16, 8), this.lipMat, this.head, [0, -0.0715, -0.0905], undefined, [0.95, 0.24, 0.32]);
    this.mesh(new THREE.BoxGeometry(0.034, 0.0012, 0.002), new THREE.MeshBasicMaterial({ color: '#3a221c' }), this.head, [0, -0.0685, -0.0975]);
    // Ojos
    this.head.add(this.eyes);
    const white = new THREE.MeshStandardMaterial({ color: '#e9e4da', roughness: 0.15 });
    const iris = new THREE.MeshStandardMaterial({ color: '#4a3322', roughness: 0.2 });
    const pupil = new THREE.MeshBasicMaterial({ color: '#050505' });
    for (const side of [-1, 1]) {
      const e = new THREE.Group();
      e.position.set(side * 0.034, 0.012, -0.074);
      this.eyes.add(e);
      this.mesh(new THREE.SphereGeometry(0.0125, 14, 10), white, e);
      this.mesh(new THREE.CircleGeometry(0.0064, 16), iris, e, [0, 0, -0.0124], [0, Math.PI, 0]);
      this.mesh(new THREE.CircleGeometry(0.0029, 12), pupil, e, [0, 0, -0.0126], [0, Math.PI, 0]);
      // Párpado superior
      this.mesh(new THREE.SphereGeometry(0.0138, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.42), this.skinMat, e, [0, 0.001, 0], [-0.35, 0, 0]);
    }
    // Cejas
    this.head.add(this.hairGroup);
    this.head.add(this.hatSlot);
  }

  private buildHair(style: Appearance['hairStyle'], beard: boolean) {
    this.hairGroup.clear();
    const R = 0.1;
    for (const side of [-1, 1]) {
      this.mesh(new THREE.BoxGeometry(0.03, 0.006, 0.009), this.hairMat, this.hairGroup, [side * 0.036, 0.037, -0.087], [0.1, 0, side * -0.12]);
    }
    const shaped = (geo: THREE.SphereGeometry, r: number, hl = false) => sculptHead(geo, r, false, hl);
    if (style !== 'bald') {
      // Casquete superior + parte trasera hasta la nuca
      this.mesh(shaped(new THREE.SphereGeometry(R * 1.065, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.46), R * 1.065, true), this.hairMat, this.hairGroup, [0, 0.004, 0.004]);
      this.mesh(shaped(new THREE.SphereGeometry(R * 1.06, 24, 12, 0, Math.PI, Math.PI * 0.35, Math.PI * 0.35), R * 1.06), this.hairMat, this.hairGroup, [0, 0.004, 0.006]);
      // Patillas
    }
    if (style === 'long') {
      this.mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.22, 20, 1, true, -Math.PI / 2, Math.PI), this.hairMat, this.hairGroup, [0, -0.1, 0.02], undefined, [1, 1, 0.8]);
    }
    if (style === 'bun') {
      this.mesh(new THREE.SphereGeometry(0.038, 14, 12), this.hairMat, this.hairGroup, [0, 0.07, 0.1]);
    }
    if (beard) {
      this.mesh(shaped(new THREE.SphereGeometry(R * 1.03, 24, 10, Math.PI, Math.PI, Math.PI * 0.6, Math.PI * 0.3), R * 1.03), this.hairMat, this.hairGroup, [0, 0.002, -0.003]);
      this.mesh(new THREE.BoxGeometry(0.045, 0.01, 0.012), this.hairMat, this.hairGroup, [0, -0.052, -0.095]);
    }
    this.hairGroup.traverse((o) => (o.castShadow = true));
  }

  setName(name: string, sub?: string, color?: string) {
    if (this.tag) {
      this.root.remove(this.tag);
      (this.tag.material as THREE.SpriteMaterial).map?.dispose();
    }
    this.tag = label(name, color, sub);
    this.tag.position.y = 2.1;
    this.root.add(this.tag);
  }

  showTag(v: boolean) {
    if (this.tag) this.tag.visible = v;
  }

  apply(a: Appearance) {
    this.skinMat.color.set(a.skin);
    this.lipMat.color.set(a.skin).multiply(new THREE.Color('#d9a49b'));
    this.hairMat.color.set(a.hair);
    this.pantsMat.color.set(a.pants);
    const outfit = a.outfit ? OUTFITS[a.outfit] : undefined;
    this.coatMat.color.set(outfit?.color ?? a.coat);
    this.skirt.visible = true;
    this.skirt.scale.y = outfit?.long ? 1.35 : 0.55;
    this.buildHair(a.hairStyle ?? 'short', !!a.beard);
    this.hairGroup.visible = a.hat !== 'casco_minero';

    this.hatSlot.clear();
    this.chestSlot.clear();
    if (a.hat === 'sombrero_fedora') {
      const m = new THREE.MeshStandardMaterial({ color: '#4a4a4a', roughness: 0.85, map: CT.twill().map });
      this.mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.1, 20), m, this.hatSlot, [0, 0.135, 0.005], undefined, [1, 1, 1.1]);
      this.mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.012, 28), m, this.hatSlot, [0, 0.088, 0.005], [0.05, 0, 0], [0.9, 1, 1]);
      this.mesh(new THREE.CylinderGeometry(0.101, 0.101, 0.025, 20), new THREE.MeshStandardMaterial({ color: '#171717' }), this.hatSlot, [0, 0.1, 0.005]);
    } else if (a.hat === 'gorro_lana') {
      const m = new THREE.MeshStandardMaterial({ color: '#6b2f2a', roughness: 1, map: CT.denim().map });
      this.mesh(new THREE.SphereGeometry(0.1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), m, this.hatSlot, [0, 0.04, 0.004], undefined, [0.86, 1.15, 1.05]);
      this.mesh(new THREE.TorusGeometry(0.087, 0.018, 8, 22), m, this.hatSlot, [0, 0.045, 0.004], [Math.PI / 2, 0, 0], [1, 1.2, 1]);
    } else if (a.hat === 'casco_minero') {
      const m = new THREE.MeshStandardMaterial({ color: '#b08a2e', roughness: 0.45, metalness: 0.2 });
      this.mesh(new THREE.SphereGeometry(0.112, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), m, this.hatSlot, [0, 0.035, 0.004], undefined, [0.9, 1.1, 1.05]);
      this.mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 24), m, this.hatSlot, [0, 0.035, 0.004], [Math.PI / 2, 0, 0], [1, 1.2, 1]);
      this.mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.03, 12), new THREE.MeshStandardMaterial({ color: '#fff4d0', emissive: '#ffe2a0', emissiveIntensity: 1.5 }), this.hatSlot, [0, 0.09, -0.105], [Math.PI / 2, 0, 0]);
    } else if (a.hat === 'insignia_investigador') {
      this.mesh(new THREE.OctahedronGeometry(0.022), new THREE.MeshStandardMaterial({ color: '#e0a33a', emissive: '#6b4a10', metalness: 0.9, roughness: 0.3 }), this.chestSlot);
    }

    this.handSlot.clear();
    this.lanternId = a.lantern ?? null;
    if (a.lantern === 'farol_antiguo') {
      this.mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.14, 6), new THREE.MeshStandardMaterial({ color: '#2a2218', metalness: 0.6, roughness: 0.5 }), this.handSlot, [0, -0.08, 0]);
      this.mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshStandardMaterial({ color: '#ffcc80', emissive: '#ffae45', emissiveIntensity: 2.2 }), this.handSlot, [0, -0.08, 0]);
    } else if (a.lantern) {
      const body = new THREE.MeshStandardMaterial({ color: a.lantern === 'linterna_potente' ? '#1e272d' : '#3a3a3a', metalness: 0.75, roughness: 0.35 });
      this.mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.16, 12), body, this.handSlot, [0, 0, -0.03], [Math.PI / 2, 0, 0]);
      this.mesh(new THREE.CylinderGeometry(0.027, 0.02, 0.04, 12), body, this.handSlot, [0, 0, -0.12], [Math.PI / 2, 0, 0]);
      this.mesh(new THREE.CircleGeometry(0.024, 14), new THREE.MeshStandardMaterial({ color: '#fff7e0', emissive: '#fff1c8', emissiveIntensity: 1.2 }), this.handSlot, [0, 0, -0.141], [0, Math.PI, 0]);
    }
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
  }

  update(dt: number, speed: number) {
    this.t += dt;
    const moving = this.anim !== 'idle' && speed > 0.1;
    this.walkW += ((moving ? 1 : 0) - this.walkW) * Math.min(1, dt * 8);
    const runTarget = moving && this.anim === 'run' ? THREE.MathUtils.clamp((speed - 3.2) / 2.5, 0, 1) : 0;
    this.runW += (runTarget - this.runW) * Math.min(1, dt * 6);
    const w = this.walkW;
    const r = this.runW;
    this.phase += dt * (moving ? 2.3 + speed * 1.0 : 0);
    const p = this.phase;

    // Parámetros mezclados caminar/correr
    const thighA = 0.42 + r * 0.45;
    const kneeA = 0.95 + r * 0.6;
    const armA = 0.35 + r * 0.45;
    const elbowBase = 0.18 + r * 1.05;
    const lean = r * 0.2;

    for (const s of [0, 1] as const) {
      const lp = p + (s === 0 ? 0 : Math.PI);
      const th = Math.sin(lp) * thighA * w;
      const kn = -(Math.pow(Math.max(0, Math.cos(lp - 0.35)), 1.4) * kneeA + 0.05) * w;
      this.thigh[s].rotation.x = th + lean * 0.4 * w;
      this.shin[s].rotation.x = kn;
      this.foot[s].rotation.x = -(th + kn) * 0.55 * w;
      // Brazos opuestos a las piernas
      const ap = p + (s === 0 ? Math.PI : 0);
      const side = s === 0 ? -1 : 1;
      let ua = Math.sin(ap) * armA * w;
      let fa = elbowBase * w + Math.max(0, Math.sin(ap)) * 0.35 * w + 0.12;
      let uz = side * (0.09 + (1 - w) * 0.02 + Math.sin(this.t * 1.7) * 0.01 * (1 - w));
      if (s === 1 && this.holding && this.lanternId) {
        ua = 0.85 + Math.sin(ap) * 0.08 * w;
        fa = 0.45;
        uz = 0.12;
      }
      this.upperArm[s].rotation.set(ua, 0, uz);
      this.forearm[s].rotation.x = fa;
    }

    // Cadera, columna y respiración
    const breathe = Math.sin(this.t * 1.7);
    this.body.position.y = w * ((0.028 + r * 0.03) * Math.cos(2 * p) - 0.02 - r * 0.03);
    this.body.position.x = (1 - w) * Math.sin(this.t * 0.45) * 0.012;
    this.pelvis.rotation.y = Math.sin(p) * 0.1 * w;
    this.pelvis.rotation.z = Math.cos(p) * 0.04 * w;
    this.spine.rotation.y = -Math.sin(p) * 0.14 * w;
    this.spine.rotation.x = -lean * w - 0.02;
    this.torso.scale.set(1.12 + breathe * 0.006 * (1 - w), 1, 0.64 + breathe * 0.01 * (1 - w));
    this.skirt.rotation.x = -Math.min(0.35, speed * 0.05);
    // Cabeza: estabilizada al andar, mira alrededor en reposo
    this.neck.rotation.x = lean * 0.7 * w;
    this.head.rotation.y = (1 - w) * (Math.sin(this.t * 0.23) * 0.35 + Math.sin(this.t * 0.61) * 0.08);
    this.head.rotation.x = (1 - w) * Math.sin(this.t * 0.17) * 0.06;
    // Parpadeo
    this.blinkT -= dt;
    if (this.blinkT <= 0) {
      this.blink = 0.14;
      this.blinkT = 2.5 + Math.random() * 3.5;
    }
    this.blink = Math.max(0, this.blink - dt);
    this.eyes.scale.y = this.blink > 0 ? 0.12 : 1;
  }

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
