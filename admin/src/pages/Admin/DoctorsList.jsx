import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AdminContext } from '../../context/AdminContext'
import { ArrowLeft, ChevronDown, Edit2, Loader2, Mail, Phone, Stethoscope, User, Info, FileText, CheckCircle, Save, X, Lock, Camera, Building2, MapPin, Plus, Percent, Wallet } from 'lucide-react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { RatingBadge, RatingsList, StarRow } from '../../components/DoctorRating'
import { AppContext } from '../../context/AppContext'
import { formatExperienceEn, parseExperienceYears } from '../../utils/doctorExperience'
import { hasDoctorCustomVisitFees, normalizeGlobalVisitFees } from '../../utils/globalVisitFees'
import DoctorsDirectoryTable from '../../components/admin/DoctorsDirectoryTable'

const DoctorsList = () => {
  const { doctors, aToken, getAllDoctors, changeAvailability, backendUrl, getDoctorRatings, deleteDoctorRating, siteSettings, getSiteSettings } = useContext(AdminContext)
  const { currency } = useContext(AppContext)
  const location = useLocation()
  const navigate = useNavigate()
  const lastHandledUsersLinkKey = useRef(null)
  const [selectedDoctorId, setSelectedDoctorId] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [ratingsData, setRatingsData] = useState({ summary: { averageRating: 0, ratingCount: 0 }, ratings: [] })
  const [ratingsLoading, setRatingsLoading] = useState(false)

  const [doctorsLoading, setDoctorsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [availabilityFilter, setAvailabilityFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [refreshing, setRefreshing] = useState(false)

  const specialities = [
    'General physician',
    'Gynecologist',
    'Dermatologist',
    'Pediatricians',
    'Neurologist',
    'Gastroenterologist'
  ]

  useEffect(() => {
  const fetchData = async () => {
    if (aToken) {
      setDoctorsLoading(true);
      await Promise.all([getAllDoctors(), getSiteSettings()]);
      setDoctorsLoading(false);
    }
   };
   fetchData();
  }, [aToken])

  const globalVisitFees = useMemo(
    () => normalizeGlobalVisitFees(siteSettings?.globalVisitFees),
    [siteSettings]
  )

  useEffect(() => {
    const targetId = location.state?.openDoctorId
    if (!targetId || doctorsLoading) return
    if (lastHandledUsersLinkKey.current === location.key) return
    lastHandledUsersLinkKey.current = location.key
    const found = doctors.some((d) => String(d._id) === String(targetId))
    navigate(location.pathname, { replace: true, state: {} })
    if (found) setSelectedDoctorId(targetId)
  }, [doctors, doctorsLoading, location.pathname, location.state, location.key, navigate])

  const selectedDoctor = doctors.find(d => d._id === selectedDoctorId)

  const doctorStats = useMemo(() => {
    const total = doctors.length
    const available = doctors.filter((d) => d.available !== false).length
    const unavailable = total - available
    return { total, available, unavailable }
  }, [doctors])

  const filteredDoctors = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return doctors.filter((doctor) => {
      const matchesAvailability =
        availabilityFilter === 'all'
        || (availabilityFilter === 'available' && doctor.available !== false)
        || (availabilityFilter === 'unavailable' && doctor.available === false)
      const locations = (doctor.locations || []).join(' ')
      const matchesSearch = !query
        || doctor.name?.toLowerCase().includes(query)
        || doctor.email?.toLowerCase().includes(query)
        || doctor.speciality?.toLowerCase().includes(query)
        || doctor.phone?.toLowerCase().includes(query)
        || locations.toLowerCase().includes(query)
      return matchesAvailability && matchesSearch
    })
  }, [doctors, searchQuery, availabilityFilter])

  const sortedDoctors = useMemo(() => {
    const list = [...filteredDoctors]
    const dir = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (sortBy === 'fees') {
        const va = Number(a.fees || 0)
        const vb = Number(b.fees || 0)
        return va === vb ? (a.name || '').localeCompare(b.name || '') : (va - vb) * dir
      }
      if (sortBy === 'speciality') {
        return (a.speciality || '').localeCompare(b.speciality || '', undefined, { sensitivity: 'base' }) * dir
      }
      return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }) * dir
    })
    return list
  }, [filteredDoctors, sortBy, sortDir])

  const handleRefreshDoctors = async () => {
    if (!aToken) return
    setRefreshing(true)
    await getAllDoctors()
    setRefreshing(false)
  }

  useEffect(() => {
    const loadRatings = async () => {
      if (!selectedDoctorId) return
      setRatingsLoading(true)
      const data = await getDoctorRatings(selectedDoctorId)
      setRatingsData(data)
      setRatingsLoading(false)
    }
    loadRatings()
  }, [selectedDoctorId])

  const startEditing = () => {
    setEditForm({
      name: selectedDoctor.name,
      email: selectedDoctor.email,
      phone: selectedDoctor.phone,
      password: '',
      speciality: selectedDoctor.speciality,
      degree: selectedDoctor.degree,
      gender: selectedDoctor.gender || '',
      title: selectedDoctor.title || '',
      experience: parseExperienceYears(selectedDoctor.experience) ?? '',
      about: selectedDoctor.about,
      fees: hasDoctorCustomVisitFees(selectedDoctor) ? selectedDoctor.fees : '',
      acceptsCash: selectedDoctor.acceptsCash !== false,
      acceptsOnlinePayment: selectedDoctor.acceptsOnlinePayment !== false,
      promoCode: {
        code: selectedDoctor.promoCode?.code || '',
        discountType: selectedDoctor.promoCode?.discountType || 'percentage',
        discountValue: selectedDoctor.promoCode?.discountValue || '',
        active: Boolean(selectedDoctor.promoCode?.active)
      },
      address: selectedDoctor.address ? { 
        line1: selectedDoctor.address.line1 || '',
        line2: selectedDoctor.address.line2 || ''
      } : { line1: '', line2: '' },
      locations: selectedDoctor.locations?.length ? [...selectedDoctor.locations] : [''],
      financialCompensation: {
        mode:
          selectedDoctor.financialCompensation?.mode === 'fixed'
            ? 'fixed'
            : selectedDoctor.financialCompensation?.mode === 'hybrid'
              ? 'hybrid'
              : 'percentage',
        percentageEnabled: Boolean(selectedDoctor.financialCompensation?.percentageEnabled),
        percentage: Math.min(100, Math.max(0, Number(selectedDoctor.financialCompensation?.percentage ?? 50))),
        fixedSalary: Math.max(0, Number(selectedDoctor.financialCompensation?.fixedSalary ?? 0))
      }
    })
    setImageFile(null)
    setImagePreview(null)
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setEditForm({})
    setImageFile(null)
    setImagePreview(null)
  }

  const handleChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }))
  }

  const handleLocationChange = (index, value) => {
    setEditForm(prev => ({
      ...prev,
      locations: (prev.locations || ['']).map((location, itemIndex) => itemIndex === index ? value : location)
    }))
  }

  const patchFinancialCompensation = (patch) => {
    setEditForm((prev) => ({
      ...prev,
      financialCompensation: { ...(prev.financialCompensation || {}), ...patch }
    }))
  }

  const addLocation = () => {
    setEditForm(prev => ({ ...prev, locations: [...(prev.locations || []), ''] }))
  }

  const removeLocation = (index) => {
    setEditForm(prev => ({ ...prev, locations: (prev.locations || []).filter((_, itemIndex) => itemIndex !== index) }))
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => setImagePreview(reader.result)
      reader.readAsDataURL(file)
    }
  }

  const saveChanges = async () => {
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('docId', selectedDoctorId)
      formData.append('name', editForm.name)
      formData.append('email', editForm.email)
      formData.append('phone', editForm.phone)
      formData.append('speciality', editForm.speciality)
      formData.append('degree', editForm.degree)
      formData.append('gender', editForm.gender || '')
      formData.append('title', editForm.title || '')
      formData.append('experience', editForm.experience)
      formData.append('about', editForm.about)
      formData.append('fees', editForm.fees)
      formData.append('acceptsCash', editForm.acceptsCash)
      formData.append('acceptsOnlinePayment', editForm.acceptsOnlinePayment)
      formData.append('promoCode', JSON.stringify(editForm.promoCode || {}))
      formData.append('address', JSON.stringify({
        line1: String(editForm.address?.line1 || '').trim(),
        line2: String(editForm.address?.line2 || '').trim()
      }))
      formData.append('locations', JSON.stringify((editForm.locations || []).map((location) => location.trim()).filter(Boolean)))
      formData.append('financialCompensation', JSON.stringify(editForm.financialCompensation || {}))

      if (editForm.password?.trim()) {
        formData.append('password', editForm.password)
      }

      if (imageFile) {
        formData.append('image', imageFile)
      }

      const { data } = await axios.post(
        backendUrl + '/api/admin/update-doctor',
        formData,
        { 
          headers: { 
            aToken,
            'Content-Type': 'multipart/form-data'
          } 
        }
      )

      if(data.success) {
        toast.success(data.message)
        setIsEditing(false)
        setImageFile(null)
        setImagePreview(null)
        await getAllDoctors()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
    }

  const toggleAvailability = async (doctorId, nextAvailable, e) => {
    e?.stopPropagation?.()
    try {
      await changeAvailability(doctorId, nextAvailable)
      await getAllDoctors()
    } catch (error) {
      console.error('Error:', error)
    }
  }

  const handleDeleteRating = async (ratingId) => {
    const deleted = await deleteDoctorRating(ratingId)
    if (deleted && selectedDoctorId) {
      const data = await getDoctorRatings(selectedDoctorId)
      setRatingsData(data)
    }
  }

  // Detail View
  if (selectedDoctorId && selectedDoctor) {
    const displayData = isEditing ? editForm : selectedDoctor

    return (
      <div className='w-full min-h-screen p-3 sm:p-5 md:p-6 lg:p-8 bg-gray-50'>
        <div className='max-w-6xl'>
          
          {/* Header */}
          <div className='flex items-center justify-between mb-4 sm:mb-6'>
            <button 
              onClick={() => {
                setSelectedDoctorId(null)
                setIsEditing(false)
                setImageFile(null)
                setImagePreview(null)
              }}
              className='flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition font-medium text-sm sm:text-base'>
              <ArrowLeft className='w-4 h-4 sm:w-5 sm:h-5' />
              <span className='hidden sm:inline'>Back</span>
            </button>
            
            {!isEditing ? (
              <button 
                onClick={startEditing}
                className='flex items-center gap-2 px-3 sm:px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition font-medium text-sm sm:text-base'>
                <Edit2 className='w-4 h-4 sm:w-5 sm:h-5' />
                <span className='hidden sm:inline'>Edit Profile</span>
                <span className='sm:hidden'>Edit</span>
              </button>
            ) : (
              <div className='flex gap-2'>
                <button 
                  onClick={cancelEditing}
                  className='flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition font-medium text-sm sm:text-base'>
                  <X className='w-4 h-4 sm:w-5 sm:h-5' />
                  <span className='hidden sm:inline'>Cancel</span>
                </button>
                <button 
                  onClick={saveChanges}
                  disabled={loading}
                  className='flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium disabled:bg-blue-400 disabled:cursor-not-allowed text-sm sm:text-base'
                >
                  <Save className='w-4 h-4 sm:w-5 sm:h-5' />
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>

          {/* Doctor Info Card */}
          <div className='bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6 border border-blue-100'>
            <h3 className='text-base sm:text-lg font-bold text-gray-800 mb-4 flex items-center gap-2'>
              <User className='w-5 h-5 text-blue-600' />
              Doctor Information
            </h3>
            
            <div className='flex flex-col sm:flex-row items-center sm:items-start gap-4'>
              <div className='relative flex-shrink-0'>
                <img className='w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full border-4 border-white shadow-lg object-cover'
                  src={imagePreview || selectedDoctor.image}
                  alt={selectedDoctor.name} />
                {!isEditing && <RatingBadge summary={selectedDoctor.ratingSummary || ratingsData.summary} className='absolute left-1 top-1' />}
                {isEditing && (
                  <label className='absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white p-2 sm:p-2.5 rounded-full cursor-pointer shadow-lg transition'>
                    <Camera className='w-4 h-4 sm:w-5 sm:h-5' />
                    <input type='file' accept='image/*' onChange={handleImageChange} className='hidden' />
                  </label>
                )}
              </div>
              
              <div className='flex-1 w-full text-center sm:text-left'>
                {isEditing ? (
                  <input
                    type='text'
                    value={editForm.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder='Doctor Name'
                    className='w-full px-3 sm:px-4 py-2 text-lg sm:text-xl md:text-2xl font-bold text-gray-800 border border-gray-300 rounded-lg mb-3 focus:ring-2 focus:ring-blue-500 focus:outline-none'
                  />
                ) : (
                  <h2 className='text-xl sm:text-2xl md:text-3xl font-bold text-gray-800 mb-3'>{selectedDoctor.name}</h2>
                )}
                
                <div className='flex flex-wrap justify-center sm:justify-start gap-2'>
                  <span className='inline-flex items-center gap-1.5 bg-indigo-600 text-white text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-full'>
                    <CheckCircle className='w-4 h-4' />
                    {displayData.speciality}
                  </span>
                  {displayData.title && (
                    <span className='inline-flex items-center gap-1.5 bg-white text-indigo-700 text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-full border border-indigo-200'>
                      {displayData.title}
                    </span>
                  )}
                  {displayData.gender && (
                    <span className='inline-flex items-center gap-1.5 bg-white text-gray-700 text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-full border border-gray-200'>
                      {displayData.gender}
                    </span>
                  )}

                  {(selectedDoctor.clinics || []).map((clinic) => (
                    <span key={clinic._id || clinic} className='inline-flex items-center gap-1.5 bg-blue-100 text-blue-700 text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-full'>
                      <Building2 className='w-4 h-4' />
                      {clinic.name || clinic}
                    </span>
                  ))}
                  
                  <span className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-full ${selectedDoctor.available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {selectedDoctor.available ? 'Available' : 'Not Available'}
                  </span>
                  <span className='inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-full bg-yellow-100 text-yellow-800'>
                    <StarRow value={ratingsData.summary?.averageRating || selectedDoctor.ratingSummary?.averageRating} />
                    {ratingsData.summary?.ratingCount || selectedDoctor.ratingSummary?.ratingCount
                      ? `${Number(ratingsData.summary?.averageRating || selectedDoctor.ratingSummary?.averageRating || 0).toFixed(1)} from ${ratingsData.summary?.ratingCount || selectedDoctor.ratingSummary?.ratingCount}`
                      : 'No ratings'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className='bg-white rounded-xl border border-yellow-200 p-4 sm:p-6 mb-4 sm:mb-6'>
            <h3 className='text-base sm:text-lg font-bold text-gray-800 mb-3 flex items-center gap-2'>
              <StarRow value={ratingsData.summary?.averageRating || selectedDoctor.ratingSummary?.averageRating} />
              Patient Ratings
            </h3>
            {ratingsLoading ? <p className='text-sm text-gray-500'>Loading ratings...</p> : <RatingsList ratings={ratingsData.ratings} canDelete onDelete={handleDeleteRating} />}
          </div>

          {/* Details Grid */}
          <div className='bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6'>
            <h3 className='text-base sm:text-lg font-bold text-gray-800 mb-4 flex items-center gap-2'>
              <Info className='w-5 h-5 text-blue-600' />
              Complete Details
            </h3>
            
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6'>
              
              {/* Personal Information */}
              <div>
                <h4 className='text-sm sm:text-base font-semibold text-gray-700 mb-3 pb-2 border-b'>Personal Information</h4>
                <div className='space-y-3'>
                  
                  <div className='rounded-lg p-3 bg-gray-50 border border-gray-100'>
                    <label className='text-xs sm:text-sm text-gray-600 mb-1 block font-medium'>Email</label>
                    {isEditing ? (
                      <input
                        type='email'
                        value={editForm.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        className='w-full px-3 py-2 text-sm text-gray-900 font-medium border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white'
                      />
                    ) : (
                      <p className='text-sm text-gray-900 font-medium break-all'>{selectedDoctor.email}</p>
                    )}
                  </div>

                  {isEditing && (
                    <div className='rounded-lg p-3 bg-yellow-50 border border-yellow-200'>
                      <label className='text-xs sm:text-sm text-gray-600 mb-1 block font-medium flex items-center gap-1.5'>
                        <Lock className='w-4 h-4' />
                        New Password (Optional)
                      </label>
                      <input
                        type='password'
                        value={editForm.password}
                        onChange={(e) => handleChange('password', e.target.value)}
                        placeholder='Leave empty to keep current password'
                        className='w-full px-3 py-2 text-sm text-gray-900 font-medium border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white'
                      />
                      <p className='text-xs text-gray-500 mt-1'>Minimum 8 characters required</p>
                    </div>
                  )}
                  
                  <div className='rounded-lg p-3 bg-gray-50 border border-gray-100'>
                    <label className='text-xs sm:text-sm text-gray-600 mb-1 block font-medium'>Phone</label>
                    {isEditing ? (
                      <input
                        type='text'
                        value={editForm.phone}
                        onChange={(e) => handleChange('phone', e.target.value)}
                        className='w-full px-3 py-2 text-sm text-gray-900 font-medium border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white'
                      />
                    ) : (
                      <p className='text-sm text-gray-900 font-medium'>{selectedDoctor.phone}</p>
                    )}
                  </div>
                  
                  <div className='rounded-lg p-3 bg-blue-50 border border-blue-100'>
                    <label className='text-xs sm:text-sm text-gray-600 mb-2 block font-medium'>Clinic Locations</label>
                    {isEditing ? (
                      <div className='space-y-2'>
                        {(editForm.locations || ['']).map((location, index) => (
                          <div key={index} className='flex items-center gap-2'>
                            <MapPin className='w-4 h-4 text-blue-600 flex-shrink-0' />
                            <input
                              type='text'
                              value={location}
                              onChange={(e) => handleLocationChange(index, e.target.value)}
                              placeholder='e.g., Mohandseen'
                              className='w-full px-3 py-2 text-sm text-gray-900 font-medium border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white'
                            />
                            {(editForm.locations || []).length > 1 && (
                              <button type='button' onClick={() => removeLocation(index)} className='px-2 py-2 rounded border border-red-200 text-red-600 hover:bg-red-50'>
                                <X className='w-4 h-4' />
                              </button>
                            )}
                          </div>
                        ))}
                        <button type='button' onClick={addLocation} className='inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50'>
                          <Plus className='w-3.5 h-3.5' />
                          Add location
                        </button>
                      </div>
                    ) : (
                      <p className='text-sm text-gray-900 font-medium'>{selectedDoctor.locations?.length ? selectedDoctor.locations.join(', ') : 'Not provided'}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Professional Information */}
              <div>
                <h4 className='text-sm sm:text-base font-semibold text-gray-700 mb-3 pb-2 border-b'>Professional Details</h4>
                <div className='space-y-3'>
                  
                  <div className='rounded-lg p-3 bg-indigo-50 border border-indigo-100'>
                    <label className='text-xs sm:text-sm text-gray-600 mb-1 block font-medium'>Speciality</label>
                    {isEditing ? (
                      <select
                        value={editForm.speciality}
                        onChange={(e) => handleChange('speciality', e.target.value)}
                        className='w-full px-3 py-2 text-sm text-gray-900 font-medium border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white'
                      >
                        <option value=''>Select Speciality</option>
                        {specialities.map((spec, idx) => (
                          <option key={idx} value={spec}>{spec}</option>
                        ))}
                      </select>
                    ) : (
                      <p className='text-sm text-gray-900 font-medium'>{selectedDoctor.speciality}</p>
                    )}
                  </div>
                  
                  <div className='rounded-lg p-3 bg-indigo-50 border border-indigo-100'>
                    <label className='text-xs sm:text-sm text-gray-600 mb-1 block font-medium'>Degree</label>
                    {isEditing ? (
                      <input
                        type='text'
                        value={editForm.degree}
                        onChange={(e) => handleChange('degree', e.target.value)}
                        className='w-full px-3 py-2 text-sm text-gray-900 font-medium border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white'
                      />
                    ) : (
                      <p className='text-sm text-gray-900 font-medium'>{selectedDoctor.degree}</p>
                    )}
                  </div>

                  <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                    <div className='rounded-lg p-3 bg-indigo-50 border border-indigo-100'>
                      <label className='text-xs sm:text-sm text-gray-600 mb-1 block font-medium'>Gender</label>
                      {isEditing ? (
                        <select value={editForm.gender || ''} onChange={(e) => handleChange('gender', e.target.value)} className='w-full px-3 py-2 text-sm text-gray-900 font-medium border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white'>
                          <option value=''>Choose gender</option>
                          <option value='Female'>Female</option>
                          <option value='Male'>Male</option>
                        </select>
                      ) : (
                        <p className='text-sm text-gray-900 font-medium'>{selectedDoctor.gender || 'Not set'}</p>
                      )}
                    </div>
                    <div className='rounded-lg p-3 bg-indigo-50 border border-indigo-100'>
                      <label className='text-xs sm:text-sm text-gray-600 mb-1 block font-medium'>Title</label>
                      {isEditing ? (
                        <select value={editForm.title || ''} onChange={(e) => handleChange('title', e.target.value)} className='w-full px-3 py-2 text-sm text-gray-900 font-medium border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white'>
                          <option value=''>Choose title</option>
                          <option value='Professor'>Professor</option>
                          <option value='Lecturer'>Lecturer</option>
                          <option value='Consultant'>Consultant</option>
                          <option value='Specialist'>Specialist</option>
                        </select>
                      ) : (
                        <p className='text-sm text-gray-900 font-medium'>{selectedDoctor.title || 'Not set'}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className='rounded-lg p-3 bg-indigo-50 border border-indigo-100'>
                    <label className='text-xs sm:text-sm text-gray-600 mb-1 block font-medium'>Years of experience</label>
                    {isEditing ? (
                      <div className='flex flex-wrap items-center gap-2'>
                        <input
                          type='number'
                          min={0}
                          max={100}
                          value={editForm.experience}
                          onChange={(e) => handleChange('experience', e.target.value)}
                          className='w-24 px-3 py-2 text-sm text-gray-900 font-medium border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white'
                        />
                        <span className='text-sm text-gray-600'>years of experience</span>
                      </div>
                    ) : (
                      <p className='text-sm text-gray-900 font-medium'>{formatExperienceEn(selectedDoctor.experience) || '—'}</p>
                    )}
                  </div>
                  
                  <div className='rounded-lg p-3 bg-green-50 border border-green-100'>
                    <label className='text-xs sm:text-sm text-gray-600 mb-1 block font-medium'>Examination fee (optional)</label>
                    <p className='text-[11px] text-gray-500 mb-2'>Leave empty to use global fees. A value here overrides global fees for this doctor.</p>
                    {isEditing ? (
                      <input
                        type='number'
                        min={0}
                        value={editForm.fees}
                        onChange={(e) => handleChange('fees', e.target.value)}
                        placeholder='Uses global fees'
                        className='w-full px-3 py-2 text-sm text-green-700 font-bold border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white'
                      />
                    ) : hasDoctorCustomVisitFees(selectedDoctor) ? (
                      <p className='text-sm text-green-700 font-bold'>{currency}{selectedDoctor.fees}</p>
                    ) : globalVisitFees.enabled ? (
                      <p className='text-sm text-gray-700'>
                        <span className='font-medium text-gray-500'>Global fees —</span>{' '}
                        {currency}{globalVisitFees.examinationFee} (examination)
                      </p>
                    ) : (
                      <p className='text-sm text-amber-800'>No custom or global fees set</p>
                    )}
                  </div>

                  <div className='rounded-lg p-3 bg-emerald-50 border border-emerald-100'>
                    <label className='text-xs sm:text-sm text-gray-600 mb-1 block font-medium'>Payments & offers (admin)</label>
                    <p className='text-[11px] text-gray-500 mb-2'>Fees, cash/online acceptance, and patient promo — only editable here.</p>
                    {isEditing ? (
                      <div className='space-y-2'>
                        <label className='flex items-center gap-2 text-sm text-gray-700'>
                          <input type='checkbox' checked={editForm.acceptsCash !== false} onChange={(e) => handleChange('acceptsCash', e.target.checked)} className='accent-primary' />
                          Accept cash
                        </label>
                        <label className='flex items-center gap-2 text-sm text-gray-700'>
                          <input type='checkbox' checked={editForm.acceptsOnlinePayment !== false} onChange={(e) => handleChange('acceptsOnlinePayment', e.target.checked)} className='accent-primary' />
                          Accept online payment
                        </label>
                        <label className='flex items-center gap-2 text-sm text-gray-700'>
                          <input type='checkbox' checked={Boolean(editForm.promoCode?.active)} onChange={(e) => handleChange('promoCode', { ...(editForm.promoCode || {}), active: e.target.checked })} className='accent-primary' />
                          Show offer to patients
                        </label>
                        <input value={editForm.promoCode?.code || ''} onChange={(e) => handleChange('promoCode', { ...(editForm.promoCode || {}), code: e.target.value.toUpperCase() })} className='w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm' placeholder='Optional code, auto-created if empty' />
                        <div className='grid grid-cols-2 gap-2'>
                          <select value={editForm.promoCode?.discountType || 'percentage'} onChange={(e) => handleChange('promoCode', { ...(editForm.promoCode || {}), discountType: e.target.value })} className='rounded border border-gray-300 bg-white px-3 py-2 text-sm'>
                            <option value='percentage'>Percentage</option>
                            <option value='fixed'>Fixed amount</option>
                          </select>
                          <input value={editForm.promoCode?.discountValue || ''} onChange={(e) => handleChange('promoCode', { ...(editForm.promoCode || {}), discountValue: e.target.value })} type='number' min='0' max={editForm.promoCode?.discountType === 'percentage' ? '100' : undefined} className='rounded border border-gray-300 bg-white px-3 py-2 text-sm' placeholder={editForm.promoCode?.discountType === 'percentage' ? 'Percentage' : 'Value'} />
                        </div>
                      </div>
                    ) : (
                      <div className='space-y-1 text-sm text-gray-800'>
                        <p>Cash: {selectedDoctor.acceptsCash !== false ? 'Accepted' : 'Not accepted'}</p>
                        <p>Online payment: {selectedDoctor.acceptsOnlinePayment !== false ? 'Accepted' : 'Not accepted'}</p>
                        <p>Promo: {selectedDoctor.promoCode?.active ? `${selectedDoctor.promoCode.code} (${selectedDoctor.promoCode.discountValue}${selectedDoctor.promoCode.discountType === 'percentage' ? '%' : ' fixed'} off)` : 'No active promo'}</p>
                      </div>
                    )}
                  </div>

                  <div className='rounded-lg border border-violet-200 bg-violet-50/80 p-3'>
                    <label className='mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-800 sm:text-sm'>
                      <Wallet className='h-4 w-4' />
                      Financial compensation
                    </label>
                    {isEditing ? (
                      <div className='space-y-3'>
                        <p className='text-xs text-violet-900/80'>
                          Choose how this doctor is compensated for analytics: percentage, fixed monthly, or both (hybrid).
                        </p>
                        <div className='flex flex-wrap gap-3'>
                          <label className='flex cursor-pointer items-center gap-2 rounded-lg border border-white bg-white/80 px-3 py-2 text-sm font-medium text-gray-800 shadow-sm'>
                            <input
                              type='radio'
                              name='compMode'
                              checked={editForm.financialCompensation?.mode === 'percentage'}
                              onChange={() => patchFinancialCompensation({ mode: 'percentage' })}
                              className='accent-primary'
                            />
                            Percentage only
                          </label>
                          <label className='flex cursor-pointer items-center gap-2 rounded-lg border border-white bg-white/80 px-3 py-2 text-sm font-medium text-gray-800 shadow-sm'>
                            <input
                              type='radio'
                              name='compMode'
                              checked={editForm.financialCompensation?.mode === 'fixed'}
                              onChange={() => patchFinancialCompensation({ mode: 'fixed' })}
                              className='accent-primary'
                            />
                            Fixed monthly
                          </label>
                          <label className='flex cursor-pointer items-center gap-2 rounded-lg border border-white bg-white/80 px-3 py-2 text-sm font-medium text-gray-800 shadow-sm'>
                            <input
                              type='radio'
                              name='compMode'
                              checked={editForm.financialCompensation?.mode === 'hybrid'}
                              onChange={() => patchFinancialCompensation({ mode: 'hybrid' })}
                              className='accent-primary'
                            />
                            % + fixed (hybrid)
                          </label>
                        </div>
                        {editForm.financialCompensation?.mode === 'fixed' ? (
                          <div className='space-y-2 rounded-lg border border-violet-100 bg-white p-3'>
                            <label className='text-xs text-gray-600'>Monthly fixed amount ({currency.trim()})</label>
                            <input
                              type='number'
                              min={0}
                              value={editForm.financialCompensation?.fixedSalary ?? 0}
                              onChange={(e) => patchFinancialCompensation({ fixedSalary: Number(e.target.value) })}
                              className='w-full rounded border border-gray-300 px-3 py-2 text-sm font-semibold'
                            />
                          </div>
                        ) : (
                          <div className='space-y-3 rounded-lg border border-violet-100 bg-white p-3'>
                            <div className='space-y-2'>
                              <p className='text-xs text-gray-600'>
                                Revenue share: % of <span className='font-semibold'>paid revenue</span> (paid or completed visits).
                              </p>
                              <div className='flex flex-wrap items-center gap-2'>
                                <Percent className='h-4 w-4 text-violet-600' />
                                <input
                                  type='number'
                                  min={0}
                                  max={100}
                                  value={editForm.financialCompensation?.percentage ?? 0}
                                  onChange={(e) => patchFinancialCompensation({ percentage: Number(e.target.value) })}
                                  className='w-24 rounded border border-gray-300 px-2 py-1.5 text-sm font-semibold'
                                />
                                <span className='text-sm text-gray-600'>% of paid revenue</span>
                              </div>
                            </div>
                            {editForm.financialCompensation?.mode === 'hybrid' && (
                              <div className='space-y-2 border-t border-violet-100 pt-3'>
                                <label className='text-xs text-gray-600'>Plus monthly fixed ({currency.trim()})</label>
                                <input
                                  type='number'
                                  min={0}
                                  value={editForm.financialCompensation?.fixedSalary ?? 0}
                                  onChange={(e) => patchFinancialCompensation({ fixedSalary: Number(e.target.value) })}
                                  className='w-full rounded border border-gray-300 px-3 py-2 text-sm font-semibold'
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className='space-y-1 text-sm text-gray-800'>
                        {selectedDoctor.financialCompensation?.mode === 'fixed' ? (
                          <p>
                            <span className='font-semibold'>Fixed salary:</span> {currency}
                            {Number(selectedDoctor.financialCompensation?.fixedSalary || 0).toLocaleString()} / month
                          </p>
                        ) : selectedDoctor.financialCompensation?.mode === 'hybrid' ? (
                          <div className='space-y-1'>
                            <p>
                              <span className='font-semibold'>Hybrid:</span>{' '}
                              {Number(selectedDoctor.financialCompensation?.percentage || 0) > 0
                                ? `${selectedDoctor.financialCompensation?.percentage}% of paid revenue`
                                : '0% of paid revenue'}
                              {' · '}
                              {currency}
                              {Number(selectedDoctor.financialCompensation?.fixedSalary || 0).toLocaleString()} / month fixed
                            </p>
                          </div>
                        ) : (
                          <>
                            <p>
                              <span className='font-semibold'>Percentage of paid revenue:</span>{' '}
                              {Number(selectedDoctor.financialCompensation?.percentage || 0) > 0
                                ? `${selectedDoctor.financialCompensation?.percentage}%`
                                : 'Not set (0%)'}
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          

          {/* About Section */}
          <div className='bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6'>
            <h3 className='text-base sm:text-lg font-bold text-gray-800 mb-3 flex items-center gap-2'>
              <FileText className='w-5 h-5 text-blue-600' />
              About Doctor
            </h3>
            {isEditing ? (
              <textarea
                value={editForm.about}
                onChange={(e) => handleChange('about', e.target.value)}
                rows={4}
                className='w-full px-3 sm:px-4 py-3 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white'
              />
            ) : (
              <p className='text-sm text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-lg border border-gray-100'>
                {selectedDoctor.about}
              </p>
            )}
          </div>

          {/* Edit Button at Bottom - Mobile Only */}
          {!isEditing && (
            <div className='sm:hidden fixed bottom-6 right-6 z-10'>
              <button 
                onClick={startEditing}
                className='flex items-center justify-center w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg transition'
              >
                <Edit2 className='w-6 h-6' />
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // List View
  return (
    <DoctorsDirectoryTable
      doctors={doctors}
      sortedDoctors={sortedDoctors}
      doctorsLoading={doctorsLoading}
      doctorStats={doctorStats}
      currency={currency}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      availabilityFilter={availabilityFilter}
      setAvailabilityFilter={setAvailabilityFilter}
      sortBy={sortBy}
      sortDir={sortDir}
      setSortBy={setSortBy}
      setSortDir={setSortDir}
      refreshing={refreshing}
      onRefresh={handleRefreshDoctors}
      onOpenDoctor={setSelectedDoctorId}
      onToggleAvailability={toggleAvailability}
    />
  )
}

export default DoctorsList
