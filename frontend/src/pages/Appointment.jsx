import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import { assets } from '../assets/assets'
import RelatedDoctors from '../components/RelatedDoctors'
import { toast } from 'react-toastify'
import axios from 'axios'
import { buildDoctorSlots } from '../utils/schedule'
import { Elements, CardElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { Banknote, CreditCard, MapPin, Phone, Video, Building2, Home } from 'lucide-react'
import { RatingBadge, RatingsList, StarRow } from '../components/DoctorRating'
import { emptyHomeVisitAddress, supportedHomeVisitAreas } from '../utils/homeVisitAreas'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_51Om5RIFYci1ONXhwffRNoKDSSkbwm6HLTtHRqHo4fG9VVWB74kE41EZG0Q65BvZU0QXQt7BCddGNcMnnOTRzia2500UZzolAxd')

const StripePaymentForm = ({ pendingPayment, confirmBookingStripePayment, onPaid, currencySymbol }) => {
  const stripe = useStripe()
  const elements = useElements()
  const [isPaying, setIsPaying] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!stripe || !elements) return

    setIsPaying(true)
    const cardElement = elements.getElement(CardElement)
    const { error, paymentIntent } = await stripe.confirmCardPayment(pendingPayment.clientSecret, {
      payment_method: { card: cardElement }
    })

    if (error) {
      toast.error(error.message || 'Payment failed')
      setIsPaying(false)
      return
    }

    if (paymentIntent?.status === 'succeeded') {
      const appointment = await confirmBookingStripePayment(paymentIntent.id)
      if (appointment) onPaid()
    } else {
      toast.error('Payment was not completed')
    }

    setIsPaying(false)
  }

  return (
    <form onSubmit={handleSubmit} className='rounded-xl border-2 border-primary bg-white p-4 shadow-lg sm:p-5'>
      <div className='mb-4 flex items-start justify-between gap-3'>
        <div>
          <p className='text-xs font-semibold uppercase tracking-wide text-primary'>Final step</p>
          <p className='mt-1 text-lg font-bold text-gray-900'>Enter Visa details to confirm appointment</p>
          <p className='mt-1 text-sm text-gray-600'>Your appointment will be booked only after payment succeeds.</p>
        </div>
        <div className='rounded-full bg-primary/10 p-2'>
          <CreditCard className='h-5 w-5 text-primary' />
        </div>
      </div>
      <div className='mb-3 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800'>
        Amount to pay: {currencySymbol}{pendingPayment.amount}
      </div>
      <label className='mb-2 block text-sm font-medium text-gray-700'>Card information</label>
      <div className='rounded-lg border border-gray-300 bg-white p-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20'>
        <CardElement options={{ hidePostalCode: true }} />
      </div>
      <button disabled={!stripe || isPaying} className='mt-4 w-full rounded-full bg-primary px-8 py-3 text-sm font-semibold text-white disabled:bg-gray-400 sm:w-auto'>
        {isPaying ? 'Processing payment...' : 'Pay and book appointment'}
      </button>
    </form>
  )
}

