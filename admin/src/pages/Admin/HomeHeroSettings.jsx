import React, { useContext, useEffect, useState } from 'react'
import { AdminContext } from '../../context/AdminContext'
import { ImagePlus, LayoutTemplate, Loader2, Save, Settings2, ToggleLeft, Upload } from 'lucide-react'

const defaults = {
  title: 'Book Appointment With Trusted Doctors',
  subtitle: 'Simply browse through our extensive list of trusted doctors, schedule your appointment hassle-free.',
  backgroundColor: '#169b8a',
  showGroupImage: true,
  showBookButton: true,
  bookButtonText: 'Book appointment',
  showAppointmentsButton: true,
  appointmentsButtonText: 'My appointments'
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

const HomeHeroSettings = () => {
  const { aToken, siteSettings, getSiteSettings, updateHomeHeroSettings } = useContext(AdminContext)
  const [form, setForm] = useState(defaults)
  const [heroImage, setHeroImage] = useState(null)
  const [groupImage, setGroupImage] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (aToken) getSiteSettings()
    // Context methods are recreated on render in this app; depend on the token to match existing admin pages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aToken])

  useEffect(() => {
    if (siteSettings?.homeHero) {
      setForm({ ...defaults, ...siteSettings.homeHero })
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
    if (heroImage) formData.append('heroImage', heroImage)
    if (groupImage) formData.append('groupImage', groupImage)

    const success = await updateHomeHeroSettings(formData)
    if (success) {
      setHeroImage(null)
      setGroupImage(null)
    }

    setSaving(false)
  }

  const heroPreview = heroImage ? URL.createObjectURL(heroImage) : siteSettings?.homeHero?.heroImage
  const groupPreview = groupImage ? URL.createObjectURL(groupImage) : siteSettings?.homeHero?.groupImage

  return (
    <div className='min-h-screen bg-gray-50 p-3 sm:p-5 md:p-6 lg:p-8'>
      <div className='max-w-6xl'>
        <div className='mb-6'>
          <h1 className='text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2'>
            <LayoutTemplate className='w-6 h-6 text-primary' />
            Home Hero Settings
          </h1>
          <p className='mt-2 text-sm text-gray-600 ml-8'>
            Control the main appointment banner shown on the patient website.
          </p>
        </div>

        <form onSubmit={handleSubmit} className='grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-5'>
          <div className='space-y-5'>
            <div className='bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm'>
              <h2 className='text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2'>
                <Settings2 className='w-5 h-5 text-primary' />
                Text Content
              </h2>

              <div className='space-y-4'>
                <div>
                  <label className='block text-sm font-semibold text-gray-700 mb-2'>Headline</label>
                  <textarea
                    value={form.title}
                    onChange={(event) => updateField('title', event.target.value)}
                    rows={2}
                    className='w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary resize-none'
                    required
                  />
                </div>

                <div>
                  <label className='block text-sm font-semibold text-gray-700 mb-2'>Supporting text</label>
                  <textarea
                    value={form.subtitle}
                    onChange={(event) => updateField('subtitle', event.target.value)}
                    rows={3}
                    className='w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary resize-none'
                    required
                  />
                </div>

                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                  <div>
                    <label className='block text-sm font-semibold text-gray-700 mb-2'>Book button text</label>
                    <input
                      value={form.bookButtonText}
                      onChange={(event) => updateField('bookButtonText', event.target.value)}
                      className='w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary'
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-semibold text-gray-700 mb-2'>Appointments button text</label>
                    <input
                      value={form.appointmentsButtonText}
                      onChange={(event) => updateField('appointmentsButtonText', event.target.value)}
                      className='w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary'
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className='bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm'>
              <h2 className='text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2'>
                <ImagePlus className='w-5 h-5 text-primary' />
                Images and Style
              </h2>

              <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-semibold text-gray-700 mb-2'>Doctors photo</label>
                  <label className='flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4 text-center hover:border-primary hover:bg-primary/5 transition'>
                    {heroPreview ? (
                      <img src={heroPreview} alt='Hero preview' className='h-36 w-full object-contain' />
                    ) : (
                      <span className='flex flex-col items-center gap-2 text-sm text-gray-500'>
                        <Upload className='w-6 h-6 text-primary' />
                        Upload main hero image
                      </span>
                    )}
                    <input type='file' accept='image/*' hidden onChange={(event) => setHeroImage(event.target.files[0] || null)} />
                  </label>
                </div>

                <div>
                  <label className='block text-sm font-semibold text-gray-700 mb-2'>Small profile group photo</label>
                  <label className='flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4 text-center hover:border-primary hover:bg-primary/5 transition'>
                    {groupPreview ? (
                      <img src={groupPreview} alt='Group preview' className='h-24 w-full object-contain' />
                    ) : (
                      <span className='flex flex-col items-center gap-2 text-sm text-gray-500'>
                        <Upload className='w-6 h-6 text-primary' />
                        Upload profile group image
                      </span>
                    )}
                    <input type='file' accept='image/*' hidden onChange={(event) => setGroupImage(event.target.files[0] || null)} />
                  </label>
                </div>
              </div>

              <div className='mt-4'>
                <label className='block text-sm font-semibold text-gray-700 mb-2'>Background color</label>
                <div className='flex items-center gap-3'>
                  <input
                    type='color'
                    value={form.backgroundColor}
                    onChange={(event) => updateField('backgroundColor', event.target.value)}
                    className='h-11 w-16 rounded border border-gray-300 bg-white p-1'
                  />
                  <input
                    value={form.backgroundColor}
                    onChange={(event) => updateField('backgroundColor', event.target.value)}
                    className='w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary'
                  />
                </div>
              </div>
            </div>

            <div className='bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm'>
              <h2 className='text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2'>
                <ToggleLeft className='w-5 h-5 text-primary' />
                Visibility
              </h2>
              <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
                <ToggleRow checked={form.showGroupImage} onChange={(value) => updateField('showGroupImage', value)} label='Profile group image' description='Show the small round patient photos.' />
                <ToggleRow checked={form.showBookButton} onChange={(value) => updateField('showBookButton', value)} label='Book button' description='Show the call-to-action button.' />
                <ToggleRow checked={form.showAppointmentsButton} onChange={(value) => updateField('showAppointmentsButton', value)} label='Appointments button' description='Show this button for signed-in patients.' />
              </div>
            </div>
          </div>

          <div className='bg-white border border-gray-200 rounded-xl shadow-sm h-fit xl:sticky xl:top-5 overflow-hidden'>
            <div className='p-4 sm:p-5 border-b border-gray-100'>
              <h2 className='text-base sm:text-lg font-semibold text-gray-900'>Live Preview</h2>
              <p className='text-sm text-gray-500 mt-1'>Approximate patient homepage banner.</p>
            </div>

            <div className='p-4'>
              <div className='rounded-lg overflow-hidden text-white p-5 min-h-80 flex flex-col justify-between' style={{ backgroundColor: form.backgroundColor }}>
                <div>
                  <p className='text-3xl font-bold leading-tight'>{form.title}</p>
                  <div className='mt-4 flex items-center gap-3 text-sm'>
                    {form.showGroupImage && (
                      groupPreview ? <img src={groupPreview} alt='' className='w-20 object-contain' /> : <span className='h-10 w-20 rounded-full bg-white/25' />
                    )}
                    <p>{form.subtitle}</p>
                  </div>
                </div>
                {heroPreview && <img src={heroPreview} alt='' className='mt-4 max-h-44 object-contain self-end' />}
              </div>

              <button
                type='submit'
                disabled={saving}
                className='mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90 disabled:bg-gray-300 transition'
              >
                {saving ? <Loader2 className='w-4 h-4 animate-spin' /> : <Save className='w-4 h-4' />}
                Save Home Hero
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default HomeHeroSettings
