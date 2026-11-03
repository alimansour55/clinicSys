import React, { useContext, useEffect, useMemo, useState } from 'react'
import { AdminContext } from '../../context/AdminContext'
import { useLanguage } from '../../i18n'
import { useLocation, useNavigate } from 'react-router-dom'
import { Building2, Check, Edit2, Plus, Save, Search, Trash2, Users, X } from 'lucide-react'
import BilingualField from '../../components/BilingualField'
import { AdminPage, ConfirmDialog } from '../../components/admin/AdminPage'
import { Badge, Button, Input } from '../../components/ui'
import { bilingualFromRecord, bilingualIsEmpty, bilingualPayload, emptyBilingual } from '../../utils/bilingualValue'

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
    assignDoctorsToClinic,
    translatePreview
  } = useContext(AdminContext)

  const { t, tc } = useLanguage()

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
  const [name, setName] = useState(emptyBilingual)
  const [description, setDescription] = useState(emptyBilingual)
  const [editingId, setEditingId] = useState('')
  const [editName, setEditName] = useState(emptyBilingual)
  const [editDescription, setEditDescription] = useState(emptyBilingual)
  const [search, setSearch] = useState('')
  const [selectedDoctors, setSelectedDoctors] = useState([])
  const [deletingClinic, setDeletingClinic] = useState(null)
  const location = useLocation()
  const navigate = useNavigate()

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
    () => allowedClinics.filter((clinicName) => !usedClinicNames.includes(clinicName) || clinicName === editName.en),
    [allowedClinics, usedClinicNames, editName.en]
  )

  const filteredDoctors = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    if (!normalizedSearch) return doctors

    return doctors.filter((doctor) =>
      [doctor.name, doctor.i18n?.name?.ar, doctor.email, doctor.speciality]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch))
    )
  }, [doctors, search])

  const resetCreateForm = () => {
    setName(emptyBilingual())
    setDescription(emptyBilingual())
  }

  const handleSelectClinic = (clinic) => {
    setSelectedClinicId(clinic._id)
    setSelectedDoctors((clinic.doctors || []).map((doctor) => doctor._id))
  }

  const handleCreate = async (event) => {
    event.preventDefault()
    if (bilingualIsEmpty(name)) return
    const saved = await createClinic({ nameI18n: bilingualPayload(name), descriptionI18n: bilingualPayload(description) })
    if (saved) resetCreateForm()
  }

  const startEdit = (clinic) => {
    setEditingId(clinic._id)
    setEditName(bilingualFromRecord(clinic, 'name'))
    setEditDescription(bilingualFromRecord(clinic, 'description'))
  }

  const cancelEdit = () => {
    setEditingId('')
    setEditName(emptyBilingual())
    setEditDescription(emptyBilingual())
  }

  const handleUpdate = async (clinicId) => {
    const saved = await updateClinic({ clinicId, nameI18n: bilingualPayload(editName), descriptionI18n: bilingualPayload(editDescription) })
    if (saved) cancelEdit()
  }

  const toggleDoctor = (doctorId) => {
    setSelectedDoctors((previous) =>
      previous.includes(doctorId)
        ? previous.filter((id) => id !== doctorId)
        : [...previous, doctorId]
    )
  }

  /* The command palette opens a clinic by passing its id */
  useEffect(() => {
    const targetId = location.state?.openClinicId
    if (!targetId) return
    const clinic = clinics.find((item) => item._id === targetId)
    if (!clinic) return
    handleSelectClinic(clinic)
    navigate(location.pathname, { replace: true, state: {} })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinics, location.state])

  const handleSaveAssignments = async () => {
    if (!selectedClinicId) return
    await assignDoctorsToClinic(selectedClinicId, selectedDoctors)
  }

  return (
    <AdminPage icon={Building2} title={t('Clinic Management')} description={t('Manage default and custom clinics, then assign doctors to each clinic')}>
        <div className='grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-5'>
          <div className='space-y-5'>
            <form onSubmit={handleCreate} className='rounded-card border border-line bg-surface p-4 sm:p-5'>
              <h2 className='text-subtitle font-semibold text-ink mb-4 flex items-center gap-2'>
                <Plus className='w-5 h-5 text-brand' />
                {t('Add Clinic')}
              </h2>

              <div className='space-y-4'>
                <BilingualField
                  label={t('Clinic name')}
                  value={name}
                  onChange={setName}
                  translate={translatePreview}
                  kind='label'
                  list='clinic-name-suggestions'
                  required
                />
                <datalist id='clinic-name-suggestions'>
                  {suggestedNames.map((clinicName) => (
                    <option key={clinicName} value={clinicName}>
                      {t(clinicName)}
                    </option>
                  ))}
                </datalist>
                <BilingualField
                  label={t('Optional description')}
                  value={description}
                  onChange={setDescription}
                  translate={translatePreview}
                />
                <div className='flex justify-end'>
                  <Button type='submit' leadingIcon={<Plus aria-hidden='true' className='size-4' />}>
                    {t('Add')}
                  </Button>
                </div>
              </div>

              {suggestedNames.length === 0 && (
                <p className='text-xs text-ink-3 mt-3'>
                  {t('All default clinics are already added. You can still type another clinic name.')}
                </p>
              )}
            </form>

            <div className='overflow-hidden rounded-card border border-line bg-surface'>
              <div className='p-4 sm:p-5 border-b border-line flex items-center justify-between gap-3'>
                <div>
                  <h2 className='text-subtitle font-semibold text-ink'>{t('Clinics')}</h2>
                  <p className='text-sm text-ink-3'>{fillT('{{count}} active records', { count: clinics.length })}</p>
                </div>
              </div>

              <div className='divide-y divide-line'>
                {clinics.length === 0 ? (
                  <div className='p-6 text-sm text-ink-3'>{t('No clinics added yet.')}</div>
                ) : clinics.map((clinic) => {
                  const isEditing = editingId === clinic._id

                  return (
                    <div key={clinic._id} className='p-4 sm:p-5 hover:bg-surface-sunken transition'>
                      {isEditing ? (
                        <div className='space-y-4'>
                          <BilingualField
                            label={t('Clinic name')}
                            value={editName}
                            onChange={setEditName}
                            translate={translatePreview}
                            kind='label'
                            list='clinic-edit-name-suggestions'
                          />
                          <datalist id='clinic-edit-name-suggestions'>
                            {suggestedNames.map((clinicName) => (
                              <option key={clinicName} value={clinicName}>
                                {t(clinicName)}
                              </option>
                            ))}
                          </datalist>
                          <BilingualField
                            label={t('Optional description')}
                            value={editDescription}
                            onChange={setEditDescription}
                            translate={translatePreview}
                          />
                          <div className='flex justify-end gap-2'>
                            <Button variant='secondary' onClick={cancelEdit} leadingIcon={<X aria-hidden='true' className='size-4' />}>
                              {t('Cancel')}
                            </Button>
                            <Button
                              onClick={() => handleUpdate(clinic._id)}
                              leadingIcon={<Save aria-hidden='true' className='size-4' />}
                            >
                              {t('Save')}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
                          <button
                            type='button'
                            onClick={() => handleSelectClinic(clinic)}
                            className={`text-start flex-1 rounded-lg p-3 transition ${selectedClinicId === clinic._id ? 'bg-primary-soft ring-1 ring-primary' : ''}`}
                          >
                            <div className='flex items-center gap-2'>
                              <h3 className='font-semibold text-ink'>{tc(clinic.i18n?.name) || t(clinic.name)}</h3>
                              {(clinic.i18n?.name?.status === 'pending' || clinic.i18n?.description?.status === 'pending') && (
                                <Badge tone='warning'>{t('Translation pending')}</Badge>
                              )}
                              <span className='rounded-full bg-surface-sunken px-2 py-1 text-caption text-ink-2'>
                                {formatDoctorCount((clinic.doctors || []).length)}
                              </span>
                            </div>
                            <p className='text-sm text-ink-3 mt-1'>
                              {tc(clinic.i18n?.description) || clinic.description || t('No description added')}
                            </p>
                          </button>

                          <div className='flex gap-2'>
                            <button
                              type='button'
                              onClick={() => startEdit(clinic)}
                              className='inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-control border border-line px-3 text-body-sm font-medium text-ink-2 transition hover:bg-surface-sunken'
                            >
                              <Edit2 className='w-4 h-4' />
                              {t('Edit')}
                            </button>
                            <button
                              type='button'
                              onClick={() => setDeletingClinic(clinic)}
                              className='inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-control bg-danger-soft px-3 text-body-sm font-medium text-danger-ink transition hover:brightness-95'
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

          <div className='h-fit rounded-card border border-line bg-surface xl:sticky xl:top-5'>
            <div className='p-4 sm:p-5 border-b border-line'>
              <h2 className='text-subtitle font-semibold text-ink flex items-center gap-2'>
                <Users className='w-5 h-5 text-brand' />
                {t('Assign Doctors')}
              </h2>
              <p className='text-sm text-ink-3 mt-1'>
                {selectedClinic ? tc(selectedClinic.i18n?.name) || t(selectedClinic.name) : t('Select a clinic to manage assignments')}
              </p>
            </div>

            <div className='p-4 sm:p-5'>
              <div className='relative mb-4'>
                <Search className='w-4 h-4 text-ink-3 absolute start-3 top-1/2 -translate-y-1/2' />
                <Input
                  aria-label={t('Search doctors')}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  disabled={!selectedClinic}
                  className='ps-9'
                  placeholder={t('Search doctors')}
                />
              </div>

              <div className='max-h-[52vh] overflow-y-auto space-y-2 pe-1'>
                {!selectedClinic ? (
                  <div className='text-sm text-ink-3 rounded-control bg-surface-sunken p-4'>{t('Choose a clinic from the list.')}</div>
                ) : filteredDoctors.length === 0 ? (
                  <div className='text-sm text-ink-3 rounded-control bg-surface-sunken p-4'>{t('No doctors found.')}</div>
                ) : filteredDoctors.map((doctor) => {
                  const checked = selectedDoctors.includes(doctor._id)

                  return (
                    <label
                      key={doctor._id}
                      className={`flex items-center gap-3 border rounded-lg p-3 cursor-pointer transition ${checked ? 'border-primary bg-primary-soft' : 'border-line hover:bg-surface-sunken'}`}
                    >
                      <input
                        type='checkbox'
                        checked={checked}
                        onChange={() => toggleDoctor(doctor._id)}
                        className='sr-only'
                      />
                      <span className={`w-5 h-5 rounded border flex items-center justify-center ${checked ? 'border-primary bg-primary text-on-primary' : 'border-field'}`}>
                        {checked && <Check className='w-3.5 h-3.5' />}
                      </span>
                      <img src={doctor.image} alt='' className='size-10 rounded-full bg-surface-sunken object-cover' />
                      <span className='min-w-0'>
                        <span className='block text-sm font-semibold text-ink truncate'>{tc(doctor.i18n?.name) || doctor.name}</span>
                        <span className='block text-xs text-ink-3 truncate'>{tc(doctor.i18n?.speciality) || t(doctor.speciality)}</span>
                      </span>
                    </label>
                  )
                })}
              </div>

              <Button className='mt-4' fullWidth onClick={handleSaveAssignments} disabled={!selectedClinic} leadingIcon={<Save aria-hidden='true' className='size-4' />}>
                {t('Save Assignments')}
              </Button>
            </div>
          </div>
        </div>
      <ConfirmDialog
        open={Boolean(deletingClinic)}
        danger
        title={deletingClinic ? `${t('Delete')}: ${tc(deletingClinic.i18n?.name) || t(deletingClinic.name)}` : ''}
        body={t('This clinic will be removed from the patient website.')}
        confirmLabel={t('Delete')}
        onConfirm={async () => {
          await deleteClinic(deletingClinic._id)
          setDeletingClinic(null)
        }}
        onClose={() => setDeletingClinic(null)}
      />
    </AdminPage>
  )
}

export default Clinics
