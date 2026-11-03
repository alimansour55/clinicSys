import React, { useContext, useEffect, useState } from 'react'
import { ImagePlus, LayoutTemplate, Save, Settings2, ToggleLeft } from 'lucide-react'
import { AdminContext } from '../../context/AdminContext'
import { useLanguage } from '../../i18n'
import BilingualField from '../../components/BilingualField'
import { AdminPage } from '../../components/admin/AdminPage'
import { ColorField, FormSection, ImagePicker, LivePreview, ToggleRow, useFilePreview } from '../../components/admin/SiteContentForm'
import { Button } from '../../components/ui'
import { appendBilingualGroup, bilingualGroupFromRecord, bilingualText } from '../../utils/bilingualValue'

const TEXT_FIELDS = ['title', 'subtitle', 'bookButtonText', 'appointmentsButtonText']

const defaults = {
  title: 'Book Appointment With Trusted Doctors',
  subtitle: 'Simply browse through our extensive list of trusted doctors, schedule your appointment hassle-free.',
  bookButtonText: 'Book appointment',
  appointmentsButtonText: 'My appointments'
}

const defaultOptions = { backgroundColor: '#169b8a', showGroupImage: true, showBookButton: true, showAppointmentsButton: true }

const HomeHeroSettings = () => {
  const { aToken, siteSettings, getSiteSettings, updateHomeHeroSettings, translatePreview } = useContext(AdminContext)
  const { t, language } = useLanguage()
  const [text, setText] = useState(() => bilingualGroupFromRecord(defaults, TEXT_FIELDS))
  const [options, setOptions] = useState(defaultOptions)
  const [heroImage, setHeroImage] = useState(null)
  const [groupImage, setGroupImage] = useState(null)
  const [saving, setSaving] = useState(false)
  const [previewLanguage, setPreviewLanguage] = useState(language)

  useEffect(() => {
    if (aToken) getSiteSettings()
    // Context methods are recreated on render in this app; depend on the token to match existing admin pages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aToken])

  const savedHero = siteSettings?.homeHero
  useEffect(() => {
    if (!savedHero) return
    setText(bilingualGroupFromRecord({ ...defaults, ...savedHero }, TEXT_FIELDS))
    setOptions({ ...defaultOptions, ...savedHero })
  }, [savedHero])

  const setField = (field) => (value) => setText((previous) => ({ ...previous, [field]: value }))
  const setOption = (field) => (value) => setOptions((previous) => ({ ...previous, [field]: value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    const formData = new FormData()
    appendBilingualGroup(formData, text)
    formData.append('backgroundColor', options.backgroundColor)
    ;['showGroupImage', 'showBookButton', 'showAppointmentsButton'].forEach((key) => formData.append(key, options[key]))
    if (heroImage) formData.append('heroImage', heroImage)
    if (groupImage) formData.append('groupImage', groupImage)

    const success = await updateHomeHeroSettings(formData)
    if (success) {
      setHeroImage(null)
      setGroupImage(null)
    }
    setSaving(false)
  }

  const heroPreview = useFilePreview(heroImage, savedHero?.heroImage)
  const groupPreview = useFilePreview(groupImage, savedHero?.groupImage)
  const shown = (field) => bilingualText(text[field], previewLanguage)

  return (
    <AdminPage icon={LayoutTemplate} title={t('Home Hero Settings')} description={t('Control the main appointment banner shown on the patient website.')}>
      <form onSubmit={handleSubmit} className='grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_400px]'>
        <div className='min-w-0 space-y-5'>
          <FormSection title={t('Text Content')} icon={Settings2}>
            <BilingualField label={t('Headline')} value={text.title} onChange={setField('title')} translate={translatePreview} multiline required />
            <BilingualField label={t('Supporting text')} value={text.subtitle} onChange={setField('subtitle')} translate={translatePreview} multiline required />
            <BilingualField label={t('Book button text')} value={text.bookButtonText} onChange={setField('bookButtonText')} translate={translatePreview} />
            <BilingualField label={t('Appointments button text')} value={text.appointmentsButtonText} onChange={setField('appointmentsButtonText')} translate={translatePreview} />
          </FormSection>

          <FormSection title={t('Images and Style')} icon={ImagePlus}>
            <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
              <ImagePicker label={t('Doctors photo')} preview={heroPreview} onPick={setHeroImage} hint={t('Upload main hero image')} />
              <ImagePicker label={t('Small profile group photo')} preview={groupPreview} onPick={setGroupImage} hint={t('Upload profile group image')} imageClassName='h-24' />
            </div>
            <ColorField label={t('Background color')} value={options.backgroundColor} onChange={setOption('backgroundColor')} />
          </FormSection>

          <FormSection title={t('Visibility')} icon={ToggleLeft}>
            <div className='grid grid-cols-1 gap-3 md:grid-cols-3'>
              <ToggleRow checked={options.showGroupImage} onChange={setOption('showGroupImage')} label={t('Profile group image')} description={t('Show the small round patient photos.')} />
              <ToggleRow checked={options.showBookButton} onChange={setOption('showBookButton')} label={t('Book button')} description={t('Show the call-to-action button.')} />
              <ToggleRow checked={options.showAppointmentsButton} onChange={setOption('showAppointmentsButton')} label={t('Appointments button')} description={t('Show this button for signed-in patients.')} />
            </div>
          </FormSection>
        </div>

        <LivePreview
          description={t('Approximate patient homepage banner.')}
          language={previewLanguage}
          onLanguage={setPreviewLanguage}
          footer={
            <Button type='submit' fullWidth loading={saving} leadingIcon={<Save aria-hidden='true' className='size-4' />}>
              {t('Save Home Hero')}
            </Button>
          }
        >
          <div className='flex min-h-72 flex-col justify-between overflow-hidden rounded-card p-5 text-white' style={{ backgroundColor: options.backgroundColor }}>
            <div>
              <p className='text-3xl font-bold leading-tight'>{shown('title')}</p>
              <div className='mt-4 flex items-center gap-3 text-sm'>
                {options.showGroupImage && (groupPreview ? <img src={groupPreview} alt='' className='w-20 object-contain' /> : <span className='h-10 w-20 shrink-0 rounded-full bg-white/25' />)}
                <p>{shown('subtitle')}</p>
              </div>
              {options.showBookButton && (
                <span className='mt-4 inline-block rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-700'>{shown('bookButtonText')}</span>
              )}
            </div>
            {heroPreview && <img src={heroPreview} alt='' className='mt-4 max-h-44 self-end object-contain' />}
          </div>
        </LivePreview>
      </form>
    </AdminPage>
  )
}

export default HomeHeroSettings
