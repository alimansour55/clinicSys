import React, { useContext, useEffect, useMemo, useState } from 'react'
import { AdminContext } from '../../context/AdminContext'
import { Clock, DatabaseBackup, KeyRound, Loader2, Lock, Save, ShieldCheck, ShieldQuestion } from 'lucide-react'

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

const ToggleRow = ({ checked, onChange, label, description }) => (
  <label className='flex items-start justify-between gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 cursor-pointer hover:bg-gray-50 transition'>
    <span>
      <span className='block text-sm font-semibold text-gray-900'>{label}</span>
      <span className='block text-xs text-gray-500 mt-1 leading-5'>{description}</span>
    </span>
    <input
      type='checkbox'
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className='mt-1 h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary'
    />
  </label>
)

const NumberInput = ({ label, value, onChange, min, max, suffix }) => (
  <div>
    <label className='block text-sm font-semibold text-gray-700 mb-2'>{label}</label>
    <div className='flex rounded-lg border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-primary'>
      <input
        type='number'
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className='min-w-0 flex-1 rounded-l-lg px-3 py-2.5 text-sm outline-none'
      />
      <span className='flex items-center rounded-r-lg border-l border-gray-200 bg-gray-50 px-3 text-xs font-semibold text-gray-500'>{suffix}</span>
    </div>
  </div>
)

const Section = ({ icon, title, children }) => (
  <div className='bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm'>
    <h2 className='text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2'>
      {icon}
      {title}
    </h2>
    {children}
  </div>
)

