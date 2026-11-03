import { useContext, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { Camera, Edit, KeyRound, Mail, Phone, Save, Shield, ShieldCheck, Trash2, Upload, UserRound, X } from 'lucide-react'
import { AdminContext } from '../../context/AdminContext'
import { useLanguage } from '../../i18n'
import { AdminPage } from '../../components/admin/AdminPage'
import MfaSetupBox from '../../components/MfaSetupBox'
import { Badge, Button, Card, CardBody, CardHeader, Field, IconButton, Input, notify, Skeleton, SkeletonGroup, Textarea } from '../../components/ui'
import { EGYPT_DIAL_CODE, isValidEgyptPhone, parseEgyptLocalDigits, toEgyptLocalDigits } from '../../utils/egyptPhone'

const emptyForm = () => ({
  name: '',
  email: '',
  phoneLocal: '',
  jobTitle: '',
  bio: '',
  image: ''
})

const profileToForm = (profile) => ({
  name: profile?.name || '',
  email: profile?.email || '',
  phoneLocal: toEgyptLocalDigits(profile?.phone || ''),
  jobTitle: profile?.jobTitle || '',
  bio: profile?.bio || '',
  image: profile?.image || ''
})

/* An Arabic keyboard types ٠١٢, and the digit filters below would otherwise drop them. */
const toWesternDigits = (value) => String(value ?? '').replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))

const cleanCode = (value) => toWesternDigits(value).replace(/\D/g, '').slice(0, 6)

const PhoneInput = (props) => (
  <div dir='ltr' className='flex items-stretch gap-2'>
    <span className='flex shrink-0 items-center rounded-control bg-surface-sunken px-3 text-body-sm font-semibold text-ink-2'>{EGYPT_DIAL_CODE}</span>
    <Input inputMode='numeric' autoComplete='tel-national' className='min-w-0 flex-1' {...props} />
  </div>
)

const CodeInput = (props) => (
  <Input
    dir='ltr'
    inputMode='numeric'
    autoComplete='one-time-code'
    className='text-center font-semibold tracking-[0.35em] sm:max-w-48'
    {...props}
  />
)

