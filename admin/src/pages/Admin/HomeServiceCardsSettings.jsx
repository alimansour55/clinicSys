import React, { useContext, useEffect, useState } from 'react'
import { AdminContext } from '../../context/AdminContext'
import { Home, Loader2, Save, Upload, Video } from 'lucide-react'

const defaults = {
  teleconsultationTitle: 'Teleconsultation',
  teleconsultationDescription: 'Schedule a voice or video call with a specialist doctor.',
  teleconsultationButtonText: 'Book',
  showTeleconsultation: true,
  homeVisitTitle: 'Home Visit',
  homeVisitDescription: 'Book a doctor visit at your home in supported Cairo and Giza areas.',
  homeVisitButtonText: 'Book',
  showHomeVisit: true
}

const CardEditor = ({ title, icon: Icon, imagePreview, fileSetter, fields, form, updateField }) => (
  <div className='rounded-xl border border-gray-200 bg-white p-5 shadow-sm'>
    <h2 className='mb-4 flex items-center gap-2 text-lg font-bold text-gray-900'>
      <Icon className='h-5 w-5 text-primary' />
      {title}
    </h2>
    <div className='grid grid-cols-1 gap-4 lg:grid-cols-[180px_1fr]'>
      <label className='flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-3 text-center hover:border-primary'>
        {imagePreview ? <img src={imagePreview} alt='' className='h-32 w-full rounded-lg object-cover' /> : <span className='flex flex-col items-center gap-2 text-sm text-gray-500'><Upload className='h-5 w-5 text-primary' />Upload photo</span>}
        <input type='file' accept='image/*' hidden onChange={(event) => fileSetter(event.target.files?.[0] || null)} />
      </label>
      <div className='space-y-3'>
        <input value={form[fields.title]} onChange={(event) => updateField(fields.title, event.target.value)} className='w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary' placeholder='Section name' />
        <textarea value={form[fields.description]} onChange={(event) => updateField(fields.description, event.target.value)} rows={3} className='w-full resize-none rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary' placeholder='Description' />
        <input value={form[fields.button]} onChange={(event) => updateField(fields.button, event.target.value)} className='w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary' placeholder='Button text' />
        <label className='flex items-center gap-2 text-sm font-semibold text-gray-700'>
          <input type='checkbox' checked={form[fields.visible]} onChange={(event) => updateField(fields.visible, event.target.checked)} className='accent-primary' />
          Visible on patient homepage
        </label>
      </div>
    </div>
  </div>
)

const HomeServiceCardsSettings = () => {
  const { aToken, siteSettings, getSiteSettings, updateHomeServiceCardsSettings } = useContext(AdminContext)
  const [form, setForm] = useState(defaults)
  const [teleconsultationImage, setTeleconsultationImage] = useState(null)
  const [homeVisitImage, setHomeVisitImage] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (aToken) getSiteSettings()
  }, [aToken])

  useEffect(() => {
    if (siteSettings?.homeServiceCards) setForm({ ...defaults, ...siteSettings.homeServiceCards })
  }, [siteSettings])

  const updateField = (field, value) => setForm((previous) => ({ ...previous, [field]: value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    const formData = new FormData()
    Object.entries(form).forEach(([key, value]) => formData.append(key, value))
    if (teleconsultationImage) formData.append('teleconsultationImage', teleconsultationImage)
    if (homeVisitImage) formData.append('homeVisitImage', homeVisitImage)
    const saved = await updateHomeServiceCardsSettings(formData)
    if (saved) {
      setTeleconsultationImage(null)
      setHomeVisitImage(null)
    }
    setSaving(false)
  }

  const telePreview = teleconsultationImage ? URL.createObjectURL(teleconsultationImage) : siteSettings?.homeServiceCards?.teleconsultationImage
  const homePreview = homeVisitImage ? URL.createObjectURL(homeVisitImage) : siteSettings?.homeServiceCards?.homeVisitImage

  return (
    <div className='min-h-screen bg-gray-50 p-3 sm:p-5 md:p-6 lg:p-8'>
      <div className='max-w-5xl'>
        <div className='mb-6'>
          <h1 className='text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900'>Home Service Cards</h1>
          <p className='mt-2 text-sm text-gray-600'>Control the Teleconsultation and Home Visit cards under Find by Speciality.</p>
        </div>
        <form onSubmit={handleSubmit} className='space-y-5'>
          <CardEditor title='Teleconsultation' icon={Video} imagePreview={telePreview} fileSetter={setTeleconsultationImage} fields={{ title: 'teleconsultationTitle', description: 'teleconsultationDescription', button: 'teleconsultationButtonText', visible: 'showTeleconsultation' }} form={form} updateField={updateField} />
          <CardEditor title='Home Visit' icon={Home} imagePreview={homePreview} fileSetter={setHomeVisitImage} fields={{ title: 'homeVisitTitle', description: 'homeVisitDescription', button: 'homeVisitButtonText', visible: 'showHomeVisit' }} form={form} updateField={updateField} />
          <button disabled={saving} className='inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white disabled:bg-gray-300'>
            {saving ? <Loader2 className='h-4 w-4 animate-spin' /> : <Save className='h-4 w-4' />}
            Save service cards
          </button>
        </form>
      </div>
    </div>
  )
}

export default HomeServiceCardsSettings
