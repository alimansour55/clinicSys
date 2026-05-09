import React, { useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import { ClipboardList, HeartPulse, Save, ShieldCheck } from 'lucide-react'

const emptyHistory = {
  conditions: '',
  allergies: '',
  surgeries: '',
  familyHistory: '',
  socialHistory: '',
  notes: ''
}

const fields = [
  {
    name: 'conditions',
    label: 'Medical Conditions',
    hint: 'Chronic conditions, current diagnoses, or recurring concerns'
  },
  {
    name: 'allergies',
    label: 'Allergies',
    hint: 'Medicine, food, environmental, or other known allergies'
  },
  {
    name: 'surgeries',
    label: 'Surgeries',
    hint: 'Past operations, procedures, or hospital stays'
  },
  {
    name: 'familyHistory',
    label: 'Family History',
    hint: 'Inherited conditions or major family health patterns'
  },
  {
    name: 'socialHistory',
    label: 'Social History',
    hint: 'Smoking, alcohol, activity level, occupation, or lifestyle notes'
  },
  {
    name: 'notes',
    label: 'Additional Notes',
    hint: 'Anything else your care team should know'
  }
]

const MedicalHistory = () => {
  const navigate = useNavigate()
  const { token, getMedicalHistory, saveMedicalHistory } = useContext(AppContext)
  const [history, setHistory] = useState(emptyHistory)
  const [initialHistory, setInitialHistory] = useState(emptyHistory)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const hasExistingHistory = Object.values(initialHistory).some((value) => String(value || '').trim())
  const hasChanges = JSON.stringify(history) !== JSON.stringify(initialHistory)

  const updateField = (field, value) => {
    setHistory((prev) => ({ ...prev, [field]: value }))
  }

  const formatUpdatedAt = (updatedAt) => {
    if (!updatedAt) return 'Not updated yet'
    return new Date(updatedAt).toLocaleString()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)

    const savedHistory = await saveMedicalHistory(history, hasExistingHistory ? 'put' : 'post')
    if (savedHistory) {
      const normalized = { ...emptyHistory, ...savedHistory }
      setHistory(normalized)
      setInitialHistory(normalized)
    }

    setSaving(false)
  }

  useEffect(() => {
    const loadHistory = async () => {
      if (!token) {
        navigate('/login')
        return
      }

      setLoading(true)
      const medicalHistory = await getMedicalHistory()
      const normalized = { ...emptyHistory, ...(medicalHistory || {}) }
      setHistory(normalized)
      setInitialHistory(normalized)
      setLoading(false)
    }

    loadHistory()
  }, [token])

  if (loading) {
    return (
      <div className='max-w-5xl mx-auto mt-8 animate-pulse'>
        <div className='h-8 bg-gray-200 rounded w-56 mb-4'></div>
        <div className='grid md:grid-cols-2 gap-4'>
          {[...Array(6)].map((_, index) => (
            <div key={index} className='h-36 bg-gray-100 border border-gray-200 rounded-lg'></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className='max-w-5xl mx-auto mt-8 mb-12'>
      <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-5 mb-6'>
        <div>
          <div className='flex items-center gap-3'>
            <span className='p-2 bg-primary/10 text-primary rounded-lg'>
              <ClipboardList className='w-5 h-5' />
            </span>
            <h1 className='text-xl sm:text-2xl font-bold text-gray-900'>
              Medical <span className='text-primary'>History</span>
            </h1>
          </div>
          <p className='text-sm text-gray-600 mt-2 max-w-2xl'>
            Keep your health background up to date so doctors can review the right context before and after visits.
          </p>
        </div>

        <div className='flex items-center gap-2 text-xs sm:text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2'>
          <ShieldCheck className='w-4 h-4 text-primary' />
          <span>Last updated: {formatUpdatedAt(initialHistory.updatedAt)}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className='grid md:grid-cols-2 gap-4'>
          {fields.map((field) => (
            <label key={field.name} className='block border border-gray-200 rounded-lg p-4 bg-white'>
              <span className='flex items-center gap-2 font-semibold text-gray-900 text-sm sm:text-base'>
                <HeartPulse className='w-4 h-4 text-primary' />
                {field.label}
              </span>
              <span className='block text-xs sm:text-sm text-gray-500 mt-1 mb-3'>{field.hint}</span>
              <textarea
                value={history[field.name] || ''}
                onChange={(event) => updateField(field.name, event.target.value)}
                className='w-full min-h-28 resize-y border border-gray-200 rounded-lg p-3 text-sm text-gray-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10'
                placeholder='Write here'
              />
            </label>
          ))}
        </div>

        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-6 pt-5 border-t'>
          <p className='text-xs sm:text-sm text-gray-500'>
            You can update this anytime. Doctors may also add notes after appointments.
          </p>

          <button
            type='submit'
            disabled={saving || !hasChanges}
            className='inline-flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {saving ? (
              <>
                <span className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></span>
                Saving...
              </>
            ) : (
              <>
                <Save className='w-4 h-4' />
                Save History
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default MedicalHistory
