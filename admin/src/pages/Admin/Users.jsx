import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminContext } from '../../context/AdminContext'
import InsuranceStatusBadge from '../../components/InsuranceStatusBadge'
import { CheckCircle2, ChevronDown, Edit3, ExternalLink, HeartHandshake, KeyRound, Loader2, Mail, MoreVertical, Phone, Plus, RefreshCw, RotateCcw, Search, Shield, ShieldCheck, Sparkles, Stethoscope, Trash2, UserCog, UserRound, UsersRound, X } from 'lucide-react'

const roleLabels = {
  patient: 'Patient',
  doctor: 'Doctor',
  receptionist: 'Receptionist'
}

const roleStyles = {
  patient: 'bg-blue-50 text-blue-700',
  doctor: 'bg-indigo-50 text-indigo-700',
  receptionist: 'bg-emerald-50 text-emerald-700'
}

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  gender: 'Not Selected',
  dob: '',
  address: { line1: '', line2: '' }
}

const emptyCreateForm = {
  profileType: 'patient',
  name: '',
  email: '',
  phone: '',
  password: '',
  gender: 'Not Selected',
  dob: '',
  address: { line1: '', line2: '' }
}

const userRowKey = (user) => `${user.profileType}-${user.profileId}`

const UserRowActionsMenu = ({
  user,
  isOpen,
  onToggle,
  onEdit,
  onResetPassword,
  onToggleMfaRequirement,
  onResetMfa,
  onDelete,
  onOpenPatientInsurance,
  onOpenDoctorProfile,
  onOpenReceptionistProfile
}) => {
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    const onDoc = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        onToggle(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [isOpen, onToggle])

  const close = () => onToggle(false)

  return (
    <div className='relative flex justify-end' ref={wrapRef}>
      <button
        type='button'
        aria-expanded={isOpen}
        aria-haspopup='menu'
        aria-label='User actions'
        onClick={() => onToggle(!isOpen)}
        className='inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition'
      >
        <MoreVertical className='w-4 h-4' />
      </button>
      {isOpen && (
        <div
          role='menu'
          className='absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-gray-200 bg-white py-1 shadow-lg'
        >
          <button
            type='button'
            role='menuitem'
            onClick={() => {
              close()
              onEdit()
            }}
            className='flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50'
          >
            <Edit3 className='w-4 h-4 text-blue-600' />
            Edit profile
          </button>
          <button
            type='button'
            role='menuitem'
            onClick={() => {
              close()
              onResetPassword()
            }}
            className='flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50'
          >
            <KeyRound className='w-4 h-4 text-amber-600' />
            Reset password
          </button>
          {user.profileType === 'patient' && (
            <button
              type='button'
              role='menuitem'
              onClick={() => {
                close()
                onOpenPatientInsurance()
              }}
              className='flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50'
            >
              <HeartHandshake className='w-4 h-4 text-teal-600' />
              Patient & insurance
            </button>
          )}
          {user.profileType === 'doctor' && (
            <button
              type='button'
              role='menuitem'
              onClick={() => {
                close()
                onOpenDoctorProfile()
              }}
              className='flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50'
            >
              <Stethoscope className='w-4 h-4 text-indigo-600' />
              Doctor profile
            </button>
          )}
          {user.profileType === 'receptionist' && (
            <button
              type='button'
              role='menuitem'
              onClick={() => {
                close()
                onOpenReceptionistProfile()
              }}
              className='flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50'
            >
              <ExternalLink className='w-4 h-4 text-emerald-600' />
              Full profile
            </button>
          )}
          <div className='my-1 border-t border-gray-100' />
          <button
            type='button'
            role='menuitem'
            onClick={() => {
              close()
              onToggleMfaRequirement()
            }}
            className='flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50'
          >
            <ShieldCheck className='w-4 h-4 text-purple-600' />
            {user.mfa?.requiredByAdmin ? 'Make MFA optional' : 'Require MFA'}
          </button>
          <button
            type='button'
            role='menuitem'
            onClick={() => {
              close()
              onResetMfa()
            }}
            className='flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50'
          >
            <RotateCcw className='w-4 h-4 text-gray-600' />
            Reset MFA
          </button>
          <div className='my-1 border-t border-gray-100' />
          <button
            type='button'
            role='menuitem'
            onClick={() => {
              close()
              onDelete()
            }}
            className='flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50'
          >
            <Trash2 className='w-4 h-4' />
            Delete account
          </button>
        </div>
      )}
    </div>
  )
}

