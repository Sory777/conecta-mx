import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  ANGEL,
  BELL_TOWER,
  BILLBOARDS,
  BOUNDS,
  type Building,
  CASA_MORALES,
  CAVE,
  CAVE_MOUTH,
  MINE_INT,
  CHAPEL,
  type Collider,
  casaMoralesWalls,
  distToPaths,
  FOUNTAIN,
  generateTrees,
  HILL,
  heightAt,
  LAMPS,
  MINE,
  PLAZA,
  smoothstep,
  staticColliders,
  TOWN_BUILDINGS,
  WELL,
} from '../../../../shared/world';
import * as T from './textures';

export type Quality = 'low' | 'medium' | 'high';

export interface SponsorCampaign {
  id: string;
  slot: string;
  sponsor: string;
  headline: string;
  subline: string;
  bg: string;
  fg: string;
}

export interface WorldBuild {
  group: THREE.Group;
  colliders: Collider[];
  lamps: { pos: THREE.Vector3; broken: boolean; glass: THREE.Mesh }[];
  windowMat: THREE.MeshStandardMaterial;
  lampGlassMat: THREE.MeshStandardMaterial;
  chapelGlassMat: THREE.MeshStandardMaterial;
  caveGlowMat: THREE.MeshStandardMaterial;
  bell: THREE.Object3D;
  water: THREE.Mesh[];
  setSponsor(slot: string, c: SponsorCampaign | null): void;
  sponsorMeshes: Map<string, THREE.Mesh>;
  dust: THREE.Points;
}

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o });

