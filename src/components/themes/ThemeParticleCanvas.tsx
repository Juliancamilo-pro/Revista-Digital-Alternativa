import React, { useEffect, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { ThemeParticleType } from '../../types/editorial';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  vr: number;
  alpha: number;
  color: string;
  phase: number;
  kind: number;
}

function getPaletteForParticle(type: ThemeParticleType, primary: string, accent: string): string[] {
  switch (type) {
    case 'snow':
    case 'heavy_snow':
      return ['#FFFFFF', '#E2E8F0', '#DBEAFE'];
    case 'confetti':
      return ['#FCD116', '#003893', '#CE1126', primary];
    case 'fireworks_confetti':
      return ['#FBBF24', '#FDE047', '#F97316', '#FFFFFF', primary];
    case 'sparks':
    case 'stars':
      return ['#FBBF24', '#FDE68A', '#F59E0B', primary];
    case 'bats':
      return ['#4C1D95', '#EA580C', '#1F2937'];
    case 'hearts':
      return [primary, '#EC4899', '#F43F5E'];
    case 'butterflies_petals':
      return ['#F59E0B', primary, '#10B981', '#FBBF24'];
    case 'petals':
      return [primary, '#F472B6', accent, '#FDA4AF'];
    case 'ink_sparks':
      return ['#78350F', '#B45309', primary];
    default:
      return [primary];
  }
}

export const ThemeParticleCanvas: React.FC = () => {
  const { showParticles, activeTheme, themeSettings, isMobileViewport } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!showParticles || activeTheme.particleType === 'none') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const particleType = activeTheme.particleType;
    const intensityScale =
      themeSettings.intensity === 'sutil'
        ? 0.45
        : themeSettings.intensity === 'festivo'
        ? 1
        : 0.72;
    const speedScale = themeSettings.speed === 'lenta' ? 0.55 : 1;
    const maxCap = isMobileViewport ? 18 : 40;
    const targetCount = Math.max(4, Math.min(maxCap, Math.round(maxCap * intensityScale)));

    const computedPrimary =
      getComputedStyle(document.documentElement).getPropertyValue('--editorial-primary').trim() ||
      activeTheme.palette.light.primary;
    const computedAccent =
      getComputedStyle(document.documentElement).getPropertyValue('--editorial-accent').trim() ||
      activeTheme.palette.light.accent;
    const colors = getPaletteForParticle(particleType, computedPrimary, computedAccent);

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();

    const makeParticle = (randomY = false): Particle => {
      const rising = particleType === 'sparks' || particleType === 'hearts';
      const baseVy =
        particleType === 'heavy_snow'
          ? 0.85 + Math.random() * 0.9
          : rising
          ? -(0.35 + Math.random() * 0.55)
          : 0.45 + Math.random() * 0.75;

      return {
        x: Math.random() * width,
        y: randomY ? Math.random() * height : rising ? height + 16 : -16,
        vx: (Math.random() - 0.5) * 0.45 * speedScale,
        vy: baseVy * speedScale,
        size: 3 + Math.random() * 4.5,
        rotation: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.03 * speedScale,
        alpha: 0.32 + Math.random() * 0.45,
        color: colors[Math.floor(Math.random() * colors.length)],
        phase: Math.random() * Math.PI * 2,
        kind: Math.floor(Math.random() * 3),
      };
    };

    const particles: Particle[] = Array.from({ length: targetCount }, () => makeParticle(true));

    let rafId = 0;
    let lastTime = performance.now();
    const frameInterval = 1000 / 30; // Límite estricto 30 FPS

    const drawHeart = (size: number) => {
      const s = size * 0.65;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.4);
      ctx.bezierCurveTo(-s, -s * 0.5, -s * 1.1, s * 0.6, 0, s * 1.25);
      ctx.bezierCurveTo(s * 1.1, s * 0.6, s, -s * 0.5, 0, s * 0.4);
      ctx.fill();
    };

    const drawStar = (r: number) => {
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.lineWidth = 1.6;
      ctx.stroke();
    };

    const drawBat = (size: number) => {
      const s = size * 0.95;
      ctx.beginPath();
      ctx.moveTo(-s, -s * 0.2);
      ctx.quadraticCurveTo(-s * 0.45, -s * 0.7, 0, -s * 0.15);
      ctx.quadraticCurveTo(s * 0.45, -s * 0.7, s, -s * 0.2);
      ctx.quadraticCurveTo(s * 0.5, s * 0.4, 0, s * 0.2);
      ctx.quadraticCurveTo(-s * 0.5, s * 0.4, -s, -s * 0.2);
      ctx.fill();
    };

    const renderFrame = (now: number) => {
      rafId = window.requestAnimationFrame(renderFrame);
      if (document.hidden) return;
      const elapsed = now - lastTime;
      if (elapsed < frameInterval) return;
      lastTime = now - (elapsed % frameInterval);

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.phase += 0.03 * speedScale;
        p.x += p.vx + Math.sin(p.phase) * 0.25 * speedScale;
        p.y += p.vy;
        p.rotation += p.vr;

        if (p.vy > 0 && p.y > height + 20) {
          particles[i] = makeParticle(false);
          continue;
        }
        if (p.vy < 0 && p.y < -20) {
          particles[i] = makeParticle(false);
          continue;
        }
        if (p.x < -20) p.x = width + 18;
        if (p.x > width + 20) p.x = -18;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.strokeStyle = p.color;

        if (particleType === 'snow' || particleType === 'heavy_snow') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.48, 0, Math.PI * 2);
          ctx.fill();
        } else if (particleType === 'confetti' || particleType === 'fireworks_confetti') {
          ctx.fillRect(-p.size * 0.55, -p.size * 0.3, p.size * 1.1, p.size * 0.6);
        } else if (particleType === 'stars' || particleType === 'sparks' || particleType === 'ink_sparks') {
          if (p.kind === 0) {
            drawStar(p.size * 0.9);
          } else {
            ctx.beginPath();
            ctx.arc(0, 0, p.size * 0.38, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (particleType === 'hearts') {
          drawHeart(p.size);
        } else if (particleType === 'bats') {
          drawBat(p.size);
        } else {
          // petals / butterflies_petals
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * 0.72, p.size * 0.36, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    };

    const onVisibilityChange = () => {
      if (!document.hidden) {
        lastTime = performance.now();
      }
    };

    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    rafId = window.requestAnimationFrame(renderFrame);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [showParticles, activeTheme.id, activeTheme.particleType, activeTheme.palette.light.primary, activeTheme.palette.light.accent, themeSettings.intensity, themeSettings.speed, isMobileViewport]);

  if (!showParticles || activeTheme.particleType === 'none') return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none select-none z-[35]"
    />
  );
};
