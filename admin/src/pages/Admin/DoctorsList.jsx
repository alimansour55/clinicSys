import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AdminContext } from '../../context/AdminContext'
import { ArrowLeft, Building2, Camera, Edit2, FileText, Info, MapPin, Percent, Plus, Save, Stethoscope, User, Wallet, X } from 'lucide-react'
import axios from 'axios'
import { RatingBadge, RatingsList, StarRow } from '../../components/DoctorRating'
import { AppContext } from '../../context/AppContext'
import { parseExperienceYears } from '../../utils/doctorExperience'
import { hasDoctorCustomVisitFees, normalizeGlobalVisitFees } from '../../utils/globalVisitFees'
import DoctorsDirectoryTable from '../../components/admin/DoctorsDirectoryTable'
import BilingualField from '../../components/BilingualField'
import { AdminPage } from '../../components/admin/AdminPage'
import { FormSection, ToggleRow, useFilePreview } from '../../components/admin/SiteContentForm'
import { Badge, Button, Field, IconButton, Input, notify, Select } from '../../components/ui'
import { useLanguage } from '../../i18n'
import { bilingualFromRecord, bilingualGroupFromRecord, bilingualPayload } from '../../utils/bilingualValue'
import { downloadCsv } from '../../utils/csvExport'

const SPECIALITIES = ['General physician', 'Gynecologist', 'Dermatologist', 'Pediatricians', 'Neurologist', 'Gastroenterologist']
const BILINGUAL = ['name', 'about', 'degree']

/** An existing doctor's address, which may predate the two-language copy. */
const addressValue = (doctor) => {
  if (doctor.i18n?.address?.en || doctor.i18n?.address?.ar) return bilingualFromRecord(doctor, 'address')
  return bilingualFromRecord({ address: doctor.address?.line1 || '' }, 'address')
}

const Detail = ({ label, children }) => (
  <div className='rounded-control border border-line bg-surface-sunken p-3'>
    <p className='mb-0.5 text-caption font-medium text-ink-3'>{label}</p>
    <div className='text-body-sm font-medium text-ink'>{children}</div>
  </div>
)

