import React, { useContext, useEffect, useMemo, useState } from 'react'
import { AdminContext } from '../../context/AdminContext'
import { AppContext } from '../../context/AppContext'
import { ArrowLeft, CalendarClock, FileText, Mail, Phone, Search, Trash2, UserRound, UserRoundCheck, UserRoundX, WalletCards, X } from 'lucide-react'

const formatDateTime = (value) => {
  if (!value) return 'Not available'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString()
}

const Patients = () => {
  const {
    aToken,
    patients,
    getAllPatients,
    getPatientDetails,
    changePatientStatus,
    deletePatient
  } = useContext(AdminContext)
  const { calculateAge, slotDateFormat, currency } = useContext(AppContext)

  const [loading, setLoading] = useState(true)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [patientDetails, setPatientDetails] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    const fetchPatients = async () => {
      if (aToken) {
        setLoading(true)
        await getAllPatients()
        setLoading(false)
      }
    }

    fetchPatients()
  }, [aToken])

  const filteredPatients = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return patients.filter((patient) => {
      const isActive = patient.isActive !== false
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' && isActive)
        || (statusFilter === 'inactive' && !isActive)

      const matchesSearch = !query
        || patient.name?.toLowerCase().includes(query)
        || patient.email?.toLowerCase().includes(query)
        || patient.patientId?.toLowerCase().includes(query)
        || patient.phone?.toLowerCase().includes(query)

      return matchesStatus && matchesSearch
    })
  }, [patients, searchQuery, statusFilter])

  const selectPatient = async (patientId) => {
    setSelectedPatientId(patientId)
    setDetailsLoading(true)
    const details = await getPatientDetails(patientId)
    setPatientDetails(details)
    setDetailsLoading(false)
  }

  const refreshSelectedPatient = async () => {
    if (!selectedPatientId) return
    const details = await getPatientDetails(selectedPatientId)
    setPatientDetails(details)
  }

  const handleToggleStatus = async (patientId) => {
    const changed = await changePatientStatus(patientId)
    if (changed) refreshSelectedPatient()
  }

  const handleDeletePatient = async (patientId) => {
    const confirmed = window.confirm('Delete this patient profile permanently? Appointments and medical history snapshots will remain for records.')
    if (!confirmed) return

    const deleted = await deletePatient(patientId)
    if (deleted) {
      setSelectedPatientId('')
      setPatientDetails(null)
    }
  }

  if (selectedPatientId) {
    const patient = patientDetails?.patient
    const totals = patientDetails?.totals || {}
    const appointments = patientDetails?.appointments || []
    const prescriptions = patientDetails?.prescriptions || []

    return (
      <div className='w-full min-h-screen p-3 sm:p-5 md:p-6 lg:p-8 bg-gray-50'>
        <div className='max-w-6xl'>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5'>
            <button
              onClick={() => {
                setSelectedPatientId('')
                setPatientDetails(null)
              }}
              className='w-fit flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-lg transition text-sm font-medium'
            >
              <ArrowLeft className='w-4 h-4' />
              Back
            </button>

            {patient && (
              <div className='flex flex-wrap gap-2'>
                <button
                  onClick={() => handleToggleStatus(patient._id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition ${patient.isActive !== false ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                >
                  {patient.isActive !== false ? <UserRoundX className='w-4 h-4' /> : <UserRoundCheck className='w-4 h-4' />}
                  {patient.isActive !== false ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => handleDeletePatient(patient._id)}
                  className='flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-sm font-semibold transition'
                >
                  <Trash2 className='w-4 h-4' />
                  Delete
                </button>
              </div>
            )}
          </div>

          {detailsLoading ? (
            <div className='bg-white border border-gray-200 rounded-lg p-6 animate-pulse'>
              <div className='h-6 bg-gray-200 rounded w-56 mb-4'></div>
              <div className='h-4 bg-gray-200 rounded w-full mb-2'></div>
              <div className='h-4 bg-gray-200 rounded w-2/3'></div>
            </div>
          ) : patient ? (
            <>
              <div className='bg-white border border-gray-200 rounded-lg p-4 sm:p-6 mb-5'>
                <div className='flex flex-col md:flex-row md:items-center gap-4'>
                  <img className='w-24 h-24 rounded-full object-cover border border-gray-200 bg-gray-100' src={patient.image} alt={patient.name} />
                  <div className='flex-1 min-w-0'>
                    <div className='flex flex-wrap items-center gap-2 mb-2'>
                      <h1 className='text-xl sm:text-2xl font-bold text-gray-900 break-words'>{patient.name}</h1>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${patient.isActive !== false ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {patient.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className='text-sm text-gray-500 mb-3'>Patient ID: {patient.patientId || 'Not assigned'}</p>
                    <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700'>
                      <p className='flex items-center gap-2 min-w-0'><Mail className='w-4 h-4 text-blue-600 flex-shrink-0' /><span className='truncate'>{patient.email}</span></p>
                      <p className='flex items-center gap-2'><Phone className='w-4 h-4 text-blue-600 flex-shrink-0' />{patient.phone || 'Not provided'}</p>
                      <p>Gender: <span className='font-medium'>{patient.gender || 'Not selected'}</span></p>
                      <p>Age: <span className='font-medium'>{patient.dob && patient.dob !== 'Not Selected' ? `${calculateAge(patient.dob)} years` : 'Not available'}</span></p>
                    </div>
                  </div>
                </div>
              </div>

              <div className='bg-white border border-gray-200 rounded-lg p-4 sm:p-6 mb-5'>
                <div className='flex items-center justify-between gap-3 mb-3'>
                  <h2 className='font-semibold text-gray-800 flex items-center gap-2'>
                    <WalletCards className='w-5 h-5 text-emerald-600' />
                    Insurance
                  </h2>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${patient.insurance?.enabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {patient.insurance?.enabled ? 'Added' : 'Not added'}
                  </span>
                </div>
                {patient.insurance?.enabled ? (
                  <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-gray-700'>
                    <p><span className='font-medium'>Full Name:</span> {patient.insurance.fullName}</p>
                    <p><span className='font-medium'>Birth Date:</span> {patient.insurance.birthDate}</p>
                    <p><span className='font-medium'>ID Number:</span> {patient.insurance.idNumber}</p>
                    <p><span className='font-medium'>Expiry:</span> {patient.insurance.expiryDate}</p>
                    {patient.insurance.medicalCardPhoto && (
                      <a className='text-primary underline font-medium' href={patient.insurance.medicalCardPhoto} target='_blank' rel='noreferrer'>View medical card</a>
                    )}
                  </div>
                ) : (
                  <p className='text-sm text-gray-500'>No insurance information has been added for this patient.</p>
                )}
              </div>

              <div className='grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5'>
                {[
                  ['Appointments', totals.appointments || 0, 'bg-blue-50 text-blue-700'],
                  ['Paid', totals.paidAppointments || 0, 'bg-green-50 text-green-700'],
                  ['Unpaid', totals.unpaidAppointments || 0, 'bg-amber-50 text-amber-700'],
                  ['Completed', totals.completedAppointments || 0, 'bg-indigo-50 text-indigo-700'],
                  ['Revenue', `${currency}${totals.revenue || 0}`, 'bg-gray-100 text-gray-700']
                ].map(([label, value, color]) => (
                  <div key={label} className='bg-white border border-gray-200 rounded-lg p-4'>
                    <p className='text-xs text-gray-500 mb-1'>{label}</p>
                    <p className={`text-lg font-bold rounded-md ${color} px-2 py-1 inline-block`}>{value}</p>
                  </div>
                ))}
              </div>

              <div className='grid grid-cols-1 xl:grid-cols-2 gap-5'>
                <div className='bg-white border border-gray-200 rounded-lg overflow-hidden'>
                  <div className='flex items-center gap-2 px-4 py-3 border-b bg-gray-50'>
                    <CalendarClock className='w-5 h-5 text-blue-600' />
                    <h2 className='font-semibold text-gray-800'>Appointments</h2>
                  </div>
                  <div className='max-h-[430px] overflow-y-auto divide-y divide-gray-100'>
                    {appointments.length === 0 ? (
                      <p className='p-4 text-sm text-gray-500'>No appointments found.</p>
                    ) : appointments.map((appointment) => (
                      <div key={appointment._id} className='p-4 hover:bg-gray-50'>
                        <div className='flex items-start justify-between gap-3'>
                          <div>
                            <p className='font-semibold text-gray-800'>{appointment.docData?.name || 'Unknown doctor'}</p>
                            <p className='text-sm text-gray-500'>{slotDateFormat(appointment.slotDate)}, {appointment.slotTime}</p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${appointment.paymentStatus === 'Paid' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                            {appointment.paymentStatus}
                          </span>
                        </div>
                        <div className='mt-2 flex flex-wrap gap-2 text-xs text-gray-600'>
                          <span className='px-2 py-1 bg-gray-100 rounded-full'>{appointment.appointmentStatus}</span>
                          <span className='px-2 py-1 bg-gray-100 rounded-full'>{currency}{appointment.amount}</span>
                          <span className='px-2 py-1 bg-gray-100 rounded-full'>{appointment.bookedBy}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className='bg-white border border-gray-200 rounded-lg overflow-hidden'>
                  <div className='flex items-center gap-2 px-4 py-3 border-b bg-gray-50'>
                    <FileText className='w-5 h-5 text-blue-600' />
                    <h2 className='font-semibold text-gray-800'>Medical History</h2>
                  </div>
                  <div className='max-h-[430px] overflow-y-auto divide-y divide-gray-100'>
                    {prescriptions.length === 0 ? (
                      <p className='p-4 text-sm text-gray-500'>No medical history found.</p>
                    ) : prescriptions.map((prescription) => (
                      <div key={prescription._id} className='p-4 hover:bg-gray-50'>
                        <div className='flex items-start justify-between gap-3'>
                          <div>
                            <p className='font-semibold text-gray-800'>{prescription.diagnosis}</p>
                            <p className='text-sm text-gray-500'>{prescription.docData?.name || 'Unknown doctor'} - {slotDateFormat(prescription.slotDate)}</p>
                          </div>
                          <span className='px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold'>
                            {prescription.isEdited ? 'Edited' : 'Final'}
                          </span>
                        </div>
                        <p className='mt-2 text-sm text-gray-600 line-clamp-2'>{prescription.instructions}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className='bg-white border border-gray-200 rounded-lg p-6 text-gray-500'>Patient details could not be loaded.</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className='w-full p-3 sm:p-5 md:p-6 lg:p-8'>
      <div className='max-w-6xl'>
        <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5'>
          <div>
            <h1 className='text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2'>
              <UserRound className='w-6 h-6 text-blue-600' />
              Patients
            </h1>
            <p className='text-sm text-gray-600 mt-1'>View profiles, patient details, account status, appointments, and medical records.</p>
          </div>

          <div className='flex flex-col sm:flex-row gap-2 w-full lg:w-auto'>
            <div className='relative flex-1 lg:w-80'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
              <input
                type='text'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder='Search name, ID, email, phone'
                className='w-full pl-10 pr-9 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600'>
                  <X className='w-4 h-4' />
                </button>
              )}
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className='border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'
            >
              <option value='all'>All status</option>
              <option value='active'>Active</option>
              <option value='inactive'>Inactive</option>
            </select>
          </div>
        </div>

        <div className='flex flex-wrap gap-2 mb-4 text-xs'>
          <span className='px-3 py-1 rounded-full bg-blue-50 text-blue-700'>Total: {patients.length}</span>
          <span className='px-3 py-1 rounded-full bg-green-50 text-green-700'>Active: {patients.filter((patient) => patient.isActive !== false).length}</span>
          <span className='px-3 py-1 rounded-full bg-red-50 text-red-700'>Inactive: {patients.filter((patient) => patient.isActive === false).length}</span>
          <span className='px-3 py-1 rounded-full bg-gray-100 text-gray-700'>Showing: {filteredPatients.length}</span>
        </div>

        <div className='bg-white border border-gray-200 rounded-lg overflow-hidden'>
          <div className='hidden lg:grid grid-cols-[1.4fr_1.8fr_1fr_1fr_1fr_1fr] gap-3 px-4 py-3 bg-gray-50 border-b text-sm font-semibold text-gray-700'>
            <p>Patient</p>
            <p>Contact</p>
            <p>Patient ID</p>
            <p>Appointments</p>
            <p>Status</p>
            <p>Joined</p>
          </div>

          {loading ? (
            [...Array(8)].map((_, index) => (
              <div key={index} className='px-4 py-4 border-b animate-pulse'>
                <div className='h-4 bg-gray-200 rounded w-3/4 mb-2'></div>
                <div className='h-3 bg-gray-200 rounded w-1/2'></div>
              </div>
            ))
          ) : filteredPatients.length === 0 ? (
            <div className='p-8 text-center text-gray-500'>No patients found.</div>
          ) : (
            filteredPatients.map((patient) => (
              <button
                key={patient._id}
                onClick={() => selectPatient(patient._id)}
                className='w-full text-left grid grid-cols-1 lg:grid-cols-[1.4fr_1.8fr_1fr_1fr_1fr_1fr] gap-2 lg:gap-3 px-4 py-4 border-b hover:bg-gray-50 transition'
              >
                <div className='flex items-center gap-3 min-w-0'>
                  <img className='w-11 h-11 rounded-full object-cover bg-gray-100 border border-gray-200 flex-shrink-0' src={patient.image} alt={patient.name} />
                  <div className='min-w-0'>
                    <p className='font-semibold text-gray-800 truncate'>{patient.name}</p>
                    <p className='text-xs text-gray-500 lg:hidden'>{patient.patientId}</p>
                  </div>
                </div>

                <div className='text-sm text-gray-600 min-w-0'>
                  <p className='truncate'>{patient.email}</p>
                  <p className='text-xs text-gray-500'>{patient.phone || 'No phone'}</p>
                </div>
                <p className='hidden lg:block text-sm text-gray-700'>{patient.patientId || 'Not assigned'}</p>
                <p className='text-sm text-gray-700 flex items-center gap-1'><WalletCards className='w-4 h-4 text-blue-600 lg:hidden' />{patient.appointmentStats?.appointments || 0}</p>
                <p>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${patient.isActive !== false ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {patient.isActive !== false ? 'Active' : 'Inactive'}
                  </span>
                </p>
                <p className='text-sm text-gray-500'>{formatDateTime(patient.createdAt)}</p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default Patients
