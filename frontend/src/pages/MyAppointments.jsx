import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarHeart, CalendarX, History } from 'lucide-react'
import { AppContext } from '../context/AppContext'
import { useLanguage } from '../i18n'
import { Button, EmptyState, Modal, Skeleton, SkeletonGroup, Tab, TabList, TabPanel, Tabs, notify } from '../components/ui'
import AppointmentCard from '../features/booking/AppointmentCard'
import CheckoutForm from '../features/booking/CheckoutForm'
import PrescriptionDetails from '../features/booking/PrescriptionDetails'
import RescheduleModal from '../features/booking/RescheduleModal'
import WaitlistPanel from '../features/booking/WaitlistPanel'
import { cancelVisit, confirmPayLater, fetchWaitlist, startPayLater } from '../features/booking/bookingApi'
import { fill, formatDayShort, formatSlotTime, splitAppointments } from '../features/booking/bookingFormat'

const REFRESH_MS = 15_000
const CLOCK_TICK_MS = 30_000

const CardSkeleton = () => (
  <div className='rounded-card border border-line bg-surface p-5'>
    <div className='flex gap-4'>
      <Skeleton className='h-20 w-20 rounded-control' />
      <div className='flex-1 space-y-2'>
        <Skeleton className='h-5 w-1/2' />
        <Skeleton className='h-4 w-1/3' />
        <Skeleton className='h-4 w-2/3' />
      </div>
    </div>
  </div>
)

const CancelDialog = ({ appointment, onClose, onConfirm, busy }) => {
  const { t, language, localizeDigits } = useLanguage()
  const { formatMoney } = useContext(AppContext)
  const paidOnline = appointment.paymentStatus === 'Paid' && appointment.paymentMethod === 'Visa'

  return (
    <Modal
      open
      onClose={onClose}
      size='sm'
      title={t('Cancel this visit?')}
      description={fill(t('{{when}} with {{doctor}}'), {
        when: `${appointment.startsAt ? formatDayShort(appointment.startsAt, language) : appointment.slotDate} · ${formatSlotTime(appointment.slotTime, language, localizeDigits)}`,
        doctor: appointment.docData?.name || ''
      })}
      footer={(
        <>
          <Button variant='ghost' onClick={onClose} disabled={busy}>{t('Keep visit')}</Button>
          {appointment.canReschedule && <Button variant='secondary' onClick={() => onConfirm('move')} disabled={busy}>{t('Move it instead')}</Button>}
          <Button variant='danger' loading={busy} onClick={() => onConfirm('cancel')}>{t('Cancel visit')}</Button>
        </>
      )}
    >
      <p className='text-body-sm text-ink-2'>
        {paidOnline
          ? fill(t('{{amount}} goes back to your card. Banks usually take 5 to 10 days to show it.'), { amount: formatMoney(appointment.amount) })
          : t('You will not be charged.')}
      </p>
    </Modal>
  )
}

const PayDialog = ({ appointment, checkout, onClose, onConfirmed }) => {
  const { t } = useLanguage()
  const { formatMoney } = useContext(AppContext)
  return (
    <Modal open onClose={onClose} size='md' title={t('Pay online')} description={t('Pay now and skip the queue at reception.')}>
      <CheckoutForm
        amountLabel={formatMoney(appointment.amount)}
        clientSecret={checkout.clientSecret}
        payLabel={t('Pay')}
        onConfirmed={onConfirmed}
      />
    </Modal>
  )
}

