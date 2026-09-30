import * as THREE from 'three';
import { glowSprite } from './textures';
import type { Quality } from './buildWorld';

type Weather = 'clear' | 'fog' | 'rain' | 'storm';

interface Key {
  t: number;
  skyTop: string;
  skyBottom: string;
  fog: string;
  sun: string;
  sunI: number;
  hemiI: number;
  ambI: number;
}

// Paleta cinematográfica por hora del día (0 = medianoche).
const KEYS: Key[] = [
  { t: 0.0, skyTop: '#03050b', skyBottom: '#0b1220', fog: '#0a0f18', sun: '#7d93c4', sunI: 0.35, hemiI: 0.22, ambI: 0.05 },
  { t: 0.21, skyTop: '#060a16', skyBottom: '#1b1a2a', fog: '#141621', sun: '#8e9fd0', sunI: 0.3, hemiI: 0.25, ambI: 0.06 },
  { t: 0.26, skyTop: '#2a3350', skyBottom: '#c7825a', fog: '#6d5a52', sun: '#ffb27a', sunI: 1.0, hemiI: 0.5, ambI: 0.08 },
  { t: 0.35, skyTop: '#4c6784', skyBottom: '#a9b3b2', fog: '#8b9291', sun: '#ffe6c4', sunI: 1.8, hemiI: 0.75, ambI: 0.1 },
  { t: 0.5, skyTop: '#566f86', skyBottom: '#b3b8b3', fog: '#959b98', sun: '#fff1dc', sunI: 2.1, hemiI: 0.85, ambI: 0.12 },
  { t: 0.68, skyTop: '#4a5a73', skyBottom: '#a39d8f', fog: '#86837a', sun: '#ffd9a8', sunI: 1.6, hemiI: 0.7, ambI: 0.1 },
  { t: 0.76, skyTop: '#2b2740', skyBottom: '#b8623f', fog: '#5e4540', sun: '#ff9960', sunI: 0.9, hemiI: 0.45, ambI: 0.08 },
  { t: 0.82, skyTop: '#0b0d1b', skyBottom: '#2a1f2e', fog: '#1a1822', sun: '#8a96c8', sunI: 0.35, hemiI: 0.26, ambI: 0.06 },
  { t: 1.0, skyTop: '#03050b', skyBottom: '#0b1220', fog: '#0a0f18', sun: '#7d93c4', sunI: 0.35, hemiI: 0.22, ambI: 0.05 },
];

const c1 = new THREE.Color();
const c2 = new THREE.Color();
function sample(t: number) {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].t <= t) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const k = (t - a.t) / Math.max(1e-6, b.t - a.t);
  const mix = (x: string, y: string) => c1.set(x).lerp(c2.set(y), k).clone();
  return {
    skyTop: mix(a.skyTop, b.skyTop),
    skyBottom: mix(a.skyBottom, b.skyBottom),
    fog: mix(a.fog, b.fog),
    sun: mix(a.sun, b.sun),
    sunI: a.sunI + (b.sunI - a.sunI) * k,
    hemiI: a.hemiI + (b.hemiI - a.hemiI) * k,
    ambI: a.ambI + (b.ambI - a.ambI) * k,
  };
}

/** Cielo, astros, luces globales, niebla, lluvia y relámpagos. */
export class Environment {
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly amb: THREE.AmbientLight;
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private stars: THREE.Points;
  private moon: THREE.Sprite;
  private rain: THREE.LineSegments;
  private rainPos: Float32Array;
  private fog: THREE.FogExp2;
  weather: Weather = 'fog';
  timeOfDay = 0.9;
  night = 1;
  private lightning = 0;
  private nextLightning = 0;
  onThunder: (delay: number, strength: number) => void = () => {};

