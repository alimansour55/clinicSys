import React, { useContext, useEffect, useMemo, useState } from 'react'
import { Building2, Link2, Mail, Phone, Save, Settings2 } from 'lucide-react'
import { AdminContext } from '../../context/AdminContext'
import { useLanguage } from '../../i18n'
import BilingualField from '../../components/BilingualField'
import { AdminPage } from '../../components/admin/AdminPage'
import { FormSection, LivePreview, ToggleRow } from '../../components/admin/SiteContentForm'
import { Button, Field, Input } from '../../components/ui'
import { bilingualGroupFromRecord, bilingualGroupPayload, bilingualText } from '../../utils/bilingualValue'
import { DEFAULT_FOOTER_COPYRIGHT, DEFAULT_FOOTER_DESCRIPTION } from '../../utils/publicSiteDefaults'

const TEXT_FIELDS = [
  'description',
  'companyTitle',
  'contactTitle',
  'homeLabel',
  'aboutLabel',
  'doctorsLabel',
  'contactLabel',
  'appointmentsLabel',
  'profileLabel',
  'privacyLabel',
  'phoneLabel',
  'emailLabel',
  'copyrightText'
]

const defaults = {
  description: DEFAULT_FOOTER_DESCRIPTION,
  companyTitle: 'Company',
  contactTitle: 'Get in touch',
  homeLabel: 'Home',
  aboutLabel: 'About',
  doctorsLabel: 'All doctors',
  contactLabel: 'Contact Us',
  appointmentsLabel: 'My Appointments',
  profileLabel: 'My Profile',
  privacyLabel: 'Privacy Policy',
  phoneLabel: 'Phone',
  emailLabel: 'Email',
  copyrightText: DEFAULT_FOOTER_COPYRIGHT
}

const defaultOptions = {
  phoneNumber: '+20 101 881 1142',
  email: 'contact@clinivo.com',
  showHomeLink: true,
  showAboutLink: true,
  showDoctorsLink: true,
  showContactLink: true,
  showPatientLinks: true,
  showPrivacyLink: true
}

const LINK_LABELS = [
  ['homeLabel', 'Home link label'],
  ['aboutLabel', 'About link label'],
  ['doctorsLabel', 'Doctors link label'],
  ['contactLabel', 'Contact link label'],
  ['appointmentsLabel', 'Appointments link label'],
  ['profileLabel', 'Profile link label'],
  ['privacyLabel', 'Privacy link label']
]

const LINK_TOGGLES = [
  ['showHomeLink', 'Show home link'],
  ['showAboutLink', 'Show about link'],
  ['showDoctorsLink', 'Show doctors link'],
  ['showContactLink', 'Show contact link'],
  ['showPatientLinks', 'Show patient links'],
  ['showPrivacyLink', 'Show privacy link']
]

