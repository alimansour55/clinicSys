import React, { useContext, useEffect, useMemo, useState } from 'react'
import { AdminContext } from '../../context/AdminContext'
import { Building2, Eye, Link2, Loader2, Mail, Phone, Save, Settings2 } from 'lucide-react'

const defaults = {
  description: "Simplifying healthcare access through smart appointment management. Book your doctor, anytime, anywhere with Prescripto's intelligent scheduling system. No more long waits or booking hassles - just efficient, reliable, and patient-focused healthcare at your convenience.",
  companyTitle: 'COMPANY',
  contactTitle: 'GET IN TOUCH',
  homeLabel: 'Home',
  aboutLabel: 'About',
  doctorsLabel: 'All Doctors',
  contactLabel: 'Contact Us',
  appointmentsLabel: 'My Appointments',
  profileLabel: 'My Profile',
  privacyLabel: 'Privacy Policy',
  phoneLabel: 'Phone',
  phoneNumber: '+92 343 2705821',
  emailLabel: 'Email',
  email: 'marqum987@gmail.com',
  copyrightText: 'Copyright 2026 © Prescripto - All Rights Reserved.',
  showHomeLink: true,
  showAboutLink: true,
  showDoctorsLink: true,
  showContactLink: true,
  showPatientLinks: true,
  showPrivacyLink: true
}

const TextInput = ({ label, value, onChange, type = 'text' }) => (
  <div>
    <label className='block text-sm font-semibold text-gray-700 mb-2'>{label}</label>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className='w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary'
    />
  </div>
)

const ToggleRow = ({ checked, onChange, label }) => (
  <label className='flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3 cursor-pointer hover:bg-gray-50 transition'>
    <span className='text-sm font-semibold text-gray-900'>{label}</span>
    <input
      type='checkbox'
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className='h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary'
    />
  </label>
)

