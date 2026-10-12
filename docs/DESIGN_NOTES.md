# Design notes: the "quiet gallery" direction

What the visual system is, why, and where it lives. Tokens: `src/styles/tokens.css`. Global rules and helpers: `src/app/globals.css`.

## Principles (and the research behind them)

A web search on what makes a site feel premium (summaries only; most sources are agency and design-blog opinion, not measured studies) converged on the same few points, which this system follows:

1. **Restraint beats decoration.** Premium comes from what is left out: a limited palette, one sparing accent, motion only on key interactions. → warm paper + deep walnut, a single muted brass accent used only for hairlines and small marks.
2. **Consistent spacing and a small set of type sizes.** Consistency across the whole system, not one trick (a serif font or more whitespace alone does not make a site feel expensive). → one fluid section rhythm (`--section-space`), a short type scale, uppercase tracked labels for secondary hierarchy.
3. **Editorial serif for headlines, a clean sans for body.** The common pattern on high-end furniture sites. → Cormorant Garamond (display) + Instrument Sans (text, forms, tables).
4. **Photography leads; whitespace paces the page like a showroom walk.** Dense grids undercut the feel. → large image frames, generous gaps, slow image zoom on hover.
5. **Layered, low-opacity, background-tinted shadows** rather than one heavy black shadow. → `--shadow-sm/md/lg`, used rarely (menus and dialogs); hairline borders do most of the work.
6. **`text-wrap: balance` for headings** so lines break evenly (supported in current Chrome, Edge, Firefox, Safari; harmless where not). Already applied to all headings.

Sources consulted (search results): [why some websites feel expensive](https://www.iiad.edu.in/the-circle/why-some-websites-just-feel-expensive/), [KIJO luxury web design principles](https://kijo.london/blog/luxury-website-design), [Tobias Ahlin on layered shadows](https://tobiasahlin.com/blog/layered-smooth-box-shadows/), [Josh Comeau on designing shadows](https://www.joshwcomeau.com/css/designing-shadows), [Chrome on text-wrap: balance](https://developer.chrome.com/docs/css-ui/css-text-wrap-balance), [Exhibea on luxury furniture sites](https://exhibea.com/blogs/shopify-plus-blog/luxury-furniture-website-design). The full articles could not be fetched from the build environment, so only their search summaries were used.

## Decisions

| Area | Decision |
|---|---|
| Corners | **Square everywhere** (all radius tokens are 0; form controls reset to 0). Hierarchy comes from hairlines and spacing |
| Buttons | Square, hairline; hover inverts fill and outline over 300 ms; 1 px press. Public calls to action use the `cta` size (small uppercase, tracked). `light` variant for dark bands |
| Type | Cormorant Garamond for display, scaled up with `font-size-adjust` to match the sans x-height, forced to **lining figures** (its default old-style numerals misread in prices); Instrument Sans for text and data (supports tabular numerals) |
| Colour | Paper `#f8f5ef`, walnut `#3a2c23`, charcoal text, brass `#9a7440` (decoration only). Computed contrast is listed in `tokens.css`; brass and stone never carry text |
| Motion | `--ease-out` slow-in/long-out; 150/300/700 ms; hero text rises once; links draw their underline; everything off under `prefers-reduced-motion` |
| Links | `link-draw` (always underlined, thickens on hover) for inline links; `link-draw-hover` (line appears on hover/focus) for card titles and navigation |
| Staff area | Same tokens, denser: serif page titles, tracked uppercase panel and column headings, hairline panels, brass edge marks the current page |

## Not done

Real photography and the final brand typeface/colours are still placeholders: when the owner supplies a logo, palette or font, change the tokens and nothing else. No dark mode.
