# Latte cPanel design brief

Tracks erme2/Latte#59. The Figcraft designs for the admin console go in this folder. This brief sets what they must cover, so the designs and the frontend can be checked against it.

## Scope

- A basic cPanel-style shell: sidebar navigation, top bar and content area.
- Theme support from the start. Colours and type come from tokens, not from screen-specific values.
- Phone width works. The layout keeps a 16px side gutter and never scrolls horizontally.

## Screens

1. **Shell**: sidebar (collapsible), top bar with organization and account, content area.
2. **List / table**: header with actions, filter row, rows, pagination.
3. **Detail / edit form**: fields grouped in sections, save and cancel, inline validation.
4. **States**: empty, loading and error, shown on the list screen.

## Theme tokens

Every theme defines the same token names. The frontend exposes them as CSS custom properties on `:root`, with the dark values also set under `[data-theme="dark"]`.

| Token | Used for |
| --- | --- |
| `--color-bg` | Page background |
| `--color-surface` | Sidebar, cards, table rows |
| `--color-text` | Primary text |
| `--color-text-muted` | Secondary text, labels, placeholders |
| `--color-border` | Dividers, input borders |
| `--color-accent` | Primary buttons, active navigation |
| `--color-danger` | Destructive actions, validation errors |
| `--color-success` | Saved and confirmed states |
| `--font-body`, `--font-heading` | Typography families |
| `--space-1` … `--space-6` | Spacing scale |
| `--radius-sm`, `--radius-md` | Corner radii |

Themes to design: **light** (default) and **dark**. Every colour pair must reach WCAG AA contrast for text.

## Design file

The design source is **`latte-cpanel.figcraft`**, made with [FigCraft](https://github.com/storytold/figcraft) (0.15 or newer). It's a local file kept in git, so design changes are versioned with the code.

| Page | Contents |
| --- | --- |
| **Desktop** (1440×900) | Customers list, edit form and states (empty, loading, error), each in light (left) and dark (right) |
| **Mobile** (390×844) | Customers list and edit form, light and dark |

The logo is the Latte wordmark (erme2/Latte#63). `design/logo/latte-logo.svg` is the light version, copied from `design/logo/wordmark/`, and the shell uses it: the sidebar on desktop, and the top bar on phone. The letters use the navy text colour, and the cut-outs use the surface colour. The list has pagination controls, and the phone screens have a menu button (list) or back button (edit form).

Colours are variables in the **Theme** collection with two modes, **Light** and **Dark**. To check a screen in the other theme, select it and switch its Theme mode. The font is Inter, Latte's stack in `src/index.css`.

Regenerate the file with the build script (it overwrites `latte-cpanel.figcraft`, so make manual edits in FigCraft only after you stop regenerating):

```bash
python3 design/build/build_design.py > latte.jsonl
figcraft-cli run latte.jsonl --out design/latte-cpanel.figcraft
figcraft-cli export design/latte-cpanel.figcraft -o design/previews/ --page Desktop
figcraft-cli export design/latte-cpanel.figcraft -o design/previews/ --page Mobile
```

## Deliverables

- [x] Design file `design/latte-cpanel.figcraft`: shell, list, form and states in light and dark, plus phone width
- [x] Token values for both themes, matching the table above
- [x] PNG previews in `design/previews/` (Desktop and Mobile, exported with figcraft-cli 0.18.0)
- [ ] Review and approval of the designs before frontend work starts

## Out of scope

- The Latte product screens and their data, which come from the product extension.
- Code. The frontend follows these designs in a later ticket.
