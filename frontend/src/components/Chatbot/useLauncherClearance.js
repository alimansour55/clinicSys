import { useEffect, useState } from 'react'

/**
 * Keeps the floating assistant button off page actions.
 *
 * Bottom action bars and docks mark themselves with `data-chat-avoid`, and every form's submit
 * button counts too, so a Save button is never under it. While one of them sits where the button
 * would be, the button lifts above it. While a modal dialog is open the button
 * hides, because a bottom sheet keeps its buttons at the bottom edge of the screen.
 * Works in both directions: the overlap test uses the button's own position on screen.
 */
export const AVOID_SELECTOR = '[data-chat-avoid], form [type="submit"]'
const GAP = 12
/* Taller elements are page sections rather than bars, and lifting over them would hide the button. */
const MAX_BAR_SHARE = 0.4

/** How far to lift a button whose resting box is `rest`, given the avoid boxes. Pure, for tests. */
export const liftFor = (rest, boxes, viewportHeight) => {
  let lift = 0
  for (const box of boxes) {
    if (!box || box.height <= 0 || box.width <= 0) continue
    if (box.height > viewportHeight * MAX_BAR_SHARE) continue
    const overlapsX = box.left < rest.right && box.right > rest.left
    const overlapsY = box.top < rest.bottom + GAP && box.bottom > rest.top - GAP
    if (!overlapsX || !overlapsY) continue
    lift = Math.max(lift, rest.bottom - box.top + GAP)
  }
  return Math.max(0, Math.round(lift))
}

const CLEAR = { lift: 0, hidden: false }

const otherModalOpen = (panel) =>
  [...document.querySelectorAll('[aria-modal="true"]')].some((node) => !panel || !panel.contains(node))

export function useLauncherClearance(launcherRef, panelRef, { enabled = true } = {}) {
  const [state, setState] = useState({ lift: 0, hidden: false })

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined

    let frame = 0

    const measure = () => {
      frame = 0
      const launcher = launcherRef.current
      if (!launcher) return
      // Where the button rests without any lift. The lift is an animated transform, so the
      // vertical position comes from its CSS bottom and height, which a transform does not change.
      const rect = launcher.getBoundingClientRect()
      const bottom = window.innerHeight - (parseFloat(window.getComputedStyle(launcher).bottom) || 0)
      const rest = { left: rect.left, right: rect.right, top: bottom - launcher.offsetHeight, bottom }
      const boxes = [...document.querySelectorAll(AVOID_SELECTOR)]
        .filter((node) => !node.closest('.chatbot-panel'))
        .map((node) => node.getBoundingClientRect())
      const lift = liftFor(rest, boxes, window.innerHeight)
      const hidden = otherModalOpen(panelRef?.current)
      setState((prev) => (prev.lift === lift && prev.hidden === hidden ? prev : { lift, hidden }))
    }

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure)
    }

    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-chat-avoid', 'aria-modal', 'class', 'hidden'] })

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      observer.disconnect()
    }
  }, [enabled, launcherRef, panelRef])

  return enabled ? state : CLEAR
}