/** Reescala las UV de una BoxGeometry para que la textura se repita por metro (sin estirarse). */
function boxUV(g: THREE.BoxGeometry, w: number, h: number, d: number, scale = 2.5) {
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const dims = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const idx = f * 4 + i;
      uv.setXY(idx, (uv.getX(idx) * dims[f][0]) / scale, (uv.getY(idx) * dims[f][1]) / scale);
    }
  }
  uv.needsUpdate = true;
  return g;
}

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, uvScale = 2.5) {
  const m = new THREE.Mesh(boxUV(new THREE.BoxGeometry(w, h, d), w, h, d, uvScale), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * Tejado a dos aguas. `alongX` = cumbrera paralela al eje X.
 * `skip` elimina segmentos (10+índice en un faldón, 20+índice en el otro) para simular un tejado derrumbado.
 */
function gableRoof(w: number, d: number, rise: number, mat: THREE.Material, gableMat: THREE.Material, alongX: boolean, skip: number[] = []) {
  const outer = new THREE.Group();
  const g = new THREE.Group();
  outer.add(g);
  // Se construye siempre con la cumbrera en X y, si hace falta, se gira 90°.
  const length = alongX ? w : d;
  const width = alongX ? d : w;
  const over = 0.45;
  const span = width / 2 + over;
  const len = length + over * 2;
  const slope = Math.hypot(span, rise);
  const ang = Math.atan2(rise, span);
  const segs = 4;
  const segLen = len / segs;
  (mat as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  for (const side of [-1, 1]) {
    for (let s = 0; s < segs; s++) {
      if (skip.includes((side > 0 ? 10 : 20) + s)) continue;
      const geo = new THREE.PlaneGeometry(segLen, slope);
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * segLen) / 2, (uv.getY(i) * slope) / 2);
      const panel = new THREE.Mesh(geo, mat);
      panel.rotation.x = side > 0 ? -(Math.PI / 2 - ang) : Math.PI / 2 - ang;
      panel.position.set(-len / 2 + segLen * (s + 0.5), rise / 2, (side * span) / 2);
      panel.castShadow = true;
      panel.receiveShadow = true;
      g.add(panel);
    }
  }
  const tri = new THREE.Shape();
  tri.moveTo(-width / 2, 0);
  tri.lineTo(width / 2, 0);
  tri.lineTo(0, rise);
  tri.closePath();
  const tg = new THREE.ShapeGeometry(tri);
  for (const side of [-1, 1]) {
    const m = new THREE.Mesh(tg, gableMat);
    m.position.set(side * (length / 2 - 0.01), 0, 0);
    m.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    m.castShadow = true;
    g.add(m);
  }
  if (!alongX) g.rotation.y = Math.PI / 2;
  return outer;
}

export function buildWorld(quality: Quality): WorldBuild {
  const group = new THREE.Group();
  const colliders = staticColliders();
  const lamps: WorldBuild['lamps'] = [];
  const water: THREE.Mesh[] = [];
  const sponsorMeshes = new Map<string, THREE.Mesh>();

  const windowMat = std({ color: '#1a1611', emissive: new THREE.Color('#ffae55'), emissiveIntensity: 0, roughness: 0.3 });
  const darkGlass = std({ color: '#0d1114', roughness: 0.2, metalness: 0.4 });
  const lampGlassMat = std({ color: '#2a2418', emissive: new THREE.Color('#ffc978'), emissiveIntensity: 0, roughness: 0.3 });
  const chapelGlassMat = std({ color: '#241525', emissive: new THREE.Color('#b0406a'), emissiveIntensity: 0, roughness: 0.3 });
  const caveGlowMat = std({ color: '#0c2a2a', emissive: new THREE.Color('#3fd6c6'), emissiveIntensity: 1.4, roughness: 0.4 });
  const woodDark = std({ map: T.wood('#3b2a1d', 7) });
  const woodMid = std({ map: T.wood('#5b4330', 8) });
  const iron = std({ color: '#1c1c1c', roughness: 0.6, metalness: 0.7 });
  const stoneMat = std({ map: T.stoneBlocks('#7a766c', 13) });
  const rockMat = std({ map: T.rock(), color: '#8a857c' });
  const statueMat = std({ map: T.rock(), color: '#a7a397', roughness: 1 });

  // ------------------------------------------------------------------ terreno
  const sizeX = 300;
  const sizeZ = 300;
  const cx = 0;
  const cz = -15;
  const seg = quality === 'low' ? 150 : 200;
  const tg = new THREE.PlaneGeometry(sizeX, sizeZ, seg, seg);
  tg.rotateX(-Math.PI / 2);
  const pos = tg.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const grassA = new THREE.Color('#34402a');
  const grassB = new THREE.Color('#4a4d31');
  const forest = new THREE.Color('#252d1f');
  const dirt = new THREE.Color('#5a4936');
  const dry = new THREE.Color('#5d5638');
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + cx;
    const z = pos.getZ(i) + cz;
    pos.setX(i, x);
    pos.setZ(i, z);
    pos.setY(i, heightAt(x, z));
    const n = Math.sin(x * 0.31) * Math.cos(z * 0.27) * 0.5 + Math.sin((x + z) * 0.13) * 0.5;
    tmp.copy(grassA).lerp(grassB, 0.5 + n * 0.5);
    if (z < -20) tmp.lerp(forest, smoothstep(-20, -45, z) * 0.7);
    const dh = Math.hypot(x - HILL.x, z - HILL.z);
    tmp.lerp(dry, (1 - smoothstep(12, 26, dh)) * 0.8);
    const dp = distToPaths(x, z);
    tmp.lerp(dirt, 1 - smoothstep(-0.8, 1.4, dp));
    if (Math.hypot(x, z) < PLAZA.r + 3) tmp.lerp(dirt, 0.6);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  tg.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  tg.computeVertexNormals();
  const detail = T.groundDetail().clone();
  detail.repeat.set(sizeX / 4, sizeZ / 4);
  detail.needsUpdate = true;
  const terrain = new THREE.Mesh(tg, std({ vertexColors: true, map: detail, roughness: 0.97 }));
  terrain.receiveShadow = true;
  group.add(terrain);

  // Plaza empedrada
  const plazaGeo = new THREE.CircleGeometry(PLAZA.r + 0.5, 64);
  plazaGeo.rotateX(-Math.PI / 2);
  const cob = T.cobble().clone();
  cob.repeat.set(7, 7);
  cob.needsUpdate = true;
  const plaza = new THREE.Mesh(plazaGeo, std({ map: cob, roughness: 0.85 }));
  plaza.position.y = 0.03;
  plaza.receiveShadow = true;
  group.add(plaza);

  // ------------------------------------------------------------------ fuente
  const fountain = new THREE.Group();
  const basinPts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(FOUNTAIN.r, 0),
    new THREE.Vector2(FOUNTAIN.r, 0.7),
    new THREE.Vector2(FOUNTAIN.r - 0.3, 0.7),
    new THREE.Vector2(FOUNTAIN.r - 0.3, 0.2),
    new THREE.Vector2(0, 0.2),
  ];
  const basin = new THREE.Mesh(new THREE.LatheGeometry(basinPts, 40), stoneMat);
  basin.castShadow = basin.receiveShadow = true;
  fountain.add(basin);
  const waterMat = std({ color: '#0b171d', roughness: 0.08, metalness: 0.5 });
  const w1 = new THREE.Mesh(new THREE.CircleGeometry(FOUNTAIN.r - 0.3, 40), waterMat);
  w1.rotation.x = -Math.PI / 2;
  w1.position.y = 0.55;
  fountain.add(w1);
  water.push(w1);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.8, 12), stoneMat);
  pillar.position.y = 0.9;
  pillar.castShadow = true;
  fountain.add(pillar);
  const bowl = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.9, 0.25), new THREE.Vector2(0.95, 0.4), new THREE.Vector2(0.8, 0.35), new THREE.Vector2(0, 0.2)], 24), stoneMat);
  bowl.position.y = 1.7;
  bowl.castShadow = true;
  fountain.add(bowl);
  fountain.position.set(FOUNTAIN.x, 0, FOUNTAIN.z);
  group.add(fountain);

  // Bancos de la plaza
  for (const a of [2.0, 3.6, 5.2]) {
    const bx = Math.cos(a) * 7.5;
    const bz = Math.sin(a) * 7.5;
    const bench = new THREE.Group();
    bench.add(box(1.8, 0.08, 0.5, woodMid, 0, 0.45, 0, 1));
    bench.add(box(1.8, 0.5, 0.08, woodMid, 0, 0.75, -0.22, 1));
    bench.add(box(0.08, 0.45, 0.45, iron, -0.8, 0.22, 0, 1));
    bench.add(box(0.08, 0.45, 0.45, iron, 0.8, 0.22, 0, 1));
    bench.position.set(bx, 0, bz);
    bench.rotation.y = Math.atan2(-bx, -bz) + Math.PI;
    group.add(bench);
    colliders.push({ type: 'circle', x: bx, z: bz, r: 0.8 });
  }

  // ------------------------------------------------------------------ casas del pueblo
  for (const b of TOWN_BUILDINGS) group.add(makeBuilding(b, windowMat, darkGlass, woodDark, sponsorMeshes));

  // ------------------------------------------------------------------ farolas
  for (const l of LAMPS) {
    const y0 = heightAt(l.x, l.z);
    const lg = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 3.4, 8), iron);
    pole.position.y = 1.7;
    pole.castShadow = true;
    lg.add(pole);
    const arm = box(0.7, 0.05, 0.05, iron, 0.3, 3.35, 0, 1);
    lg.add(arm);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.35, 6), lampGlassMat);
    glass.position.set(0.62, 3.1, 0);
    lg.add(glass);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.18, 6), iron);
    cap.position.set(0.62, 3.35, 0);
    lg.add(cap);
    lg.position.set(l.x, y0, l.z);
    lg.rotation.y = Math.atan2(l.x, l.z) + Math.PI / 2;
    group.add(lg);
    lg.updateMatrixWorld(true);
    lamps.push({ pos: glass.getWorldPosition(new THREE.Vector3()), broken: !!l.broken, glass });
  }

  // ------------------------------------------------------------------ cartel publicitario (patrocinios)
  for (const bb of BILLBOARDS) {
    const g = new THREE.Group();
    g.add(box(0.15, 3.4, 0.15, woodDark, -1.9, 1.7, 0, 1));
    g.add(box(0.15, 3.4, 0.15, woodDark, 1.9, 1.7, 0, 1));
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.1), std({ roughness: 0.8 }));
    board.position.set(0, 2.55, 0.09);
    g.add(board);
    const back = box(4.4, 2.3, 0.12, woodDark, 0, 2.55, 0, 1);
    g.add(back);
    g.position.set(bb.x, heightAt(bb.x, bb.z), bb.z);
    g.rotation.y = bb.rotY + Math.PI;
    group.add(g);
    sponsorMeshes.set(bb.slot, board);
  }

  // ------------------------------------------------------------------ capilla y campanario
  const bell = buildChapel(group, woodDark, iron, stoneMat, chapelGlassMat);

  // ------------------------------------------------------------------ pozo viejo
  {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(WELL.r, WELL.r + 0.1, 0.9, 20, 1, true), stoneMat);
    ring.position.y = 0.45;
    ring.castShadow = true;
    (ring.material as THREE.Material).side = THREE.DoubleSide;
    g.add(ring);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(WELL.r, 0.12, 6, 24), stoneMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.9;
    g.add(rim);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(WELL.r - 0.05, 20), std({ color: '#020304', roughness: 0.1, metalness: 0.6 }));
    hole.rotation.x = -Math.PI / 2;
    hole.position.y = 0.35;
    g.add(hole);
    g.add(box(0.12, 2.3, 0.12, woodDark, -WELL.r, 1.15, 0, 1));
    g.add(box(0.12, 2.3, 0.12, woodDark, WELL.r, 1.15, 0, 1));
    const roof = gableRoof(WELL.r * 2 + 0.2, 1.4, 0.6, std({ map: T.roofTiles('#3a2a22', 4) }), woodDark, true);
    roof.position.y = 2.3;
    g.add(roof);
    const crank = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, WELL.r * 2, 8), woodMid);
    crank.rotation.z = Math.PI / 2;
    crank.position.y = 1.7;
    g.add(crank);
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.3, 10), iron);
    bucket.position.set(0.3, 1.0, 0);
    g.add(bucket);
    g.position.set(WELL.x, heightAt(WELL.x, WELL.z), WELL.z);
    group.add(g);
  }

  // ------------------------------------------------------------------ Casa Morales
  const dust = buildCasaMorales(group, woodDark, woodMid, iron, darkGlass, statueMat, quality);

  // ------------------------------------------------------------------ boca del túnel y mina
  {
    const y = heightAt(CAVE_MOUTH.x, CAVE_MOUTH.z);
    const g = new THREE.Group();
    const r1 = new THREE.Mesh(new THREE.DodecahedronGeometry(2.4, 1), rockMat);
    r1.scale.set(1.6, 1, 1.2);
    r1.position.set(0, 0.6, -1.8);
    g.add(r1);
    const r2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 0), rockMat);
    r2.position.set(-1.9, 0.5, -0.4);
    g.add(r2);
    const r3 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 0), rockMat);
    r3.position.set(1.9, 0.4, -0.5);
    g.add(r3);
    const holeM = new THREE.Mesh(new THREE.CircleGeometry(1.0, 16), std({ color: '#000000' }));
    holeM.position.set(0, 0.8, -0.35);
    g.add(holeM);
    for (let i = 0; i < 3; i++) g.add(box(2.2, 0.18, 0.06, woodDark, 0, 0.4 + i * 0.45, -0.3, 1));
    for (const m of g.children) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
    g.position.set(CAVE_MOUTH.x, y, CAVE_MOUTH.z);
    group.add(g);
  }
  {
    const y = heightAt(MINE.x, MINE.z);
    const g = new THREE.Group();
    const mound = new THREE.Mesh(new THREE.DodecahedronGeometry(6, 1), rockMat);
    mound.scale.set(1.2, 0.8, 0.9);
    mound.position.set(0, 1.2, -5.5);
    g.add(mound);
    g.add(box(0.35, 3.2, 0.35, woodDark, -1.6, 1.6, -1.8, 1));
    g.add(box(0.35, 3.2, 0.35, woodDark, 1.6, 1.6, -1.8, 1));
    g.add(box(3.8, 0.4, 0.4, woodDark, 0, 3.2, -1.8, 1));
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), std({ color: '#000' }));
    hole.position.set(0, 1.5, -1.95);
    g.add(hole);
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 0.9),
      std({ map: T.signTexture([{ text: 'PELIGRO', size: 70, color: '#c9412f' }, { text: 'NO PASAR', size: 46, color: '#e8dcc0' }, { text: 'Derrumbe · 14 marzo 1994', size: 26, color: '#9fb3c0', font: 'italic 400' }], '#2a2118') }),
    );
    sign.position.set(0, 1.6, -1.52);
    g.add(sign);
    for (const m of g.children) m.castShadow = true;
    g.position.set(MINE.x, y, MINE.z);
    group.add(g);
    // Rieles oxidados saliendo de la mina
    for (const s of [-0.5, 0.5]) {
      const rail = box(0.08, 0.08, 7, iron, MINE.x + s, y + 0.05, MINE.z + 1.5, 1);
      group.add(rail);
    }
  }

  // ------------------------------------------------------------------ cementerio junto a la capilla
  {
    const tombMat = std({ map: T.rock(), color: '#8b887f' });
    for (let i = 0; i < 10; i++) {
      const x = CHAPEL.x - 9 - (i % 2) * 2.4;
      const z = CHAPEL.z - 6 + Math.floor(i / 2) * 2.6;
      const t = new THREE.Group();
      if (i % 3 === 0) {
        t.add(box(0.12, 1.1, 0.12, tombMat, 0, 0.55, 0, 1));
        t.add(box(0.6, 0.12, 0.12, tombMat, 0, 0.8, 0, 1));
      } else {
        const stone = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.5, 2, 8), tombMat);
        stone.scale.set(1, 1, 0.3);
        stone.position.y = 0.4;
        stone.castShadow = true;
        t.add(stone);
      }
      t.position.set(x, heightAt(x, z), z);
      t.rotation.set((Math.sin(i * 7) * 0.1), Math.PI / 2, Math.cos(i * 3) * 0.12);
      group.add(t);
      colliders.push({ type: 'circle', x, z, r: 0.35 });
    }
  }

  // ------------------------------------------------------------------ bosque (instanciado)
  const trees = generateTrees();
  const maxTrees = quality === 'low' ? 350 : quality === 'medium' ? 700 : 1100;
  const step = Math.max(1, Math.ceil(trees.length / maxTrees));
  const shown = trees.filter((_, i) => i % step === 0);
  for (const t of trees) colliders.push({ type: 'circle', x: t.x, z: t.z, r: 0.3 * t.s });
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.28, 4, 6);
  trunkGeo.translate(0, 2, 0);
  const pineGeo = mergeGeometries([
    new THREE.ConeGeometry(1.9, 3.4, 7).translate(0, 3.2, 0),
    new THREE.ConeGeometry(1.5, 2.8, 7).translate(0, 4.6, 0),
    new THREE.ConeGeometry(1.0, 2.2, 7).translate(0, 5.9, 0),
  ])!;
  const deadGeo = mergeGeometries([
    new THREE.CylinderGeometry(0.03, 0.06, 1.8, 4).rotateZ(1.1).translate(0.7, 3.2, 0),
    new THREE.CylinderGeometry(0.03, 0.06, 1.5, 4).rotateZ(-1.2).translate(-0.6, 3.8, 0.1),
    new THREE.CylinderGeometry(0.03, 0.05, 1.3, 4).rotateX(1.2).translate(0, 4.4, 0.5),
  ])!;
  const blobGeo = new THREE.IcosahedronGeometry(2.1, 1).translate(0, 4.3, 0);
  const barkMat = std({ map: T.bark(), color: '#8a7a6a' });
  const leafMat = std({ map: T.foliage(), color: '#ffffff', roughness: 1, flatShading: true });
  const trunkIM = new THREE.InstancedMesh(trunkGeo, barkMat, shown.length);
  const pines = shown.filter((t) => t.kind === 0);
  const deads = shown.filter((t) => t.kind === 1);
  const blobs = shown.filter((t) => t.kind === 2);
  const pineIM = new THREE.InstancedMesh(pineGeo, leafMat, pines.length);
  const deadIM = new THREE.InstancedMesh(deadGeo, barkMat, deads.length);
  const blobIM = new THREE.InstancedMesh(blobGeo, leafMat, blobs.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const p3 = new THREE.Vector3();
  const col = new THREE.Color();
  const placeAll = (arr: typeof shown, im: THREE.InstancedMesh, tint: (i: number) => THREE.Color | null) => {
    arr.forEach((t, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (t.x * 13.1 + t.z * 7.7) % (Math.PI * 2));
      sc.set(t.s, t.s * (0.9 + ((t.x * 3.3) % 0.3)), t.s);
      p3.set(t.x, heightAt(t.x, t.z) - 0.1, t.z);
      m4.compose(p3, q, sc);
      im.setMatrixAt(i, m4);
      const c = tint(i);
      if (c) im.setColorAt(i, c);
    });
    im.castShadow = quality !== 'low';
    im.receiveShadow = true;
    im.instanceMatrix.needsUpdate = true;
    group.add(im);
  };
  placeAll(shown, trunkIM, () => null);
  placeAll(pines, pineIM, (i) => col.setHSL(0.27 + (i % 7) * 0.006, 0.28, 0.14 + (i % 5) * 0.012));
  placeAll(deads, deadIM, () => null);
  placeAll(blobs, blobIM, (i) => col.setHSL(0.18 + (i % 5) * 0.015, 0.3, 0.16 + (i % 3) * 0.02));

  // Rocas dispersas
  {
    const n = quality === 'low' ? 60 : 160;
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.6, 0), rockMat, n);
    let k = 0;
    for (let i = 0; k < n && i < n * 6; i++) {
      const x = BOUNDS.minX + ((i * 97.13) % 1) * 0 + ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * (BOUNDS.maxX - BOUNDS.minX);
      const z = BOUNDS.minZ + ((Math.sin(i * 78.233) * 12345.678) % 1 + 1) % 1 * (BOUNDS.maxZ - BOUNDS.minZ);
      if (Math.hypot(x, z) < 20 || distToPaths(x, z) < 1.5) continue;
      const s = 0.4 + (((Math.sin(i * 3.1) * 999) % 1) + 1) % 1 * 1.2;
      m4.compose(new THREE.Vector3(x, heightAt(x, z) - 0.15 * s, z), q.setFromEuler(new THREE.Euler(i, i * 2, i * 3)), sc.set(s, s * 0.6, s));
      rocks.setMatrixAt(k++, m4);
    }
    rocks.count = k;
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    group.add(rocks);
  }

  // Hierba alta (planos cruzados instanciados)
  if (quality !== 'low') {
    const gc = document.createElement('canvas');
    gc.width = 64;
    gc.height = 64;
    const gctx = gc.getContext('2d')!;
    for (let i = 0; i < 26; i++) {
      gctx.strokeStyle = `rgba(${150 + i * 3},${160 + i * 2},${110},1)`;
      gctx.lineWidth = 2;
      gctx.beginPath();
      const x = 4 + Math.random() * 56;
      gctx.moveTo(x, 64);
      gctx.quadraticCurveTo(x + (Math.random() - 0.5) * 10, 30, x + (Math.random() - 0.5) * 18, 6 + Math.random() * 20);
      gctx.stroke();
    }
    const gtex = new THREE.CanvasTexture(gc);
    gtex.colorSpace = THREE.SRGBColorSpace;
    const tuftGeo = mergeGeometries([new THREE.PlaneGeometry(1, 0.7).translate(0, 0.35, 0), new THREE.PlaneGeometry(1, 0.7).translate(0, 0.35, 0).rotateY(Math.PI / 2)])!;
    const tuftMat = new THREE.MeshStandardMaterial({ map: gtex, alphaTest: 0.5, side: THREE.DoubleSide, color: '#6f7a4a', roughness: 1 });
    const n = quality === 'high' ? 3500 : 1800;
    const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, n);
    let k = 0;
    for (let i = 0; k < n && i < n * 4; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 14 + Math.random() * 90;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r - 20;
      if (distToPaths(x, z) < 0.8 || Math.hypot(x, z) < PLAZA.r + 2) continue;
      if (x > CASA_MORALES.minX - 1 && x < CASA_MORALES.maxX + 1 && z > CASA_MORALES.minZ - 1 && z < CASA_MORALES.maxZ + 1) continue;
      const s = 0.6 + Math.random() * 0.9;
      m4.compose(new THREE.Vector3(x, heightAt(x, z), z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 3), sc.set(s, s, s));
      tufts.setMatrixAt(k++, m4);
    }
    tufts.count = k;
    tufts.receiveShadow = true;
    group.add(tufts);
  }

  // ------------------------------------------------------------------ túnel subterráneo
  buildCave(group, rockMat, woodMid, caveGlowMat);
  buildMine(group, rockMat, woodMid, woodDark, iron, lampGlassMat);

  const setSponsor = (slot: string, c: SponsorCampaign | null) => {
    const mesh = sponsorMeshes.get(slot);
    if (!mesh) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    const w = slot === 'shop_sign' ? 512 : 512;
    const hgt = slot === 'shop_sign' ? 128 : 256;
    mat.map?.dispose();
    mat.map = c
      ? T.signTexture(
          [
            { text: c.headline, size: slot === 'shop_sign' ? 54 : 64, color: c.fg },
            ...(c.subline && slot !== 'shop_sign' ? [{ text: c.subline, size: 30, color: c.fg, font: 'italic 400' }] : []),
          ],
          c.bg,
          w,
          hgt,
          'Patrocinado',
        )
      : slot === 'shop_sign'
        ? T.signTexture([{ text: 'Tienda del Pueblo', size: 56, color: '#e8d9b0' }], '#2a3a3f', w, hgt)
        : T.signTexture(
            [
              { text: 'Feria de San Bartolo', size: 56, color: '#e8d9b0' },
              { text: 'SUSPENDIDA hasta nuevo aviso', size: 30, color: '#d17a5a', font: 'italic 700' },
            ],
            '#2b2620',
            w,
            hgt,
          );
    mat.needsUpdate = true;
  };
  for (const slot of sponsorMeshes.keys()) setSponsor(slot, null);

  return { group, colliders, lamps, windowMat, lampGlassMat, chapelGlassMat, caveGlowMat, bell, water, setSponsor, sponsorMeshes, dust };
}

