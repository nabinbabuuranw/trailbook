# AUDIT_30.md: anti-AI UI audit, Day 8 Trailbook

Method: a self-audit against the 30 points in `platforms_100_master_prompt.md`, checked against the built CSS, the markup, the screenshots in `screenshots/` at 375 and 1440 px, and axe-core (`qa/axe-output.txt`). Done by the same worker that built the app, so an outside review could find more.

## A. The 30 points

| # | Point | Result | Evidence |
|---|---|---|---|
| 1 | harsh gradients | PASS | No gradients in CSS or markup (grep of src/index.css and components). |
| 2 | pure white backgrounds | PASS | Page bone #F1ECE1, surfaces paper #F8F5EE. #FFFFFF only as text on blaze and spruce buttons. |
| 3 | rainbow coloring | PASS | Five working colours plus ink; the route profile uses spruce, blaze and spruce-soft. |
| 4 | heavy drop shadows | PASS | No box-shadow in the build. |
| 5 | liquid glass | PASS | No backdrop blur or translucent panels. |
| 6 | generic purple and black | PASS | No purple. Dark tone is green-ink #17261F. |
| 7 | radial orbs | PASS | None. |
| 8 | excessive neon | PASS | None. |
| 9 | basic pastel palettes | PASS | Earthy spruce, blaze and stone; no pastel fills as the main colour. |
| 10 | default Lucide icons | PASS | No icon library loaded. Only the logo and the route sketch are drawn (custom SVG). |
| 11 | emojis as UI icons | PASS | None in the build. |
| 12 | default Inter, Geist, Space Grotesk | PASS | Barlow Condensed and Barlow. |
| 13 | unnecessary sparkle icons | PASS | None. |
| 14 | animated arrows | PASS | None. |
| 15 | hover animations on every element | PASS | Only colour change on buttons and links; no transforms. |
| 16 | repetitive three-feature-card layouts | PASS (reasoned exception) | Home has three numbered steps as plain columns with no cards. Kept because the booking sequence has exactly three steps. |
| 17 | colored left stripes on cards | PASS (fixed) | Left-border callouts and alert stripes were changed to top rules during the audit (src/index.css, Home.tsx, DepartureDetail.tsx, TripDetail.tsx, StaffDeparture.tsx). |
| 18 | repetitive bento grids | PASS | None. |
| 19 | unnecessary terminal mockups | PASS | None. |
| 20 | generic three-tier pricing | PASS | No pricing page. Prices are per departure. |
| 21 | generic soft rounded corners everywhere | PASS | 2 px radius on every control. |
| 22 | dot-grid backgrounds | PASS | None. |
| 23 | excessive em dashes | PASS | grep for the em-dash character in src, shared and api/src found none. |
| 24 | "It's not X, it's Y" copy | PASS | Read through the home page, footer and legal pages. The one list of limits ("What Trailbook is not") is a plain list of facts, not a rhetorical pattern. |
| 25 | repetitive checkmark bullet lists | PASS | No checkmarks. The limits list uses plain bullets. |
| 26 | fake testimonials | PASS | None. No reviews, counts or logos. |
| 27 | missing real product demos | PASS | Working booking, document tick, cancellation, staff confirmation, crew and permit changes, admin role change. See QA_REPORT.md. |
| 28 | missing skeleton loaders | PASS | A skeleton shows on every data load (Skeleton component in every page that fetches). |
| 29 | missing Terms of Service | PASS (draft) | /terms exists. Marked draft, not lawyer-reviewed. |
| 30 | missing Privacy Policy | PASS (draft) | /privacy exists. Marked draft, not lawyer-reviewed; Nepal data protection not checked. |

Score: 30 of 30 pass. Two results carry a reasoned exception (16) or a draft label (29, 30). Point 17 was a fail when first checked and was fixed before this audit was saved.

## B. Other mandatory items from the brief (not all met)

| Item | Result | Note |
|---|---|---|
| Distinct identity and palette | PASS, with a stated deviation | Palette built by hand, not picked on Coolors (DESIGN.md section 4). |
| UI UX Pro Max workflow | PARTIAL | Run and saved; its recommended style was not followed (DESIGN.md section 2). |
| 21st.dev components | NOT DONE | Search returned "Not signed in". No component IDs used. |
| Purposeful motion: animated hero, page transitions, scroll reversal | NOT MET | Only colour transitions; reduced-motion honoured. |
| Icon set designed for the product | NOT MET | No icons drawn beyond the logo. |
| Empty, error, loading, success states | PASS | Present on every data page and in each write (QA_REPORT.md, checks list). |
| Accessibility (keyboard focus, labels, contrast, semantics) | PASS on axe, 14 page states | 0 violations. Keyboard path was not separately tested end to end. |
| Terms and Privacy | PASS, draft | Not reviewed by a lawyer. |
| Lighthouse performance | NOT RUN | No score is claimed. |

## C. What the audit did not check

- Real device behaviour on a budget Android phone and slow networks.
- Keyboard-only walkthrough of every flow.
- Screen reader output (only axe rules were run).
