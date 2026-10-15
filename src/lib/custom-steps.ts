/** How a made-to-order piece works. Shared by the home page and the custom-furniture page so they never disagree. */
export const CUSTOM_STEPS = [
  { title: "Tell us what you need", body: "Describe the piece, its dimensions, the wood and finish you prefer, and attach any photographs or sketches." },
  { title: "We review and get in touch", body: "Someone from the team contacts you to confirm the details and answer questions." },
  { title: "You receive a quotation", body: "A written quotation sets out the specification, price and payment terms for you to accept." },
  { title: "We build, then deliver", body: "Once the quotation is accepted, the piece is made in our workshop and arranged for delivery or collection." },
] as const;
