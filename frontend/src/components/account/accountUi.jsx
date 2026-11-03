import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, Circle, Copy, Download, Eye, EyeOff, Lock } from 'lucide-react'
import { useLanguage } from '../../i18n'
import { Button, Card, CardBody, Input, notify } from '../ui'
import { passwordRules } from './accountApi'

/** The centred card that sign-in, verification and reset pages share. */
export const AuthShell = ({ title, description, onBack, backLabel, children }) => {
  const { t } = useLanguage()
  return (
    <div className='flex min-h-[80vh] items-center justify-center py-8'>
      <Card variant='signature' className='w-full max-w-md animate-rise'>
        <CardBody className='p-6 sm:p-8'>
          {onBack && (
            <button type='button' onClick={onBack} className='mb-5 inline-flex min-h-9 items-center gap-2 text-body-sm text-ink-2 transition hover:text-ink'>
              <ArrowLeft className='size-4 rtl:-scale-x-100' aria-hidden='true' />
              {backLabel || t('Back')}
            </button>
          )}
          <h1 className='font-display text-display text-ink'>{title}</h1>
          {description && <p className='mt-2 text-body-sm text-ink-2'>{description}</p>}
          <div className='mt-6'>{children}</div>
        </CardBody>
      </Card>
    </div>
  )
}

export const FormError = ({ children }) =>
  children ? (
    <p role='alert' className='rounded-control bg-danger-soft px-3.5 py-2.5 text-body-sm text-danger-ink'>
      {children}
    </p>
  ) : null

export const PasswordInput = ({ value, onChange, autoComplete = 'current-password', id, placeholder, ...props }) => {
  const { t } = useLanguage()
  const [show, setShow] = useState(false)
  return (
    <div className='relative'>
      <Lock className='pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-3' aria-hidden='true' />
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className='ps-9 pe-11'
        {...props}
      />
      <button
        type='button'
        onClick={() => setShow((current) => !current)}
        aria-label={show ? t('Hide password') : t('Show password')}
        className='absolute end-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-control text-ink-3 transition hover:text-ink'
      >
        {show ? <EyeOff className='size-4' aria-hidden='true' /> : <Eye className='size-4' aria-hidden='true' />}
      </button>
    </div>
  )
}


/** Shows the rules while someone types, so the server's refusal is never the first they hear of them. */
export const PasswordChecklist = ({ password, policy }) => {
  const { t, localizeDigits } = useLanguage()
  const rules = useMemo(() => passwordRules(policy), [policy])
  return (
    <ul className='mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2' aria-label={t('Password requirements')}>
      {rules.map((rule) => {
        const met = rule.test(password)
        const label = rule.key === 'length'
          ? localizeDigits(String(t('At least {{n}} characters')).replace('{{n}}', policy?.minLength ?? 8))
          : t(rule.label)
        return (
          <li key={rule.key} className={`flex items-center gap-1.5 text-caption ${met ? 'text-success-ink' : 'text-ink-3'}`}>
            {met ? <Check className='size-3.5 shrink-0' aria-hidden='true' /> : <Circle className='size-3 shrink-0' aria-hidden='true' />}
            {label}
          </li>
        )
      })}
    </ul>
  )
}

/** A resend link that is honest about the server's cooldown. */
export const ResendCountdown = ({ seconds = 60, onResend, label }) => {
  const { t, localizeDigits } = useLanguage()
  const [left, setLeft] = useState(seconds)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (left <= 0) return undefined
    const id = setInterval(() => setLeft((value) => Math.max(0, value - 1)), 1000)
    return () => clearInterval(id)
  }, [left])

  if (left > 0) {
    return <p className='text-caption text-ink-3' aria-live='off'>{localizeDigits(String(t('You can ask for a new code in {{n}} seconds')).replace('{{n}}', left))}</p>
  }

  return (
    <button
      type='button'
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await onResend()
        setBusy(false)
        setLeft(seconds)
      }}
      className='text-body-sm font-medium text-brand underline disabled:opacity-50'
    >
      {label || t('Send a new code')}
    </button>
  )
}

/** One chance to save the codes. Shown once, because the server keeps only hashes. */
export const RecoveryCodesPanel = ({ codes, onDone }) => {
  const { t } = useLanguage()
  const [saved, setSaved] = useState(false)
  const text = codes.join('\n')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      notify.success(t('Copied'))
    } catch {
      notify.error(t('Could not copy. Please write them down.'))
    }
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([`Clinivo recovery codes\n\n${text}\n`], { type: 'text/plain' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'clinivo-recovery-codes.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className='space-y-3 rounded-card bg-warning-soft p-4 text-warning-ink'>
      <p className='text-subtitle font-semibold'>{t('Save your recovery codes')}</p>
      <p className='text-body-sm'>{t('If you lose your phone, each code gets you in once. This is the only time you will see them.')}</p>
      <ul dir='ltr' className='grid grid-cols-2 gap-1.5 rounded-control bg-surface p-3 font-mono text-body-sm text-ink'>
        {codes.map((code) => <li key={code}>{code}</li>)}
      </ul>
      <div className='flex flex-wrap gap-2'>
        <Button type='button' size='sm' variant='secondary' leadingIcon={<Copy className='size-4' />} onClick={copy}>{t('Copy')}</Button>
        <Button type='button' size='sm' variant='secondary' leadingIcon={<Download className='size-4' />} onClick={download}>{t('Download')}</Button>
      </div>
      <label className='flex min-h-9 items-center gap-2 text-body-sm'>
        <input type='checkbox' checked={saved} onChange={(event) => setSaved(event.target.checked)} className='size-4 accent-primary' />
        {t('I saved these somewhere safe')}
      </label>
      <Button type='button' fullWidth disabled={!saved} onClick={onDone}>{t('Continue')}</Button>
    </div>
  )
}