// ====================================================================== edificios

function makeBuilding(b: Building, windowMat: THREE.Material, darkGlass: THREE.Material, woodDark: THREE.Material, sponsorMeshes: Map<string, THREE.Mesh>) {
  const g = new THREE.Group();
  const y0 = heightAt(b.x, b.z) - 0.3;
  const wallMat = new THREE.MeshStandardMaterial({ map: T.plaster(b.wall, b.x * 7 + b.z), roughness: 0.95 });
  const ruin = b.kind === 'ruin';
  // Hacia dónde mira la fachada: hacia la plaza
  const toPlaza = Math.atan2(-b.x, -b.z);
  const faceX = Math.abs(Math.sin(toPlaza)) > Math.abs(Math.cos(toPlaza));
  const frontSign = faceX ? Math.sign(-b.x) : Math.sign(-b.z);

  if (ruin) {
    const hs = [b.h, b.h * 0.6, b.h * 0.85, b.h * 0.4];
    g.add(box(b.w, hs[0], 0.35, wallMat, 0, hs[0] / 2, -b.d / 2));
    g.add(box(b.w * 0.6, hs[1], 0.35, wallMat, -b.w * 0.2, hs[1] / 2, b.d / 2));
    g.add(box(0.35, hs[2], b.d, wallMat, -b.w / 2, hs[2] / 2, 0));
    g.add(box(0.35, hs[3], b.d * 0.5, wallMat, b.w / 2, hs[3] / 2, -b.d * 0.25));
    const beam = box(b.w * 0.9, 0.2, 0.2, woodDark, 0, b.h * 0.55, 0, 1);
    beam.rotation.z = 0.35;
    g.add(beam);
  } else {
    g.add(box(b.w, b.h + 0.3, b.d, wallMat, 0, (b.h + 0.3) / 2, 0));
    const roofMat = new THREE.MeshStandardMaterial({ map: T.roofTiles(b.roof, Math.floor(b.x + b.z)), roughness: 0.85 });
    const alongX = b.w >= b.d;
    const roof = gableRoof(b.w, b.d, Math.min(b.w, b.d) * 0.42, roofMat, wallMat, alongX);
    roof.position.y = b.h + 0.3;
    g.add(roof);
    // Chimenea
    g.add(box(0.6, 1.6, 0.6, new THREE.MeshStandardMaterial({ map: T.stoneBlocks('#5d5147', 17) }), b.w * 0.25, b.h + 1.3, b.d * 0.15, 1));
    // Puerta hacia la plaza
    const doorW = 1.1;
    const door = box(faceX ? 0.12 : doorW, 2.1, faceX ? doorW : 0.12, woodDark, faceX ? frontSign * (b.w / 2 + 0.03) : 0, 1.35, faceX ? 0 : frontSign * (b.d / 2 + 0.03), 1);
    g.add(door);
    // Ventanas
    const winPerSide = Math.max(1, Math.floor((faceX ? b.d : b.w) / 3));
    for (const side of [1, -1]) {
      for (let i = 0; i < winPerSide; i++) {
        const t = (i + 0.5) / winPerSide - 0.5;
        const off = t * (faceX ? b.d : b.w) * 0.8;
        if (Math.abs(off) < 1.0 && side === 1) continue; // deja sitio a la puerta
        const mat = b.lit && (i + (side > 0 ? 0 : 1)) % 2 === 0 ? windowMat : darkGlass;
        const w = box(faceX ? 0.1 : 0.9, 1.0, faceX ? 0.9 : 0.1, mat, faceX ? side * frontSign * (b.w / 2 + 0.02) : off, 2.0, faceX ? off : side * frontSign * (b.d / 2 + 0.02), 1);
        w.castShadow = false;
        g.add(w);
        const frame = box(faceX ? 0.14 : 1.1, 0.1, faceX ? 1.1 : 0.14, woodDark, w.position.x, 1.45, w.position.z, 1);
        g.add(frame);
      }
    }
    if (b.sponsorSlot) {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshStandardMaterial({ roughness: 0.7 }));
      sign.position.set(faceX ? frontSign * (b.w / 2 + 0.08) : 0, 3.0, faceX ? 0 : frontSign * (b.d / 2 + 0.08));
      sign.rotation.y = faceX ? (frontSign > 0 ? Math.PI / 2 : -Math.PI / 2) : frontSign > 0 ? 0 : Math.PI;
      g.add(sign);
      sponsorMeshes.set(b.sponsorSlot, sign);
    }
  }
  g.position.set(b.x, y0, b.z);
  return g;
}