const FooterSettings = () => {
  const { aToken, siteSettings, getSiteSettings, updateFooterSettings, translatePreview } = useContext(AdminContext)
  const { t, language } = useLanguage()
  const [text, setText] = useState(() => bilingualGroupFromRecord(defaults, TEXT_FIELDS))
  const [options, setOptions] = useState(defaultOptions)
  const [saving, setSaving] = useState(false)
  const [previewLanguage, setPreviewLanguage] = useState(language)

  useEffect(() => {
    if (aToken) getSiteSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aToken])

  const savedFooter = siteSettings?.footer
  useEffect(() => {
    if (!savedFooter) return
    setText(bilingualGroupFromRecord({ ...defaults, ...savedFooter }, TEXT_FIELDS))
    setOptions({ ...defaultOptions, ...savedFooter })
  }, [savedFooter])

  const setField = (field) => (value) => setText((previous) => ({ ...previous, [field]: value }))
  const setOption = (field) => (value) => setOptions((previous) => ({ ...previous, [field]: value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    const { phoneNumber, email } = options
    const toggles = Object.fromEntries(LINK_TOGGLES.map(([key]) => [key, options[key]]))
    await updateFooterSettings({ ...bilingualGroupPayload(text), phoneNumber, email, ...toggles })
    setSaving(false)
  }

  const shown = (field) => bilingualText(text[field], previewLanguage)

  const links = useMemo(() => {
    const visible = []
    if (options.showHomeLink) visible.push('homeLabel')
    if (options.showAboutLink) visible.push('aboutLabel')
    if (options.showDoctorsLink) visible.push('doctorsLabel')
    if (options.showContactLink) visible.push('contactLabel')
    if (options.showPatientLinks) visible.push('appointmentsLabel', 'profileLabel')
    if (options.showPrivacyLink) visible.push('privacyLabel')
    return visible.map((field) => bilingualText(text[field], previewLanguage)).filter(Boolean)
  }, [options, text, previewLanguage])

  return (
    <AdminPage icon={Building2} title={t('Footer Settings')} description={t('Control the company information, footer links, phone, email, and copyright shown on the patient website.')}>
      <form onSubmit={handleSubmit} className='grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_400px]'>
        <div className='min-w-0 space-y-5'>
          <FormSection title={t('Company Information')} icon={Settings2}>
            <BilingualField label={t('App description')} value={text.description} onChange={setField('description')} translate={translatePreview} multiline />
            <BilingualField label={t('Company section title')} value={text.companyTitle} onChange={setField('companyTitle')} translate={translatePreview} />
            <BilingualField label={t('Contact section title')} value={text.contactTitle} onChange={setField('contactTitle')} translate={translatePreview} />
          </FormSection>

          <FormSection title={t('Footer Options')} icon={Link2}>
            {LINK_LABELS.map(([field, label]) => (
              <BilingualField key={field} label={t(label)} value={text[field]} onChange={setField(field)} translate={translatePreview} />
            ))}
            <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
              {LINK_TOGGLES.map(([field, label]) => (
                <ToggleRow key={field} checked={options[field]} onChange={setOption(field)} label={t(label)} />
              ))}
            </div>
          </FormSection>

          <FormSection title={t('Contact Details')} icon={Phone}>
            <BilingualField label={t('Phone label')} value={text.phoneLabel} onChange={setField('phoneLabel')} translate={translatePreview} />
            <BilingualField label={t('Email label')} value={text.emailLabel} onChange={setField('emailLabel')} translate={translatePreview} />
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
              <Field label={t('Phone number')}>
                <Input dir='ltr' type='tel' style={{ textAlign: 'start' }} value={options.phoneNumber} onChange={(event) => setOption('phoneNumber')(event.target.value)} />
              </Field>
              <Field label={t('Email address')}>
                <Input dir='ltr' type='email' style={{ textAlign: 'start' }} value={options.email} onChange={(event) => setOption('email')(event.target.value)} />
              </Field>
            </div>
            <BilingualField label={t('Copyright text')} value={text.copyrightText} onChange={setField('copyrightText')} translate={translatePreview} />
          </FormSection>
        </div>

        <LivePreview
          description={t('Approximate patient website footer.')}
          language={previewLanguage}
          onLanguage={setPreviewLanguage}
          footer={
            <Button type='submit' fullWidth loading={saving} leadingIcon={<Save aria-hidden='true' className='size-4' />}>
              {t('Save Footer Settings')}
            </Button>
          }
        >
          <div className='space-y-5 text-body-sm'>
            <p className='text-ink-2'>{shown('description')}</p>
            <div>
              <p className='mb-2 text-caption font-semibold text-ink-3'>{shown('companyTitle')}</p>
              <ul className='space-y-1 text-ink'>
                {links.map((link, index) => (
                  <li key={`${link}-${index}`}>{link}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className='mb-2 text-caption font-semibold text-ink-3'>{shown('contactTitle')}</p>
              <p className='flex items-center gap-2 text-ink'>
                <Phone aria-hidden='true' className='size-4 text-brand' />
                {shown('phoneLabel')}: <span dir='ltr'>{options.phoneNumber}</span>
              </p>
              <p className='mt-1 flex items-center gap-2 break-all text-ink'>
                <Mail aria-hidden='true' className='size-4 shrink-0 text-brand' />
                {shown('emailLabel')}: <span dir='ltr'>{options.email}</span>
              </p>
            </div>
            <p className='border-t border-line pt-3 text-center text-caption text-ink-3'>{shown('copyrightText')}</p>
          </div>
        </LivePreview>
      </form>
    </AdminPage>
  )
}

export default FooterSettings