const Appointment = () => {
  
  const {docId} = useParams()
  const [searchParams] = useSearchParams()
  const {doctors, currencySymbol, backendUrl, token, getDoctorsData, createBookingPaymentIntent, confirmBookingStripePayment, getDoctorRatings} = useContext(AppContext)
  const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

  const navigate = useNavigate()
  
  const [slotIndex, setSlotIndex] = useState(null)
  const [slotTime, setSlotTime] = useState('')

  const [isBooking, setIsBooking] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [clinicLocation, setClinicLocation] = useState('')
  const [appointmentType, setAppointmentType] = useState(searchParams.get('consultation') === 'tele' ? 'Video Call' : searchParams.get('consultation') === 'home' ? 'Home Visit' : 'Clinic')
  const [homeVisitAddress, setHomeVisitAddress] = useState(emptyHomeVisitAddress)
  const [pendingPayment, setPendingPayment] = useState(null)
  const [ratingsOpen, setRatingsOpen] = useState(false)
  const [ratingsData, setRatingsData] = useState({ summary: { averageRating: 0, ratingCount: 0 }, ratings: [] })
  const [ratingsLoading, setRatingsLoading] = useState(false)
  const paymentPanelRef = useRef(null)
  

  const docInfo = useMemo(() => doctors.find(doc => doc._id === docId), [doctors, docId])
  const docSlots = useMemo(() => docInfo ? buildDoctorSlots(docInfo) : [], [docInfo])
  const doctorLocations = useMemo(() => {
    if (!docInfo) return []
    const locations = docInfo.locations?.length
      ? docInfo.locations
      : (docInfo.clinics || []).map((clinic) => clinic.name || clinic)
    return locations.filter(Boolean)
  }, [docInfo])

  useEffect(() => {
    if (doctorLocations.length === 1) setClinicLocation(doctorLocations[0])
    if (doctorLocations.length === 0) setClinicLocation('')
  }, [doctorLocations])

  useEffect(() => {
    const loadRatings = async () => {
      if (!docId) return
      setRatingsLoading(true)
      const data = await getDoctorRatings(docId)
      setRatingsData(data)
      setRatingsLoading(false)
    }
    loadRatings()
  }, [docId])


  const bookAppointment = async () => {
    if(!token) {
      toast.warn('Login to Book Appointment')
      return  navigate('/login')
    }

    if(slotIndex === null) {
      return toast.warn('Please select a day')
    }

    if(!slotTime) {
      return toast.warn('Please select a time')
    }

    if(appointmentType === 'Clinic' && doctorLocations.length > 1 && !clinicLocation) {
      return toast.warn('Please choose clinic location')
    }
    if(appointmentType === 'Home Visit' && (!homeVisitAddress.area || !homeVisitAddress.street.trim())) {
      return toast.warn('Please choose an area and enter street name and number')
    }

    setIsBooking(true)  // Booking start

    try {
      
    const date = docSlots[slotIndex].dateTime

    let day = date.getDate()
    let month = date.getMonth()+1
    let year = date.getFullYear()

    const slotDate = day + "_" + month + "_" + year
    
    if (paymentMethod === 'Visa') {
      const intent = await createBookingPaymentIntent({ docId, slotDate, slotTime, clinicLocation, appointmentType, homeVisitAddress })
        if (intent?.clientSecret) {
          setPendingPayment({
            clientSecret: intent.clientSecret,
            paymentIntentId: intent.paymentIntentId,
            amount: intent.amount
          })
          setTimeout(() => {
            paymentPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }, 100)
        }
      setIsBooking(false)
      return
    }

    const { data } = await axios.post(backendUrl + '/api/user/book-appointment', {docId, slotDate, slotTime, paymentMethod, clinicLocation, appointmentType, homeVisitAddress}, {headers: {token}});
    if(data.success){
      toast.success(data.message)
      getDoctorsData()
      navigate('/my-appointments')
      } else {
      toast.error(data.message)
    }

    } catch (error) {
      console.log(error)
      toast.error(error.message)
    }
    setIsBooking(false)  // Booking end
  }

  return docInfo && (
    <div>
      {/* -------- Doctor Details -------- */}
      <div className='flex flex-col sm:flex-row gap-4'>
        <div>
          <div className='relative'>
            <img className='bg-primary w-full sm:max-w-72 rounded-lg' src={docInfo.image} alt="" />
            <RatingBadge summary={docInfo.ratingSummary || ratingsData.summary} className='absolute left-3 top-3' />
          </div>
        </div>

        <div className='flex-1 border border-gray-400 rounded-lg p-8 py-7 bg-white mx-2 sm:mx-0 mt-[-80px] sm:mt-0'>
          {/* Doc Info : name, degree, experience -------- */}
          <p className='flex items-center gap-2 text-2xl font-medium text-gray-900'>
            {docInfo.name} 
            <img className='w-5' src={assets.verified_icon} alt="" />
            </p>
            <div className='flex items-center gap-2 text-sm mt-1 text-gray-600'>
              <p>{docInfo.degree} - {docInfo.speciality}</p>
              <button className='py-0.5 px-2 border text-xs rounded-full'>{docInfo.experience}</button>
            </div>

            {/* -------- Doctor About -------- */}
            <div>
              <p className='flex items-center gap-1 text-sm font-medium text-gray-900 mt-3' >About <img src={assets.info_icon} alt="" />
              </p>
              <p className='text-sm text-gray-500 max-w-[700px] mt-1'>{docInfo.about}</p>
            </div>
            <p className='text-gray-500 font-medium mt-4'>
              Appointment fee: <span className='text-gray-600'>{currencySymbol}{docInfo.fees}</span>
            </p>
            <div className='mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4'>
              <p className='mb-3 text-sm font-semibold text-gray-900'>Appointment type</p>
              <div className='grid grid-cols-1 gap-2 sm:grid-cols-3'>
                {[
                  { value: 'Clinic', label: 'In clinic', icon: Building2, hint: 'Visit the clinic' },
                  { value: 'Voice Call', label: 'Voice call', icon: Phone, hint: 'Audio consultation' },
                  { value: 'Video Call', label: 'Video call', icon: Video, hint: 'Online video room' },
                  { value: 'Home Visit', label: 'Home visit', icon: Home, hint: 'Doctor visits home' }
                ].map((option) => {
                  const Icon = option.icon
                  return (
                    <button
                      key={option.value}
                      type='button'
                      onClick={() => {
                        setAppointmentType(option.value)
                        setPendingPayment(null)
                      }}
                      className={`rounded-lg border p-3 text-left transition ${appointmentType === option.value ? 'border-primary bg-white text-primary shadow-sm' : 'border-blue-200 bg-white/70 text-gray-700 hover:border-primary'}`}
                    >
                      <span className='flex items-center gap-2 text-sm font-semibold'>
                        <Icon className='h-4 w-4' />
                        {option.label}
                      </span>
                      <span className='mt-1 block text-xs text-gray-500'>{option.hint}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {appointmentType === 'Clinic' && (
            <div className='mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4'>
              <p className='flex items-center gap-2 text-sm font-semibold text-gray-900'>
                <MapPin className='h-4 w-4 text-blue-600' />
                Clinic location
              </p>
              {doctorLocations.length > 1 ? (
                <div className='mt-3 flex flex-wrap gap-2'>
                  {doctorLocations.map((location) => (
                    <button
                      key={location}
                      type='button'
                      onClick={() => setClinicLocation(location)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium ${clinicLocation === location ? 'border-primary bg-white text-primary shadow-sm' : 'border-blue-200 bg-white/70 text-gray-700 hover:border-primary'}`}
                    >
                      {location}
                    </button>
                  ))}
                </div>
              ) : (
                <p className='mt-2 text-sm text-gray-700'>{doctorLocations[0] || [docInfo.address?.line1, docInfo.address?.line2].filter(Boolean).join(', ') || 'Clinic location will be confirmed by reception.'}</p>
              )}
            </div>
            )}
            {appointmentType === 'Home Visit' && (
              <div className='mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-4'>
                <p className='flex items-center gap-2 text-sm font-semibold text-gray-900'>
                  <Home className='h-4 w-4 text-emerald-600' />
                  Home visit address
                </p>
                <div className='mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2'>
                  <select
                    value={homeVisitAddress.area}
                    onChange={(event) => {
                      setHomeVisitAddress((previous) => ({ ...previous, area: event.target.value }))
                      setPendingPayment(null)
                    }}
                    className='rounded-lg border border-emerald-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400'
                  >
                    <option value=''>Choose supported area</option>
                    {supportedHomeVisitAreas.map((area) => <option key={area} value={area}>{area}</option>)}
                  </select>
                  <input
                    value={homeVisitAddress.street}
                    onChange={(event) => {
                      setHomeVisitAddress((previous) => ({ ...previous, street: event.target.value }))
                      setPendingPayment(null)
                    }}
                    className='rounded-lg border border-emerald-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400'
                    placeholder='Street name and number'
                  />
                  <input value={homeVisitAddress.building} onChange={(event) => setHomeVisitAddress((previous) => ({ ...previous, building: event.target.value }))} className='rounded-lg border border-emerald-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400' placeholder='Building' />
                  <input value={homeVisitAddress.floor} onChange={(event) => setHomeVisitAddress((previous) => ({ ...previous, floor: event.target.value }))} className='rounded-lg border border-emerald-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400' placeholder='Floor' />
                  <input value={homeVisitAddress.apartment} onChange={(event) => setHomeVisitAddress((previous) => ({ ...previous, apartment: event.target.value }))} className='rounded-lg border border-emerald-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400' placeholder='Apartment' />
                  <input value={homeVisitAddress.notes} onChange={(event) => setHomeVisitAddress((previous) => ({ ...previous, notes: event.target.value }))} className='rounded-lg border border-emerald-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-400' placeholder='Landmark or notes' />
                </div>
                <p className='mt-2 text-xs text-emerald-700'>Home visits are currently available only in the listed Cairo, Giza, and nearby areas.</p>
              </div>
            )}
            <div className='mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4'>
              <button
                type='button'
                onClick={() => setRatingsOpen((value) => !value)}
                className='flex w-full flex-col gap-2 text-left sm:flex-row sm:items-center sm:justify-between'
              >
                <span>
                  <span className='block text-sm font-semibold text-gray-900'>General rating for this doctor</span>
                  <span className='mt-1 flex items-center gap-2 text-sm text-gray-700'>
                    <StarRow value={ratingsData.summary?.averageRating || docInfo.ratingSummary?.averageRating} />
                    {ratingsData.summary?.ratingCount || docInfo.ratingSummary?.ratingCount
                      ? `${Number(ratingsData.summary?.averageRating || docInfo.ratingSummary?.averageRating || 0).toFixed(1)} from ${ratingsData.summary?.ratingCount || docInfo.ratingSummary?.ratingCount} ratings`
                      : 'No patient ratings yet'}
                  </span>
                </span>
                <span className='rounded-full bg-yellow-400 px-4 py-2 text-xs font-bold text-yellow-950'>
                  {ratingsOpen ? 'Hide ratings' : 'Show all ratings'}
                </span>
              </button>
              {ratingsOpen && (
                <div className='mt-4'>
                  {ratingsLoading ? (
                    <p className='text-sm text-gray-500'>Loading ratings...</p>
                  ) : (
                    <RatingsList ratings={ratingsData.ratings} />
                  )}
                </div>
              )}
            </div>
        </div>
      </div>


      {/* -------- Booking slots -------- */}
      <div className='sm:ml-72 sm:pl-4 mt-4 font-medium text-gray-700'>
        <p>Booking slots</p>

        <div className='flex gap-3 items-center w-full overflow-x-scroll mt-4' >
          {
            docSlots.length && docSlots.map((item, index) => (
             <div
              onClick={() => {
                if (!item.slots.length) return
                setSlotIndex(slotIndex === index ? null : index)
                setSlotTime('')
                setPendingPayment(null)
              }}
              className={`text-center py-6 min-w-16 rounded-full ${item.slots.length ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed bg-gray-100 text-gray-500'} ${slotIndex === index ? 'bg-primary text-white' : 'border border-gray-200'}`}
              key={index}
             >
              <p>{daysOfWeek[item.dateTime.getDay()]}</p>
              <p>{item.dateTime.getDate()}</p>
             </div>
            ))
          }
        </div>

        <div className='flex items-center gap-3 w-full overflow-x-scroll mt-4'>
          {docSlots.length && slotIndex !== null && docSlots[slotIndex].slots.map((item,index) => (
             <button
              type='button'
              disabled={!item.available}
              title={item.reason}
              onClick={() => {
                setSlotTime(slotTime === item.time ? '' : item.time)
                setPendingPayment(null)
              }}
              className={`text-sm font-light flex-shrink-0 px-5 py-2 rounded-full border ${
                item.time === slotTime
                  ? 'bg-primary text-white border-primary'
                  : item.available
                    ? 'bg-green-50 text-green-700 border-green-200 cursor-pointer hover:bg-green-100'
                    : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              }`}
              key={index}>
              {
                item.time.toLowerCase()
              }
             </button>
          ))}
          {slotIndex !== null && docSlots[slotIndex].slots.length === 0 && (
            <p className='text-sm text-gray-500'>No slots are configured for this day.</p>
          )}
        </div>

        <div className='mt-5 max-w-xl'>
          <p className='mb-3 text-sm font-medium text-gray-800'>Payment method</p>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
            <button
              type='button'
              onClick={() => {
                setPaymentMethod('Cash')
                setPendingPayment(null)
              }}
              className={`flex items-center gap-3 rounded-lg border p-4 text-left ${paymentMethod === 'Cash' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 bg-white text-gray-700'}`}
            >
              <Banknote className='h-5 w-5' />
              <span>
                <span className='block font-semibold'>Cash</span>
                <span className='text-xs text-gray-500'>Receptionist verifies at clinic</span>
              </span>
            </button>
            <button
              type='button'
              onClick={() => setPaymentMethod('Visa')}
              className={`flex items-center gap-3 rounded-lg border p-4 text-left ${paymentMethod === 'Visa' ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 bg-white text-gray-700'}`}
            >
              <CreditCard className='h-5 w-5' />
              <span>
                <span className='block font-semibold'>Visa</span>
                <span className='text-xs text-gray-500'>Pay first, then appointment is booked</span>
              </span>
            </button>
          </div>
        </div>

        {pendingPayment && (
          <div ref={paymentPanelRef} className='mt-5 max-w-xl scroll-mt-24'>
            <Elements stripe={stripePromise}>
              <StripePaymentForm
                pendingPayment={pendingPayment}
                confirmBookingStripePayment={confirmBookingStripePayment}
                currencySymbol={currencySymbol}
                onPaid={() => navigate('/my-appointments')}
              />
            </Elements>
          </div>
        )}
        
        <button 
          onClick={bookAppointment} 
          disabled={isBooking || pendingPayment}
          className={`text-white text-sm font-light px-14 py-3 rounded-full ${pendingPayment ? 'mt-3 mb-6' : 'my-6'} cursor-pointer ${isBooking || pendingPayment ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary'}`}>
          {isBooking ? 'Preparing payment...' : paymentMethod === 'Visa' ? 'Show Visa payment form' : 'Book an appointment'}
        </button>
        </div>


      {/* -------- Listing Related Doctors -------- */}
      <RelatedDoctors docId={docId}  speciality={docInfo.speciality}/>
    </div>
  )
}

export default Appointment
