import { useEffect, useRef } from 'react';
import { useTheme } from '../ThemeContext';

function FiberBackground() {
  const canvasRef = useRef(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let time = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resize();
    window.addEventListener('resize', resize);

    const isDark = theme === 'dark';

    // ── Large aurora orbs ──────────────────────────────────────────────
    const orbDefs = [
      { color: [59, 130, 246],  a: isDark ? 0.18 : 0.14, r: 320 }, // blue
      { color: [139, 92, 246],  a: isDark ? 0.15 : 0.12, r: 300 }, // purple
      { color: [6, 182, 212],   a: isDark ? 0.15 : 0.12, r: 280 }, // cyan
      { color: [16, 185, 129],  a: isDark ? 0.12 : 0.10, r: 260 }, // emerald
      { color: [249, 115, 22],  a: isDark ? 0.10 : 0.08, r: 240 }, // orange
    ];

    const orbs = orbDefs.map((def) => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: def.r + Math.random() * 100,
      color: def.color,
      alpha: def.a,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      phase: Math.random() * Math.PI * 2,
      phaseSpeed: 0.001 + Math.random() * 0.003,
      pulseSpeed: 0.002 + Math.random() * 0.003,
      pulsePhase: Math.random() * Math.PI * 2,
    }));

    // ── Small drifting particles ───────────────────────────────────────
    const particleCount = 20;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: 1 + Math.random() * 2,
      alpha: isDark ? (0.35 + Math.random() * 0.4) : (0.2 + Math.random() * 0.25),
      vx: (Math.random() - 0.5) * 0.3,
      vy: -0.1 - Math.random() * 0.3,
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.01 + Math.random() * 0.02,
      color: [
        [59, 130, 246],
        [139, 92, 246],
        [6, 182, 212],
        [16, 185, 129],
        [249, 115, 22],
      ][Math.floor(Math.random() * 5)],
    }));

    // ── Aurora streaks ─────────────────────────────────────────────────
    const streakCount = 3;
    const streaks = Array.from({ length: streakCount }, (_, i) => ({
      phase: (Math.PI * 2 * i) / streakCount,
      speed: 0.0008 + Math.random() * 0.0012,
      color: [
        [59, 130, 246],
        [139, 92, 246],
        [6, 182, 212],
      ][i],
      alpha: isDark ? 0.08 : 0.06,
      width: 200 + Math.random() * 150,
    }));

    const animate = () => {
      time++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // ── Draw aurora streaks ────────────────────────────────────────
      streaks.forEach(streak => {
        streak.phase += streak.speed;
        const y = canvas.height * (0.3 + 0.4 * Math.sin(streak.phase));
        const grad = ctx.createLinearGradient(0, y - streak.width, 0, y + streak.width);
        const [r, g, b] = streak.color;
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(0.3, `rgba(${r},${g},${b},${streak.alpha * 0.5})`);
        grad.addColorStop(0.5, `rgba(${r},${g},${b},${streak.alpha})`);
        grad.addColorStop(0.7, `rgba(${r},${g},${b},${streak.alpha * 0.5})`);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, y - streak.width, canvas.width, streak.width * 2);
      });

      // ── Draw orbs ─────────────────────────────────────────────────
      orbs.forEach(orb => {
        orb.phase += orb.phaseSpeed;
        orb.pulsePhase += orb.pulseSpeed;
        orb.x += orb.vx + Math.sin(orb.phase) * 0.3;
        orb.y += orb.vy + Math.cos(orb.phase * 0.7) * 0.3;

        if (orb.x < -orb.radius) orb.x = canvas.width + orb.radius;
        if (orb.x > canvas.width + orb.radius) orb.x = -orb.radius;
        if (orb.y < -orb.radius) orb.y = canvas.height + orb.radius;
        if (orb.y > canvas.height + orb.radius) orb.y = -orb.radius;

        const pulse = 0.7 + 0.3 * Math.sin(orb.pulsePhase);
        const currentAlpha = orb.alpha * pulse;
        const [r, g, b] = orb.color;

        const gradient = ctx.createRadialGradient(
          orb.x, orb.y, 0,
          orb.x, orb.y, orb.radius
        );
        gradient.addColorStop(0, `rgba(${r},${g},${b},${currentAlpha})`);
        gradient.addColorStop(0.4, `rgba(${r},${g},${b},${currentAlpha * 0.5})`);
        gradient.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // ── Draw particles ────────────────────────────────────────────
      particles.forEach(p => {
        p.pulsePhase += p.pulseSpeed;
        p.x += p.vx;
        p.y += p.vy;

        if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;

        const pulse = 0.5 + 0.5 * Math.sin(p.pulsePhase);
        const currentAlpha = p.alpha * pulse;
        const [r, g, b] = p.color;

        ctx.beginPath();
        ctx.fillStyle = `rgba(${r},${g},${b},${currentAlpha})`;
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: theme === 'dark' ? 1 : 0.6 }}
    />
  );
}

export default FiberBackground;
