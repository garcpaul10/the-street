/* The Street — ambient FX layer
 * Pure vanilla, zero deps. Energy particle field + button ripples + hero parallax.
 * Respects prefers-reduced-motion (particles skipped, ripples still light).
 */
(function () {
  'use strict';

  const reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 1. ENERGY PARTICLE FIELD ── */
  function initParticles() {
    if (reduceMotion) return;

    const canvas = document.createElement('canvas');
    canvas.id = 'fx-particles';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    let w, h, dpr, particles;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.width = innerWidth * dpr;
      h = canvas.height = innerHeight * dpr;
      canvas.style.width = innerWidth + 'px';
      canvas.style.height = innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function makeParticles() {
      // scale count to viewport, but keep it cheap
      const count = Math.round(Math.min(56, (innerWidth * innerHeight) / 26000));
      particles = [];
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * innerWidth,
          y: Math.random() * innerHeight,
          r: Math.random() * 1.8 + 0.4,
          vx: (Math.random() - 0.5) * 0.18,
          vy: -(Math.random() * 0.3 + 0.05),     // drift upward like embers/dust
          a: Math.random() * 0.5 + 0.1,
          tw: Math.random() * 0.02 + 0.004,      // twinkle speed
          tp: Math.random() * Math.PI * 2,       // twinkle phase
          green: Math.random() > 0.35             // mix of volt + cool dust
        });
      }
    }

    function tick() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.tp += p.tw;
        if (p.y < -10) { p.y = innerHeight + 10; p.x = Math.random() * innerWidth; }
        if (p.x < -10) p.x = innerWidth + 10;
        if (p.x > innerWidth + 10) p.x = -10;

        const alpha = p.a * (0.55 + 0.45 * Math.sin(p.tp));
        const color = p.green
          ? 'rgba(68,255,34,' + alpha.toFixed(3) + ')'
          : 'rgba(150,200,255,' + (alpha * 0.6).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowBlur = p.green ? 8 : 4;
        ctx.shadowColor = color;
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(tick);
    }

    let raf;
    resize();
    makeParticles();
    tick();

    let rt;
    addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => { resize(); makeParticles(); }, 200);
    });

    // pause when tab hidden (save battery)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(raf); }
      else { raf = requestAnimationFrame(tick); }
    });
  }

  /* ── 2. BUTTON RIPPLE ── */
  function initRipple() {
    document.addEventListener('pointerdown', (e) => {
      const btn = e.target.closest('.btn, .format-btn, .nav-btn');
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const ripple = document.createElement('span');
      ripple.className = 'fx-ripple';
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
      btn.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());
      // safety cleanup
      setTimeout(() => ripple.remove(), 700);
    }, { passive: true });
  }

  /* ── 3. LOGIN HERO PARALLAX ── */
  function initParallax() {
    if (reduceMotion) return;
    let pending = false, mx = 0, my = 0;

    addEventListener('pointermove', (e) => {
      mx = (e.clientX / innerWidth - 0.5);
      my = (e.clientY / innerHeight - 0.5);
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        const img = document.querySelector('.hero-img');
        const lamp = document.querySelector('.lamp-flicker');
        if (img) {
          img.style.transform =
            'scale(1.06) translate(' + (mx * -14) + 'px,' + (my * -10) + 'px)';
        }
        if (lamp) {
          lamp.style.transform =
            'translateX(-50%) translate(' + (mx * 18) + 'px,' + (my * 12) + 'px)';
        }
      });
    }, { passive: true });
  }

  function boot() {
    initParticles();
    initRipple();
    initParallax();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