function buildChapel(group: THREE.Group, woodDark: THREE.Material, iron: THREE.Material, stoneMat: THREE.Material, glass: THREE.Material): THREE.Object3D {
  const y0 = heightAt(CHAPEL.x, CHAPEL.z) - 0.2;
  const g = new THREE.Group();
  const wall = new THREE.MeshStandardMaterial({ map: T.plaster('#9c9383', 77), roughness: 0.95 });
  g.add(box(CHAPEL.w, CHAPEL.h, CHAPEL.d, wall, 0, CHAPEL.h / 2, 0));
  const roof = gableRoof(CHAPEL.w, CHAPEL.d, 3.6, new THREE.MeshStandardMaterial({ map: T.roofTiles('#2f2a28', 55) }), wall, false);
  roof.position.y = CHAPEL.h;
  g.add(roof);
  // Puerta (este) y vitrales
  g.add(box(0.14, 3.0, 1.8, woodDark, CHAPEL.w / 2 + 0.04, 1.5, 1, 1));
  const arch = new THREE.Mesh(new THREE.CircleGeometry(0.9, 16, 0, Math.PI), woodDark);
  arch.position.set(CHAPEL.w / 2 + 0.08, 3.0, 1);
  arch.rotation.y = Math.PI / 2;
  g.add(arch);
  for (const z of [-5, -1.5, 4.5]) {
    for (const side of [-1, 1]) {
      const w = box(0.1, 2.2, 0.8, glass, side * (CHAPEL.w / 2 + 0.02), 3.6, z, 1);
      w.castShadow = false;
      g.add(w);
    }
  }
  // Rosetón
  const rose = new THREE.Mesh(new THREE.CircleGeometry(1.0, 20), glass);
  rose.position.set(0, CHAPEL.h + 1.4, -CHAPEL.d / 2 - 0.02);
  rose.rotation.y = Math.PI;
  g.add(rose);
  g.position.set(CHAPEL.x, y0, CHAPEL.z);
  group.add(g);

  // Campanario (base abierta con la cuerda)
  const t = new THREE.Group();
  const bt = BELL_TOWER;
  const hs = bt.size / 2 - 0.35;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) t.add(box(0.7, 12, 0.7, stoneMat, sx * hs, 6, sz * hs, 2));
  t.add(box(bt.size, 0.4, bt.size, stoneMat, 0, 8.2, 0, 2));
  t.add(box(bt.size, 0.6, bt.size, stoneMat, 0, 12, 0, 2));
  const spire = new THREE.Mesh(new THREE.ConeGeometry(bt.size * 0.75, 4, 4), new THREE.MeshStandardMaterial({ map: T.roofTiles('#2a2624', 66) }));
  spire.rotation.y = Math.PI / 4;
  spire.position.y = 14.3;
  spire.castShadow = true;
  t.add(spire);
  const cross = new THREE.Group();
  cross.add(box(0.1, 1.2, 0.1, iron, 0, 0, 0, 1));
  cross.add(box(0.6, 0.1, 0.1, iron, 0, 0.2, 0, 1));
  cross.position.y = 16.8;
  t.add(cross);
  // Campana
  const bellPts: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i++) {
    const y = i / 12;
    bellPts.push(new THREE.Vector2(0.25 + 0.55 * Math.pow(1 - y, 1.6) + (y < 0.08 ? 0.05 : 0), y * 1.1));
  }
  const bell = new THREE.Mesh(new THREE.LatheGeometry(bellPts, 24), new THREE.MeshStandardMaterial({ color: '#6d5a36', metalness: 0.8, roughness: 0.35, side: THREE.DoubleSide }));
  const bellPivot = new THREE.Group();
  bell.position.y = -1.1;
  bellPivot.add(bell);
  bellPivot.position.y = 11.5;
  t.add(bellPivot);
  t.add(box(bt.size, 0.15, 0.15, woodDark, 0, 11.6, 0, 1));
  t.position.set(bt.x, heightAt(bt.x, bt.z) - 0.1, bt.z);
  group.add(t);
  return bellPivot;
}

