---
name: StarTune
description: Bring your stars into focus. A GitHub star library read as a scanned star field.
colors:
  acid-lime: "#c8ff3a"
  black-field: "#050607"
  panel-ink: "#08090b"
  popover-ink: "#0e1013"
  muted-ink: "#101215"
  hover-ink: "#14161a"
  selected-ink: "#16181b"
  hairline: "#23262a"
  input-stroke: "#30343a"
  grid: "#1c1f23"
  grid-strong: "#2c3036"
  starlight: "#e8eae6"
  dust: "#8d938f"
  dim-leader: "#5a6068"
  class-ob-blue: "#6ea8ff"
  class-af-white: "#e9e4d4"
  class-g-yellow: "#ffd84d"
  class-k-orange: "#ff9b42"
  class-m-red: "#ff5b4d"
  warning: "#ff9b42"
  destructive: "#ff5b4d"
typography:
  display:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 4vw, 3rem)"
    fontWeight: 600
    lineHeight: "1.05"
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: "2rem"
    letterSpacing: "-0.025em"
  readout:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: "1.75rem"
    letterSpacing: "-0.025em"
    fontFeature: "\"tnum\""
  title:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    letterSpacing: "0.01em"
  body:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
    fontFeature: "\"ss01\", \"cv11\", \"tnum\""
  caption:
    fontFamily: "Geist Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
  measure:
    fontFamily: "Geist Mono Variable, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 400
    letterSpacing: "0.02em"
    fontFeature: "\"tnum\""
rounded:
  sm: "2px"
  md: "4px"
  lg: "6px"
  xl: "10px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "2.5": "10px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "transparent"
    textColor: "{colors.acid-lime}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "rgba(200, 255, 58, 0.10)"
    textColor: "{colors.acid-lime}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.starlight}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-outline-hover:
    backgroundColor: "{colors.hover-ink}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.dust}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  button-ghost-hover:
    backgroundColor: "{colors.hover-ink}"
    textColor: "{colors.starlight}"
  input:
    backgroundColor: "{colors.black-field}"
    textColor: "{colors.starlight}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  panel:
    backgroundColor: "{colors.panel-ink}"
    textColor: "{colors.starlight}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  readout:
    backgroundColor: "transparent"
    textColor: "{colors.starlight}"
    typography: "{typography.readout}"
    padding: "10px 16px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.dust}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  nav-item-active:
    backgroundColor: "{colors.selected-ink}"
    textColor: "{colors.starlight}"
  badge-outline:
    backgroundColor: "transparent"
    textColor: "{colors.dust}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: "1px 8px"
  tab-trigger-active:
    backgroundColor: "{colors.selected-ink}"
    textColor: "{colors.starlight}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
  tooltip:
    backgroundColor: "{colors.popover-ink}"
    textColor: "{colors.starlight}"
    typography: "{typography.caption}"
    rounded: "{rounded.md}"
    padding: "6px 10px"
  field-callout:
    backgroundColor: "{colors.black-field}"
    textColor: "{colors.starlight}"
    height: "40px"
    padding: "0 11px"
---

# Design System: StarTune

## Overview

### Creative North Star: "The Scanned Star Field"

StarTune reads a GitHub star library the way lidar software reads a room: as a black field of points you can turn in your hand. Every repo is a point placed honestly (year starred, popularity, recency of activity) and coloured by the stellar class of its health. The interface around that field is an instrument, not a dashboard. Panels are drawn by 1px hairlines on near-black ink rather than by fills or shadows; off-white Geist carries names and counts; Geist Mono is reserved for measurements. Density is high and calm: rows of 10px vertical padding, 13px sentence-case panel titles, numbers in tabular figures everywhere.

There is exactly one luminous voice, acid lime, and it behaves like a laser in a dark lab: thin lines, the selection ring, the focus ring, the hover leader line, the primary action's outline. It never becomes a lit surface or a glow. All other colour is data: the stellar-class ramp from hot blue to cool red, always paired with a second signal so colour is never the only cue.

