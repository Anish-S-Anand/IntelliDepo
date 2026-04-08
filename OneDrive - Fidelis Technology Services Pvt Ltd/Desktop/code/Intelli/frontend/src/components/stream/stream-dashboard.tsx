"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useAnimationFrame } from "framer-motion";

type Star = {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  duration: number;
  color: string;
};

type Planet = {
  name: string;
  desc: string;
  href: string;
  size: number;
  angleOffset: number;
  orbitX: number;
  orbitY: number;
  planet: string;
  texture: string;
  shade: string;
  glow: string;
  ring?: string;
};

const planets: Planet[] = [
  {
    name: "Intelli Stream",
    desc: "CFO intelligence and financial analytics",
    href: "/stream",
    size: 96,
    angleOffset: 0,
    orbitX: 210,
    orbitY: 82,
    planet:
      "radial-gradient(circle at 32% 28%, #f6f4ea 0%, #b7b1a3 14%, #8b826f 32%, #5d564c 58%, #262118 100%)",
    texture:
      "repeating-linear-gradient(168deg, rgba(255,255,255,0.14) 0 7px, rgba(94,85,70,0.16) 7px 18px, rgba(29,25,20,0.26) 18px 28px)",
    shade: "radial-gradient(circle at 74% 70%, rgba(8,6,2,0.78), transparent 56%)",
    glow: "0 0 26px rgba(214,198,162,0.24), 0 0 80px rgba(120,101,68,0.16)",
  },
  {
    name: "Intelli Depot",
    desc: "AI powered warehouse and logistics",
    href: "/stream",
    size: 120,
    angleOffset: Math.PI / 2,
    orbitX: 320,
    orbitY: 110,
    planet:
      "radial-gradient(circle at 34% 26%, #d9f9ff 0%, #95dceb 18%, #43b9ce 38%, #157286 68%, #071e29 100%)",
    texture:
      "repeating-linear-gradient(152deg, rgba(214,252,255,0.18) 0 9px, rgba(41,132,148,0.14) 9px 20px, rgba(8,44,55,0.24) 20px 30px)",
    shade: "radial-gradient(circle at 74% 72%, rgba(0,13,20,0.8), transparent 56%)",
    glow: "0 0 32px rgba(112,225,255,0.26), 0 0 92px rgba(50,152,184,0.14)",
    ring: "rgba(201,244,255,0.52)",
  },
  {
    name: "Intelli Cafe",
    desc: "Smart hospitality management",
    href: "/stream",
    size: 98,
    angleOffset: Math.PI,
    orbitX: 430,
    orbitY: 138,
    planet:
      "radial-gradient(circle at 35% 24%, #f0fbff 0%, #8bc4ff 15%, #3076d4 34%, #174892 60%, #081733 100%)",
    texture:
      "radial-gradient(circle at 58% 36%, rgba(255,255,255,0.34), transparent 18%), radial-gradient(circle at 42% 68%, rgba(96,188,103,0.28), transparent 18%), radial-gradient(circle at 26% 48%, rgba(115,185,88,0.22), transparent 16%), radial-gradient(circle at 68% 58%, rgba(225,198,154,0.2), transparent 16%), repeating-linear-gradient(156deg, rgba(255,255,255,0.1) 0 6px, rgba(10,37,93,0.12) 6px 16px, rgba(4,14,37,0.22) 16px 24px)",
    shade: "radial-gradient(circle at 74% 72%, rgba(1,10,25,0.8), transparent 56%)",
    glow: "0 0 28px rgba(113,177,255,0.25), 0 0 85px rgba(34,102,184,0.14)",
  },
  {
    name: "Intelli Recruit",
    desc: "AI driven talent intelligence",
    href: "/stream",
    size: 112,
    angleOffset: (Math.PI * 3) / 2,
    orbitX: 545,
    orbitY: 168,
    planet:
      "radial-gradient(circle at 34% 24%, #d9f6ff 0%, #87c8ff 14%, #4f7be0 34%, #1c3775 58%, #081127 100%)",
    texture:
      "repeating-linear-gradient(176deg, rgba(224,246,255,0.22) 0 8px, rgba(118,176,255,0.12) 8px 18px, rgba(11,28,69,0.24) 18px 28px)",
    shade: "radial-gradient(circle at 74% 72%, rgba(2,10,26,0.82), transparent 56%)",
    glow: "0 0 30px rgba(113,170,255,0.24), 0 0 96px rgba(39,90,188,0.14)",
    ring: "rgba(196,224,255,0.42)",
  },
];

function makeStars(count: number, sizeMin: number, sizeMax: number): Star[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * (sizeMax - sizeMin) + sizeMin,
    opacity: Math.random() * 0.65 + 0.15,
    duration: Math.random() * 5 + 2,
    color: Math.random() > 0.88 ? (Math.random() > 0.5 ? "#ffe2a8" : "#a6d6ff") : "#ffffff",
  }));
}