function buildCasaMorales(group: THREE.Group, woodDark: THREE.Material, woodMid: THREE.Material, iron: THREE.Material, darkGlass: THREE.Material, statueMat: THREE.Material, quality: Quality): THREE.Points {
  const c = CASA_MORALES;
  const floorY = heightAt(c.x, c.z);
  const g = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ map: T.plaster('#6d665a', 99), roughness: 1 });
  const floorMat = new THREE.MeshStandardMaterial({ map: T.wood('#4a3a2c', 101), roughness: 0.9 });
  const w = c.maxX - c.minX;
  const d = c.maxZ - c.minZ;
  // Suelo
  const floor = box(w, 0.25, d, floorMat, c.x, floorY - 0.1, c.z, 2);
  g.add(floor);
  // Muros (a partir de los colisionadores compartidos)
  for (const col of casaMoralesWalls()) {
    if (col.type !== 'box') continue;
    const ww = col.maxX - col.minX;
    const dd = col.maxZ - col.minZ;
    g.add(box(ww, c.wallH, dd, wallMat, (col.minX + col.maxX) / 2, floorY + c.wallH / 2, (col.minZ + col.maxZ) / 2));
  }
  // Dinteles sobre las puertas
  g.add(box(c.frontDoor.maxX - c.frontDoor.minX, c.wallH - 2.3, c.wallT, wallMat, 0, floorY + 2.3 + (c.wallH - 2.3) / 2, c.maxZ));
  g.add(box(c.study.doorMaxX - c.study.doorMinX, c.wallH - 2.3, c.wallT, wallMat, (c.study.doorMinX + c.study.doorMaxX) / 2, floorY + 2.3 + (c.wallH - 2.3) / 2, c.study.maxZ));
  // Tejado con agujeros (la luz de la luna entra a la casa)
  const roofMat = new THREE.MeshStandardMaterial({ map: T.roofTiles('#2c2420', 103), roughness: 0.9 });
  const roof = gableRoof(w, d, 3.2, roofMat, wallMat, true, [11, 22]);
  roof.position.set(c.x, floorY + c.wallH, c.z);
  g.add(roof);
  // Ventanas tapiadas
  for (const [x, z, rot] of [[-5, c.maxZ + 0.2, 0], [5, c.maxZ + 0.2, 0], [c.maxX + 0.2, -76, Math.PI / 2], [c.maxX + 0.2, -81, Math.PI / 2], [c.minX - 0.2, -75, Math.PI / 2]] as [number, number, number][]) {
    const wg = new THREE.Group();
    wg.add(box(1.4, 1.2, 0.05, darkGlass, 0, 0, 0, 1));
    for (let i = 0; i < 3; i++) {
      const plank = box(1.7, 0.16, 0.05, woodMid, 0, -0.4 + i * 0.4, 0.05, 1);
      plank.rotation.z = (i - 1) * 0.12;
      wg.add(plank);
    }
    wg.position.set(x, floorY + 1.8, z);
    wg.rotation.y = rot;
    g.add(wg);
  }
  // Porche
  g.add(box(4, 0.2, 2, woodDark, 0, floorY - 0.05, c.maxZ + 1, 1));
  const post = box(0.18, 2.6, 0.18, woodDark, -1.8, floorY + 1.3, c.maxZ + 1.9, 1);
  post.rotation.z = 0.15;
  g.add(post);
  g.add(box(0.18, 2.6, 0.18, woodDark, 1.8, floorY + 1.3, c.maxZ + 1.9, 1));
  const porchRoof = box(4.4, 0.12, 2.3, woodDark, 0.2, floorY + 2.65, c.maxZ + 1.1, 1);
  porchRoof.rotation.z = 0.06;
  porchRoof.rotation.x = 0.15;
  g.add(porchRoof);
  // Interior: salón con mesa, sillas volcadas, sofá, chimenea y cuadros torcidos
  g.add(box(1.8, 0.08, 1.0, woodMid, 3, floorY + 0.8, -76, 1));
  for (const [x, z] of [[2.3, -76.4], [3.8, -75.5], [3.9, -76.6]] as [number, number][]) g.add(box(0.07, 0.8, 0.07, woodMid, x, floorY + 0.4, z, 1));
  const chair = new THREE.Group();
  chair.add(box(0.5, 0.06, 0.5, woodMid, 0, 0.45, 0, 1));
  chair.add(box(0.5, 0.6, 0.06, woodMid, 0, 0.75, -0.22, 1));
  chair.position.set(1.5, floorY + 0.05, -74.5);
  chair.rotation.set(Math.PI / 2.3, 0.4, 0);
  g.add(chair);
  const sofa = new THREE.MeshStandardMaterial({ color: '#3a2427', roughness: 1 });
  g.add(box(2.2, 0.5, 0.9, sofa, 5.5, floorY + 0.25, -82.8, 1));
  g.add(box(2.2, 0.7, 0.25, sofa, 5.5, floorY + 0.7, -83.4, 1));
  const hearth = new THREE.MeshStandardMaterial({ map: T.stoneBlocks('#4d4640', 105) });
  g.add(box(0.6, 2.6, 2, hearth, c.maxX - 0.45, floorY + 1.3, -79.5, 1));
  g.add(box(0.3, 1.0, 1.0, new THREE.MeshStandardMaterial({ color: '#050505' }), c.maxX - 0.75, floorY + 0.5, -79.5, 1));
  for (const [x, z, r] of [[-0.5, -83.8, 0.1], [2.5, -83.8, -0.2]] as [number, number, number][]) {
    const frame = box(0.8, 1.0, 0.05, woodDark, x, floorY + 1.9, z, 1);
    frame.rotation.z = r;
    g.add(frame);
  }
  // Estudio: estantería vacía
  g.add(box(1.6, 2.2, 0.4, woodDark, -6.5, floorY + 1.1, c.minZ + 0.35, 1));
  group.add(g);

  // Jardín: valla rota, árboles secos y ángel
  const fenceR = 15;
  for (let a = 0; a < Math.PI * 2; a += 0.075) {
    if (Math.abs(a - Math.PI / 2) < 0.12) continue; // entrada frente a la puerta
    if (Math.sin(a * 13.7) > 0.7) continue; // huecos
    const x = c.x + Math.cos(a) * fenceR;
    const z = c.z + Math.sin(a) * fenceR;
    const picket = box(0.08, 1.0 + Math.sin(a * 7) * 0.2, 0.05, woodMid, x, heightAt(x, z) + 0.45, z, 1);
    picket.rotation.set(Math.sin(a * 5) * 0.15, -a, Math.cos(a * 3) * 0.1);
    group.add(picket);
  }
  // Ángel
  const angel = new THREE.Group();
  angel.add(box(1.1, 1.0, 1.1, statueMat, 0, 0.5, 0, 1));
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.5, 10), statueMat);
  robe.position.y = 1.75;
  angel.add(robe);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), statueMat);
  head.position.y = 2.65;
  angel.add(head);
  for (const s of [-1, 1]) {
    const wing = box(0.08, 1.1, 0.55, statueMat, s * 0.25, 2.2, -0.25, 1);
    wing.rotation.set(0.3, s * 0.5, s * -0.35);
    angel.add(wing);
    const arm = box(0.1, 0.55, 0.1, statueMat, s * 0.2, 2.2, 0.15, 1);
    arm.rotation.x = -0.9;
    arm.rotation.z = s * 0.3;
    angel.add(arm);
  }
  angel.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
  });
  angel.position.set(ANGEL.x, heightAt(ANGEL.x, ANGEL.z), ANGEL.z);
  angel.rotation.y = 0.2;
  group.add(angel);

  // Polvo en suspensión dentro de la casa
  const n = quality === 'low' ? 120 : 300;
  const dp = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    dp[i * 3] = c.minX + Math.random() * w;
    dp[i * 3 + 1] = floorY + Math.random() * c.wallH;
    dp[i * 3 + 2] = c.minZ + Math.random() * d;
  }
  const dgeo = new THREE.BufferGeometry();
  dgeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(
    dgeo,
    new THREE.PointsMaterial({ size: 0.05, color: '#d8cdb5', transparent: true, opacity: 0.45, depthWrite: false, map: T.glowSprite('#ffffff'), blending: THREE.AdditiveBlending }),
  );
  group.add(dust);
  void iron;
  return dust;
}

