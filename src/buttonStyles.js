// Single source of truth for every action button's look across the app.
// Change the shape/hover behavior here and every button that imports
// these updates together — never hand-roll a one-off button className
// elsewhere. The color itself comes from Tailwind's `emerald` scale,
// which is redefined in tailwind.config.js to the app's one green — to
// change the green, edit the scale there, not here.
export const BUTTON_BASE =
  'bg-emerald-500 hover:bg-white hover:text-emerald-700 active:bg-emerald-100 active:text-emerald-800 text-white font-bold rounded-xl transition-colors disabled:opacity-40 disabled:pointer-events-none'

// Full-width (or flex-1) primary button — e.g. "Lock in", "Save", "Continue".
// Caller adds the width class: `${BUTTON_MD} w-full` or `${BUTTON_MD} flex-1`.
export const BUTTON_MD = `py-2.5 text-sm ${BUTTON_BASE}`

// Small inline pill button — e.g. "Use template", "Edit", "Last week's".
export const BUTTON_SM = `px-3.5 py-1.5 text-xs ${BUTTON_BASE}`
