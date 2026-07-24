// Decorative floating-particle background for hero sections — purely
// visual, so positions/timings are hand-picked constants rather than
// Math.random() (random values would differ between server and client
// render and break hydration).
const PARTICLES = [
  { left: "4%", size: 10, delay: "0s", duration: "16s" },
  { left: "12%", size: 6, delay: "3s", duration: "20s" },
  { left: "20%", size: 14, delay: "6s", duration: "14s" },
  { left: "30%", size: 8, delay: "1s", duration: "18s" },
  { left: "40%", size: 12, delay: "8s", duration: "22s" },
  { left: "50%", size: 7, delay: "4s", duration: "17s" },
  { left: "58%", size: 16, delay: "10s", duration: "15s" },
  { left: "67%", size: 9, delay: "2s", duration: "19s" },
  { left: "76%", size: 11, delay: "7s", duration: "21s" },
  { left: "85%", size: 13, delay: "5s", duration: "16s" },
  { left: "92%", size: 6, delay: "9s", duration: "23s" },
  { left: "97%", size: 9, delay: "11s", duration: "18s" },
] as const;

export default function AmbientParticles() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="floating-particle"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
}
