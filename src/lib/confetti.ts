// Generic confetti burst — emoji DOM pieces, no library.
// Counts: 24 first-of-day, 18 same-day, 80 milestone (callers pass exact n).

const SYMBOLS = ["★", "✦", "✺", "◆", "●", "✿"];
const COLORS = [
  "var(--pink)",
  "var(--yellow)",
  "var(--teal)",
  "var(--ink)",
];

export function burstConfetti(n: number) {
  if (typeof window === "undefined") return;
  const originX = window.innerWidth / 2;
  const originY = window.innerHeight / 2;
  for (let i = 0; i < n; i++) {
    const piece = document.createElement("div");
    piece.textContent = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    piece.style.cssText = `
      position: fixed;
      left: ${originX}px;
      top: ${originY}px;
      font-size: 22px;
      pointer-events: none;
      z-index: 1000;
      user-select: none;
      color: ${COLORS[Math.floor(Math.random() * COLORS.length)]};
      transform: translate(-50%, -50%);
    `;
    document.body.appendChild(piece);

    const angle = Math.random() * Math.PI * 2;
    const speed = 200 + Math.random() * 400;
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed - 200;
    const rot = (Math.random() - 0.5) * 720;
    const duration = 1200 + Math.random() * 800;

    const anim = piece.animate(
      [
        { transform: "translate(-50%, -50%) rotate(0deg)", opacity: 1 },
        {
          transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 500}px)) rotate(${rot}deg)`,
          opacity: 0,
        },
      ],
      { duration, easing: "cubic-bezier(0.2, 0.6, 0.4, 1)" },
    );
    anim.onfinish = () => piece.remove();
  }
}
