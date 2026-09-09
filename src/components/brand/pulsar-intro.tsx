"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";

/**
 * The animated pulsar entrance — rays draw outward with binary period ticks and
 * endpoint nodes, three concentric rings pulse, the long galactic-centre beam
 * sweeps, the core glows, then the whole scene shrinks toward the brand anchor
 * and hands off to the welcome form.
 *
 * It is purely decorative: it NEVER decides authentication or onboarding. A skip
 * control, a hard fallback timer, and `prefers-reduced-motion` all guarantee the
 * form is reachable. A per-visit `sessionStorage` flag suppresses replay on
 * revisits within the same tab but is meaningless to identity.
 */

// Voyager/Pioneer-style pulsar map: [angle°, length, binary period bits].
const RAY_DEFS: [number, number, string][] = [
  [8, 152, "1101"],
  [31, 118, "10011"],
  [54, 168, "110101"],
  [77, 96, "1001"],
  [99, 142, "10110"],
  [121, 116, "11001"],
  [144, 174, "101101"],
  [167, 92, "1010"],
  [190, 134, "11010"],
  [212, 160, "100110"],
  [234, 106, "10101"],
  [257, 148, "110011"],
  [286, 122, "10010"],
  [321, 166, "101011"],
];

const BOOT_LINES = [
  "Loading the visual introduction",
  "Drawing the pulsar map",
  "Preparing the welcome screen",
];

function buildRays() {
  return RAY_DEFS.map(([angle, len, bits], i) => {
    const start = 0.28 + i * 0.11;
    const ticks = bits.split("").map((b, j) => {
      const x = +(len * (0.34 + j * (0.58 / bits.length))).toFixed(1);
      const h = b === "1" ? 7 : 3;
      return {
        x,
        h,
        w: b === "1" ? 1.5 : 1,
        delay: +(start + 0.55 + j * 0.045).toFixed(2),
      };
    });
    return {
      transform: `translate(200,200) rotate(${-angle})`,
      len,
      ticks,
      nodeR: len > 150 ? 3.4 : 2.6,
      delay: +start.toFixed(2),
      nodeDelay: +(start + 0.52).toFixed(2),
    };
  });
}

const SESSION_KEY = "nw-intro-seen";

