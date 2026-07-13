// Single source of truth for the +/- tap-zone badges on goal rows (the
// small circle you tap to log progress up or down). The + and - badges
// must always look identical to each other — same shape, same neutral
// tint — so they read as one paired control instead of two different
// designs. Only the glyph inside (+ or −) tells them apart. Change the
// look here and both sides of every goal row update together.
export const TAP_BADGE_BASE =
  'w-7 h-7 shrink-0 rounded-full bg-zinc-900/10 dark:bg-white/10 text-zinc-600 dark:text-white/75 flex items-center justify-center text-base font-semibold leading-none'