  constructor(scene: THREE.Scene, quality: Quality) {
    this.fog = new THREE.FogExp2('#0a0f18', 0.02);
    scene.fog = this.fog;
    this.hemi = new THREE.HemisphereLight('#8aa0c0', '#1b1a14', 0.3);
    scene.add(this.hemi);
    this.amb = new THREE.AmbientLight('#404860', 0.05);
    scene.add(this.amb);
    this.sun = new THREE.DirectionalLight('#8e9fd0', 0.4);
    this.sun.castShadow = quality !== 'low';
    const sm = quality === 'high' ? 2048 : 1024;
    this.sun.shadow.mapSize.set(sm, sm);
    const sc = this.sun.shadow.camera;
    sc.left = -40;
    sc.right = 40;
    sc.top = 40;
    sc.bottom = -40;
    sc.near = 1;
    sc.far = 160;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color('#03050b') },
        bottom: { value: new THREE.Color('#0b1220') },
        sunDir: { value: new THREE.Vector3(0, 1, 0) },
        sunCol: { value: new THREE.Color('#ffffff') },
        haze: { value: 0.3 },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunCol; uniform float haze; varying vec3 vDir;
        void main(){ float h = clamp(vDir.y*0.5+0.5,0.0,1.0); vec3 col = mix(bottom, top, pow(smoothstep(0.35,1.0,h),0.8));
        float s = max(dot(normalize(vDir), normalize(sunDir)),0.0); col += sunCol * (pow(s,64.0)*0.8 + pow(s,6.0)*0.15) * (1.0-haze*0.6);
        col = mix(col, bottom, haze*0.35*(1.0-h)); gl_FragColor = vec4(col,1.0); }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), this.skyMat);
    this.sky.renderOrder = -1;
    this.sky.frustumCulled = false;
    scene.add(this.sky);

    const n = 1400;
    const sp = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random();
      const v = Math.random() * 0.5 + 0.5;
      const th = u * Math.PI * 2;
      const ph = Math.acos(2 * v - 1);
      sp[i * 3] = 380 * Math.sin(ph) * Math.cos(th);
      sp[i * 3 + 1] = 380 * Math.cos(ph);
      sp[i * 3 + 2] = 380 * Math.sin(ph) * Math.sin(th);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.3, sizeAttenuation: false, color: '#cfd8ff', transparent: true, opacity: 0.8, fog: false, depthWrite: false }));
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowSprite('#dfe8ff'), color: '#e9efff', fog: false, depthWrite: false, transparent: true }));
    this.moon.scale.setScalar(40);
    scene.add(this.moon);

    const drops = quality === 'low' ? 500 : quality === 'medium' ? 1200 : 2200;
    this.rainPos = new Float32Array(drops * 6);
    for (let i = 0; i < drops; i++) this.resetDrop(i, new THREE.Vector3(), true);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#9fb0c4', transparent: true, opacity: 0.35, depthWrite: false }));
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    scene.add(this.rain);
  }

  private resetDrop(i: number, center: THREE.Vector3, randomY: boolean) {
    const x = center.x + (Math.random() - 0.5) * 40;
    const z = center.z + (Math.random() - 0.5) * 40;
    const y = center.y + (randomY ? Math.random() * 25 : 22 + Math.random() * 4);
    const o = i * 6;
    this.rainPos[o] = x;
    this.rainPos[o + 1] = y;
    this.rainPos[o + 2] = z;
    this.rainPos[o + 3] = x + 0.05;
    this.rainPos[o + 4] = y - 0.7;
    this.rainPos[o + 5] = z;
  }

  update(dt: number, center: THREE.Vector3, inCave: boolean) {
    const k = sample(this.timeOfDay);
    // Posición del sol / luna
    const ang = (this.timeOfDay - 0.25) * Math.PI * 2;
    const sunDir = new THREE.Vector3(Math.cos(ang) * 0.8, Math.sin(ang), 0.45).normalize();
    const isDay = sunDir.y > -0.05;
    const lightDir = isDay ? sunDir : sunDir.clone().negate().setY(Math.abs(sunDir.y) + 0.35).normalize();
    this.night = THREE.MathUtils.clamp(1 - (sunDir.y + 0.12) / 0.3, 0, 1);

    const weatherDim = this.weather === 'storm' ? 0.45 : this.weather === 'rain' ? 0.65 : this.weather === 'fog' ? 0.8 : 1;
    const baseFog = this.weather === 'fog' ? 0.034 : this.weather === 'storm' ? 0.03 : this.weather === 'rain' ? 0.024 : 0.012;
    const fogCol = k.fog.clone().multiplyScalar(weatherDim);

    if (inCave) {
      this.sun.intensity = 0;
      this.hemi.intensity = 0.02;
      this.amb.intensity = 0.03;
      this.amb.color.set('#2b3140');
      this.fog.color.set('#020304');
      this.fog.density = 0.07;
      this.sky.visible = this.stars.visible = this.moon.visible = this.rain.visible = false;
      return;
    }
    this.sky.visible = this.stars.visible = true;
    this.sun.color.copy(k.sun);
    this.sun.intensity = k.sunI * weatherDim + this.lightning * 3;
    this.hemi.intensity = k.hemiI * weatherDim + this.lightning * 1.5;
    this.hemi.color.copy(k.skyTop).lerp(new THREE.Color('#9fb2cc'), 0.5);
    this.amb.intensity = k.ambI;
    this.amb.color.set('#404860');
    this.fog.color.copy(fogCol).lerp(new THREE.Color('#c9d6ff'), this.lightning * 0.4);
    this.fog.density = baseFog * (1 + this.night * 0.35);
    this.skyMat.uniforms.top.value.copy(k.skyTop).multiplyScalar(weatherDim).lerp(new THREE.Color('#8894b8'), this.lightning * 0.6);
    this.skyMat.uniforms.bottom.value.copy(fogCol);
    this.skyMat.uniforms.sunDir.value.copy(sunDir);
    this.skyMat.uniforms.sunCol.value.copy(k.sun).multiplyScalar(isDay ? 1 : 0);
    this.skyMat.uniforms.haze.value = this.weather === 'clear' ? 0.2 : 0.9;
    this.sky.position.copy(center);
    this.stars.position.copy(center);
    (this.stars.material as THREE.PointsMaterial).opacity = this.night * (this.weather === 'clear' ? 0.9 : 0.25);
    this.moon.visible = this.night > 0.2;
    this.moon.position.copy(center).addScaledVector(sunDir.clone().negate().setY(Math.abs(sunDir.y) + 0.25).normalize(), 300);
    (this.moon.material as THREE.SpriteMaterial).opacity = this.night * (this.weather === 'clear' ? 1 : 0.35);

    // La luz direccional sigue al jugador para que la sombra tenga resolución útil
    this.sun.position.copy(center).addScaledVector(lightDir, 80);
    this.sun.target.position.copy(center);

    // Lluvia
    const raining = this.weather === 'rain' || this.weather === 'storm';
    this.rain.visible = raining;
    if (raining) {
      const n = this.rainPos.length / 6;
      const speed = this.weather === 'storm' ? 26 : 18;
      for (let i = 0; i < n; i++) {
        const o = i * 6;
        this.rainPos[o + 1] -= speed * dt;
        this.rainPos[o + 4] -= speed * dt;
        this.rainPos[o] += (this.weather === 'storm' ? 4 : 1) * dt;
        this.rainPos[o + 3] += (this.weather === 'storm' ? 4 : 1) * dt;
        if (this.rainPos[o + 4] < center.y - 2 || Math.abs(this.rainPos[o] - center.x) > 22 || Math.abs(this.rainPos[o + 2] - center.z) > 22) this.resetDrop(i, center, false);
      }
      (this.rain.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
    // Relámpagos
    this.lightning = Math.max(0, this.lightning - dt * 4);
    if (this.weather === 'storm') {
      this.nextLightning -= dt;
      if (this.nextLightning <= 0) {
        this.lightning = 1;
        this.nextLightning = 8 + Math.random() * 18;
        this.onThunder(0.6 + Math.random() * 2.5, 0.6 + Math.random() * 0.4);
      }
    }
  }
}
