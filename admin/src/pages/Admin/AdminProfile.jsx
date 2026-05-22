import React, { useContext, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import { AdminContext } from '../../context/AdminContext'
import MfaSetupBox from '../../components/MfaSetupBox'
import { EGYPT_DIAL_CODE, parseEgyptLocalDigits, toEgyptLocalDigits } from '../../utils/egyptPhone'
import {
  Camera,
  Edit,
  KeyRound,
  Loader2,
  Mail,
  Phone,
  Save,
  Shield,
  ShieldCheck,
  Sparkles,
  UserRound,
  X
} from 'lucide-react'

const emptyForm = () => ({
  name: '',
  email: '',
  phoneLocal: '',
  jobTitle: '',
  bio: '',
  image: ''
})

const AdminProfile = () => {
  const { aToken, backendUrl, refreshAdminNavSummary } = useContext(AdminContext)
  const [form, setForm] = useState(emptyForm())
  const [mfaStatus, setMfaStatus] = useState(null)
  const [mfaSetup, setMfaSetup] = useState(null)
  const [mfaCode, setMfaCode] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [isEdit, setIsEdit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [removeImage, setRemoveImage] = useState(false)

  const applyProfile = (profile) => {
    setForm({
      name: profile?.name || 'Administrator',
      email: profile?.email || '',
      phoneLocal: toEgyptLocalDigits(profile?.phone || ''),
      jobTitle: profile?.jobTitle || 'Clinic Administrator',
      bio: profile?.bio || '',
      image: profile?.image || ''
    })
  }

  const loadProfile = async () => {
    const { data } = await axios.get(`${backendUrl}/api/admin/profile`, { headers: { aToken } })
    if (data.success) {
      applyProfile(data.profile)
      refreshAdminNavSummary?.()
      return true
    }
    toast.error(data.message)
    return false
  }

  const loadMfaStatus = async () => {
    const { data } = await axios.get(`${backendUrl}/api/admin/mfa/status`, { headers: { aToken } })
    if (data.success) setMfaStatus(data.mfa)
  }

  useEffect(() => {
    if (!aToken) return
    const load = async () => {
      setLoading(true)
      try {
        await Promise.all([loadProfile(), loadMfaStatus()])
      } catch (error) {
        toast.error(error.response?.data?.message || error.message)
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aToken])

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview)
    }
  }, [photoPreview])

  const onPickPhoto = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      return
    }
    setPhotoFile(file)
    setRemoveImage(false)
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  const cancelEdit = () => {
    setIsEdit(false)
    setPhotoFile(null)
    setRemoveImage(false)
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    loadProfile()
  }

  const saveProfile = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('name', form.name.trim())
      fd.append('phone', form.phoneLocal ? `${EGYPT_DIAL_CODE}${form.phoneLocal}` : '')
      fd.append('jobTitle', form.jobTitle.trim())
      fd.append('bio', form.bio.trim())
      if (removeImage) fd.append('removeImage', 'true')
      if (photoFile) fd.append('image', photoFile)

      const { data } = await axios.post(`${backendUrl}/api/admin/update-profile`, fd, {
        headers: { aToken }
      })

      if (data.success) {
        toast.success(data.message)
        if (data.profile) applyProfile(data.profile)
        setIsEdit(false)
        setPhotoFile(null)
        setRemoveImage(false)
        setPhotoPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return null
        })
        refreshAdminNavSummary?.()
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
      const { data } = await axios.post(`${backendUrl}/api/admin/mfa/setup`, {}, { headers: { aToken } })
      if (data.success) {
        setMfaSetup(data.setup)
        setMfaCode('')
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message)
    }
  }

  const enableMfa = async () => {
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/admin/mfa/enable`,
        { code: mfaCode },
        { headers: { aToken } }
      )
      if (data.success) {
        toast.success(data.message)
        setMfaSetup(null)
        setMfaCode('')
        await loadProfile()
        await loadMfaStatus()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message)
    }
  }

  const disableMfa = async () => {
    try {
      const { data } = await axios.post(
        `${backendUrl}/api/admin/mfa/disable`,
        { code: disableCode },
        { headers: { aToken } }
      )
      if (data.success) {
        toast.success(data.message)
        setDisableCode('')
        setMfaSetup(null)
        await loadMfaStatus()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message)
    }
  }

  const displayImage = photoPreview || (!removeImage && form.image) || ''
  const adminInitial = (form.name || 'A').trim().charAt(0).toUpperCase()

  if (loading) {
    return (
      <div className='flex min-h-[40vh] items-center justify-center p-8'>
        <Loader2 className='h-10 w-10 animate-spin text-primary' />
      </div>
    )
  }

  return (
    <div className='w-full bg-[#f4f6fb] p-3 sm:p-5 md:p-6 lg:p-8'>
      <div className='mx-auto max-w-3xl space-y-6'>
        <div className='overflow-hidden rounded-2xl border border-slate-700/20 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 px-6 py-8 shadow-xl sm:px-8'>
          <div className='inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white/90 ring-1 ring-white/20'>
            <Sparkles className='h-3.5 w-3.5' />
            My account
          </div>
          <div className='mt-5 flex flex-col gap-5 sm:flex-row sm:items-center'>
            <div className='relative shrink-0'>
              {displayImage ? (
                <img
                  src={displayImage}
                  alt=''
                  className='h-20 w-20 rounded-2xl object-cover shadow-lg ring-4 ring-white/20'
                />
              ) : (
                <span className='flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-2xl font-bold text-white shadow-lg ring-4 ring-white/20'>
                  {adminInitial}
                </span>
              )}
              {isEdit && (
                <label className='absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white text-primary shadow-md ring-2 ring-slate-900/20'>
                  <Camera className='h-4 w-4' />
                  <input type='file' accept='image/*' className='hidden' onChange={onPickPhoto} />
                </label>
              )}
            </div>
            <div className='min-w-0 flex-1 text-white'>
              <h1 className='text-2xl font-bold tracking-tight sm:text-3xl'>{form.name}</h1>
              <p className='mt-1 flex items-center gap-2 text-sm text-white/85'>
                <Mail className='h-4 w-4 shrink-0' />
                <span className='truncate'>{form.email}</span>
              </p>
              {form.phoneLocal && (
                <p className='mt-1 flex items-center gap-2 text-sm text-white/80'>
                  <Phone className='h-4 w-4 shrink-0' />
                  {EGYPT_DIAL_CODE} {form.phoneLocal}
                </p>
              )}
              <p className='mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/90'>
                <Shield className='h-3.5 w-3.5' />
                {form.jobTitle || 'Clinic administrator'}
              </p>
            </div>
          </div>
        </div>

        <div className='rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6'>
          <div className='mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <h2 className='text-base font-bold text-gray-900'>Profile details</h2>
              <p className='mt-1 text-sm text-gray-600'>
                Update how you appear in the app. Sign-in email and password are still managed on the server.
              </p>
            </div>
            {!isEdit ? (
              <button
                type='button'
                onClick={() => setIsEdit(true)}
                className='inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95'
              >
                <Edit className='h-4 w-4' />
                Edit profile
              </button>
            ) : (
              <div className='flex flex-wrap gap-2'>
                <button
                  type='button'
                  onClick={cancelEdit}
                  className='inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50'
                >
                  <X className='h-4 w-4' />
                  Cancel
                </button>
                <button
                  type='button'
                  onClick={saveProfile}
                  disabled={saving}
                  className='inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60'
                >
                  {saving ? <Loader2 className='h-4 w-4 animate-spin' /> : <Save className='h-4 w-4' />}
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            )}
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            <label className='block text-sm font-medium text-gray-700 sm:col-span-2'>
              Profile photo
              {isEdit && (
                <div className='mt-2 flex flex-wrap items-center gap-3'>
                  <label className='inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-primary hover:bg-gray-100'>
                    <Camera className='h-4 w-4' />
                    Upload photo
                    <input type='file' accept='image/*' className='hidden' onChange={onPickPhoto} />
                  </label>
                  {form.image && !photoFile && (
                    <button
                      type='button'
                      onClick={() => {
                        setRemoveImage(true)
                        setPhotoFile(null)
                        setPhotoPreview((prev) => {
                          if (prev) URL.revokeObjectURL(prev)
                          return null
                        })
                      }}
                      className='text-sm font-semibold text-red-600 hover:text-red-700'
                    >
                      Remove photo
                    </button>
                  )}
                </div>
              )}
            </label>

            <label className='block text-sm font-medium text-gray-700'>
              Full name
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                disabled={!isEdit}
                className='mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-50'
                maxLength={120}
              />
            </label>

            <label className='block text-sm font-medium text-gray-700'>
              Job title
              <input
                value={form.jobTitle}
                onChange={(e) => setForm((prev) => ({ ...prev, jobTitle: e.target.value }))}
                disabled={!isEdit}
                className='mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-50'
                maxLength={80}
              />
            </label>

            <label className='block text-sm font-medium text-gray-700 sm:col-span-2'>
              Sign-in email
              <input
                value={form.email}
                readOnly
                className='mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-600'
              />
              <span className='mt-1 block text-xs text-gray-500'>Contact your technical team to change login email or password.</span>
            </label>

            <label className='block text-sm font-medium text-gray-700 sm:col-span-2'>
              Mobile number
              <div className='mt-1 flex overflow-hidden rounded-xl border border-gray-200 bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20'>
                <span className='flex shrink-0 items-center border-r border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-600'>
                  {EGYPT_DIAL_CODE}
                </span>
                <input
                  value={form.phoneLocal}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, phoneLocal: parseEgyptLocalDigits(e.target.value) }))
                  }
                  disabled={!isEdit}
                  placeholder='10 digits'
                  className='min-w-0 flex-1 px-3 py-2.5 text-sm outline-none disabled:bg-gray-50'
                  inputMode='numeric'
                />
              </div>
            </label>

            <label className='block text-sm font-medium text-gray-700 sm:col-span-2'>
              Short bio
              <textarea
                value={form.bio}
                onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
                disabled={!isEdit}
                rows={3}
                maxLength={500}
                placeholder='Optional note about your role'
                className='mt-1 w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-gray-50'
              />
            </label>
          </div>

          <Link
            to='/security-settings'
            className='mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80'
          >
            <ShieldCheck className='h-4 w-4' />
            Open security & MFA policies
          </Link>
        </div>

        <div className='rounded-2xl border border-blue-100 bg-blue-50/80 p-5 shadow-sm sm:p-6'>
          <p className='flex items-center gap-2 text-base font-bold text-slate-900'>
            <ShieldCheck className='h-5 w-5 text-blue-700' />
            Authenticator MFA (your account)
          </p>
          <p className='mt-1 text-sm text-slate-600'>
            Status:{' '}
            <span className='font-semibold text-slate-900'>
              {mfaStatus?.enabled ? 'Enabled' : 'Not enabled'}
            </span>
            {mfaStatus?.required && (
              <span className='ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800'>
                Required by policy
              </span>
            )}
          </p>

          {mfaSetup ? (
            <div className='mt-4 space-y-3 rounded-xl bg-white p-4 shadow-inner'>
              <MfaSetupBox mode='setup' setup={mfaSetup} />
              <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
                <input
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder='6-digit code'
                  className='rounded-xl border border-slate-200 px-3 py-2 text-center font-semibold tracking-[0.35em] sm:max-w-[12rem]'
                  inputMode='numeric'
                  autoComplete='one-time-code'
                />
                <button
                  type='button'
                  onClick={enableMfa}
                  className='rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700'
                >
                  Verify and enable
                </button>
                <button
                  type='button'
                  onClick={() => {
                    setMfaSetup(null)
                    setMfaCode('')
                  }}
                  className='rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50'
                >
                  Cancel setup
                </button>
              </div>
            </div>
          ) : (
            <div className='mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap'>
              {!mfaStatus?.enabled && (
                <button
                  type='button'
                  onClick={startMfaSetup}
                  className='inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700'
                >
                  <KeyRound className='h-4 w-4' />
                  Set up MFA
                </button>
              )}
              {mfaStatus?.enabled && !mfaStatus?.required && (
                <div className='flex w-full flex-col gap-2 sm:flex-row sm:items-center'>
                  <input
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder='Code to disable'
                    className='rounded-xl border border-slate-200 px-3 py-2 text-center font-semibold tracking-[0.35em] sm:max-w-[12rem]'
                    inputMode='numeric'
                  />
                  <button
                    type='button'
                    onClick={disableMfa}
                    className='rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50'
                  >
                    Disable MFA
                  </button>
                </div>
              )}
              {mfaStatus?.enabled && mfaStatus?.required && (
                <p className='text-sm text-blue-900'>
                  MFA is required for admins. You cannot turn it off while the policy is active.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminProfile
