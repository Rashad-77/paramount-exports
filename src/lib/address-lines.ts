/** A delivery address is kept as five lines in one text value: line 1, line 2 and line 3 (may be empty), city, postal code. Older four-line and free-text addresses still read fine. */
export interface AddressLines {
  line1: string;
  line2: string;
  line3: string;
  city: string;
  postalCode: string;
}

export function joinAddress(a: AddressLines): string {
  return [a.line1, a.line2, a.line3, a.city, a.postalCode].map((v) => v.trim()).join("\n");
}

export function splitAddress(text: string): AddressLines {
  const parts = text.split("\n").map((v) => v.trim());
  if (parts.length === 5) return { line1: parts[0]!, line2: parts[1]!, line3: parts[2]!, city: parts[3]!, postalCode: parts[4]! };
  if (parts.length === 4) return { line1: parts[0]!, line2: parts[1]!, line3: "", city: parts[2]!, postalCode: parts[3]! };
  return { line1: text.replace(/\s*\n\s*/g, ", ").trim(), line2: "", line3: "", city: "", postalCode: "" };
}

/** The lines to show, one per row, leaving out the empty ones. */
export function addressRows(text: string): string[] {
  const a = splitAddress(text);
  return [a.line1, a.line2, a.line3, a.city, a.postalCode].filter(Boolean);
}

/** An address for reading on screen, one line per part: street, area, city, postal code. Works on both the five-line form and a one-line "12 Temple Road, Colombo 07". */
export function addressStacked(text: string): string {
  return text
    .split(/\r?\n|,\s*/)
    .map((v) => v.trim())
    .filter(Boolean)
    .join("\n");
}
