import * as THREE from 'three';
import type { EntityView } from '../../../shared/protocol';
import { glowSprite, signTexture, wood } from './world/textures';

/** Representación visual de las entidades de misterio (definidas por datos en el servidor). */
export class EntityVisual {
  readonly root = new THREE.Group();
  private model = new THREE.Group();
  private wisp: THREE.Sprite;
  private beacon: THREE.Mesh;
  private door: THREE.Group | null = null;
  private doorAngle = 0;
  view: EntityView;
  private t = Math.random() * 10;

  constructor(view: EntityView) {
    this.view = view;
    this.root.position.set(view.p[0], view.p[1], view.p[2]);
    this.root.add(this.model);
    this.build(view);
    this.wisp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite('#9fe0ff'), color: '#bfe9ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.wisp.scale.setScalar(0.9);
    this.wisp.position.y = 1.4;
    this.root.add(this.wisp);
    this.beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.6, 40, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: '#9fd0ff', transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }),
    );
    this.beacon.position.y = 20;
    this.beacon.visible = false;
    this.root.add(this.beacon);
    this.sync(view);
  }

  private build(v: EntityView) {
    const woodMat = new THREE.MeshStandardMaterial({ map: wood('#4a3526', 201), roughness: 0.9 });
    const brass = new THREE.MeshStandardMaterial({ color: '#8c6a2e', metalness: 0.85, roughness: 0.35 });
    this.model.rotation.y = v.rotY ?? 0;
    switch (v.model) {
      case 'door': {
        const [w] = v.blockSize ?? [2, 0.25];
        const hinge = new THREE.Group();
        const panel = new THREE.Mesh(new THREE.BoxGeometry(w, 2.25, 0.08), woodMat);
        panel.position.set(w / 2, 1.12, 0);
        panel.castShadow = true;
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), brass);
        knob.position.set(w - 0.15, 1.05, 0.07);
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.02), brass);
        plate.position.set(w - 0.15, 1.05, 0.05);
        hinge.add(panel, knob, plate);
        hinge.position.x = -w / 2;
        this.model.add(hinge);
        this.door = hinge;
        break;
      }
      case 'desk_diary': {
        const top = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.07, 0.75), woodMat);
        top.position.y = 0.78;
        top.castShadow = true;
        this.model.add(top);
        for (const [x, z] of [[-0.62, -0.3], [0.62, -0.3], [-0.62, 0.3], [0.62, 0.3]]) {
          const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.78, 0.06), woodMat);
          l.position.set(x, 0.39, z);
          this.model.add(l);
        }
        const book = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.2), new THREE.MeshStandardMaterial({ color: '#5a2330', roughness: 0.8 }));
        book.position.set(0.1, 0.84, 0);
        book.rotation.y = 0.3;
        this.model.add(book);
        const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.15, 8), new THREE.MeshStandardMaterial({ color: '#e8dcc0' }));
        candle.position.set(-0.45, 0.89, -0.15);
        this.model.add(candle);
        break;
      }
      case 'hatch': {
        const lid = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 1.1), woodMat);
        lid.position.y = 0.05;
        lid.receiveShadow = true;
        this.model.add(lid);
        for (const x of [-0.35, 0.35]) {
          const band = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 1.12), new THREE.MeshStandardMaterial({ color: '#1e1e1e', metalness: 0.6, roughness: 0.5 }));
          band.position.set(x, 0.06, 0);
          this.model.add(band);
        }
        const lock = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.06), brass);
        lock.position.set(0, 0.13, 0.5);
        this.model.add(lock);
        break;
      }
      case 'pendant_box': {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 0), new THREE.MeshStandardMaterial({ color: '#4d4943', roughness: 1 }));
        rock.scale.y = 0.8;
        rock.position.y = 0.35;
        this.model.add(rock);
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.22), brass);
        b.position.y = 0.85;
        b.rotation.y = 0.4;
        this.model.add(b);
        break;
      }
      case 'tunnel_exit': {
        for (let i = 0; i < 9; i++) {
          const rung = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.05), woodMat);
          rung.position.set(0, 0.3 + i * 0.5, -0.8);
          this.model.add(rung);
        }
        for (const x of [-0.3, 0.3]) {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 4.6, 0.06), woodMat);
          rail.position.set(x, 2.3, -0.8);
          this.model.add(rail);
        }
        const shaft = new THREE.Mesh(
          new THREE.CylinderGeometry(0.7, 1.4, 5, 16, 1, true),
          new THREE.MeshBasicMaterial({ color: '#b9c9e6', transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
        );
        shaft.position.y = 2.5;
        this.model.add(shaft);
        break;
      }
      case 'notice': {
        const board = new THREE.Mesh(
          new THREE.PlaneGeometry(0.7, 0.9),
          new THREE.MeshStandardMaterial({
            map: signTexture([{ text: 'AVISO', size: 60, color: '#2a2018' }, { text: 'La campana', size: 34, color: '#3a2d22', font: 'italic 400' }, { text: 'permanecerá atada', size: 34, color: '#3a2d22', font: 'italic 400' }], '#cfc1a0', 256, 320),
            roughness: 1,
          }),
        );
        board.position.y = 1.6;
        this.model.add(board);
        break;
      }
      case 'bell_rope': {
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 10, 6), new THREE.MeshStandardMaterial({ color: '#8a7454', roughness: 1 }));
        rope.position.y = 5.8;
        this.model.add(rope);
        const knot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), rope.material);
        knot.position.y = 0.85;
        this.model.add(knot);
        break;
      }
      default:
        break;
    }
    this.model.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });
  }

  sync(v: EntityView) {
    this.view = v;
    this.root.visible = v.visible;
    this.wisp.visible = v.highlight;
  }

  setBeacon(on: boolean) {
    this.beacon.visible = on;
  }

  update(dt: number, night: number) {
    this.t += dt;
    if (this.wisp.visible) {
      const s = 0.7 + Math.sin(this.t * 2.2) * 0.18;
      this.wisp.scale.setScalar(s);
      this.wisp.position.y = 1.3 + Math.sin(this.t * 1.3) * 0.15;
      (this.wisp.material as THREE.SpriteMaterial).opacity = 0.55 + night * 0.4;
    }
    if (this.beacon.visible) (this.beacon.material as THREE.MeshBasicMaterial).opacity = 0.04 + night * 0.05 + Math.sin(this.t * 1.5) * 0.015;
    if (this.door) {
      const target = this.view.blocking ? 0 : -1.75;
      this.doorAngle += (target - this.doorAngle) * Math.min(1, dt * 2);
      this.door.rotation.y = this.doorAngle;
    }
  }
}
