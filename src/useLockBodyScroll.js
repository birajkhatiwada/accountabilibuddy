import { useEffect } from 'react'

// Stops the page behind an open modal/sheet from scrolling, without
// touching <main>'s own layout or scrollTop at all. Earlier versions of
// this hook toggled <main>'s overflow/position to "lock" it, but any
// CSS-level trick like that risks the browser reflowing or resetting
// scrollTop on its own the instant the mode changes — which is exactly
// the jump this hook exists to prevent. Blocking the events that cause
// scrolling is more surgical: every modal in this app renders via
// createPortal(..., document.body), so it lives outside <main> in the
// DOM — blocking wheel/touchmove only when they originate *inside*
// <main> stops background scroll while leaving the modal's own content
// free to scroll normally.
export default function useLockBodyScroll(locked) {
  useEffect(() => {
    if (!locked) return
    const main = document.querySelector('main')
    if (!main) return

    const block = (e) => { if (main.contains(e.target)) e.preventDefault() }
    document.addEventListener('wheel', block, { passive: false })
    document.addEventListener('touchmove', block, { passive: false })
    return () => {
      document.removeEventListener('wheel', block)
      document.removeEventListener('touchmove', block)
    }
  }, [locked])
}
