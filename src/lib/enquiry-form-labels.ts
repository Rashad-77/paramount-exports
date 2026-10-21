/**
 * The questions on the public enquiry and quotation form, in the order the customer sees them. The form and the staff page both read
 * these, so what staff see always matches what the customer was asked.
 */
export const CONTACT_LABELS = {
  name: "Your name",
  phone: "Phone number",
  email: "Email",
  preferredContact: "Best way to reach you",
} as const;

/** The "About the piece" part of the made-to-measure form. */
export const PIECE_FIELDS = [
  { key: "furnitureType", label: "What would you like made?" },
  { key: "dimensions", label: "Dimensions" },
  { key: "material", label: "Wood or material" },
  { key: "finish", label: "Finish" },
  { key: "budgetRange", label: "Budget range" },
  { key: "targetDate", label: "Date you would like it by" },
] as const;

export const PHOTOS_LABEL = "Reference photos or sketches";
export const PIECE_HEADING = "About the piece";
export const CUSTOM_MESSAGE_LABEL = "Anything else we should know?";
export const MESSAGE_LABEL = "Your message";

export const CONTACT_CHOICE_LABEL: Record<string, string> = { phone: "Phone call", whatsapp: "WhatsApp", email: "Email" };

/** The same answers as the staff see them: worded for the owner reading a customer's request, not for the customer filling it in. */
export const STAFF_CONTACT_LABELS = {
  name: "Customer name",
  phone: "Phone",
  email: "Email",
  preferredContact: "Preferred contact",
} as const;
export const STAFF_PIECE_LABELS: Record<(typeof PIECE_FIELDS)[number]["key"], string> = {
  furnitureType: "Furniture requested",
  dimensions: "Dimensions",
  material: "Wood or material",
  finish: "Finish",
  budgetRange: "Customer's budget",
  targetDate: "Wanted by",
};
export const STAFF_PHOTOS_LABEL = "Reference photos / sketches";
export const STAFF_PIECE_HEADING = "Piece details";
export const STAFF_CUSTOM_MESSAGE_LABEL = "Additional notes";
export const STAFF_MESSAGE_LABEL = "Customer message";
