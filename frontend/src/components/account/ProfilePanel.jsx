import { useContext, useEffect, useMemo, useState } from 'react'
import { Camera, Save } from 'lucide-react'
import { AppContext } from '../../context/AppContext'
import { useLanguage } from '../../i18n'
import { isValidEgyptPhone, normalizeEgyptPhone, toEgyptLocalDigits } from '../../utils/egyptPhone'
import EgyptPhoneInput from '../EgyptPhoneInput'
import { Button, Card, CardBody, CardFooter, CardHeader, Field, Input, Select, notify } from '../ui'
import { FormError } from './accountUi'
import { useAccountApi, useServerText } from './accountApi'
import { todayIso } from './hubLogic'

const MAX_PHOTO_BYTES = 5 * 1024 * 1024
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const toDraft = (userData) => ({
  name: userData.name || '',
  phone: userData.phone === '000000000' ? '' : toEgyptLocalDigits(userData.phone || ''),
  line1: userData.address?.line1 || '',
  line2: userData.address?.line2 || '',
  gender: userData.gender || 'Not Selected',
  dob: userData.dob && userData.dob !== 'Not Selected' ? userData.dob : ''
})

/** Edits a private copy, so unsaved typing cannot leak into the rest of the app. */
const ProfilePanel = ({ userData }) => {
  const { loadUserProfileData, displayPersonName } = useContext(AppContext)
  const { t } = useLanguage()
  const api = useAccountApi()
  const say = useServerText()
  const [draft, setDraft] = useState(() => toDraft(userData))
  const [photo, setPhoto] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : ''), [photo])
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  const set = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.value }))
  const dirty = Boolean(photo) || JSON.stringify(draft) !== JSON.stringify(toDraft(userData))

  const pickPhoto = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!PHOTO_TYPES.includes(file.type)) return setError(t('Please choose a JPG, PNG or WebP image'))
    if (file.size > MAX_PHOTO_BYTES) return setError(t('File is too large. The limit is 5 MB.'))
    setError('')
    setPhoto(file)
  }

  const save = async (event) => {
    event.preventDefault()
    setError('')
    const original = toDraft(userData)
    const phoneChanged = draft.phone !== original.phone
    if (phoneChanged && !isValidEgyptPhone(draft.phone)) return setError(t('Enter a valid Egyptian mobile number (10 digits after +20)'))

    const formData = new FormData()
    formData.append('name', draft.name)
    formData.append('phone', phoneChanged ? normalizeEgyptPhone(draft.phone) : userData.phone || '')
    formData.append('address', JSON.stringify({ line1: draft.line1, line2: draft.line2 }))
    formData.append('gender', draft.gender)
    formData.append('dob', draft.dob)
    if (photo) formData.append('image', photo)

    setSaving(true)
    const data = await api('post', '/api/user/update-profile', formData)
    setSaving(false)
    if (!data.success) return setError(say(data.message))
    notify.success(say(data.message))
    setPhoto(null)
    await loadUserProfileData()
    if (phoneChanged) notify.info(t('Please confirm your new number from the Security tab.'))
  }

  return (
    <form onSubmit={save}>
      <Card>
        <CardHeader title={t('Your details')} description={t('How the clinic knows and reaches you.')} />
        <CardBody className='space-y-5'>
          <div className='flex items-center gap-4'>
            <img src={preview || userData.image} alt={displayPersonName(userData.name) || t('Profile')} className='size-20 rounded-card bg-surface-sunken object-cover' />
            <label className='inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-line-strong bg-surface px-4 text-body-sm font-semibold text-ink transition hover:border-primary'>
              <Camera className='size-4' aria-hidden='true' />
              {t('Change photo')}
              <input type='file' accept='image/jpeg,image/png,image/webp' onChange={pickPhoto} className='sr-only' />
            </label>
          </div>

          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <Field label={t('Full name')} required>
              <Input dir='auto' maxLength={120} value={draft.name} onChange={set('name')} autoComplete='name' />
            </Field>
            <Field label={t('Email')} hint={t('To change your email, please contact the clinic.')}>
              <Input dir='ltr' value={userData.email} readOnly className='bg-surface-sunken' />
            </Field>
            <div className='flex flex-col gap-1.5'>
              <label htmlFor='profile-phone' className='text-body-sm font-medium text-ink'>{t('Phone number')}</label>
              <EgyptPhoneInput id='profile-phone' value={draft.phone} onChange={(value) => setDraft((current) => ({ ...current, phone: value }))} />
            </div>
            <Field label={t('Birth date')} required>
              <Input type='date' max={todayIso()} value={draft.dob} onChange={set('dob')} className='date-field-input' />
            </Field>
            <Field label={t('Gender')}>
              <Select value={draft.gender} onChange={set('gender')}>
                <option value='Not Selected'>{t('Prefer not to say')}</option>
                <option value='Male'>{t('Male')}</option>
                <option value='Female'>{t('Female')}</option>
              </Select>
            </Field>
            <Field label={t('Patient ID')}>
              <Input dir='ltr' value={userData.patientId || ''} readOnly className='bg-surface-sunken' />
            </Field>
            <Field label={t('Address line 1')}>
              <Input dir='auto' maxLength={200} value={draft.line1} onChange={set('line1')} placeholder={t('Street, building, area')} autoComplete='address-line1' />
            </Field>
            <Field label={t('Address line 2')}>
              <Input dir='auto' maxLength={200} value={draft.line2} onChange={set('line2')} placeholder={t('Apartment, floor, landmark')} autoComplete='address-line2' />
            </Field>
          </div>
          <FormError>{error}</FormError>
        </CardBody>
        <CardFooter>
          <Button type='submit' loading={saving} disabled={!dirty} leadingIcon={<Save className='size-4' />}>{t('Save profile')}</Button>
        </CardFooter>
      </Card>
    </form>
  )
}

export default ProfilePanel