const FooterSettings = () => {
  const { aToken, siteSettings, getSiteSettings, updateFooterSettings } = useContext(AdminContext)
  const [form, setForm] = useState(defaults)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (aToken) getSiteSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aToken])

  useEffect(() => {
    if (siteSettings?.footer) {
      setForm({ ...defaults, ...siteSettings.footer })
    }
  }, [siteSettings])

  const updateField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    await updateFooterSettings(form)
    setSaving(false)
  }

  const links = useMemo(() => {
    const visibleLinks = []
    if (form.showHomeLink) visibleLinks.push(form.homeLabel)
    if (form.showAboutLink) visibleLinks.push(form.aboutLabel)
    if (form.showDoctorsLink) visibleLinks.push(form.doctorsLabel)
    if (form.showContactLink) visibleLinks.push(form.contactLabel)
    if (form.showPatientLinks) visibleLinks.push(form.appointmentsLabel, form.profileLabel)
    if (form.showPrivacyLink) visibleLinks.push(form.privacyLabel)
    return visibleLinks.filter(Boolean)
  }, [form])

  return (
    <div className='min-h-screen bg-gray-50 p-3 sm:p-5 md:p-6 lg:p-8'>
      <div className='max-w-6xl'>
        <div className='mb-6'>
          <h1 className='text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2'>
            <Building2 className='w-6 h-6 text-primary' />
            Footer Settings
          </h1>
          <p className='mt-2 text-sm text-gray-600 ml-8'>
            Control the company information, footer links, phone, email, and copyright shown on the patient website.
          </p>
        </div>

        <form onSubmit={handleSubmit} className='grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-5'>
          <div className='space-y-5'>
            <div className='bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm'>
              <h2 className='text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2'>
                <Settings2 className='w-5 h-5 text-primary' />
                Company Information
              </h2>

              <div>
                <label className='block text-sm font-semibold text-gray-700 mb-2'>App description</label>
                <textarea
                  value={form.description}
                  onChange={(event) => updateField('description', event.target.value)}
                  rows={5}
                  className='w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary resize-none'
                />
              </div>

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4'>
                <TextInput label='Company section title' value={form.companyTitle} onChange={(value) => updateField('companyTitle', value)} />
                <TextInput label='Contact section title' value={form.contactTitle} onChange={(value) => updateField('contactTitle', value)} />
              </div>
            </div>

            <div className='bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm'>
              <h2 className='text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2'>
                <Link2 className='w-5 h-5 text-primary' />
                Footer Options
              </h2>

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <TextInput label='Home link label' value={form.homeLabel} onChange={(value) => updateField('homeLabel', value)} />
                <TextInput label='About link label' value={form.aboutLabel} onChange={(value) => updateField('aboutLabel', value)} />
                <TextInput label='Doctors link label' value={form.doctorsLabel} onChange={(value) => updateField('doctorsLabel', value)} />
                <TextInput label='Contact link label' value={form.contactLabel} onChange={(value) => updateField('contactLabel', value)} />
                <TextInput label='Appointments link label' value={form.appointmentsLabel} onChange={(value) => updateField('appointmentsLabel', value)} />
                <TextInput label='Profile link label' value={form.profileLabel} onChange={(value) => updateField('profileLabel', value)} />
                <TextInput label='Privacy link label' value={form.privacyLabel} onChange={(value) => updateField('privacyLabel', value)} />
              </div>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-3 mt-5'>
                <ToggleRow checked={form.showHomeLink} onChange={(value) => updateField('showHomeLink', value)} label='Show home link' />
                <ToggleRow checked={form.showAboutLink} onChange={(value) => updateField('showAboutLink', value)} label='Show about link' />
                <ToggleRow checked={form.showDoctorsLink} onChange={(value) => updateField('showDoctorsLink', value)} label='Show doctors link' />
                <ToggleRow checked={form.showContactLink} onChange={(value) => updateField('showContactLink', value)} label='Show contact link' />
                <ToggleRow checked={form.showPatientLinks} onChange={(value) => updateField('showPatientLinks', value)} label='Show patient links' />
                <ToggleRow checked={form.showPrivacyLink} onChange={(value) => updateField('showPrivacyLink', value)} label='Show privacy link' />
              </div>
            </div>

            <div className='bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm'>
              <h2 className='text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2'>
                <Phone className='w-5 h-5 text-primary' />
                Contact Details
              </h2>

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                <TextInput label='Phone label' value={form.phoneLabel} onChange={(value) => updateField('phoneLabel', value)} />
                <TextInput label='Phone number' value={form.phoneNumber} onChange={(value) => updateField('phoneNumber', value)} type='tel' />
                <TextInput label='Email label' value={form.emailLabel} onChange={(value) => updateField('emailLabel', value)} />
                <TextInput label='Email address' value={form.email} onChange={(value) => updateField('email', value)} type='email' />
              </div>

              <div className='mt-4'>
                <TextInput label='Copyright text' value={form.copyrightText} onChange={(value) => updateField('copyrightText', value)} />
              </div>
            </div>
          </div>

          <div className='bg-white border border-gray-200 rounded-xl shadow-sm h-fit xl:sticky xl:top-5 overflow-hidden'>
            <div className='p-4 sm:p-5 border-b border-gray-100'>
              <h2 className='text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2'>
                <Eye className='w-5 h-5 text-primary' />
                Live Preview
              </h2>
              <p className='text-sm text-gray-500 mt-1'>Approximate patient website footer.</p>
            </div>

            <div className='p-4 space-y-5'>
              <div className='grid grid-cols-1 sm:grid-cols-3 gap-5 text-sm'>
                <div className='sm:col-span-1'>
                  <div className='h-8 w-32 rounded bg-primary/15 mb-3' />
                  <p className='text-gray-600 leading-6'>{form.description}</p>
                </div>
                <div>
                  <p className='font-semibold text-gray-900 mb-3'>{form.companyTitle}</p>
                  <ul className='space-y-2 text-gray-600'>
                    {links.map((link, index) => <li key={`${link}-${index}`}>{link}</li>)}
                  </ul>
                </div>
                <div>
                  <p className='font-semibold text-gray-900 mb-3'>{form.contactTitle}</p>
                  <div className='space-y-3 text-gray-600'>
                    <div className='flex gap-2'>
                      <Phone className='w-4 h-4 text-primary mt-1' />
                      <div>
                        <p className='font-medium text-gray-900'>{form.phoneLabel}</p>
                        <p>{form.phoneNumber}</p>
                      </div>
                    </div>
                    <div className='flex gap-2'>
                      <Mail className='w-4 h-4 text-primary mt-1' />
                      <div className='min-w-0'>
                        <p className='font-medium text-gray-900'>{form.emailLabel}</p>
                        <p className='break-all'>{form.email}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className='border-t border-gray-200 pt-4 text-center text-xs text-gray-600'>{form.copyrightText}</div>

              <button type='submit' disabled={saving} className='w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90 disabled:bg-gray-300 transition'>
                {saving ? <Loader2 className='w-4 h-4 animate-spin' /> : <Save className='w-4 h-4' />}
                Save Footer Settings
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default FooterSettings
