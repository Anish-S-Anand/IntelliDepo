"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export type SolarVariant = {
  id: string;
  name: string;
  label: string;
  summary: string;
  accent: string;
  orbitX: number;
  orbitZ: number;
  size: number;
  speed: number;
  angle: number;
  palette: string[];
  banding: "striped" | "swirl" | "marble" | "faceted";
};

type SolarSceneProps = {
  variants: SolarVariant[];
  activeId: string;
  onVariantHover: (id: string) => void;
  onPositionsUpdate?: (positions: { id: string; x: number; y: number; visible: boolean }[]) => void;
};

type PlanetRecord = {
  variant: SolarVariant;
  mesh: THREE.Mesh;
  glow: THREE.Mesh;
  orbitLine: THREE.Line;
  cloudShell?: THREE.Mesh;
  ringMesh?: THREE.Mesh;
  ringGlow?: THREE.Mesh;
};

type AuthoredTextureSet = {
  albedo?: THREE.Texture;
  normal?: THREE.Texture;
  roughness?: THREE.Texture;
  displacement?: THREE.Texture;
  emissive?: THREE.Texture;
};

type PlanetMaps = {
  color: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
};

function configureTexture(texture: THREE.Texture, color = false) {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 16;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  if (color) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  texture.needsUpdate = true;
}

function getAuthoredTextureUrls(id: string) {
  const base = `/textures/solar/${id}/${id}`;
  return {
    albedo: [`${base}_albedo.webp`, `${base}_albedo.jpg`],
    normal: [`${base}_normal.webp`, `${base}_normal.jpg`],
    roughness: [`${base}_roughness.webp`, `${base}_roughness.jpg`],
    displacement: [`${base}_displacement.webp`, `${base}_displacement.jpg`],
    emissive: [`${base}_emissive.webp`, `${base}_emissive.jpg`],
  };
}

function loadFirstAvailableTexture(
  loader: THREE.TextureLoader,
  urls: string[],
  onLoad: (texture?: THREE.Texture) => void,
  index = 0,
) {
  if (index >= urls.length) { onLoad(undefined); return; }
  loader.load(
    urls[index],
    (texture) => onLoad(texture),
    undefined,
    () => loadFirstAvailableTexture(loader, urls, onLoad, index + 1),
  );
}

function getSunTextureUrls() {
  const base = "/textures/solar/sun/sun";
  return [`${base}_albedo.webp`, `${base}_albedo.jpg`];
}

function getRingTextureUrls(id: string) {
  const base = `/textures/solar/${id}/${id}`;
  return [`${base}_ring.webp`, `${base}_ring.png`, `${base}_ring.jpg`, `${base}_ring.jpeg`, `${base}_ring.tif`, `${base}_ring.tiff`];
}

