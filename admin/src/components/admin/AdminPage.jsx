import { Check, Download, X } from 'lucide-react'
import { useLanguage } from '../../i18n'
import { Button, Modal } from '../ui'

/** The frame every admin page shares: one title, one description, actions at the end of the row. */
export function AdminPage({ title, description, icon: Icon, actions, width = 'max-w-7xl', children }) {
  return (
    <div className='min-h-full bg-canvas px-gutter py-5 sm:py-6'>
      <div className={`mx-auto ${width}`}>
        <header className='mb-5 flex flex-wrap items-start justify-between gap-3 sm:mb-6'>
          <div className='flex min-w-0 items-start gap-3'>
            {Icon && (
              <span aria-hidden='true' className='hidden size-11 shrink-0 items-center justify-center rounded-se-[1.25rem] rounded-control bg-primary-soft text-brand sm:flex'>
                <Icon className='size-5' />
              </span>
            )}
            <div className='min-w-0'>
              <h1 className='font-display text-display text-ink'>{title}</h1>
              {description && <p className='mt-1 max-w-3xl text-body-sm text-ink-3'>{description}</p>}
            </div>
          </div>
          {actions && <div className='flex flex-wrap items-center gap-2'>{actions}</div>}
        </header>
        {children}
      </div>
    </div>
  )
}

/** A small figure with a label. `onClick` makes it a link to the records behind the number. */
export function StatCard({ label, value, hint, icon: Icon, tone = 'text-brand', onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`flex w-full items-start justify-between gap-3 rounded-card border border-line bg-surface p-4 text-start shadow-e1 ${
        onClick ? 'cursor-pointer transition duration-(--duration-fast) ease-standard hover:border-primary hover:shadow-e2' : ''
      }`}
    >
      <span className='min-w-0'>
        <span className='block text-caption font-medium text-ink-3'>{label}</span>
        <span className='mt-1 block text-title-lg font-bold tabular-nums text-ink'>{value}</span>
        {hint && <span className='mt-0.5 block text-caption text-ink-3'>{hint}</span>}
      </span>
      {Icon && <Icon aria-hidden='true' className={`mt-0.5 size-5 shrink-0 ${tone}`} />}
    </Tag>
  )
}

/** Saves the rows in view. Shows nothing to save rather than an empty file. */
export function ExportButton({ onExport, disabled, label }) {
  const { t } = useLanguage()
  return (
    <Button variant='secondary' size='sm' onClick={onExport} disabled={disabled} leadingIcon={<Download aria-hidden='true' className='size-4' />}>
      {label || t('Export CSV')}
    </Button>
  )
}

/** Sits above a list while rows are selected. Actions go in `children`. */
export function BulkBar({ count, onClear, children }) {
  const { t } = useLanguage()
  if (!count) return null
  return (
    <div role='region' aria-label={t('Bulk actions')} className='sticky top-0 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-card border border-primary bg-primary-soft px-3 py-2 shadow-e2 animate-rise'>
      <span className='flex items-center gap-2 text-body-sm font-semibold text-brand'>
        <Check aria-hidden='true' className='size-4' />
        {`${t('Selected')}: ${count}`}
      </span>
      <div className='ms-auto flex flex-wrap items-center gap-2'>
        {children}
        <Button variant='ghost' size='sm' onClick={onClear} leadingIcon={<X aria-hidden='true' className='size-4' />}>
          {t('Clear selection')}
        </Button>
      </div>
    </div>
  )
}

/** In place of window.confirm, so the question is translated and styled like everything else. */
export function ConfirmDialog({ open, title, body, confirmLabel, danger = false, busy = false, onConfirm, onClose }) {
  const { t } = useLanguage()
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size='sm'
      footer={
        <>
          <Button variant='secondary' onClick={onClose} disabled={busy}>
            {t('Cancel')}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={onConfirm} data-autofocus>
            {confirmLabel || t('Confirm')}
          </Button>
        </>
      }
    >
      <p className='text-body-sm text-ink-2'>{body}</p>
    </Modal>
  )
}

/** Header cell and row cell for picking records. Pass the same `label`-less checkbox props to both. */
export function SelectBox({ checked, indeterminate = false, onChange, label }) {
  return (
    <input
      type='checkbox'
      aria-label={label}
      checked={checked}
      ref={(node) => {
        if (node) node.indeterminate = indeterminate
      }}
      onChange={(event) => onChange(event.target.checked)}
      onClick={(event) => event.stopPropagation()}
      className='size-4 cursor-pointer accent-(--color-primary)'
    />
  )
}

/** Selection across a list. Ids that leave the list drop out, so a filter never acts on hidden rows. */
export const selectionFor = (selected, visibleIds) => {
  const inView = visibleIds.filter((id) => selected.includes(id))
  return {
    ids: inView,
    count: inView.length,
    all: visibleIds.length > 0 && inView.length === visibleIds.length,
    some: inView.length > 0 && inView.length < visibleIds.length
  }
}
