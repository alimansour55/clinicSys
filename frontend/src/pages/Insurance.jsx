import React, { useContext, useEffect, useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { CreditCard, FileUp, Check } from 'lucide-react'
import { AppContext } from '../context/AppContext'
import { getInsuranceStatus, insuranceStatusLabel, insuranceStatusTone, isInsuranceExpired } from '../utils/insuranceVerification'

const emptyInsurance = {
  enabled: false,
  provider: '',
  fullName: '',
  birthDate: '',
  idNumber: '',
  expiryDate: '',
  medicalCardPhoto: ''
}

const today = new Date().toISOString().split('T')[0]

const Insurance = () => {
  const { token, userData, saveInsurance, backendUrl, loadUserProfileData } = useContext(AppContext)
  const navigate = useNavigate()
  const [insurance, setInsurance] = useState(emptyInsurance)
  const [cardFile, setCardFile] = useState(null)
  const cardFileInputRef = useRef(null)
  const [saving, setSaving] = useState(false)
  const [providers, setProviders] = useState([])

  /** Receptionist/admin may update insurance on the server; reload profile when this page is opened. */
  useEffect(() => {
    if (!token) return
    loadUserProfileData()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load fresh insurance from API on visit
  }, [token])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await axios.get(`${backendUrl}/api/user/insurance-providers`)
        if (!cancelled && data.success && Array.isArray(data.providers)) setProviders(data.providers)
      } catch {
        if (!cancelled) setProviders([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [backendUrl])

  useEffect(() => {
    setInsurance({ ...emptyInsurance, ...(userData?.insurance || {}) })
  }, [userData])

  useEffect(() => {
    if (!token) navigate('/login?mode=login')
  }, [token])

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (insurance.enabled && (!insurance.provider || !insurance.fullName || !insurance.birthDate || !insurance.idNumber || !insurance.expiryDate)) {
      toast.error('Please complete all insurance fields including provider')
      return
    }

    if (insurance.enabled && !cardFile && !insurance.medicalCardPhoto) {
      toast.error('Please attach the medical card')
      return
    }

    const formData = new FormData()
    formData.append('insuranceEnabled', insurance.enabled)
    formData.append('insuranceProvider', insurance.provider)
    formData.append('insuranceFullName', insurance.fullName)
    formData.append('insuranceBirthDate', insurance.birthDate)
    formData.append('insuranceIdNumber', insurance.idNumber)
    formData.append('insuranceExpiryDate', insurance.expiryDate)
    if (cardFile) formData.append('insuranceCardPhoto', cardFile)

    setSaving(true)
    const saved = await saveInsurance(formData)
    if (saved) {
      setInsurance({ ...emptyInsurance, ...saved })
      setCardFile(null)
    }
    setSaving(false)
  }

  return (
    <div className='min-h-[70vh] py-8'>
      <div className='max-w-3xl mx-auto bg-white border border-gray-200 rounded-lg p-5 sm:p-7 shadow-sm'>
        <div className='flex items-center gap-3 mb-6'>
          <div className='w-11 h-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center'>
            <CreditCard className='w-6 h-6' />
          </div>
          <div>
            <h1 className='text-2xl font-bold text-gray-900'>Insurance</h1>
            <p className='text-sm text-gray-500'>Add or edit your medical insurance details.</p>
          </div>
        </div>

        {userData?.insurance?.enabled && (
          <div className={`mb-5 rounded-lg border px-4 py-3 text-sm ${insuranceStatusTone(getInsuranceStatus(userData.insurance))}`}>
            <p className='font-semibold'>{insuranceStatusLabel(getInsuranceStatus(userData.insurance))}</p>
            {getInsuranceStatus(userData.insurance) === 'pending' && (
              <p className='mt-1 text-xs opacity-90'>Your insurance is on file and waiting for reception desk review.</p>
            )}
            {getInsuranceStatus(userData.insurance) === 'declined' && userData.insurance.declineReason && (
              <p className='mt-1 text-xs opacity-90'>Reason: {userData.insurance.declineReason}</p>
            )}
            {isInsuranceExpired(userData.insurance.expiryDate) && (
              <p className='mt-1 text-xs font-semibold'>Your card expiry date has passed. Please update your details.</p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className='space-y-5'>
          <button
            type='button'
            role='checkbox'
            aria-checked={insurance.enabled}
            onClick={() => setInsurance((prev) => ({ ...prev, enabled: !prev.enabled }))}
            className='flex w-full min-h-[44px] items-center justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-left transition active:bg-gray-100'
          >
            <span>
              <span className='block text-sm font-semibold text-gray-800'>Add Insurance</span>
              <span className='block text-xs text-gray-500'>Turn this on when you want insurance used on your profile.</span>
            </span>
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition ${
                insurance.enabled ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white'
              }`}
              aria-hidden='true'
            >
              {insurance.enabled ? <Check className='h-3.5 w-3.5' strokeWidth={3} /> : null}
            </span>
          </button>

          {insurance.enabled && (
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div className='sm:col-span-2' data-input-field>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Insurance provider *</label>
                <select
                  value={insurance.provider}
                  onChange={(e) => setInsurance((prev) => ({ ...prev, provider: e.target.value }))}
                  className='w-full border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white'
                  required
                >
                  <option value=''>Select provider</option>
                  {providers.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className='sm:col-span-2' data-input-field>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Full Name *</label>
                <input value={insurance.fullName} onChange={(e) => setInsurance((prev) => ({ ...prev, fullName: e.target.value }))} className='w-full border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20' required />
              </div>
              <div data-input-field>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Birth Date *</label>
                <input type='date' max={today} value={insurance.birthDate} onChange={(e) => setInsurance((prev) => ({ ...prev, birthDate: e.target.value }))} className='date-field-input w-full border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20' required />
              </div>
              <div data-input-field>
                <label className='block text-sm font-medium text-gray-700 mb-1'>ID Number *</label>
                <input value={insurance.idNumber} onChange={(e) => setInsurance((prev) => ({ ...prev, idNumber: e.target.value }))} className='w-full border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20' required />
              </div>
              <div data-input-field>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Expiry Date *</label>
                <input type='date' value={insurance.expiryDate} onChange={(e) => setInsurance((prev) => ({ ...prev, expiryDate: e.target.value }))} className='date-field-input w-full border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20' required />
              </div>
              <div>
                <span className='block text-sm font-medium text-gray-700 mb-1'>Photo of Medical Card *</span>
                <button
                  type='button'
                  onClick={() => cardFileInputRef.current?.click()}
                  className='flex min-h-[44px] w-full items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2.5 text-left text-sm text-gray-600 transition hover:border-primary active:bg-gray-50'
                >
                  <FileUp className='h-4 w-4 shrink-0' />
                  <span className='truncate'>{cardFile ? cardFile.name : insurance.medicalCardPhoto ? 'Replace attached card' : 'Attach file'}</span>
                </button>
                <input
                  ref={cardFileInputRef}
                  type='file'
                  accept='image/*,.pdf'
                  className='sr-only'
                  tabIndex={-1}
                  aria-hidden
                  onChange={(e) => setCardFile(e.target.files?.[0] || null)}
                />
                {insurance.medicalCardPhoto && (
                  <a className='inline-block mt-2 text-sm text-primary underline' href={insurance.medicalCardPhoto} target='_blank' rel='noreferrer'>View current card</a>
                )}
              </div>
            </div>
          )}

          <button disabled={saving} className='rounded-full bg-primary text-white px-8 py-3 text-sm font-semibold disabled:bg-gray-400'>
            {saving ? 'Saving...' : 'Save Insurance'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default Insurance
