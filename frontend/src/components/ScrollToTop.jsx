import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/* Scroll to the top on a new page, but not while refining filters on /doctors, and not on back or forward. */
const ScrollToTop = () => {
  const { pathname, hash } = useLocation()
  const navigationType = useNavigationType()
  const previous = useRef(pathname)

  useEffect(() => {
    const from = previous.current
    previous.current = pathname
    if (navigationType === 'POP') return
    if (from !== pathname && from.startsWith('/doctors') && pathname.startsWith('/doctors')) return
    if (hash) {
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView()
      return
    }
    window.scrollTo(0, 0)
  }, [pathname, hash, navigationType])

  return null
}

export default ScrollToTop
