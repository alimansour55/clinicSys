import { useContext, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { FileUp } from 'lucide-react'
import { AppContext } from '../../context/AppContext'
import { translateInsuranceProviderName } from '../../data/insuranceProviderNamesAr'
import { providerLabel } from '../../utils/bilingualContent'
import { useLanguage } from '../../i18n'
import { Field, Input, Select } from '../ui'


/** The insurance form, shared by sign-up and the insurance page. */
const InsuranceFields = ({ values, onChange, file, onFileChange, existingCardUrl = '', today }) => {
  const { t, tc, language } = useLanguage()
  const { backendUrl, siteSettings } = useContext(AppContext)
  const inputRef = useRef(null)
  const [providers, setProviders] = useState([])
  const [providerLabels, setProviderLabels] = useState([])

  useEffect(() => {
    let cancelled = false
    axios.get(`${backendUrl}/api/user/insurance-providers`)
      .then(({ data }) => {
        if (cancelled || !data?.success || !Array.isArray(data.providers)) return
        setProviders(data.providers)
        if (Array.isArray(data.providersI18n)) setProviderLabels(data.providersI18n)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [backendUrl])

  const set = (key) => (event) => onChange({ ...values, [key]: event.target.value })
  /* The value stays the plain name the server matches on; only the label changes language. */
  const labels = providerLabels.length ? providerLabels : siteSettings?.insuranceProvidersI18n
  const providerText = (name) => providerLabel({ tc, language }, labels, name, (plain) => translateInsuranceProviderName(plain, t, language))

  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
      <Field label={t('Insurance provider')} required className='sm:col-span-2'>
        <Select value={values.provider} onChange={set('provider')}>
          <option value=''>{t('Select provider')}</option>
          {providers.map((name) => (
            <option key={name} value={name}>{providerText(name)}</option>
          ))}
        </Select>
      </Field>
      <Field label={t('Name on the card')} required className='sm:col-span-2'>
        <Input value={values.fullName} onChange={set('fullName')} dir='auto' autoComplete='name' />
      </Field>
      <Field label={t('Birth date')} required>
        <Input type='date' max={today} value={values.birthDate} onChange={set('birthDate')} className='date-field-input' />
      </Field>
      <Field label={t('ID number')} required>
        <Input value={values.idNumber} onChange={set('idNumber')} dir='ltr' />
      </Field>
      <Field label={t('Expiry date')} required>
        <Input type='date' value={values.expiryDate} onChange={set('expiryDate')} className='date-field-input' />
      </Field>
      <div className='flex flex-col gap-1.5'>
        <span className='text-body-sm font-medium text-ink'>{t('Photo of the medical card')}</span>
        <button
          type='button'
          onClick={() => inputRef.current?.click()}
          className='flex min-h-11 w-full items-center gap-2 rounded-control border border-dashed border-field bg-surface px-3 text-start text-body-sm text-ink-2 transition hover:border-primary'
        >
          <FileUp className='size-4 shrink-0' aria-hidden='true' />
          <span className='truncate'>{file ? file.name : existingCardUrl ? t('Replace the attached card') : t('Attach a file')}</span>
        </button>
        <input
          ref={inputRef}
          type='file'
          accept='image/jpeg,image/png,image/webp,application/pdf'
          className='sr-only'
          tabIndex={-1}
          aria-label={t('Photo of the medical card')}
          onChange={(event) => onFileChange(event.target.files?.[0] || null)}
        />
        <p className='text-caption text-ink-3'>{t('JPG, PNG, WebP or PDF, up to 5 MB')}</p>
        {existingCardUrl && (
          <a className='text-body-sm text-brand underline' href={existingCardUrl} target='_blank' rel='noreferrer'>{t('View current card')}</a>
        )}
      </div>
    </div>
  )
}

export default InsuranceFields
