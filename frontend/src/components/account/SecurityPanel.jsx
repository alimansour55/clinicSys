import { useCallback, useContext, useEffect, useState } from 'react'
import { CheckCircle2, Download, KeyRound, LogOut, MonitorSmartphone, Phone, ShieldCheck, ShieldOff } from 'lucide-react'
import { AppContext } from '../../context/AppContext'
import { useLanguage } from '../../i18n'
import MfaSetupBox from '../MfaSetupBox'
import OtpCodeInput from '../OtpCodeInput'
import { Badge, Button, Card, CardBody, CardHeader, Field, Input, Modal, notify } from '../ui'
import { FormError, PasswordChecklist, PasswordInput, RecoveryCodesPanel } from './accountUi'
import { meetsPolicy, usePasswordPolicy, useAccountApi, useServerText } from './accountApi'

const CodeInput = ({ value, onChange, label }) => {
  return (
    <Field label={label}>
      <Input dir='ltr' value={value} onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))} className='text-center font-bold tracking-[0.35em]' inputMode='numeric' autoComplete='one-time-code' placeholder='000000' />
    </Field>
  )
}

const MfaCard = ({ onChanged }) => {
  const { t, localizeDigits } = useLanguage()
  const api = useAccountApi()
  const say = useServerText()
  const [status, setStatus] = useState(null)
  const [setup, setSetup] = useState(null)
  const [code, setCode] = useState('')
  const [codes, setCodes] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const data = await api('get', '/api/user/mfa/status')
    if (data.success) setStatus(data.mfa)
  }, [api])

  useEffect(() => {
    let alive = true
    api('get', '/api/user/mfa/status').then((data) => {
      if (alive && data.success) setStatus(data.mfa)
    })
    return () => {
      alive = false
    }
  }, [api])

  const run = async (path, onSuccess) => {
    setBusy(true)
    setError('')
    const data = await api('post', path, { code })
    setBusy(false)
    if (!data.success) return setError(say(data.message))
    setCode('')
    onSuccess(data)
    load()
    onChanged()
  }

  if (codes) {
    return (
      <Card>
        <CardHeader title={t('Authenticator app')} />
        <CardBody><RecoveryCodesPanel codes={codes} onDone={() => setCodes(null)} /></CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader
        title={t('Authenticator app')}
        description={t('Ask for a code from your phone every time you sign in.')}
        action={status && <Badge tone={status.enabled ? 'success' : 'neutral'} dot>{status.enabled ? t('On') : t('Off')}</Badge>}
      />
      <CardBody className='space-y-3'>
        {status?.required && <p className='rounded-control bg-info-soft px-3 py-2 text-caption text-info-ink'>{t('MFA is required for this account.')}</p>}
        {setup ? (
          <>
            <MfaSetupBox mode='setup' setup={setup} />
            <CodeInput label={t('6-digit code')} value={code} onChange={setCode} />
            <FormError>{error}</FormError>
            <div className='flex flex-wrap gap-2'>
              <Button loading={busy} leadingIcon={<ShieldCheck className='size-4' />} onClick={() => run('/api/user/mfa/enable', (data) => {
                setSetup(null)
                setCodes(data.recoveryCodes)
              })}>{t('Verify and enable')}</Button>
              <Button variant='ghost' onClick={() => setSetup(null)}>{t('Cancel')}</Button>
            </div>
          </>
        ) : status?.enabled ? (
          <>
            <p className='text-body-sm text-ink-2'>{localizeDigits(String(t('{{n}} recovery codes left')).replace('{{n}}', status.recoveryCodesLeft ?? 0))}</p>
            <CodeInput label={t('6-digit code')} value={code} onChange={setCode} />
            <FormError>{error}</FormError>
            <div className='flex flex-wrap gap-2'>
              <Button variant='secondary' loading={busy} leadingIcon={<KeyRound className='size-4' />} onClick={() => run('/api/account/mfa/recovery-codes', (data) => setCodes(data.recoveryCodes))}>{t('New recovery codes')}</Button>
              {!status.required && (
                <Button variant='ghost' disabled={busy} leadingIcon={<ShieldOff className='size-4' />} onClick={() => run('/api/user/mfa/disable', (data) => notify.success(say(data.message)))}>{t('Disable MFA')}</Button>
              )}
            </div>
          </>
        ) : (
          <>
            <FormError>{error}</FormError>
            <Button
              loading={busy}
              disabled={status?.canSelfManage === false && !status?.required}
              leadingIcon={<KeyRound className='size-4' />}
              onClick={async () => {
                setBusy(true)
                setError('')
                const data = await api('post', '/api/user/mfa/setup', {})
                setBusy(false)
                if (data.success) setSetup(data.setup)
                else setError(say(data.message))
              }}
            >
              {t('Set up authenticator')}
            </Button>
          </>
        )}
      </CardBody>
    </Card>
  )
}

