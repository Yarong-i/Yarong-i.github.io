// Shared, event-driven motion helpers. Nothing here runs a continuous loop.
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

// 1. Card light: while a mouse is over a card, its --mx/--my follow the pointer (at most once per frame).
let pending: { el: HTMLElement; x: string; y: string } | null = null;
document.addEventListener('pointermove', (event) => {
  if (event.pointerType !== 'mouse') return;
  const el = (event.target as Element | null)?.closest<HTMLElement>('.lit, .writing-item, .wrow');
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const first = !pending;
  pending = { el, x: `${event.clientX - rect.left}px`, y: `${event.clientY - rect.top}px` };
  if (first) requestAnimationFrame(() => {
    if (pending) { pending.el.style.setProperty('--mx', pending.x); pending.el.style.setProperty('--my', pending.y); }
    pending = null;
  });
}, { passive: true });

// 2. Section reveal: [data-reveal] elements get .is-in once they enter the viewport (CSS does the motion).
const targets = document.querySelectorAll<HTMLElement>('[data-reveal]');
if (targets.length && 'IntersectionObserver' in window && !reduced.matches) {
  document.documentElement.classList.add('reveal-ready');
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -12% 0px' });
  targets.forEach((target) => observer.observe(target));
}
