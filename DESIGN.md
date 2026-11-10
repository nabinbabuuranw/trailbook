# DESIGN.md: Trailbook

## 1. Audience and purpose (research notes)

- Who: owners and guides at small trekking agencies in Nepal (group departures, a few guides, several porters), and travellers who book one trip at a time.
- Job to be done: see which dates are open, hold seats, know who is confirmed, assign crew, and keep each traveller's documents and the trip's permit checks in one place.
- Setting: used on a laptop in the office and on a phone at the trailhead or a guesthouse with weak signal. Fonts and assets are self-hosted and the bundle is small (JavaScript about 223 KB, 69 KB gzipped, before fonts).
- Honesty is part of the product: permit rules change, so the design never implies approval.
- Research basis in this build: the UI UX Pro Max search (section 2) and the requirements in Nabin's brief. No competitor screens were studied for this build (UNVERIFIED research gap).

## 2. UI UX Pro Max (evidence)

Command run: `python3 ~/.agents/skills/ui-ux-pro-max/scripts/search.py "trekking agency group departures booking portal Nepal" --design-system -p Trailbook`. Output saved in `design-research/uiuxpromax-design-system-output.txt`. A second run (`--domain style`) is in `design-research/uiuxpromax-style-search.txt`.

What it recommended: a "Trust & Authority + Conversion" pattern, a Claymorphism style (soft 3D, thick borders, double shadows, 16 to 24 px radii), a teal and orange palette, and Varela Round with Nunito Sans.

What was done with it: not followed. Claymorphism with heavy shadows and 16 to 24 px radii is on the anti-AI list (items 4, 21 of the 30-point audit), and the teal and orange scheme is a generic template look. The trust and proof part was kept in a different form: the honesty panel on the home page and the permit disclaimers. The type choice was not taken either. The skill's output was reviewed and the parts that fit the brief were used.

## 3. 21st.dev (evidence)

`21st search "data table with filters"` and `21st search "hero section"` both answered "Not signed in. Run `21st login` or set TWENTYFIRST_TOKEN." with the token from the box's 21st environment file. No component IDs were used. All components are written for this build.

## 4. Coolors (stated deviation)

Nabin's standing order asks for a palette picked on his logged-in Coolors account. That account was not used for this build. The palette below was built by hand from five hexes and checked for contrast. This is the same deviation as Days 5, 6 and 7, and it is logged in `files/palettes_log.md`. No Coolors URL exists for this palette, so none is given.

## 5. Chosen direction: "Trail Register" (blaze marks on a field register)

- Metaphor: a trail register and the painted blazes on trail trees. Trails in Nepal are marked by paint on rock and tree. Blazes (short vertical bars) mark the logo, the departure dates and the labels.
- Layout: ruled registers, not card grids. Departures are rows with a dated block on the left, the trek and its tags in the middle, and the price on the right. Passengers and crew are ruled lists. The operations page is a table.
- Motif: an illustrative elevation profile on the home page with painted-blaze ticks on the climb. It is labelled "Illustrative sketch" and is not survey data.
- Corners: 2 px. Shadows: none. Gradients: none. Glass: none.
- Navigation: a single header row with an underline for the current page. Role-based links appear only when the role allows them.

## 6. Palette (built, not picked on Coolors)

| Token | Hex | Use |
|---|---|---|
| ink | #17261F | text |
| bone | #F1ECE1 | page |
| paper | #F8F5EE | surfaces and form fields |
| spruce | #2D5A4C | positive states, ticks, confirmed |
| spruce-deep | #1F4035 | dark buttons, secondary CTA |
| spruce-soft | #D8E2CB | soft fills (route profile) |
| blaze | #B5531F | primary action, the blaze mark |
| blaze-ink | #8F3E14 | blaze text on light surfaces |
| slate | #3C5A73 | notices and restricted-area tags |
| stone | #5E594E | secondary text |
| rule | #CFC6B2 | rules and borders |
| danger | #9E2B22 | errors and cancellation |

Contrast (WCAG 2.x, measured by script on 2026-11-10): ink on bone 13.37:1; ink on paper 14.46:1; stone on bone 5.91:1; stone on paper 6.40:1; white on spruce 7.84:1; white on blaze 4.97:1 (AA for normal text); white on blaze-ink 7.32:1; blaze-ink on bone 6.22:1; slate on paper 6.65:1; danger on paper 6.83:1.

Machine-readable copy: `palette.json`.

## 7. Type

- Barlow Condensed 600 and 700, uppercase with 0.015em tracking, for headings, labels and the logo.
- Barlow 400, 500 and 600 for text. Money and seat counts use tabular figures (`font-variant-numeric: tabular-nums`).
- Scale: 17 px body with 1.6 line height; headings from 1.35 rem to 4.1 rem.
- Both families are self-hosted through Fontsource. No external font requests.

## 8. Components and states

- Buttons: primary (blaze), spruce-dark, ghost. Minimum height 46 px for touch.
- Inputs: 46 px, paper background, visible focus ring (3 px slate outline).
- Status pills: requested (blaze), confirmed (spruce), cancelled (danger), completed (slate), draft (stone). The text carries the meaning, not the colour alone.
- Skeletons for every data load, empty states with a next step, error states with a Try again button, success states for booking, cancellation, saving a tick and changing a status.
- Dialogs: none. Cancellation uses an inline confirm.
- Tables: the operations table scrolls horizontally inside its own box, not the page.

## 9. Responsive breakpoints

Tested at 375, 768, 1024 and 1440 px (public pages at all four; signed-in flows at 375 and 1440). No horizontal page scroll at any tested width.

## 10. Motion

Minimal on purpose: colour transitions of 150 ms on buttons and links, and `prefers-reduced-motion` sets every transition to near zero. No animated hero, no scroll animation, no page transitions. This is short of the brief's motion list (see AUDIT_30.md, section B).

## 11. What was not done

- Custom icon set: not built. The UI uses text labels and the blaze mark.
- 3D, animated data visualisation, scroll-reversing animation: not built.
- Lighthouse performance scores: not run.
