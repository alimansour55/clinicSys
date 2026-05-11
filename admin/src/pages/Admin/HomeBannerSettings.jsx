import React, { useContext, useEffect, useState } from 'react'
import { AdminContext } from '../../context/AdminContext'
import { CalendarDays, ImagePlus, Loader2, Save, Settings2, ToggleLeft, Upload, UserRound } from 'lucide-react'

const defaults = {
  title: 'Book Appointment\nWith 100+ Trusted Doctors',
  backgroundColor: '#169b8a',
  showImage: true,
  showAppointmentsButton: true,
  appointmentsButtonText: 'My appointments',
  showProfileButton: true,
  profileButtonText: 'My profile'
}

const ToggleRow = ({ checked, onChange, label, description }) => (
  <label className='flex items-start justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4 cursor-pointer hover:bg-gray-50 transition'>
    <span>
      <span className='block text-sm font-semibold text-gray-900'>{label}</span>
      <span className='block text-xs text-gray-500 mt-1'>{description}</span>
    </span>
    <input
      type='checkbox'
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className='mt-1 h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary'
    />
  </label>
)

const HomeBannerSettings = () => {
  const { aToken, siteSettings, getSiteSettings, updateHomeBannerSettings } = useContext(AdminContext)
  const [form, setForm] = useState(defaults)
  const [bannerImage, setBannerImage] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (aToken) getSiteSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aToken])

  useEffect(() => {
    if (siteSettings?.homeBanner) {
      const savedBanner = siteSettings.homeBanner
      const fallbackTitle = [savedBanner.titleLineOne, savedBanner.titleLineTwo].filter(Boolean).join('\n')
      setForm({ ...defaults, ...savedBanner, title: savedBanner.title || fallbackTitle || defaults.title })
    }
  }, [siteSettings])

  const updateField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)

    const formData = new FormData()
    Object.entries(form).forEach(([key, value]) => formData.append(key, value))
    if (bannerImage) formData.append('bannerImage', bannerImage)

    const success = await updateHomeBannerSettings(formData)
    if (success) setBannerImage(null)
    setSaving(false)
  }

  const imagePreview = bannerImage ? URL.createObjectURL(bannerImage) : siteSettings?.homeBanner?.bannerImage
  const titleLines = form.title.split('\n').filter(Boolean)

  return (
    <div className='min-h-screen bg-gray-50 p-3 sm:p-5 md:p-6 lg:p-8'>
      <div className='max-w-6xl'>
        <div className='mb-6'>
          <h1 className='text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2'>
            <ImagePlus className='w-6 h-6 text-primary' />
            Home Banner Settings
          </h1>
          <p className='mt-2 text-sm text-gray-600 ml-8'>
            Control the appointment banner shown below the doctors section on the patient website.
          </p>
        </div>

        <form onSubmit={handleSubmit} className='grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-5'>
          <div className='space-y-5'>
            <div className='bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm'>
              <h2 className='text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2'>
                <Settings2 className='w-5 h-5 text-primary' />
                Text Content
              </h2>

              <div>
                <label className='block text-sm font-semibold text-gray-700 mb-2'>Headline</label>
                <textarea
                  value={form.title}
                  onChange={(event) => updateField('title', event.target.value)}
                  rows={3}
                  className='w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary resize-none'
                  required
                />
              </div>

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4'>
                <div>
                  <label className='block text-sm font-semibold text-gray-700 mb-2'>Appointments button text</label>
                  <input value={form.appointmentsButtonText} onChange={(event) => updateField('appointmentsButtonText', event.target.value)} className='w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary' />
                </div>
                <div>
                  <label className='block text-sm font-semibold text-gray-700 mb-2'>Profile button text</label>
                  <input value={form.profileButtonText} onChange={(event) => updateField('profileButtonText', event.target.value)} className='w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary' />
                </div>
              </div>
            </div>

            <div className='bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm'>
              <h2 className='text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2'>
                <Upload className='w-5 h-5 text-primary' />
                Image and Style
              </h2>

              <div>
                <label className='block text-sm font-semibold text-gray-700 mb-2'>Doctor banner image</label>
                <label className='flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4 text-center hover:border-primary hover:bg-primary/5 transition'>
                  {imagePreview ? (
                    <img src={imagePreview} alt='Banner preview' className='h-44 w-full object-contain' />
                  ) : (
                    <span className='flex flex-col items-center gap-2 text-sm text-gray-500'>
                      <Upload className='w-6 h-6 text-primary' />
                      Upload the right-side doctor image
                    </span>
                  )}
                  <input type='file' accept='image/*' hidden onChange={(event) => setBannerImage(event.target.files[0] || null)} />
                </label>
              </div>

              <div className='mt-4'>
                <label className='block text-sm font-semibold text-gray-700 mb-2'>Background color</label>
                <div className='flex items-center gap-3'>
                  <input type='color' value={form.backgroundColor} onChange={(event) => updateField('backgroundColor', event.target.value)} className='h-11 w-16 rounded border border-gray-300 bg-white p-1' />
                  <input value={form.backgroundColor} onChange={(event) => updateField('backgroundColor', event.target.value)} className='w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary' />
                </div>
              </div>
            </div>

            <div className='bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm'>
              <h2 className='text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2'>
                <ToggleLeft className='w-5 h-5 text-primary' />
                Visibility
              </h2>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                <ToggleRow checked={form.showImage} onChange={(value) => updateField('showImage', value)} label='Doctor image' description='Show the right-side image.' />
                <ToggleRow checked={form.showAppointmentsButton} onChange={(value) => updateField('showAppointmentsButton', value)} label='Appointments button' description='Show for signed-in patients.' />
                <ToggleRow checked={form.showProfileButton} onChange={(value) => updateField('showProfileButton', value)} label='Profile button' description='Show for signed-in patients.' />
              </div>
            </div>
          </div>

          <div className='bg-white border border-gray-200 rounded-xl shadow-sm h-fit xl:sticky xl:top-5 overflow-hidden'>
            <div className='p-4 sm:p-5 border-b border-gray-100'>
              <h2 className='text-base sm:text-lg font-semibold text-gray-900'>Live Preview</h2>
              <p className='text-sm text-gray-500 mt-1'>Approximate homepage banner.</p>
            </div>

            <div className='p-4'>
              <div className='rounded-lg overflow-hidden text-white p-5 min-h-72 flex items-center justify-between gap-4' style={{ backgroundColor: form.backgroundColor }}>
                <div className='min-w-0'>
                  {titleLines.map((line, index) => (
                    <p key={`${line}-${index}`} className={`text-3xl font-bold leading-tight ${index > 0 ? 'mt-2' : ''}`}>{line}</p>
                  ))}
                  <div className='mt-5 flex flex-wrap gap-2'>
                    {form.showAppointmentsButton && <span className='inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-600'><CalendarDays className='w-4 h-4' />{form.appointmentsButtonText}</span>}
                    {form.showProfileButton && <span className='inline-flex items-center gap-2 rounded-full border border-white/70 px-4 py-2 text-sm font-semibold text-white'><UserRound className='w-4 h-4' />{form.profileButtonText}</span>}
                  </div>
                </div>
                {form.showImage && imagePreview && <img src={imagePreview} alt='' className='max-h-56 w-32 object-contain self-end' />}
              </div>

              <button type='submit' disabled={saving} className='mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90 disabled:bg-gray-300 transition'>
                {saving ? <Loader2 className='w-4 h-4 animate-spin' /> : <Save className='w-4 h-4' />}
                Save Home Banner
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default HomeBannerSettings
