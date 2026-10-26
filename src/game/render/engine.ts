import * as THREE from 'three';
import { SIM, ALTITUDE, PHYSICS } from '../../data/config';
import { characterById } from '../../data/characters';
import { balloonById } from '../../data/balloons';
import { ZONES } from '../../data/zones';
import { toolById } from '../../data/tools';
import type { ObstacleId } from '../../data/obstacles';
import type { CollectibleId } from '../../data/collectibles';
import { FixedStepLoop } from '../core/loop';
import { FlightSim, type SimEvent } from '../simulation';
import { yFromAltitude } from '../physics/atmosphere';
import type { DisasterId } from '../../data/disasters';
import { InputManager } from '../input/input';
import { audio } from '../audio/audio';
import { CameraRig } from '../camera/cameraRig';
import { Sky } from './sky';
import { CloudField } from './clouds';
import { Terrain } from './terrain';
import { BalloonView } from './balloonMesh';
import { CharacterRig } from './characterMesh';
import { Particles, Precipitation } from './particles';
import { ViewPool, makeHazardView, makeCollectibleView, animate } from './entityViews';
import { DisasterViews, Ribbon } from './disasterViews';
import { computePalette } from './environment';
import { Overlay, type Indicator } from './overlay';
import { planetTexture } from './textures';
import { Starfield, Wonders } from './wonders';
import { useGame, lookFor, currentLoadout, type EngineApi, type FlightConfig, type HudSnapshot } from '../../app/store';
import { smoothstep } from '../core/math';
import type { Action } from '../persistence/save';

type Mode = 'showcase' | 'flight';
const SHOWCASE_Y = 34;

export class GameEngine implements EngineApi {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.5, 26000);
  private stars = new Starfield();
  private wonders = new Wonders();
  private rig = new CameraRig(this.camera);
  private sky = new Sky();
  private clouds: CloudField;
  private terrain = new Terrain();
  private planet: THREE.Mesh;
  private atmoRim: THREE.Mesh;
  private hemi = new THREE.HemisphereLight('#bfe6ff', '#6c8b55', 1.2);
  private sun = new THREE.DirectionalLight('#fff6dd', 2.2);
  private flashLight = new THREE.PointLight('#cfe0ff', 0, 400, 1);
  private particles = new Particles(5000, false);
  private additive = new Particles(4000, true);
  private rain = new Precipitation(900);
  private streaks = new Precipitation(160);
  private hazardViews = new ViewPool<ObstacleId>((k) => makeHazardView(k));
  private collectViews = new ViewPool<CollectibleId>((k) => makeCollectibleView(k));
  private telegraphs = new ViewPool<'line'>(() => {
    const r = new Ribbon(2, '#ffb26b', 0.6);
    r.mesh.userData.ribbon = r;
    return r.mesh;
  });
  private disasterViews: DisasterViews;
  private balloon: BalloonView | null = null;
  private balloonKey = '';
  private overlay = new Overlay();
  private input: InputManager;
  private loop = new FixedStepLoop(SIM.step, SIM.maxSubSteps);
  private sim: FlightSim | null = null;
  private mode: Mode = 'showcase';
  private showcaseKind: 'menu' | 'character' | 'garage' = 'menu';
  private origin = { x: 0, y: 0 };
  private time = 0;
  private tod = 0.38;
  private flash = 0;
  private paused = false;
  private finishing = false;
  private lastHud = 0;
  private celebrateUntil = 0;
  private sandbags = 6;
  private w = 1;
  private h = 1;
  private last = performance.now();
  private palette = computePalette(0, 0.38, 0);
  private recordFxShown = false;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);
    container.appendChild(this.overlay.canvas);
    this.renderer.domElement.style.display = 'block';

    this.scene.add(this.sky.mesh);
    this.scene.add(this.hemi, this.sun, this.sun.target, this.flashLight, new THREE.AmbientLight('#ffffff', 0.25));
    this.clouds = new CloudField(240);
    this.scene.add(this.clouds.group);
    this.scene.add(this.terrain.group);
    this.scene.fog = new THREE.FogExp2('#bfe6ff', 0.0012);

    // the planet is a backdrop: drawn right after the sky, never occluding gameplay
    this.planet = new THREE.Mesh(new THREE.SphereGeometry(9000, 128, 64), new THREE.MeshStandardMaterial({ map: planetTexture(), roughness: 0.9, transparent: true, opacity: 0, fog: false, depthTest: false, depthWrite: false }));
    this.planet.renderOrder = -8;
    this.atmoRim = new THREE.Mesh(
      new THREE.SphereGeometry(9350, 64, 32),
      new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, depthTest: false, side: THREE.BackSide, blending: THREE.AdditiveBlending, fog: false,
        uniforms: { uAlpha: { value: 0 } },
        vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
        fragmentShader: `uniform float uAlpha; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 3.0); gl_FragColor = vec4(vec3(0.35,0.65,1.0), f*uAlpha); }`,
      }),
    );
    this.atmoRim.renderOrder = -7;
    this.scene.add(this.planet, this.atmoRim, this.stars.points, this.wonders.group);

    for (const o of [this.particles.points, this.additive.points, this.rain.lines, this.streaks.lines, this.hazardViews.group, this.collectViews.group, this.telegraphs.group]) this.scene.add(o);
    this.streaks.setColor('#ffffff', 0.25);
    this.streaks.length = 9;
    this.disasterViews = new DisasterViews(
      {
        particles: this.particles,
        additive: this.additive,
        flash: (a, x, y) => {
          this.flash = Math.max(this.flash, a);
          this.flashLight.position.set(x, y, 20);
        },
      },
      (x) => {
        this.terrain.volcano.visible = x !== null;
        if (x !== null) this.terrain.volcano.position.set(x, -8, -60);
      },
    );
    this.scene.add(this.disasterViews.group);

    this.input = new InputManager(() => useGame.getState().save.settings, this.renderer.domElement);
    this.input.onAction = (a: Action) => this.onAction(a);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.applySettings();
    this.showcase('menu');
    requestAnimationFrame(this.frame);
  }

  // ---------------------------------------------------------------- API
  applySettings() {
    const s = useGame.getState().save.settings;
    const pr = s.quality === 'low' ? 0.7 : s.quality === 'medium' ? 1 : Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(pr);
    this.resize();
    this.rig.shakeScale = s.shake;
    audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx });
  }

  showcase(kind: 'menu' | 'character' | 'garage') {
    this.showcaseKind = kind;
    if (this.mode === 'flight') this.endFlightView();
    this.mode = 'showcase';
    this.rig.reset();
    this.refreshShowcase();
  }

  refreshShowcase() {
    if (this.mode !== 'showcase') return;
    this.buildBalloon();
  }

  captureKey(cb: (code: string) => void) {
    this.input.captureNextKey(cb);
  }

  /** Read-only access for tests and debugging. */
  get flightSim() {
    return this.sim;
  }

  /** Debug helpers exposed on window.__skybound for automated tests and tuning. */
  readonly debug = {
    disaster: (id: DisasterId, intensity = 1) => this.sim?.director.force(id, intensity),
    /** Simulate `seconds` of flight instantly with a simple autopilot (burner on). */
    fastForward: (seconds: number, burner = true) => {
      const sim = this.sim;
      if (!sim) return;
      for (let t = 0; t < seconds && !sim.ended; t += SIM.step) {
        const inp = this.input.sample();
        inp.burner = inp.burner || burner;
        sim.step(SIM.step, inp);
      }
      this.handleEvents(sim.drainEvents());
    },
    teleport: (altitude: number) => {
      const sim = this.sim;
      if (!sim) return;
      sim.body.y = yFromAltitude(altitude);
      sim.body.heat = 1.2;
    },
  };

  setPaused(p: boolean) {
    this.paused = p;
    this.input.clear();
  }

  abandonFlight() {
    if (this.sim && !this.sim.ended) {
      this.sim.abandon();
      this.handleEvents(this.sim.drainEvents());
    }
  }

  startFlight(cfg: FlightConfig) {
    const st = useGame.getState();
    const loadout = currentLoadout(st.save, cfg.mods);
    this.sim = new FlightSim(loadout, { seed: cfg.seed, previousBest: st.save.stats.bestAltitude });
    this.mode = 'flight';
    this.finishing = false;
    this.paused = false;
    this.recordFxShown = false;
    this.celebrateUntil = 0;
    this.sandbags = 6;
    this.origin = { x: 0, y: 0 };
    this.tod = [0.27, 0.33, 0.42, 0.5, 0.6, 0.7][cfg.seed % 6];
    this.loop.reset();
    this.hazardViews.clear();
    this.collectViews.clear();
    this.telegraphs.clear();
    this.disasterViews.clear();
    this.particles.clear();
    this.additive.clear();
    this.overlay.clear();
    this.rig.reset();
    this.rig.yaw = 0;
    this.rig.pitch = -0.06;
    this.buildBalloon();
    this.input.clear();
    this.input.enabled = true;
    audio.unlock();
    audio.play('launch');
    audio.mood = 'calm';
  }

  private endFlightView() {
    this.sim = null;
    this.input.enabled = false;
    this.hazardViews.clear();
    this.collectViews.clear();
    this.telegraphs.clear();
    this.disasterViews.clear();
    this.rain.amount = 0;
    this.streaks.amount = 0;
    this.overlay.clear();
    this.origin = { x: 0, y: 0 };
    this.terrain.volcano.visible = false;
    audio.mood = 'menu';
  }

  private buildBalloon() {
    const save = useGame.getState().save;
    const ch = characterById(save.selectedCharacter);
    const look = lookFor(save, ch);
    const key = `${save.selectedBalloon}|${ch.id}|${look.shirt}|${look.pants}|${look.accessory}`;
    if (this.balloon && key === this.balloonKey) return;
    if (this.balloon) {
      this.scene.remove(this.balloon.root);
      this.balloon.dispose();
    }
    this.balloonKey = key;
    this.balloon = new BalloonView(balloonById(save.selectedBalloon), new CharacterRig(ch, look));
    this.scene.add(this.balloon.root);
  }

  private onAction(a: Action) {
    const st = useGame.getState();
    if (st.screen !== 'flight' || !this.sim || this.sim.ended) return;
    if (a === 'pause') {
      if (st.equipmentOpen) st.setEquipmentOpen(false);
      else st.setPaused(!st.paused);
    } else if (a === 'equipment') st.setEquipmentOpen(!st.equipmentOpen);
  }

  // ---------------------------------------------------------------- loop
  private resize = () => {
    this.w = this.container.clientWidth || window.innerWidth;
    this.h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(this.w, this.h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
    this.overlay.resize(this.w, this.h, Math.min(2, window.devicePixelRatio));
    this.particles.setScale(this.h);
    this.additive.setScale(this.h);
  };

  private frame = () => {
    requestAnimationFrame(this.frame);
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    try {
      if (this.mode === 'flight' && this.sim) this.flightFrame(dt);
      else this.showcaseFrame(dt);
    } catch (err) {
      console.error(err);
    }
    this.renderer.render(this.scene, this.camera);
  };

  private showcaseFrame(dt: number) {
    const b = this.balloon;
    const y = SHOWCASE_Y + Math.sin(this.time * 0.6) * 1.2;
    this.tod = 0.33;
    this.applyEnvironment(120, 0, 1, 1, dt);
    if (b) {
      b.root.position.set(0, y, 0);
      b.update(dt, this.time, Math.sin(this.time * 0.4) * 2, 0, {
        heat: 1, burning: Math.sin(this.time * 0.9) > 0.55, boosting: false, venting: false, steer: 0, ice: 0, shield: 0, rod: 0,
        fans: (useGame.getState().save.upgrades.fans ?? 0) > 0, deflate: 0, sandbags: 6,
      });
      b.character.setPose(this.showcaseKind === 'character' ? (Math.sin(this.time * 0.5) > 0.6 ? 'celebrate' : 'wave') : 'wave');
      b.character.lookX = Math.sin(this.time * 0.3) * 0.4;
      b.character.update(dt, this.time);
    }
    if (this.showcaseKind === 'character') {
      const a = Math.sin(this.time * 0.25) * 0.35;
      this.camera.position.set(Math.sin(a) * 9 - 2.6, y + 5.2, Math.cos(a) * 9);
      this.camera.lookAt(-2.9, y + 3.1, 0);
    } else if (this.showcaseKind === 'garage') this.rig.showcase(dt, 0, y, this.time * 2.2, 50, 2, 16);
    else this.rig.showcase(dt, 0, y, this.time, 70, -2);
    this.clouds.update(dt, this.camera.position.x, this.camera.position.y, 2);
    this.terrain.update(0);
    this.terrain.group.position.set(0, 0, 0);
    this.particles.update(dt);
    this.additive.update(dt);
    this.rain.update(dt, 0, y);
    this.streaks.update(dt, 0, y);
    this.overlay.draw(dt, this.camera, this.w, this.h, [], this.time);
    audio.ambient(0, false, 3, 0, dt);
  }

  private flightFrame(dt: number) {
    const sim = this.sim!;
    const st = useGame.getState();
    if (!this.paused && !sim.ended) {
      this.loop.advance(dt, (step) => sim.step(step, this.input.sample()));
      this.handleEvents(sim.drainEvents());
      this.tod += dt / 1500;
    }
    if (sim.ended && !this.finishing) {
      this.finishing = true;
      this.input.enabled = false;
      setTimeout(() => {
        if (this.sim === sim) useGame.getState().finishFlight(sim);
      }, 900);
    }

    const b = sim.body;
    // floating origin: keep render coordinates small no matter how high we go
    const chunk = ALTITUDE.floatingOriginChunk;
    const dx = Math.abs(b.x - this.origin.x) > chunk ? Math.round((b.x - this.origin.x) / chunk) * chunk : 0;
    const dy = Math.abs(b.y - this.origin.y) > chunk ? Math.round((b.y - this.origin.y) / chunk) * chunk : 0;
    if (dx || dy) {
      this.origin.x += dx;
      this.origin.y += dy;
      this.clouds.shift(dx, dy);
      this.particles.shift(dx, dy);
      this.additive.shift(dx, dy);
      this.rig.shift(dx, dy);
      this.overlay.shift(dx, dy);
      this.wonders.shift(dx, dy);
    }
    const ox = this.origin.x;
    const oy = this.origin.y;
    const px = b.x - ox;
    const py = b.y - oy;

    // camera
    const cam = this.input.consumeCamera();
    this.rig.input(cam.dx, cam.dy, cam.wheel);
    this.rig.update(dt, px, py, b.vx, b.vy, sim.turbulence, this.time);

    // balloon
    const bv = this.balloon!;
    bv.root.position.set(px, py, 0);
    const dying = sim.dying > 0 || (sim.ended && (sim.endReason === 'envelope' || sim.endReason === 'basket' || sim.endReason === 'crash'));
    bv.update(dt, this.time, b.vx, b.vy, {
      heat: b.heat, burning: sim.burning && !this.paused, boosting: sim.boosting, venting: sim.venting, steer: sim.steering,
      ice: b.ice, shield: sim.shieldTimer, rod: sim.rodTimer, fans: sim.loadout.steerAccel > 1, deflate: dying ? Math.min(1, (2.6 - sim.dying) / 1.5) : 0,
      sandbags: this.sandbags,
    });
    const ch = bv.character;
    const recentlyHit = sim.time - sim.lastHitTime < 1.1;
    const danger = sim.director.active.some((d) => d.phase === 'warning' && d.def.major);
    ch.setPose(
      sim.repairing > 0 ? 'repair'
        : dying ? 'panic'
        : sim.ended ? (sim.endReason === 'landing' ? 'celebrate' : 'sad')
        : this.time < this.celebrateUntil ? 'celebrate'
        : recentlyHit || sim.hypoxic || danger ? 'panic'
        : sim.burning ? 'burn' : 'idle',
    );
    ch.lookX = sim.steering;
    ch.update(dt, this.time);

    // burner sparks and venting puffs
    if (sim.burning && Math.random() < dt * (sim.boosting ? 60 : 25)) {
      this.additive.emit({ x: px, y: py + 5.5, z: 0, vy: 9, count: 1, speed: 2, life: 0.6, size: 0.7, color: '#ffd166', color2: '#ff6b35' });
    }
    if (sim.venting && Math.random() < dt * 14) {
      this.particles.emit({ x: px, y: py + PHYSICS.envelopeOffsetY + 7.4, vy: 5, count: 1, speed: 2, life: 1.2, size: 2.5, sizeEnd: 5, color: '#f3f3f3', alpha: 0.4 });
    }
    if (b.ice > 0.3 && Math.random() < dt * 8) {
      this.additive.emit({ x: px + (Math.random() - 0.5) * 14, y: py + PHYSICS.envelopeOffsetY + (Math.random() - 0.5) * 14, z: 7, count: 1, speed: 0.5, life: 0.6, size: 0.8, color: '#e0faff' });
    }

    this.syncEntities(sim, ox, oy, dt);
    this.disasterViews.sync(sim.director.active, ox, oy, px, py, this.time, dt);

    // weather particles
    let rain = 0;
    let rainVx = sim.windX * 2;
    let rainVy = -70;
    for (const d of sim.director.active) {
      if (['thunderstorm', 'supercell', 'hurricane'].includes(d.id)) rain = Math.max(rain, d.presence * (d.id === 'supercell' ? 1 : 0.75));
      if (d.id === 'hurricane') {
        rainVx = d.dir * 70;
        rainVy = -25;
      }
    }
    this.rain.amount = rain;
    this.rain.vx = rainVx;
    this.rain.vy = rainVy;
    this.rain.update(dt, px, py);
    this.streaks.amount = Math.min(1, Math.max(0, (Math.abs(sim.windX) - 6) / 14));
    this.streaks.vx = sim.windX * 6;
    this.streaks.vy = -b.vy * 3 - 2;
    this.streaks.update(dt, px, py);
    this.particles.update(dt);
    this.additive.update(dt);

    this.applyEnvironment(sim.altitude, sim.gloom, sim.fog, sim.visibility, dt);
    this.clouds.update(dt, px, py, sim.windX);
    if (sim.altitude < 30000) {
      this.terrain.update(b.x);
      this.terrain.group.position.set(-ox, -oy, 0);
      this.terrain.group.visible = sim.altitude < 20000;
    } else this.terrain.group.visible = false;

    // overlay
    this.overlay.draw(dt, this.camera, this.w, this.h, this.indicators(sim, ox, oy), this.time);

    // audio
    const storming = sim.director.active.some((d) => d.phase !== 'warning');
    audio.mood = sim.ended ? 'menu' : storming || sim.director.phase === 'warning' ? 'tense' : sim.altitude > 35000 ? 'space' : 'calm';
    audio.ambient(sim.burning && !this.paused ? 1 : 0, sim.boosting, Math.abs(sim.windX) + sim.turbulence * 8, rain, dt);

    // hud
    if (this.time - this.lastHud > 1 / SIM.hudHz) {
      this.lastHud = this.time;
      st.setHud(this.snapshot(sim, st.save.stats.bestAltitude));
    }
  }

  private syncEntities(sim: FlightSim, ox: number, oy: number, dt: number) {
    this.hazardViews.begin();
    this.telegraphs.begin();
    sim.traffic.pool.forEachAlive((h) => {
      const v = this.hazardViews.get(h.uid, h.def.id);
      v.position.set(h.x - ox, h.y - oy, 0);
      if (h.def.pattern !== 'ballistic' && h.def.pattern !== 'diagonal' && h.def.pattern !== 'fall') v.rotation.y = h.vx < 0 ? Math.PI : 0;
      animate(v, this.time + h.phase, dt);
      if (h.telegraph > 0) {
        const line = this.telegraphs.get(h.uid, 'line') as THREE.Mesh;
        const sp = Math.hypot(h.vx, h.vy) || 1;
        const len = 140;
        const pts = [new THREE.Vector2(h.x - ox, h.y - oy), new THREE.Vector2(h.x - ox + (h.vx / sp) * len, h.y - oy + (h.vy / sp) * len)];
        const rb = line.userData.ribbon as Ribbon;
        rb.set(pts, 0.35 + Math.sin(this.time * 30) * 0.1, -1);
        (line.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.35 * Math.sin(this.time * 18);
        (line.material as THREE.MeshBasicMaterial).color.set(h.def.id === 'lavaBomb' ? '#ff5a1f' : '#ffb26b');
        v.visible = true;
        v.scale.setScalar(0.6 + 0.4 * Math.sin(this.time * 20));
      } else v.scale.setScalar(1);
      if (v.userData.trail && h.telegraph <= 0 && Math.random() < dt * 40) {
        this.additive.emit({ x: h.x - ox, y: h.y - oy, count: 1, speed: 1, life: 0.6, size: 3, sizeEnd: 0.5, color: v.userData.trail as string, color2: '#ffd166' });
        this.particles.emit({ x: h.x - ox, y: h.y - oy, count: 1, speed: 1, life: 1.4, size: 2.5, sizeEnd: 5, color: '#4a4040', alpha: 0.4 });
      }
    });
    this.hazardViews.end();
    this.telegraphs.end();
    this.collectViews.begin();
    sim.collectibles.pool.forEachAlive((c) => {
      const v = this.collectViews.get(c.uid, c.def.id);
      v.position.set(c.x - ox, c.y - oy + Math.sin(this.time * 2 + c.uid) * 0.5, 0);
      animate(v, this.time, dt);
    });
    this.collectViews.end();
  }

  private indicators(sim: FlightSim, ox: number, oy: number): Indicator[] {
    const out: Indicator[] = [];
    const b = sim.body;
    sim.traffic.pool.forEachAlive((h) => {
      const dx = h.x - b.x;
      const dy = h.y - b.y;
      const approaching = dx * (h.vx - b.vx) + dy * (h.vy - b.vy) < 0;
      const d = Math.hypot(dx, dy);
      if (d > 170 || (!approaching && h.telegraph <= 0)) return;
      out.push({ x: h.x - ox, y: h.y - oy, color: h.def.damage >= 20 ? '#ff4d4d' : '#ffb347', label: '', urgency: Math.max(0, 1 - d / 170) });
    });
    for (const d of sim.director.active) {
      if (['tornado', 'volcano', 'microburst'].includes(d.id)) out.push({ x: d.x - ox, y: b.y - oy + 10, color: d.def.color, label: d.def.icon, urgency: 0.8 });
    }
    sim.collectibles.pool.forEachAlive((c) => {
      if (c.def.rare) out.push({ x: c.x - ox, y: c.y - oy, color: c.def.color, label: '★', urgency: 0.3 });
    });
    return out;
  }

  private snapshot(sim: FlightSim, best: number): HudSnapshot {
    const L = sim.loadout;
    return {
      altitude: sim.altitude, maxAltitude: sim.maxAltitude, best: Math.max(best, sim.previousBest), climbRate: sim.climbRate,
      nextMilestone: sim.nextMilestone, zoneIndex: sim.zoneIndex,
      fuel: sim.body.fuel, maxFuel: L.maxFuel, envelope: Math.max(0, sim.envelope), maxEnvelope: L.maxEnvelope,
      basket: Math.max(0, sim.basket), maxBasket: L.maxBasket, oxygen: sim.oxygen, maxOxygen: L.maxOxygen,
      needsO2: sim.altitude > 5000, temp: sim.cabinTemp, ambient: sim.ambientTemp, wind: sim.windX * 3.6 * 2,
      ice: sim.body.ice, equipment: sim.body.equipment, heat: sim.body.heat,
      repairing: sim.repairing > 0 ? 1 - sim.repairing / sim.repairTotal : 0, materials: sim.repairMaterials, repairCost: sim.repairCost,
      tools: sim.tools.map((id) => ({ id, charges: sim.toolCharges[id] ?? 0 })), currentTool: sim.currentTool,
      rod: sim.rodTimer, shield: sim.shieldTimer,
      warnings: sim.director.active.map((d) => ({
        name: d.def.name, icon: d.def.icon, intensity: d.intensity, phase: d.phase,
        countdown: d.phase === 'warning' ? d.warnTime - d.phaseTime : d.phase === 'active' ? d.duration - d.elapsed : 0,
        counter: d.def.counter, warning: d.def.warning, color: d.def.color,
      })),
      recordBroken: sim.recordBroken, coins: sim.runCoins, time: sim.time, noFuel: sim.body.fuel <= 0, hypoxic: sim.hypoxic,
      burning: sim.burning, venting: sim.venting, pacing: sim.pacing, dying: sim.dying > 0,
    };
  }

  private handleEvents(events: SimEvent[]) {
    const sim = this.sim!;
    const st = useGame.getState();
    const ox = this.origin.x;
    const oy = this.origin.y;
    for (const e of events) {
      switch (e.type) {
        case 'hit':
          if (e.source === 'storm') {
            this.rig.addShake(0.15);
            break;
          }
          audio.play('hit');
          this.rig.addShake(0.8);
          this.overlay.add(`-${Math.round(e.amount)}`, '#ff6b6b', e.x - ox, e.y - oy, 20);
          this.particles.emit({ x: e.x - ox, y: e.y - oy, count: 18, speed: 10, life: 0.8, size: 1.4, color: e.source.includes('Bird') || e.source.includes('Geese') ? '#f1f1f1' : '#8a7a6a', gravity: 6 });
          break;
        case 'blocked':
          audio.play('shield');
          this.additive.emit({ x: e.x - ox, y: e.y - oy, count: 25, speed: 14, life: 0.5, size: 1.4, color: '#9fe3ff' });
          this.overlay.add('BLOCKED', '#9fe3ff', e.x - ox, e.y - oy, 18);
          break;
        case 'nearMiss':
          audio.play('nearMiss');
          this.overlay.add(`NEAR MISS +${e.coins}`, '#ffd166', e.x - ox, e.y - oy, 20, 1.4);
          break;
        case 'collect': {
          const x = e.x - ox;
          const y = e.y - oy;
          if (e.id === 'coin' || e.id === 'bigCoin') {
            audio.play(e.id === 'coin' ? 'coin' : 'bigCoin');
            this.overlay.add(`+${e.amount}`, '#ffd166', x, y, e.id === 'coin' ? 16 : 22, 0.9);
            this.additive.emit({ x, y, count: 10, speed: 8, life: 0.5, size: 1, color: '#ffe08a' });
          } else if (e.id === 'shard' || e.id === 'relic') {
            audio.play('shard');
            this.additive.emit({ x, y, count: 40, speed: 16, life: 1, size: 1.6, color: '#e0aaff', color2: '#00f5d4' });
            st.toast({ text: e.id === 'relic' ? 'LEGENDARY SKY RELIC!' : 'Star Shard found!', kind: 'gold', sub: e.id === 'relic' ? `+${e.amount} coins` : 'Rare currency for legendary gear' });
          } else {
            audio.play('pickup');
            const label = { fuel: '+FUEL', repair: '+2 REPAIR', oxygen: '+O₂' }[e.id as 'fuel' | 'repair' | 'oxygen'];
            this.overlay.add(label, e.id === 'fuel' ? '#ff8fab' : e.id === 'repair' ? '#7dffb2' : '#9ad9ff', x, y, 18);
            this.additive.emit({ x, y, count: 14, speed: 8, life: 0.5, size: 1, color: e.id === 'fuel' ? '#ff6b8a' : e.id === 'repair' ? '#06d6a0' : '#8ecae6' });
          }
          break;
        }
        case 'strike':
          audio.play('crack');
          setTimeout(() => audio.play('thunder'), 150 + Math.random() * 300);
          if (e.hit && e.absorbed) {
            this.overlay.add('ABSORBED +8', '#9fe3ff', e.x - ox, e.y - oy, 20);
            this.rig.addShake(0.3);
          } else if (e.hit) {
            this.rig.addShake(1.2);
            this.overlay.add('ZAP!', '#fff3b0', e.x - ox, e.y - oy, 26);
            audio.play('hit');
          }
          break;
        case 'arc':
          audio.play('arc');
          if (e.blocked) this.overlay.add('BLOCKED', '#c77dff', e.x - ox, e.y - oy, 20);
          else this.rig.addShake(1);
          this.additive.emit({ x: e.x - ox, y: e.y - oy, count: 30, speed: 18, life: 0.5, size: 1.4, color: '#e0aaff' });
          break;
        case 'warning':
          audio.play('warning');
          this.rig.addShake(0.2);
          break;
        case 'disasterStart':
          this.rig.addShake(0.4);
          break;
        case 'disasterEnd':
          audio.play('milestone');
          st.toast({ text: `Survived the ${e.disaster.def.name}!`, kind: 'good', sub: e.disaster.hitPlayer ? `+${e.coins} coins` : `Untouched! +${e.coins} coins` });
          this.celebrateUntil = this.time + 1.6;
          break;
        case 'zone': {
          const z = ZONES[e.zone];
          audio.play('zone');
          st.toast({ text: `ZONE ${z.id}: ${z.name.toUpperCase()}`, kind: 'info', big: true, sub: `${z.description} New: ${z.mechanic}.` }, 4500);
          break;
        }
        case 'milestone':
          audio.play('milestone');
          this.overlay.add(`${e.altitude.toLocaleString('en-US')} m! +${e.coins}`, '#7df9ff', sim.body.x - ox, sim.body.y - oy + 26, 24, 1.8);
          if (sim.recordBroken) st.recordAltitude(sim.maxAltitude);
          break;
        case 'record':
          if (!this.recordFxShown) {
            this.recordFxShown = true;
            audio.play('record');
            st.toast({ text: '★ NEW PERSONAL BEST ★', kind: 'gold', big: true, sub: 'Every metre from here is history!' }, 3500);
            this.celebrateUntil = this.time + 2.2;
            const x = sim.body.x - ox;
            const y = sim.body.y - oy + PHYSICS.envelopeOffsetY;
            for (const c of ['#ff6b4a', '#ffd166', '#06d6a0', '#118ab2', '#c77dff']) this.particles.emit({ x, y, count: 30, speed: 26, life: 2.2, size: 1.2, color: c, gravity: 10, drag: 1 });
            st.recordAltitude(e.altitude);
          }
          break;
        case 'tool': {
          const t = toolById(e.tool);
          audio.play(e.tool === 'shield' ? 'shield' : 'tool');
          this.overlay.add(t.name.toUpperCase(), '#ffffff', sim.body.x - ox, sim.body.y - oy + 4, 18);
          if (e.tool === 'ballast') {
            this.sandbags = Math.max(0, this.sandbags - 2);
            this.particles.emit({ x: sim.body.x - ox, y: sim.body.y - oy, count: 30, speed: 6, vy: -12, life: 1.5, size: 1.2, color: '#d9c49b', gravity: 20 });
          }
          if (e.tool === 'thruster') this.additive.emit({ x: sim.body.x - ox, y: sim.body.y - oy + 1, count: 40, speed: 10, vx: -Math.sign(sim.body.vx) * 30, life: 0.6, size: 2, color: '#ffd166', color2: '#ff4d00' });
          if (e.tool === 'deicer') this.additive.emit({ x: sim.body.x - ox, y: sim.body.y - oy + PHYSICS.envelopeOffsetY, count: 50, speed: 14, life: 0.8, size: 1.5, color: '#ffb347' });
          break;
        }
        case 'toolEmpty':
          audio.play('error');
          st.toast({ text: 'No charges left for this tool', kind: 'warn' }, 1500);
          break;
        case 'repairStart':
          audio.play('repair');
          break;
        case 'repairDone':
          audio.play('pickup');
          this.overlay.add('REPAIRED', '#7dffb2', sim.body.x - ox, sim.body.y - oy + 6, 20);
          this.additive.emit({ x: sim.body.x - ox, y: sim.body.y - oy + PHYSICS.envelopeOffsetY, count: 30, speed: 10, life: 0.7, size: 1.2, color: '#7dffb2' });
          break;
        case 'repairFail':
          audio.play('error');
          st.toast({ text: e.reason, kind: 'warn' }, 1500);
          break;
        case 'ground':
          audio.play('hit');
          this.rig.addShake(1);
          this.particles.emit({ x: sim.body.x - ox, y: sim.body.y - oy, count: 30, speed: 10, life: 1.2, size: 2.5, color: '#a08060', gravity: 4 });
          break;
        case 'alert':
          st.toast({ text: e.text, kind: e.level === 'danger' ? 'danger' : e.level === 'warn' ? 'warn' : 'info' }, 3200);
          if (e.level === 'danger') audio.play('error');
          break;
        case 'end':
          audio.play(e.reason === 'landing' ? 'landing' : 'end');
          break;
      }
    }
  }

  private applyEnvironment(alt: number, gloom: number, fog: number, visibility: number, dt: number) {
    const p = computePalette(alt, this.tod, gloom, this.palette);
    const u = this.sky.uniforms;
    u.uZenith.value.copy(p.zenith);
    u.uHorizon.value.copy(p.horizon);
    u.uGround.value.copy(p.hemiGround).lerp(p.horizon, 0.5);
    u.uSunDir.value.copy(p.sunDir);
    u.uSunColor.value.copy(p.sun);
    u.uStars.value = p.stars;
    u.uAurora.value = p.aurora;
    u.uGloom.value = gloom * 0.4;
    u.uTime.value = this.time;
    this.flash = Math.max(0, this.flash - dt * 4);
    u.uFlash.value = this.flash * 0.6;
    this.sky.mesh.position.copy(this.camera.position);
    this.hemi.color.copy(p.hemiSky);
    this.hemi.groundColor.copy(p.hemiGround);
    this.hemi.intensity = 1.1 * (0.6 + 0.4 * p.sunIntensity) + this.flash * 2.5;
    this.sun.color.copy(p.sun);
    this.sun.intensity = 2.4 * p.sunIntensity;
    this.sun.position.copy(this.camera.position).addScaledVector(p.sunDir, 300);
    this.sun.target.position.copy(this.camera.position);
    this.flashLight.intensity = this.flash * 4000;
    const f = this.scene.fog as THREE.FogExp2;
    f.color.copy(p.fog);
    f.density = (0.00085 * fog) / Math.max(0.15, visibility) * (1 - smoothstep(20000, 60000, alt) * 0.7);
    this.clouds.material.color.copy(p.cloud);
    this.clouds.material.emissive.copy(p.cloudGlow);
    this.clouds.density = p.cloudDensity * (useGame.getState().save.settings.quality === 'low' ? 0.5 : 1);
    // planet & curvature
    const pv = smoothstep(13000, 26000, alt);
    const pm = this.planet.material as THREE.MeshStandardMaterial;
    pm.opacity = pv;
    this.planet.visible = this.atmoRim.visible = pv > 0.01;
    // height above the surface grows with altitude so the horizon dips and curves more
    const h = 180 + smoothstep(13000, 160000, alt) * 1300;
    this.planet.position.set(this.camera.position.x, this.camera.position.y - 9000 - h, this.camera.position.z);
    this.planet.rotation.y = this.time * 0.004;
    this.planet.rotation.x = 0.3;
    this.stars.update(this.camera.position, p.stars, this.time);
    this.wonders.update(dt, this.time, this.camera.position.x, this.camera.position.y, alt);
    this.atmoRim.position.copy(this.planet.position);
    (this.atmoRim.material as THREE.ShaderMaterial).uniforms.uAlpha.value = pv * 0.9;
  }
}
