// Marks timeline events as new only when they appear after the first successful load (the caller calls it only then),
// never on the first load and never on a poll that brings nothing new. The short highlight itself is CSS and is off under prefers-reduced-motion.
export function newEventMarker() {
  let seen: Set<string> | null = null;
  return (root: Element) => {
    const items = [...root.querySelectorAll<HTMLElement>('[data-ev]')];
    const ids = items.map((li) => li.dataset.ev!);
    if (seen) for (const li of items) if (!seen.has(li.dataset.ev!)) li.classList.add('lt-new');
    seen = new Set([...(seen ?? []), ...ids]);
  };
}
