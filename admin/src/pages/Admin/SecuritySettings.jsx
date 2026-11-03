import { useContext, useEffect, useState } from 'react'
import axios from 'axios'
import { Clock, DatabaseBackup, KeyRound, Lock, Save, ShieldCheck, ShieldQuestion, TriangleAlert } from 'lucide-react'
import { AdminContext } from '../../context/AdminContext'
import { useLanguage } from '../../i18n'
import { AdminPage } from '../../components/admin/AdminPage'
import { Badge, Button, Card, CardBody, CardHeader, Field, Input, notify, Skeleton, SkeletonGroup } from '../../components/ui'

/* Everything this form may send. `adminMfa` is deliberately absent: it has its own routes. */
const defaults = {
  mfaEnabled: false,
  mfaRequiredGlobally: false,
  mfaAllowUserOptIn: true,
  mfaRequiredForAdmins: false,
  mfaRequiredForDoctors: false,
  mfaRequiredForReceptionists: false,
  mfaRequiredForPatients: false,
  enforceStrongPasswords: true,
  passwordMinLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialCharacter: true,
  preventCommonPasswords: true,
  passwordExpiryDays: 180,
  maxLoginAttempts: 5,
  lockoutMinutes: 15,
  sessionTimeoutMinutes: 60,
  auditLogsEnabled: true,
  auditLogRetentionDays: 365,
  dataRetentionDays: 2555,
  inactiveAccountRetentionDays: 730,
  allowPatientSelfRegistration: true,
  requireEmailVerification: false,
  enforceHttpsOnly: true,
  allowIpTracking: true
}

/* The ranges in normalizeSecuritySettings. The server clamps silently, so they are refused here instead. */
const NUMBER_RANGES = {
  passwordMinLength: [6, 128],
  passwordExpiryDays: [0, 3650],
  maxLoginAttempts: [3, 20],
  lockoutMinutes: [1, 1440],
  sessionTimeoutMinutes: [5, 1440],
  auditLogRetentionDays: [30, 3650],
  dataRetentionDays: [30, 3650],
  inactiveAccountRetentionDays: [30, 3650]
}

const pickKnownFields = (security = {}) =>
  Object.keys(defaults).reduce((picked, key) => {
    picked[key] = security?.[key] ?? defaults[key]
    return picked
  }, {})

const isInRange = (value, [min, max]) => {
  const number = Number(value)
  return String(value).trim() !== '' && Number.isInteger(number) && number >= min && number <= max
}

const NotEnforced = () => {
  const { t } = useLanguage()
  return <Badge tone='neutral'>{t('Not enforced yet')}</Badge>
}

const ToggleRow = ({ checked, onChange, label, description, notEnforced = false }) => (
  <label className='flex cursor-pointer items-start justify-between gap-4 rounded-control border border-line bg-surface px-4 py-3 transition duration-(--duration-fast) ease-standard hover:bg-surface-sunken'>
    <span className='min-w-0'>
      <span className='flex flex-wrap items-center gap-2 text-body-sm font-semibold text-ink'>
        {label}
        {notEnforced && <NotEnforced />}
      </span>
      <span className='mt-1 block text-caption text-ink-3'>{description}</span>
    </span>
    <input
      type='checkbox'
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className='mt-0.5 size-5 shrink-0 cursor-pointer accent-(--color-primary)'
    />
  </label>
)

const NumberControl = ({ unit, ...props }) => (
  <div className='flex items-stretch gap-2'>
    <Input type='number' inputMode='numeric' className='min-w-0 flex-1' {...props} />
    <span className='flex shrink-0 items-center rounded-control bg-surface-sunken px-3 text-caption font-semibold text-ink-2'>{unit}</span>
  </div>
)

const Section = ({ icon, title, children }) => (
  <Card>
    <CardHeader
      headingLevel={2}
      title={
        <span className='flex items-center gap-2'>
          {icon}
          {title}
        </span>
      }
    />
    <CardBody className='space-y-4'>{children}</CardBody>
  </Card>
)

