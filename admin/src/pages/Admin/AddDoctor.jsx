import React, { useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AdminContext } from "../../context/AdminContext";
import axios from 'axios'
import { ArrowLeft, Building2, Check, Eye, EyeOff, MapPin, Plus, RotateCcw, Upload, UserPlus, X } from 'lucide-react'
import { AppContext } from "../../context/AppContext";
import { useLanguage } from "../../i18n";
import BilingualField from "../../components/BilingualField";
import { AdminPage } from "../../components/admin/AdminPage";
import { FormSection, ToggleRow, useFilePreview } from "../../components/admin/SiteContentForm";
import { Button, Card, CardBody, Field, IconButton, Input, notify, Select } from "../../components/ui";
import { bilingualFromRecord, bilingualIsEmpty, bilingualPayload, emptyBilingual } from "../../utils/bilingualValue";

/** Used until the clinic list has loaded, and always offered so an empty database can still add a doctor. */
const DEFAULT_SPECIALITIES = ['General physician', 'Gynecologist', 'Dermatologist', 'Pediatricians', 'Neurologist', 'Gastroenterologist']

const emptyPromo = () => ({ code: '', discountType: 'percentage', discountValue: '', active: false })

const AddDoctor = () => {
  const [docImg, setDocImg] = useState(null)
  const [name, setName] = useState(emptyBilingual)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [experience, setExperience] = useState(1)
  const [fees, setFees] = useState('')
  const [about, setAbout] = useState(emptyBilingual)
  const [speciality, setSpeciality] = useState(DEFAULT_SPECIALITIES[0])
  const [degree, setDegree] = useState(emptyBilingual)
  const [address, setAddress] = useState(emptyBilingual)
  const [gender, setGender] = useState('')
  const [title, setTitle] = useState('')
  const [acceptsCash, setAcceptsCash] = useState(true)
  const [acceptsOnlinePayment, setAcceptsOnlinePayment] = useState(true)
  const [promoCode, setPromoCode] = useState(emptyPromo)
  const [phone, setPhone] = useState('')
  const [selectedClinics, setSelectedClinics] = useState([])
  const [locations, setLocations] = useState([''])
  const [isLoading, setIsLoading] = useState(false)
  const photoPreview = useFilePreview(docImg)

  const { backendUrl, aToken, clinics, getClinics, getAllDoctors, translatePreview } = useContext(AdminContext)
  const { currency } = useContext(AppContext)
  const { t, tc } = useLanguage()
  const navigate = useNavigate()

  useEffect(() => {
    if (aToken) {
      getClinics()
    }
    // Context methods are recreated on render in this app; depend on the token to match existing admin pages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aToken])

  const specialityOptions = useMemo(() => {
    const fromClinics = clinics.filter((clinic) => clinic.active !== false).map((clinic) => clinic.name)
    return [...new Set([...DEFAULT_SPECIALITIES, ...fromClinics])]
  }, [clinics])

  const specialityLabel = (value) => {
    const clinic = clinics.find((item) => item.name === value)
    return tc(clinic?.i18n?.name) || t(value)
  }

  const toggleClinic = (clinicId) => {
    setSelectedClinics((previous) =>
      previous.includes(clinicId)
        ? previous.filter((id) => id !== clinicId)
        : [...previous, clinicId]
    )
  }

  const updateLocation = (index, value) => {
    setLocations((previous) => previous.map((location, itemIndex) => itemIndex === index ? value : location))
  }

  const addLocation = () => setLocations((previous) => [...previous, ''])
  const removeLocation = (index) => setLocations((previous) => previous.filter((_, itemIndex) => itemIndex !== index))

  const onSubmitHandler = async (event) => {
    event.preventDefault()

    if (!docImg) return notify.error(t('Please add a photo of the doctor'))
    if (bilingualIsEmpty(name) || bilingualIsEmpty(about) || bilingualIsEmpty(degree)) return notify.error(t('Missing Details'))

    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append('image', docImg)
      formData.append('nameI18n', JSON.stringify(bilingualPayload(name)))
      formData.append('aboutI18n', JSON.stringify(bilingualPayload(about)))
      formData.append('degreeI18n', JSON.stringify(bilingualPayload(degree)))
      if (!bilingualIsEmpty(address)) formData.append('addressI18n', JSON.stringify(bilingualPayload(address)))
      formData.append('email', email)
      formData.append('password', password)
      formData.append('phone', phone)
      formData.append('experience', experience)
      formData.append('fees', String(fees ?? '').trim())
      formData.append('speciality', speciality)
      formData.append('gender', gender)
      formData.append('title', title)
      formData.append('acceptsCash', acceptsCash)
      formData.append('acceptsOnlinePayment', acceptsOnlinePayment)
      formData.append('promoCode', JSON.stringify(promoCode))
      formData.append('address', JSON.stringify({ line1: '', line2: '', addresses: [] }))
      formData.append('clinicIds', JSON.stringify(selectedClinics))
      formData.append('locations', JSON.stringify(locations.map((location) => location.trim()).filter(Boolean)))

      const { data } = await axios.post(backendUrl + '/api/admin/add-doctor', formData, { headers: { aToken } })

      if (data.success) {
        notify.success(t('Doctor added. The doctor must sign in and publish availability before patients can book.'))
        await getAllDoctors()
        navigate('/doctor-list')
      } else {
        notify.error(t(data.message))
      }
    } catch (error) {
      notify.error(t(error.response?.data?.message || error.message))
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setDocImg(null)
    setName(emptyBilingual())
    setEmail('')
    setPassword('')
    setPhone('')
    setDegree(emptyBilingual())
    setAbout(emptyBilingual())
    setAddress(emptyBilingual())
    setFees('')
    setExperience(1)
    setSpeciality(DEFAULT_SPECIALITIES[0])
    setGender('')
    setTitle('')
    setAcceptsCash(true)
    setAcceptsOnlinePayment(true)
    setPromoCode(emptyPromo())
    setSelectedClinics([])
    setLocations([''])
  }

  /* A preset speciality already has reviewed Arabic on the server, so it needs no typing */
  const specialityPreview = useMemo(() => bilingualFromRecord({ speciality }, 'speciality'), [speciality])

  return (
    <AdminPage
      icon={UserPlus}
      width="max-w-5xl"
      title={t('Add Doctor')}
      description={t('Fill in the information below to add a new doctor to the directory')}
      actions={
        <Button as={Link} to="/doctor-list" variant="secondary" size="sm" leadingIcon={<ArrowLeft aria-hidden="true" className="size-4 rtl:-scale-x-100" />}>
          {t('Back to doctors')}
        </Button>
      }
    >
      <form onSubmit={onSubmitHandler} className="space-y-5">
        <Card variant="flat">
          <CardBody className="flex flex-col items-center gap-5 sm:flex-row">
            <label className="group cursor-pointer">
              <span className="block size-28 overflow-hidden rounded-card rounded-se-signature border-2 border-dashed border-field bg-surface-sunken transition duration-(--duration-fast) ease-standard group-hover:border-primary sm:size-32">
                {photoPreview ? (
                  <img className="size-full object-cover" src={photoPreview} alt="" />
                ) : (
                  <span className="flex size-full flex-col items-center justify-center gap-1.5 text-caption font-medium text-ink-3">
                    <Upload aria-hidden="true" className="size-6 text-brand" />
                    {t('Upload Photo')}
                  </span>
                )}
              </span>
              <input onChange={(e) => setDocImg(e.target.files?.[0] || null)} type="file" aria-label={t('Doctor Photo')} className="sr-only" accept="image/*" />
            </label>
            <div className="text-center sm:text-start">
              <p className="text-subtitle font-semibold text-ink">{t('Upload doctor picture')}</p>
              <p className="mt-1 text-caption text-ink-3">{t('JPG, PNG or JPEG')}</p>
              {docImg && (
                <Button className="mt-2" size="sm" variant="ghost" onClick={() => setDocImg(null)} leadingIcon={<RotateCcw aria-hidden="true" className="size-4" />}>
                  {t('Remove Image')}
                </Button>
              )}
            </div>
          </CardBody>
        </Card>

        <FormSection title={t('Doctor Information')}>
          <BilingualField label={t('Doctor Name')} kind="name" value={name} onChange={setName} translate={translatePreview} required />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('Email Address')} required>
              <Input dir="ltr" style={{ textAlign: 'start' }} onChange={(e) => setEmail(e.target.value)} value={email} type="email" placeholder="doctor@example.com" required />
            </Field>
            <Field label={t('Phone Number')} required>
              <Input dir="ltr" style={{ textAlign: 'start' }} onChange={(e) => setPhone(e.target.value)} value={phone} type="tel" placeholder="01XXXXXXXXX" required />
            </Field>
            <div className="relative">
              <Field label={t('Password')} required>
                <Input className="pe-11" onChange={(e) => setPassword(e.target.value)} value={password} required autoComplete="new-password" type={showPassword ? 'text' : 'password'} />
              </Field>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? t('Hide password') : t('Show password')}
                className="absolute bottom-1 end-1 flex size-9 cursor-pointer items-center justify-center text-ink-3 hover:text-ink"
              >
                {showPassword ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
              </button>
            </div>
            <Field label={t('Years of Experience')} required>
              <Input onChange={(e) => setExperience(e.target.value)} value={experience} type="number" min="0" max="100" required />
            </Field>
            <Field label={t('Doctor Gender')}>
              <Select onChange={(e) => setGender(e.target.value)} value={gender}>
                <option value="">{t('Choose gender')}</option>
                <option value="Female">{t('Female')}</option>
                <option value="Male">{t('Male')}</option>
              </Select>
            </Field>
            <Field label={t('Doctor Title')}>
              <Select onChange={(e) => setTitle(e.target.value)} value={title}>
                <option value="">{t('Choose title')}</option>
                <option value="Professor">{t('Professor')}</option>
                <option value="Lecturer">{t('Lecturer')}</option>
                <option value="Consultant">{t('Consultant')}</option>
                <option value="Specialist">{t('Specialist')}</option>
              </Select>
            </Field>
            <Field label={t('Speciality')} required hint={specialityPreview.en ? t('Saved in both languages automatically.') : undefined}>
              <Select onChange={(e) => setSpeciality(e.target.value)} value={speciality}>
                {specialityOptions.map((option) => (
                  <option key={option} value={option}>{specialityLabel(option)}</option>
                ))}
              </Select>
            </Field>
            <Field label={`${t('Examination fee (optional)')} (${currency.trim()})`} hint={t('Leave blank to use global visit fees. Set a value here to override global fees for this doctor only.')}>
              <Input onChange={(e) => setFees(e.target.value)} value={fees} type="number" min="0" />
            </Field>
          </div>
          <BilingualField label={t('Education / Degree')} kind="label" value={degree} onChange={setDegree} translate={translatePreview} required placeholders={{ en: t('e.g., MBBS, MD') }} />
          <BilingualField label={t('About Doctor')} value={about} onChange={setAbout} translate={translatePreview} multiline required hint={t('Minimum 50 characters recommended')} />
          <BilingualField label={t('Clinic address')} kind="place" value={address} onChange={setAddress} translate={translatePreview} />
        </FormSection>

        <FormSection title={t('Payment and Promo Offer')}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ToggleRow checked={acceptsCash} onChange={setAcceptsCash} label={t('Accept cash payment')} />
            <ToggleRow checked={acceptsOnlinePayment} onChange={setAcceptsOnlinePayment} label={t('Accept online payment')} />
            <ToggleRow className="sm:col-span-2" checked={promoCode.active} onChange={(active) => setPromoCode((previous) => ({ ...previous, active }))} label={t('Show percentage offer to patients')} />
            <Field label={t('Promo code')} hint={t('Optional code, auto-created if empty')}>
              <Input dir="ltr" style={{ textAlign: 'start' }} value={promoCode.code} onChange={(event) => setPromoCode((previous) => ({ ...previous, code: event.target.value.toUpperCase() }))} />
            </Field>
            <Field label={t('Discount type')}>
              <Select value={promoCode.discountType} onChange={(event) => setPromoCode((previous) => ({ ...previous, discountType: event.target.value }))}>
                <option value="percentage">{t('Percentage discount')}</option>
                <option value="fixed">{t('Fixed amount discount')}</option>
              </Select>
            </Field>
            <Field label={promoCode.discountType === 'percentage' ? t('Percentage, e.g. 10') : t('Fixed discount value')}>
              <Input value={promoCode.discountValue} onChange={(event) => setPromoCode((previous) => ({ ...previous, discountValue: event.target.value }))} type="number" min="0" max={promoCode.discountType === 'percentage' ? '100' : undefined} />
            </Field>
          </div>
        </FormSection>

        <FormSection title={t('Clinic Locations')} icon={MapPin}>
          <div className="space-y-2">
            {locations.map((location, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input aria-label={t('Clinic Locations')} value={location} onChange={(event) => updateLocation(index, event.target.value)} placeholder={t('e.g., Mohandseen, Nasr City')} />
                {locations.length > 1 && (
                  <IconButton label={t('Remove')} variant="ghost" onClick={() => removeLocation(index)}>
                    <X aria-hidden="true" className="size-4 text-danger-ink" />
                  </IconButton>
                )}
              </div>
            ))}
          </div>
          <Button size="sm" variant="secondary" onClick={addLocation} leadingIcon={<Plus aria-hidden="true" className="size-4" />}>
            {t('Add another location')}
          </Button>
          <p className="text-caption text-ink-3">{t('Patients will see these locations on doctor cards and choose one before booking.')}</p>
        </FormSection>

        <FormSection title={t('Assign Clinics')} icon={Building2}>
          {clinics.length === 0 ? (
            <p className="text-body-sm text-ink-3">{t('Add clinics first from Clinic Management')}</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {clinics.map((clinic) => {
                const checked = selectedClinics.includes(clinic._id)
                return (
                  <button
                    type="button"
                    key={clinic._id}
                    aria-pressed={checked}
                    onClick={() => toggleClinic(clinic._id)}
                    className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-control border px-3 text-start transition duration-(--duration-fast) ease-standard ${
                      checked ? 'border-primary bg-primary-soft text-ink' : 'border-line bg-surface text-ink-2 hover:border-line-strong'
                    }`}
                  >
                    <span className={`flex size-5 shrink-0 items-center justify-center rounded border ${checked ? 'border-primary bg-primary text-on-primary' : 'border-field'}`}>
                      {checked && <Check aria-hidden="true" className="size-3.5" />}
                    </span>
                    <span className="truncate text-body-sm font-medium">{tc(clinic.i18n?.name) || t(clinic.name)}</span>
                  </button>
                )
              })}
            </div>
          )}
          <p className="text-caption text-ink-3">{t('Selected clinics appear on the patient website and can be changed later from Clinic Management.')}</p>
        </FormSection>

        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <Button type="submit" size="lg" loading={isLoading} leadingIcon={<Plus aria-hidden="true" className="size-5" />}>
            {t('Add Doctor')}
          </Button>
          <Button variant="secondary" size="lg" disabled={isLoading} onClick={handleReset} leadingIcon={<RotateCcw aria-hidden="true" className="size-5" />}>
            {t('Reset Form')}
          </Button>
        </div>
      </form>
    </AdminPage>
  );
};

export default AddDoctor;
