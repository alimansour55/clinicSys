import { useState } from 'react'
import { CalendarPlus, Download, ExternalLink, FileText } from 'lucide-react'
import { useLanguage } from '../../i18n'
import { Button, notify } from '../../components/ui'
import { downloadAppointmentPdf, downloadCalendarFile, fetchGoogleCalendarUrl } from './bookingApi'

const useBusy = () => {
  const [busy, setBusy] = useState('')
  const run = async (key, task, errorMessage) => {
    setBusy(key)
    try {
      await task()
    } catch {
      notify.error(errorMessage)
    } finally {
      setBusy('')
    }
  }
  return [busy, run]
}

/** Calendar and document buttons. Shown wherever a visit is shown, so they are never hard to find. */
const DocumentActions = ({ appointment, backendUrl, token, size = 'sm', showCalendar = true }) => {
  const { t, language } = useLanguage()
  const [busy, run] = useBusy()
  const paid = appointment.paymentStatus === 'Paid' || appointment.refundStatus === 'Refunded'

  const openGoogle = () => run('google', async () => {
    // Opened first, or a popup blocker sees it as unrelated to the click.
    const tab = window.open('', '_blank', 'noopener')
    const data = await fetchGoogleCalendarUrl(backendUrl, token, appointment._id, language)
    if (!data.success) throw new Error(data.message)
    if (tab) tab.location.href = data.googleCalendarUrl
    else window.location.href = data.googleCalendarUrl
  }, t('Could not open the calendar'))

  return (
    <div className='flex flex-wrap gap-2'>
      {showCalendar && (
        <>
          <Button
            size={size}
            variant='secondary'
            loading={busy === 'ics'}
            leadingIcon={<CalendarPlus className='h-4 w-4' aria-hidden='true' />}
            onClick={() => run('ics', () => downloadCalendarFile(backendUrl, token, appointment, language), t('Could not download the file'))}
          >
            {t('Add to calendar')}
          </Button>
          <Button
            size={size}
            variant='ghost'
            loading={busy === 'google'}
            trailingIcon={<ExternalLink className='h-3.5 w-3.5' aria-hidden='true' />}
            onClick={openGoogle}
          >
            {t('Google Calendar')}
          </Button>
        </>
      )}
      <Button
        size={size}
        variant='ghost'
        loading={busy === 'pdf'}
        leadingIcon={<Download className='h-4 w-4' aria-hidden='true' />}
        onClick={() => run('pdf', () => downloadAppointmentPdf(backendUrl, token, appointment), t('Could not download the file'))}
      >
        {t('Confirmation PDF')}
      </Button>
      {paid && (
        <Button
          size={size}
          variant='ghost'
          loading={busy === 'invoice'}
          leadingIcon={<FileText className='h-4 w-4' aria-hidden='true' />}
          onClick={() => run('invoice', () => downloadAppointmentPdf(backendUrl, token, appointment, 'invoice'), t('Could not download the file'))}
        >
          {t('Invoice')}
        </Button>
      )}
    </div>
  )
}

export default DocumentActions
