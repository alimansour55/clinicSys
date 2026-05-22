import React, { useContext, useEffect, useState } from 'react'
import { Building2, Camera, Mail, MapPin, Phone, Save, UserRound, ShieldCheck, KeyRound, Edit, X, IdCard, Users } from 'lucide-react'
import { ReceptionistContext } from '../../context/ReceptionistContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import MfaSetupBox from '../../components/MfaSetupBox'
import { emptyAddress, emptyEmergencyContact, mergeReceptionistFromApi } from '../../utils/receptionistProfileForm'

const addressLabels = {
  line1: 'Address line 1',
  line2: 'Address line 2',
  city: 'City',
  state: 'State / region',
  postalCode: 'Postal code',
  country: 'Country'
}

const ReceptionistProfile = () => {
  const { rToken, backendUrl, refreshReceptionistNavSummary } = useContext(ReceptionistContext)

  const [isEdit, setIsEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    isActive: true,
    image: '',
    jobTitle: 'Receptionist',
    department: '',
    employeeId: '',
    bio: '',
    address: emptyAddress(),
    emergencyContact: emptyEmergencyContact()
  })
  const [mfaStatus, setMfaStatus] = useState(null)
  const [mfaSetup, setMfaSetup] = useState(null)
  const [mfaCode, setMfaCode] = useState('')

  const setField = (field, value) => setProfileData((prev) => ({ ...prev, [field]: value }))
  const setAddressField = (key, value) =>
    setProfileData((prev) => ({ ...prev, address: { ...prev.address, [key]: value } }))
  const setEmergencyField = (key, value) =>
    setProfileData((prev) => ({ ...prev, emergencyContact: { ...prev.emergencyContact, [key]: value } }))

  useEffect(() => {
    if (rToken) {
      loadProfileData()
      loadMfaStatus()
    }
  }, [rToken])

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview)
    }
  }, [photoPreview])

  const loadProfileData = async () => {
    try {
      const { data } = await axios.get(`${backendUrl}/api/receptionist/profile`, { headers: { rToken } })
      if (data.success) {
        setProfileData(mergeReceptionistFromApi(data.receptionist))
        refreshReceptionistNavSummary()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message)
    }
  }

  const loadMfaStatus = async () => {
    try {
      const { data } = await axios.get(`${backendUrl}/api/receptionist/mfa/status`, { headers: { rToken } })
      if (data.success) setMfaStatus(data.mfa)
    } catch (error) {
      console.log(error)
    }
  }

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

  const updateProfileData = async () => {
    try {
      setSaving(true)
      const fd = new FormData()
      fd.append('name', profileData.name || '')
      fd.append('phone', profileData.phone || '')
      fd.append('jobTitle', profileData.jobTitle || 'Receptionist')
      fd.append('department', profileData.department || '')
      fd.append('bio', profileData.bio || '')
      fd.append('address', JSON.stringify(profileData.address || emptyAddress()))
      fd.append('emergencyContact', JSON.stringify(profileData.emergencyContact || emptyEmergencyContact()))
      if (photoFile) fd.append('image', photoFile)

      const { data } = await axios.post(`${backendUrl}/api/receptionist/update-profile`, fd, {
        headers: { rToken }
      })

      if (data.success) {
        toast.success(data.message)
        setIsEdit(false)
        setPhotoFile(null)
        setPhotoPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return null
        })
        loadProfileData()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message)
    } finally {
      setSaving(false)
    }
  }

  const startMfaSetup = async () => {
    try {
      const { data } = await axios.post(`${backendUrl}/api/receptionist/mfa/setup`, {}, { headers: { rToken } })
      if (data.success) {
        setMfaSetup(data.setup)
        setMfaCode('')
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    }
  }

  const enableMfa = async () => {
    try {
      const { data } = await axios.post(`${backendUrl}/api/receptionist/mfa/enable`, { code: mfaCode }, { headers: { rToken } })
      if (data.success) {
        toast.success(data.message)
        setMfaSetup(null)
        setMfaCode('')
        loadMfaStatus()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    }
  }

  const disableMfa = async () => {
    try {
      const { data } = await axios.post(`${backendUrl}/api/receptionist/mfa/disable`, { code: mfaCode }, { headers: { rToken } })
      if (data.success) {
        toast.success(data.message)
        setMfaCode('')
        loadMfaStatus()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    }
  }

  const cancelEdit = () => {
    setIsEdit(false)
    setPhotoFile(null)
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    loadProfileData()
  }

  const displayImage = photoPreview || profileData.image || ''

  return (
    <div className='p-4 sm:p-6 lg:p-8'>
      <div className='max-w-5xl'>
        <div className='mb-6'>
          <h1 className='text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2'>
            <UserRound className='w-6 h-6 text-primary' />
            My Profile
          </h1>
          <p className='text-sm text-gray-600 mt-1 ml-8'>Photo, contact, address, emergency contact, and security</p>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
          <div className='lg:col-span-2 space-y-5'>
            <div className='bg-white border border-gray-200 rounded-lg p-5 shadow-sm'>
              <div className='flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5'>
                <h2 className='text-lg font-bold text-gray-800'>Profile &amp; role</h2>
                {!isEdit ? (
                  <button
                    type='button'
                    onClick={() => setIsEdit(true)}
                    className='flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary rounded-lg hover:opacity-95 transition'
                  >
                    <Edit className='w-4 h-4' />
                    Edit profile
                  </button>
                ) : (
                  <div className='flex flex-wrap gap-2'>
                    <button type='button' onClick={cancelEdit} className='flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition'>
                      <X className='w-4 h-4' />
                      Cancel
                    </button>
                    <button type='button' onClick={updateProfileData} disabled={saving} className='flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary rounded-lg disabled:bg-gray-400 transition'>
                      <Save className='w-4 h-4' />
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                )}
              </div>

              <div className='flex flex-col sm:flex-row gap-6 mb-6'>
                <div className='flex flex-col items-center sm:items-start'>
                  <div className='relative w-28 h-28 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-100 shrink-0'>
                    {displayImage ? (
                      <img src={displayImage} alt='' className='w-full h-full object-cover' />
                    ) : (
                      <div className='w-full h-full flex items-center justify-center text-gray-400 text-2xl font-bold'>{(profileData.name || '?').charAt(0)}</div>
                    )}
                  </div>
                  {isEdit && (
                    <label className='mt-3 cursor-pointer inline-flex items-center gap-2 text-sm font-semibold text-primary'>
                      <Camera className='w-4 h-4' />
                      Change photo
                      <input type='file' accept='image/*' className='hidden' onChange={onPickPhoto} />
                    </label>
                  )}
                </div>

                <div className='flex-1 space-y-4'>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <div>
                      <label className='block text-xs font-bold uppercase text-gray-400 mb-2'>Full name</label>
                      {isEdit ? (
                        <input type='text' value={profileData.name || ''} onChange={(e) => setField('name', e.target.value)} className='w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20' />
                      ) : (
                        <p className='px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-gray-800 font-medium'>{profileData.name || '—'}</p>
                      )}
                    </div>
                    <div>
                      <label className='block text-xs font-bold uppercase text-gray-400 mb-2'>Email</label>
                      <p className='px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-gray-800 font-medium'>{profileData.email || '—'}</p>
                    </div>
                    <div>
                      <label className='block text-xs font-bold uppercase text-gray-400 mb-2'>Phone</label>
                      {isEdit ? (
                        <input type='tel' value={profileData.phone || ''} onChange={(e) => setField('phone', e.target.value)} className='w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20' />
                      ) : (
                        <p className='px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-gray-800 font-medium'>{profileData.phone || '—'}</p>
                      )}
                    </div>
                    <div>
                      <label className='block text-xs font-bold uppercase text-gray-400 mb-2'>Account status</label>
                      <p className={`px-3 py-2 rounded-lg font-medium flex items-center gap-2 ${profileData.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        <span className={`w-2 h-2 rounded-full ${profileData.isActive ? 'bg-emerald-700' : 'bg-red-700'}`} />
                        {profileData.isActive ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                  </div>

                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    <div>
                      <label className='block text-xs font-bold uppercase text-gray-400 mb-2 flex items-center gap-1'>
                        <IdCard className='w-3 h-3' /> Job title
                      </label>
                      {isEdit ? (
                        <input type='text' value={profileData.jobTitle || ''} onChange={(e) => setField('jobTitle', e.target.value)} className='w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20' />
                      ) : (
                        <p className='px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-gray-800 font-medium'>{profileData.jobTitle || '—'}</p>
                      )}
                    </div>
                    <div>
                      <label className='block text-xs font-bold uppercase text-gray-400 mb-2 flex items-center gap-1'>
                        <Building2 className='w-3 h-3' /> Department
                      </label>
                      {isEdit ? (
                        <input type='text' value={profileData.department || ''} onChange={(e) => setField('department', e.target.value)} className='w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20' />
                      ) : (
                        <p className='px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-gray-800 font-medium'>{profileData.department || '—'}</p>
                      )}
                    </div>
                    <div className='md:col-span-2'>
                      <label className='block text-xs font-bold uppercase text-gray-400 mb-2'>Employee ID (set by admin)</label>
                      <p className='px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-gray-600 text-sm'>{profileData.employeeId || 'Not assigned'}</p>
                    </div>
                  </div>

                  <div>
                    <label className='block text-xs font-bold uppercase text-gray-400 mb-2'>Bio</label>
                    {isEdit ? (
                      <textarea value={profileData.bio || ''} onChange={(e) => setField('bio', e.target.value)} rows={3} className='w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-y' placeholder='Short introduction for colleagues…' />
                    ) : (
                      <p className='px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-gray-800 whitespace-pre-wrap min-h-[3rem]'>{profileData.bio || '—'}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className='border-t border-gray-100 pt-5'>
                <h3 className='text-sm font-bold text-gray-800 mb-3 flex items-center gap-2'>
                  <MapPin className='w-4 h-4 text-primary' />
                  Address
                </h3>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                  {Object.entries(addressLabels).map(([key, label]) => (
                    <div key={key} className={key === 'line1' || key === 'line2' ? 'md:col-span-2' : ''}>
                      <label className='block text-xs font-semibold text-gray-500 mb-1'>{label}</label>
                      {isEdit ? (
                        <input type='text' value={profileData.address?.[key] || ''} onChange={(e) => setAddressField(key, e.target.value)} className='w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-primary text-sm' />
                      ) : (
                        <p className='px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm text-gray-800'>{profileData.address?.[key] || '—'}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className='border-t border-gray-100 pt-5 mt-5'>
                <h3 className='text-sm font-bold text-gray-800 mb-3 flex items-center gap-2'>
                  <Users className='w-4 h-4 text-primary' />
                  Emergency contact
                </h3>
                <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
                  {['name', 'phone', 'relationship'].map((key) => (
                    <div key={key}>
                      <label className='block text-xs font-semibold text-gray-500 mb-1 capitalize'>{key}</label>
                      {isEdit ? (
                        <input type={key === 'phone' ? 'tel' : 'text'} value={profileData.emergencyContact?.[key] || ''} onChange={(e) => setEmergencyField(key, e.target.value)} className='w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-primary text-sm' />
                      ) : (
                        <p className='px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-sm text-gray-800'>{profileData.emergencyContact?.[key] || '—'}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <aside className='space-y-5'>
            <div className='bg-white border border-gray-200 rounded-lg p-5 shadow-sm'>
              <div className='flex items-start justify-between gap-3 mb-4'>
                <div>
                  <h3 className='font-bold text-gray-800'>Account security</h3>
                  <p className='text-xs text-gray-500 mt-1'>Authenticator (MFA)</p>
                </div>
                <span className={`px-3 py-1 text-xs font-bold rounded-full ${mfaStatus?.enabled ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                  MFA {mfaStatus?.enabled ? 'On' : 'Off'}
                </span>
              </div>

              {mfaStatus?.required && (
                <p className='mb-3 px-3 py-2 rounded-lg bg-blue-50 text-xs font-semibold text-blue-700'>MFA is required for this account.</p>
              )}

              {mfaSetup ? (
                <div className='space-y-3'>
                  <MfaSetupBox mode='setup' setup={mfaSetup} />
                  <input value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder='6-digit code' className='w-full px-3 py-2 text-center text-sm font-bold tracking-[0.35em] border border-gray-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20' inputMode='numeric' />
                  <button type='button' onClick={enableMfa} className='w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:opacity-95 transition'>
                    <ShieldCheck className='w-4 h-4' />
                    Verify and enable
                  </button>
                </div>
              ) : (
                <div className='space-y-3'>
                  {!mfaStatus?.enabled && (
                    <button type='button' onClick={startMfaSetup} className='w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white font-semibold rounded-lg disabled:bg-gray-300 transition' disabled={mfaStatus?.canSelfManage === false && !mfaStatus?.required}>
                      <KeyRound className='w-4 h-4' />
                      Set up authenticator
                    </button>
                  )}
                  {mfaStatus?.enabled && !mfaStatus?.required && (
                    <>
                      <input value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder='6-digit code' className='w-full px-3 py-2 text-center text-sm font-bold tracking-[0.35em] border border-gray-200 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/20' inputMode='numeric' />
                      <button type='button' onClick={disableMfa} className='w-full px-4 py-2 border border-red-200 bg-white text-red-700 font-semibold rounded-lg hover:bg-red-50 transition'>
                        Disable MFA
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className='bg-white border border-gray-200 rounded-lg p-5 shadow-sm'>
              <h3 className='font-bold text-gray-800 mb-4'>Quick contact</h3>
              <div className='space-y-3 text-sm'>
                <p className='flex items-center gap-2 text-gray-600'>
                  <Mail className='w-4 h-4 text-primary shrink-0' />
                  {profileData.email}
                </p>
                <p className='flex items-center gap-2 text-gray-600'>
                  <Phone className='w-4 h-4 text-primary shrink-0' />
                  {profileData.phone || '—'}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

export default ReceptionistProfile