const DoctorsList = () => {
  const { doctors, aToken, getAllDoctors, changeAvailability, backendUrl, getDoctorRatings, deleteDoctorRating, siteSettings, getSiteSettings, translatePreview, clinics, getClinics, bulkDoctorAvailability } = useContext(AdminContext)
  const { currency } = useContext(AppContext)
  const { t, tc, localizeDigits } = useLanguage()
  const location = useLocation()
  const navigate = useNavigate()
  const lastHandledUsersLinkKey = useRef(null)
  const [selectedDoctorId, setSelectedDoctorId] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [text, setText] = useState({})
  const [address, setAddress] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [ratingsData, setRatingsData] = useState({ summary: { averageRating: 0, ratingCount: 0 }, ratings: [] })
  const [ratingsLoading, setRatingsLoading] = useState(false)
  const [selected, setSelected] = useState([])

  const [doctorsLoading, setDoctorsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [availabilityFilter, setAvailabilityFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      if (aToken) {
        setDoctorsLoading(true)
        await Promise.all([getAllDoctors(), getSiteSettings(), getClinics()])
        setDoctorsLoading(false)
      }
    }
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aToken])

  const globalVisitFees = useMemo(() => normalizeGlobalVisitFees(siteSettings?.globalVisitFees), [siteSettings])

  const specialityOptions = useMemo(
    () => [...new Set([...SPECIALITIES, ...clinics.filter((clinic) => clinic.active !== false).map((clinic) => clinic.name)])],
    [clinics]
  )

  useEffect(() => {
    const targetId = location.state?.openDoctorId
    if (!targetId || doctorsLoading) return
    if (lastHandledUsersLinkKey.current === location.key) return
    lastHandledUsersLinkKey.current = location.key
    const found = doctors.some((d) => String(d._id) === String(targetId))
    navigate(location.pathname, { replace: true, state: {} })
    if (found) setSelectedDoctorId(targetId)
  }, [doctors, doctorsLoading, location.pathname, location.state, location.key, navigate])

  const selectedDoctor = doctors.find((d) => d._id === selectedDoctorId)
  const imagePreview = useFilePreview(imageFile, selectedDoctor?.image)

  const doctorStats = useMemo(() => {
    const total = doctors.length
    const available = doctors.filter((d) => d.available !== false).length
    return { total, available, unavailable: total - available }
  }, [doctors])

  const filteredDoctors = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return doctors.filter((doctor) => {
      const matchesAvailability =
        availabilityFilter === 'all'
        || (availabilityFilter === 'available' && doctor.available !== false)
        || (availabilityFilter === 'unavailable' && doctor.available === false)
      const haystack = [
        doctor.name,
        doctor.i18n?.name?.ar,
        doctor.email,
        doctor.speciality,
        doctor.i18n?.speciality?.ar,
        doctor.phone,
        ...(doctor.locations || [])
      ]
      return matchesAvailability && (!query || haystack.some((value) => String(value || '').toLowerCase().includes(query)))
    })
  }, [doctors, searchQuery, availabilityFilter])

  const sortedDoctors = useMemo(() => {
    const list = [...filteredDoctors]
    const dir = sortDir === 'asc' ? 1 : -1
    const nameOf = (doctor) => tc(doctor.i18n?.name) || doctor.name || ''
    list.sort((a, b) => {
      if (sortBy === 'fees') {
        const va = Number(a.fees || 0)
        const vb = Number(b.fees || 0)
        return va === vb ? nameOf(a).localeCompare(nameOf(b)) : (va - vb) * dir
      }
      if (sortBy === 'speciality') {
        return (a.speciality || '').localeCompare(b.speciality || '', undefined, { sensitivity: 'base' }) * dir
      }
      return nameOf(a).localeCompare(nameOf(b), undefined, { sensitivity: 'base' }) * dir
    })
    return list
  }, [filteredDoctors, sortBy, sortDir, tc])

  const handleRefreshDoctors = async () => {
    if (!aToken) return
    setRefreshing(true)
    await getAllDoctors()
    setRefreshing(false)
  }

  useEffect(() => {
    const loadRatings = async () => {
      if (!selectedDoctorId) return
      setRatingsLoading(true)
      const data = await getDoctorRatings(selectedDoctorId)
      setRatingsData(data)
      setRatingsLoading(false)
    }
    loadRatings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoctorId])

  const startEditing = () => {
    setText(bilingualGroupFromRecord(selectedDoctor, BILINGUAL))
    setAddress(addressValue(selectedDoctor))
    setEditForm({
      email: selectedDoctor.email,
      phone: selectedDoctor.phone,
      password: '',
      speciality: selectedDoctor.speciality,
      gender: selectedDoctor.gender || '',
      title: selectedDoctor.title || '',
      experience: parseExperienceYears(selectedDoctor.experience) ?? '',
      fees: hasDoctorCustomVisitFees(selectedDoctor) ? selectedDoctor.fees : '',
      acceptsCash: selectedDoctor.acceptsCash !== false,
      acceptsOnlinePayment: selectedDoctor.acceptsOnlinePayment !== false,
      promoCode: {
        code: selectedDoctor.promoCode?.code || '',
        discountType: selectedDoctor.promoCode?.discountType || 'percentage',
        discountValue: selectedDoctor.promoCode?.discountValue || '',
        active: Boolean(selectedDoctor.promoCode?.active)
      },
      line2: selectedDoctor.address?.line2 || '',
      locations: selectedDoctor.locations?.length ? [...selectedDoctor.locations] : [''],
      financialCompensation: {
        mode: ['fixed', 'hybrid'].includes(selectedDoctor.financialCompensation?.mode) ? selectedDoctor.financialCompensation.mode : 'percentage',
        percentageEnabled: Boolean(selectedDoctor.financialCompensation?.percentageEnabled),
        percentage: Math.min(100, Math.max(0, Number(selectedDoctor.financialCompensation?.percentage ?? 50))),
        fixedSalary: Math.max(0, Number(selectedDoctor.financialCompensation?.fixedSalary ?? 0))
      }
    })
    setImageFile(null)
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setEditForm({})
    setImageFile(null)
  }

  const handleChange = (field, value) => setEditForm((prev) => ({ ...prev, [field]: value }))
  const patchPromo = (patch) => setEditForm((prev) => ({ ...prev, promoCode: { ...(prev.promoCode || {}), ...patch } }))
  const patchFinancialCompensation = (patch) =>
    setEditForm((prev) => ({ ...prev, financialCompensation: { ...(prev.financialCompensation || {}), ...patch } }))
  const setTextField = (field) => (value) => setText((previous) => ({ ...previous, [field]: value }))

  const handleLocationChange = (index, value) =>
    setEditForm((prev) => ({ ...prev, locations: (prev.locations || ['']).map((item, itemIndex) => (itemIndex === index ? value : item)) }))
  const addLocation = () => setEditForm((prev) => ({ ...prev, locations: [...(prev.locations || []), ''] }))
  const removeLocation = (index) =>
    setEditForm((prev) => ({ ...prev, locations: (prev.locations || []).filter((_, itemIndex) => itemIndex !== index) }))

  const saveChanges = async () => {
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('docId', selectedDoctorId)
      BILINGUAL.forEach((field) => formData.append(`${field}I18n`, JSON.stringify(bilingualPayload(text[field]))))
      formData.append('addressI18n', JSON.stringify(bilingualPayload(address)))
      formData.append('address', JSON.stringify({ line1: selectedDoctor.address?.line1 || '', line2: String(editForm.line2 || '').trim() }))
      formData.append('email', editForm.email)
      formData.append('phone', editForm.phone)
      formData.append('speciality', editForm.speciality)
      formData.append('gender', editForm.gender || '')
      formData.append('title', editForm.title || '')
      formData.append('experience', editForm.experience)
      formData.append('fees', editForm.fees)
      formData.append('acceptsCash', editForm.acceptsCash)
      formData.append('acceptsOnlinePayment', editForm.acceptsOnlinePayment)
      formData.append('promoCode', JSON.stringify(editForm.promoCode || {}))
      formData.append('locations', JSON.stringify((editForm.locations || []).map((item) => item.trim()).filter(Boolean)))
      formData.append('financialCompensation', JSON.stringify(editForm.financialCompensation || {}))
      if (editForm.password?.trim()) formData.append('password', editForm.password)
      if (imageFile) formData.append('image', imageFile)

      const { data } = await axios.post(backendUrl + '/api/admin/update-doctor', formData, { headers: { aToken } })

      if (data.success) {
        notify.success(t(data.message))
        setIsEditing(false)
        setImageFile(null)
        await getAllDoctors()
      } else {
        notify.error(t(data.message))
      }
    } catch (error) {
      notify.error(t(error.response?.data?.message || error.message))
    } finally {
      setLoading(false)
    }
  }

  const toggleAvailability = async (doctorId, nextAvailable, e) => {
    e?.stopPropagation?.()
    await changeAvailability(doctorId, nextAvailable)
  }

  const handleBulkAvailability = async (ids, available) => {
    const result = await bulkDoctorAvailability(ids, available)
    if (!result) return
    notify.success(`${t('Availability updated')}: ${localizeDigits(result.updated)}`)
    setSelected([])
    await getAllDoctors()
  }

  const exportDoctors = () =>
    downloadCsv(
      'doctors',
      [
        { label: t('Name'), value: (row) => tc(row.i18n?.name) || row.name },
        { label: t('Speciality'), value: (row) => tc(row.i18n?.speciality) || t(row.speciality) },
        { label: t('Email'), value: (row) => row.email },
        { label: t('Phone'), value: (row) => row.phone },
        { label: t('Examination fee'), value: (row) => (String(row.fees ?? '').trim() !== '' ? Number(row.fees) : t('Global')) },
        { label: t('Clinic Locations'), value: (row) => (row.locations || []).join(' / ') },
        { label: t('Average rating'), value: (row) => Number(row.ratingSummary?.averageRating || 0) },
        { label: t('Status'), value: (row) => (row.available !== false ? t('Available') : t('Unavailable')) }
      ],
      sortedDoctors
    )

  const handleDeleteRating = async (ratingId) => {
    const deleted = await deleteDoctorRating(ratingId)
    if (deleted && selectedDoctorId) {
      setRatingsData(await getDoctorRatings(selectedDoctorId))
    }
  }

  const backToList = () => {
    setSelectedDoctorId(null)
    setIsEditing(false)
    setImageFile(null)
  }

  // Detail View
  if (selectedDoctorId && selectedDoctor) {
    const compensation = selectedDoctor.financialCompensation || {}
    const editCompensation = editForm.financialCompensation || {}
    const summary = ratingsData.summary?.ratingCount ? ratingsData.summary : selectedDoctor.ratingSummary
    const promo = selectedDoctor.promoCode

    return (
      <AdminPage
        icon={Stethoscope}
        width='max-w-6xl'
        title={tc(selectedDoctor.i18n?.name) || selectedDoctor.name}
        description={tc(selectedDoctor.i18n?.speciality) || t(selectedDoctor.speciality)}
        actions={
          <>
            <Button variant='secondary' size='sm' onClick={backToList} leadingIcon={<ArrowLeft aria-hidden='true' className='size-4 rtl:-scale-x-100' />}>
              {t('Back')}
            </Button>
            {!isEditing ? (
              <Button size='sm' onClick={startEditing} leadingIcon={<Edit2 aria-hidden='true' className='size-4' />}>
                {t('Edit Profile')}
              </Button>
            ) : (
              <>
                <Button variant='secondary' size='sm' onClick={cancelEditing} leadingIcon={<X aria-hidden='true' className='size-4' />}>
                  {t('Cancel')}
                </Button>
                <Button size='sm' loading={loading} onClick={saveChanges} leadingIcon={<Save aria-hidden='true' className='size-4' />}>
                  {t('Save')}
                </Button>
              </>
            )}
          </>
        }
      >
        <div className='space-y-5'>
          <FormSection title={t('Doctor Information')} icon={User}>
            <div className='flex flex-col items-center gap-4 sm:flex-row sm:items-start'>
              <div className='relative shrink-0'>
                <img className='size-28 rounded-full border-4 border-surface bg-surface-sunken object-cover shadow-e2' src={imagePreview} alt='' />
                {!isEditing && <RatingBadge summary={selectedDoctor.ratingSummary || ratingsData.summary} className='absolute start-1 top-1' />}
                {isEditing && (
                  <label className='absolute bottom-0 end-0 cursor-pointer rounded-full bg-primary p-2 text-on-primary shadow-e2'>
                    <Camera aria-hidden='true' className='size-4' />
                    <input type='file' accept='image/*' aria-label={t('Upload photo')} onChange={(e) => setImageFile(e.target.files?.[0] || null)} className='sr-only' />
                  </label>
                )}
              </div>
              <div className='w-full min-w-0 flex-1'>
                {isEditing ? (
                  <BilingualField label={t('Doctor Name')} kind='name' value={text.name} onChange={setTextField('name')} translate={translatePreview} required />
                ) : (
                  <div className='flex flex-wrap justify-center gap-2 sm:justify-start'>
                    <Badge tone='brand'>{tc(selectedDoctor.i18n?.speciality) || t(selectedDoctor.speciality)}</Badge>
                    {selectedDoctor.title && <Badge>{t(selectedDoctor.title)}</Badge>}
                    {selectedDoctor.gender && <Badge>{t(selectedDoctor.gender)}</Badge>}
                    {(selectedDoctor.clinics || []).map((clinic) => (
                      <Badge key={clinic._id || clinic} tone='info'>
                        <Building2 aria-hidden='true' className='size-3' />
                        {tc(clinic.i18n?.name) || t(clinic.name || clinic)}
                      </Badge>
                    ))}
                    <Badge tone={selectedDoctor.available !== false ? 'success' : 'danger'} dot>
                      {selectedDoctor.available !== false ? t('Available') : t('Not Available')}
                    </Badge>
                    <Badge tone='warning'>
                      <StarRow value={summary?.averageRating} />
                      {summary?.ratingCount
                        ? `${localizeDigits(Number(summary.averageRating || 0).toFixed(1))} (${localizeDigits(summary.ratingCount)})`
                        : t('No ratings')}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </FormSection>

          <FormSection title={t('Patient Ratings')}>
            {ratingsLoading ? <p className='text-body-sm text-ink-3'>{t('Loading ratings...')}</p> : <RatingsList ratings={ratingsData.ratings} canDelete onDelete={handleDeleteRating} />}
          </FormSection>

          <div className='grid grid-cols-1 gap-5 lg:grid-cols-2'>
            <FormSection title={t('Personal Information')} icon={Info}>
              {isEditing ? (
                <>
                  <Field label={t('Email')}>
                    <Input dir='ltr' style={{ textAlign: 'start' }} type='email' value={editForm.email} onChange={(e) => handleChange('email', e.target.value)} />
                  </Field>
                  <Field label={t('New Password (Optional)')} hint={t('Leave empty to keep current password')}>
                    <Input type='password' autoComplete='new-password' value={editForm.password} onChange={(e) => handleChange('password', e.target.value)} />
                  </Field>
                  <Field label={t('Phone')}>
                    <Input dir='ltr' style={{ textAlign: 'start' }} type='tel' value={editForm.phone} onChange={(e) => handleChange('phone', e.target.value)} />
                  </Field>
                  <BilingualField label={t('Clinic address')} kind='place' value={address} onChange={setAddress} translate={translatePreview} />
                  <div>
                    <p className='mb-1.5 flex items-center gap-1.5 text-body-sm font-medium text-ink'>
                      <MapPin aria-hidden='true' className='size-4 text-brand' />
                      {t('Clinic Locations')}
                    </p>
                    <div className='space-y-2'>
                      {(editForm.locations || ['']).map((item, index) => (
                        <div key={index} className='flex items-center gap-2'>
                          <Input aria-label={t('Clinic Locations')} value={item} onChange={(e) => handleLocationChange(index, e.target.value)} placeholder={t('e.g., Mohandseen, Nasr City')} />
                          {(editForm.locations || []).length > 1 && (
                            <IconButton label={t('Remove')} variant='ghost' onClick={() => removeLocation(index)}>
                              <X aria-hidden='true' className='size-4 text-danger-ink' />
                            </IconButton>
                          )}
                        </div>
                      ))}
                    </div>
                    <Button className='mt-2' size='sm' variant='secondary' onClick={addLocation} leadingIcon={<Plus aria-hidden='true' className='size-4' />}>
                      {t('Add location')}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Detail label={t('Email')}><span dir='ltr' className='break-all'>{selectedDoctor.email}</span></Detail>
                  <Detail label={t('Phone')}><span dir='ltr'>{selectedDoctor.phone}</span></Detail>
                  <Detail label={t('Clinic address')}>{tc(selectedDoctor.i18n?.address) || selectedDoctor.address?.line1 || t('Not provided')}</Detail>
                  <Detail label={t('Clinic Locations')}>{selectedDoctor.locations?.length ? selectedDoctor.locations.map((item) => t(item)).join('، ') : t('Not provided')}</Detail>
                </>
              )}
            </FormSection>

            <FormSection title={t('Professional Details')} icon={Stethoscope}>
              {isEditing ? (
                <>
                  <Field label={t('Speciality')}>
                    <Select value={editForm.speciality} onChange={(e) => handleChange('speciality', e.target.value)}>
                      {[...new Set([editForm.speciality, ...specialityOptions])].filter(Boolean).map((option) => (
                        <option key={option} value={option}>{t(option)}</option>
                      ))}
                    </Select>
                  </Field>
                  <BilingualField label={t('Degree')} kind='label' value={text.degree} onChange={setTextField('degree')} translate={translatePreview} />
                  <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                    <Field label={t('Gender')}>
                      <Select value={editForm.gender || ''} onChange={(e) => handleChange('gender', e.target.value)}>
                        <option value=''>{t('Choose gender')}</option>
                        <option value='Female'>{t('Female')}</option>
                        <option value='Male'>{t('Male')}</option>
                      </Select>
                    </Field>
                    <Field label={t('Title')}>
                      <Select value={editForm.title || ''} onChange={(e) => handleChange('title', e.target.value)}>
                        <option value=''>{t('Choose title')}</option>
                        <option value='Professor'>{t('Professor')}</option>
                        <option value='Lecturer'>{t('Lecturer')}</option>
                        <option value='Consultant'>{t('Consultant')}</option>
                        <option value='Specialist'>{t('Specialist')}</option>
                      </Select>
                    </Field>
                  </div>
                  <Field label={t('Years of experience')}>
                    <Input type='number' min={0} max={100} value={editForm.experience} onChange={(e) => handleChange('experience', e.target.value)} />
                  </Field>
                  <Field label={`${t('Examination fee (optional)')} (${currency.trim()})`} hint={t('Leave empty to use global fees. A value here overrides global fees for this doctor.')}>
                    <Input type='number' min={0} value={editForm.fees} onChange={(e) => handleChange('fees', e.target.value)} />
                  </Field>
                </>
              ) : (
                <>
                  <Detail label={t('Degree')}>{tc(selectedDoctor.i18n?.degree) || selectedDoctor.degree}</Detail>
                  <Detail label={t('Years of experience')}>{localizeDigits(parseExperienceYears(selectedDoctor.experience) ?? '—')}</Detail>
                  <Detail label={t('Examination fee')}>
                    {hasDoctorCustomVisitFees(selectedDoctor)
                      ? `${currency}${localizeDigits(selectedDoctor.fees)}`
                      : globalVisitFees.enabled
                        ? `${t('Global fees')}: ${currency}${localizeDigits(globalVisitFees.examinationFee)}`
                        : t('No custom or global fees set')}
                  </Detail>
                </>
              )}
            </FormSection>

            <FormSection title={t('Payments & offers')} icon={Wallet}>
              {isEditing ? (
                <>
                  <ToggleRow checked={editForm.acceptsCash !== false} onChange={(value) => handleChange('acceptsCash', value)} label={t('Accept cash')} />
                  <ToggleRow checked={editForm.acceptsOnlinePayment !== false} onChange={(value) => handleChange('acceptsOnlinePayment', value)} label={t('Accept online payment')} />
                  <ToggleRow checked={Boolean(editForm.promoCode?.active)} onChange={(value) => patchPromo({ active: value })} label={t('Show offer to patients')} />
                  <Field label={t('Promo code')} hint={t('Optional code, auto-created if empty')}>
                    <Input dir='ltr' style={{ textAlign: 'start' }} value={editForm.promoCode?.code || ''} onChange={(e) => patchPromo({ code: e.target.value.toUpperCase() })} />
                  </Field>
                  <div className='grid grid-cols-2 gap-3'>
                    <Field label={t('Discount type')}>
                      <Select value={editForm.promoCode?.discountType || 'percentage'} onChange={(e) => patchPromo({ discountType: e.target.value })}>
                        <option value='percentage'>{t('Percentage')}</option>
                        <option value='fixed'>{t('Fixed amount')}</option>
                      </Select>
                    </Field>
                    <Field label={t('Discount value')}>
                      <Input type='number' min='0' max={editForm.promoCode?.discountType === 'percentage' ? '100' : undefined} value={editForm.promoCode?.discountValue || ''} onChange={(e) => patchPromo({ discountValue: e.target.value })} />
                    </Field>
                  </div>
                </>
              ) : (
                <>
                  <Detail label={t('Accept cash')}>{selectedDoctor.acceptsCash !== false ? t('Accepted') : t('Not accepted')}</Detail>
                  <Detail label={t('Accept online payment')}>{selectedDoctor.acceptsOnlinePayment !== false ? t('Accepted') : t('Not accepted')}</Detail>
                  <Detail label={t('Promo code')}>
                    {promo?.active ? (
                      <span dir='ltr'>{`${promo.code} (${promo.discountValue}${promo.discountType === 'percentage' ? '%' : ''})`}</span>
                    ) : (
                      t('No active promo')
                    )}
                  </Detail>
                </>
              )}
            </FormSection>

            <FormSection title={t('Financial compensation')} icon={Percent}>
              {isEditing ? (
                <>
                  <p className='text-caption text-ink-3'>{t('Choose how this doctor is compensated for analytics: percentage, fixed monthly, or both (hybrid).')}</p>
                  <div role='radiogroup' aria-label={t('Financial compensation')} className='flex flex-wrap gap-2'>
                    {[
                      ['percentage', 'Percentage only'],
                      ['fixed', 'Fixed monthly'],
                      ['hybrid', '% + fixed (hybrid)']
                    ].map(([mode, label]) => (
                      <label key={mode} className='flex min-h-10 cursor-pointer items-center gap-2 rounded-control border border-line px-3 text-body-sm font-medium text-ink has-checked:border-primary has-checked:bg-primary-soft'>
                        <input type='radio' name='compMode' checked={editCompensation.mode === mode} onChange={() => patchFinancialCompensation({ mode })} className='accent-(--color-primary)' />
                        {t(label)}
                      </label>
                    ))}
                  </div>
                  {editCompensation.mode !== 'fixed' && (
                    <Field label={t('% of paid revenue')}>
                      <Input type='number' min={0} max={100} value={editCompensation.percentage ?? 0} onChange={(e) => patchFinancialCompensation({ percentage: Number(e.target.value) })} />
                    </Field>
                  )}
                  {editCompensation.mode !== 'percentage' && (
                    <Field label={`${t('Monthly fixed amount')} (${currency.trim()})`}>
                      <Input type='number' min={0} value={editCompensation.fixedSalary ?? 0} onChange={(e) => patchFinancialCompensation({ fixedSalary: Number(e.target.value) })} />
                    </Field>
                  )}
                </>
              ) : (
                <>
                  {compensation.mode !== 'fixed' && (
                    <Detail label={t('% of paid revenue')}>{Number(compensation.percentage || 0) > 0 ? `${localizeDigits(compensation.percentage)}%` : t('Not set (0%)')}</Detail>
                  )}
                  {compensation.mode !== 'percentage' && compensation.mode && (
                    <Detail label={t('Monthly fixed amount')}>{`${currency}${localizeDigits(Number(compensation.fixedSalary || 0).toLocaleString())}`}</Detail>
                  )}
                </>
              )}
            </FormSection>
          </div>

          <FormSection title={t('About Doctor')} icon={FileText}>
            {isEditing ? (
              <BilingualField label={t('About Doctor')} value={text.about} onChange={setTextField('about')} translate={translatePreview} multiline />
            ) : (
              <p className='whitespace-pre-line text-body-sm text-ink-2'>{tc(selectedDoctor.i18n?.about) || selectedDoctor.about}</p>
            )}
          </FormSection>

          {isEditing && (
            <div className='flex justify-end gap-2'>
              <Button variant='secondary' onClick={cancelEditing}>{t('Cancel')}</Button>
              <Button loading={loading} onClick={saveChanges}>{t('Save')}</Button>
            </div>
          )}
        </div>
      </AdminPage>
    )
  }

  // List View
  return (
    <DoctorsDirectoryTable
      doctors={doctors}
      sortedDoctors={sortedDoctors}
      doctorsLoading={doctorsLoading}
      doctorStats={doctorStats}
      currency={currency}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      availabilityFilter={availabilityFilter}
      setAvailabilityFilter={setAvailabilityFilter}
      sortBy={sortBy}
      sortDir={sortDir}
      setSortBy={setSortBy}
      setSortDir={setSortDir}
      refreshing={refreshing}
      onRefresh={handleRefreshDoctors}
      onOpenDoctor={setSelectedDoctorId}
      onToggleAvailability={toggleAvailability}
      selected={selected}
      onSelect={setSelected}
      onBulkAvailability={handleBulkAvailability}
      onExport={exportDoctors}
    />
  )
}

export default DoctorsList
