// Single source of truth for every action button's look across the app.
// Change the colors/shape here and every button that imports these updates
// together — never hand-roll a one-off button className elsewhere.
//
// The green matches the goal-progress fill bar on the Me page exactly
// (see the `stateColors` gradient in MemberProfile.jsx: oklch(0.68 0.18 152)
// → oklch(0.78 0.19 150)) rather than a generic Tailwind emerald shade.
export const BUTTON_BASE =
  'bg-[oklch(0.68_0.18_152)] hover:bg-white hover:text-[oklch(0.5_0.16_152)] active:bg-[oklch(0.92_0.05_152)] active:text-[oklch(0.4_0.14_152)] text-white font-bold rounded-xl transition-colors disabled:opacity-40 disabled:pointer-events-none'

// Full-width (or flex-1) primary button — e.g. "Lock in", "Save", "Continue".
// Caller adds the width class: `${BUTTON_MD} w-full` or `${BUTTON_MD} flex-1`.
export const BUTTON_MD = `py-2.5 text-sm ${BUTTON_BASE}`

// Small inline pill button — e.g. "Use template", "Edit", "Last week's".
export const BUTTON_SM = `px-3.5 py-1.5 text-xs ${BUTTON_BASE}`
