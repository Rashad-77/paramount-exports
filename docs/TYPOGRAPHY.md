# Typography: font sizes by content type and screen size

Written for the public website. Desktop sizes were **measured** on the live pages at 1440px wide (home, collection, product page, premium, gallery, about, custom, contact, help, track, cart, checkout, privacy). Phone and tablet sizes follow one rule, so they are always in proportion.

## The rule

Industry practice is **fluid type**: each size is a CSS `clamp(minimum, fluid middle, maximum)`, so text grows smoothly with the screen instead of jumping at breakpoints. The browser interpolates between a small-screen size and a large-screen size. Utopia, Material and most design systems use this (see [Utopia’s clamp guide](https://utopia.fyi/blog/clamp/) and the [Colorado design tokens](https://dcs.colorado.gov/ids/digital-guidelines/design-tokens/typography-fonts-spacing)). Typical setups use a tighter scale ratio on phones (about 1.2) and a wider one on desktop (about 1.25 to 1.33), between roughly 320-375px and 1240-1440px.

How this site applies it:

1. **Range:** 375px (phone) to 1280px (computer). Below 375px a size holds its phone value; above 1280px it holds its desktop value. Tablets (768px) land in between: about 43% of the way (768px).
2. **Desktop sizes do not change.** They are the reference.
3. **Text at or below body size (16px) shrinks gently: to 90% of its computer size on a phone, never below 11px.** That covers body copy (16px to 14.4px), descriptions (15px to 13.5px), prices and meta (14px to 12.6px), captions (13px to 11.7px) and labels (12px to 11px). Form fields stay 16px on touch screens, because phones zoom the page when a smaller field is tapped. Product-card text (name, prices, New and Sale labels) scales with the card’s own width instead.
4. **Everything larger than body shrinks in proportion to how far above body it is.** On a phone a size keeps **30% of its excess over 16px**: phone = 16 + (desktop - 16) x 0.30. Big titles shrink a lot (68px to 31.6px, a 0.46 ratio), mid headings shrink moderately (28px to 19.6px, 0.70), and sizes just above body barely move (18px to 16.6px, 0.92). So the gap between headings and body text is compressed evenly, not each size cut by the same percentage.

CSS used for each size above body: `clamp(phone, calc(phone + (100vw - 375px) x slope), desktop)` where slope = (desktop - phone) / 905.

## Sizes by content type

| Content type | Desktop (1280px and up) | Tablet (768px) | Phone (375px) | Where |
|---|---|---|---|---|
| Big decorative number (home) | 88px | 59.5px | 37.6px | Home: the large figure in the About band |
| Page title on a banner (h1) | 68px | 47.4px | 31.6px | Collection, Premium range, Gallery, Contact, About, Custom |
| Home hero headline (h1) | 64px | 45px | 30.4px | Home |
| Premium section title | 56px | 40.2px | 28px | Premium: Something of your own, Explore |
| Premium piece name | 48px | 35.3px | 25.6px | Premium list |
| Section headline (h2) | 44px | 32.9px | 24.4px | Why choose Paramount, Furniture made well, How to order, Send an enquiry, From our collection |
| Product page price | 30px | 24.5px | 20.2px | Product page, sale price |
| Banner title (premium banner) | 38.4px | 29.5px | 22.7px | Collection page premium banner |
| Step numbers / large numerals | 36px | 28.1px | 22px | About and Help steps, Custom steps |
| Sub-headline (h3 large) | 30.4px | 24.7px | 20.3px | Home cards, Timber and Wood, Come and see it |
| Visit title | 28px | 23.2px | 19.6px | Contact: Visit the showroom; empty cart / checkout titles |
| Card heading | 26px | 22px | 19px | About: Timber selection style headings |
| Small heading | 24px | 20.8px | 18.4px | Contact: Call us, Privacy headings, Help step numbers |
| Form legend / ask heading | 22px | 19.6px | 17.8px | Custom: About the piece; Have a question? |
| Step heading (h3) | 20px | 18.4px | 17.2px | Custom: Tell us what you need |
| Large body / lead / was-price | 18px | 17.2px | 16.6px | Contact numbers, Gallery lead, product was-price |
| Product card name | 17px | 12-17px | 12-17px | Product cards: sized by the card’s own width, not the screen |
| Footer brand name | 16.8px | 16.8px | 16.8px | Footer (kept the same, it is within 1px of body) |
| Body text, paragraphs, lead copy | 16px | 15.4px | 14.4px | Premium descriptions, Contact copy, Privacy, About |
| Secondary body, descriptions | 15px | 14.4px | 13.5px | Home paragraphs, Help list, product buttons |
| Prices, categories, spec text, meta | 14px | 13.4px | 12.6px | Cards, product page, footer-style lines |
| Captions, quotes, footer links | 13px | 12.4px | 11.7px | Reviews, footer, tag line |
| Labels, buttons, badges, eyebrows | 12px | 11.6px | 11px | Buttons, New/Sale badges, form labels, footer headings (minimum) |
| Header menu | 11px | 11px | 11px | Header links on computers (hidden on phones) |

## Where it lives in the code

- `src/styles/tokens.css`: the Tailwind size tokens `text-lg` to `text-5xl`, `text-headline` and `text-display` are fluid.
- `src/styles/public.css`, `premium.css`: every `font-size` above 16px is a fluid clamp.
- Component classes such as `text-[clamp(...)]` in the public pages were converted the same way.
- To add a size: pick the desktop value, then use phone = 16 + (desktop - 16) x 0.30 and the clamp above.

## Not changed on purpose

- Product-card names scale with the card’s own width (container query units), 12px to 17px.
- The tiny sizes (11-15px) stay as they are for the same reason as body copy: they are already at the readable floor on a phone.

## Tablets use the desktop sizes (from 25 October 2026)

Every fluid size (`clamp(min, calc(min + (100vw - 375px) * growth), max)`) now reaches its desktop size at 768px wide instead of at about 1280px. Phones (under 768px) still scale between the phone size at 375px and the desktop size; tablets and computers use the desktop size. To keep it that way, a new size needs `growth = (max - min) in px / 393`.