export function PulsarIntro({
  onDone,
  forceReplay = false,
}: {
  onDone: () => void;
  forceReplay?: boolean;
}) {
  const rays = useMemo(buildRays, []);
  const [exiting, setExiting] = useState(false);
  const [boot, bumpBoot] = useReducer((n: number) => Math.min(n + 1, BOOT_LINES.length - 1), 0);
  const doneRef = useRef(false);

  // Reduced motion or already-seen this visit → skip straight to the form.
  const shouldSkip = () => {
    if (forceReplay) return false;
    try {
      if (typeof window !== "undefined") {
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return true;
        if (sessionStorage.getItem(SESSION_KEY) === "1") return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  };

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
    onDone();
  };

  useEffect(() => {
    if (shouldSkip()) {
      finish();
      return;
    }
    const bootTimer = setInterval(bumpBoot, 1150);
    const exitTimer = setTimeout(() => setExiting(true), 3600);
    const doneTimer = setTimeout(finish, 4400);
    // Hard fallback: never trap the user behind the animation.
    const failsafe = setTimeout(finish, 7000);
    return () => {
      clearInterval(bootTimer);
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
      clearTimeout(failsafe);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (doneRef.current) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: "radial-gradient(80% 65% at 50% 45%, #150F30 0%, #0A0718 55%, #07050F 100%)",
        transformOrigin: "12% 12%",
        transition: "transform 1.05s cubic-bezier(.65,0,.2,1), opacity .8s ease .2s",
        animation: exiting ? "pm-intro-exit .8s cubic-bezier(.65,0,.2,1) forwards" : undefined,
      }}
    >
      <button
        type="button"
        onClick={finish}
        className="absolute right-5 top-5 rounded-full border px-3.5 py-1.5 text-[11px] uppercase tracking-[0.18em] text-[#9AA3C0] transition-colors hover:text-white"
        style={{ borderColor: "rgba(150,185,255,.2)", fontFamily: "var(--font-mono)" }}
      >
        Skip
      </button>

      <svg
        viewBox="0 0 400 400"
        style={{ width: "min(58vh, 66vw)", height: "min(58vh, 66vw)", overflow: "visible" }}
        aria-hidden
      >
        <defs>
          <radialGradient id="nwCoreG" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#EAF7FF" stopOpacity="1" />
            <stop offset="35%" stopColor="#9FDCFF" stopOpacity=".8" />
            <stop offset="100%" stopColor="#5B8FE8" stopOpacity="0" />
          </radialGradient>
          <filter id="nwBlur" x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {[0.4, 1.87, 3.34].map((d, i) => (
          <circle
            key={i}
            cx="200"
            cy="200"
            r="160"
            fill="none"
            stroke={i === 2 ? "#7FA6F0" : "#8FD3FF"}
            strokeWidth="1"
            style={{
              transformOrigin: "200px 200px",
              animation: `pm-ring 4.4s cubic-bezier(.2,.7,.3,1) ${d}s infinite`,
            }}
          />
        ))}

        {rays.map((r, i) => (
          <g key={i} transform={r.transform} stroke="#9FD8FF" strokeLinecap="round">
            <line
              x1="0"
              y1="0"
              x2={r.len}
              y2="0"
              strokeWidth="1.15"
              opacity=".82"
              pathLength={1}
              strokeDasharray="1"
              style={{ animation: `pm-draw .8s cubic-bezier(.35,0,.15,1) ${r.delay}s both` }}
            />
            {r.ticks.map((t, j) => (
              <line
                key={j}
                x1={t.x}
                y1={-t.h}
                x2={t.x}
                y2={t.h}
                strokeWidth={t.w}
                opacity=".72"
                style={{ animation: `pm-fade .34s ease-out ${t.delay}s both` }}
              />
            ))}
            <circle
              cx={r.len}
              cy="0"
              r="6"
              fill="#8FD3FF"
              opacity=".22"
              filter="url(#nwBlur)"
              style={{ animation: `pm-fade .5s ease-out ${r.nodeDelay}s both` }}
            />
            <circle
              cx={r.len}
              cy="0"
              r={r.nodeR}
              fill="#DDF1FF"
              style={{
                transformOrigin: `${r.len}px 0px`,
                animation: `pm-pop .5s cubic-bezier(.2,1.4,.4,1) ${r.nodeDelay}s both`,
              }}
            />
          </g>
        ))}

        <g transform="translate(200,200)" stroke="#CDEBFF" strokeLinecap="round">
          <line
            x1="0"
            y1="0"
            x2="192"
            y2="0"
            strokeWidth="2"
            pathLength={1}
            strokeDasharray="1"
            style={{ animation: "pm-draw 1.1s cubic-bezier(.35,0,.15,1) 2.2s both" }}
          />
          <line
            x1="192"
            y1="-9"
            x2="192"
            y2="9"
            strokeWidth="2"
            style={{ animation: "pm-fade .4s ease-out 3.1s both" }}
          />
        </g>

        <circle
          cx="200"
          cy="200"
          r="64"
          fill="url(#nwCoreG)"
          style={{ transformOrigin: "200px 200px", animation: "pm-glow 3.6s ease-in-out infinite" }}
        />
        <circle
          cx="200"
          cy="200"
          r="7.5"
          fill="#F2FAFF"
          style={{ transformOrigin: "200px 200px", animation: "pm-core 2.8s ease-in-out infinite" }}
        />
      </svg>

      <div
        className="mt-6 text-center"
        style={{ animation: "pm-rise .9s cubic-bezier(.2,1,.36,1) 2.7s both" }}
      >
        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(30px, 4.2vw, 46px)",
            fontWeight: 300,
            letterSpacing: ".04em",
            color: "#F1F6FF",
          }}
        >
          newwin
        </div>
        <div
          className="mt-3 text-[11px] uppercase"
          style={{ letterSpacing: ".32em", color: "#8A93B4", fontFamily: "var(--font-mono)" }}
        >
          Signal intelligence for oncology BD
        </div>
      </div>

      <div
        className="absolute inset-x-0 bottom-10 flex flex-col items-center gap-3.5"
        style={{ animation: "pm-fade .8s ease-out 3s both" }}
      >
        <div className="h-px w-[148px] overflow-hidden" style={{ background: "rgba(143,211,255,.18)" }}>
          <span
            className="block h-full"
            style={{
              background: "linear-gradient(90deg, rgba(143,211,255,0), #8FD3FF)",
              transformOrigin: "left",
              animation: "pm-bar 2.2s cubic-bezier(.3,0,.2,1) 1s both",
            }}
          />
        </div>
        <div
          className="text-[10.5px] uppercase"
          style={{ letterSpacing: ".2em", color: "#6B7398", fontFamily: "var(--font-mono)" }}
        >
          {BOOT_LINES[boot]}
        </div>
      </div>
    </div>
  );
}
