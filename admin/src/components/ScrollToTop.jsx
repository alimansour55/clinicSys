import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Scroll staff main panel when the route changes. */
const ScrollToTop = () => {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' in window ? 'instant' : 'auto' })
    document.getElementById('staff-main-scroll')?.scrollTo(0, 0)
  }, [pathname])

  return null
}

export default ScrollToTop
