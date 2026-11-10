import type { CSSProperties } from "react";
import { Avatar } from "@/app/components/avatar";

type PodiumFlowerProps = {
  name: string;
  avatarUrl?: string | null;
  /** Length of the stem in viewBox units: the winner's is the longest. */
  stem: number;
  /** Seconds to wait before growing, so the flowers bloom one after another. */
  delay: number;
  className?: string;
};

type Point = { x: number; y: number };

const WIDTH = 120;
/** Room above the head for the petals, which reach 52 units from the centre. */
const HEAD_ROOM = 56;
const BASE_MARGIN = 4;

const PETAL_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315] as const;
const LEAVES = [
  { at: 0.3, side: 1 },
  { at: 0.58, side: -1 },
] as const;

/** Timeline of one flower, in seconds after its delay. */
const STEM_S = 0.9;
const HEAD_AT = 0.75;
const PETALS_AT = 0.95;
const PETAL_STAGGER = 0.04;

/** A point on a cubic Bézier curve, to place the leaves on the stem. */
function bezier(t: number, p0: Point, p1: Point, p2: Point, p3: Point): Point {
  const u = 1 - t;
  return {
    x: u ** 3 * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t ** 3 * p3.x,
    y: u ** 3 * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t ** 3 * p3.y,
  };
}

const seconds = (value: number): CSSProperties => ({ animationDelay: `${value.toFixed(2)}s` });

/**
 * RES-01: a podium flower that grows from the step and blooms around the
 * runner's avatar, which becomes the heart of the flower. Pure CSS
 * animation, so it needs no client JavaScript; with reduced motion the
 * flower is simply shown in bloom.
 */
export function PodiumFlower({ name, avatarUrl, stem, delay, className = "" }: PodiumFlowerProps) {
  const height = HEAD_ROOM + stem + BASE_MARGIN;
  const base: Point = { x: WIDTH / 2, y: height - BASE_MARGIN };
  const head: Point = { x: WIDTH / 2, y: HEAD_ROOM };
  const c1: Point = { x: base.x - 12, y: base.y - stem * 0.35 };
  const c2: Point = { x: base.x + 12, y: base.y - stem * 0.7 };
  const path = `M${base.x} ${base.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${head.x} ${head.y}`;

  return (
    <span className={`relative block w-full ${className}`}>
      <svg viewBox={`0 0 ${WIDTH} ${height}`} className="block w-full" aria-hidden="true">
        <path
          d={path}
          pathLength={1}
          className="podium-stem stroke-stem"
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          style={{ ...seconds(delay), animationDuration: `${STEM_S}s` }}
        />

        {LEAVES.map(({ at, side }) => {
          const { x, y } = bezier(at, base, c1, c2, head);
          return (
            <g
              key={at}
              transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${side} 1) rotate(-28)`}
            >
              <path
                d="M0 0 Q14 -13 32 0 Q14 13 0 0 Z"
                className="podium-pop fill-stem"
                style={seconds(delay + STEM_S * at)}
              />
            </g>
          );
        })}

        <g transform={`translate(${head.x} ${head.y})`}>
          {PETAL_ANGLES.map((angle, i) => (
            <g key={angle} transform={`rotate(${angle})`}>
              <ellipse
                cy="-30"
                rx="12"
                ry="22"
                className="podium-pop fill-petal stroke-petal-line"
                strokeWidth="2"
                style={seconds(delay + PETALS_AT + i * PETAL_STAGGER)}
              />
            </g>
          ))}
        </g>
      </svg>

      {/* The avatar is HTML on top of the SVG, centred on the head of the stem. */}
      <span
        className="absolute w-[34%] -translate-x-1/2 -translate-y-1/2"
        style={{ left: "50%", top: `${((head.y / height) * 100).toFixed(2)}%` }}
      >
        <span className="podium-pop block" style={seconds(delay + HEAD_AT)}>
          <Avatar name={name} src={avatarUrl} className="aspect-square w-full text-lg ring-2 ring-petal-line ring-offset-2 ring-offset-petal" />
        </span>
      </span>
    </span>
  );
}