function buildCave(group: THREE.Group, rockMat: THREE.Material, woodMid: THREE.Material, glowMat: THREE.Material) {
  const g = new THREE.Group();
  const w = CAVE.maxX - CAVE.minX;
  const d = CAVE.maxZ - CAVE.minZ;
  const cx = (CAVE.minX + CAVE.maxX) / 2;
  const cz = (CAVE.minZ + CAVE.maxZ) / 2;
  const dark = new THREE.MeshStandardMaterial({ map: T.rock(), color: '#4a4640', roughness: 1, side: THREE.DoubleSide });
  const floorGeo = new THREE.PlaneGeometry(w + 6, d + 6, 40, 34);
  floorGeo.rotateX(-Math.PI / 2);
  const fp = floorGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < fp.count; i++) {
    const x = fp.getX(i);
    const z = fp.getZ(i);
    const edge = Math.max(Math.abs(x) / (w / 2), Math.abs(z) / (d / 2));
    fp.setY(i, Math.sin(x * 0.7) * Math.cos(z * 0.6) * 0.08 + Math.max(0, edge - 0.9) * 12);
  }
  floorGeo.computeVertexNormals();
  const floor = new THREE.Mesh(floorGeo, dark);
  floor.position.set(cx, CAVE.floorY, cz);
  floor.receiveShadow = true;
  g.add(floor);
  const ceilGeo = new THREE.PlaneGeometry(w + 6, d + 6, 30, 26);
  ceilGeo.rotateX(Math.PI / 2);
  const cp = ceilGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < cp.count; i++) cp.setY(i, Math.sin(cp.getX(i) * 0.5) * Math.cos(cp.getZ(i) * 0.4) * 0.7 - Math.random() * 0.3);
  ceilGeo.computeVertexNormals();
  const ceil = new THREE.Mesh(ceilGeo, dark);
  ceil.position.set(cx, CAVE.ceilingY, cz);
  g.add(ceil);
  // Paredes rocosas irregulares
  for (let i = 0; i < 46; i++) {
    const t = i / 46;
    const per = 2 * (w + d);
    let s = t * per;
    let x: number;
    let z: number;
    if (s < w) {
      x = CAVE.minX + s;
      z = CAVE.minZ - 0.5;
    } else if ((s -= w) < d) {
      x = CAVE.maxX + 0.5;
      z = CAVE.minZ + s;
    } else if ((s -= d) < w) {
      x = CAVE.maxX - s;
      z = CAVE.maxZ + 0.5;
    } else {
      s -= w;
      x = CAVE.minX - 0.5;
      z = CAVE.maxZ - s;
    }
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(2.2 + (i % 3) * 0.6, 0), rockMat);
    r.position.set(x, 1.8 + (i % 2) * 0.8, z);
    r.rotation.set(i, i * 2, i * 3);
    r.scale.y = 1.6;
    g.add(r);
  }
  // Columnas (coinciden con los colisionadores compartidos)
  for (const [x, z, r] of [[165, -88, 1.6], [170, -104, 1.8], [178, -90, 1.2]] as [number, number, number][]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r, CAVE.ceilingY, 8, 3), rockMat);
    col.position.set(x, CAVE.ceilingY / 2, z);
    col.castShadow = true;
    g.add(col);
  }
  // Cristales / hongos luminiscentes
  for (let i = 0; i < 26; i++) {
    const x = CAVE.minX + 2 + ((i * 37) % 34);
    const z = CAVE.minZ + 2 + ((i * 53) % 28);
    const cr = new THREE.Mesh(new THREE.ConeGeometry(0.08 + (i % 3) * 0.04, 0.3 + (i % 4) * 0.15, 5), glowMat);
    cr.position.set(x, 0.15, z);
    cr.rotation.z = (i % 5) * 0.1 - 0.2;
    g.add(cr);
  }
  // Vigas de madera (antiguo pasadizo) y escalera de entrada
  for (let i = 0; i < 4; i++) {
    const x = 156 + i * 7;
    g.add(box(0.25, CAVE.ceilingY, 0.25, woodMid, x, CAVE.ceilingY / 2, -99.5, 1));
    g.add(box(0.25, CAVE.ceilingY, 0.25, woodMid, x, CAVE.ceilingY / 2, -90.5, 1));
    g.add(box(0.25, 0.25, 9.3, woodMid, x, CAVE.ceilingY - 0.3, -95, 1));
  }
  // Mensaje grabado en la roca
  const msg = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 1.2),
    new THREE.MeshStandardMaterial({
      map: T.signTexture([{ text: 'NO TOQUEN LA CAMPANA', size: 40, color: '#c9c1ae' }, { text: 'L · T · 1994', size: 30, color: '#9d9583', font: 'italic 400' }], '#3a3732'),
      roughness: 1,
    }),
  );
  msg.position.set(CAVE.maxX - 0.2, 1.8, -95);
  msg.rotation.y = -Math.PI / 2;
  g.add(msg);
  group.add(g);
}

