// The app's one green — the same green as the goal-progress bar on the
// Me page — for the handful of spots that can't use a Tailwind class
// (inline gradients, style props, canvas/chart colors). Matches
// emerald-500 / emerald-400 in tailwind.config.js exactly, so a
// class-based green and an inline-style green always look the same.
// Change the scale in tailwind.config.js; update these two lines to match.
export const GREEN = 'oklch(0.68 0.18 152)'
export const GREEN_LIGHT = 'oklch(0.78 0.19 150)'
export const GREEN_DEEP = 'oklch(0.42 0.12 153)'
