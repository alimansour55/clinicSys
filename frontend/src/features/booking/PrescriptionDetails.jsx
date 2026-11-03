import { useContext, useState } from 'react'
import { ArrowLeft, Calendar, Clipboard, Download, FilePlus, FlaskConical, Pill, Stethoscope, Thermometer } from 'lucide-react'
import { AppContext } from '../../context/AppContext'
import { useLanguage } from '../../i18n'
import { Button, Card, CardBody, notify } from '../../components/ui'
import { downloadPrescriptionPdf } from './bookingApi'
import { formatSlotTime } from './bookingFormat'

const Section = ({ icon, title, children }) => (
  <section className='border-t border-line py-4'>
    <h3 className='mb-2 flex items-center gap-2 text-subtitle font-semibold text-ink'>
      <span className='text-brand [&>svg]:h-4 [&>svg]:w-4' aria-hidden='true'>{icon}</span>
      {title}
    </h3>
    {children}
  </section>
)

const Text = ({ children }) => <p className='whitespace-pre-line break-words text-body text-ink-2'>{children}</p>

const PrescriptionDetails = ({ prescription, onBack }) => {
  const { t, tc, language, localizeDigits } = useLanguage()
  const { slotDateFormat, displayPersonName, backendUrl, token } = useContext(AppContext)
  const [downloading, setDownloading] = useState(false)
  const doctor = prescription.docData || {}
  const patient = prescription.userData || {}
  const items = prescription.medicationItems || []

  const download = async () => {
    setDownloading(true)
    try {
      await downloadPrescriptionPdf(backendUrl, token, prescription.appointmentId, prescription.reservationNumber)
    } catch {
      notify.error(t('Could not download the file'))
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className='mx-auto max-w-3xl py-6'>
      <div className='mb-4 flex flex-wrap items-center justify-between gap-2'>
        <Button variant='ghost' leadingIcon={<ArrowLeft className='h-4 w-4 rtl:-scale-x-100' aria-hidden='true' />} onClick={onBack}>
          {t('Back to Appointments')}
        </Button>
        <Button variant='secondary' loading={downloading} leadingIcon={<Download className='h-4 w-4' aria-hidden='true' />} onClick={download}>
          {t('Download PDF')}
        </Button>
      </div>

      <Card variant='signature'>
        <CardBody>
          <h1 className='font-display text-display text-ink'>{t('Prescription Details')}</h1>
          <div className='mt-4 grid gap-3 text-body-sm sm:grid-cols-2'>
            <p className='text-ink-2'>
              <span className='block text-caption text-ink-3'>{t('Doctor')}</span>
              <span className='font-semibold text-ink'>{displayPersonName(doctor.name)}</span>
              {doctor.speciality && <span className='block'>{tc(doctor.speciality)}</span>}
            </p>
            <p className='text-ink-2'>
              <span className='block text-caption text-ink-3'>{t('Patient')}</span>
              <span className='font-semibold text-ink'>{displayPersonName(patient.name)}</span>
            </p>
            <p className='text-ink-2'>
              <span className='block text-caption text-ink-3'>{t('Date and time')}</span>
              <span className='font-semibold text-ink'>{slotDateFormat(prescription.slotDate)} · {formatSlotTime(prescription.slotTime, language, localizeDigits)}</span>
            </p>
            {prescription.reservationNumber && (
              <p className='text-ink-2'>
                <span className='block text-caption text-ink-3'>{t('Reservation number')}</span>
                <span className='font-semibold text-ink' dir='ltr'>{prescription.reservationNumber}</span>
              </p>
            )}
          </div>

          <div className='mt-4'>
            <Section icon={<Stethoscope />} title={t('Diagnosis')}><Text>{prescription.diagnosis}</Text></Section>
            {prescription.symptoms && <Section icon={<Thermometer />} title={t('Symptoms')}><Text>{prescription.symptoms}</Text></Section>}
            {(items.length > 0 || prescription.medicines) && (
              <Section icon={<Pill />} title={t('Prescribed Medicines')}>
                {items.length > 0 ? (
                  <ul className='space-y-2'>
                    {items.map((item, index) => (
                      <li key={index} className='rounded-control bg-surface-sunken p-3'>
                        <p className='font-semibold text-ink'>{item.name}</p>
                        <p className='text-body-sm text-ink-2'>{[item.dosage, item.frequency, item.duration].filter(Boolean).join(' · ')}</p>
                        {item.instructions && <p className='mt-1 text-caption text-ink-2'>{item.instructions}</p>}
                      </li>
                    ))}
                  </ul>
                ) : <Text>{prescription.medicines}</Text>}
              </Section>
            )}
            {prescription.instructions && <Section icon={<Clipboard />} title={t('Instructions')}><Text>{prescription.instructions}</Text></Section>}
            {prescription.labTests && <Section icon={<FlaskConical />} title={t('Lab Tests Required')}><Text>{prescription.labTests}</Text></Section>}
            {prescription.nextVisit && <Section icon={<Calendar />} title={t('Next Visit')}><Text>{prescription.nextVisit}</Text></Section>}
            {prescription.documentation && <Section icon={<FilePlus />} title={t('Documentation')}><Text>{prescription.documentation}</Text></Section>}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

export default PrescriptionDetails
