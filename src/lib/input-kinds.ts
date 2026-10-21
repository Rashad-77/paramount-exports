/**
 * What a typed value may look like, by what the box asks for. A box with a kind drops every character that cannot belong in it as it is
 * typed or pasted, so "gg" can never end up in a price and digits can never end up in a person's name. Boxes that take free writing
 * (messages, descriptions, reasons, passwords, searches) have no kind and accept anything. The server still checks every value again.
 */
export type InputKind =
  | "money"
  | "percent"
  | "integer"
  | "phone"
  | "email"
  | "personName"
  | "place"
  | "address"
  | "postal"
  | "title"
  | "url"
  | "currency"
  | "countryCode"
  | "orderNumber"
  | "dimensions"
  | "budget";

const decimal = (v: string, intDigits: number, places: number) => {
  const cleaned = v.replace(/[^\d.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned.slice(0, intDigits);
  return cleaned.slice(0, dot).slice(0, intDigits) + "." + cleaned.slice(dot + 1).replace(/\./g, "").slice(0, places);
};

/** Letters of any language (with their marks), digits and a few joiners: plain characters a label or name can contain. */
const NOT_TITLE = /[<>{}\\^~|`\u0000-\u0008\u000b-\u001f\u007f]/gu;
const NOT_PERSON = /[^\p{L}\p{M}\s.'’-]/gu;
const NOT_PLACE = /[^\p{L}\p{M}\s.,'’-]/gu;
const NOT_ADDRESS = /[^\p{L}\p{M}\p{N}\s.,'’#/()&:-]/gu;

export function cleanInput(kind: InputKind, value: string): string {
  switch (kind) {
    case "money":
      return decimal(value, 10, 2);
    case "percent": {
      const d = decimal(value, 3, 2);
      return d !== "" && Number(d) > 100 ? "100" : d;
    }
    case "integer":
      return value.replace(/\D/g, "").slice(0, 9);
    case "phone":
      return value.replace(/[^\d+\-().\s]/g, "").slice(0, 40);
    case "email":
      return value.replace(/[^A-Za-z0-9._%+'@-]/g, "").slice(0, 200);
    case "personName":
      return value.replace(NOT_PERSON, "").replace(/ {2,}/g, " ").slice(0, 120);
    case "place":
      return value.replace(NOT_PLACE, "").replace(/ {2,}/g, " ").slice(0, 80);
    case "address":
      return value.replace(NOT_ADDRESS, "").replace(/[ \t]{2,}/g, " ").slice(0, 400);
    case "postal":
      return value.replace(/[^A-Za-z0-9 -]/g, "").toUpperCase().slice(0, 20);
    case "title":
      return value.replace(NOT_TITLE, "").replace(/ {2,}/g, " ").slice(0, 200);
    case "url":
      return value.replace(/[\s<>"'`\\^{}|]/g, "").slice(0, 300);
    case "currency":
      return value.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 3);
    case "countryCode":
      {
        // Shown with its plus, as it is dialled: +94. The server keeps just the digits.
        const digits = value.replace(/\D/g, "").slice(0, 3);
        return digits ? "+" + digits : "";
      }
    case "orderNumber":
      return value.replace(/[^\d\s-]/g, "").slice(0, 20);
    case "dimensions":
      return value.replace(/[^\dA-Za-z\s.,×*/"'-]/g, "").slice(0, 200);
    case "budget":
      return value.replace(/[^\dA-Za-z\s.,/+–-]/g, "").slice(0, 80);
  }
}

/** The input type, keyboard hint and autofill hint that suit each kind. */
export const KIND_PROPS: Record<InputKind, { type?: string; inputMode?: "decimal" | "numeric" | "tel" | "email" | "url" | "text"; autoComplete?: string }> = {
  money: { type: "text", inputMode: "decimal", autoComplete: "off" },
  percent: { type: "text", inputMode: "decimal", autoComplete: "off" },
  integer: { type: "text", inputMode: "numeric", autoComplete: "off" },
  phone: { type: "tel", inputMode: "tel", autoComplete: "tel" },
  email: { type: "email", inputMode: "email" },
  personName: { type: "text", inputMode: "text" },
  place: { type: "text", inputMode: "text" },
  address: { type: "text", inputMode: "text" },
  postal: { type: "text", inputMode: "text" },
  title: { type: "text", inputMode: "text" },
  url: { type: "text", inputMode: "url", autoComplete: "off" },
  currency: { type: "text", inputMode: "text", autoComplete: "off" },
  countryCode: { type: "text", inputMode: "numeric", autoComplete: "off" },
  orderNumber: { type: "text", inputMode: "numeric", autoComplete: "off" },
  dimensions: { type: "text", inputMode: "text" },
  budget: { type: "text", inputMode: "text" },
};
