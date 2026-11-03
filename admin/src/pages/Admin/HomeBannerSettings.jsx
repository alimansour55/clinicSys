import React, { useContext, useEffect, useState } from 'react'
import { CalendarDays, ImagePlus, Save, Settings2, ToggleLeft, Upload, UserRound } from 'lucide-react'
import { AdminContext } from '../../context/AdminContext'
import { useLanguage } from '../../i18n'
import BilingualField from '../../components/BilingualField'
import { AdminPage } from '../../components/admin/AdminPage'
import { ColorField, FormSection, ImagePicker, LivePreview, ToggleRow, useFilePreview } from '../../components/admin/SiteContentForm'
import { Button } from '../../components/ui'
import { appendBilingualGroup, bilingualGroupFromRecord, bilingualText } from '../../utils/bilingualValue'

const TEXT_FIELDS = ['title', 'appointmentsButtonText', 'profileButtonText']

const defaults = {
  title: 'Book Appointment\nWith 100+ Trusted Doctors',
  appointmentsButtonText: 'My appointments',
  profileButtonText: 'My profile'
}

const defaultOptions = { backgroundColor: '#169b8a', showImage: true, showAppointmentsButton: true, showProfileButton: true }

const HomeBannerSettings = () => {
  const { aToken, siteSettings, getSiteSettings, updateHomeBannerSettings, translatePreview } = useContext(AdminContext)
  const { t, language } = useLanguage()
  const [text, setText] = useState(() => bilingualGroupFromRecord(defaults, TEXT_FIELDS))
  const [options, setOptions] = useState(defaultOptions)
  const [bannerImage, setBannerImage] = useState(null)
  const [saving, setSaving] = useState(false)
  const [previewLanguage, setPreviewLanguage] = useState(language)

  useEffect(() => {
    if (aToken) getSiteSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aToken])

  const savedBanner = siteSettings?.homeBanner
  useEffect(() => {
    if (!savedBanner) return
    const fallbackTitle = [savedBanner.titleLineOne, savedBanner.titleLineTwo].filter(Boolean).join('\n')
    setText(bilingualGroupFromRecord({ ...defaults, ...savedBanner, title: savedBanner.title || fallbackTitle || defaults.title }, TEXT_FIELDS))
    setOptions({ ...defaultOptions, ...savedBanner })
  }, [savedBanner])

  const setField = (field) => (value) => setText((previous) => ({ ...previous, [field]: value }))
  const setOption = (field) => (value) => setOptions((previous) => ({ ...previous, [field]: value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    const formData = new FormData()
    appendBilingualGroup(formData, text)
    formData.append('backgroundColor', options.backgroundColor)
    ;['showImage', 'showAppointmentsButton', 'showProfileButton'].forEach((key) => formData.append(key, options[key]))
    if (bannerImage) formData.append('bannerImage', bannerImage)

    const success = await updateHomeBannerSettings(formData)
    if (success) setBannerImage(null)
    setSaving(false)
  }

  const imagePreview = useFilePreview(bannerImage, savedBanner?.bannerImage)
  const shown = (field) => bilingualText(text[field], previewLanguage)
  const titleLines = shown('title').split('\n').filter(Boolean)

  return (
    <AdminPage icon={ImagePlus} title={t('Home Banner Settings')} description={t('Control the appointment banner shown below the doctors section on the patient website.')}>
      <form onSubmit={handleSubmit} className='grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_400px]'>
        <div className='min-w-0 space-y-5'>
          <FormSection title={t('Text Content')} icon={Settings2}>
            <BilingualField label={t('Headline')} value={text.title} onChange={setField('title')} translate={translatePreview} multiline required hint={t('Each new line starts a new line on the banner.')} />
            <BilingualField label={t('Appointments button text')} value={text.appointmentsButtonText} onChange={setField('appointmentsButtonText')} translate={translatePreview} />
            <BilingualField label={t('Profile button text')} value={text.profileButtonText} onChange={setField('profileButtonText')} translate={translatePreview} />
          </FormSection>

          <FormSection title={t('Image and Style')} icon={Upload}>
            <ImagePicker label={t('Doctor banner image')} preview={imagePreview} onPick={setBannerImage} hint={t('Upload the doctor image shown beside the headline')} imageClassName='h-44' />
            <ColorField label={t('Background color')} value={options.backgroundColor} onChange={setOption('backgroundColor')} />
          </FormSection>

          <FormSection title={t('Visibility')} icon={ToggleLeft}>
            <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
              <ToggleRow checked={options.showImage} onChange={setOption('showImage')} label={t('Doctor image')} description={t('Show the image beside the headline.')} />
              <ToggleRow checked={options.showAppointmentsButton} onChange={setOption('showAppointmentsButton')} label={t('Appointments button')} description={t('Show for signed-in patients.')} />
              <ToggleRow checked={options.showProfileButton} onChange={setOption('showProfileButton')} label={t('Profile button')} description={t('Show for signed-in patients.')} />
            </div>
          </FormSection>
        </div>

        <LivePreview
          description={t('Approximate homepage banner.')}
          language={previewLanguage}
          onLanguage={setPreviewLanguage}
          footer={
            <Button type='submit' fullWidth loading={saving} leadingIcon={<Save aria-hidden='true' className='size-4' />}>
              {t('Save Home Banner')}
            </Button>
          }
        >
          <div className='flex min-h-64 items-center justify-between gap-4 overflow-hidden rounded-card p-5 text-white' style={{ backgroundColor: options.backgroundColor }}>
            <div className='min-w-0'>
              {titleLines.map((line, index) => (
                <p key={`${line}-${index}`} className={`text-2xl font-bold leading-tight ${index > 0 ? 'mt-2' : ''}`}>
                  {line}
                </p>
              ))}
              <div className='mt-5 flex flex-wrap gap-2'>
                {options.showAppointmentsButton && (
                  <span className='inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-gray-600'>
                    <CalendarDays aria-hidden='true' className='size-4' />
                    {shown('appointmentsButtonText')}
                  </span>
                )}
                {options.showProfileButton && (
                  <span className='inline-flex items-center gap-2 rounded-full border border-white/70 px-3 py-1.5 text-sm font-semibold'>
                    <UserRound aria-hidden='true' className='size-4' />
                    {shown('profileButtonText')}
                  </span>
                )}
              </div>
            </div>
            {options.showImage && imagePreview && <img src={imagePreview} alt='' className='max-h-56 w-28 self-end object-contain' />}
          </div>
        </LivePreview>
      </form>
    </AdminPage>
  )
}

export default HomeBannerSettings
