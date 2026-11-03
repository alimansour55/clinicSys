import { useId, useState } from 'react'
import { useLanguage } from '../../i18n'
import { Button, Modal, notify } from '../../components/ui'
import SlotPicker from './SlotPicker'
import { rescheduleVisit } from './bookingApi'
import { fill, formatDayShort, formatSlotTime } from './bookingFormat'
import { useLiveAvailability } from './useLiveAvailability'

const RescheduleModal = ({ appointment, backendUrl, token, onClose, onDone }) => {
  const { t, language, localizeDigits } = useLanguage()
  const headingId = useId()
  const [selection, setSelection] = useState(null)
  const [saving, setSaving] = useState(false)

  const { availability, loading, failed, refresh } = useLiveAvailability({
    backendUrl,
    docId: appointment.docId,
    appointmentType: appointment.appointmentType,
    clinicLocation: appointment.clinicLocation
  })

  const confirm = async () => {
    if (!selection || saving) return
    setSaving(true)
    try {
      const data = await rescheduleVisit(backendUrl, token, appointment._id, {
        slotDate: selection.slotDate,
        slotTime: selection.slotTime
      })
      if (data.success) {
        notify.success(t('Your visit has been moved'))
        onDone()
      } else {
        notify.error(t(data.message))
        setSelection(null)
        refresh()
      }
    } catch {
      notify.error(t('Something went wrong. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size='lg'
      title={t('Move this visit')}
      description={fill(t('Currently {{when}}. The price and any payment stay as they are.'), {
        when: `${appointment.startsAt ? formatDayShort(appointment.startsAt, language) : appointment.slotDate} · ${formatSlotTime(appointment.slotTime, language, localizeDigits)}`
      })}
      footer={(
        <>
          <Button variant='ghost' onClick={onClose} disabled={saving}>{t('Keep current time')}</Button>
          <Button onClick={confirm} loading={saving} disabled={!selection}>{t('Move visit')}</Button>
        </>
      )}
    >
      <span id={headingId} className='sr-only'>{t('Choose a new time')}</span>
      <SlotPicker
        availability={availability}
        loading={loading}
        failed={failed}
        onRetry={refresh}
        selection={selection}
        onSelect={setSelection}
        headingId={headingId}
      />
    </Modal>
  )
}

export default RescheduleModal
