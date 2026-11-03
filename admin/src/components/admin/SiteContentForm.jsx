import { useEffect, useState } from 'react'
import { Eye, Upload } from 'lucide-react'
import { useLanguage } from '../../i18n'
import { Card, CardBody, CardHeader, Field, Input } from '../ui'

export const FormSection = ({ title, icon: Icon, children }) => (
  <Card variant='flat'>
    <CardHeader
      title={
        <span className='flex items-center gap-2'>
          {Icon && <Icon aria-hidden='true' className='size-5 text-brand' />}
          {title}
        </span>
      }
    />
    <CardBody className='space-y-4'>{children}</CardBody>
  </Card>
)

export const ToggleRow = ({ checked, onChange, label, description, className = '' }) => (
  <label className={`${className} flex cursor-pointer items-start justify-between gap-4 rounded-control border border-line bg-surface p-3.5 transition duration-(--duration-fast) ease-standard hover:border-primary has-checked:border-primary has-checked:bg-primary-soft`}>
    <span>
      <span className='block text-body-sm font-semibold text-ink'>{label}</span>
      {description && <span className='mt-0.5 block text-caption text-ink-3'>{description}</span>}
    </span>
    <input
      type='checkbox'
      checked={Boolean(checked)}
      onChange={(event) => onChange(event.target.checked)}
      className='mt-0.5 size-5 shrink-0 cursor-pointer accent-(--color-primary)'
    />
  </label>
)

/** A preview address for a picked file, released when the file changes or the page closes. */
export const useFilePreview = (file, saved) => {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!file) {
      setUrl('')
      return undefined
    }
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])
  return url || saved || ''
}

export const ImagePicker = ({ label, preview, onPick, hint, imageClassName = 'h-36' }) => (
  <div>
    <p className='mb-1.5 text-body-sm font-medium text-ink'>{label}</p>
    <label className='flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-control border-2 border-dashed border-field bg-surface-sunken p-4 text-center transition duration-(--duration-fast) ease-standard hover:border-primary hover:bg-primary-soft'>
      {preview ? (
        <img src={preview} alt='' className={`w-full object-contain ${imageClassName}`} />
      ) : (
        <span className='flex flex-col items-center gap-2 text-body-sm text-ink-3'>
          <Upload aria-hidden='true' className='size-6 text-brand' />
          {hint}
        </span>
      )}
      <input type='file' accept='image/*' aria-label={label} className='sr-only' onChange={(event) => onPick(event.target.files?.[0] || null)} />
    </label>
  </div>
)

export const ColorField = ({ label, value, onChange }) => (
  <Field label={label}>
    <Input
      dir='ltr'
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
      className='max-w-xs'
      style={{ textAlign: 'start', borderInlineStart: `1.5rem solid ${value || 'transparent'}` }}
    />
  </Field>
)

/** Sticks beside the form. Reads either language, whichever the admin is using, in the right direction. */
export const LivePreview = ({ description, language, onLanguage, children, footer }) => {
  const { t } = useLanguage()
  return (
    <aside className='h-fit overflow-hidden rounded-card border border-line bg-surface shadow-e1 xl:sticky xl:top-5'>
      <div className='flex flex-wrap items-center justify-between gap-3 border-b border-line p-4'>
        <div className='min-w-0'>
          <h2 className='flex items-center gap-2 text-subtitle font-semibold text-ink'>
            <Eye aria-hidden='true' className='size-5 text-brand' />
            {t('Live Preview')}
          </h2>
          {description && <p className='mt-0.5 text-caption text-ink-3'>{description}</p>}
        </div>
        <div role='group' aria-label={t('Preview language')} className='flex rounded-control bg-surface-sunken p-0.5'>
          {[
            ['en', 'English'],
            ['ar', 'العربية']
          ].map(([key, label]) => (
            <button
              key={key}
              type='button'
              lang={key}
              aria-pressed={language === key}
              onClick={() => onLanguage(key)}
              className={`min-h-8 cursor-pointer rounded-[0.5rem] px-2.5 text-caption font-semibold ${
                language === key ? 'bg-surface text-brand shadow-e1' : 'text-ink-3'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className='p-4' dir={language === 'ar' ? 'rtl' : 'ltr'} lang={language}>
        {children}
      </div>
      {footer && <div className='border-t border-line p-4'>{footer}</div>}
    </aside>
  )
}