The user explicitly rejected neon-and-glass styling and the quiet neutral fallback on the way here. The world is dark and futuristic by restraint: black, hairline, one lime line, and data bright enough to read.

### Key Characteristics

- Black field (#050607) with panels separated by 1px hairlines, not tonal blocks or shadows.
- One accent, acid lime, used only as a line, ring, outline or small mark.
- Health speaks stellar spectral classes O/B, A/F, G, K, M, with hollow and dimmed marks as redundant cues.
- Geist for language, Geist Mono for measurement; tabular numerals on by default.
- Spectacle only where it explains: the orbitable 3D star field is the signature, and everything around it stays quiet.

## Colors

A black instrument palette: near-black inks stepped by a few lightness points, one acid-lime signal, and a five-step stellar ramp that carries all data meaning.

### Primary

- **Acid Lime** (acid-lime): The only accent. Primary action outline and label, focus ring, text caret, selected-tab underline, the hover leader line, drop-line and selection ring in the star field, the progress indicator, checked checkbox and switch, the connected-status dot and the logo mark. Selection highlight uses it at 28% mixed into transparent.

### Neutral

- **Black Field** (black-field): Page background, input fill, callout box fill in the canvas, and the floor the field sits on.
- **Panel Ink** (panel-ink): Panel and card fill. One step above the field, so the hairline does the separating work.
- **Popover Ink** (popover-ink): Floating layers only: menus, popovers, tooltips, dialogs, toasts, the sync pill, the bulk-action bar.
- **Muted Ink** (muted-ink): Skeletons and avatar placeholders.
- **Hover Ink** (hover-ink): Row and control hover, highlighted menu items (usually at 60% on list rows).
- **Selected Ink** (selected-ink): Active nav item, active tab, default badge, progress track.
- **Hairline** (hairline): Every panel border, divider and separator. The structural line of the whole system.
- **Input Stroke** (input-stroke): Outline buttons, inputs, unchecked checkboxes, switch track, inactive callout boxes.
- **Grid** (grid) and **Grid Strong** (grid-strong): Plot ink. Grid draws floor and wall lines and the class-proportion track; Grid Strong draws axis edges, tick marks, scrollbar thumbs and the outline-button hover border.
- **Starlight** (starlight): Primary text, callout titles.
- **Dust** (dust): Secondary text, axis tick labels, measurement readouts, inactive nav.
- **Dim Leader** (dim-leader): Leader lines and rings for non-accent callouts (the persistent riser labels), and the neutral "Other" category on the star map's language view.

### Data: Stellar Classes

- **Class O/B Blue** (class-ob-blue): Thriving.
- **Class A/F White** (class-af-white): Active. A warm white so it never reads as the starlight text colour.
- **Class G Yellow** (class-g-yellow): Quiet.
- **Class K Orange** (class-k-orange): Dormant. Drawn at 0.75 opacity everywhere it appears.
- **Class M Red** (class-m-red): Archived. Drawn as a hollow ring (1.2 to 1.5px stroke), never a filled dot.
- **Warning** (warning) and **Destructive** (destructive): Deliberately share the K and M hues, so "likely cruft" counts and destructive actions speak the same language as dormant and archived marks. Warning also marks demo mode.

Every class holds at least 6.6:1 against the black field, and all class pairs stay distinguishable under colour-vision deficiency (closest pair: quiet and dormant). The language view of the star map reuses the blue, orange and warm-white hues as three categories plus Dim Leader for "Other"; the two views are mutually exclusive and each carries its own legend.

### Named Rules

**The Line-Not-Light Rule.** Acid lime is drawn, never poured. It appears as a 1px line, a ring, an outline, an underline, text on the primary action, or a mark no bigger than a control (checkbox, switch, status dot, logo). It is never a panel fill, a button fill, a background wash or a text glow.

**The Color Is Never Alone Rule.** Every health colour travels with a second cue: archived is hollow, dormant is dimmed to 0.75, and every legend swatch carries its class letter (O/B, A/F, G, K, M) in mono and its name in words.

**The One Signal Rule.** Lime is the only non-data hue. Orange and red appear only as data or as warning and destructive states; no decorative second accent.

## Typography

**Display Font:** Geist Variable (with ui-sans-serif, system-ui)
**Body Font:** Geist Variable (with ui-sans-serif, system-ui)
**Label/Mono Font:** Geist Mono Variable (with ui-monospace)

**Character:** One clean grotesk at modest sizes and semibold weight does all the speaking; its mono sibling is the instrument's voice, reserved for what was measured. The body enables stylistic set ss01, cv11 and tabular numerals globally, so every count lines up in columns.

### Hierarchy

- **Display** (600, 2.25rem to 3rem, tracking -0.025em): The sign-in promise ("Bring your stars into focus."). Only on the entry screen.
- **Headline** (600, 1.5rem, 2rem, tracking -0.025em): Page titles in the page header and the first-run title.
- **Stage name** (600, 1.875rem, tracking -0.025em): The repo under review on the triage card, the one object a decision is about. Only there.
- **Readout** (600, 1.25rem, 1.75rem, tabular): Numbers in a panel's readout strip; may take the warning colour for a cruft count.
- **Title** (600, 13px, tracking 0.01em): Panel headings, sentence case. Quiet instrument labels, not kickers.
- **Body** (400, 0.875rem, 1.25rem): Rows, buttons, inputs, menu items. Repo names render owner in Dust and name in medium Starlight.
- **Caption** (400, 0.75rem, 1rem): Panel subtitles, readout labels, hints, badges, legends, footer instructions; almost always in Dust.
- **Measure** (400, 11px mono, tracking 0.02em, tabular): Axis ticks, the camera readout ("yaw -18° pitch 21° · 420 stars"), callout stat lines, class letters, rank numbers, keyboard hints.

### Named Rules

**The Mono Measures Rule.** Geist Mono marks a measurement: an axis value, a coordinate, a class letter, a rank, a key. Names, labels and headline numbers stay in Geist with tabular figures.

**The Sentence Case Rule.** Headings and labels are sentence case at 13px semibold or smaller. No uppercase eyebrows, no letterspaced kickers above titles.

## Layout

A fixed left rail (14rem) with a hairline right edge holds the logo, six nav items and Settings pinned at the bottom; a 56px sticky top bar (Black Field at 95% with a light backdrop blur) carries the connection status, sync control and account menu. Content sits in a centred column capped at 72rem with 16px gutters on mobile and 32px from md up, 32px top padding, and extra bottom padding on mobile to clear the tab bar.

Below md the rail disappears: the logo moves into the top bar and a five-item bottom tab bar (44px minimum targets, safe-area aware, 11px labels) replaces it. At xl the Overview runs the field panel beside a 17rem side column; at lg secondary tables pair into two columns; below that everything stacks.

Rhythm is a 4px grid: 16px between panels, 24px under the page header, panel headers at 12px by 16px, list rows at 10px by 16px with hairline dividers between them (dense table rows such as the Stars library run 10px by 12px). Page headers align the title and subtitle left with actions bottom-aligned on the right, wrapping under on narrow widths.

The star field sizes to its container: height is 85% of its width, clamped between 320px and the host's maximum (540px on Overview, 680px on Star map). Below a 560px container width it drops side axis labels and persistent callouts to keep the cloud legible.

## Elevation & Depth

The resting system is flat. Panels sit one lightness step above the field and are separated by hairlines; there are no shadows on anything that does not float. Real depth lives inside the star field, where it means something: a perspective camera, points painted far to near, nearer points brighter (alpha falls from 1.0 to 0.5 with distance), and a floor and back wall drawn in grid ink.

Shadows appear only on floating layers, always pure black, always soft, never coloured.

### Shadow Vocabulary

- **Tooltip** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.3), 0 4px 6px -4px rgb(0 0 0 / 0.3)`): Tooltips.
- **Overlay** (`box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.4), 0 8px 10px -6px rgb(0 0 0 / 0.4)`): Menus, popovers, toasts; the sync pill and star map tip use the lighter tooltip-size shadow at the same 0.4 strength.
- **Modal** (`box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.5)`): Dialogs and the floating bulk-action bar, over a black 60% backdrop.

### Named Rules

**The Hairline Rule.** Structure is a 1px Hairline border on Panel Ink. If a region needs separating, draw a line; do not add a fill step or a shadow.

**The Floating-Only Shadow Rule.** A shadow means the element is above the page (menu, popover, tooltip, dialog, toast). Resting panels never carry one.

## Shapes

Corners are small and crisp: 2px on tab triggers, checkboxes and kbd hints; 4px on buttons, inputs, nav items, menu items and tooltips; 6px on panels, cards, popovers and menus; 10px only on dialogs. Badges, status dots, avatars in the account trigger and health swatches are full circles. Inside the canvas, callout boxes are square-cornered rectangles joined to their point by a straight leader line and a ring 4px outside the mark, which keeps the field reading as scan software rather than UI chrome.

Proportion is drawn with lines, not bars: class shares are a 1px coloured line over a 1px grid track, progress is 2px (1px for the global sync bar). The five-point star is the recurring glyph: the logo and the small star beside each callout's stat line. The logo is the scanned star: a solid lime regular star (inner radius 45% of outer, joins rounded) centred inside four lime scanner corners, drawn on a 24-unit grid so the 2-unit frame lands on whole pixels at its 24px size and the star clears the frame evenly on every side. Where it links home (the rail and the mobile top bar) it is duo-tone on hover and keyboard focus: the corners turn Starlight and close in by 1px over 150ms while the star stays lime, a scanner locking on. The favicon is the same mark on a Black Field tile whose corner radius is concentric with the frame's rounded corners (the frame's outer curve plus the gap to the tile's edge), so the two curves run parallel; the frame is thickened slightly so it holds at 16px. App icons use the mark at its own weight: the same tile at 192 and 512px, and full-bleed with more inset where the platform masks the shape (Apple touch icon, Android maskable). On the entry screen the logo runs large: a 36px mark (1.5 times the grid, so the frame still lands on whole pixels) with a 20px wordmark and a 12px gap. That screen ends in a quiet credit, "Open source by @nerdstep", in caption Dust with underlined links to the repo and the author.

## Components

### Buttons

Every clickable control (buttons, tabs, menu items, checkboxes, switches, role="button") shows the pointer cursor; disabled controls keep the default arrow. Tailwind v4 dropped the pointer on buttons, so a base-layer rule in `src/styles.css` restores it.
Thin, outlined, quiet until touched.

- **Shape:** gently squared (4px), 36px tall, 14px side padding; small size is 32px with 10px padding and 13px text.
- **Primary:** transparent with an acid-lime 1px border at 80% and a lime label. One per view: "Start triage", "Sign in with GitHub" (or "Sign in with a token" on installs without an OAuth app, whose form then opens in its place, ahead of the outline "Explore with demo data").
- **Hover / Focus:** primary hover washes lime at 10% (15% when pressed); every button focuses with a 1px lime ring offset 2px from the field. State transitions run 100ms.
- **Outline:** transparent with an Input Stroke border and Starlight label; hover lifts the border to Grid Strong and fills Hover Ink. The default secondary action.
- **Ghost:** Dust label, no border; hover fills Hover Ink and brightens to Starlight. For in-panel actions like Shuffle.
- **Destructive:** transparent with a red border at 35% and a red label; hover washes red at 10%.

### Chips and Badges

- **Style:** full pill, 1px Hairline border, transparent, 12px medium text in Dust (health and growth badges lift text to Starlight at 85%).
- **Health badge:** a 6px class-coloured dot (a ring for archived), the health name, then the class letter in 10px mono Dust. Tooltip gives the class and a plain-language hint.
- **State variants:** warning and danger badges tint their border at 25% and fill at 10% of the hue.
- **Legend toggles (star map):** 28px rounded-4px outlined chips; turned-off categories drop to 50% opacity.

### Cards / Containers

- **Corner Style:** 6px.
- **Background:** Panel Ink.
- **Shadow Strategy:** none (see The Floating-Only Shadow Rule).
- **Border:** 1px Hairline; internal header separated by a bottom hairline.
- **Internal Padding:** header 12px by 16px with a 13px semibold title and optional caption subtitle; rows 10px by 16px divided by hairlines; a hairline-topped footer strip for instructions or a "see all" link.

### Readout Strip

The panel header doubles as an instrument readout: the panel title on the left, then a row of linked readouts divided by vertical hairlines, each a caption label over a 20px semibold tabular number with an optional caption detail. Each readout links to the view that explains it and fills Hover Ink on hover. This is how headline numbers are shown; there is no row of separate stat cards.

### Inputs / Fields

- **Style:** 36px, 4px corners, Black Field fill, 1px Input Stroke border, 12px side padding, Dust placeholder, lime caret.
- **Focus:** the border shifts to lime at 70%; no ring, no glow.
- **Error / Disabled:** errors sit below in a 4px-corner box with a red 30% border and red 10% fill; disabled drops to 50% opacity.
- **Checkbox / Switch:** 16px 2px-corner checkbox, Input Stroke when empty, solid lime with a black check when on. Switch is a 36 by 20 track in Input Stroke that turns lime when on; the thumb turns black. These are the only lime fills, and they are control-sized marks.

### Navigation

- **Rail item:** 32px tall, 4px corners, 16px icon and 14px label in Dust; hover fills Hover Ink at 60% and brightens text; active fills Selected Ink with a medium Starlight label. Transitions 100ms.
- **Tabs:** a 36px outlined segment on Black Field with 2px inner padding; triggers are 13px medium Dust; the active trigger fills Selected Ink and carries a 1px lime underline drawn as an inset shadow.
- **Mobile:** bottom tab bar with 20px icons whose stroke thickens (1.75 to 2.25) for the active route, labels at 11px.
- **Menus:** Popover Ink, 6px corners, 4px inner padding, 176px minimum width; items highlight with Hover Ink; icons sit in Dust. Open and close scale from 95% with a fade over 150ms.

### Star Field (signature)

A canvas 3D point cloud of the whole library. Axes are honest and labelled: year starred left to right (mono year ticks), popularity bottom to top on a log scale (mono ticks on whichever vertical edge is leftmost, so the axis never cuts the cloud), recency of push as depth ("Pushed recently" near, "Stale" far). The floor and back wall are drawn in grid ink, cube edges in Grid Strong; axis titles are 11px medium Geist.

- **Marks:** circles sized by popularity, coloured by stellar class, hollow for archived and dimmed for dormant, faded with distance.
- **Interaction:** drag or arrow keys to orbit with eased inertia (velocity decays by 0.92 per frame; pitch clamped); hover within 14px draws a lime ring, a lime leader to a callout and a dashed lime drop-line to the floor; click or Enter opens the repo; [ and ] step through stars, risers first. A "Reset view" ghost control sits top right. Isolating a class (from the health panel) dims every other point to 10%.
- **Callouts:** 40px square-cornered boxes on Black Field: a 12px semibold name over a mono stat line with a small star glyph. The active callout uses a lime border and leader; persistent riser callouts use Input Stroke boxes and Dim Leader leaders, are placed by a slot search that avoids points, labels and other boxes, and are skipped when no clean slot exists. Callouts hide while the field moves.
- **Camera readout:** mono yaw, pitch and star count bottom left.
- **Motion:** a short intro tilt from flat to the default pitch on mount; reduced motion snaps straight to the final view and removes inertia.
- **Variants:**
  - *Sync scan* (the Overview field while a later sync runs): the first-run scan on real data. A lime scan plane sweeps the field along the year axis every 3.2s, its outline at 16% and its floor edge at 90%, and each star it has just passed wears a fading lime ring. Riser callouts stay hidden while it runs, as for any motion. Reduced motion draws no plane; the header's "Syncing…" carries it.
  - *First-run scan* (the empty Overview, before the first sync): a hairline-gridded field panel above the title. While the first sync runs, a 1px lime scan line sweeps it every 2.6s, and each star fetched so far is revealed as a point when the line passes, with a lime ring that expands and fades (0.7s). The count is real; the positions are decorative and seeded, so the points are neutral Starlight, never class colours, which would imply health data that hasn't arrived. Below it, the live label and a 2px progress line; the global sync bar stays hidden on this screen. Reduced motion drops the line and rings: points simply appear as they arrive. The copy makes no promise about how long a sync takes. The demo plays it too: "Explore with demo data" starts at this screen and its fake sync is paced like a real one (100 stars a step), ending on the full demo Overview.
  - *Ambient* (sign-in showcase): beside the copy column, sized to the space right of it and centred vertically, so the readout "Sample star field · N generated repos" sits just under the cube, lined up with it. Slow continuous auto-orbit. A callout tour labels one star at a time (the risers, then the most popular) with the full lime ring, drop-line and callout, moving on every 4.5s; the callout keeps its slot beside its star as the field turns. Hovering a star (desktop) shows its callout and pauses the orbit; nothing opens and the canvas takes no keyboard focus. Callouts never land over the copy column. Reduced motion stops the orbit and the tour (one fixed callout). Only ever fed generated sample data, labelled as such.
  - *Compact* (insets such as Triage's "Where it sits"): no Reset control, axis titles or readout; tick values only.
  - *Highlight*: one repo pinned with the lime ring, drop-line and callout; every other point dims to 28%.
  - *Outcome* (triage decisions): the one authored moment outside the intro. Over 450ms with a strong ease-out, a kept star grows, rises and comes forward with an expanding lime ring; an unstarred star shrinks, fades to 15% and falls back inside a contracting Class M ring. It is drawn from the star's own record (so it survives an optimistic unstar), never blocks the queue, holds the next pinned callout until it has played, and is skipped under reduced motion.
  - *Lit and ringed* (the Stars library's "In the field" panel): stars matching the current filters stay at full strength and the rest dim to 14%; selected rows wear thin lime rings; the hovered or keyboard-focused row is pinned with the lime ring, drop-line and callout without dimming anything else. Callouts keep a 10px inset from compact panel edges. Axis titles draw after the points with a Black Field outline, so labels such as "Stale" stay legible over the cloud.
- **Accessibility:** focusable canvas with a full aria description of the axes and keys; a polite live region names the selected star, its class and how to open it.
- **Legend controls:** the Star map's control row (colour by Health or Language, legend chips that hide a class or language, a mono visible-star count) drives both the Field and the Flat view, so switching views never loses a filter. Hidden keys drop out entirely: no marks, no hover, no callouts.

### Flat Scatter

The Star map's zoomable 2D view, held to the Field's grammar so the two read as one instrument: hairline axis frame, Geist Mono tick values, axis titles in words ("Popularity (stars)", "Year starred"), legend chips with mono class letters. Hover draws the same lime ring, leader, square callout (12px semibold name over a mono stat line with the drawn star: "42.9K · 2016 · +8K this week") and a dashed lime drop-line to the time axis; at rest the three fastest risers carry Input Stroke callouts with Dim Leader leaders, hidden while zooming or panning. A ghost "Reset view" sits top right inside the plot, as in the Field. [ and ] step through stars, Enter opens, a polite live region names the selection. The plot height is capped (55% of width, 320 to 540px) so the panel fits a laptop viewport.

### Stars Table

The library as an instrument table on a shared column template: select, class (dot plus mono letter, tooltip with the class name), repository (name as a button, cruft badge, language in Dust then a one-line description), stars right-aligned with "+N 7d" growth beneath, pushed and starred as compact relative times ("5mo ago"), and list (first List plus "+n", a single-line Clef suggestion chip, or "Unlisted"). Each row has two click zones: the full-height left strip selects (shift-click selects a range) and the rest opens the repo, with the name underline dropping while the pointer is in the select strip. Row actions float over the List cell on hover or focus rather than reserving a column, and stay shown while their menu or list picker is open. The list is virtualized; behind it, faint stand-in rows (a checkbox square, a name bar and a description bar on the row hairline, painted in CSS) fill any gap a fast fling opens before real rows arrive, so the table never flashes black. The column header sits sticky under the sticky filter bar; Repository, Stars, Pushed and Starred sort (Starred toggles newest and oldest) with aria-sort on the column headers. The filter bar ends in guide words: the first and last repo in view and the row range, in mono. On phones rows stack: class dot, name, description, then language, stars and push age as text. Language is always words, never a GitHub colour dot, so the class colour stays the only data colour in a row.

### Constellation (List cards)

Each List card draws its members as a small constellation on axes shared by every card on the page (year starred left to right, popularity bottom to top), so lists compare at a glance: marks sized by popularity and coloured by class (archived hollow, dormant at 0.75), joined by the minimum spanning tree of the 80 brightest in Grid Strong, over a hairline baseline. Each mark has a 7px hit area, a 1px lime ring on hover, a native name tooltip, and opens the repo on click. The baseline carries mono ticks for the first year and "now"; a muted line under the section heading names the shared axes. Below it: the count readout ("13 repos"), a cruft badge, the health-mix bar and the top languages as text.

### Momentum Plot (Trending)

Growing repos placed by popularity (x, log) against new stars in the window (y, log), so "big and steady" and "small and exploding" separate. Dashed Grid Strong diagonals mark constant growth rates (0.5%, 2%, 10% a week; 2%, 10%, 40% a month), labelled in mono at the right. Marks are class-coloured 3px dots. At rest on wide screens up to three leaders of the current ranking get Input Stroke callouts with short Dim Leader leaders, each placed by a slot search beside its own point that avoids marks and other boxes (a leader with no clean slot stays unlabelled), as in the Field and Star map; hover, or hovering a row in the ranked list, rings the repo in lime with a dashed drop-line to the popularity axis and a lime-bordered callout ("+8K · 42.9K total · 23%"). Click opens. Axis titles in words: "New stars, 7 days", "Popularity (stars)". In the 7-day window a "Pace trails" switch (on by default) adds a trail to each ranked repo: a thin class-coloured line from its weekly pace over the previous 23 days ((d30 − d7) × 7 / 23, at popularity stars − d7) to this week's dot, with a small hollow start mark, so speeding up and slowing down read directly. Trails skip estimated growth and earlier paces under one star a week; the active repo's trail turns lime and the rest dim.

### Spectral Bar (Trending rows)

Ranked magnitude drawn as fine spectral lines (2px on, 1px off) on a fixed stellar spectrum running cool to hot: Class M red, K orange, G yellow, A/F white, O/B blue. The fill's length is the value relative to the leader, and because the spectrum is fixed to the full track, how far a bar reaches into it repeats the value: the fastest risers burn blue-white, slow ones stay red. The full spectrum sits behind at 15% as the track. 10px tall, desktop only; the row's mono readout ("21.4K total · 12.5%") and the growth badge carry the exact numbers. This is the only place the class ramp is used as a scale rather than as health, and it never appears next to health dots without the readout.

### Star History (Your repos)

Each of the owner's public repos as a trail of its current stargazers over time on a log axis, coloured by stellar class (archived dashed, dormant at 0.75), ending in its star at "now": a class-coloured dot sized by popularity, hollow when archived. All time is cumulative; 1 year and 90 days rebase every trail to stars gained in the window, so a small repo's good quarter reads next to a big repo's history. A right gutter labels the biggest seven trails (name, mono value), relaxed vertically so labels never overlap, with Dim Leader (`--dim-leader`) elbows when a label is displaced; narrow screens drop the gutter. Hover finds the nearest trail at the pointer's time: the trail turns lime (others drop to 0.16), a dashed Grid Strong crosshair marks the time, and a lime-bordered callout with the class star glyph gives "+690 · Aug 11, 2026", prefixed "≈" where the history is sampled (repos past 1,000 stars, before their newest 100); on narrow screens the callout sits above or below the point and is clamped inside the chart. Trails ignore the pointer before their first star. A colour key under the chart shows each class as a line sample (archived dashed) with its letter. Click focuses the repo. The chart fills the height its row gives it (260 to 520px), so it never leaves dead space beside a taller panel.

### Your repos page

A readout strip (stars, last 30 and 7 days; three across even on phones, "≈" when a window reaches into sampled history, each a button that sorts and scrolls to the table) over the Star History, beside a Needs Attention panel grouped "Waiting on you" (other people's PRs and issues older than 14 / 7 days), "Worth a look", and "Housekeeping" (unreleased work, archive candidates, missing license, description or topics); every item links to the GitHub page to act on and says why it fired. Counts past the 10 PRs and issues read per repo say so ("10+ PRs waiting", "among the 10 newest"). The repo table keeps the Stars Table grammar (class dot with mono class letter, name with muted description, mono measurements; a keyboard-focused row gets the lime left line, ring and hover fill) with 26 weekly bars on one shared square-root scale (whole stars per week, summing to the real gain; a flat baseline for repos with no stars, "couldn't chart" with a Retry above the chart when GitHub fails), the stars total with "+N 30d", up to two signal chips (level 2 in Input Stroke and foreground, the rest Hairline and muted) and push age. Clicking a repo focuses the whole page on it, shown by a lime-bordered strip with Clear (Esc): its trail lights, the readouts, attention and stargazer panels narrow to it. Below sit "Who starred you" (Latest / Notable by followers, last 90 days) and "Your stargazers also star", with hairline share bars and a Star action for repos not yet in the owner's stars.

### Health by Class List

A panel listing the five classes hot to cool: mono class letter, swatch (ring for archived, dimmed for dormant), name, tabular count, and a 1px proportion line in the class colour over a grid track. Hovering or focusing a row isolates that class in the field; clicking opens the filtered library.

## Do's and Don'ts

### Do

- **Do** draw every panel as Panel Ink with a 1px Hairline border and 6px corners, and separate rows with hairlines.
- **Do** keep acid lime to lines, rings, outlines, the primary action's label and control-sized marks (The Line-Not-Light Rule).
- **Do** give every health colour a second cue: hollow ring for archived, 0.75 opacity for dormant, class letter and name in every legend.
- **Do** set measurements (axis ticks, coordinates, class letters, ranks, keys) in 11px Geist Mono and everything else in Geist with tabular figures.
- **Do** show headline numbers as readouts inside a panel header, each linked to the view that explains it.
- **Do** keep state transitions at 100ms and overlays at 150ms, and honour reduced motion by snapping instead of animating. The only longer motions are the star field's intro tilt and the 450ms triage outcome.
- **Do** label plot axes in plain words ("Year starred", "Popularity (stars)", "Pushed recently") with mono tick values.

### Don't

- **Don't** fill a button, panel or background with acid lime, and don't put a glow or bloom on lime or on data marks.
- **Don't** use frosted-glass panels or neon glows; the only translucency is the 95%-opaque sticky bars (top bar, mobile tab bar, filter bar) that keep scrolled content from bleeding through.
- **Don't** put a shadow on a resting panel; shadows are for menus, popovers, tooltips, dialogs and toasts.
- **Don't** introduce a second decorative accent hue; orange and red belong to dormant, archived, warning and destructive.
- **Don't** use uppercase eyebrows or letterspaced kickers above headings; panel titles are 13px semibold sentence case.
- **Don't** compose a dashboard as a row of stat cards over a bar chart; numbers live in readout strips and the library lives in the field.
- **Don't** let colour be the only signal of health in any chart, badge or list.