const Users = () => {
  const {
    aToken,
    users,
    getAllUsers,
    createUserByAdmin,
    updateUserByAdmin,
    resetUserPassword,
    updateUserMfaRequirement,
    resetUserMfa,
    deleteUserAccount
  } = useContext(AdminContext)
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [insuranceFilter, setInsuranceFilter] = useState('all')
  const [actionsMenuKey, setActionsMenuKey] = useState(null)
  const [editingUser, setEditingUser] = useState(null)
  const [passwordUser, setPasswordUser] = useState(null)
  const [creatingUser, setCreatingUser] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [createForm, setCreateForm] = useState(emptyCreateForm)
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const addMenuRef = useRef(null)

  useEffect(() => {
    if (!addMenuOpen) return
    const onDoc = (event) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target)) {
        setAddMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [addMenuOpen])

  const refreshUsers = async () => {
    setRefreshing(true)
    await getAllUsers()
    setRefreshing(false)
  }

  useEffect(() => {
    const loadUsers = async () => {
      if (!aToken) return
      setLoading(true)
      await getAllUsers()
      setLoading(false)
    }

    loadUsers()
  }, [aToken])

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return users.filter((user) => {
      const matchesRole = roleFilter === 'all' || user.profileType === roleFilter
      const matchesSearch = !query
        || user.name?.toLowerCase().includes(query)
        || user.email?.toLowerCase().includes(query)
        || user.phone?.toLowerCase().includes(query)
        || user.patientId?.toLowerCase().includes(query)
        || user.speciality?.toLowerCase().includes(query)
        || user.insurance?.provider?.toLowerCase().includes(query)

      const hasPatientInsurance = user.profileType === 'patient' && Boolean(user.insurance?.enabled)
      const matchesInsurance = (() => {
        if (insuranceFilter === 'all') return true
        if (user.profileType !== 'patient') return false
        if (insuranceFilter === 'with') return hasPatientInsurance
        if (insuranceFilter === 'without') return !hasPatientInsurance
        return true
      })()

      return matchesRole && matchesSearch && matchesInsurance
    })
  }, [users, searchQuery, roleFilter, insuranceFilter])

  const openEdit = (user) => {
    setEditingUser(user)
    setForm({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      gender: user.gender || 'Not Selected',
      dob: user.dob && user.dob !== 'Not Selected' ? user.dob : '',
      address: {
        line1: user.address?.line1 || '',
        line2: user.address?.line2 || ''
      }
    })
  }

  const closeEdit = () => {
    setEditingUser(null)
    setForm(emptyForm)
  }

  const closePassword = () => {
    setPasswordUser(null)
    setNewPassword('')
  }

  const closeCreate = () => {
    setCreatingUser(false)
    setCreateForm(emptyCreateForm)
  }

  const openCreatePatient = () => {
    setAddMenuOpen(false)
    setCreateForm({ ...emptyCreateForm, profileType: 'patient' })
    setCreatingUser(true)
  }

  const goAddDoctor = () => {
    setAddMenuOpen(false)
    navigate('/add-doctor')
  }

  const goAddReceptionist = () => {
    setAddMenuOpen(false)
    navigate('/add-receptionist')
  }

  const saveNewUser = async () => {
    setSaving(true)
    const payload = {
      profileType: createForm.profileType,
      name: createForm.name,
      email: createForm.email,
      phone: createForm.phone,
      password: createForm.password
    }

    if (createForm.profileType === 'patient') {
      payload.gender = createForm.gender
      payload.dob = createForm.dob
      payload.address = createForm.address
    }

    const saved = await createUserByAdmin(payload)
    setSaving(false)
    if (saved) closeCreate()
  }

  const saveUser = async () => {
    if (!editingUser) return
    setSaving(true)
    const payload = {
      profileType: editingUser.profileType,
      profileId: editingUser.profileId,
      name: form.name,
      email: form.email,
      phone: form.phone
    }

    if (editingUser.profileType === 'patient') {
      payload.gender = form.gender
      payload.dob = form.dob || 'Not Selected'
      payload.address = form.address
    }

    const saved = await updateUserByAdmin(payload)
    setSaving(false)
    if (saved) closeEdit()
  }

  const savePassword = async () => {
    if (!passwordUser) return
    setSaving(true)
    const saved = await resetUserPassword({
      profileType: passwordUser.profileType,
      profileId: passwordUser.profileId,
      password: newPassword
    })
    setSaving(false)
    if (saved) closePassword()
  }

  const deleteUser = async (user) => {
    const confirmed = window.confirm(`Delete ${user.name} permanently? This removes the ${roleLabels[user.profileType].toLowerCase()} login account.`)
    if (!confirmed) return

    await deleteUserAccount({
      profileType: user.profileType,
      profileId: user.profileId
    })
  }

  const toggleUserMfaRequirement = async (user) => {
    await updateUserMfaRequirement({
      profileType: user.profileType,
      profileId: user.profileId,
      requiredByAdmin: !user.mfa?.requiredByAdmin
    })
  }

  const resetMfa = async (user) => {
    const confirmed = window.confirm(`Reset MFA for ${user.name}? They will need to configure authenticator MFA again if it is required.`)
    if (!confirmed) return

    await resetUserMfa({
      profileType: user.profileType,
      profileId: user.profileId
    })
  }

  const counts = {
    all: users.length,
    patient: users.filter((user) => user.profileType === 'patient').length,
    doctor: users.filter((user) => user.profileType === 'doctor').length,
    receptionist: users.filter((user) => user.profileType === 'receptionist').length
  }

  return (
    <div className='w-full bg-[#f4f6fb] p-3 sm:p-5 md:p-6 lg:p-8'>
      <div className='mx-auto max-w-7xl'>
        <div className='overflow-hidden rounded-2xl border border-slate-700/20 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 shadow-xl'>
          <div className='relative px-5 py-8 sm:px-8 sm:py-10'>
            <div className='relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between'>
              <div className='max-w-2xl'>
                <div className='inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white/90 ring-1 ring-white/20'>
                  <Sparkles className='h-3.5 w-3.5' />
                  User accounts
                </div>
                <h1 className='mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl'>All users</h1>
                <p className='mt-3 text-sm leading-relaxed text-white/85 sm:text-base'>
                  Manage login accounts, passwords, and MFA. Add patients here; use the doctor or receptionist forms for full staff profiles.
                </p>
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                <div className='relative' ref={addMenuRef}>
                  <button
                    type='button'
                    onClick={() => setAddMenuOpen((open) => !open)}
                    aria-expanded={addMenuOpen}
                    aria-haspopup='menu'
                    className='inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900 shadow-md transition hover:bg-white/95'
                  >
                    <Plus className='h-4 w-4 text-primary' />
                    Add user
                    <ChevronDown className={`h-4 w-4 transition ${addMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {addMenuOpen && (
                    <div
                      role='menu'
                      className='absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg'
                    >
                      <button type='button' role='menuitem' onClick={openCreatePatient} className='flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-gray-800 hover:bg-gray-50'>
                        <UserRound className='h-4 w-4 text-blue-600' />
                        Add patient
                      </button>
                      <button type='button' role='menuitem' onClick={goAddDoctor} className='flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-gray-800 hover:bg-gray-50'>
                        <Stethoscope className='h-4 w-4 text-indigo-600' />
                        Add doctor
                      </button>
                      <button type='button' role='menuitem' onClick={goAddReceptionist} className='flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-gray-800 hover:bg-gray-50'>
                        <UserCog className='h-4 w-4 text-emerald-600' />
                        Add receptionist
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type='button'
                  onClick={refreshUsers}
                  disabled={refreshing}
                  aria-label='Refresh'
                  className='inline-flex items-center gap-2 rounded-xl border border-white/25 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50'
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
            <div className='relative mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4'>
              {[
                { label: 'All users', value: counts.all, path: null },
                { label: 'Patients', value: counts.patient, path: '/patients' },
                { label: 'Doctors', value: counts.doctor, path: '/doctor-list' },
                { label: 'Receptionists', value: counts.receptionist, path: '/receptionist-list' }
              ].map(({ label, value, path }) => {
                const card = (
                  <>
                    <p className='text-xs font-semibold uppercase tracking-wide text-white/70'>{label}</p>
                    <p className='mt-1 text-2xl font-bold tabular-nums text-white'>{value}</p>
                  </>
                )
                if (!path) {
                  return (
                    <div key={label} className='rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm'>
                      {card}
                    </div>
                  )
                }
                return (
                  <button
                    key={label}
                    type='button'
                    onClick={() => navigate(path)}
                    className='rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left backdrop-blur-sm transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40'
                  >
                    {card}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className='mt-6 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 lg:flex-row lg:items-end lg:justify-between'>
          <div className='grid w-full gap-3 sm:grid-cols-2 lg:max-w-4xl lg:grid-cols-3'>
            <div className='relative sm:col-span-2 lg:col-span-1'>
              <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400' />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder='Search name, email, phone, ID, speciality…'
                className='w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
              />
              {searchQuery && (
                <button type='button' onClick={() => setSearchQuery('')} className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600' aria-label='Clear search'>
                  <X className='h-4 w-4' />
                </button>
              )}
            </div>
            <div className='relative'>
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                className='w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-3 pr-10 text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
              >
                <option value='all'>All roles</option>
                <option value='patient'>Patients only</option>
                <option value='doctor'>Doctors only</option>
                <option value='receptionist'>Receptionists only</option>
              </select>
              <ChevronDown className='pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400' />
            </div>
            <div className='relative'>
              <select
                value={insuranceFilter}
                onChange={(event) => setInsuranceFilter(event.target.value)}
                className='w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-3 pr-10 text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
              >
                <option value='all'>Insurance: all</option>
                <option value='with'>With insurance</option>
                <option value='without'>Without insurance</option>
              </select>
              <ChevronDown className='pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400' />
            </div>
          </div>
          <p className='text-center text-sm font-medium text-gray-600 lg:text-right'>
            Showing <span className='font-bold text-gray-900'>{filteredUsers.length}</span> of {users.length}
          </p>
        </div>

        <div className='mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm'>
          <div className='hidden lg:grid lg:grid-cols-[minmax(0,1.55fr)_minmax(0,0.85fr)_minmax(0,1.35fr)_minmax(0,0.95fr)_minmax(0,1.1fr)_minmax(0,1fr)_auto] gap-3 px-4 py-3 bg-gray-50 border-b text-sm font-semibold text-gray-700'>
            <p>User</p>
            <p>Role</p>
            <p>Contact</p>
            <p>Identifier</p>
            <p>Insurance</p>
            <p>Status</p>
            <p className='text-right pr-1'>Actions</p>
          </div>

          {loading ? (
            <div className='flex items-center justify-center py-20 text-gray-500'>
              <Loader2 className='h-9 w-9 animate-spin text-blue-600' />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className='px-6 py-16 text-center'>
              <div className='mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-gray-400'>
                <UsersRound className='h-8 w-8' />
              </div>
              <p className='mt-4 text-lg font-semibold text-gray-900'>No users match</p>
              <p className='mt-1 text-sm text-gray-600'>Try another search or add a new account.</p>
              <div className='mt-6 flex flex-wrap items-center justify-center gap-2'>
                <button type='button' onClick={openCreatePatient} className='inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700'>
                  <UserRound className='h-4 w-4' />
                  Add patient
                </button>
                <button type='button' onClick={goAddDoctor} className='inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-800 hover:bg-indigo-100'>
                  <Stethoscope className='h-4 w-4' />
                  Add doctor
                </button>
              </div>
            </div>
          ) : (
            filteredUsers.map((user) => (
              <div key={`${user.profileType}-${user.profileId}`} className='grid grid-cols-1 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,0.85fr)_minmax(0,1.35fr)_minmax(0,0.95fr)_minmax(0,1.1fr)_minmax(0,1fr)_auto] gap-3 px-4 py-4 border-b text-sm text-gray-700'>
                <div className='flex items-center gap-3 min-w-0'>
                  {user.image ? (
                    <img className='w-11 h-11 rounded-full object-cover border border-gray-200 bg-gray-100 flex-shrink-0' src={user.image} alt={user.name} />
                  ) : (
                    <div className='w-11 h-11 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold flex-shrink-0'>
                      {user.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className='min-w-0'>
                    <p className='font-semibold text-gray-900 truncate'>{user.name}</p>
                    <p className='text-xs text-gray-500 truncate lg:hidden'>{roleLabels[user.profileType]}</p>
                  </div>
                </div>

                <p>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${roleStyles[user.profileType]}`}>
                    <Shield className='w-3.5 h-3.5' />
                    {roleLabels[user.profileType]}
                  </span>
                </p>
                <div className='min-w-0 space-y-1'>
                  <p className='flex items-center gap-1.5 min-w-0'><Mail className='w-4 h-4 text-blue-600 flex-shrink-0' /><span className='truncate'>{user.email}</span></p>
                  <p className='flex items-center gap-1.5 text-gray-500'><Phone className='w-4 h-4 text-blue-600 flex-shrink-0' />{user.phone || 'No phone'}</p>
                </div>
                <p className='text-gray-600'>
                  <span className='text-xs font-semibold text-gray-500 lg:hidden'>Identifier </span>
                  {user.patientId || user.speciality || 'Staff account'}
                </p>
                <div className='min-w-0'>
                  <p className='text-xs font-semibold text-gray-500 lg:hidden mb-1'>Insurance</p>
                  {user.profileType !== 'patient' ? (
                    <span className='text-gray-400'>—</span>
                  ) : user.insurance?.enabled ? (
                    <div className='space-y-1'>
                      <div className='flex flex-wrap items-center gap-1'>
                        <span className='inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-800'>On file</span>
                        <InsuranceStatusBadge insurance={user.insurance} />
                      </div>
                      {user.insurance.provider ? (
                        <p className='truncate text-xs text-gray-600' title={user.insurance.provider}>{user.insurance.provider}</p>
                      ) : (
                        <p className='text-xs text-gray-500'>Provider not set</p>
                      )}
                    </div>
                  ) : (
                    <span className='inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600'>None on file</span>
                  )}
                </div>
                <p>
                  <span className='text-xs font-semibold text-gray-500 lg:hidden block mb-1'>Status</span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${user.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    <CheckCircle2 className='w-3.5 h-3.5' />
                    {user.isActive ? 'Active' : 'Disabled'}
                  </span>
                  <span className={`mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${user.mfa?.enabled ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                    <ShieldCheck className='w-3.5 h-3.5' />
                    MFA {user.mfa?.enabled ? 'On' : 'Off'}
                  </span>
                  {user.mfa?.requiredByAdmin && (
                    <span className='mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700'>
                      Required
                    </span>
                  )}
                </p>
                <div className='flex justify-end lg:items-start pt-1'>
                  <UserRowActionsMenu
                    user={user}
                    isOpen={actionsMenuKey === userRowKey(user)}
                    onToggle={(open) => setActionsMenuKey(open ? userRowKey(user) : null)}
                    onEdit={() => openEdit(user)}
                    onResetPassword={() => setPasswordUser(user)}
                    onToggleMfaRequirement={() => toggleUserMfaRequirement(user)}
                    onResetMfa={() => resetMfa(user)}
                    onDelete={() => deleteUser(user)}
                    onOpenPatientInsurance={() => navigate('/patients', { state: { openPatientId: user.profileId } })}
                    onOpenDoctorProfile={() => navigate('/doctor-list', { state: { openDoctorId: user.profileId } })}
                    onOpenReceptionistProfile={() => navigate(`/edit-receptionist/${user.profileId}`)}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {creatingUser && (
        <div className='fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4'>
          <div className='w-full max-w-2xl bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden'>
            <div className='flex items-center justify-between px-5 py-4 border-b bg-gray-50'>
              <h2 className='font-bold text-gray-900 flex items-center gap-2'><Plus className='w-5 h-5 text-blue-600' />Add patient</h2>
              <button onClick={closeCreate} className='text-gray-500 hover:text-gray-700'><X className='w-5 h-5' /></button>
            </div>
            <p className='mx-5 mt-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900'>
              Quick patient registration. For doctors use <button type='button' onClick={() => { closeCreate(); goAddDoctor() }} className='font-semibold underline'>Add doctor</button> (photo, speciality, fees). For receptionists use <button type='button' onClick={() => { closeCreate(); goAddReceptionist() }} className='font-semibold underline'>Add receptionist</button>.
            </p>
            <div className='p-5 grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <label className='text-sm font-medium text-gray-700'>
                Name
                <input value={createForm.name} onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))} className='mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500' />
              </label>
              <label className='text-sm font-medium text-gray-700'>
                Email
                <input type='email' value={createForm.email} onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))} className='mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500' />
              </label>
              <label className='text-sm font-medium text-gray-700'>
                Phone
                <input value={createForm.phone} onChange={(event) => setCreateForm((prev) => ({ ...prev, phone: event.target.value }))} className='mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500' />
              </label>
              <label className='text-sm font-medium text-gray-700'>
                Password
                <input type='password' value={createForm.password} onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))} placeholder='Minimum 8 characters' className='mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500' />
              </label>

              {createForm.profileType === 'patient' && (
                <>
                  <label className='text-sm font-medium text-gray-700'>
                    Gender
                    <select value={createForm.gender} onChange={(event) => setCreateForm((prev) => ({ ...prev, gender: event.target.value }))} className='mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'>
                      <option value='Not Selected'>Not Selected</option>
                      <option value='Female'>Female</option>
                      <option value='Male'>Male</option>
                    </select>
                  </label>
                  <label className='text-sm font-medium text-gray-700'>
                    Date of Birth
                    <input type='date' value={createForm.dob} onChange={(event) => setCreateForm((prev) => ({ ...prev, dob: event.target.value }))} className='mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500' />
                  </label>
                  <label className='text-sm font-medium text-gray-700'>
                    Address Line 1
                    <input value={createForm.address.line1} onChange={(event) => setCreateForm((prev) => ({ ...prev, address: { ...prev.address, line1: event.target.value } }))} className='mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500' />
                  </label>
                  <label className='text-sm font-medium text-gray-700'>
                    Address Line 2
                    <input value={createForm.address.line2} onChange={(event) => setCreateForm((prev) => ({ ...prev, address: { ...prev.address, line2: event.target.value } }))} className='mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500' />
                  </label>
                </>
              )}
            </div>
            <div className='px-5 py-4 border-t bg-gray-50 flex justify-end gap-2'>
              <button onClick={closeCreate} className='px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold text-sm hover:bg-gray-100'>Cancel</button>
              <button onClick={saveNewUser} disabled={saving} className='px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:bg-blue-300'>{saving ? 'Creating...' : 'Create patient'}</button>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div className='fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4'>
          <div className='w-full max-w-2xl bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden'>
            <div className='flex items-center justify-between px-5 py-4 border-b bg-gray-50'>
              <h2 className='font-bold text-gray-900 flex items-center gap-2'><UserCog className='w-5 h-5 text-blue-600' />Edit {roleLabels[editingUser.profileType]}</h2>
              <button onClick={closeEdit} className='text-gray-500 hover:text-gray-700'><X className='w-5 h-5' /></button>
            </div>
            <div className='p-5 grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <label className='text-sm font-medium text-gray-700'>
                Name
                <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} className='mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500' />
              </label>
              <label className='text-sm font-medium text-gray-700'>
                Email
                <input type='email' value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} className='mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500' />
              </label>
              <label className='text-sm font-medium text-gray-700'>
                Phone
                <input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} className='mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500' />
              </label>

              {editingUser.profileType === 'patient' && (
                <>
                  <label className='text-sm font-medium text-gray-700'>
                    Gender
                    <select value={form.gender} onChange={(event) => setForm((prev) => ({ ...prev, gender: event.target.value }))} className='mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'>
                      <option value='Not Selected'>Not Selected</option>
                      <option value='Female'>Female</option>
                      <option value='Male'>Male</option>
                    </select>
                  </label>
                  <label className='text-sm font-medium text-gray-700'>
                    Date of Birth
                    <input type='date' value={form.dob} onChange={(event) => setForm((prev) => ({ ...prev, dob: event.target.value }))} className='mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500' />
                  </label>
                  <label className='text-sm font-medium text-gray-700'>
                    Address Line 1
                    <input value={form.address.line1} onChange={(event) => setForm((prev) => ({ ...prev, address: { ...prev.address, line1: event.target.value } }))} className='mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500' />
                  </label>
                  <label className='text-sm font-medium text-gray-700'>
                    Address Line 2
                    <input value={form.address.line2} onChange={(event) => setForm((prev) => ({ ...prev, address: { ...prev.address, line2: event.target.value } }))} className='mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500' />
                  </label>
                </>
              )}
            </div>
            <div className='px-5 py-4 border-t bg-gray-50 flex justify-end gap-2'>
              <button onClick={closeEdit} className='px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold text-sm hover:bg-gray-100'>Cancel</button>
              <button onClick={saveUser} disabled={saving} className='px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:bg-blue-300'>{saving ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}

      {passwordUser && (
        <div className='fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4'>
          <div className='w-full max-w-md bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden'>
            <div className='flex items-center justify-between px-5 py-4 border-b bg-gray-50'>
              <h2 className='font-bold text-gray-900 flex items-center gap-2'><KeyRound className='w-5 h-5 text-amber-600' />Reset Password</h2>
              <button onClick={closePassword} className='text-gray-500 hover:text-gray-700'><X className='w-5 h-5' /></button>
            </div>
            <div className='p-5'>
              <p className='text-sm text-gray-600 mb-3'>Set a new password for <span className='font-semibold text-gray-900'>{passwordUser.name}</span>.</p>
              <input
                type='password'
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder='Minimum 8 characters'
                className='w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>
            <div className='px-5 py-4 border-t bg-gray-50 flex justify-end gap-2'>
              <button onClick={closePassword} className='px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold text-sm hover:bg-gray-100'>Cancel</button>
              <button onClick={savePassword} disabled={saving} className='px-4 py-2 rounded-lg bg-amber-600 text-white font-semibold text-sm hover:bg-amber-700 disabled:bg-amber-300'>{saving ? 'Resetting...' : 'Reset Password'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Users
