import * as THREE from 'three';

const vert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
  gl_Position.z = gl_Position.w; // always behind everything
}`;

const frag = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uStars;
uniform float uTime;
uniform float uGloom;
uniform float uAurora;
uniform float uFlash;
varying vec3 vDir;


void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.55));
  col = mix(col, uGround, smoothstep(0.0, -0.25, h));
  // sun disc and glow
  float s = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunColor * (pow(s, 600.0) * 3.0 + pow(s, 12.0) * 0.35 + pow(s, 3.0) * 0.12);
  // aurora ribbons for the fantastical heights
  if (uAurora > 0.0) {
    float band = sin(d.x * 6.0 + uTime * 0.15 + sin(d.z * 4.0 + uTime * 0.1) * 2.0);
    float a = smoothstep(0.2, 0.9, band) * smoothstep(0.05, 0.35, h) * smoothstep(0.9, 0.4, h);
    col += mix(vec3(0.1, 1.0, 0.7), vec3(0.7, 0.3, 1.0), 0.5 + 0.5 * sin(d.z * 3.0 + uTime * 0.2)) * a * uAurora * 0.45;
  }
  col = mix(col, col * vec3(0.32, 0.34, 0.42), uGloom);
  col += vec3(0.85, 0.9, 1.0) * uFlash;
  gl_FragColor = vec4(col, 1.0);
}`;

export class Sky {
  readonly mesh: THREE.Mesh;
  readonly uniforms = {
    uZenith: { value: new THREE.Color('#3f8fe6') },
    uHorizon: { value: new THREE.Color('#bfe6ff') },
    uGround: { value: new THREE.Color('#6d8f6a') },
    uSunDir: { value: new THREE.Vector3(0.4, 0.5, -0.6) },
    uSunColor: { value: new THREE.Color('#fff2cc') },
    uStars: { value: 0 },
    uTime: { value: 0 },
    uGloom: { value: 0 },
    uAurora: { value: 0 },
    uFlash: { value: 0 },
  };
  constructor() {
    const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24), mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
  }
}