const AdminProfile = () => {
  const { aToken, backendUrl, refreshAdminNavSummary } = useContext(AdminContext)
  const { t } = useLanguage()
  const [form, setForm] = useState(emptyForm())
  const [savedForm, setSavedForm] = useState(emptyForm())
  const [loadState, setLoadState] = useState('loading')
  const [isEdit, setIsEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [removeImage, setRemoveImage] = useState(false)
  const [mfaStatus, setMfaStatus] = useState(null)
  const [mfaLoadFailed, setMfaLoadFailed] = useState(false)
  const [mfaSetup, setMfaSetup] = useState(null)
  const [mfaCode, setMfaCode] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [mfaBusy, setMfaBusy] = useState(false)
  const [mfaError, setMfaError] = useState('')
  const photoInput = useRef(null)

  const errorText = (error) => t(error.response?.data?.message || error.message)

  const applyProfile = (profile) => {
    const next = profileToForm(profile)
    setForm(next)
    setSavedForm(next)
  }

  const loadProfile = async () => {
    setLoadState('loading')
    try {
      const { data } = await axios.get(`${backendUrl}/api/admin/profile`, { headers: { aToken } })
      if (!data.success) throw new Error(data.message)
      applyProfile(data.profile)
      refreshAdminNavSummary?.()
      setLoadState('ready')
    } catch {
      setLoadState('failed')
    }
  }

  const loadMfaStatus = async () => {
    setMfaLoadFailed(false)
    try {
      const { data } = await axios.get(`${backendUrl}/api/admin/mfa/status`, { headers: { aToken } })
      if (!data.success) throw new Error(data.message)
      setMfaStatus(data.mfa)
    } catch {
      /* Unknown is not the same as off: no MFA actions are offered until this is known. */
      setMfaStatus(null)
      setMfaLoadFailed(true)
    }
  }

  useEffect(() => {
    if (!aToken) return
    loadProfile()
    loadMfaStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aToken])

  /* One object URL per chosen photo, released when the photo changes or the page closes. */
  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview('')
      return undefined
    }
    const url = URL.createObjectURL(photoFile)
    setPhotoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photoFile])

  const updateField = (field, value) => setForm((previous) => ({ ...previous, [field]: value }))

  const onPickPhoto = (event) => {
    const file = event.target.files?.[0]
    /* Cleared so choosing the same file again still fires a change. */
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      notify.error(t('Please choose an image file'))
      return
    }
    setPhotoFile(file)
    setRemoveImage(false)
  }

  const onRemovePhoto = () => {
    setPhotoFile(null)
    setRemoveImage(Boolean(form.image))
  }

  const resetEditState = () => {
    setIsEdit(false)
    setAttempted(false)
    setPhotoFile(null)
    setRemoveImage(false)
  }

  const cancelEdit = () => {
    setForm(savedForm)
    resetEditState()
  }

  const nameError = attempted && !form.name.trim() ? t('Name is required') : undefined
  const phoneError = attempted && form.phoneLocal && !isValidEgyptPhone(form.phoneLocal)
    ? t('Enter a valid Egyptian mobile number (01xxxxxxxxx)')
    : undefined

  const saveProfile = async (event) => {
    event.preventDefault()
    setAttempted(true)
    if (!form.name.trim() || (form.phoneLocal && !isValidEgyptPhone(form.phoneLocal))) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('name', form.name.trim())
      fd.append('phone', form.phoneLocal ? `${EGYPT_DIAL_CODE}${form.phoneLocal}` : '')
      fd.append('jobTitle', form.jobTitle.trim())
      fd.append('bio', form.bio.trim())
      if (removeImage) fd.append('removeImage', 'true')
      if (photoFile) fd.append('image', photoFile)

      const { data } = await axios.post(`${backendUrl}/api/admin/update-profile`, fd, { headers: { aToken } })

      if (data.success) {
        notify.success(t(data.message))
        if (data.profile) applyProfile(data.profile)
        resetEditState()
        refreshAdminNavSummary?.()
      } else {
        notify.error(t(data.message))
      }
    } catch (error) {
      notify.error(errorText(error))
    } finally {
      setSaving(false)
    }
  }

  const startMfaSetup = async () => {
    setMfaBusy(true)
    setMfaError('')
    try {
      const { data } = await axios.post(`${backendUrl}/api/admin/mfa/setup`, {}, { headers: { aToken } })
      if (data.success) {
        setMfaSetup(data.setup)
        setMfaCode('')
      } else {
        setMfaError(t(data.message))
      }
    } catch (error) {
      setMfaError(errorText(error))
    } finally {
      setMfaBusy(false)
    }
  }

  const enableMfa = async (event) => {
    event.preventDefault()
    if (mfaCode.length !== 6) {
      setMfaError(t('Enter the 6-digit code'))
      return
    }
    setMfaBusy(true)
    setMfaError('')
    try {
      const { data } = await axios.post(`${backendUrl}/api/admin/mfa/enable`, { code: mfaCode }, { headers: { aToken } })
      if (data.success) {
        notify.success(t(data.message))
        setMfaSetup(null)
        setMfaCode('')
        await loadMfaStatus()
      } else {
        setMfaError(t(data.message))
      }
    } catch (error) {
      setMfaError(errorText(error))
    } finally {
      setMfaBusy(false)
    }
  }

  const disableMfa = async (event) => {
    event.preventDefault()
    if (disableCode.length !== 6) {
      setMfaError(t('Enter the 6-digit code'))
      return
    }
    setMfaBusy(true)
    setMfaError('')
    try {
      const { data } = await axios.post(`${backendUrl}/api/admin/mfa/disable`, { code: disableCode }, { headers: { aToken } })
      if (data.success) {
        notify.success(t(data.message))
        setDisableCode('')
        setMfaSetup(null)
        await loadMfaStatus()
      } else {
        setMfaError(t(data.message))
      }
    } catch (error) {
      setMfaError(errorText(error))
    } finally {
      setMfaBusy(false)
    }
  }

  const cancelMfaSetup = () => {
    setMfaSetup(null)
    setMfaCode('')
    setMfaError('')
  }

  const displayImage = photoPreview || (!removeImage && form.image) || ''
  const displayName = savedForm.name || t('Administrator')
  const adminInitial = displayName.trim().charAt(0).toUpperCase()

  return (
    <AdminPage title={t('My account')} description={t('Your details and how you sign in.')} icon={UserRound} width='max-w-3xl'>
      {loadState === 'loading' && (
        <SkeletonGroup className='space-y-5'>
          <Skeleton className='h-36 w-full rounded-card!' />
          <Skeleton className='h-72 w-full rounded-card!' />
        </SkeletonGroup>
      )}

      {loadState === 'failed' && (
        <div role='alert' className='mb-5 flex flex-wrap items-center justify-between gap-3 rounded-card bg-danger-soft px-4 py-3 text-body-sm text-danger-ink'>
          <span className='min-w-0'>{t('Your profile could not be loaded.')}</span>
          <Button variant='secondary' size='sm' onClick={loadProfile}>{t('Try again')}</Button>
        </div>
      )}

      {loadState === 'ready' && (
        <div className='mb-5 space-y-5'>
          <Card variant='signature'>
            <CardBody className='flex flex-col gap-5 sm:flex-row sm:items-center'>
              <div className='relative w-fit shrink-0'>
                {displayImage ? (
                  <img src={displayImage} alt='' className='size-20 rounded-card object-cover' />
                ) : (
                  <span aria-hidden='true' className='flex size-20 items-center justify-center rounded-card bg-primary text-title-lg font-bold text-on-primary'>
                    {adminInitial}
                  </span>
                )}
                {isEdit && (
                  <IconButton
                    label={t('Upload photo')}
                    variant='secondary'
                    size='sm'
                    onClick={() => photoInput.current?.click()}
                    className='absolute -bottom-2 -end-2 rounded-full! shadow-e1'
                  >
                    <Camera aria-hidden='true' className='size-4' />
                  </IconButton>
                )}
              </div>
              <div className='min-w-0 flex-1'>
                <h2 className='text-title-lg font-semibold text-ink'>{t(displayName)}</h2>
                <p className='mt-1 flex min-w-0 items-center gap-2 text-body-sm text-ink-2'>
                  <Mail aria-hidden='true' className='size-4 shrink-0 text-ink-3' />
                  <span dir='ltr' className='truncate'>{savedForm.email}</span>
                </p>
                {savedForm.phoneLocal && (
                  <p className='mt-1 flex items-center gap-2 text-body-sm text-ink-2'>
                    <Phone aria-hidden='true' className='size-4 shrink-0 text-ink-3' />
                    <span dir='ltr'>{EGYPT_DIAL_CODE} {savedForm.phoneLocal}</span>
                  </p>
                )}
                <Badge tone='brand' className='mt-2 max-w-full whitespace-normal!'>
                  <Shield aria-hidden='true' className='size-3.5 shrink-0' />
                  {t(savedForm.jobTitle || 'Clinic Administrator')}
                </Badge>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              headingLevel={2}
              className='flex-wrap'
              title={t('Profile details')}
              description={t('Update how you appear in the app. Your sign-in email and password are managed on the server.')}
              action={
                !isEdit && (
                  <Button onClick={() => setIsEdit(true)} leadingIcon={<Edit aria-hidden='true' className='size-4' />}>
                    {t('Edit profile')}
                  </Button>
                )
              }
            />
            <CardBody>
              <form onSubmit={saveProfile} noValidate className='grid gap-4 sm:grid-cols-2'>
                {isEdit && (
                  <div className='sm:col-span-2'>
                    <p className='text-body-sm font-medium text-ink'>{t('Profile photo')}</p>
                    <input ref={photoInput} type='file' accept='image/*' className='hidden' onChange={onPickPhoto} />
                    <div className='mt-1.5 flex flex-wrap items-center gap-2'>
                      <Button variant='secondary' size='sm' onClick={() => photoInput.current?.click()} leadingIcon={<Upload aria-hidden='true' className='size-4' />}>
                        {t('Upload photo')}
                      </Button>
                      {displayImage && (
                        <Button variant='ghost' size='sm' onClick={onRemovePhoto} className='text-danger-ink!' leadingIcon={<Trash2 aria-hidden='true' className='size-4' />}>
                          {t('Remove photo')}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <Field label={t('Full name')} error={nameError} required>
                  <Input value={form.name} onChange={(event) => updateField('name', event.target.value)} disabled={!isEdit} maxLength={120} />
                </Field>

                <Field label={t('Job title')}>
                  <Input value={form.jobTitle} onChange={(event) => updateField('jobTitle', event.target.value)} disabled={!isEdit} maxLength={80} />
                </Field>

                <Field label={t('Sign-in email')} hint={t('Contact your technical team to change your sign-in email or password.')} className='sm:col-span-2'>
                  <Input dir='ltr' value={form.email} readOnly className='bg-surface-sunken! text-ink-2!' />
                </Field>

                <Field label={t('Mobile number')} error={phoneError} className='sm:col-span-2'>
                  <PhoneInput
                    value={form.phoneLocal}
                    onChange={(event) => updateField('phoneLocal', parseEgyptLocalDigits(toWesternDigits(event.target.value)))}
                    disabled={!isEdit}
                    placeholder={t('10 digits')}
                  />
                </Field>

                <Field label={t('Short bio')} className='sm:col-span-2'>
                  <Textarea
                    value={form.bio}
                    onChange={(event) => updateField('bio', event.target.value)}
                    disabled={!isEdit}
                    rows={3}
                    maxLength={500}
                    placeholder={t('Optional note about your role')}
                  />
                </Field>

                {isEdit && (
                  <div className='flex flex-wrap gap-2 sm:col-span-2'>
                    <Button type='submit' loading={saving} leadingIcon={<Save aria-hidden='true' className='size-4' />}>
                      {t('Save changes')}
                    </Button>
                    <Button variant='secondary' onClick={cancelEdit} disabled={saving} leadingIcon={<X aria-hidden='true' className='size-4' />}>
                      {t('Cancel')}
                    </Button>
                  </div>
                )}
              </form>

              <Button as={Link} to='/security-settings' variant='ghost' size='sm' className='mt-4 max-w-full text-brand!' leadingIcon={<ShieldCheck aria-hidden='true' className='size-4 shrink-0' />}>
                {t('Open security and MFA policies')}
              </Button>
            </CardBody>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader
          headingLevel={2}
          className='flex-wrap'
          title={
            <span className='flex items-center gap-2'>
              <ShieldCheck aria-hidden='true' className='size-5 shrink-0 text-brand' />
              {t('Authenticator MFA for your account')}
            </span>
          }
        />
        <CardBody className='space-y-4'>
          {mfaLoadFailed && (
            <div role='alert' className='flex flex-wrap items-center justify-between gap-3 rounded-control bg-danger-soft px-3 py-2 text-body-sm text-danger-ink'>
              <span className='min-w-0'>{t('Your MFA status could not be loaded.')}</span>
              <Button variant='secondary' size='sm' onClick={loadMfaStatus}>{t('Try again')}</Button>
            </div>
          )}

          {!mfaStatus && !mfaLoadFailed && (
            <SkeletonGroup>
              <Skeleton className='h-6 w-40' />
            </SkeletonGroup>
          )}

          {mfaStatus && (
            <>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge tone={mfaStatus.enabled ? 'success' : 'neutral'} dot>
                  {mfaStatus.enabled ? t('MFA is on') : t('MFA is off')}
                </Badge>
                {mfaStatus.required && <Badge tone='info'>{t('Required by policy')}</Badge>}
              </div>

              {mfaError && !mfaSetup && !mfaStatus.enabled && (
                <p role='alert' className='rounded-control bg-danger-soft px-3 py-2 text-body-sm text-danger-ink'>{mfaError}</p>
              )}

              {mfaSetup && (
                <form onSubmit={enableMfa} noValidate className='space-y-4'>
                  <MfaSetupBox mode='setup' setup={mfaSetup} />
                  <Field label={t('Code from your authenticator app')} error={mfaError || undefined}>
                    <CodeInput
                      value={mfaCode}
                      onChange={(event) => setMfaCode(cleanCode(event.target.value))}
                      placeholder='000000'
                    />
                  </Field>
                  <div className='flex flex-wrap gap-2'>
                    <Button type='submit' loading={mfaBusy}>{t('Verify and enable')}</Button>
                    <Button variant='secondary' onClick={cancelMfaSetup} disabled={mfaBusy}>{t('Cancel setup')}</Button>
                  </div>
                </form>
              )}

              {!mfaSetup && !mfaStatus.enabled && (
                <>
                  {mfaStatus.required && (
                    <p className='text-body-sm text-ink-2'>{t('Admins must use MFA. Set it up now, or you will be asked to at your next sign-in.')}</p>
                  )}
                  <Button onClick={startMfaSetup} loading={mfaBusy} leadingIcon={<KeyRound aria-hidden='true' className='size-4' />}>
                    {t('Set up MFA')}
                  </Button>
                </>
              )}

              {!mfaSetup && mfaStatus.enabled && !mfaStatus.required && (
                <form onSubmit={disableMfa} noValidate className='space-y-3'>
                  <Field label={t('Code from your authenticator app')} hint={t('Needed to turn MFA off.')} error={mfaError || undefined}>
                    <CodeInput value={disableCode} onChange={(event) => setDisableCode(cleanCode(event.target.value))} placeholder='000000' />
                  </Field>
                  <Button type='submit' variant='danger' loading={mfaBusy}>{t('Disable MFA')}</Button>
                </form>
              )}

              {!mfaSetup && mfaStatus.enabled && mfaStatus.required && (
                <p className='text-body-sm text-ink-2'>{t('MFA is required for admins. You cannot turn it off while the policy is active.')}</p>
              )}
            </>
          )}
        </CardBody>
      </Card>
    </AdminPage>
  )
}

export default AdminProfile
