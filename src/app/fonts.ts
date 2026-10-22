import localFont from "next/font/local";

/**
 * The public site's typefaces, served from this site (the files ship in the @fontsource-variable packages). Loading them through
 * next/font means the two the first screen is set in are preloaded, instead of being found only after the stylesheet has arrived.
 * The family names are kept as they were (see tokens.css), so nothing that refers to them changes. Only the Latin range is shipped.
 */
export const epilogue = localFont({
  src: "../../node_modules/@fontsource-variable/epilogue/files/epilogue-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-epilogue",
  declarations: [{ prop: "font-family", value: "Epilogue Variable" }],
});

export const urbanist = localFont({
  src: "../../node_modules/@fontsource-variable/urbanist/files/urbanist-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-urbanist",
  declarations: [{ prop: "font-family", value: "Urbanist Variable" }],
});

/** Used only by the premium range, so it is fetched when the page shows it, not ahead of time. */
export const cormorant = localFont({
  src: [
    { path: "../../node_modules/@fontsource-variable/cormorant/files/cormorant-latin-wght-normal.woff2", style: "normal" },
    { path: "../../node_modules/@fontsource-variable/cormorant/files/cormorant-latin-wght-italic.woff2", style: "italic" },
  ],
  weight: "300 700",
  display: "swap",
  preload: false,
  variable: "--font-cormorant",
  declarations: [{ prop: "font-family", value: "Cormorant Variable" }],
});