const SummaryBox = ({ tone, title, children }) => (
  <div className={`rounded-control p-3 ${tone}`}>
    <p className='font-semibold'>{title}</p>
    <div className='mt-1'>{children}</div>
  </div>
)

const SecuritySettings = () => {
  const { aToken, backendUrl, updateSecuritySettings } = useContext(AdminContext)
  const { t, isRtl } = useLanguage()
  const [form, setForm] = useState(defaults)
  const [loadState, setLoadState] = useState('loading')
  const [saving, setSaving] = useState(false)

  /* Read from the server, not the cached copy, so a save can never write the defaults over a real policy. */
  const loadSettings = async () => {
    setLoadState('loading')
    try {
      const { data } = await axios.get(`${backendUrl}/api/admin/site-settings`, { headers: { aToken } })
      if (!data.success) throw new Error(data.message)
      setForm(pickKnownFields(data.settings?.security))
      setLoadState('ready')
    } catch {
      setLoadState('failed')
    }
  }

  useEffect(() => {
    if (aToken) loadSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aToken])

  const updateField = (field, value) => setForm((previous) => ({ ...previous, [field]: value }))

  const invalidFields = Object.keys(NUMBER_RANGES).filter((field) => !isInRange(form[field], NUMBER_RANGES[field]))

  const rangeError = (field) => {
    if (!invalidFields.includes(field)) return undefined
    const [min, max] = NUMBER_RANGES[field]
    return t('Enter a whole number from {{min}} to {{max}}').replace('{{min}}', min).replace('{{max}}', max)
  }

  const numberField = (field, label, unit, hint, notEnforced = false) => (
    <Field
      label={
        <span className='inline-flex flex-wrap items-center gap-2'>
          {label}
          {notEnforced && <NotEnforced />}
        </span>
      }
      hint={hint}
      error={rangeError(field)}
    >
      <NumberControl
        unit={unit}
        min={NUMBER_RANGES[field][0]}
        max={NUMBER_RANGES[field][1]}
        value={form[field]}
        onChange={(event) => updateField(field, event.target.value)}
      />
    </Field>
  )

  const toggle = (field, label, description, notEnforced = false) => (
    <ToggleRow
      checked={Boolean(form[field])}
      onChange={(value) => updateField(field, value)}
      label={label}
      description={description}
      notEnforced={notEnforced}
    />
  )

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (invalidFields.length) {
      notify.error(t('Fix the highlighted numbers before saving'))
      return
    }
    setSaving(true)
    const payload = pickKnownFields(form)
    Object.keys(NUMBER_RANGES).forEach((field) => {
      payload[field] = Number(form[field])
    })
    await updateSecuritySettings(payload)
    setSaving(false)
  }

  const separator = isRtl ? '، ' : ', '
  const enabledMfaRoles = [
    form.mfaRequiredForAdmins && t('Admins'),
    form.mfaRequiredForDoctors && t('Doctors'),
    form.mfaRequiredForReceptionists && t('Receptionists'),
    form.mfaRequiredForPatients && t('Patients')
  ].filter(Boolean)

  const strong = form.enforceStrongPasswords
  const passwordRules = [
    t('{{count}}+ characters').replace('{{count}}', form.passwordMinLength),
    strong && form.requireUppercase && t('uppercase letter'),
    strong && form.requireLowercase && t('lowercase letter'),
    strong && form.requireNumber && t('number'),
    strong && form.requireSpecialCharacter && t('special character'),
    strong && form.preventCommonPasswords && t('common passwords blocked')
  ].filter(Boolean)

  let mfaSummary = t('MFA is not required by policy')
  if (form.mfaRequiredGlobally) mfaSummary = t('Required globally for all users')
  else if (form.mfaEnabled) {
    mfaSummary = enabledMfaRoles.length
      ? t('Required for: {{roles}}').replace('{{roles}}', enabledMfaRoles.join(separator))
      : t('Required only for users you pick one by one')
  }

  const lockoutOff = !form.auditLogsEnabled || !form.allowIpTracking

  const saveIcon = <Save aria-hidden='true' className='size-4' />

  return (
    <AdminPage
      title={t('Security')}
      description={t('Control MFA, password strength, sessions, audit logs and retention for the clinic platform.')}
      icon={ShieldCheck}
      actions={
        loadState === 'ready' ? (
          <Button type='submit' form='security-settings-form' loading={saving} leadingIcon={saveIcon}>
            {t('Save security')}
          </Button>
        ) : null
      }
    >
      {loadState === 'loading' && (
        <SkeletonGroup className='space-y-4'>
          <Skeleton className='h-56 w-full rounded-card!' />
          <Skeleton className='h-56 w-full rounded-card!' />
        </SkeletonGroup>
      )}

      {loadState === 'failed' && (
        <div role='alert' className='flex flex-wrap items-center justify-between gap-3 rounded-card bg-danger-soft px-4 py-3 text-body-sm text-danger-ink'>
          <span className='min-w-0'>{t('These settings could not be loaded, so nothing can be saved yet.')}</span>
          <Button variant='secondary' size='sm' onClick={loadSettings}>{t('Try again')}</Button>
        </div>
      )}

      {loadState === 'ready' && (
        <form id='security-settings-form' onSubmit={handleSubmit} noValidate className='grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]'>
          <div className='min-w-0 space-y-5'>
            <Section icon={<ShieldQuestion aria-hidden='true' className='size-5 shrink-0 text-brand' />} title={t('Multi-factor authentication')}>
              <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
                {toggle('mfaEnabled', t('Enable MFA controls'), t('Turns on the per-role requirements below. Without it they do nothing.'))}
                {toggle('mfaRequiredGlobally', t('Require MFA globally'), t('One switch that requires MFA for every role and every user.'))}
                {toggle('mfaAllowUserOptIn', t('Allow user self-activation'), t('Doctors, receptionists and patients can turn on MFA for their own account even when it is not required. Admins always can.'))}
                {toggle('mfaRequiredForAdmins', t('Require for admins'), t('Admins must use a second factor when MFA is active.'))}
                {toggle('mfaRequiredForDoctors', t('Require for doctors'), t('Doctors must use a second factor when MFA is active.'))}
                {toggle('mfaRequiredForReceptionists', t('Require for receptionists'), t('Receptionists must use a second factor when MFA is active.'))}
                {toggle('mfaRequiredForPatients', t('Require for patients'), t('Patients must use a second factor when MFA is active.'))}
              </div>
            </Section>

            <Section icon={<KeyRound aria-hidden='true' className='size-5 shrink-0 text-brand' />} title={t('Password policy')}>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                {numberField('passwordMinLength', t('Minimum password length'), t('characters'), t('Checked whenever a password is set.'))}
                {numberField('passwordExpiryDays', t('Password expiry'), t('days'), t('Would ask for a new password after this many days. 0 means never.'), true)}
              </div>
              <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
                {toggle('enforceStrongPasswords', t('Enforce strong passwords'), t('Apply the rules below as well as the minimum length.'))}
                {toggle('preventCommonPasswords', t('Block common passwords'), t('Reject passwords like password123 and clinic123.'))}
                {toggle('requireUppercase', t('Require uppercase letter'), t('The password must include at least one letter from A to Z.'))}
                {toggle('requireLowercase', t('Require lowercase letter'), t('The password must include at least one letter from a to z.'))}
                {toggle('requireNumber', t('Require number'), t('The password must include at least one digit.'))}
                {toggle('requireSpecialCharacter', t('Require special character'), t('The password must include a symbol or punctuation mark.'))}
              </div>
            </Section>

            <Section icon={<Clock aria-hidden='true' className='size-5 shrink-0 text-brand' />} title={t('Sessions and access')}>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                {numberField(
                  'sessionTimeoutMinutes',
                  t('Admin session timeout'),
                  t('minutes'),
                  t('Enforced for admins. A sign-in expires this many minutes after it happens, even if the admin stays active. Applies from the next sign-in. Other roles are not affected.')
                )}
                {numberField(
                  'maxLoginAttempts',
                  t('Maximum admin login attempts'),
                  t('attempts'),
                  t('Enforced for admins. After this many failed sign-ins from one address, that address is locked out. Other roles are not limited by this.')
                )}
                {numberField(
                  'lockoutMinutes',
                  t('Admin lockout window'),
                  t('minutes'),
                  t('Enforced for admins. Failed sign-ins count for this long, so a locked address can try again once they age out.')
                )}
              </div>
              {lockoutOff && (
                <p role='status' className='flex items-start gap-2 rounded-control bg-warning-soft px-3 py-2 text-body-sm text-warning-ink'>
                  <TriangleAlert aria-hidden='true' className='mt-0.5 size-4 shrink-0' />
                  <span className='min-w-0'>{t('Admin lockout is off while audit logs or IP tracking are off, because it counts failed sign-ins from the audit log by address.')}</span>
                </p>
              )}
              <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
                {toggle('allowPatientSelfRegistration', t('Allow patient self registration'), t('Patients can create their own accounts from the public app.'))}
                {toggle('requireEmailVerification', t('Require email verification'), t('Would make patients confirm their email before using their account.'), true)}
                {toggle('enforceHttpsOnly', t('HTTPS only policy'), t('Would refuse connections that are not secure.'), true)}
                {toggle('allowIpTracking', t('Allow IP tracking'), t('Stores the address and location with audit records. Admin lockout needs this.'))}
              </div>
            </Section>

            <Section icon={<DatabaseBackup aria-hidden='true' className='size-5 shrink-0 text-brand' />} title={t('Retention and audit logs')}>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                {numberField('auditLogRetentionDays', t('Audit log retention'), t('days'), t('Older audit records are deleted when this page is saved or the audit log is opened.'))}
                {numberField('dataRetentionDays', t('Operational data retention'), t('days'), t('Would delete operational records older than this.'), true)}
                {numberField('inactiveAccountRetentionDays', t('Inactive account retention'), t('days'), t('Would remove accounts that have been inactive for this long.'), true)}
              </div>
              {toggle('auditLogsEnabled', t('Enable audit logs'), t('Admins can review security, payment, profile and medical-record activity. Admin lockout needs this.'))}
            </Section>

            <Button type='submit' fullWidth loading={saving} leadingIcon={saveIcon} className='sm:hidden'>
              {t('Save security')}
            </Button>
          </div>

          <Card as='aside' className='h-fit overflow-hidden xl:sticky xl:top-5'>
            <CardHeader
              headingLevel={2}
              title={
                <span className='flex items-center gap-2'>
                  <Lock aria-hidden='true' className='size-5 shrink-0 text-brand' />
                  {t('Policy summary')}
                </span>
              }
              description={t('What applies once this page is saved.')}
            />
            <CardBody className='space-y-3 text-body-sm'>
              <SummaryBox tone='bg-primary-soft text-brand' title={t('MFA')}>
                <p>{mfaSummary}</p>
              </SummaryBox>
              <SummaryBox tone='bg-success-soft text-success-ink' title={t('Passwords')}>
                <p>{passwordRules.join(separator)}</p>
              </SummaryBox>
              <SummaryBox tone='bg-warning-soft text-warning-ink' title={t('Audit logs')}>
                <p>
                  {form.auditLogsEnabled
                    ? t('Kept for {{days}} days').replace('{{days}}', form.auditLogRetentionDays)
                    : t('Audit log review is turned off')}
                </p>
              </SummaryBox>
              <SummaryBox tone='bg-surface-sunken text-ink-2' title={t('Data retention')}>
                <p className='mb-1.5'><NotEnforced /></p>
                <p>{t('Operational records: {{days}} days').replace('{{days}}', form.dataRetentionDays)}</p>
                <p>{t('Inactive accounts: {{days}} days').replace('{{days}}', form.inactiveAccountRetentionDays)}</p>
              </SummaryBox>
            </CardBody>
          </Card>
        </form>
      )}
    </AdminPage>
  )
}

export default SecuritySettings
