import React, { useContext, useEffect, useState } from 'react'
import { AdminContext } from '../../context/AdminContext'
import { assets } from '../../assets/assets'
import { Image as ImageIcon, Loader2, RotateCcw, Save, Sparkles } from 'lucide-react'
import { patientHeaderLogoClassName } from '../../utils/brandingLogo'
import { DEFAULT_APP_DISPLAY_NAME } from '../../utils/appDisplayName'

const LogoSettings = () => {
  const { aToken, siteSettings, getSiteSettings, updateBrandingSettings } = useContext(AdminContext)
  const [altText, setAltText] = useState(DEFAULT_APP_DISPLAY_NAME)
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (aToken) getSiteSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aToken])

  useEffect(() => {
    if (siteSettings?.branding?.altText) {
      setAltText(siteSettings.branding.altText)
    }
  }, [siteSettings?.branding?.altText])

  const customUrl = siteSettings?.branding?.headerLogoUrl
  const previewSrc = file ? URL.createObjectURL(file) : customUrl || assets.site_default_logo

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    let ok
    if (file) {
      const formData = new FormData()
      formData.append('altText', altText)
      formData.append('headerLogo', file)
      ok = await updateBrandingSettings(formData)
    } else {
      ok = await updateBrandingSettings({ altText })
    }
    if (ok) setFile(null)
    setSaving(false)
  }

  const handleResetToDefault = async () => {
    const confirmed = window.confirm('Remove the custom logo everywhere and restore the default mark?')
    if (!confirmed) return
    setSaving(true)
    await updateBrandingSettings({
      altText,
      clearHeaderLogo: true
    })
    setFile(null)
    setSaving(false)
  }

  return (
    <div className='min-h-screen bg-gray-50 p-3 sm:p-5 md:p-6 lg:p-8'>
      <div className='max-w-3xl'>
        <div className='mb-6'>
          <h1 className='text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2'>
            <Sparkles className='w-6 h-6 text-primary' />
            Site logo
          </h1>
          <p className='mt-2 text-sm text-gray-600 ml-8'>
            Upload your logo for the patient website, staff portal header, and sign-in screen. Size on the site is fixed for a consistent layout. Use <strong>Save logo</strong> after choosing a file.
          </p>
        </div>

        <form onSubmit={handleSubmit} className='space-y-6'>
          <div className='bg-white border border-gray-200 rounded-xl p-5 shadow-sm'>
            <h2 className='text-base font-semibold text-gray-900 mb-4 flex items-center gap-2'>
              <ImageIcon className='w-5 h-5 text-primary' />
              Preview (same size as patient header)
            </h2>
            <div className='rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-inner'>
              <div className='flex min-h-[3.5rem] items-center border-b border-gray-100 bg-gray-50/80'>
                <img
                  src={previewSrc}
                  alt={altText || 'Site logo'}
                  className={patientHeaderLogoClassName}
                />
              </div>
              <p className='mt-3 text-xs text-gray-500'>
                {customUrl || file ? 'Custom logo' : 'Default logo (shown when no custom image is saved)'}
              </p>
            </div>
          </div>

          <div className='bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-5'>
            <div>
              <label className='block text-sm font-semibold text-gray-700 mb-2'>Logo image</label>
              <input
                type='file'
                accept='image/png,image/jpeg,image/webp,image/svg+xml'
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className='block w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-primary/90'
              />
              <p className='mt-2 text-xs text-gray-500'>PNG, JPG, WebP, or SVG. Prefer a horizontal mark with clear margins.</p>
            </div>

            <div>
              <label className='block text-sm font-semibold text-gray-700 mb-2'>Alt text (accessibility)</label>
              <input
                type='text'
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                className='w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary'
                placeholder={DEFAULT_APP_DISPLAY_NAME}
              />
            </div>
          </div>

          <div className='flex flex-wrap items-center gap-3'>
            <button
              type='submit'
              disabled={saving}
              className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50'
            >
              {saving ? <Loader2 className='w-4 h-4 animate-spin' /> : <Save className='w-4 h-4' />}
              {saving ? 'Saving…' : 'Save logo'}
            </button>
            <button
              type='button'
              disabled={saving || (!customUrl && !file)}
              onClick={handleResetToDefault}
              className='inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50'
            >
              <RotateCcw className='w-4 h-4' />
              Use default logo
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default LogoSettings
