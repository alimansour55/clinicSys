import React, { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AdminContext } from "../../context/AdminContext";
import { toast } from 'react-toastify'
import axios from 'axios'
import { ArrowLeft, Building2, Plus, RotateCcw, Upload, UserPlus, Eye, EyeOff, Loader2, Check, MapPin, X } from 'lucide-react'
import { AppContext } from "../../context/AppContext";
import { useLanguage } from "../../i18n";

const AddDoctor = () => {
  const [docImg, setDocImg] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [experience, setExperience] = useState(1)
  const [fees, setFees] = useState('')
  const [about, setAbout] = useState('')
  const [speciality, setSpeciality] = useState('General physician')
  const [degree, setDegree] = useState('')
  const [gender, setGender] = useState('')
  const [title, setTitle] = useState('')
  const [acceptsCash, setAcceptsCash] = useState(true)
  const [acceptsOnlinePayment, setAcceptsOnlinePayment] = useState(true)
  const [promoCode, setPromoCode] = useState({ code: '', discountType: 'percentage', discountValue: '', active: false })
  const [phone, setPhone] = useState()
  const [selectedClinics, setSelectedClinics] = useState([])
  const [locations, setLocations] = useState([''])
  const [isLoading, setIsLoading] = useState(false)

  const { backendUrl, aToken, clinics, getClinics, getAllDoctors } = useContext(AdminContext)
  const { currency } = useContext(AppContext)
  const { t } = useLanguage()
  const navigate = useNavigate()

  useEffect(() => {
    if (aToken) {
      getClinics()
    }
    // Context methods are recreated on render in this app; depend on the token to match existing admin pages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aToken])

  const toggleClinic = (clinicId) => {
    setSelectedClinics((previous) =>
      previous.includes(clinicId)
        ? previous.filter((id) => id !== clinicId)
        : [...previous, clinicId]
    )
  }

  const updateLocation = (index, value) => {
    setLocations((previous) => previous.map((location, itemIndex) => itemIndex === index ? value : location))
  }

  const addLocation = () => setLocations((previous) => [...previous, ''])
  const removeLocation = (index) => setLocations((previous) => previous.filter((_, itemIndex) => itemIndex !== index))

  const onSubmitHandler = async (event) => {
    event.preventDefault()

    if (!docImg) return toast.error('Image Not Selected')

    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append('image', docImg)
      formData.append('name', name)
      formData.append('email', email)
      formData.append('password', password)
      formData.append('phone', phone)
      formData.append('experience', experience)
      formData.append('fees', String(fees ?? '').trim())
      formData.append('about', about)
      formData.append('speciality', speciality)
      formData.append('degree', degree)
      formData.append('gender', gender)
      formData.append('title', title)
      formData.append('acceptsCash', acceptsCash)
      formData.append('acceptsOnlinePayment', acceptsOnlinePayment)
      formData.append('promoCode', JSON.stringify(promoCode))
      formData.append('address', JSON.stringify({ line1: '', line2: '', addresses: [] }))
      formData.append('clinicIds', JSON.stringify(selectedClinics))
      formData.append('locations', JSON.stringify(locations.map((location) => location.trim()).filter(Boolean)))
      

      const { data } = await axios.post(backendUrl + '/api/admin/add-doctor', formData, {headers: {aToken}})
      
      if(data.success) {
        toast.success(`${data.message} The doctor must sign in and publish availability before patients can book.`)
        await getAllDoctors()
        navigate('/doctor-list')
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setDocImg(false)
    setName('')
    setEmail('')
    setPassword('')
    setPhone('')
    setDegree('')
    setAbout('')
    setFees('')
    setExperience(1)
    setSpeciality('General physician')
    setGender('')
    setTitle('')
    setAcceptsCash(true)
    setAcceptsOnlinePayment(true)
    setPromoCode({ code: '', discountType: 'percentage', discountValue: '', active: false })
    setSelectedClinics([])
    setLocations([''])
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-4 sm:py-6 lg:py-8 px-3 sm:px-6 lg:px-8">
      <div className="max-w-5xl">

        <div className="mb-4 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-start sm:justify-between lg:mb-8">
          <Link
            to="/doctor-list"
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('Back to doctors')}
          </Link>
        </div>

        <div className="mb-4 sm:mb-6 lg:mb-8"> 
          <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <UserPlus className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 text-primary" />
            {t('Add Doctor')}
          </h1>
          <p className="mt-1 sm:mt-2 text-xs sm:text-sm lg:text-base text-gray-600 ml-7 sm:ml-8 lg:ml-9">
            Fill in the information below to add a new doctor to the directory
          </p>
        </div>

        {/* Form Card */}
        <form onSubmit={onSubmitHandler} className="bg-white rounded-xl sm:rounded-2xl shadow-xl overflow-hidden">
          <div className="p-4 sm:p-6 lg:p-8 xl:p-10">
            
            {/* Image Upload Section */}
            <div className="mb-6 sm:mb-8 lg:mb-10">
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-3 sm:mb-4">
                Doctor Photo
              </label>
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                <label htmlFor="doc-img" className="cursor-pointer group">
                  <div className="relative w-28 h-28 sm:w-32 sm:h-32 lg:w-36 lg:h-36">
                    {docImg ? (
                      <img className="w-full h-full rounded-2xl object-cover border-4 border-primary shadow-lg" src={URL.createObjectURL(docImg)} alt="Doctor Preview" />
                    ) : (
                      <div className="w-full h-full rounded-2xl border-3 border-dashed border-gray-300 group-hover:border-primary bg-gray-50 group-hover:bg-primary/5 transition-all duration-300 flex flex-col items-center justify-center gap-2">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-all">
                          <Upload className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-gray-600 group-hover:text-primary transition-colors">
                          Upload Photo
                        </p>
                      </div>
                    )}
                  </div>
                </label>
                <input onChange={(e) => setDocImg(e.target.files[0])} type="file" id="doc-img" hidden accept="image/*"/>
                <div className="text-center sm:text-left">
                  <p className="text-sm sm:text-base font-semibold text-gray-800 mb-1">Upload doctor picture</p>
                  <p className="text-xs text-gray-500">JPG, PNG or JPEG</p>
                  <p className="text-xs text-gray-500">Maximum size: 2MB</p>
                  {docImg && (
                    <button type="button" onClick={() => setDocImg(false)} className="mt-2 text-xs sm:text-sm text-red-500 hover:text-red-700 font-medium flex items-center gap-1 mx-auto sm:mx-0">
                      <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4" />
                      Remove Image
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent mb-6 sm:mb-8 lg:mb-10"></div>

            {/* Form Fields Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
              
              {/* Left Column */}
              <div className="space-y-4 sm:space-y-5 lg:space-y-6">
                {/* Doctor Name */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                    Doctor Name <span className="text-red-500">*</span>
                  </label>
                  <input 
                    onChange={(e) => setName(e.target.value)} 
                    value={name} 
                    className="w-full border-2 border-gray-200 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base text-gray-700 focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-20 transition-all outline-none" 
                    type="text" 
                    placeholder="Enter full name" 
                    required 
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input 
                    onChange={(e) => setEmail(e.target.value)} 
                    value={email} 
                    className="w-full border-2 border-gray-200 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base text-gray-700 focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-20 transition-all outline-none" 
                    type="email" 
                    placeholder="doctor@example.com" 
                    required 
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input 
                      onChange={(e) => setPassword(e.target.value)} 
                      value={password} 
                      className="w-full border-2 border-gray-200 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base text-gray-700 focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-20 transition-all outline-none pr-10"  
                      placeholder="Enter password" 
                      required
                      type={showPassword ? "text" : "password"} 
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors">
                      {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>
                  </div>
                </div>

                {/* Experience */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                    Years of Experience <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      onChange={(e) => setExperience(Number(e.target.value))}
                      value={experience}
                      className="w-24 border-2 border-gray-200 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base text-gray-700 focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-20 transition-all outline-none bg-white"
                      type="number"
                      min="0"
                      max="100"
                      placeholder="12"
                      required
                    />
                    <span className="text-sm text-gray-600">years of experience</span>
                  </div>
                </div>

                {/* Fees (optional — uses global fees when empty) */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                    Examination fee (optional)
                  </label>
                  <div className="flex overflow-hidden rounded-lg border-2 border-gray-200 bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                    <span className="flex shrink-0 items-center border-r border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-600 sm:text-base">
                      {currency} 
                    </span>
                    <input 
                      onChange={(e) => setFees(e.target.value)} 
                      value={fees} 
                      className="min-w-0 flex-1 px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base text-gray-700 outline-none" 
                      type="number" 
                      min="0"
                      placeholder="Leave empty for global fees" 
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Leave blank to use global visit fees. Set a value here to override global fees for this doctor only.</p>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4 sm:space-y-5 lg:space-y-6">
                {/* Speciality */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                    Speciality <span className="text-red-500">*</span>
                  </label>
                  <select 
                    onChange={(e) => setSpeciality(e.target.value)} 
                    value={speciality} 
                    className="w-full border-2 border-gray-200 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base text-gray-700 focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-20 transition-all outline-none bg-white cursor-pointer"
                  >
                    <option value="General physician">General Physician</option>
                    <option value="Gynecologist">Gynecologist</option>
                    <option value="Dermatologist">Dermatologist</option>
                    <option value="Pediatricians">Pediatricians</option>
                    <option value="Neurologist">Neurologist</option>
                    <option value="Gastroenterologist">Gastroenterologist</option>
                  </select>
                </div>

                {/* Education */}
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                    Education / Degree <span className="text-red-500">*</span>
                  </label>
                  <input 
                    onChange={(e) => setDegree(e.target.value)} 
                    value={degree} 
                    className="w-full border-2 border-gray-200 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base text-gray-700 focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-20 transition-all outline-none" 
                    type="text" 
                    placeholder="e.g., MBBS, MD" 
                    required 
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                      Doctor Gender
                    </label>
                    <select
                      onChange={(e) => setGender(e.target.value)}
                      value={gender}
                      className="w-full border-2 border-gray-200 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base text-gray-700 focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-20 transition-all outline-none bg-white cursor-pointer"
                    >
                      <option value="">Choose gender</option>
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                      Doctor Title
                    </label>
                    <select
                      onChange={(e) => setTitle(e.target.value)}
                      value={title}
                      className="w-full border-2 border-gray-200 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base text-gray-700 focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-20 transition-all outline-none bg-white cursor-pointer"
                    >
                      <option value="">Choose title</option>
                      <option value="Professor">Professor</option>
                      <option value="Lecturer">Lecturer</option>
                      <option value="Consultant">Consultant</option>
                      <option value="Specialist">Specialist</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input 
                    onChange={(e) => setPhone(e.target.value)} 
                    value={phone} 
                    className="w-full border-2 border-gray-200 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base text-gray-700 focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-20 transition-all outline-none" 
                    type="number"
                    placeholder="03XX-XXXXXXX"
                    required 
                  />
                </div>

              </div>
            </div>

            <div className="mt-4 sm:mt-6 lg:mt-8">
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                Payment and Promo Offer
              </label>
              <div className="grid grid-cols-1 gap-3 rounded-xl border-2 border-gray-200 bg-gray-50 p-3 sm:grid-cols-2 sm:p-4">
                <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700">
                  <input type="checkbox" checked={acceptsCash} onChange={(event) => setAcceptsCash(event.target.checked)} className="accent-primary" />
                  Accept cash payment
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700">
                  <input type="checkbox" checked={acceptsOnlinePayment} onChange={(event) => setAcceptsOnlinePayment(event.target.checked)} className="accent-primary" />
                  Accept online payment
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 sm:col-span-2">
                  <input type="checkbox" checked={promoCode.active} onChange={(event) => setPromoCode((previous) => ({ ...previous, active: event.target.checked }))} className="accent-primary" />
                  Show percentage offer to patients
                </label>
                <input value={promoCode.code} onChange={(event) => setPromoCode((previous) => ({ ...previous, code: event.target.value.toUpperCase() }))} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary" placeholder="Optional code, auto-created if empty" />
                <select value={promoCode.discountType} onChange={(event) => setPromoCode((previous) => ({ ...previous, discountType: event.target.value }))} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary">
                  <option value="percentage">Percentage discount</option>
                  <option value="fixed">Fixed amount discount</option>
                </select>
                <input value={promoCode.discountValue} onChange={(event) => setPromoCode((previous) => ({ ...previous, discountValue: event.target.value }))} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary sm:col-span-2" type="number" min="0" max={promoCode.discountType === 'percentage' ? '100' : undefined} placeholder={promoCode.discountType === 'percentage' ? 'Percentage, e.g. 10' : 'Fixed discount value'} />
              </div>
            </div>

            <div className="mt-4 sm:mt-6 lg:mt-8">
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                Clinic Locations
              </label>
              <div className="border-2 border-gray-200 rounded-xl p-3 sm:p-4 bg-gray-50 space-y-3">
                {locations.map((location, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <input
                      value={location}
                      onChange={(event) => updateLocation(index, event.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 bg-white"
                      placeholder="e.g., Mohandseen, Nasr City"
                    />
                    {locations.length > 1 && (
                      <button type="button" onClick={() => removeLocation(index)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addLocation} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">
                  <Plus className="w-4 h-4" />
                  Add another location
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1.5">Patients will see these locations on doctor cards and choose one before booking.</p>
            </div>

            <div className="mt-4 sm:mt-6 lg:mt-8">
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                Assign Clinics
              </label>
              <div className="border-2 border-gray-200 rounded-xl p-3 sm:p-4 bg-gray-50">
                {clinics.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Building2 className="w-4 h-4" />
                    Add clinics first from Clinic Management
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {clinics.map((clinic) => {
                      const checked = selectedClinics.includes(clinic._id)

                      return (
                        <button
                          type="button"
                          key={clinic._id}
                          onClick={() => toggleClinic(clinic._id)}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 cursor-pointer transition ${
                            checked ? 'bg-indigo-50 border-primary text-gray-900' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <span className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                            checked ? 'bg-primary border-primary text-white' : 'border-gray-300'
                          }`}>
                            {checked && <Check className="w-3.5 h-3.5" />}
                          </span>
                          <Building2 className="w-4 h-4 text-primary flex-shrink-0" />
                          <span className="text-sm font-medium truncate">{clinic.name}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1.5">Selected clinics appear on the patient website and can be changed later from Clinic Management.</p>
            </div>

            {/* About Doctor - Full Width */}
            <div className="mt-4 sm:mt-6 lg:mt-8">
              <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                About Doctor <span className="text-red-500">*</span>
              </label>
              <textarea 
                onChange={(e) => setAbout(e.target.value)} 
                value={about} 
                className="w-full border-2 border-gray-200 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base text-gray-700 focus:border-primary focus:ring-2 focus:ring-primary focus:ring-opacity-20 transition-all outline-none resize-none"
                placeholder="Write a brief description about the doctor's expertise, achievements, and approach to patient care..."
                rows={5}
                required
              />
              <p className="text-xs text-gray-500 mt-1.5 sm:mt-2">Minimum 50 characters recommended</p>
            </div>

            {/* Submit Button */}
            <div className="mt-6 sm:mt-8 lg:mt-10 flex flex-col sm:flex-row gap-2 sm:gap-3 lg:gap-4">
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full sm:w-auto font-semibold px-6 sm:px-8 py-2.5 sm:py-3.5 rounded-lg transition-all duration-300 text-sm sm:text-base ${
                  isLoading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                } text-white`}
              >
                <span className="flex items-center justify-center gap-2">
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                      Add Doctor
                    </>
                  )}
                </span>
              </button>

              <button 
                type="button" 
                onClick={handleReset}
                disabled={isLoading}
                className={`w-full sm:w-auto font-semibold px-6 sm:px-8 py-2.5 sm:py-3.5 rounded-lg transition-all duration-300 text-sm sm:text-base ${
                  isLoading 
                    ? 'bg-gray-200 cursor-not-allowed text-gray-400' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                  Reset Form
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddDoctor;
