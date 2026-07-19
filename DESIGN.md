# Scindia Web Design System

## 0. Research Log

- Existing UI extraction: `frontend/src/theme/colors.js`, `frontend/src/components/AppLayout.js`, task/project/staff pages, and current Tailwind usage define the product direction.
- Product surface: an operational household management dashboard. The UI should be compact, calm, and task-focused rather than a marketing page.

## 1. Direction

The web app uses an estate-office visual language: warm ivory canvases, maroon primary actions, gold accents, navy manager markers, and emerald approval states. Surfaces should feel formal and quiet, with restrained elevation and high scanability.

## 2. Color Tokens

- `bg.primary`: `#FDFBF7`, page canvas.
- `bg.secondary`: `#F5F0E6`, sidebars and quiet bands.
- `bg.tertiary`: `#EBE3D5`, inactive switches and stronger bands.
- `bg.card`: `#FFFFFF`, primary cards and modals.
- `bg.cardMuted`: `#FAF6ED`, nested panels and grouped rows.
- `bg.canvas`: `#FDFBF7`, full-height app shells.
- `bg.dark`: `#1A1210`, modal overlays and dark shells.
- `brand.maroon`: `#7B181E`, primary action and active navigation.
- `brand.maroonDeep`: `#5C1015`, deep header gradients and admin accents.
- `brand.gold`: `#D4AF37`, focus rings, overlines, and ceremonial accents.
- `brand.goldDeep`: `#B38B22`, readable gold text on light surfaces.
- `brand.emerald`: `#097969`, approve/completed states.
- `brand.navy`: `#000080`, manager/project authority markers.
- `text.primary`: `#1A1A1A`.
- `text.secondary`: `#4A4A4A`.
- `text.muted`: `#737373`.
- `text.inverse`: `#FDFBF7`.
- `border.subtle`: `rgba(212, 175, 55, 0.35)`.
- `border.medium`: `rgba(212, 175, 55, 0.65)`.
- `border.dark`: `rgba(123, 24, 30, 0.25)`.

## 3. Typography

- App body uses the current system sans stack from `index.css`.
- Display headings use the `font-display` utility where present.
- Page titles use 26-34px on desktop and 24-30px on mobile-width web screens.
- Card and modal headings stay compact at 16-18px.
- Overlines use uppercase, bold, 10-11px type with expanded letter spacing.

## 4. Layout

- App shell owns viewport height; side navigation is fixed on desktop and bottom navigation on mobile.
- Pages use centered containers with 20px mobile padding and 32-40px desktop padding.
- Operational grids use one column on mobile and two/three columns on desktop.
- Cards use 14-16px radii for app panels and 12px radii for nested rows and controls.

## 5. Primitives

- `Page`: max-width container with responsive padding and bottom space for mobile nav.
- `PageHeader`: overline, display title, optional subtitle, icon, and right-aligned actions.
- `Card`: bordered white surface with `shadow-card`; interactive cards add focus ring and small hover lift.
- `SectionCard`: card with compact title bar and padded body.
- `StatTile`: card with left accent rail, icon chip, KPI number, and label.
- `FilterChips`: horizontally scrollable segmented pill controls.
- `Avatar`: initials circle keyed by role color.
- `IconButton`: circular icon-only action with title/aria label.
- `Button`: pill/rounded command button with optional Lucide icon.
- `Spinner`: centered maroon loading indicator.
- `EmptyState`: centered icon, title, message, and optional action.
- `FileChip`: compact attachment row/chip with document icon, filename, size, and remove/open affordance.
- `DataList`: spreadsheet-like operational list for task and project indexes; desktop uses column headers and aligned rows, while mobile uses compact stacked row summaries without horizontal overflow.

## 6. States

- Focus rings use gold (`#D4AF37`) and must remain visible.
- Disabled actions use opacity plus `cursor-not-allowed`.
- Hover elevation is subtle and reserved for clickable cards/buttons.
- Modal overlays use dark warm scrims and centered cards with bounded width.
- Attachment viewers must not execute arbitrary uploaded content; images and sandboxed PDFs may preview, other files use a metadata fallback.
- Submission attachments use an 8 MB combined decoded-size limit.
- Index rows use full-row click targets with inset focus rings, subtle ivory hover states, and stable labels on mobile.

## 7. Accessibility

- Icon-only buttons need `aria-label` and `title`.
- File controls need visible labels and accept hints.
- Meaningful images need alt text; submitted photo thumbnails use descriptive alt text.
- Keyboard users must be able to add/remove attachments, submit, close modals, and open/close previews.

## 8. Accepted Debt

- The app is still in testing and intentionally keeps demo accounts and temporary-password UI.
- The web app currently stores bearer tokens in localStorage; moving to httpOnly cookies is a later auth architecture change.
