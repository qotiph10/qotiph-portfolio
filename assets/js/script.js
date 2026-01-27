"use strict";

// 3D background (canvas)
(() => {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  const prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let width = 0;
  let height = 0;
  let dpr = 1;

  const config = {
    count: prefersReducedMotion ? 90 : 160,
    depth: 900,
    fov: 420,
    speed: prefersReducedMotion ? 0.15 : 0.6,
    rotation: prefersReducedMotion ? 0.00035 : 0.0012,
    lineDist: 140,
  };

  const accentA = { r: 56, g: 189, b: 248 }; // #38bdf8
  const accentB = { r: 167, g: 139, b: 250 }; // #a78bfa

  const mix = (a, b, t) => a + (b - a) * t;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  const particles = [];

  const rand = (min, max) => min + Math.random() * (max - min);

  const resetParticle = (p, randomZ = true) => {
    p.x = rand(-1, 1);
    p.y = rand(-1, 1);
    p.z = randomZ ? rand(1, config.depth) : config.depth;
    p.vx = rand(-0.05, 0.05);
    p.vy = rand(-0.05, 0.05);
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const init = () => {
    particles.length = 0;
    for (let i = 0; i < config.count; i++) {
      const p = { x: 0, y: 0, z: 0, vx: 0, vy: 0 };
      resetParticle(p);
      particles.push(p);
    }
    resize();
  };

  const project = (p) => {
    // Map normalized x/y into a world size based on viewport
    const worldX = p.x * (width * 0.55);
    const worldY = p.y * (height * 0.55);

    const scale = config.fov / (config.fov + p.z);
    return {
      sx: worldX * scale + width / 2,
      sy: worldY * scale + height / 2,
      scale,
    };
  };

  const draw = (timeMs) => {
    const t = timeMs * 0.001;
    ctx.clearRect(0, 0, width, height);

    // Soft fade for nicer trails (very subtle)
    ctx.fillStyle = "rgba(5, 8, 18, 0.10)";
    ctx.fillRect(0, 0, width, height);

    const rot = config.rotation;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);

    // Update + project
    const points = [];
    for (const p of particles) {
      // Rotate around Y axis (x/z)
      const x = p.x;
      const z = p.z;
      p.x = x * cos + (z / config.depth) * sin;
      p.z = z * cos - x * sin * config.depth;

      // Drift
      p.x += p.vx * 0.006;
      p.y += p.vy * 0.006;

      // Subtle wave
      p.y += Math.sin(t * 0.6 + p.x * 4) * 0.0008;

      // Move "towards" camera
      p.z -= config.speed;
      if (p.z < 2) resetParticle(p, false);

      // Wrap x/y so it stays populated
      if (p.x > 1.35) p.x = -1.35;
      if (p.x < -1.35) p.x = 1.35;
      if (p.y > 1.35) p.y = -1.35;
      if (p.y < -1.35) p.y = 1.35;

      const pr = project(p);
      points.push({ p, ...pr });
    }

    // Lines
    ctx.lineWidth = 1;
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      for (let j = i + 1; j < points.length; j++) {
        const b = points[j];
        const dx = a.sx - b.sx;
        const dy = a.sy - b.sy;
        const dist = Math.hypot(dx, dy);
        if (dist > config.lineDist) continue;

        const depthT = clamp01(1 - (a.p.z + b.p.z) / (2 * config.depth));
        const alpha = (1 - dist / config.lineDist) * (0.18 + depthT * 0.24);

        const r = Math.round(mix(accentB.r, accentA.r, depthT));
        const g = Math.round(mix(accentB.g, accentA.g, depthT));
        const bch = Math.round(mix(accentB.b, accentA.b, depthT));

        ctx.strokeStyle = `rgba(${r}, ${g}, ${bch}, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      }
    }

    // Points
    for (const pt of points) {
      const depthT = clamp01(1 - pt.p.z / config.depth);
      const r = Math.round(mix(accentB.r, accentA.r, depthT));
      const g = Math.round(mix(accentB.g, accentA.g, depthT));
      const bch = Math.round(mix(accentB.b, accentA.b, depthT));

      const radius = 1.2 + pt.scale * 2.2;
      const alpha = 0.22 + depthT * 0.55;
      ctx.fillStyle = `rgba(${r}, ${g}, ${bch}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(pt.sx, pt.sy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  let rafId = 0;
  const loop = (timeMs) => {
    draw(timeMs);
    rafId = window.requestAnimationFrame(loop);
  };

  init();

  const onResize = () => resize();
  window.addEventListener("resize", onResize, { passive: true });

  if (prefersReducedMotion) {
    draw(performance.now());
    return;
  }

  rafId = window.requestAnimationFrame(loop);

  // Pause in background tab
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      return;
    }
    if (!rafId) rafId = window.requestAnimationFrame(loop);
  });
})();

// element toggle function
const elementToggleFunc = function (elem) {
  elem.classList.toggle("active");
};

// sidebar variables
const sidebar = document.querySelector("[data-sidebar]");
const sidebarBtn = document.querySelector("[data-sidebar-btn]");

// sidebar toggle functionality for mobile
sidebarBtn.addEventListener("click", function () {
  elementToggleFunc(sidebar);
});

// contact form variables
const form = document.querySelector("[data-form]");
const formInputs = document.querySelectorAll("[data-form-input]");
const formBtn = document.querySelector("[data-form-btn]");

// add event to all form input field
for (let i = 0; i < formInputs.length; i++) {
  formInputs[i].addEventListener("input", function () {
    // check form validation
    if (form.checkValidity()) {
      formBtn.removeAttribute("disabled");
    } else {
      formBtn.setAttribute("disabled", "");
    }
  });
}

// page navigation variables
const navigationLinks = document.querySelectorAll("[data-nav-link]");
const pages = document.querySelectorAll("[data-page]");

const getActivePage = () => document.querySelector("article[data-page].active");
const getActiveNavLink = () => document.querySelector("[data-nav-link].active");

const prefersReducedMotion =
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const animateOut = (element) => {
  if (!element || prefersReducedMotion || !element.animate)
    return Promise.resolve();

  const animation = element.animate(
    [
      { opacity: 1, transform: "translateY(0px)", filter: "blur(0px)" },
      { opacity: 0, transform: "translateY(8px)", filter: "blur(1px)" },
    ],
    {
      duration: 160,
      easing: "cubic-bezier(0.2, 0, 0.38, 0.9)",
      fill: "forwards",
    }
  );

  return animation.finished.catch(() => undefined);
};

const animateIn = (element) => {
  if (!element || prefersReducedMotion || !element.animate) return;

  element.animate(
    [
      { opacity: 0, transform: "translateY(10px)", filter: "blur(2px)" },
      { opacity: 1, transform: "translateY(0px)", filter: "blur(0px)" },
    ],
    { duration: 260, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "both" }
  );
};

// navbar active indicator
const navbarList = document.querySelector(".navbar-list");
let navIndicator = null;

const updateNavIndicator = (activeLink) => {
  if (!navbarList || !navIndicator || !activeLink) return;

  const listRect = navbarList.getBoundingClientRect();
  const linkRect = activeLink.getBoundingClientRect();

  const x = linkRect.left - listRect.left;
  const y = linkRect.top - listRect.top;

  navIndicator.style.width = `${linkRect.width}px`;
  navIndicator.style.height = `${linkRect.height}px`;
  navIndicator.style.transform = `translate(${x}px, ${y}px)`;
  navIndicator.style.opacity = "1";
};

const initNavIndicator = () => {
  if (!navbarList || navIndicator) return;

  navIndicator = document.createElement("span");
  navIndicator.className = "nav-indicator";
  navIndicator.setAttribute("aria-hidden", "true");

  if (prefersReducedMotion) {
    navIndicator.style.transition = "none";
  }

  navbarList.appendChild(navIndicator);
  updateNavIndicator(getActiveNavLink());

  const scheduleUpdate = () =>
    window.requestAnimationFrame(() => updateNavIndicator(getActiveNavLink()));

  window.addEventListener("resize", scheduleUpdate, { passive: true });

  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(scheduleUpdate);
    ro.observe(navbarList);
    for (const link of navigationLinks) ro.observe(link);
  }
};

// add event to all nav link
for (let i = 0; i < navigationLinks.length; i++) {
  navigationLinks[i].addEventListener("click", function () {
    const targetPageName = this.innerHTML.toLowerCase();
    const targetPage = Array.from(pages).find(
      (page) => page.dataset.page === targetPageName
    );

    if (!targetPage) return;
    if (targetPage.classList.contains("active")) return;

    const currentPage = getActivePage();
    const currentNavLink = getActiveNavLink();

    Promise.resolve()
      .then(() => animateOut(currentPage))
      .then(() => {
        if (currentPage) currentPage.classList.remove("active");
        if (currentNavLink) currentNavLink.classList.remove("active");

        targetPage.classList.add("active");
        this.classList.add("active");

        initNavIndicator();
        updateNavIndicator(this);

        window.scrollTo({
          top: 0,
          behavior: prefersReducedMotion ? "auto" : "smooth",
        });
        animateIn(targetPage);
      });
  });
}

initNavIndicator();