const PhoneCard = ({ userData, verified, onChanged }) => {
  const { t } = useLanguage()
  const api = useAccountApi()
  const say = useServerText()
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [codeKey, setCodeKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const send = async () => {
    setBusy(true)
    setError('')
    const data = await api('post', '/api/account/phone/send', {})
    setBusy(false)
    if (!data.success) return setError(say(data.message))
    setSent(true)
    notify.success(say(data.message))
    if (data.smsDevMode) notify.info(t('SMS dev mode: check the backend terminal for your code'))
  }

  const confirm = async () => {
    setBusy(true)
    setError('')
    const data = await api('post', '/api/account/phone/confirm', { code })
    setBusy(false)
    if (!data.success) {
      setCode('')
      setCodeKey((key) => key + 1)
      return setError(say(data.message))
    }
    notify.success(say(data.message))
    onChanged()
  }

  return (
    <Card>
      <CardHeader
        title={t('Phone number')}
        description={<span dir='ltr'>{userData.phone}</span>}
        action={<Badge tone={verified ? 'success' : 'warning'} dot>{verified ? t('Confirmed') : t('Not confirmed')}</Badge>}
      />
      {!verified && (
        <CardBody className='space-y-3'>
          {sent && <OtpCodeInput key={codeKey} onChange={setCode} disabled={busy} />}
          <FormError>{error}</FormError>
          <div className='flex flex-wrap gap-2'>
            {sent ? (
              <>
                <Button loading={busy} onClick={confirm}>{t('Confirm code')}</Button>
                <Button variant='ghost' disabled={busy} onClick={send}>{t('Resend')}</Button>
              </>
            ) : (
              <Button variant='secondary' loading={busy} leadingIcon={<Phone className='size-4' />} onClick={send}>{t('Send me a code')}</Button>
            )}
          </div>
        </CardBody>
      )}
    </Card>
  )
}

const PasswordCard = () => {
  const { setToken } = useContext(AppContext)
  const { t } = useLanguage()
  const api = useAccountApi()
  const say = useServerText()
  const policy = usePasswordPolicy()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (!meetsPolicy(next, policy)) return setError(t('Please choose a password that meets all the requirements'))
    setBusy(true)
    const data = await api('post', '/api/account/change-password', { currentPassword: current, newPassword: next })
    setBusy(false)
    if (!data.success) return setError(say(data.message))
    localStorage.setItem('token', data.token)
    setToken(data.token)
    setCurrent('')
    setNext('')
    notify.success(say(data.message))
  }

  return (
    <Card>
      <CardHeader title={t('Change password')} />
      <CardBody>
        <form onSubmit={submit} className='space-y-3'>
          <Field label={t('Current password')} required>
            <PasswordInput value={current} onChange={setCurrent} autoComplete='current-password' />
          </Field>
          <div>
            <Field label={t('New password')} required>
              <PasswordInput value={next} onChange={setNext} autoComplete='new-password' />
            </Field>
            <PasswordChecklist password={next} policy={policy} />
          </div>
          <FormError>{error}</FormError>
          <Button type='submit' variant='secondary' loading={busy}>{t('Change password')}</Button>
        </form>
      </CardBody>
    </Card>
  )
}

const ACTION_LABELS = {
  login_success: 'Signed in',
  login_failed: 'Failed sign-in attempt',
  mfa_login_failed: 'Wrong authenticator code',
  password_reset: 'Password reset',
  password_change: 'Password changed',
  mfa_enable: 'Authenticator turned on',
  mfa_disable: 'Authenticator turned off',
  sign_out_everywhere: 'Signed out everywhere'
}

const deviceOf = (userAgent = '') => {
  if (/iphone|ipad/i.test(userAgent)) return 'iPhone or iPad'
  if (/android/i.test(userAgent)) return 'Android'
  if (/windows/i.test(userAgent)) return 'Windows'
  if (/mac os/i.test(userAgent)) return 'Mac'
  return ''
}