function buildMine(group: THREE.Group, rockMat: THREE.Material, woodMid: THREE.Material, woodDark: THREE.Material, iron: THREE.Material, lampGlass: THREE.Material) {
  const g = new THREE.Group();
  const M = MINE_INT;
  const t = M.tunnel;
  const dark = new THREE.MeshStandardMaterial({ map: T.rock(), color: '#3f3a34', roughness: 1, side: THREE.DoubleSide });
  const coal = new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.6, metalness: 0.2 });
  // Farolillos de la mina: brillan siempre (no dependen de la hora del día)
  const mineLamp = new THREE.MeshStandardMaterial({ color: '#2a2418', emissive: new THREE.Color('#ffb35a'), emissiveIntensity: 1.6 });
  void lampGlass;
  // Suelo y techo de toda la región
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(M.maxX - M.minX + 4, M.maxZ - M.minZ + 4, 30, 24).rotateX(-Math.PI / 2), dark);
  const fp = floor.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < fp.count; i++) fp.setY(i, Math.sin(fp.getX(i) * 0.8) * Math.cos(fp.getZ(i) * 0.7) * 0.05);
  floor.geometry.computeVertexNormals();
  floor.position.set((M.minX + M.maxX) / 2, M.floorY, (M.minZ + M.maxZ) / 2);
  floor.receiveShadow = true;
  g.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(M.maxX - M.minX + 4, M.maxZ - M.minZ + 4).rotateX(Math.PI / 2), dark);
  ceil.position.set((M.minX + M.maxX) / 2, M.ceilingY, (M.minZ + M.maxZ) / 2);
  g.add(ceil);
  // Paredes de la galería (roca irregular) y de la cámara
  const wall = (x1: number, z1: number, x2: number, z2: number, n: number) => {
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(1.3 + (i % 3) * 0.35, 0), rockMat);
      r.position.set(x1 + (x2 - x1) * k, 1.6 + (i % 2) * 0.6, z1 + (z2 - z1) * k);
      r.rotation.set(i, i * 1.7, i * 2.3);
      r.scale.y = 1.5;
      g.add(r);
    }
  };
  wall(t.minX, t.minZ - 0.6, t.maxX, t.minZ - 0.6, 18);
  wall(t.minX, t.maxZ + 0.6, t.maxX, t.maxZ + 0.6, 18);
  wall(t.minX - 0.6, t.minZ, t.minX - 0.6, t.maxZ, 5);
  const c = M.chamber;
  wall(c.minX, c.minZ - 0.6, c.maxX, c.minZ - 0.6, 10);
  wall(c.minX, c.maxZ + 0.6, c.maxX, c.maxZ + 0.6, 10);
  wall(c.maxX + 0.6, c.minZ, c.maxX + 0.6, c.maxZ, 20);
  wall(c.minX + 0.6, c.minZ, c.minX + 0.6, t.minZ - 0.5, 8);
  wall(c.minX + 0.6, t.maxZ + 0.5, c.minX + 0.6, c.maxZ, 8);
  // Entibado: marcos de madera cada 4 m
  for (let x = t.minX + 3; x < t.maxX - 1; x += 4) {
    const skew = Math.sin(x) * 0.05;
    for (const z of [t.minZ + 0.4, t.maxZ - 0.4]) {
      const post = box(0.28, M.ceilingY, 0.28, woodDark, x, M.ceilingY / 2, z, 1);
      post.rotation.z = skew;
      g.add(post);
    }
    g.add(box(0.3, 0.3, t.maxZ - t.minZ, woodDark, x, M.ceilingY - 0.3, (t.minZ + t.maxZ) / 2, 1));
  }
  // Rieles y durmientes
  for (const dz of [-0.55, 0.55]) g.add(box(t.maxX - t.minX, 0.08, 0.08, iron, (t.minX + t.maxX) / 2, 0.08, -20 + dz, 2));
  for (let x = t.minX + 0.5; x < t.maxX; x += 0.9) g.add(box(0.2, 0.06, 1.6, woodMid, x, 0.03, -20, 1));
  // Derrumbes (coinciden con colisionadores compartidos)
  for (const [x, z, n] of [[160, -23, 6], [174.5, -16.8, 5]] as [number, number, number][]) {
    for (let i = 0; i < n; i++) {
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + (i % 3) * 0.2, 0), rockMat);
      r.position.set(x + Math.sin(i * 2.1) * 0.8, 0.25 + (i % 2) * 0.3, z + Math.cos(i * 1.7) * 0.6);
      r.rotation.set(i, i * 2, i);
      g.add(r);
    }
    const beam = box(3, 0.25, 0.25, woodDark, x, 0.5, z, 1);
    beam.rotation.set(0.2, 0.7, 0.5);
    g.add(beam);
  }
  // Farolillos colgados (algunos todavía encendidos)
  for (const [x, z] of [[156, -16.2], [171, -24], [185, -6], [197, -26]] as [number, number][]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.22, 6), mineLamp);
    l.position.set(x, 2.6, z);
    g.add(l);
  }
  // Cámara: pilares, cajas de dinamita vacías, carbón, herramientas
  for (const [x, z, r] of [[190, -21, 1.4], [192, -31, 1.2]] as [number, number, number][]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, M.ceilingY, 8, 3), rockMat);
    col.position.set(x, M.ceilingY / 2, z);
    col.castShadow = true;
    g.add(col);
  }
  for (let i = 0; i < 5; i++) g.add(box(0.7, 0.45, 0.45, woodMid, 186 + i * 0.8, 0.23 + (i % 2) * 0.45, -38.5 + (i % 2) * 0.1, 1));
  const pile = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.9, 9), coal);
  pile.position.set(198, 0.45, -3);
  g.add(pile);
  const pick = box(0.05, 0.9, 0.05, woodMid, 187, 0.5, -3, 1);
  pick.rotation.z = 0.9;
  g.add(pick);
  // Dibujo infantil en la pared
  const drawing = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 1.0),
    new THREE.MeshStandardMaterial({ map: T.signTexture([{ text: 'L  +  T', size: 60, color: '#e8e1cf', font: '400' }, { text: 'aquí esperamos', size: 34, color: '#cfc6b0', font: 'italic 400' }], '#3b3630', 256, 160), roughness: 1 }),
  );
  drawing.position.set(M.maxX - 0.3, 1.7, -12);
  drawing.rotation.y = -Math.PI / 2;
  g.add(drawing);
  group.add(g);
}
