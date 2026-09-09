// Claude's terracotta starburst mark, hand-traced as 12 unevenly spaced
// tapered rays so it reads like the hand-drawn original at small sizes.
// Spins slowly by default; the animation is disabled for users with
// prefers-reduced-motion (see .claude-spark-spin in index.css).
export default function ClaudeSpark({ className = 'h-4 w-4', spinning = true, color = '#D97757' }) {
  // [angle°, ray length, ray width] — deliberately irregular
  const rays = [
    [0, 45, 10], [31, 38, 9], [60, 44, 9], [92, 43, 10],
    [119, 36, 8], [147, 44, 9], [178, 45, 9], [212, 38, 9],
    [239, 45, 9], [271, 42, 9], [300, 37, 8], [330, 43, 9],
  ];
  return (
    <svg
      viewBox="-50 -50 100 100"
      className={`${className}${spinning ? ' claude-spark-spin' : ''}`}
      aria-hidden="true"
    >
      <circle r="11" fill={color} />
      {rays.map(([angle, len, w], i) => (
        <polygon
          key={i}
          transform={`rotate(${angle})`}
          points={`${-w / 2},-6 ${w / 2},-6 ${w * 0.32},${-len} ${-w * 0.32},${-len}`}
          fill={color}
          stroke={color}
          strokeWidth="4"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
