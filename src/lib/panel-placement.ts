/** Whether a drop-down under `el` should open upward: there is not room for `needed` pixels below it, and there is more room above. */
export function opensUpward(el: Element, needed: number): boolean {
  const r = el.getBoundingClientRect();
  const below = window.innerHeight - r.bottom - 8;
  return below < needed && r.top > below;
}