const ActivityCard = () => {
  const { setToken } = useContext(AppContext)
  const { t, language, localizeDigits } = useLanguage()
  const api = useAccountApi()
  const say = useServerText()
  const [activity, setActivity] = useState([])
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    api('get', '/api/account/security/activity').then((data) => {
      if (data.success) setActivity(data.activity)
    })
  }, [api])

  const signOutAll = async () => {
    const data = await api('post', '/api/account/sign-out-everywhere', {})
    setConfirming(false)
    if (!data.success) return notify.error(say(data.message))
    localStorage.setItem('token', data.token)
    setToken(data.token)
    notify.success(say(data.message))
  }

  return (
    <Card>
      <CardHeader title={t('Recent activity')} description={t('If something here was not you, change your password and sign out everywhere.')} />
      <CardBody>
        <ul className='divide-y divide-line'>
          {activity.map((row) => (
            <li key={row._id} className='flex items-start gap-3 py-2.5'>
              <MonitorSmartphone className='mt-0.5 size-4 shrink-0 text-ink-3' aria-hidden='true' />
              <span className='min-w-0'>
                <span className={`block text-body-sm ${row.status === 'failed' ? 'font-semibold text-warning-ink' : 'text-ink'}`}>{t(ACTION_LABELS[row.action] || 'Account activity')}</span>
                <span className='block text-caption text-ink-3'>
                  {[
                    localizeDigits(new Date(row.createdAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })),
                    deviceOf(row.userAgent) && t(deviceOf(row.userAgent)),
                    row.location?.city && decodeURIComponent(row.location.city)
                  ].filter(Boolean).join(' · ')}
                </span>
              </span>
            </li>
          ))}
          {activity.length === 0 && <li className='py-3 text-body-sm text-ink-3'>{t('Nothing to show yet.')}</li>}
        </ul>
        <Button variant='secondary' className='mt-3' leadingIcon={<LogOut className='size-4' />} onClick={() => setConfirming(true)}>{t('Sign out on all other devices')}</Button>
      </CardBody>
      {confirming && (
        <Modal
          open
          size='sm'
          onClose={() => setConfirming(false)}
          title={t('Sign out on all other devices?')}
          description={t('This device stays signed in.')}
          footer={<Button onClick={signOutAll}>{t('Sign them out')}</Button>}
        />
      )}
    </Card>
  )
}

const DataCard = () => {
  const { t } = useLanguage()
  const api = useAccountApi()
  const say = useServerText()
  const [busy, setBusy] = useState(false)

  const download = async () => {
    setBusy(true)
    const data = await api('get', '/api/account/export')
    setBusy(false)
    if (!data.success) return notify.error(say(data.message))
    const url = URL.createObjectURL(new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `clinivo-my-data-${data.exportedAt.slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    notify.success(t('Your file is ready. Keep it somewhere private.'))
  }

  return (
    <Card>
      <CardHeader title={t('Your data')} description={t('Your health records belong to you. Download a full copy at any time.')} />
      <CardBody>
        <Button variant='secondary' loading={busy} leadingIcon={<Download className='size-4' />} onClick={download}>{t('Download my data')}</Button>
      </CardBody>
    </Card>
  )
}

const SecurityPanel = ({ userData, phoneVerified, reload }) => {
  const { loadUserProfileData } = useContext(AppContext)
  const { t } = useLanguage()
  const refresh = () => {
    reload()
    loadUserProfileData()
  }

  return (
    <section aria-label={t('Security')} className='grid grid-cols-1 items-start gap-5 lg:grid-cols-2'>
      <div className='space-y-5'>
        <MfaCard onChanged={refresh} />
        <PhoneCard userData={userData} verified={phoneVerified} onChanged={refresh} />
        <DataCard />
      </div>
      <div className='space-y-5'>
        <PasswordCard />
        <ActivityCard />
      </div>
      {userData.emailVerified && (
        <p className='flex items-center gap-2 text-caption text-ink-3 lg:col-span-2'>
          <CheckCircle2 className='size-4 text-success-ink' aria-hidden='true' />
          {t('Your email is confirmed.')}
        </p>
      )}
    </section>
  )
}

export default SecurityPanel
