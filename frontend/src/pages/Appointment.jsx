import React, { useContext, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import { assets } from '../assets/assets'
import RelatedDoctors from '../components/RelatedDoctors'
import { toast } from 'react-toastify'
import axios from 'axios'
import { buildDoctorSlots } from '../utils/schedule'


const Appointment = () => {
  
  const {docId} = useParams()
  const {doctors, currencySymbol, backendUrl, token, getDoctorsData} = useContext(AppContext)
  const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

  const navigate = useNavigate()
  
  const [slotIndex, setSlotIndex] = useState(null)
  const [slotTime, setSlotTime] = useState('')

  const [isBooking, setIsBooking] = useState(false)
  

  const docInfo = useMemo(() => doctors.find(doc => doc._id === docId), [doctors, docId])
  const docSlots = useMemo(() => docInfo ? buildDoctorSlots(docInfo) : [], [docInfo])


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

    setIsBooking(true)  // Booking start

    try {
      
    const date = docSlots[slotIndex].dateTime

    let day = date.getDate()
    let month = date.getMonth()+1
    let year = date.getFullYear()

    const slotDate = day + "_" + month + "_" + year
    
    const { data } = await axios.post(backendUrl + '/api/user/book-appointment', {docId, slotDate, slotTime}, {headers: {token}});
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
          <img className='bg-primary w-full sm:max-w-72 rounded-lg' src={docInfo.image} alt="" />
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
              onClick={() => setSlotTime(slotTime === item.time ? '' : item.time)}
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
        
        <button 
          onClick={bookAppointment} 
          disabled={isBooking}
          className={`text-white text-sm font-light px-14 py-3 rounded-full my-6 cursor-pointer ${isBooking ? 'bg-gray-400 cursor-not-allowed' : 'bg-primary'}`}>
          {isBooking ? 'Booking...' : 'Book an appointment'}
        </button>
        </div>


      {/* -------- Listing Related Doctors -------- */}
      <RelatedDoctors docId={docId}  speciality={docInfo.speciality}/>
    </div>
  )
}

export default Appointment
