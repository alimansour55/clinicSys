import React, { useContext, useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Camera, Loader2, Save, Shield, UserCog } from 'lucide-react'
import { AdminContext } from '../../context/AdminContext'
import { useLanguage } from '../../i18n'
import BilingualField from '../../components/BilingualField'
import { AdminPage } from '../../components/admin/AdminPage'
import { ToggleRow, useFilePreview } from '../../components/admin/SiteContentForm'
import { Button, Card, CardBody, Field, Input, notify, Textarea } from '../../components/ui'
import { bilingualFromRecord, bilingualIsEmpty, bilingualPayload, emptyBilingual } from '../../utils/bilingualValue'
import { emptyAddress, emptyEmergencyContact, mergeReceptionistFromApi } from '../../utils/receptionistProfileForm'

const addressLabels = {
  line1: 'Address line 1',
  line2: 'Address line 2',
  city: 'City',
  state: 'State / region',
  postalCode: 'Postal code',
  country: 'Country'
}

const toForm = (row) => ({
  ...mergeReceptionistFromApi(row),
  password: '',
  mfaRequiredByAdmin: Boolean(row.mfa?.requiredByAdmin)
})

const EditReceptionist = () => {
  const { receptionistId } = useParams()
  const navigate = useNavigate()
  const { aToken, getReceptionistById, updateReceptionistByAdmin, translatePreview } = useContext(AdminContext)
  const { t } = useLanguage()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [photoFile, setPhotoFile] = useState(null)
  const [name, setName] = useState(emptyBilingual)
  const [form, setForm] = useState({
    email: '',
    phone: '',
    password: '',
    jobTitle: 'Receptionist',
    department: '',
    employeeId: '',
    bio: '',
    adminNotes: '',
    isActive: true,
    mfaRequiredByAdmin: false,
    address: emptyAddress(),
    emergencyContact: emptyEmergencyContact(),
    image: ''
  })
  const photoPreview = useFilePreview(photoFile, form.image)

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }))
  const setAddressField = (k, v) => setForm((p) => ({ ...p, address: { ...p.address, [k]: v } }))
  const setEmergencyField = (k, v) => setForm((p) => ({ ...p, emergencyContact: { ...p.emergencyContact, [k]: v } }))

  const showRecord = (row) => {
    setForm((previous) => ({ ...previous, ...toForm(row) }))
    setName(bilingualFromRecord(row, 'name'))
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!aToken || !receptionistId) return
      setLoading(true)
      const row = await getReceptionistById(receptionistId)
      if (!cancelled && row) showRecord(row)
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aToken, receptionistId])

  const onPickPhoto = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      notify.error(t('Please choose an image file'))
      return
    }
    setPhotoFile(file)
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (bilingualIsEmpty(name)) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('receptionistId', receptionistId)
      fd.append('nameI18n', JSON.stringify(bilingualPayload(name)))
      fd.append('email', form.email)
      fd.append('phone', form.phone)
      fd.append('jobTitle', form.jobTitle || 'Receptionist')
      fd.append('department', form.department || '')
      fd.append('employeeId', form.employeeId || '')
      fd.append('bio', form.bio || '')
      fd.append('adminNotes', form.adminNotes || '')
      fd.append('isActive', form.isActive ? 'true' : 'false')
      fd.append('mfaRequiredByAdmin', form.mfaRequiredByAdmin ? 'true' : 'false')
      fd.append('address', JSON.stringify(form.address || emptyAddress()))
      fd.append('emergencyContact', JSON.stringify(form.emergencyContact || emptyEmergencyContact()))
      if (form.password.trim()) fd.append('password', form.password.trim())
      if (photoFile) fd.append('image', photoFile)

      const ok = await updateReceptionistByAdmin(fd)
      if (ok) {
        setPhotoFile(null)
        const refreshed = await getReceptionistById(receptionistId)
        if (refreshed) showRecord(refreshed)
      }
    } finally {
      setSaving(false)
    }
  }

  if (!aToken) {
    return null
  }

  if (loading) {
    return (
      <div className='flex min-h-[40vh] items-center justify-center'>
        <Loader2 aria-hidden='true' className='size-10 animate-spin text-brand' />
      </div>
    )
  }

  return (
    <AdminPage
      icon={UserCog}
      width='max-w-4xl'
      title={t('Edit receptionist')}
      description={t('Full profile, photo, address, emergency contact, HR notes, and MFA policy.')}
      actions={
        <Button as={Link} to='/receptionist-list' variant='secondary' size='sm' leadingIcon={<ArrowLeft aria-hidden='true' className='size-4 rtl:-scale-x-100' />}>
          {t('Receptionists')}
        </Button>
      }
    >
      <form onSubmit={onSubmit}>
        <Card variant='flat'>
          <CardBody className='space-y-6'>
            <div className='flex flex-col gap-6 sm:flex-row'>
              <div className='flex flex-col items-center'>
                <div className='size-32 overflow-hidden rounded-full border-2 border-line bg-surface-sunken'>
                  {photoPreview ? (
                    <img src={photoPreview} alt='' className='size-full object-cover' />
                  ) : (
                    <div className='flex size-full items-center justify-center text-3xl font-bold text-ink-3'>{(name.en || name.ar || '?').charAt(0)}</div>
                  )}
                </div>
                <label className='mt-3 inline-flex cursor-pointer items-center gap-2 text-body-sm font-semibold text-brand'>
                  <Camera aria-hidden='true' className='size-4' />
                  {t('Upload photo')}
                  <input type='file' accept='image/*' className='sr-only' onChange={onPickPhoto} />
                </label>
              </div>

              <div className='grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2'>
                <BilingualField className='sm:col-span-2' label={t('Full name')} kind='name' value={name} onChange={setName} translate={translatePreview} required />
                <Field label={t('Email')} required>
                  <Input dir='ltr' style={{ textAlign: 'start' }} required type='email' value={form.email} onChange={(e) => setField('email', e.target.value)} />
                </Field>
                <Field label={t('Phone')} required>
                  <Input dir='ltr' style={{ textAlign: 'start' }} required value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
                </Field>
                <Field label={t('New password (optional)')} hint={t('Leave blank to keep current')}>
                  <Input type='password' value={form.password} onChange={(e) => setField('password', e.target.value)} autoComplete='new-password' />
                </Field>
                <Field label={t('Job title')}>
                  <Input value={form.jobTitle} onChange={(e) => setField('jobTitle', e.target.value)} />
                </Field>
                <Field label={t('Department')}>
                  <Input value={form.department} onChange={(e) => setField('department', e.target.value)} />
                </Field>
                <Field label={t('Employee ID')}>
                  <Input value={form.employeeId} onChange={(e) => setField('employeeId', e.target.value)} />
                </Field>
                <ToggleRow checked={form.isActive} onChange={(value) => setField('isActive', value)} label={t('Account active')} />
                <ToggleRow
                  checked={form.mfaRequiredByAdmin}
                  onChange={(value) => setField('mfaRequiredByAdmin', value)}
                  label={
                    <span className='flex items-center gap-2'>
                      <Shield aria-hidden='true' className='size-4 text-brand' />
                      {t('Require MFA (enforced by admin)')}
                    </span>
                  }
                />
              </div>
            </div>

            <Field label={t('Bio')}>
              <Textarea value={form.bio} onChange={(e) => setField('bio', e.target.value)} rows={3} />
            </Field>

            <Field label={t('Admin / HR notes (not visible to receptionist)')}>
              <Textarea value={form.adminNotes} onChange={(e) => setField('adminNotes', e.target.value)} rows={3} placeholder={t('Internal notes only…')} />
            </Field>

            <section>
              <h2 className='mb-3 text-subtitle font-semibold text-ink'>{t('Address')}</h2>
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                {Object.entries(addressLabels).map(([key, label]) => (
                  <Field key={key} label={t(label)} className={key === 'line1' || key === 'line2' ? 'sm:col-span-2' : ''}>
                    <Input value={form.address[key] || ''} onChange={(e) => setAddressField(key, e.target.value)} />
                  </Field>
                ))}
              </div>
            </section>

            <section>
              <h2 className='mb-3 text-subtitle font-semibold text-ink'>{t('Emergency contact')}</h2>
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
                <Field label={t('Name')}>
                  <Input value={form.emergencyContact.name} onChange={(e) => setEmergencyField('name', e.target.value)} />
                </Field>
                <Field label={t('Phone')}>
                  <Input dir='ltr' style={{ textAlign: 'start' }} value={form.emergencyContact.phone} onChange={(e) => setEmergencyField('phone', e.target.value)} />
                </Field>
                <Field label={t('Relationship')}>
                  <Input value={form.emergencyContact.relationship} onChange={(e) => setEmergencyField('relationship', e.target.value)} />
                </Field>
              </div>
            </section>

            <div className='flex flex-wrap gap-3'>
              <Button type='submit' loading={saving} leadingIcon={<Save aria-hidden='true' className='size-4' />}>
                {t('Save changes')}
              </Button>
              <Button variant='secondary' onClick={() => navigate('/receptionist-list')}>
                {t('Cancel')}
              </Button>
            </div>
          </CardBody>
        </Card>
      </form>
    </AdminPage>
  )
}

export default EditReceptionist
