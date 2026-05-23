/**
 * iOS/Android: first tap on buttons inside scroll areas or with :hover styles
 * often does not fire click until a second tap. On touchend we synthesize one
 * immediate click when the gesture was a tap (not a scroll).
 *
 * Form controls (inputs, selects, textareas) must never be intercepted.
 */
const MOVE_THRESHOLD_PX = 12
const touchStartById = new Map()

const FORM_CONTROL_SELECTOR =
  'input:not([type="button"]):not([type="submit"]):not([type="reset"]), textarea, select, option, label, [contenteditable="true"], [role="textbox"], [role="searchbox"], [data-input-field]'

function isCoarsePointer() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(hover: none)').matches
  )
}

function isFormControlTouch(node) {
  if (!node?.closest) return false
  return Boolean(node.closest(FORM_CONTROL_SELECTOR))
}

function focusFieldControl(node) {
  const field = node?.closest?.('[data-input-field]')
  if (!field) return
  const control = field.querySelector(
    'input:not([type="button"]):not([type="submit"]):not([type="reset"]), textarea, select',
  )
  if (control && document.activeElement !== control) {
    control.focus()
  }
}

function findTapTarget(node) {
  if (!node?.closest) return null
  if (isFormControlTouch(node)) return null

  const el = node.closest(
    'button, a[href], [role="button"], [role="checkbox"], input[type="button"], input[type="submit"], input[type="reset"]',
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
    if (isFormControlTouch(event.target)) {
      focusFieldControl(event.target)
      return
    }

    for (const touch of event.changedTouches) {
      const start = touchStartById.get(touch.identifier)
      touchStartById.delete(touch.identifier)
      if (!start) continue

      const dx = Math.abs(touch.clientX - start.x)
      const dy = Math.abs(touch.clientY - start.y)
      if (dx > MOVE_THRESHOLD_PX || dy > MOVE_THRESHOLD_PX) continue

      const target = findTapTarget(event.target)
      if (!target) continue

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
