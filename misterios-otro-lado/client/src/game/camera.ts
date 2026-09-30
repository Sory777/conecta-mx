import * as THREE from 'three';
import { heightAt, regionOf } from '../../../shared/world';

/** Cámara en tercera persona con órbita, zoom y suavizado. */
export class FollowCamera {
  yaw = 0; // 0 = mirando hacia -Z
  pitch = 0.32;
  distance = 5.5;
  private current = new THREE.Vector3();
  private initialized = false;

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  rotate(dx: number, dy: number) {
    this.yaw -= dx * 0.005;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.004, -0.25, 1.2);
  }

  zoom(steps: number) {
    this.distance = THREE.MathUtils.clamp(this.distance + steps * 0.6, 2.2, 11);
  }

  update(target: THREE.Vector3, dt: number) {
    const inCave = regionOf(target.x, target.z) !== 'outdoor';
    const dist = inCave ? Math.min(this.distance, 3.6) : this.distance;
    const focus = target.clone().add(new THREE.Vector3(0, 1.55, 0));
    const offset = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch)).multiplyScalar(dist);
    const desired = focus.clone().add(offset);
    const ground = (inCave ? 0 : heightAt(desired.x, desired.z)) + 0.4;
    if (desired.y < ground) desired.y = ground;
    if (inCave && desired.y > 4.3) desired.y = 4.3;
    if (!this.initialized) {
      this.current.copy(desired);
      this.initialized = true;
    }
    this.current.lerp(desired, 1 - Math.exp(-dt * 12));
    this.camera.position.copy(this.current);
    this.camera.lookAt(focus);
  }

  snap() {
    this.initialized = false;
  }

  /** Dirección "adelante" de la cámara proyectada al plano horizontal. */
  forward(): THREE.Vector3 {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }
}
