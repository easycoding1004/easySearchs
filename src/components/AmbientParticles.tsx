// Decorative floating-particle background for hero sections — purely
// visual, so positions/timings are hand-picked constants rather than
// Math.random() (random values would differ between server and client
// render and break hydration).
const PARTICLES = [
  { left: "4%", size: 16, delay: "0s", duration: "11s" },
  { left: "12%", size: 10, delay: "2s", duration: "14s" },
  { left: "20%", size: 22, delay: "4s", duration: "10s" },
  { left: "30%", size: 13, delay: "1s", duration: "13s" },
  { left: "40%", size: 19, delay: "6s", duration: "15s" },
  { left: "50%", size: 11, delay: "3s", duration: "12s" },
  { left: "58%", size: 24, delay: "7s", duration: "11s" },
  { left: "67%", size: 14, delay: "1.5s", duration: "14s" },
  { left: "76%", size: 17, delay: "5s", duration: "15s" },
  { left: "85%", size: 20, delay: "3.5s", duration: "11s" },
  { left: "92%", size: 10, delay: "6.5s", duration: "16s" },
  { left: "97%", size: 14, delay: "8s", duration: "13s" },
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
