import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useLanguage } from '../../i18n'
import { IconButton } from './Button'
import { cx } from './cx'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const SIZES = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-3xl' }

/* Shared by nested modals: the page behind stays locked until the last one closes */
let openModals = 0

const lockPage = () => {
  openModals += 1
  if (openModals > 1) return
  document.body.style.overflow = 'hidden'
  document.getElementById('root')?.setAttribute('inert', '')
}

const unlockPage = () => {
  openModals -= 1
  if (openModals > 0) return
  document.body.style.overflow = ''
  document.getElementById('root')?.removeAttribute('inert')
}

/**
 * Dialog on desktop, bottom sheet on phones. Traps focus, closes on Escape and on the
 * backdrop, and returns focus to whatever opened it. Not a native <dialog>: its top
 * layer would hide react-toastify toasts behind the backdrop.
 */
export function Modal({ open, onClose, title, description, size = 'md', footer, className, children }) {
  const { t } = useLanguage()
  const panelRef = useRef(null)
  const onCloseRef = useRef(onClose)
  const baseId = useId()
  const titleId = `${baseId}-title`
  const descriptionId = `${baseId}-description`

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return undefined
    const opener = document.activeElement
    lockPage()
    const panel = panelRef.current
    const first = panel?.querySelector('[data-autofocus]') || panel?.querySelector(FOCUSABLE)
    ;(first || panel)?.focus()

    return () => {
      unlockPage()
      if (opener?.isConnected) opener.focus?.()
    }
  }, [open])

  if (!open) return null

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onCloseRef.current?.()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = [...panelRef.current.querySelectorAll(FOCUSABLE)]
    if (!focusable.length) {
      event.preventDefault()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (event.shiftKey && (active === first || active === panelRef.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div
      className='fixed inset-0 z-(--z-modal) flex items-end justify-center bg-(--color-scrim) animate-fade sm:items-center sm:p-6'
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current?.()
      }}
    >
      <div
        ref={panelRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cx(
          'flex max-h-[92dvh] w-full flex-col rounded-t-sheet bg-surface-raised text-ink shadow-e3 outline-none animate-sheet',
          'sm:rounded-card sm:rounded-se-signature',
          SIZES[size],
          className,
        )}
      >
        <div className='flex items-start justify-between gap-4 p-5 pb-3 sm:p-6 sm:pb-3'>
          <div className='min-w-0'>
            <h2 id={titleId} className='text-title-lg font-semibold'>
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className='mt-1 text-body-sm text-ink-3'>
                {description}
              </p>
            )}
          </div>
          <IconButton label={t('Close')} size='sm' className='-me-1.5 -mt-1' onClick={() => onCloseRef.current?.()}>
            <X aria-hidden='true' className='size-4' />
          </IconButton>
        </div>
        <div className='min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6'>{children}</div>
        {footer && (
          <div className='flex flex-wrap items-center justify-end gap-3 border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6'>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
