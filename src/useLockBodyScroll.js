import { useEffect } from 'react'

// Freezes the page behind an open modal/sheet so scrolling or dragging
// on the overlay doesn't also scroll the page underneath it. The app's
// actual scroll container is <main> (see Layout.jsx), not
// document.body, so that's what gets locked — call with the modal's
// "is it open" boolean and it un-locks itself on close/unmount.
export default function useLockBodyScroll(locked) {
  useEffect(() => {
    if (!locked) return
    const main = document.querySelector('main')
    if (!main) return
    const prevOverflow = main.style.overflow
    main.style.overflow = 'hidden'
    return () => { main.style.overflow = prevOverflow }
  }, [locked])
}
