import React, { useContext, useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ArrowLeft, Building2, Camera, IdCard, Loader2, Save, Shield, UserCog } from 'lucide-react'
import { toast } from 'react-toastify'
import { AdminContext } from '../../context/AdminContext'
import { emptyAddress, emptyEmergencyContact, mergeReceptionistFromApi } from '../../utils/receptionistProfileForm'

const addressLabels = {
  line1: 'Address line 1',
  line2: 'Address line 2',
  city: 'City',
  state: 'State / region',
  postalCode: 'Postal code',
  country: 'Country'
}

const EditReceptionist = () => {
  const { receptionistId } = useParams()
  const navigate = useNavigate()
  const { aToken, getReceptionistById, updateReceptionistByAdmin } = useContext(AdminContext)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [form, setForm] = useState({
    name: '',
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

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }))
  const setAddressField = (k, v) => setForm((p) => ({ ...p, address: { ...p.address, [k]: v } }))
  const setEmergencyField = (k, v) => setForm((p) => ({ ...p, emergencyContact: { ...p.emergencyContact, [k]: v } }))

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview)
    }
  }, [photoPreview])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!aToken || !receptionistId) return
      setLoading(true)
      const row = await getReceptionistById(receptionistId)
      if (!cancelled && row) {
        const merged = mergeReceptionistFromApi(row)
        setForm((prev) => ({
          ...prev,
          ...merged,
          password: '',
          mfaRequiredByAdmin: Boolean(row.mfa?.requiredByAdmin)
        }))
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [aToken, receptionistId])

  const onPickPhoto = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      return
    }
    setPhotoFile(file)
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('receptionistId', receptionistId)
      fd.append('name', form.name)
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
        setPhotoPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return null
        })
        const refreshed = await getReceptionistById(receptionistId)
        if (refreshed) {
          setForm({
            ...mergeReceptionistFromApi(refreshed),
            password: '',
            mfaRequiredByAdmin: Boolean(refreshed.mfa?.requiredByAdmin)
          })
        }
      }
    } finally {
      setSaving(false)
    }
  }

  const displayImage = photoPreview || form.image || ''

  if (!aToken) {
    return null
  }

  if (loading) {
    return (
      <div className='min-h-[40vh] flex items-center justify-center'>
        <Loader2 className='w-10 h-10 text-primary animate-spin' />
      </div>
    )
  }

  return (
    <div className='min-h-screen bg-gray-50 py-4 sm:py-6 lg:py-8 px-3 sm:px-6 lg:px-8'>
      <div className='max-w-4xl mx-auto'>
        <div className='mb-6 flex flex-wrap items-center gap-3'>
          <Link to='/receptionist-list' className='inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-primary'>
            <ArrowLeft className='w-4 h-4' />
            Receptionists
          </Link>
        </div>

        <div className='mb-6'>
          <h1 className='text-xl md:text-3xl font-bold text-gray-900 flex items-center gap-2'>
            <UserCog className='w-7 h-7 text-primary' />
            Edit receptionist
          </h1>
          <p className='mt-2 text-sm text-gray-600'>Full profile, photo, address, emergency contact, HR notes, and MFA policy.</p>
        </div>

        <form onSubmit={onSubmit} className='bg-white rounded-xl shadow border border-gray-200 p-5 sm:p-8 space-y-8'>
          <div className='flex flex-col sm:flex-row gap-6'>
            <div className='flex flex-col items-center'>
              <div className='relative w-32 h-32 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-100'>
                {displayImage ? <img src={displayImage} alt='' className='w-full h-full object-cover' /> : <div className='w-full h-full flex items-center justify-center text-gray-400 text-3xl font-bold'>{(form.name || '?').charAt(0)}</div>}
              </div>
              <label className='mt-3 cursor-pointer inline-flex items-center gap-2 text-sm font-semibold text-primary'>
                <Camera className='w-4 h-4' />
                Upload photo
                <input type='file' accept='image/*' className='hidden' onChange={onPickPhoto} />
              </label>
            </div>

            <div className='flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div className='sm:col-span-2'>
                <label className='block text-sm font-semibold text-gray-700 mb-1'>Full name</label>
                <input required value={form.name} onChange={(e) => setField('name', e.target.value)} className='w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-primary' />
              </div>
              <div>
                <label className='block text-sm font-semibold text-gray-700 mb-1'>Email</label>
                <input required type='email' value={form.email} onChange={(e) => setField('email', e.target.value)} className='w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-primary' />
              </div>
              <div>
                <label className='block text-sm font-semibold text-gray-700 mb-1'>Phone</label>
                <input required value={form.phone} onChange={(e) => setField('phone', e.target.value)} className='w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-primary' />
              </div>
              <div>
                <label className='block text-sm font-semibold text-gray-700 mb-1'>New password (optional)</label>
                <input type='password' value={form.password} onChange={(e) => setField('password', e.target.value)} autoComplete='new-password' className='w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-primary' placeholder='Leave blank to keep current' />
              </div>
              <div>
                <label className='block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1'><IdCard className='w-4 h-4' /> Job title</label>
                <input value={form.jobTitle} onChange={(e) => setField('jobTitle', e.target.value)} className='w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-primary' />
              </div>
              <div>
                <label className='block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1'><Building2 className='w-4 h-4' /> Department</label>
                <input value={form.department} onChange={(e) => setField('department', e.target.value)} className='w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-primary' />
              </div>
              <div>
                <label className='block text-sm font-semibold text-gray-700 mb-1'>Employee ID</label>
                <input value={form.employeeId} onChange={(e) => setField('employeeId', e.target.value)} className='w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-primary' />
              </div>
              <div className='flex items-center gap-3 pt-6'>
                <input id='active' type='checkbox' checked={form.isActive} onChange={(e) => setField('isActive', e.target.checked)} className='w-4 h-4 rounded border-gray-300' />
                <label htmlFor='active' className='text-sm font-semibold text-gray-800'>Account active</label>
              </div>
              <div className='flex items-center gap-3 sm:col-span-2'>
                <input id='mfaReq' type='checkbox' checked={form.mfaRequiredByAdmin} onChange={(e) => setField('mfaRequiredByAdmin', e.target.checked)} className='w-4 h-4 rounded border-gray-300' />
                <label htmlFor='mfaReq' className='text-sm font-semibold text-gray-800 flex items-center gap-2'>
                  <Shield className='w-4 h-4 text-primary' />
                  Require MFA (enforced by admin)
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className='block text-sm font-semibold text-gray-700 mb-1'>Bio</label>
            <textarea value={form.bio} onChange={(e) => setField('bio', e.target.value)} rows={3} className='w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-primary resize-y' />
          </div>

          <div>
            <label className='block text-sm font-semibold text-gray-700 mb-1'>Admin / HR notes (not visible to receptionist)</label>
            <textarea value={form.adminNotes} onChange={(e) => setField('adminNotes', e.target.value)} rows={3} className='w-full border-2 border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-primary resize-y' placeholder='Internal notes only…' />
          </div>

          <div>
            <h2 className='text-sm font-bold text-gray-900 mb-3'>Address</h2>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
              {Object.entries(addressLabels).map(([key, label]) => (
                <div key={key} className={key === 'line1' || key === 'line2' ? 'sm:col-span-2' : ''}>
                  <label className='block text-xs font-semibold text-gray-600 mb-1'>{label}</label>
                  <input value={form.address[key] || ''} onChange={(e) => setAddressField(key, e.target.value)} className='w-full border-2 border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-primary text-sm' />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className='text-sm font-bold text-gray-900 mb-3'>Emergency contact</h2>
            <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
              <div>
                <label className='block text-xs font-semibold text-gray-600 mb-1'>Name</label>
                <input value={form.emergencyContact.name} onChange={(e) => setEmergencyField('name', e.target.value)} className='w-full border-2 border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-primary text-sm' />
              </div>
              <div>
                <label className='block text-xs font-semibold text-gray-600 mb-1'>Phone</label>
                <input value={form.emergencyContact.phone} onChange={(e) => setEmergencyField('phone', e.target.value)} className='w-full border-2 border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-primary text-sm' />
              </div>
              <div>
                <label className='block text-xs font-semibold text-gray-600 mb-1'>Relationship</label>
                <input value={form.emergencyContact.relationship} onChange={(e) => setEmergencyField('relationship', e.target.value)} className='w-full border-2 border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-primary text-sm' />
              </div>
            </div>
          </div>

          <div className='flex flex-wrap gap-3'>
            <button type='submit' disabled={saving} className='bg-primary text-white px-6 py-3 rounded-lg font-semibold flex items-center gap-2 disabled:bg-gray-400'>
              {saving ? <Loader2 className='w-5 h-5 animate-spin' /> : <Save className='w-5 h-5' />}
              Save changes
            </button>
            <button type='button' onClick={() => navigate('/receptionist-list')} className='bg-gray-100 text-gray-800 px-6 py-3 rounded-lg font-semibold'>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditReceptionist
