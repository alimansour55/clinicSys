import React, { useContext, useEffect, useMemo, useState } from 'react'
import { AdminContext } from '../../context/AdminContext'
import { useLanguage } from '../../i18n'
import { Building2, Check, Edit2, Plus, Save, Search, Trash2, Users, X } from 'lucide-react'

const Clinics = () => {
  const {
    aToken,
    doctors,
    getAllDoctors,
    clinics,
    allowedClinics,
    getClinics,
    createClinic,
    updateClinic,
    deleteClinic,
    assignDoctorsToClinic
  } = useContext(AdminContext)

  const { t } = useLanguage()

  const fillT = (key, vars = {}) => {
    let s = String(t(key))
    Object.entries(vars).forEach(([k, v]) => {
      s = s.split(`{{${k}}}`).join(String(v))
    })
    return s
  }

  const formatDoctorCount = (count) => {
    const n = Number(count) || 0
    return n === 1 ? t('1 doctor') : fillT('{{n}} doctors', { n })
  }

  const [selectedClinicId, setSelectedClinicId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [editingId, setEditingId] = useState('')
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [search, setSearch] = useState('')
  const [selectedDoctors, setSelectedDoctors] = useState([])

  useEffect(() => {
    if (aToken) {
      getClinics()
      getAllDoctors()
    }
    // Context methods are recreated on render in this app; depend on the token to match existing admin pages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aToken])

  const selectedClinic = useMemo(
    () => clinics.find((clinic) => clinic._id === selectedClinicId),
    [clinics, selectedClinicId]
  )

  const usedClinicNames = useMemo(() => clinics.map((clinic) => clinic.name), [clinics])

  const suggestedNames = useMemo(
    () => allowedClinics.filter((clinicName) => !usedClinicNames.includes(clinicName) || clinicName === editName),
    [allowedClinics, usedClinicNames, editName]
  )

  const filteredDoctors = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    if (!normalizedSearch) return doctors

    return doctors.filter((doctor) =>
      [doctor.name, doctor.email, doctor.speciality]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch))
    )
  }, [doctors, search])

  const resetCreateForm = () => {
    setName('')
    setDescription('')
  }

  const handleSelectClinic = (clinic) => {
    setSelectedClinicId(clinic._id)
    setSelectedDoctors((clinic.doctors || []).map((doctor) => doctor._id))
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    await createClinic({ name, description })
    resetCreateForm()
  }

  const startEdit = (clinic) => {
    setEditingId(clinic._id)
    setEditName(clinic.name)
    setEditDescription(clinic.description || '')
  }

  const cancelEdit = () => {
    setEditingId('')
    setEditName('')
    setEditDescription('')
  }

  const handleUpdate = async (clinicId) => {
    await updateClinic({ clinicId, name: editName, description: editDescription })
    cancelEdit()
  }

  const toggleDoctor = (doctorId) => {
    setSelectedDoctors((previous) =>
      previous.includes(doctorId)
        ? previous.filter((id) => id !== doctorId)
        : [...previous, doctorId]
    )
  }

  const handleSaveAssignments = async () => {
    if (!selectedClinicId) return
    await assignDoctorsToClinic(selectedClinicId, selectedDoctors)
  }

  return (
    <div className='min-h-screen bg-gray-50 p-3 sm:p-5 md:p-6 lg:p-8'>
      <div className='max-w-7xl'>
        <div className='mb-6'>
          <h1 className='text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2'>
            <Building2 className='w-6 h-6 text-indigo-600' />
            {t('Clinic Management')}
          </h1>
          <p className='mt-2 text-sm text-gray-600 ml-8'>
            {t('Manage default and custom clinics, then assign doctors to each clinic')}
          </p>
        </div>

        <div className='grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-5'>
          <div className='space-y-5'>
            <form onSubmit={handleCreate} className='bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm'>
              <h2 className='text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2'>
                <Plus className='w-5 h-5 text-indigo-600' />
                {t('Add Clinic')}
              </h2>

              <div className='grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_auto] gap-3'>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className='w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white'
                  list='clinic-name-suggestions'
                  placeholder={t('Select or type clinic')}
                  required
                />
                <datalist id='clinic-name-suggestions'>
                  {suggestedNames.map((clinicName) => (
                    <option key={clinicName} value={clinicName}>
                      {t(clinicName)}
                    </option>
                  ))}
                </datalist>
                <input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className='w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500'
                  placeholder={t('Optional description')}
                />
                <button className='inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition'>
                  <Plus className='w-4 h-4' />
                  {t('Add')}
                </button>
              </div>

              {suggestedNames.length === 0 && (
                <p className='text-xs text-gray-500 mt-3'>
                  {t('All default clinics are already added. You can still type another clinic name.')}
                </p>
              )}
            </form>

            <div className='bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm'>
              <div className='p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between gap-3'>
                <div>
                  <h2 className='text-base sm:text-lg font-semibold text-gray-900'>{t('Clinics')}</h2>
                  <p className='text-sm text-gray-500'>{fillT('{{count}} active records', { count: clinics.length })}</p>
                </div>
              </div>

              <div className='divide-y divide-gray-100'>
                {clinics.length === 0 ? (
                  <div className='p-6 text-sm text-gray-500'>{t('No clinics added yet.')}</div>
                ) : clinics.map((clinic) => {
                  const isEditing = editingId === clinic._id

                  return (
                    <div key={clinic._id} className='p-4 sm:p-5 hover:bg-gray-50 transition'>
                      {isEditing ? (
                        <div className='grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_auto] gap-3'>
                          <input
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                            className='w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white'
                            list='clinic-edit-name-suggestions'
                            placeholder={t('Clinic name')}
                          />
                          <datalist id='clinic-edit-name-suggestions'>
                            {suggestedNames.map((clinicName) => (
                              <option key={clinicName} value={clinicName}>
                                {t(clinicName)}
                              </option>
                            ))}
                          </datalist>
                          <input
                            value={editDescription}
                            onChange={(event) => setEditDescription(event.target.value)}
                            className='w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500'
                            placeholder={t('Optional description')}
                          />
                          <div className='flex gap-2'>
                            <button
                              type='button'
                              onClick={() => handleUpdate(clinic._id)}
                              className='inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-2.5 text-sm font-semibold transition'
                            >
                              <Save className='w-4 h-4' />
                              {t('Save')}
                            </button>
                            <button
                              type='button'
                              onClick={cancelEdit}
                              className='inline-flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-3 py-2.5 transition'
                            >
                              <X className='w-4 h-4' />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
                          <button
                            type='button'
                            onClick={() => handleSelectClinic(clinic)}
                            className={`text-left flex-1 rounded-lg p-3 transition ${selectedClinicId === clinic._id ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'bg-white'}`}
                          >
                            <div className='flex items-center gap-2'>
                              <h3 className='font-semibold text-gray-900'>{t(clinic.name)}</h3>
                              <span className='text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full'>
                                {formatDoctorCount((clinic.doctors || []).length)}
                              </span>
                            </div>
                            <p className='text-sm text-gray-500 mt-1'>
                              {clinic.description || t('No description added')}
                            </p>
                          </button>

                          <div className='flex gap-2'>
                            <button
                              type='button'
                              onClick={() => startEdit(clinic)}
                              className='inline-flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg px-3 py-2 text-sm font-medium transition'
                            >
                              <Edit2 className='w-4 h-4' />
                              {t('Edit')}
                            </button>
                            <button
                              type='button'
                              onClick={() => deleteClinic(clinic._id)}
                              className='inline-flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg px-3 py-2 text-sm font-medium transition'
                            >
                              <Trash2 className='w-4 h-4' />
                              {t('Delete')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className='bg-white border border-gray-200 rounded-xl shadow-sm h-fit xl:sticky xl:top-5'>
            <div className='p-4 sm:p-5 border-b border-gray-100'>
              <h2 className='text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2'>
                <Users className='w-5 h-5 text-indigo-600' />
                {t('Assign Doctors')}
              </h2>
              <p className='text-sm text-gray-500 mt-1'>
                {selectedClinic ? t(selectedClinic.name) : t('Select a clinic to manage assignments')}
              </p>
            </div>

            <div className='p-4 sm:p-5'>
              <div className='relative mb-4'>
                <Search className='w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2' />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  disabled={!selectedClinic}
                  className='w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100'
                  placeholder={t('Search doctors')}
                />
              </div>

              <div className='max-h-[52vh] overflow-y-auto space-y-2 pr-1'>
                {!selectedClinic ? (
                  <div className='text-sm text-gray-500 bg-gray-50 rounded-lg p-4'>{t('Choose a clinic from the list.')}</div>
                ) : filteredDoctors.length === 0 ? (
                  <div className='text-sm text-gray-500 bg-gray-50 rounded-lg p-4'>{t('No doctors found.')}</div>
                ) : filteredDoctors.map((doctor) => {
                  const checked = selectedDoctors.includes(doctor._id)

                  return (
                    <label
                      key={doctor._id}
                      className={`flex items-center gap-3 border rounded-lg p-3 cursor-pointer transition ${checked ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}
                    >
                      <input
                        type='checkbox'
                        checked={checked}
                        onChange={() => toggleDoctor(doctor._id)}
                        className='sr-only'
                      />
                      <span className={`w-5 h-5 rounded border flex items-center justify-center ${checked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300'}`}>
                        {checked && <Check className='w-3.5 h-3.5' />}
                      </span>
                      <img src={doctor.image} alt={doctor.name} className='w-10 h-10 rounded-full object-cover bg-gray-100' />
                      <span className='min-w-0'>
                        <span className='block text-sm font-semibold text-gray-900 truncate'>{doctor.name}</span>
                        <span className='block text-xs text-gray-500 truncate'>{t(doctor.speciality)}</span>
                      </span>
                    </label>
                  )
                })}
              </div>

              <button
                type='button'
                onClick={handleSaveAssignments}
                disabled={!selectedClinic}
                className='mt-4 w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:bg-gray-300 disabled:cursor-not-allowed'
              >
                <Save className='w-4 h-4' />
                {t('Save Assignments')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Clinics
