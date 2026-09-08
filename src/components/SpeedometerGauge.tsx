// A CNN "Fear & Greed Index"-style semicircular speedometer: a needle
// sweeping over five colored zones (strong sell/fear -> strong buy/greed).
// Used for the composite signal, the sentiment/Dumb-Money reading, and
// the Smart Money reading, so all three share one visual language.

const CX = 100;
const CY = 95;
const RADIUS = 82;
const STROKE = 16;

const ZONES = [
  { from: 180, to: 144, color: "#ef4444" }, // red
  { from: 144, to: 108, color: "#f97316" }, // orange
  { from: 108, to: 72, color: "#eab308" }, // amber
  { from: 72, to: 36, color: "#84cc16" }, // lime
  { from: 36, to: 0, color: "#22c55e" }, // green
];

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function polar(radius: number, angleDeg: number) {
  return {
    x: CX + radius * Math.cos(toRad(angleDeg)),
    y: CY - radius * Math.sin(toRad(angleDeg)),
  };
}

export function SpeedometerGauge({
  score,
  label,
  sublabel,
  leftCaption,
  rightCaption,
}: {
  /** -1 .. +1 */
  score: number;
  label: string;
  sublabel?: string;
  leftCaption: string;
  rightCaption: string;
}) {
  const clamped = Math.min(1, Math.max(-1, score));
  const needleAngle = 90 - clamped * 90; // 180=leftmost(-1), 0=rightmost(+1)
  const needleTip = polar(RADIUS - STROKE / 2 - 4, needleAngle);
  const leftLabelPos = polar(RADIUS + 12, 165);
  const rightLabelPos = polar(RADIUS + 12, 15);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 118" className="w-full max-w-[220px]">
        {ZONES.map((z) => {
          const p1 = polar(RADIUS, z.from);
          const p2 = polar(RADIUS, z.to);
          return (
            <path
              key={z.from}
              d={`M ${p1.x} ${p1.y} A ${RADIUS} ${RADIUS} 0 0 1 ${p2.x} ${p2.y}`}
              stroke={z.color}
              strokeWidth={STROKE}
              fill="none"
            />
          );
        })}

        <text
          x={leftLabelPos.x}
          y={leftLabelPos.y}
          textAnchor="middle"
          className="fill-slate-500"
          fontSize="9"
        >
          {leftCaption}
        </text>
        <text
          x={rightLabelPos.x}
          y={rightLabelPos.y}
          textAnchor="middle"
          className="fill-slate-500"
          fontSize="9"
        >
          {rightCaption}
        </text>

        <line
          x1={CX}
          y1={CY}
          x2={needleTip.x}
          y2={needleTip.y}
          stroke="#e2e8f0"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <circle cx={CX} cy={CY} r={6} fill="#e2e8f0" />
      </svg>

      <p className="-mt-3 text-lg font-semibold text-slate-100">{label}</p>
      {sublabel && <p className="text-xs text-slate-500">{sublabel}</p>}
    </div>
  );
}
