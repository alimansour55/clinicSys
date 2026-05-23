/**
 * iOS/Android: first tap on buttons inside scroll areas or with :hover styles
 * often does not fire click until a second tap. On touchend we synthesize one
 * immediate click when the gesture was a tap (not a scroll).
 */
const MOVE_THRESHOLD_PX = 12
const touchStartById = new Map()

function isCoarsePointer() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(hover: none)').matches
  )
}

function findTapTarget(node) {
  if (!node?.closest) return null
  const el = node.closest(
    'button, a[href], [role="button"], input[type="button"], input[type="submit"], input[type="reset"]',
  )
  if (!el || el.closest('[data-skip-mobile-tap]')) return null
  if (el.disabled || el.getAttribute('aria-disabled') === 'true') return null
  if (el.tagName === 'A' && !el.getAttribute('href')) return null
  if (el.matches('input[type="file"], input[type="range"], input[type="color"]')) return null
  return el
}

export function installMobileTapFix() {
  if (typeof document === 'undefined' || !isCoarsePointer()) {
    return () => {}
  }

  const onTouchStart = (event) => {
    for (const touch of event.touches) {
      touchStartById.set(touch.identifier, {
        x: touch.clientX,
        y: touch.clientY,
      })
    }
  }

  const onTouchEnd = (event) => {
    for (const touch of event.changedTouches) {
      const start = touchStartById.get(touch.identifier)
      touchStartById.delete(touch.identifier)
      if (!start) continue

      const dx = Math.abs(touch.clientX - start.x)
      const dy = Math.abs(touch.clientY - start.y)
      if (dx > MOVE_THRESHOLD_PX || dy > MOVE_THRESHOLD_PX) continue

      const target = findTapTarget(event.target)
      if (!target) continue

      /* Blocks delayed ghost click; we fire one immediate click for React handlers */
      event.preventDefault()
      target.click()
    }
  }

  const onTouchCancel = (event) => {
    for (const touch of event.changedTouches) {
      touchStartById.delete(touch.identifier)
    }
  }

  document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true })
  document.addEventListener('touchend', onTouchEnd, { passive: false, capture: true })
  document.addEventListener('touchcancel', onTouchCancel, { passive: true, capture: true })

  return () => {
    document.removeEventListener('touchstart', onTouchStart, { capture: true })
    document.removeEventListener('touchend', onTouchEnd, { capture: true })
    document.removeEventListener('touchcancel', onTouchCancel, { capture: true })
    touchStartById.clear()
  }
}
