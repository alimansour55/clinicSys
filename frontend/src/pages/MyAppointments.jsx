import React, { useContext, useEffect, useState } from 'react'
import { AppContext } from '../context/AppContext'
import { ArrowLeft, Calendar, Clock, FileText, Banknote,User,Stethoscope,Pill,FlaskConical,MapPin,BriefcaseMedical,Award,FilePlus,Thermometer,Clipboard, Star, Phone, Video, ExternalLink, Home} from 'lucide-react'
import { StarRow, formatRatingDate } from '../components/DoctorRating'
import { formatHomeVisitAddress } from '../utils/homeVisitAreas'

const MyAppointments = () => {
  
  const { appointments, calculateAge, slotDateFormat, currencySymbol, getUserAppointments, cancelAppointment, getUserPrescription, createDoctorRating, token } = useContext(AppContext)

  const [selectedPrescription, setSelectedPrescription] = useState(null)
  const [showPrescription, setShowPrescription] = useState(false)
  const [loading, setLoading] = useState(true)
  const [prescriptionLoading, setPrescriptionLoading] = useState(false)
  const [ratingDrafts, setRatingDrafts] = useState({})
  const [ratingLoadingId, setRatingLoadingId] = useState('')

  const getAppointmentMode = (appointment) => appointment.appointmentType || 'Clinic'
  const isRemoteAppointment = (appointment) => ['Voice Call', 'Video Call'].includes(getAppointmentMode(appointment))

  const viewPrescription = async (appointmentId) => {
    setPrescriptionLoading(true)  
    const prescription = await getUserPrescription(appointmentId)
    
    if (prescription) {
      setSelectedPrescription(prescription)
      setShowPrescription(true)
    }
    setPrescriptionLoading(false)
  }

  const closePrescription = () => {
    setSelectedPrescription(null)
    setShowPrescription(false)
  }

  const setDraftValue = (appointmentId, field, value) => {
    setRatingDrafts((previous) => ({
      ...previous,
      [appointmentId]: {
        rating: 0,
        comment: '',
        ...(previous[appointmentId] || {}),
        [field]: value
      }
    }))
  }

  const submitRating = async (appointmentId) => {
    const draft = ratingDrafts[appointmentId] || {}
    setRatingLoadingId(appointmentId)
    const saved = await createDoctorRating(appointmentId, draft.rating, draft.comment)
    if (saved) {
      setRatingDrafts((previous) => ({ ...previous, [appointmentId]: { rating: 0, comment: '' } }))
    }
    setRatingLoadingId('')
  }

  useEffect(() => {
  const fetchData = async () => {
    if (token) {
      setLoading(true);
      await getUserAppointments();
      setLoading(false);
    }
  };
  fetchData();
}, [token])


  // PRESCRIPTION DETAIL VIEW 
  if (showPrescription && selectedPrescription) {
    return (
      <div className='max-w-5xl mx-auto px-3 sm:px-4 md:px-6'>
        {/* Back Button & Header */}
        <div className='mb-4 sm:mb-6 md:mb-8 mt-4 sm:mt-5 md:mt-6'>
          <div className='flex items-center justify-between'>
            <button 
              onClick={closePrescription}
              className='flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition text-sm sm:text-base'
            >
              <ArrowLeft className='w-4 h-4 sm:w-5 sm:h-5' />
              <span className='font-medium'>Back to Appointments</span>
            </button>
            
            <div className='hidden md:flex items-center gap-2 lg:gap-3'>
              <div className='h-6 w-1 lg:h-8 lg:w-1.5 bg-primary rounded-full'></div>
              <h1 className='text-xl lg:text-2xl font-bold text-gray-900'>
                <span className='text-primary'>Prescription</span> Details
              </h1>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className='bg-white border border-gray-200 rounded-lg sm:rounded-xl shadow-sm overflow-hidden'>
          
          {/* Doctor Information */}
          <div className='bg-gradient-to-r from-blue-50 to-blue-100/50 border-b p-4 sm:p-5 md:p-6'>
            <h2 className='text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2 sm:gap-3'>
              <div className='p-1.5 sm:p-2 bg-white rounded-lg shadow-sm'>
                <BriefcaseMedical className='w-4 h-4 sm:w-5 sm:h-5 text-primary' />
              </div>
              Doctor Information
            </h2>
            <div className='flex items-start gap-3 sm:gap-4 md:gap-5'>
              <img
                className='w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-lg sm:rounded-xl object-cover border-2 border-white shadow'
                src={selectedPrescription.docData.image}
                alt="Doctor"
              />
              <div className='flex-1'>
                <div className='flex flex-wrap items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2'>
                  <p className='font-bold text-lg sm:text-xl md:text-2xl text-gray-900'>
                    Dr. {selectedPrescription.docData.name}
                  </p>
                  <span className='px-2 sm:px-3 py-0.5 sm:py-1 bg-primary text-white text-xs sm:text-sm font-semibold rounded-full'>
                    {selectedPrescription.docData.speciality}
                  </span>
                </div>
                <p className='text-sm sm:text-base text-gray-700 font-medium mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2'>
                  <Award className='w-3.5 h-3.5 sm:w-4 sm:h-4' />
                  {selectedPrescription.docData.degree}
                </p>
                <div className='flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600'>
                  <MapPin className='w-3.5 h-3.5 sm:w-4 sm:h-4' />
                  <span>{selectedPrescription.docData.address.line1}</span>
                  <span>{selectedPrescription.docData.address.line2}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Patient & Appointment Info */}
          <div className='grid md:grid-cols-2 gap-3 sm:gap-4 md:gap-5 p-4 sm:p-5 md:p-6'>
            {/* Patient Info */}
            <div className='bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-lg sm:rounded-xl p-3.5 sm:p-4 md:p-5'>
              <div className='flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4'>
                <User className='w-4 h-4 sm:w-5 sm:h-5 text-blue-600' />
                <h3 className='font-semibold text-sm sm:text-base text-gray-900'>Patient Information</h3>
              </div>
              <div className='flex items-center gap-3 sm:gap-4'>
                <img className='w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-lg border-2 border-white shadow' src={selectedPrescription.userData.image} alt="Patient" />
                <div>
                  <p className='font-bold text-base sm:text-lg text-gray-900'>{selectedPrescription.userData.name}</p>
                  <p className='text-gray-600 text-xs sm:text-sm mt-1 flex items-center gap-1.5'>
                    <span className='font-semibold text-gray-900'>Age:</span>{calculateAge(selectedPrescription.userData.dob)} years
                  </p>
                </div>
              </div>
            </div>

            {/* Appointment Details */}
            <div className='bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-lg sm:rounded-xl p-3.5 sm:p-4 md:p-5'>
              <div className='flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4'>
                <Calendar className='w-4 h-4 sm:w-5 sm:h-5 text-green-600' />
                <h3 className='font-semibold text-sm sm:text-base text-gray-900'>Appointment Details</h3>
              </div>

              <div className='space-y-2.5 sm:space-y-3 md:space-y-4'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2 sm:gap-3'>
                    <Calendar className='w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600' />
                    <span className='font-medium text-xs sm:text-sm text-gray-700'>Date</span>
                  </div>
                  <span className='font-semibold text-xs sm:text-sm text-gray-900'>{slotDateFormat(selectedPrescription.slotDate)}</span>
                </div>

                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2 sm:gap-3'>
                    <Clock className='w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600' />
                    <span className='font-medium text-xs sm:text-sm text-gray-700'>Time</span>
                  </div>
                  <span className='font-semibold text-xs sm:text-sm text-gray-900'>{selectedPrescription.slotTime}</span>
                </div>

                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2 sm:gap-3'>
                    <Banknote className='w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600' />
                    <span className='font-medium text-xs sm:text-sm text-gray-700'>Fees</span>
                  </div>
                  <span className='font-bold text-base sm:text-lg text-green-700'>{currencySymbol}{selectedPrescription.amount}</span>
                </div>

              </div>
            </div>
          </div>


          {/* Prescription Details Section */}
          <div className='px-4 sm:px-5 md:px-6 pb-4 sm:pb-5 md:pb-6 space-y-3 sm:space-y-4 md:space-y-5'>
            <div className='flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2'>
              <div className='p-1.5 sm:p-2 bg-primary/10 rounded-lg'>
                <FileText className='w-4 h-4 sm:w-5 sm:h-5 text-primary' />
              </div>
              <h2 className='text-base sm:text-lg font-semibold text-gray-900'>Prescription Details</h2>
            </div>

            {/* Diagnosis */}
            <div className='bg-white border border-gray-300 rounded-lg sm:rounded-xl p-3.5 sm:p-4 md:p-5'>
              <div className='flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3'>
                <Stethoscope className='w-4 h-4 sm:w-5 sm:h-5 text-blue-600' />
                <h3 className='font-medium text-sm sm:text-base text-gray-900'>Diagnosis</h3>
              </div>
              <p className='text-xs sm:text-sm md:text-base text-gray-800 bg-blue-50 p-3 sm:p-4 rounded-lg break-words'>{selectedPrescription.diagnosis}</p>
            </div>

            {/* Symptoms */}
            {selectedPrescription.symptoms && (
              <div className='bg-white border border-gray-300 rounded-lg sm:rounded-xl p-3.5 sm:p-4 md:p-5'>
                <div className='flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3'>
                  <Thermometer className='w-4 h-4 sm:w-5 sm:h-5 text-red-600' />
                  <h3 className='font-medium text-sm sm:text-base text-gray-900'>Symptoms</h3>
                </div>
                <p className='text-xs sm:text-sm md:text-base text-gray-800 bg-red-50 p-3 sm:p-4 rounded-lg break-words'>{selectedPrescription.symptoms}</p>
              </div>
            )}

            {/* Medicines */}
            {(selectedPrescription.medicationItems?.length || selectedPrescription.medicines) && (
              <div className='bg-white border border-gray-300 rounded-lg sm:rounded-xl p-3.5 sm:p-4 md:p-5'>
                <div className='flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3'>
                  <Pill className='w-4 h-4 sm:w-5 sm:h-5 text-green-600' />
                  <h3 className='font-medium text-sm sm:text-base text-gray-900'>Prescribed Medicines</h3>
                </div>
                {selectedPrescription.medicationItems?.length ? (
                  <div className='overflow-x-auto'>
                    <table className='w-full min-w-[620px] text-xs sm:text-sm border border-green-100 rounded-lg overflow-hidden'>
                      <thead className='bg-green-50 text-gray-700'>
                        <tr>
                          <th className='text-left p-2'>Medicine</th>
                          <th className='text-left p-2'>Dosage</th>
                          <th className='text-left p-2'>Frequency</th>
                          <th className='text-left p-2'>Duration</th>
                          <th className='text-left p-2'>Instructions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPrescription.medicationItems.map((item, index) => (
                          <tr key={index} className='border-t border-green-100'>
                            <td className='p-2 text-gray-800'>{item.name}</td>
                            <td className='p-2 text-gray-800'>{item.dosage}</td>
                            <td className='p-2 text-gray-800'>{item.frequency}</td>
                            <td className='p-2 text-gray-800'>{item.duration}</td>
                            <td className='p-2 text-gray-800'>{item.instructions || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className='text-xs sm:text-sm md:text-base text-gray-800 whitespace-pre-line bg-green-50 p-3 sm:p-4 rounded-lg break-words overflow-wrap-anywhere'>{selectedPrescription.medicines}</p>
                )}
              </div>
            )}

            {/* Instructions */}
            {selectedPrescription.instructions && (
              <div className='bg-white border border-gray-300 rounded-lg sm:rounded-xl p-3.5 sm:p-4 md:p-5'>
                <div className='flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3'>
                  <Clipboard className='w-5 h-5 sm:w-5 sm:h-5 text-yellow-600' />        
                  <h3 className='font-medium text-sm sm:text-base text-gray-900'>Instructions</h3>
                </div>
                <p className='text-xs sm:text-sm md:text-base text-gray-800 whitespace-pre-line bg-yellow-50 p-3 sm:p-4 rounded-lg break-words overflow-wrap-anywhere'>{selectedPrescription.instructions}</p>
              </div>
            )}

            {/* Lab Tests */}
            {selectedPrescription.labTests && (
              <div className='bg-white border border-gray-300 rounded-lg sm:rounded-xl p-3.5 sm:p-4 md:p-5'>
                <div className='flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3'>
                  <FlaskConical className='w-4 h-4 sm:w-5 sm:h-5 text-purple-600' />
                  <h3 className='font-medium text-sm sm:text-base text-gray-900'>Lab Tests Required</h3>
                </div>
                <p className='text-xs sm:text-sm md:text-base text-gray-800 bg-purple-50 p-3 sm:p-4 rounded-lg break-words'>{selectedPrescription.labTests}</p>
              </div>
            )}

            {/* Next Visit */}
            {selectedPrescription.nextVisit && (
              <div className='bg-white border border-gray-300 rounded-lg sm:rounded-xl p-3.5 sm:p-4 md:p-5'>
                <div className='flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3'>
                  <Calendar className='w-4 h-4 sm:w-5 sm:h-5 text-orange-600' />
                  <h3 className='font-medium text-sm sm:text-base text-gray-900'>Next Visit</h3>
                </div>
                <p className='text-xs sm:text-sm md:text-base text-gray-800 bg-orange-50 p-3 sm:p-4 rounded-lg font-medium break-words'>{selectedPrescription.nextVisit}</p>
              </div>
            )}

            {/* Documentation */}
            {selectedPrescription.documentation && (
              <div className='bg-white border border-gray-300 rounded-lg sm:rounded-xl p-3.5 sm:p-4 md:p-5'>
                <div className='flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3'>
                  <FilePlus className='w-4 h-4 sm:w-5 sm:h-5 text-gray-600' />
                  <h3 className='font-medium text-sm sm:text-base text-gray-900'>Documentation</h3>
                </div>
                <p className='text-xs sm:text-sm md:text-base text-gray-800 bg-gray-50 p-3 sm:p-4 rounded-lg break-words'>{selectedPrescription.documentation}</p>
              </div>
            )}
          </div>

          {/* Close Button */}
          <div className='px-4 sm:px-5 md:px-6 pb-4 sm:pb-5 md:pb-6'>
            <div className='border-t pt-4 sm:pt-5 md:pt-6'>
              <button
                onClick={closePrescription}
                className='w-full bg-primary text-white py-2.5 sm:py-3 md:py-3.5 rounded-lg sm:rounded-xl hover:bg-primary/90 transition font-semibold text-sm sm:text-base md:text-lg shadow-md hover:shadow-lg'
              >
                Close Prescription
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // APPOINTMENTS LIST VIEW 
return (
  <div>
    <h1 className="text-sm mt-8 sm:text-xl md:text-2xl font-bold text-gray-900 mb-3 border-b pb-3">
      My <span className="text-primary">Appointment</span>
    </h1>
    
    <div>
      {loading ? (
        // Loading Skeleton for Appointments
        <div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className='flex flex-col sm:flex-row gap-4 sm:gap-6 py-4 md:py-6 border-b border-gray-200 animate-pulse'>
              {/* Image Skeleton */}
              <div className='flex-shrink-0'>
                <div className='w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 bg-gray-200 rounded-lg'></div>
              </div>

              {/* Info Skeleton */}
              <div className='flex-1 min-w-0'>
                <div className='h-5 bg-gray-200 rounded w-1/3 mb-2'></div>
                <div className='h-4 bg-gray-200 rounded w-1/4 mb-4'></div>
                <div className='h-4 bg-gray-200 rounded w-1/5 mb-2'></div>
                <div className='h-3 bg-gray-200 rounded w-2/3 mb-1'></div>
                <div className='h-3 bg-gray-200 rounded w-1/2 mb-3'></div>
                <div className='h-3 bg-gray-200 rounded w-1/2'></div>
              </div>

              {/* Button Skeleton */}
              <div className='mt-4 sm:mt-0 sm:w-48'>
                <div className='h-10 bg-gray-200 rounded-lg'></div>
              </div>
            </div>
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <p className='text-center py-10 text-gray-500 text-sm md:text-base'>No appointments found</p>
      ) : (
        appointments.map((item, index) => (
          <div className='flex flex-col sm:flex-row gap-4 sm:gap-6 py-4 md:py-6 border-b border-gray-200' key={index} >
            {/* Doctor Image */}
            <div className='flex-shrink-0'>
              <img 
                className='w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 object-cover rounded-lg bg-indigo-50' 
                src={item.docData.image} 
                alt=""
              />
            </div>

            {/* Doctor Info */}
            <div className='flex-1 min-w-0'>
              <p className='text-neutral-800 font-semibold text-base md:text-lg'>{item.docData.name}</p>
              <p className='text-sm md:text-base text-zinc-600 mt-1'>{item.docData.speciality}</p>
              
              <p className='text-zinc-700 font-medium mt-3 md:mt-4 text-sm md:text-base'>{isRemoteAppointment(item) ? 'Consultation:' : item.appointmentType === 'Home Visit' ? 'Home visit address:' : 'Address:'}</p>
              {item.appointmentType === 'Home Visit' ? (
                <div className='mt-1 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs md:text-sm text-emerald-800'>
                  <p className='flex items-center gap-1.5 font-semibold'><Home className='h-4 w-4' />Home Visit</p>
                  <p className='mt-1'>{formatHomeVisitAddress(item.homeVisitAddress) || 'Home visit address will be confirmed.'}</p>
                  {item.homeVisitAddress?.notes && <p className='mt-1 text-emerald-700'>{item.homeVisitAddress.notes}</p>}
                </div>
              ) : isRemoteAppointment(item) ? (
                <div className='mt-1 flex flex-wrap items-center gap-2'>
                  <span className='inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700'>
                    {getAppointmentMode(item) === 'Video Call' ? <Video className='h-3.5 w-3.5' /> : <Phone className='h-3.5 w-3.5' />}
                    {getAppointmentMode(item)}
                  </span>
                  {item.teleconsultationLink && (
                    <a href={item.teleconsultationLink} target='_blank' rel='noreferrer' className='inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white'>
                      Join call <ExternalLink className='h-3.5 w-3.5' />
                    </a>
                  )}
                </div>
              ) : (
                <>
                  <p className='text-xs md:text-sm text-zinc-600'>{item.clinicLocation || item.docData.address?.line1}</p>
                  <p className='text-xs md:text-sm text-zinc-600'>{item.docData.address?.line2}</p>
                </>
              )}
              
              <p className='text-xs md:text-sm text-zinc-600 mt-3'>
                <span className='text-sm md:text-base text-neutral-700 font-medium'>Date & Time: </span> 
                {slotDateFormat(item.slotDate)} | {item.slotTime}
              </p>
              <div className='mt-3 flex flex-wrap gap-2 text-xs'>
                <span className={`rounded-full px-3 py-1 font-semibold ${item.paymentStatus === 'Paid' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                  {item.paymentStatus || 'Not Paid'}
                </span>
                <span className='rounded-full bg-gray-100 px-3 py-1 text-gray-700'>
                  {item.paymentMethod || 'No method selected'}
                </span>
                {item.refundStatus && item.refundStatus !== 'Not Refunded' && (
                  <span className='rounded-full bg-blue-50 px-3 py-1 text-blue-700'>
                    {item.refundStatus}
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className='mt-4 sm:mt-0 sm:w-auto sm:flex sm:flex-col sm:justify-end'>
              {!item.cancelled && !item.isCompleted && (
                <button onClick={() => cancelAppointment(item._id)} className='w-full sm:w-48 py-2 px-4 text-sm md:text-base text-stone-500 border border-gray-300 rounded-lg hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-all duration-300'>
                  Cancel appointment
                </button>
              )}
              
              {item.cancelled && !item.isCompleted && (
                <button className='w-full sm:w-56 py-2 px-4 text-sm md:text-base border border-red-300 rounded-lg text-red-600 bg-red-50'>
                  Appointment Cancelled
                </button>
              )}
              
              {item.isCompleted && (
                <div className='flex flex-col gap-3'>
                  <button className='w-full sm:w-48 py-2 px-4 text-sm md:text-base border border-green-300 rounded-lg text-green-600 bg-green-50'>
                    Completed
                  </button>
                  <button 
                    onClick={() => viewPrescription(item._id)}
                    disabled={prescriptionLoading}
                    className='w-full sm:w-48 py-2 px-4 text-sm md:text-base bg-primary text-white rounded-lg hover:bg-primary/90 transition-all duration-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
                  >
                    {prescriptionLoading ? (
                      <>
                        <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                        Loading...
                      </>
                    ) : (
                      'View Prescription'
                    )}
                  </button>
                  {item.myRating ? (
                    <div className='w-full sm:w-48 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-left'>
                      <div className='flex items-center gap-2'>
                        <StarRow value={item.myRating.rating} />
                        <span className='text-xs font-semibold text-gray-800'>{item.myRating.rating}/5</span>
                      </div>
                      <p className='mt-1 text-[11px] text-gray-500'>{formatRatingDate(item.myRating.createdAt)}</p>
                      {item.myRating.comment && <p className='mt-2 line-clamp-3 text-xs text-gray-700'>{item.myRating.comment}</p>}
                    </div>
                  ) : (
                    <div className='w-full sm:w-64 rounded-lg border border-yellow-200 bg-yellow-50 p-3'>
                      <p className='text-sm font-semibold text-gray-900'>Rate your experience</p>
                      <div className='mt-2 flex gap-1 text-yellow-400'>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type='button'
                            onClick={() => setDraftValue(item._id, 'rating', star)}
                            className='rounded p-0.5 hover:bg-yellow-100'
                            aria-label={`Rate ${star}`}
                          >
                            <Star className={`h-5 w-5 ${(ratingDrafts[item._id]?.rating || 0) >= star ? 'fill-current' : 'fill-none'}`} />
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={ratingDrafts[item._id]?.comment || ''}
                        onChange={(event) => setDraftValue(item._id, 'comment', event.target.value)}
                        rows={3}
                        maxLength={1000}
                        className='mt-2 w-full rounded-lg border border-yellow-200 bg-white p-2 text-xs outline-none focus:ring-2 focus:ring-yellow-300'
                        placeholder='Add a friendly comment'
                      />
                      <button
                        type='button'
                        onClick={() => submitRating(item._id)}
                        disabled={!ratingDrafts[item._id]?.rating || ratingLoadingId === item._id}
                        className='mt-2 w-full rounded-lg bg-yellow-400 px-3 py-2 text-xs font-bold text-yellow-950 disabled:cursor-not-allowed disabled:opacity-60'
                      >
                        {ratingLoadingId === item._id ? 'Saving...' : 'Submit rating'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  </div>
)
}

export default MyAppointments