function makeRingTexture(_innerColor: string, _outerColor: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) {
    const fallback = new THREE.CanvasTexture(canvas);
    fallback.colorSpace = THREE.SRGBColorSpace;
    return fallback;
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  const gradient = context.createLinearGradient(0, 0, canvas.width, 0);
  gradient.addColorStop(0,    "rgba(0,0,0,0)");
  gradient.addColorStop(0.05, "rgba(168,158,132,0.5)");
  gradient.addColorStop(0.2,  "rgba(185,175,148,0.88)");
  gradient.addColorStop(0.5,  "rgba(192,182,155,0.92)");
  gradient.addColorStop(0.8,  "rgba(185,175,148,0.88)");
  gradient.addColorStop(0.95, "rgba(168,158,132,0.5)");
  gradient.addColorStop(1,    "rgba(0,0,0,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 1200; i++) {
    const x = Math.random() * canvas.width;
    context.fillStyle = `rgba(255,240,180,${Math.random() * 0.08})`;
    context.fillRect(x, 0, 1, canvas.height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function getVariantMaterialPreset(id: string) {
  switch (id) {
    case "stream": return { roughness: 0.9, clearcoat: 0.04, clearcoatRoughness: 0.42, bumpScale: 0.02 };
    case "depot": return { roughness: 0.94, clearcoat: 0.03, clearcoatRoughness: 0.55, bumpScale: 0.08 };
    case "cafe": return { roughness: 0.86, clearcoat: 0.08, clearcoatRoughness: 0.3, bumpScale: 0.015 };
    case "recruit": return { roughness: 0.88, clearcoat: 0.14, clearcoatRoughness: 0.38, bumpScale: 0.03 };
    default: return { roughness: 0.9, clearcoat: 0.06, clearcoatRoughness: 0.42, bumpScale: 0.03 };
  }
}

function loadAuthoredTextureSet(
  loader: THREE.TextureLoader,
  variant: SolarVariant,
  onReady: (set: AuthoredTextureSet) => void,
) {
  const urls = getAuthoredTextureUrls(variant.id);
  const result: AuthoredTextureSet = {};
  let completed = 0;
  const entries = Object.entries(urls) as Array<[keyof AuthoredTextureSet, string[]]>;
  const finish = () => { completed += 1; if (completed === entries.length) { onReady(result); } };
  entries.forEach(([key, url]) => {
    loadFirstAvailableTexture(loader, url, (texture) => {
      if (texture) { configureTexture(texture, key === "albedo" || key === "emissive"); result[key] = texture; }
      finish();
    });
  });
}

function makePlanetMaps(palette: string[], mode: SolarVariant["banding"], size = 128): PlanetMaps {
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = size; bumpCanvas.height = size;
  const context = canvas.getContext("2d");
  const bumpContext = bumpCanvas.getContext("2d");
  if (!context || !bumpContext) {
    const fallback = new THREE.CanvasTexture(canvas);
    fallback.colorSpace = THREE.SRGBColorSpace;
    return { color: fallback, bump: fallback };
  }
  const image = context.createImageData(size, size);
  const bumpImage = bumpContext.createImageData(size, size);
  const data = image.data;
  const bumpData = bumpImage.data;
  const colors = palette.map((hex) => new THREE.Color(hex));
  const samplePalette = (value: number) => {
    const scaled = value * (colors.length - 1);
    const index = Math.floor(scaled);
    const next = Math.min(colors.length - 1, index + 1);
    return colors[index].clone().lerp(colors[next], scaled - index);
  };
  const noise = (x: number, y: number) =>
    0.5 + 0.25 * Math.sin(x * 9.0 + y * 5.4) + 0.15 * Math.cos(x * 13.7 - y * 7.3) + 0.1 * Math.sin((x + y) * 22.0);
  const fbm = (x: number, y: number) => {
    let value = 0; let amplitude = 0.55; let frequency = 1;
    for (let octave = 0; octave < 5; octave += 1) {
      value += amplitude * noise(x * frequency, y * frequency);
      amplitude *= 0.5; frequency *= 1.85;
    }
    return value;
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = x / size; const ny = y / size;
      const dx = nx - 0.5; const dy = ny - 0.5;
      const longitude = nx * Math.PI * 2; const latitude = ny * Math.PI;
      const sphereX = Math.cos(longitude) * Math.sin(latitude);
      const sphereY = Math.cos(latitude);
      const sphereZ = Math.sin(longitude) * Math.sin(latitude);
      const radius = Math.sqrt(dx * dx + dy * dy);
      let pattern = 0;
      if (mode === "striped") {
        pattern = 0.5 + 0.24 * Math.sin(ny * 24 + sphereX * 8) + 0.16 * Math.sin(ny * 8 + fbm(nx * 1.4, ny * 1.8) * 4) + 0.08 * fbm(nx * 2.2, ny * 1.6);
      } else if (mode === "marble") {
        pattern = 0.5 + 0.28 * Math.sin((sphereX * 5.4 + sphereZ * 4.9) + fbm(nx * 2.3, ny * 2.1) * 7.5) + 0.14 * fbm(nx * 3.5, ny * 3.1);
      } else if (mode === "faceted") {
        pattern = 0.5 + 0.18 * Math.cos(Math.atan2(sphereZ, sphereX) * 5.4 + radius * 10) + 0.16 * Math.sin(sphereY * 10 + fbm(nx * 2.6, ny * 2.4) * 5) + 0.08 * fbm(nx * 4, ny * 4);
      } else {
        pattern = 0.5 + 0.2 * Math.sin((sphereX * 9 - sphereY * 7) + radius * 10) + 0.16 * Math.cos((sphereZ * 12 + sphereX * 3) + fbm(nx * 3.4, ny * 3.2) * 6) + 0.1 * fbm(nx * 4.1, ny * 4.3);
      }
      const craterNoise = fbm(nx * 7.2, ny * 7.2) * 0.08;
      const polarFade = 1 - Math.abs(sphereY) * 0.12;
      const shade = THREE.MathUtils.clamp((pattern + craterNoise) * polarFade, 0, 1);
      const color = samplePalette(shade);
      const grain = 0.95 + Math.random() * 0.08;
      const idx = (y * size + x) * 4;
      const luminance = Math.min(255, (shade * 0.84 + Math.random() * 0.06) * 255);
      data[idx] = Math.min(255, color.r * 255 * grain);
      data[idx + 1] = Math.min(255, color.g * 255 * grain);
      data[idx + 2] = Math.min(255, color.b * 255 * grain);
      data[idx + 3] = 255;
      bumpData[idx] = luminance; bumpData[idx + 1] = luminance; bumpData[idx + 2] = luminance; bumpData[idx + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  bumpContext.putImageData(bumpImage, 0, 0);
  const colorTexture = new THREE.CanvasTexture(canvas);
  colorTexture.wrapS = THREE.RepeatWrapping; colorTexture.wrapT = THREE.ClampToEdgeWrapping;
  colorTexture.anisotropy = 16; colorTexture.colorSpace = THREE.SRGBColorSpace;
  const bumpTexture = new THREE.CanvasTexture(bumpCanvas);
  bumpTexture.wrapS = THREE.RepeatWrapping; bumpTexture.wrapT = THREE.ClampToEdgeWrapping;
  bumpTexture.anisotropy = 16;
  return { color: colorTexture, bump: bumpTexture };
}

export function SolarScene({ variants, activeId, onVariantHover, onPositionsUpdate }: SolarSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const activeIdRef = useRef(activeId);
  const onVariantHoverRef = useRef(onVariantHover);
  const onPositionsUpdateRef = useRef(onPositionsUpdate);

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { onVariantHoverRef.current = onVariantHover; }, [onVariantHover]);
  useEffect(() => { onPositionsUpdateRef.current = onPositionsUpdate; }, [onPositionsUpdate]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = null;
    scene.fog = null;

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 2000);
    camera.position.set(28, 34, 154);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setClearColor(0x000000, 0);
    renderer.setClearAlpha(0);
    renderer.autoClear = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.72;
    renderer.shadowMap.enabled = false;
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 1.1);
    scene.add(ambient);
    const hemi = new THREE.HemisphereLight(0xb2d4ff, 0x111726, 1.4);
    scene.add(hemi);
    const sunLight = new THREE.PointLight(0xffc46e, 1200, 1200, 2);
    scene.add(sunLight);
    const fillLight = new THREE.DirectionalLight(0x8fc8ff, 2.4);
    fillLight.position.set(-90, 45, 120);
    scene.add(fillLight);
    const rimLight = new THREE.PointLight(0x6db5ff, 800, 900, 2);
    rimLight.position.set(-160, 80, -140);
    scene.add(rimLight);
    const backLight = new THREE.DirectionalLight(0xffd8a0, 1.6);
    backLight.position.set(60, -20, -180);
    scene.add(backLight);
    const cameraLight = new THREE.PointLight(0xffffff, 500, 600, 1.5);
    scene.add(cameraLight);

    const sunGeometry = new THREE.SphereGeometry(24, 48, 48);
    const sunMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        varying vec3 vPos;
        varying vec3 vNormal;
        void main() {
          vPos = position;
          vNormal = normal;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying vec3 vPos;
        varying vec3 vNormal;
        uniform float uTime;

        float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
        float noise3(vec3 p) {
          vec3 i = floor(p); vec3 f = fract(p);
          vec3 u = f*f*(3.0-2.0*f);
          return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),u.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),u.x),u.y),
                     mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),u.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),u.x),u.y),u.z);
        }
        float fbm3(vec3 p) {
          float v=0.0; float a=0.55;
          for(int i=0;i<4;i++){v+=a*noise3(p);p=p*1.85+vec3(0.34,0.21,0.57);a*=0.52;}
          return v;
        }
        void main() {
          vec3 n = normalize(vPos);
          float t = uTime * 0.18;
          vec3 p = n * 4.5 + vec3(t*1.2, -t*0.8, t*0.5);
          float swirlA = fbm3(p);
          float swirlB = fbm3(p * 1.6 - vec3(t*0.9, t*1.1, -t*0.6));
          float cell   = fbm3(n * 7.0 + vec3(t*0.4));
          float plasma  = smoothstep(0.18, 1.08, swirlA*0.72 + swirlB*0.52 + cell*0.36);
          float rim     = pow(1.0 - max(dot(n, vec3(0.0,0.0,1.0)), 0.0), 0.55);
          vec3 deep     = vec3(0.55,0.08,0.01);
          vec3 mid      = vec3(0.96,0.34,0.05);
          vec3 bright   = vec3(1.0,0.72,0.18);
          vec3 whiteHot = vec3(1.0,0.95,0.78);
          vec3 color = mix(deep, mid, plasma);
          color = mix(color, bright, rim * 0.72);
          color += bright * pow(plasma, 2.2) * 0.38;
          color += whiteHot * pow(max(1.0 - length(n.xy), 0.0), 2.2) * 0.45;
          color += vec3(1.0,0.58,0.12) * pow(max(swirlB,0.0), 3.0) * 0.12;
          gl_FragColor = vec4(color, 1.0);
        }`,
    });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.renderOrder = 0;
    scene.add(sun);

    const sunDetailMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(0xfff2d6) });
    const sunDetail = new THREE.Mesh(new THREE.SphereGeometry(24.6, 48, 48), sunDetailMaterial);
    scene.add(sunDetail);
    const sunTextureLoader = new THREE.TextureLoader();
    loadFirstAvailableTexture(sunTextureLoader, getSunTextureUrls(), (texture) => {
      if (!texture) return;
      configureTexture(texture, true);
      sunDetailMaterial.map = texture; sunDetailMaterial.opacity = 0.4; sunDetailMaterial.needsUpdate = true;
    });

    const corona = new THREE.Mesh(new THREE.SphereGeometry(31.5, 32, 32), new THREE.ShaderMaterial({
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec3 vNormal; varying vec3 vWorldPosition; void main() { vNormal=normalize(normalMatrix*normal); vec4 wp=modelMatrix*vec4(position,1.0); vWorldPosition=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
      fragmentShader: `varying vec3 vNormal; varying vec3 vWorldPosition; uniform float uTime; void main() { vec3 vd=normalize(cameraPosition-vWorldPosition); float f=pow(1.0-max(dot(vNormal,vd),0.0),2.35); float p=0.72+sin(uTime*1.7)*0.1; vec3 color=mix(vec3(1.0,0.42,0.08),vec3(1.0,0.84,0.34),f)*f*p; gl_FragColor=vec4(color,f*0.12); }`,
    }));
    scene.add(corona);
    corona.renderOrder = 3;

    const outerCorona = new THREE.Mesh(new THREE.SphereGeometry(37, 32, 32), new THREE.ShaderMaterial({
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec3 vNormal; varying vec3 vWorldPosition; void main() { vNormal=normalize(normalMatrix*normal); vec4 wp=modelMatrix*vec4(position,1.0); vWorldPosition=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
      fragmentShader: `varying vec3 vNormal; varying vec3 vWorldPosition; uniform float uTime; void main() { vec3 vd=normalize(cameraPosition-vWorldPosition); float f=pow(1.0-max(dot(vNormal,vd),0.0),3.2); float p=0.62+sin(uTime*1.05)*0.08; vec3 color=mix(vec3(1.0,0.28,0.08),vec3(1.0,0.74,0.28),f)*f*p; gl_FragColor=vec4(color,f*0.03); }`,
    }));
    scene.add(outerCorona);
    outerCorona.renderOrder = 4;

    const orbitMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });

    const records: PlanetRecord[] = variants.map((variant) => {
      const maps = makePlanetMaps(variant.palette, variant.banding);
      const preset = getVariantMaterialPreset(variant.id);
      const planetRadius = variant.size * 0.42;
      const geometry = new THREE.SphereGeometry(planetRadius, 48, 48);
      const material = new THREE.MeshPhysicalMaterial({
        map: maps.color,
        bumpMap: maps.bump,
        bumpScale: preset.bumpScale,
        roughnessMap: maps.bump,
        roughness: preset.roughness,
        metalness: 0.01,
        clearcoat: preset.clearcoat,
        clearcoatRoughness: preset.clearcoatRoughness,
        emissive: new THREE.Color(variant.accent),
        emissiveIntensity: 0.22,
        transparent: true,
        opacity: 0,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.id = variant.id;
      mesh.userData.ready = false;
      mesh.castShadow = false; mesh.receiveShadow = false;
      mesh.renderOrder = 1;
      mesh.visible = true;
      scene.add(mesh);

      const glow = new THREE.Mesh(new THREE.SphereGeometry(planetRadius * 1.16, 32, 32), new THREE.ShaderMaterial({
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,        uniforms: { uColor: { value: new THREE.Color(variant.accent) } },
        vertexShader: `varying vec3 vNormal; varying vec3 vWorldPosition; void main() { vNormal=normalize(normalMatrix*normal); vec4 wp=modelMatrix*vec4(position,1.0); vWorldPosition=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
        fragmentShader: `varying vec3 vNormal; varying vec3 vWorldPosition; uniform vec3 uColor; void main() { vec3 vd=normalize(cameraPosition-vWorldPosition); float f=pow(1.0-max(dot(vNormal,vd),0.0),2.2); gl_FragColor=vec4(uColor*f,f*0.18); }`,
      }));
      glow.renderOrder = 2;
      scene.add(glow);

      let cloudShell: THREE.Mesh | undefined;
      let ringMesh: THREE.Mesh | undefined;
      let ringGlow: THREE.Mesh | undefined;

      if (variant.id === "recruit") {
        const cloudMaterial = new THREE.MeshPhongMaterial({ transparent: true, opacity: 0, depthWrite: false, blending: THREE.NormalBlending, color: new THREE.Color(0xffffff), shininess: 18 });
        cloudShell = new THREE.Mesh(new THREE.SphereGeometry(planetRadius * 1.018, 48, 48), cloudMaterial);
        scene.add(cloudShell);
      }

      if (variant.id === "cafe") {
        const ringTexture = makeRingTexture("rgba(220,190,120,0.9)", "rgba(255,240,190,1.0)");
        ringMesh = new THREE.Mesh(new THREE.RingGeometry(planetRadius * 1.35, planetRadius * 1.75, 64), new THREE.MeshBasicMaterial({ map: ringTexture, alphaMap: ringTexture, transparent: true, opacity: 0.88, side: THREE.DoubleSide, depthWrite: false, color: new THREE.Color(0xd8d0b8) }));
        ringMesh.rotation.x = Math.PI / 2.1; ringMesh.rotation.z = 0.08;
        ringMesh.renderOrder = 2;
        scene.add(ringMesh);
        ringGlow = new THREE.Mesh(new THREE.RingGeometry(planetRadius * 1.33, planetRadius * 1.78, 64), new THREE.MeshBasicMaterial({ map: ringTexture, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(0xc8c0a8) }));
        ringGlow.rotation.x = Math.PI / 2.1; ringGlow.rotation.z = 0.08;
        ringGlow.renderOrder = 2;
        ringMesh.visible = false;
        ringGlow.visible = false;
        scene.add(ringGlow);
      }

      const curve = new THREE.EllipseCurve(0, 0, variant.orbitX, variant.orbitZ, 0, Math.PI * 2, false, 0);      const points = curve.getPoints(256).map((p) => new THREE.Vector3(p.x, 0, p.y));
      const orbitLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), orbitMaterial);
      orbitLine.rotation.x = Math.PI / 2;
      scene.add(orbitLine);

      const textureLoader = new THREE.TextureLoader();
      loadAuthoredTextureSet(textureLoader, variant, (authored) => {
        if (authored.albedo) {
          material.map = authored.albedo;
          material.color.set(0xffffff);
          material.bumpMap = null; material.roughnessMap = null;
          material.roughness = preset.roughness; material.clearcoat = preset.clearcoat;
          material.clearcoatRoughness = preset.clearcoatRoughness;
          material.emissive = new THREE.Color(variant.accent);
          material.emissiveIntensity = 0.08;
        }
        if (authored.normal) { material.normalMap = authored.normal; material.normalScale = new THREE.Vector2(variant.id === "recruit" ? 1.15 : 0.65, variant.id === "recruit" ? 1.15 : 0.65); }
        if (authored.roughness) {
          if (variant.id === "recruit") { material.metalness = 0.08; material.clearcoat = 1; material.clearcoatRoughness = 0.12; material.roughness = 0.72; }
          else { material.roughnessMap = authored.roughness; material.roughness = 0.95; }
        }
        if (authored.displacement) { material.displacementMap = authored.displacement; material.displacementScale = 0.05; material.bumpMap = authored.displacement; material.bumpScale = Math.max(preset.bumpScale, 0.06); }
        if (authored.emissive) {
          if (variant.id === "recruit" && cloudShell) {
            const cm = cloudShell.material as THREE.MeshPhongMaterial;
            cm.map = authored.emissive; cm.opacity = 0.18; cm.needsUpdate = true;
          } else {
            material.emissiveMap = authored.emissive;
            material.emissive = new THREE.Color(variant.accent);
            material.emissiveIntensity = 0.08;
          }
        }
        material.needsUpdate = true;
        // Fade in
        let opacity = 0;
        const fadeIn = () => {
          opacity = Math.min(1, opacity + 0.04);
          material.opacity = opacity;
          if (opacity < 1) requestAnimationFrame(fadeIn);
          else { material.transparent = false; material.needsUpdate = true; mesh.userData.ready = true; }
        };
        requestAnimationFrame(fadeIn);
        if (ringMesh) { ringMesh.visible = true; }
        if (ringGlow) { ringGlow.visible = true; }      });

      return { variant, mesh, glow, orbitLine, cloudShell, ringMesh, ringGlow };
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(9999, 9999);
    let hoveredId = "";

    const setHover = (id: string) => { if (hoveredId !== id) { hoveredId = id; onVariantHoverRef.current(id); } };
    const updatePointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };
    const handlePointerMove = (event: PointerEvent) => { updatePointer(event); };
    const handlePointerLeave = () => { pointer.set(9999, 9999); setHover(""); };
    const handleClick = () => { if (hoveredId) { onVariantHoverRef.current(hoveredId); } };

    const resize = () => {
      const width = mount.clientWidth; const height = mount.clientHeight;
      camera.aspect = width / height; camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    resize();
    window.addEventListener("resize", resize);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);
    renderer.domElement.addEventListener("click", handleClick);

    const clock = new THREE.Clock();
    const animate = () => {
      const time = clock.getElapsedTime();
      sun.rotation.y = time * 0.12;
      sunDetail.rotation.y = time * 0.165;
      corona.rotation.y = -time * 0.08;
      outerCorona.rotation.y = time * 0.05;
      (sunMaterial.uniforms.uTime.value as number) = time;
      ((corona.material as THREE.ShaderMaterial).uniforms.uTime.value as number) = time;
      ((outerCorona.material as THREE.ShaderMaterial).uniforms.uTime.value as number) = time;

      camera.position.x = 28 + Math.sin(time * 0.06) * 6;
      camera.position.y = 34 + Math.cos(time * 0.05) * 2.2;
      camera.position.z = 210 + Math.sin(time * 0.035) * 5;
      camera.lookAt(4, 0.5, -2);
      cameraLight.position.copy(camera.position);

      records.forEach((record, index) => {
        const theta = time * record.variant.speed + record.variant.angle;
        const x = Math.cos(theta) * record.variant.orbitX;
        const z = Math.sin(theta) * record.variant.orbitZ;
        const y = 0;
        record.mesh.position.set(x, y, z);
        record.glow.position.copy(record.mesh.position);
        if (record.cloudShell) { record.cloudShell.position.copy(record.mesh.position); record.cloudShell.rotation.y += 0.0038; record.cloudShell.rotation.x = record.mesh.rotation.x; }
        if (record.ringMesh) {
          record.ringMesh.position.copy(record.mesh.position);
          // Keep ring orientation fixed in world space — don't rotate with planet
        }
        if (record.ringGlow) {
          record.ringGlow.position.copy(record.mesh.position);
        }
        record.mesh.rotation.y += 0.0025 + index * 0.0003;
        record.mesh.rotation.x += 0.0009;
        const isActive = record.variant.id === hoveredId;
        const scale = isActive ? 1.18 : 1;
        record.mesh.scale.setScalar(scale);
        record.glow.scale.setScalar(isActive ? 1.35 : 1.0);
        record.cloudShell?.scale.setScalar(scale * 1.004);
        record.ringMesh?.scale.setScalar(isActive ? 1.18 : 1);
        record.ringGlow?.scale.setScalar(isActive ? 1.18 : 1);
        (record.glow.material as THREE.ShaderMaterial).opacity = isActive ? 0.7 : 0;
        if (record.ringGlow) { (record.ringGlow.material as THREE.MeshBasicMaterial).opacity = isActive ? 0.95 : 0.75; }
        // Pulse emissive on hover
        const mat = record.mesh.material as THREE.MeshPhysicalMaterial;
        if (mat.emissive) {
          mat.emissiveIntensity = isActive ? 0.45 : 0.08;
        }        (record.orbitLine.material as THREE.LineBasicMaterial).opacity = 0;
      });

      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(records.map((r) => r.mesh), false);
      if (intersects[0]) { setHover(intersects[0].object.userData.id as string); renderer.domElement.style.cursor = "pointer"; }
      else { setHover(""); renderer.domElement.style.cursor = "default"; }

      // Emit screen positions for labels
      if (onPositionsUpdateRef.current) {
        const w = mount.clientWidth; const h = mount.clientHeight;
        const sunPos = new THREE.Vector3(0, 0, 0).project(camera);
        const positions = [
          { id: "sun", x: (sunPos.x * 0.5 + 0.5) * w, y: (-sunPos.y * 0.5 + 0.5) * h, visible: true },
          ...records.map((r) => {
            const p = r.mesh.position.clone().project(camera);
            const planetRadius = r.variant.size * 0.42;
            const topEdge = r.mesh.position.clone();
            topEdge.y -= planetRadius;
            const bottomProj = topEdge.project(camera);
            // p.z > 0 means behind camera, check if behind sun by comparing distance to origin
            const distToSun = r.mesh.position.length();
            const behindSun = p.z > 0.98 || (r.mesh.position.z < 0 && distToSun < 30);
            return {
              id: r.variant.id,
              x: (p.x * 0.5 + 0.5) * w,
              y: (-bottomProj.y * 0.5 + 0.5) * h,
              visible: r.mesh.userData.ready === true && !behindSun,
              depth: p.z,
            };
          }),
        ];
        onPositionsUpdateRef.current(positions);
      }

      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };

    let frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      renderer.domElement.removeEventListener("click", handleClick);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      scene.clear();
    };
  }, [variants]);

  return <div ref={mountRef} className="absolute inset-0" />;
}
