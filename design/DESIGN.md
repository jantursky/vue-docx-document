# Design system

The demo app and the docs site share one visual language: a monochrome, editorial SaaS look
with a single cobalt accent, tight-tracked Inter type, hairline borders and blue-tinted
shadows. The tokens live in `design/tokens.css`; every UI surface reads them and nothing
else. No ad-hoc colors.

The generated documents (the invoice and the examples) are not bound by this system. They
pick their own colors, because a Word file is the user's, not ours.

## Color

| Token                  | Light     | Dark                     | Use                                                  |
| ---------------------- | --------- | ------------------------ | ---------------------------------------------------- |
| `--color-canvas`       | `#ffffff` | `#0e0f11`                | Page background                                      |
| `--color-paper`        | `#f4f5f6` | `#141518`                | Alternate bands, side panels                         |
| `--color-surface`      | `#ffffff` | `#18191d`                | Cards, inputs, preview frame                         |
| `--color-haze`         | `#eeeff1` | `#1f2125`                | Subtle fills, hovered rows, inset borders            |
| `--color-ink`          | `#1c1d1f` | `#eceef1`                | Headings, body text                                  |
| `--color-carbon`       | `#2e3238` | `#d3d8df`                | Secondary strong text, active nav                    |
| `--color-muted`        | `#5f6876` | `#a3abb7`                | Descriptions, secondary copy                         |
| `--color-subtle`       | `#677080` | `#7d8592`                | Captions, eyebrows, tertiary text                    |
| `--color-faint`        | `#9fa1a7` | `#5f6670`                | Placeholders, disabled                               |
| `--color-border`       | `#e4e7ec` | `#2a2d33`                | Default 1px border: cards, dividers, outline buttons |
| `--color-hairline`     | `#cad0d9` | `#353941`                | Input edges, stronger dividers                       |
| `--color-accent`       | `#2163e0` | `#5b8ff5`                | Links, focus rings, active tab marks, small icons    |
| `--color-accent-hover` | `#266df0` | `#7aa5f7`                | Hover on accent elements                             |
| `--color-accent-wash`  | `#e4edff` | `rgb(64 127 242 / 0.14)` | Selected rows, badge backgrounds                     |
| `--color-accent-line`  | `#bad0fa` | `rgb(91 143 245 / 0.35)` | Decorative blue outlines                             |
| `--color-button`       | `#232529` | `#f4f5f6`                | The only filled button                               |
| `--color-button-ink`   | `#ffffff` | `#101113`                | Text on the filled button                            |
| `--color-band`         | `#000000` | `#000000`                | Footer and promo band                                |
| `--color-danger`       | `#c4321f` | `#f07a68`                | Validation errors only                               |

Light text and accent colors are one step darker than the source palette (`#6f7988`, `#8f99a8`, `#266df0`) so small text passes WCAG AA on both canvas and paper. `--color-faint` is for placeholders and disabled states only.

Dark mode is derived, not sourced: surfaces step up from near-black in small increments,
text inverts to cool off-whites, the accent is lifted one step so it keeps 4.5:1 on dark
surfaces, and the filled button inverts to a light fill with dark text.

## Type

- **UI**: Inter (`@fontsource-variable/inter`), weight 500 by default, `font-feature-settings: 'ss03'`.
  Sizes 12, 13, 14, 15, 16, 18, 20. Tracking −0.02em at 14px, −0.01em at 16px, 0 at 12px.
  Line height 1.4–1.5 for body.
- **Display**: Inter Tight (`@fontsource-variable/inter-tight`), weight 600, for hero and
  section headings. 32 / 40 / 56px, line height 1.0–1.15, tracking −0.01em to −0.02em.
- **Eyebrows**: Inter 500, 12px, uppercase, +0.06em tracking, `--color-subtle`.
- **Code**: the platform monospace stack (`ui-monospace, SFMono-Regular, Menlo, monospace`) at 13px.

## Space, radius, borders, shadows

- Base unit 4px. Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 60, 80, 120.
- Compact inside components (8–12px gaps), generous between sections (80–120px).
- Max content width 1440px, centered; reading width for prose about 720px.
- Radius: 7px badges and tags, 10px buttons, inputs and tabs, 12px cards. Never above 12px.
- Borders: 1px `--color-border`; inputs use `--color-hairline`.
- Shadows are blue-tinted, never warm:
  - `--shadow-card`: `0 2px 3px -2px rgb(28 40 64 / 0.1), 0 4px 6px -2px rgb(28 40 64 / 0.04)`
  - `--shadow-raised`: `0 2px 6px 0 rgb(28 40 64 / 0.06), 0 6px 20px -2px rgb(28 40 64 / 0.08)`
  - `--shadow-float`: `0 12px 30px 0 rgb(0 0 0 / 0.04)` (the document preview sheets)
  - Focus ring: `0 0 0 4px` of `--color-accent-wash`, plus a 1px `--color-accent` border.

## Components

- **Primary button**: `--color-button` fill, `--color-button-ink` text, Inter 500 15px,
  radius 10px, height 40px, 12–14px horizontal padding, no border. One per view.
- **Secondary button**: surface fill, 1px `--color-border`, ink text, same size.
- **Ghost button**: no fill or border, ink text, for inline actions.
- **Tabs**: Inter 500 15px, inactive `--color-muted`, active `--color-ink` with a 2px ink
  bottom border. No background.
- **Card**: surface fill, 1px `--color-border` or `--shadow-card`, radius 12px, 24px padding.
- **Input**: surface fill, 1px `--color-hairline`, radius 10px, 36–40px tall, placeholder
  `--color-faint`, focus ring as above.
- **Badge**: radius 7px, 12px Inter 500, `--color-accent-wash` fill with accent text, or a
  1px border pill for neutral labels.
- **Preview sheet**: white page (the document is always white, also in dark mode) on
  `--color-paper`, `--shadow-float`, no radius, like paper on a desk.
- **Footer**: full-bleed `--color-band`, white links, `--color-subtle` group titles.

## Do

- Keep cobalt for links, focus, active states and small icons.
- Use Inter 500 as the default weight; 600 only for display headings and strong labels.
- Use line icons, 16–20px, 1.5px stroke, monochrome.
- Alternate canvas and paper bands between page sections.

## Don't

- No second accent color, no gradients on buttons, no decorative color.
- No button radius above 12px, no pill buttons.
- No positive letter spacing except on uppercase eyebrows.
- No cobalt fills behind body copy.
- No warm or black heavy shadows.