function getOrbitPoint(angle: number, radiusX: number, radiusY: number) {
  const tilt = (-16 * Math.PI) / 180;
  const rawX = Math.cos(angle) * radiusX;
  const rawY = Math.sin(angle) * radiusY;

  return {
    x: rawX * Math.cos(tilt) - rawY * Math.sin(tilt),
    y: rawX * Math.sin(tilt) + rawY * Math.cos(tilt),
  };
}

export function StreamDashboard() {
  const [stars, setStars] = useState<Star[]>([]);
  const [orbitAngle, setOrbitAngle] = useState(0);
  const orbitState = useRef({
    active: false,
    lastX: 0,
    angle: 0,
    velocity: 0.00012,
  });

  useEffect(() => {
    setStars([
      ...makeStars(560, 0.35, 1.5),
      ...makeStars(130, 1.4, 3.2),
    ]);
  }, []);

  useAnimationFrame((_, delta) => {
    orbitState.current.angle += orbitState.current.velocity * delta;
    orbitState.current.velocity *= orbitState.current.active ? 0.992 : 0.998;

    if (!orbitState.current.active && Math.abs(orbitState.current.velocity) < 0.00006) {
      orbitState.current.velocity = 0.00006;
    }

    setOrbitAngle(orbitState.current.angle);
  });

  const handlePointerDown = (clientX: number) => {
    orbitState.current.active = true;
    orbitState.current.lastX = clientX;
  };

  const handlePointerMove = (clientX: number) => {
    if (!orbitState.current.active) {
      return;
    }

    const delta = clientX - orbitState.current.lastX;
    orbitState.current.lastX = clientX;
    orbitState.current.angle += delta * 0.004;
    orbitState.current.velocity = delta * 0.000014;
    setOrbitAngle(orbitState.current.angle);
  };

  const handlePointerUp = () => {
    orbitState.current.active = false;
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[#04070c] text-white"
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            "radial-gradient(ellipse 50% 24% at 50% 88%, rgba(235,104,132,0.22), transparent 60%)",
            "radial-gradient(ellipse 45% 30% at 52% 50%, rgba(82,120,255,0.10), transparent 70%)",
            "radial-gradient(ellipse 26% 18% at 62% 24%, rgba(113,169,255,0.12), transparent 68%)",
            "radial-gradient(ellipse 22% 16% at 38% 18%, rgba(84,133,255,0.10), transparent 68%)",
            "linear-gradient(180deg, #02040a 0%, #04070e 52%, #05060b 100%)",
          ].join(", "),
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-85"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(255,146,46,0.16), transparent 14%), radial-gradient(circle at 50% 52%, rgba(255,86,0,0.08), transparent 24%)",
        }}
      />

      {stars.map((star) => (
        <motion.div
          key={`${star.id}-${star.size}`}
          animate={{ opacity: [star.opacity, star.opacity * 0.16, star.opacity] }}
          transition={{ duration: star.duration, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute rounded-full"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
            background: star.color,
            boxShadow: `0 0 ${star.size * 3.5}px ${star.color}`,
          }}
        />
      ))}

      <motion.nav
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="absolute left-0 right-0 top-0 z-50 flex items-center justify-between px-6 py-5 md:px-10"
      >
        <div className="flex items-center gap-3">
          <img src="/fidelis-logo.png" alt="Fidelis" className="h-10 w-10 object-contain" />
          <div>
            <p className="text-2xl font-semibold text-white">Intelli</p>
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/36">by Fidelis</p>
          </div>
        </div>
        <Link
          href="/stream"
          className="rounded-full border border-white/15 bg-white/5 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Explore
        </Link>
      </motion.nav>

      <div
        className="relative z-20 flex min-h-screen items-center justify-center overflow-hidden"
        onPointerDown={(event) => handlePointerDown(event.clientX)}
        onPointerMove={(event) => handlePointerMove(event.clientX)}
        onPointerLeave={handlePointerUp}
      >
        <div className="pointer-events-none absolute inset-0">
          <svg className="h-full w-full" viewBox="0 0 1600 900" preserveAspectRatio="none">
            {[220, 330, 445, 560].map((radiusX, index) => (
              <g key={radiusX} transform="rotate(-16 800 450)">
                <ellipse
                  cx="800"
                  cy="450"
                  rx={radiusX}
                  ry={82 + index * 28}
                  fill="none"
                  stroke="rgba(255,255,255,0.14)"
                  strokeWidth="1.25"
                />
                <ellipse
                  cx="800"
                  cy="450"
                  rx={radiusX}
                  ry={82 + index * 28}
                  fill="none"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="4"
                  strokeDasharray="2 18"
                />
              </g>
            ))}
          </svg>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.84 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="absolute left-1/2 top-1/2 z-10"
          style={{ width: 265, height: 265, marginLeft: -132.5, marginTop: -132.5 }}
        >
          <motion.div
            animate={{ scale: [1, 1.08, 1], opacity: [0.36, 0.62, 0.36] }}
            transition={{ duration: 4.4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute left-1/2 top-1/2 rounded-full"
            style={{
              width: 680,
              height: 680,
              marginLeft: -340,
              marginTop: -340,
              background:
                "radial-gradient(circle, rgba(255,167,72,0.34), rgba(255,96,0,0.16) 34%, transparent 62%)",
              filter: "blur(10px)",
            }}
          />
          <motion.div
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 overflow-hidden rounded-full"
            style={{
              background:
                "radial-gradient(circle at 50% 48%, #fff6d1 0%, #ffd15f 8%, #ff991f 24%, #ff5d00 48%, #a61f00 76%, #240400 100%)",
              boxShadow:
                "0 0 58px rgba(255,153,52,0.95), 0 0 150px rgba(255,102,0,0.44), 0 0 250px rgba(255,82,0,0.18)",
            }}
          >
            <div className="absolute inset-0 bg-[repeating-conic-gradient(from_0deg,rgba(255,246,205,0.22)_0deg,rgba(255,246,205,0.02)_8deg,rgba(255,100,0,0.16)_18deg,rgba(112,22,0,0.24)_28deg)]" />
            <div className="absolute inset-[7%] rounded-full bg-[radial-gradient(circle_at_36%_28%,rgba(255,255,255,0.92),rgba(255,225,144,0.24)_12%,transparent_24%),radial-gradient(circle_at_58%_62%,rgba(105,18,0,0.58),transparent_16%),radial-gradient(circle_at_48%_34%,rgba(77,10,0,0.42),transparent_18%),radial-gradient(circle_at_26%_60%,rgba(160,40,0,0.45),transparent_16%)]" />
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_72%_68%,rgba(36,2,0,0.44),transparent_34%)]" />
          </motion.div>
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="text-center">
              <p className="text-[34px] font-black tracking-[0.22em] text-[#fff0d0] drop-shadow-[0_0_18px_rgba(255,177,84,0.5)]">
                INTELLI
              </p>
              <p className="mt-2 text-[10px] tracking-[0.48em] text-[#ffd49b]/74">THE UNIVERSE</p>
            </div>
          </div>
        </motion.div>

        {planets.map((planet, index) => {
          const angle = orbitAngle + planet.angleOffset;
          const point = getOrbitPoint(angle, planet.orbitX, planet.orbitY);
          const frontness = (Math.sin(angle) + 1) / 2;
          const scale = 0.74 + frontness * 0.42;
          const opacity = 0.72 + frontness * 0.28;
          const labelOpacity = 0.38 + frontness * 0.62;
          const zIndex = 20 + Math.round(frontness * 30);
          const showRing = planet.ring && Math.abs(point.x) > 170;

          return (
            <motion.div
              key={planet.name}
              initial={{ opacity: 0, scale: 0.74 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.28 + index * 0.12, duration: 0.8, ease: "easeOut" }}
              className="absolute left-1/2 top-1/2"
              style={{
                transform: `translate(${point.x}px, ${point.y}px)`,
                opacity,
                zIndex,
              }}
            >
              <Link href={planet.href} className="group block -translate-x-1/2 -translate-y-1/2">
                <div className="relative flex flex-col items-center text-center" style={{ scale }}>
                  {showRing ? (
                    <div
                      className="absolute left-1/2 top-1/2 rounded-full border"
                      style={{
                        width: planet.size * 1.95,
                        height: planet.size * 0.46,
                        transform: "translate(-50%, -50%) rotate(-14deg)",
                        borderColor: planet.ring,
                        boxShadow: `0 0 16px ${planet.ring}`,
                      }}
                    />
                  ) : null}
                  <motion.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 5 + index * 0.4, repeat: Infinity, ease: "easeInOut" }}
                    className="relative"
                  >
                    <div
                      className="relative rounded-full transition duration-300 group-hover:scale-105"
                      style={{
                        width: planet.size,
                        height: planet.size,
                        background: planet.planet,
                        boxShadow: planet.glow,
                        overflow: "hidden",
                      }}
                    >
                      <div className="absolute inset-0 rounded-full opacity-90" style={{ background: planet.texture }} />
                      <div className="absolute inset-0 rounded-full" style={{ background: planet.shade }} />
                      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_28%_22%,rgba(255,255,255,0.72),transparent_14%)]" />
                    </div>
                    <div
                      className="pointer-events-none absolute left-1/2 top-1/2 rounded-full opacity-0 transition duration-300 group-hover:opacity-100"
                      style={{
                        width: planet.size * 2.5,
                        height: planet.size * 2.5,
                        transform: "translate(-50%, -50%)",
                        background: "radial-gradient(circle, rgba(255,255,255,0.12), transparent 62%)",
                      }}
                    />
                  </motion.div>
                  <div className="mt-4 max-w-[240px]" style={{ opacity: labelOpacity }}>
                    <p className="text-sm font-semibold tracking-[0.12em] text-white/92">{planet.name}</p>
                    <p className="mt-1 text-[11px] leading-5 text-white/58">{planet.desc}</p>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-30 flex items-center justify-center py-4 text-[10px] uppercase tracking-[0.32em] text-white/18">
        (c) 2026 Fidelis
      </div>
    </div>
  );
}

export default StreamDashboard;

