type GrowingStemProps = {
  /** 0 = just sprouted, 1 = in bloom. */
  progress: number;
  className?: string;
};

type Point = { x: number; y: number };

const BASE: Point = { x: 100, y: 440 };
const HEIGHT = 310;
const SWAY = 14;
const SPROUT = 0.08;
const SAMPLES = 60;

const LEAVES = [
  { at: 0.24, side: 1 },
  { at: 0.48, side: -1 },
  { at: 0.72, side: 1 },
] as const;

const PETAL_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315] as const;

function stemPoint(t: number): Point {
  return {
    x: BASE.x + SWAY * Math.sin(t * Math.PI * 2.2),
    y: BASE.y - t * HEIGHT,
  };
}

function stemPath(until: number): string {
  const steps = Math.max(1, Math.ceil(until * SAMPLES));
  const commands: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const { x, y } = stemPoint((until * i) / steps);
    commands.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return commands.join(" ");
}

export function GrowingStem({ progress, className }: GrowingStemProps) {
  const clamped = Math.min(1, Math.max(0, progress));
  const grown = SPROUT + (1 - SPROUT) * clamped;
  const tip = stemPoint(grown);
  const inBloom = clamped >= 1;

  return (
    <svg viewBox="0 0 200 460" className={className} aria-hidden="true">
      <path
        d="M40 441 H160"
        className="stroke-on-panel-muted"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="2 8"
      />
      <path
        d={stemPath(grown)}
        className="stroke-stem"
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {LEAVES.map(({ at, side }) => {
        const { x, y } = stemPoint(at);
        return (
          <g
            key={at}
            transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${side} 1) rotate(-28)`}
          >
            <path
              d="M0 0 Q16 -15 36 0 Q16 15 0 0 Z"
              className="fill-stem transition-transform duration-500 ease-out"
              style={{
                transform: `scale(${grown >= at ? 1 : 0})`,
                transformOrigin: "0px 0px",
              }}
            />
          </g>
        );
      })}

      <g transform={`translate(${tip.x.toFixed(1)} ${tip.y.toFixed(1)})`}>
        <g
          className="transition-transform duration-700 ease-out"
          style={{
            transform: `scale(${inBloom ? 1 : 0})`,
            transformOrigin: "0px 0px",
          }}
        >
          {PETAL_ANGLES.map((angle) => (
            <ellipse
              key={angle}
              cy="-26"
              rx="10"
              ry="24"
              transform={`rotate(${angle})`}
              className="fill-petal stroke-petal-line"
              strokeWidth="2"
            />
          ))}
          <circle r="10" className="fill-foreground dark:fill-background" />
        </g>
        <ellipse
          cy="-9"
          rx="7"
          ry="12"
          className="fill-petal stroke-petal-line transition-opacity duration-300"
          strokeWidth="2"
          style={{ opacity: inBloom ? 0 : 1 }}
        />
      </g>
    </svg>
  );
}
