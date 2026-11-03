import React, { useContext, useEffect, useState } from 'react'
import { Home, LayoutTemplate, Save, Video } from 'lucide-react'
import { AdminContext } from '../../context/AdminContext'
import { useLanguage } from '../../i18n'
import BilingualField from '../../components/BilingualField'
import { AdminPage } from '../../components/admin/AdminPage'
import { FormSection, ImagePicker, ToggleRow, useFilePreview } from '../../components/admin/SiteContentForm'
import { Button } from '../../components/ui'
import { appendBilingualGroup, bilingualGroupFromRecord } from '../../utils/bilingualValue'

const TEXT_FIELDS = [
  'teleconsultationTitle',
  'teleconsultationDescription',
  'teleconsultationButtonText',
  'homeVisitTitle',
  'homeVisitDescription',
  'homeVisitButtonText'
]

const defaults = {
  teleconsultationTitle: 'Teleconsultation',
  teleconsultationDescription: 'Schedule a voice or video call with a specialist doctor.',
  teleconsultationButtonText: 'Book',
  homeVisitTitle: 'Home Visit',
  homeVisitDescription: 'Book a doctor visit at your home in supported Cairo and Giza areas.',
  homeVisitButtonText: 'Book'
}

const CardEditor = ({ title, icon, preview, onPick, prefix, text, setField, visible, onVisible, translate }) => {
  const { t } = useLanguage()
  return (
    <FormSection title={title} icon={icon}>
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-[180px_minmax(0,1fr)]'>
        <ImagePicker label={t('Card photo')} preview={preview} onPick={onPick} hint={t('Upload photo')} imageClassName='h-32' />
        <div className='min-w-0 space-y-4'>
          <BilingualField label={t('Section name')} value={text[`${prefix}Title`]} onChange={setField(`${prefix}Title`)} translate={translate} />
          <BilingualField label={t('Description')} value={text[`${prefix}Description`]} onChange={setField(`${prefix}Description`)} translate={translate} multiline />
          <BilingualField label={t('Button text')} value={text[`${prefix}ButtonText`]} onChange={setField(`${prefix}ButtonText`)} translate={translate} />
          <ToggleRow checked={visible} onChange={onVisible} label={t('Visible on patient homepage')} />
        </div>
      </div>
    </FormSection>
  )
}

const HomeServiceCardsSettings = () => {
  const { aToken, siteSettings, getSiteSettings, updateHomeServiceCardsSettings, translatePreview } = useContext(AdminContext)
  const { t } = useLanguage()
  const [text, setText] = useState(() => bilingualGroupFromRecord(defaults, TEXT_FIELDS))
  const [showTeleconsultation, setShowTeleconsultation] = useState(true)
  const [showHomeVisit, setShowHomeVisit] = useState(true)
  const [teleconsultationImage, setTeleconsultationImage] = useState(null)
  const [homeVisitImage, setHomeVisitImage] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (aToken) getSiteSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aToken])

  const saved = siteSettings?.homeServiceCards
  useEffect(() => {
    if (!saved) return
    setText(bilingualGroupFromRecord({ ...defaults, ...saved }, TEXT_FIELDS))
    setShowTeleconsultation(saved.showTeleconsultation !== false)
    setShowHomeVisit(saved.showHomeVisit !== false)
  }, [saved])

  const setField = (field) => (value) => setText((previous) => ({ ...previous, [field]: value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    const formData = new FormData()
    appendBilingualGroup(formData, text)
    formData.append('showTeleconsultation', showTeleconsultation)
    formData.append('showHomeVisit', showHomeVisit)
    if (teleconsultationImage) formData.append('teleconsultationImage', teleconsultationImage)
    if (homeVisitImage) formData.append('homeVisitImage', homeVisitImage)
    const success = await updateHomeServiceCardsSettings(formData)
    if (success) {
      setTeleconsultationImage(null)
      setHomeVisitImage(null)
    }
    setSaving(false)
  }

  const telePreview = useFilePreview(teleconsultationImage, saved?.teleconsultationImage)
  const homePreview = useFilePreview(homeVisitImage, saved?.homeVisitImage)

  return (
    <AdminPage icon={LayoutTemplate} width='max-w-5xl' title={t('Home Service Cards')} description={t('Control the Teleconsultation and Home Visit cards under Find by Speciality.')}>
      <form onSubmit={handleSubmit} className='space-y-5'>
        <CardEditor title={t('Teleconsultation')} icon={Video} preview={telePreview} onPick={setTeleconsultationImage} prefix='teleconsultation' text={text} setField={setField} visible={showTeleconsultation} onVisible={setShowTeleconsultation} translate={translatePreview} />
        <CardEditor title={t('Home Visit')} icon={Home} preview={homePreview} onPick={setHomeVisitImage} prefix='homeVisit' text={text} setField={setField} visible={showHomeVisit} onVisible={setShowHomeVisit} translate={translatePreview} />
        <Button type='submit' loading={saving} leadingIcon={<Save aria-hidden='true' className='size-4' />}>
          {t('Save service cards')}
        </Button>
      </form>
    </AdminPage>
  )
}

export default HomeServiceCardsSettings
