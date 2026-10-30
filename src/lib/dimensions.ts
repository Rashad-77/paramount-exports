/**
 * The Dimensions box with its unit chooser: the unit goes after the numbers ("180 × 90 × 75" and cm give "180 × 90 × 75 cm").
 * If the customer typed their own units ("2 in × 6 in × 12 ft", or 6" ) what they typed is kept as it is.
 */
export function withUnit(dimensions: string | undefined | null, unit: string | undefined | null): string | null {
  const text = dimensions?.trim();
  if (!text) return null;
  // A letter x between the numbers is a multiplication sign (2 x 6 x 12), not a unit.
  if (!unit || /[A-WYZa-wyz"']/.test(text)) return text;
  return `${text} ${unit}`;
}
