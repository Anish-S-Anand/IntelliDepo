"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface ZoneData {
  code: string;
  name: string;
  utilizationPct: number;
  status: string;
  currentOccupancy: number;
  maxCapacity: number;
}

interface Warehouse3DMapProps {
  zones: ZoneData[];
  onZoneClick?: (code: string) => void;
  selectedZone?: string | null;
  flashedZones?: Set<string>;
}

const ZONE_LAYOUT: Record<string, { x: number; z: number; w: number; d: number }> = {
  A: { x: -9, z: -6, w: 7, d: 5 },
  B: { x:  2, z: -6, w: 7, d: 5 },
  C: { x: -9, z:  1, w: 7, d: 5 },
  D: { x:  2, z:  1, w: 7, d: 5 },
};

const ZONE_LABELS: Record<string, string> = {
  A: "UltraTech Cement",
  B: "ACC Cement",
  C: "JSW Cement",
  D: "Ambuja Cement",
};

function getZoneColor(status: string, utilPct: number): number {
  if (status === "critical" || utilPct >= 90) return 0xF04A4A;
  if (status === "warning"  || utilPct >= 75) return 0xF5A623;
  if (utilPct >= 40)                          return 0x22D3A1;
  return 0x5B9BF5;
}

function getStatusLabel(utilPct: number): string {
  if (utilPct >= 90) return "NEAR FULL";
  if (utilPct >= 75) return "MEDIUM";
  if (utilPct >= 40) return "NORMAL";
  return "LOW STOCK";
}

export default function Warehouse3DMap({ zones, onZoneClick, selectedZone, flashedZones }: Warehouse3DMapProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const W = mount.clientWidth;
    const H = mount.clientHeight || 420;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0e1a);
    scene.fog = new THREE.Fog(0x0a0e1a, 30, 60);

    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    camera.position.set(0, 20, 16);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0x4488ff, 0.3);
    fillLight.position.set(-10, 5, -10);
    scene.add(fillLight);

    // Floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 18),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Grid
    const grid = new THREE.GridHelper(26, 26, 0x1e2f50, 0x1e2f50);
    (grid.material as THREE.Material).opacity = 0.4;
    (grid.material as THREE.Material).transparent = true;
    scene.add(grid);

    // Warehouse outline
    const wallPoints = [
      new THREE.Vector3(-12, 0, -8), new THREE.Vector3(12, 0, -8),
      new THREE.Vector3(12, 0, 8),   new THREE.Vector3(-12, 0, 8),
      new THREE.Vector3(-12, 0, -8),
    ];
    scene.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(wallPoints),
      new THREE.LineBasicMaterial({ color: 0x1e2f50 })
    ));

    // Zone meshes
    const zoneMeshes: THREE.Mesh[] = [];
    const zoneMap = new Map(zones.map((z) => [z.code, z]));

    Object.entries(ZONE_LAYOUT).forEach(([code, layout]) => {
      const zoneData = zoneMap.get(code);
      const utilPct = zoneData?.utilizationPct ?? 50;
      const status = zoneData?.status ?? "normal";
      const color = getZoneColor(status, utilPct);
      const isSelected = selectedZone === code;
      const isFlashed = flashedZones?.has(code) ?? false;
      const stackH = 0.3 + (utilPct / 100) * 2.5;
      const cx = layout.x + layout.w / 2;
      const cz = layout.z + layout.d / 2;

      // Base slab
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(layout.w, 0.15, layout.d),
        new THREE.MeshStandardMaterial({ color: 0x14203a, roughness: 0.8 })
      );
      base.position.set(cx, 0.075, cz);
      base.receiveShadow = true;
      scene.add(base);

      // Stack
      const stackGeo = new THREE.BoxGeometry(layout.w - 0.3, stackH, layout.d - 0.3);
      const stack = new THREE.Mesh(stackGeo, new THREE.MeshStandardMaterial({
        color,
        roughness: 0.6,
        metalness: 0.1,
        emissive: new THREE.Color(color),
        emissiveIntensity: isFlashed ? 0.8 : isSelected ? 0.3 : 0.08,
      }));
      stack.position.set(cx, 0.15 + stackH / 2, cz);
      stack.castShadow = true;
      stack.userData = { code };
      scene.add(stack);
      zoneMeshes.push(stack);

      // Selection outline
      if (isSelected) {
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(stackGeo),
          new THREE.LineBasicMaterial({ color: 0xe5521a, linewidth: 2 })
        );
        edges.position.copy(stack.position);
        scene.add(edges);
      }

      // Top glow
      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(layout.w - 0.2, layout.d - 0.2),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.15, side: THREE.DoubleSide })
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(cx, 0.15 + stackH + 0.01, cz);
      scene.add(glow);

      // Label sprite
      const canvas = document.createElement("canvas");
      canvas.width = 256; canvas.height = 128;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, 256, 128);
      ctx.fillStyle = "rgba(10,14,26,0.85)";
      ctx.roundRect(4, 4, 248, 120, 12);
      ctx.fill();
      ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
      ctx.font = "bold 22px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(ZONE_LABELS[code] ?? `Zone ${code}`, 128, 38);
      ctx.fillStyle = "#e8edf8";
      ctx.font = "bold 28px sans-serif";
      ctx.fillText(`${utilPct}%`, 128, 72);
      ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
      ctx.font = "bold 18px sans-serif";
      ctx.fillText(getStatusLabel(utilPct), 128, 108);      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
      sprite.position.set(cx, 0.15 + stackH + 1.8, cz);
      sprite.scale.set(3.5, 1.75, 1);
      scene.add(sprite);
    });

    // Gate labels
    const addGateLabel = (text: string, x: number, z: number) => {
      const canvas = document.createElement("canvas");
      canvas.width = 256; canvas.height = 48;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "rgba(30,47,80,0.9)";
      ctx.roundRect(0, 0, 256, 48, 8);
      ctx.fill();
      ctx.fillStyle = "#4e6090";
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(text, 128, 32);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
      sprite.position.set(x, 0.5, z);
      sprite.scale.set(4, 0.75, 1);
      scene.add(sprite);
    };
    addGateLabel("NORTH GATE — ENTRY", 0, -8.5);
    addGateLabel("SOUTH GATE — EXIT", 0, 8.5);

    // Click handler
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const handleClick = (e: MouseEvent) => {
      const rect = mount.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(zoneMeshes);
      if (hits.length > 0) onZoneClick?.(hits[0].object.userData.code);
    };
    mount.addEventListener("click", handleClick);

    // Auto-rotate
    let angle = 0;
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      angle += 0.002;
      camera.position.x = Math.sin(angle) * 18;
      camera.position.z = Math.cos(angle) * 18;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const handleResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight || 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", handleResize);
      mount.removeEventListener("click", handleClick);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [zones, selectedZone, onZoneClick, flashedZones]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-[#1E2F50]" style={{ height: 420 }}>
      <div ref={mountRef} className="w-full h-full" />
      <div className="absolute bottom-3 left-3 flex gap-2 flex-wrap">
        {[
          { label: "Near Full", color: "#F04A4A" },
          { label: "Medium",    color: "#F5A623" },
          { label: "Normal",    color: "#22D3A1" },
          { label: "Low Stock", color: "#5B9BF5" },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold"
            style={{ background: "rgba(10,14,26,0.85)", color: l.color, border: `1px solid ${l.color}40` }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
