import { useEffect, useRef } from "react";

/** Ambient twinkling starfield painted on a fixed canvas. */
export function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let stars: Array<{ x: number; y: number; r: number; p: number; s: number; hue: number }> = [];
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      canvas.style.width = `${innerWidth}px`;
      canvas.style.height = `${innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round((innerWidth * innerHeight) / 9000);
      stars = Array.from({ length: n }, () => ({
        x: Math.random() * innerWidth,
        y: Math.random() * innerHeight,
        r: Math.random() * 1.1 + 0.2,
        p: Math.random() * Math.PI * 2,
        s: 0.3 + Math.random() * 1.2,
        hue: [195, 290, 330, 220][Math.floor(Math.random() * 4)]!,
      }));
    };
    const draw = (t: number) => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const st of stars) {
        const a = reduce ? 0.6 : 0.35 + 0.65 * Math.abs(Math.sin(st.p + (t / 1000) * st.s * 0.6));
        ctx.beginPath();
        ctx.fillStyle = `hsla(${st.hue}, 90%, 85%, ${a * 0.8})`;
        ctx.shadowColor = `hsla(${st.hue}, 100%, 70%, ${a})`;
        ctx.shadowBlur = st.r > 0.9 ? 6 : 0;
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    resize();
    raf = requestAnimationFrame(draw);
    addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
    };
  }, []);
  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-[1] opacity-70" />;
}
