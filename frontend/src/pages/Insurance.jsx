import React, { useContext, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useNavigate } from 'react-router-dom'
import { CreditCard, FileUp } from 'lucide-react'
import { AppContext } from '../context/AppContext'

const emptyInsurance = {
  enabled: false,
  fullName: '',
  birthDate: '',
  idNumber: '',
  expiryDate: '',
  medicalCardPhoto: ''
}

const Insurance = () => {
  const { token, userData, saveInsurance } = useContext(AppContext)
  const navigate = useNavigate()
  const [insurance, setInsurance] = useState(emptyInsurance)
  const [cardFile, setCardFile] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setInsurance({ ...emptyInsurance, ...(userData?.insurance || {}) })
  }, [userData])

  useEffect(() => {
    if (!token) navigate('/login?mode=login')
  }, [token])

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (insurance.enabled && (!insurance.fullName || !insurance.birthDate || !insurance.idNumber || !insurance.expiryDate)) {
      toast.error('Please complete all insurance fields')
      return
    }

    if (insurance.enabled && !cardFile && !insurance.medicalCardPhoto) {
      toast.error('Please attach the medical card')
      return
    }

    const formData = new FormData()
    formData.append('insuranceEnabled', insurance.enabled)
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

        <form onSubmit={handleSubmit} className='space-y-5'>
          <label className='flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 cursor-pointer'>
            <span>
              <span className='block text-sm font-semibold text-gray-800'>Add Insurance</span>
              <span className='block text-xs text-gray-500'>Turn this on when you want insurance used on your profile.</span>
            </span>
            <input
              type='checkbox'
              checked={insurance.enabled}
              onChange={(e) => setInsurance((prev) => ({ ...prev, enabled: e.target.checked }))}
              className='w-5 h-5 accent-primary'
            />
          </label>

          {insurance.enabled && (
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div className='sm:col-span-2'>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Full Name *</label>
                <input value={insurance.fullName} onChange={(e) => setInsurance((prev) => ({ ...prev, fullName: e.target.value }))} className='w-full border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20' required />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Birth Date *</label>
                <input type='date' value={insurance.birthDate} onChange={(e) => setInsurance((prev) => ({ ...prev, birthDate: e.target.value }))} className='w-full border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20' required />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>ID Number *</label>
                <input value={insurance.idNumber} onChange={(e) => setInsurance((prev) => ({ ...prev, idNumber: e.target.value }))} className='w-full border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20' required />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Expiry Date *</label>
                <input type='date' value={insurance.expiryDate} onChange={(e) => setInsurance((prev) => ({ ...prev, expiryDate: e.target.value }))} className='w-full border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20' required />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Photo of Medical Card *</label>
                <label className='flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2.5 cursor-pointer hover:border-primary text-sm text-gray-600'>
                  <FileUp className='w-4 h-4' />
                  <span className='truncate'>{cardFile ? cardFile.name : insurance.medicalCardPhoto ? 'Replace attached card' : 'Attach file'}</span>
                  <input type='file' accept='image/*,.pdf' onChange={(e) => setCardFile(e.target.files?.[0] || null)} hidden />
                </label>
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