const SecuritySettings = () => {
  const { aToken, siteSettings, getSiteSettings, updateSecuritySettings } = useContext(AdminContext)
  const [form, setForm] = useState(defaults)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (aToken) getSiteSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aToken])

  useEffect(() => {
    if (siteSettings?.security) {
      setForm({ ...defaults, ...siteSettings.security })
    }
  }, [siteSettings])

  const updateField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    const payload = Object.entries(form).reduce((acc, [key, value]) => {
      acc[key] = typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))
        ? Number(value)
        : value
      return acc
    }, {})
    await updateSecuritySettings(payload)
    setSaving(false)
  }

  const enabledMfaRoles = useMemo(() => [
    form.mfaRequiredForAdmins && 'Admins',
    form.mfaRequiredForDoctors && 'Doctors',
    form.mfaRequiredForReceptionists && 'Receptionists',
    form.mfaRequiredForPatients && 'Patients'
  ].filter(Boolean), [form])

  const passwordRules = useMemo(() => [
    `${form.passwordMinLength}+ characters`,
    form.enforceStrongPasswords && form.requireUppercase && 'uppercase',
    form.enforceStrongPasswords && form.requireLowercase && 'lowercase',
    form.enforceStrongPasswords && form.requireNumber && 'number',
    form.enforceStrongPasswords && form.requireSpecialCharacter && 'special character',
    form.enforceStrongPasswords && form.preventCommonPasswords && 'blocks common passwords'
  ].filter(Boolean), [form])

  return (
    <div className='min-h-screen bg-gray-50 p-3 sm:p-5 md:p-6 lg:p-8'>
      <div className='max-w-7xl'>
        <div className='mb-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4'>
          <div>
            <h1 className='text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2'>
              <ShieldCheck className='w-6 h-6 text-primary' />
              Security
            </h1>
            <p className='mt-2 text-sm text-gray-600 ml-8'>
              Control MFA, password strength, sessions, audit logs, and retention policies for the clinic platform.
            </p>
          </div>

          <button
            type='submit'
            form='security-settings-form'
            disabled={saving}
            className='inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90 disabled:bg-gray-300 transition'
          >
            {saving ? <Loader2 className='w-4 h-4 animate-spin' /> : <Save className='w-4 h-4' />}
            Save Security
          </button>
        </div>

        <form id='security-settings-form' onSubmit={handleSubmit} className='grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5'>
          <div className='space-y-5'>
            <Section icon={<ShieldQuestion className='w-5 h-5 text-primary' />} title='Multi-Factor Authentication'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                <ToggleRow checked={form.mfaEnabled} onChange={(value) => updateField('mfaEnabled', value)} label='Enable MFA controls' description='Turn on multi-factor authentication policy management.' />
                <ToggleRow checked={form.mfaRequiredGlobally} onChange={(value) => updateField('mfaRequiredGlobally', value)} label='Require MFA globally' description='One click to require MFA for every role and every user.' />
                <ToggleRow checked={form.mfaAllowUserOptIn} onChange={(value) => updateField('mfaAllowUserOptIn', value)} label='Allow user self-activation' description='Users can enable MFA for their own account even if it is not required.' />
                <ToggleRow checked={form.mfaRequiredForAdmins} onChange={(value) => updateField('mfaRequiredForAdmins', value)} label='Require for admins' description='Admins must use a second factor when MFA is active.' />
                <ToggleRow checked={form.mfaRequiredForDoctors} onChange={(value) => updateField('mfaRequiredForDoctors', value)} label='Require for doctors' description='Doctors must use a second factor when MFA is active.' />
                <ToggleRow checked={form.mfaRequiredForReceptionists} onChange={(value) => updateField('mfaRequiredForReceptionists', value)} label='Require for receptionists' description='Receptionists must use a second factor when MFA is active.' />
                <ToggleRow checked={form.mfaRequiredForPatients} onChange={(value) => updateField('mfaRequiredForPatients', value)} label='Require for patients' description='Patients must use a second factor when MFA is active.' />
              </div>
            </Section>

            <Section icon={<KeyRound className='w-5 h-5 text-primary' />} title='Password Policy'>
              <div className='grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4'>
                <NumberInput label='Minimum password length' value={form.passwordMinLength} onChange={(value) => updateField('passwordMinLength', value)} min='6' max='128' suffix='chars' />
                <NumberInput label='Password expiry' value={form.passwordExpiryDays} onChange={(value) => updateField('passwordExpiryDays', value)} min='0' max='3650' suffix='days' />
                <NumberInput label='Maximum login attempts' value={form.maxLoginAttempts} onChange={(value) => updateField('maxLoginAttempts', value)} min='3' max='20' suffix='tries' />
              </div>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                <ToggleRow checked={form.enforceStrongPasswords} onChange={(value) => updateField('enforceStrongPasswords', value)} label='Enforce strong passwords' description='Apply composition rules instead of length-only validation.' />
                <ToggleRow checked={form.preventCommonPasswords} onChange={(value) => updateField('preventCommonPasswords', value)} label='Block common passwords' description='Reject passwords like password123 and clinic123.' />
                <ToggleRow checked={form.requireUppercase} onChange={(value) => updateField('requireUppercase', value)} label='Require uppercase letter' description='Password must include at least one A-Z character.' />
                <ToggleRow checked={form.requireLowercase} onChange={(value) => updateField('requireLowercase', value)} label='Require lowercase letter' description='Password must include at least one a-z character.' />
                <ToggleRow checked={form.requireNumber} onChange={(value) => updateField('requireNumber', value)} label='Require number' description='Password must include at least one digit.' />
                <ToggleRow checked={form.requireSpecialCharacter} onChange={(value) => updateField('requireSpecialCharacter', value)} label='Require special character' description='Password must include a symbol or punctuation mark.' />
              </div>
            </Section>

            <Section icon={<Clock className='w-5 h-5 text-primary' />} title='Sessions and Access'>
              <div className='grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4'>
                <NumberInput label='Account lockout window' value={form.lockoutMinutes} onChange={(value) => updateField('lockoutMinutes', value)} min='1' max='1440' suffix='minutes' />
                <NumberInput label='Session timeout' value={form.sessionTimeoutMinutes} onChange={(value) => updateField('sessionTimeoutMinutes', value)} min='5' max='1440' suffix='minutes' />
                <NumberInput label='Inactive account retention' value={form.inactiveAccountRetentionDays} onChange={(value) => updateField('inactiveAccountRetentionDays', value)} min='30' max='3650' suffix='days' />
              </div>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                <ToggleRow checked={form.allowPatientSelfRegistration} onChange={(value) => updateField('allowPatientSelfRegistration', value)} label='Allow patient self registration' description='Patients can create their own accounts from the public app.' />
                <ToggleRow checked={form.requireEmailVerification} onChange={(value) => updateField('requireEmailVerification', value)} label='Require email verification' description='Mark email confirmation as required in security policy.' />
                <ToggleRow checked={form.enforceHttpsOnly} onChange={(value) => updateField('enforceHttpsOnly', value)} label='HTTPS only policy' description='Keep the platform marked for secure transport only.' />
                <ToggleRow checked={form.allowIpTracking} onChange={(value) => updateField('allowIpTracking', value)} label='Allow IP tracking' description='Include IP/location metadata in audit records where available.' />
              </div>
            </Section>

            <Section icon={<DatabaseBackup className='w-5 h-5 text-primary' />} title='Retention and Audit Logs'>
              <div className='grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4'>
                <NumberInput label='Audit log retention' value={form.auditLogRetentionDays} onChange={(value) => updateField('auditLogRetentionDays', value)} min='30' max='3650' suffix='days' />
                <NumberInput label='Operational data retention' value={form.dataRetentionDays} onChange={(value) => updateField('dataRetentionDays', value)} min='30' max='3650' suffix='days' />
                <NumberInput label='Inactive account data' value={form.inactiveAccountRetentionDays} onChange={(value) => updateField('inactiveAccountRetentionDays', value)} min='30' max='3650' suffix='days' />
              </div>
              <ToggleRow checked={form.auditLogsEnabled} onChange={(value) => updateField('auditLogsEnabled', value)} label='Enable audit logs' description='Admins can review security, payment, profile, and medical-record activity.' />
            </Section>
          </div>

          <aside className='bg-white border border-gray-200 rounded-xl shadow-sm h-fit xl:sticky xl:top-5 overflow-hidden'>
            <div className='p-4 sm:p-5 border-b border-gray-100'>
              <h2 className='text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2'>
                <Lock className='w-5 h-5 text-primary' />
                Policy Summary
              </h2>
              <p className='text-sm text-gray-500 mt-1'>Current security posture after saving.</p>
            </div>
            <div className='p-4 sm:p-5 space-y-4 text-sm'>
              <div className='rounded-lg bg-blue-50 p-3'>
                <p className='font-semibold text-blue-900'>MFA</p>
                <p className='mt-1 text-blue-700'>
                  {form.mfaRequiredGlobally
                    ? 'Required globally for all users'
                    : form.mfaEnabled
                      ? `Required for: ${enabledMfaRoles.join(', ') || 'selected users only'}`
                      : 'MFA is not active'}
                </p>
              </div>
              <div className='rounded-lg bg-emerald-50 p-3'>
                <p className='font-semibold text-emerald-900'>Passwords</p>
                <p className='mt-1 text-emerald-700'>{passwordRules.join(', ')}</p>
              </div>
              <div className='rounded-lg bg-amber-50 p-3'>
                <p className='font-semibold text-amber-900'>Audit logs</p>
                <p className='mt-1 text-amber-700'>{form.auditLogsEnabled ? `Saved for ${form.auditLogRetentionDays} days` : 'Audit log review is disabled'}</p>
              </div>
              <div className='rounded-lg bg-gray-100 p-3'>
                <p className='font-semibold text-gray-900'>Data retention</p>
                <p className='mt-1 text-gray-700'>Operational records: {form.dataRetentionDays} days</p>
                <p className='text-gray-700'>Inactive accounts: {form.inactiveAccountRetentionDays} days</p>
              </div>
            </div>
          </aside>
        </form>
      </div>
    </div>
  )
}

export default SecuritySettings
