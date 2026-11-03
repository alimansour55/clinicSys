import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Printer, ShieldAlert, Siren } from 'lucide-react'
import { useLanguage } from '../../i18n'
import { Button, Card, CardBody, CardHeader, Field, Input, Select, notify } from '../ui'
import { useAccountApi, useServerText } from './accountApi'
import { BLOOD_TYPES } from './hubLogic'
import { formatIsoDate, passportText } from './hubLogic'

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #health-passport, #health-passport * { visibility: visible !important; }
  #health-passport { position: absolute; inset-block-start: 0; inset-inline: 0; }
  .passport-no-print { display: none !important; }
  .passport-print-only { display: block !important; }
}
`

const Row = ({ label, children, danger }) =>
  children ? (
    <div>
      <dt className='text-caption text-ink-3'>{label}</dt>
      <dd dir='auto' className={`text-body-sm font-medium ${danger ? 'text-danger-ink' : 'text-ink'}`}>{children}</dd>
    </div>
  ) : null

/**
 * A card to show a doctor, or to keep in a wallet. The QR holds the facts rather than a link: it is drawn in the
 * browser, opens with no account or connection, and nothing about it is sent to any server.
 */
const PassportPanel = ({ userData, hub, reload }) => {
  const { t, language } = useLanguage()
  const api = useAccountApi()
  const say = useServerText()
  const { members, reminders, emergency } = hub
  const [memberId, setMemberId] = useState('')
  const [form, setForm] = useState({ bloodType: emergency?.bloodType || '', contactName: emergency?.contactName || '', contactPhone: emergency?.contactPhone || '' })
  const [saving, setSaving] = useState(false)
  const [qr, setQr] = useState('')

  const member = members.find((item) => item._id === memberId)
  const medicineReminders = reminders
    .filter((reminder) => reminder.active && reminder.kind === 'medication' && (reminder.memberId || '') === memberId)
    .map((reminder) => reminder.title)

  const person = member
    ? {
        name: member.name,
        dob: member.dob,
        bloodType: member.bloodType,
        allergies: member.allergies,
        conditions: member.conditions,
        medications: [member.medications, ...medicineReminders].filter(Boolean).join(', ')
      }
    : {
        name: userData.name,
        dob: userData.dob && userData.dob !== 'Not Selected' ? userData.dob : '',
        bloodType: form.bloodType,
        allergies: userData.medicalHistory?.allergies,
        conditions: userData.medicalHistory?.conditions,
        medications: medicineReminders.join(', ')
      }

  const text = passportText({
    labels: {
      title: t('Clinivo emergency card'),
      name: t('Name'),
      dob: t('Birth date'),
      blood: t('Blood type'),
      allergies: t('Allergies'),
      conditions: t('Conditions'),
      medications: t('Medicines'),
      contact: t('In an emergency call')
    },
    ...person,
    contactName: form.contactName,
    contactPhone: form.contactPhone
  })

  useEffect(() => {
    let mounted = true
    QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 2, width: 320, color: { dark: '#111827', light: '#ffffff' } })
      .then((url) => {
        if (mounted) setQr(url)
      })
      .catch(() => {
        if (mounted) setQr('')
      })
    return () => {
      mounted = false
    }
  }, [text])

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    const data = await api('put', '/api/account/emergency', form)
    setSaving(false)
    if (!data.success) return notify.error(say(data.message))
    notify.success(say(data.message))
    reload()
  }

  return (
    <section aria-label={t('Health passport')} className='grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]'>
      <style>{PRINT_CSS}</style>

      <div id='health-passport' className='space-y-4'>
        <Card variant='signature'>
          <CardBody className='p-6'>
            <div className='flex items-start justify-between gap-3'>
              <div>
                <p className='flex items-center gap-2 text-caption font-semibold text-accent-ink'>
                  <Siren className='size-4' aria-hidden='true' /> {t('In an emergency')}
                </p>
                <h2 dir='auto' className='mt-1 font-display text-title-lg text-ink'>{person.name}</h2>
                {person.dob && <p className='text-caption text-ink-2'>{formatIsoDate(person.dob, language)}</p>}
              </div>
              {person.bloodType && (
                <span dir='ltr' className='shrink-0 rounded-control bg-danger-soft px-3 py-2 text-title font-bold text-danger-ink' aria-label={`${t('Blood type')}: ${person.bloodType}`}>{person.bloodType}</span>
              )}
            </div>

            <div className='mt-5 flex flex-col gap-5 sm:flex-row'>
              <dl className='min-w-0 flex-1 space-y-3'>
                <Row label={t('Allergies')} danger>{person.allergies || t('None recorded')}</Row>
                <Row label={t('Conditions')}>{person.conditions || t('None recorded')}</Row>
                <Row label={t('Medicines')}>{person.medications || t('None recorded')}</Row>
                <Row label={t('In an emergency call')}>{[form.contactName, form.contactPhone].filter(Boolean).join(' · ') || t('Not added yet')}</Row>
              </dl>
              {qr && (
                <div className='shrink-0 self-center'>
                  <img src={qr} alt={t('QR code with these emergency details')} className='size-36 rounded-control bg-white p-1' />
                </div>
              )}
            </div>
            <p className='mt-4 text-caption text-ink-3'>{t('Details come from what you entered. Always confirm them with the patient or a doctor.')}</p>
          </CardBody>
        </Card>

        <div className='passport-print-only hidden space-y-3'>
          <h3 className='text-subtitle font-semibold text-ink'>{t('Medical history')}</h3>
          {!member && (
            <dl className='space-y-2'>
              <Row label={t('Surgeries')}>{userData.medicalHistory?.surgeries}</Row>
              <Row label={t('Family history')}>{userData.medicalHistory?.familyHistory}</Row>
              <Row label={t('Lifestyle')}>{userData.medicalHistory?.socialHistory}</Row>
              <Row label={t('Notes')}>{userData.medicalHistory?.notes}</Row>
            </dl>
          )}
          {member && <dl><Row label={t('Notes')}>{member.notes}</Row></dl>}
        </div>

        <div className='passport-no-print flex flex-wrap items-center gap-2'>
          <Button variant='secondary' leadingIcon={<Printer className='size-4' />} onClick={() => window.print()}>{t('Print or save as PDF')}</Button>
          {members.length > 0 && (
            <Select aria-label={t('Whose passport')} value={memberId} onChange={(event) => setMemberId(event.target.value)} className='w-auto!'>
              <option value=''>{t('Me')}</option>
              {members.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
            </Select>
          )}
        </div>
      </div>

      <div className='passport-no-print space-y-4'>
        <Card>
          <CardHeader title={t('Your emergency details')} />
          <CardBody>
            <form onSubmit={save} className='space-y-3'>
              <Field label={t('Blood type')}>
                <Select dir='ltr' value={form.bloodType} onChange={set('bloodType')}>
                  <option value=''>{t('Not sure')}</option>
                  {BLOOD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </Select>
              </Field>
              <Field label={t('Emergency contact name')}>
                <Input dir='auto' maxLength={120} value={form.contactName} onChange={set('contactName')} />
              </Field>
              <Field label={t('Emergency contact phone')}>
                <Input dir='ltr' type='tel' maxLength={24} value={form.contactPhone} onChange={set('contactPhone')} />
              </Field>
              <Button type='submit' fullWidth loading={saving}>{t('Save')}</Button>
            </form>
          </CardBody>
        </Card>
        <p className='flex gap-2 rounded-control bg-surface-sunken p-3 text-caption text-ink-2'>
          <ShieldAlert className='size-4 shrink-0' aria-hidden='true' />
          {t('The QR code is made on this device and holds the details above. Anyone who scans it can read them, so only print it if you are comfortable with that.')}
        </p>
      </div>
    </section>
  )
}

export default PassportPanel