const MyAppointments = () => {
  const { t } = useLanguage()
  const {
    appointments,
    getUserAppointments,
    getUserPrescription,
    createDoctorRating,
    getDoctorsData,
    backendUrl,
    token
  } = useContext(AppContext)

  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())
  const [waitlist, setWaitlist] = useState([])
  const [prescription, setPrescription] = useState(null)
  const [prescriptionLoadingId, setPrescriptionLoadingId] = useState('')
  const [cancelling, setCancelling] = useState(null)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [rescheduling, setRescheduling] = useState(null)
  const [paying, setPaying] = useState(null)

  const buckets = useMemo(() => splitAppointments(appointments, now), [appointments, now])

  const loadWaitlist = useCallback(async () => {
    if (!token) return
    try {
      const data = await fetchWaitlist(backendUrl, token)
      if (data.success) setWaitlist(data.entries)
    } catch {
      // The list is an extra. Appointments stay usable without it.
    }
  }, [backendUrl, token])

  const refreshAll = useCallback(async () => {
    await Promise.all([getUserAppointments(), loadWaitlist()])
    setNow(Date.now())
  }, [getUserAppointments, loadWaitlist])

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return undefined
    }
    let active = true
    setLoading(true)
    refreshAll().finally(() => {
      if (active) setLoading(false)
    })
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refreshAll()
    }, REFRESH_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS)
    return () => clearInterval(clock)
  }, [])

  const viewPrescription = async (appointmentId) => {
    setPrescriptionLoadingId(appointmentId)
    const found = await getUserPrescription(appointmentId)
    if (found) {
      setPrescription(found)
      window.scrollTo?.({ top: 0 })
    }
    setPrescriptionLoadingId('')
  }

  const confirmCancel = async (choice) => {
    if (choice === 'move') {
      setRescheduling(cancelling)
      setCancelling(null)
      return
    }
    setCancelBusy(true)
    try {
      const data = await cancelVisit(backendUrl, token, cancelling._id)
      if (data.success) {
        notify.success(t(data.message))
        setCancelling(null)
        await refreshAll()
        getDoctorsData({ background: true })
        window.dispatchEvent(new Event('clinic:notifications-refresh'))
      } else {
        notify.error(t(data.message))
      }
    } catch {
      notify.error(t('Something went wrong. Please try again.'))
    } finally {
      setCancelBusy(false)
    }
  }

  const beginPayment = async (appointment) => {
    try {
      const data = await startPayLater(backendUrl, token, appointment._id)
      if (data.success) setPaying({ appointment, checkout: data })
      else notify.error(t(data.message))
    } catch {
      notify.error(t('Something went wrong. Please try again.'))
    }
  }

  const finishPayment = async (paymentIntentId) => {
    try {
      const data = await confirmPayLater(backendUrl, token, paying.appointment._id, paymentIntentId)
      if (data.success) notify.success(t('Payment confirmed'))
      else notify.error(t(data.message))
    } catch {
      notify.error(t('Your payment went through and is still being confirmed. Please check back shortly.'))
    }
    setPaying(null)
    refreshAll()
  }

  const submitRating = async (appointmentId, rating, comment) => {
    await createDoctorRating(appointmentId, rating, comment)
  }

  if (prescription) {
    return <PrescriptionDetails prescription={prescription} onBack={() => setPrescription(null)} />
  }

  const cardProps = {
    now,
    onCancel: setCancelling,
    onReschedule: setRescheduling,
    onPay: beginPayment,
    onRate: submitRating,
    onViewPrescription: viewPrescription
  }

  const list = (rows, empty) => (rows.length === 0 ? empty : (
    <div className='space-y-4'>
      {rows.map((appointment, index) => (
        <AppointmentCard
          key={appointment._id}
          appointment={appointment}
          prescriptionLoading={prescriptionLoadingId === appointment._id}
          highlight={index === 0 && rows === buckets.upcoming}
          {...cardProps}
        />
      ))}
    </div>
  ))

  return (
    <div className='mx-auto max-w-3xl py-8'>
      <h1 className='mb-6 font-display text-display text-ink'>{t('My Appointments')}</h1>

      <WaitlistPanel entries={waitlist} onChanged={refreshAll} />

      {loading ? (
        <SkeletonGroup label={t('Loading your appointments')}>
          <div className='space-y-4'>
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </SkeletonGroup>
      ) : (
        <Tabs defaultValue='upcoming'>
          <TabList label={t('My Appointments')}>
            <Tab value='upcoming'>{t('Upcoming')}</Tab>
            <Tab value='past'>{t('Past')}</Tab>
            <Tab value='cancelled'>{t('Cancelled')}</Tab>
          </TabList>
          <TabPanel value='upcoming'>
            <div className='pt-4'>
              {list(buckets.upcoming, (
                <EmptyState
                  icon={<CalendarHeart aria-hidden='true' />}
                  title={t('Nothing booked yet')}
                  description={t('Find a doctor and be seen as soon as today.')}
                  action={<Button as={Link} to='/doctors'>{t('Find a doctor')}</Button>}
                />
              ))}
            </div>
          </TabPanel>
          <TabPanel value='past'>
            <div className='pt-4'>
              {list(buckets.past, <EmptyState icon={<History aria-hidden='true' />} title={t('No past visits')} description={t('Finished visits and prescriptions appear here.')} />)}
            </div>
          </TabPanel>
          <TabPanel value='cancelled'>
            <div className='pt-4'>
              {list(buckets.cancelled, <EmptyState icon={<CalendarX aria-hidden='true' />} title={t('No cancelled visits')} />)}
            </div>
          </TabPanel>
        </Tabs>
      )}

      {cancelling && <CancelDialog appointment={cancelling} busy={cancelBusy} onClose={() => setCancelling(null)} onConfirm={confirmCancel} />}
      {rescheduling && (
        <RescheduleModal
          appointment={rescheduling}
          backendUrl={backendUrl}
          token={token}
          onClose={() => setRescheduling(null)}
          onDone={() => {
            setRescheduling(null)
            refreshAll()
            getDoctorsData({ background: true })
          }}
        />
      )}
      {paying && <PayDialog appointment={paying.appointment} checkout={paying.checkout} onClose={() => setPaying(null)} onConfirmed={finishPayment} />}
    </div>
  )
}

export default MyAppointments
