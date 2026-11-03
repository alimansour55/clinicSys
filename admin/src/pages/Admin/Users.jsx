import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminContext } from '../../context/AdminContext'
import InsuranceStatusBadge from '../../components/InsuranceStatusBadge'
import { useLanguage } from '../../i18n'
import { ChevronDown, Edit3, ExternalLink, HeartHandshake, KeyRound, Mail, MoreVertical, Phone, Plus, RefreshCw, RotateCcw, Search, ShieldCheck, ShieldOff, Stethoscope, Trash2, UserCheck, UserCog, UserRound, UsersRound, UserX } from 'lucide-react'
import { AdminPage, BulkBar, ConfirmDialog, ExportButton, SelectBox, StatCard, selectionFor } from '../../components/admin/AdminPage'
import { Badge, Button, EmptyState, Field, IconButton, Input, Modal, notify, Select, Skeleton, SkeletonGroup } from '../../components/ui'
import { downloadCsv } from '../../utils/csvExport'

const getUserRoleLabel = (user, t) => {
  if (user.profileType === 'patient') return t('User role patient')
  if (user.profileType === 'receptionist') return t('Receptionist')
  if (user.profileType === 'doctor') return user.speciality ? t(user.speciality) : t('Doctor')
  return user.profileType
}

const getUserIdentifier = (user, t) => {
  if (user.patientId) return user.patientId
  if (user.speciality) return t(user.speciality)
  return t('Staff account')
}

const roleKeyForConfirm = {
  patient: 'User role patient',
  doctor: 'Doctor',
  receptionist: 'Receptionist'
}

const roleTones = { patient: 'info', doctor: 'brand', receptionist: 'success' }

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  gender: 'Not Selected',
  dob: '',
  address: { line1: '', line2: '' }
}

const emptyCreateForm = { ...emptyForm, profileType: 'patient', password: '' }

const userRowKey = (user) => `${user.profileType}-${user.profileId}`

const MenuItem = ({ icon: Icon, onSelect, danger = false, children }) => (
  <button
    type='button'
    role='menuitem'
    onClick={onSelect}
    className={`flex min-h-10 w-full cursor-pointer items-center gap-2 px-3 text-start text-body-sm ${danger ? 'text-danger-ink hover:bg-danger-soft' : 'text-ink-2 hover:bg-surface-sunken'}`}
  >
    <Icon aria-hidden='true' className='size-4 shrink-0' />
    {children}
  </button>
)

/** Closes on an outside press or Escape. */
const useDismiss = (open, onClose) => {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const onDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onClose()
    }
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])
  return ref
}

const UserRowActionsMenu = ({ user, t, isOpen, onToggle, onEdit, onResetPassword, onToggleMfaRequirement, onResetMfa, onDelete, onOpenPatientInsurance, onOpenDoctorProfile, onOpenReceptionistProfile }) => {
  const wrapRef = useDismiss(isOpen, () => onToggle(false))
  const run = (action) => () => {
    onToggle(false)
    action()
  }

  return (
    <div className='relative' ref={wrapRef}>
      <IconButton variant='secondary' size='sm' label={t('User actions')} aria-expanded={isOpen} aria-haspopup='menu' onClick={() => onToggle(!isOpen)}>
        <MoreVertical aria-hidden='true' className='size-4' />
      </IconButton>
      {isOpen && (
        <div role='menu' className='absolute end-0 top-full z-(--z-popover,40) mt-1 w-56 rounded-control border border-line bg-surface-raised py-1 shadow-e2'>
          <MenuItem icon={Edit3} onSelect={run(onEdit)}>{t('Edit profile')}</MenuItem>
          <MenuItem icon={KeyRound} onSelect={run(onResetPassword)}>{t('Reset password')}</MenuItem>
          {user.profileType === 'patient' && <MenuItem icon={HeartHandshake} onSelect={run(onOpenPatientInsurance)}>{t('Patient & insurance')}</MenuItem>}
          {user.profileType === 'doctor' && <MenuItem icon={Stethoscope} onSelect={run(onOpenDoctorProfile)}>{t('Doctor profile')}</MenuItem>}
          {user.profileType === 'receptionist' && <MenuItem icon={ExternalLink} onSelect={run(onOpenReceptionistProfile)}>{t('Full profile')}</MenuItem>}
          <div className='my-1 border-t border-line' />
          <MenuItem icon={ShieldCheck} onSelect={run(onToggleMfaRequirement)}>{user.mfa?.requiredByAdmin ? t('Make MFA optional') : t('Require MFA')}</MenuItem>
          <MenuItem icon={RotateCcw} onSelect={run(onResetMfa)}>{t('Reset MFA')}</MenuItem>
          <div className='my-1 border-t border-line' />
          <MenuItem icon={Trash2} danger onSelect={run(onDelete)}>{t('Delete account')}</MenuItem>
        </div>
      )}
    </div>
  )
}

/** The fields a patient has beyond a name and contact details. */
const PatientFields = ({ form, setForm, t }) => (
  <>
    <Field label={t('Gender')}>
      <Select value={form.gender} onChange={(event) => setForm((prev) => ({ ...prev, gender: event.target.value }))}>
        <option value='Not Selected'>{t('Not Selected')}</option>
        <option value='Female'>{t('Female')}</option>
        <option value='Male'>{t('Male')}</option>
      </Select>
    </Field>
    <Field label={t('Date of Birth')}>
      <Input type='date' value={form.dob} onChange={(event) => setForm((prev) => ({ ...prev, dob: event.target.value }))} />
    </Field>
    <Field label={t('Address Line 1')}>
      <Input value={form.address.line1} onChange={(event) => setForm((prev) => ({ ...prev, address: { ...prev.address, line1: event.target.value } }))} />
    </Field>
    <Field label={t('Address Line 2')}>
      <Input value={form.address.line2} onChange={(event) => setForm((prev) => ({ ...prev, address: { ...prev.address, line2: event.target.value } }))} />
    </Field>
  </>
)

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
    deleteUserAccount,
    bulkUserStatus,
    bulkUserMfa,
    bulkResetMfa
  } = useContext(AdminContext)
  const navigate = useNavigate()
  const { t, tc, localizeDigits } = useLanguage()

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
  const [selected, setSelected] = useState([])
  const [confirm, setConfirm] = useState(null)
  const addMenuRef = useDismiss(addMenuOpen, () => setAddMenuOpen(false))

  const nameOf = (user) => tc(user.nameI18n) || user.name

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aToken])

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return users.filter((user) => {
      const matchesRole = roleFilter === 'all' || user.profileType === roleFilter
      const matchesSearch = !query || [user.name, user.nameI18n?.ar, user.email, user.phone, user.patientId, user.speciality, user.insurance?.provider]
        .some((value) => String(value || '').toLowerCase().includes(query))

      const hasPatientInsurance = user.profileType === 'patient' && Boolean(user.insurance?.enabled)
      const matchesInsurance = (() => {
        if (insuranceFilter === 'all') return true
        if (user.profileType !== 'patient') return false
        return insuranceFilter === 'with' ? hasPatientInsurance : !hasPatientInsurance
      })()

      return matchesRole && matchesSearch && matchesInsurance
    })
  }, [users, searchQuery, roleFilter, insuranceFilter])

  const visibleKeys = filteredUsers.map(userRowKey)
  const selection = selectionFor(selected, visibleKeys)
  const selectedUsers = () =>
    filteredUsers.filter((user) => selection.ids.includes(userRowKey(user))).map(({ profileType, profileId }) => ({ profileType, profileId: String(profileId) }))

  const runBulk = async (action) => {
    const result = await action(selectedUsers())
    if (!result) return
    notify.success(`${t('Accounts updated')}: ${localizeDigits(result.updated)}`)
    setSelected([])
    refreshUsers()
  }

  const exportUsers = () =>
    downloadCsv(
      'users',
      [
        { label: t('Name'), value: (row) => nameOf(row) },
        { label: t('Role'), value: (row) => getUserRoleLabel(row, t) },
        { label: t('Email'), value: (row) => row.email },
        { label: t('Phone'), value: (row) => row.phone },
        { label: t('Identifier'), value: (row) => getUserIdentifier(row, t) },
        { label: t('Insurance'), value: (row) => row.insurance?.provider || '' },
        { label: t('Status'), value: (row) => (row.isActive ? t('Active') : t('Disabled')) },
        { label: t('MFA'), value: (row) => (row.mfa?.enabled ? t('MFA On') : t('MFA Off')) }
      ],
      filteredUsers
    )

  const openEdit = (user) => {
    setEditingUser(user)
    setForm({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      gender: user.gender || 'Not Selected',
      dob: user.dob && user.dob !== 'Not Selected' ? user.dob : '',
      address: { line1: user.address?.line1 || '', line2: user.address?.line2 || '' }
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

  const saveNewUser = async (event) => {
    event.preventDefault()
    setSaving(true)
    const saved = await createUserByAdmin({
      profileType: createForm.profileType,
      name: createForm.name,
      email: createForm.email,
      phone: createForm.phone,
      password: createForm.password,
      gender: createForm.gender,
      dob: createForm.dob,
      address: createForm.address
    })
    setSaving(false)
    if (saved) closeCreate()
  }

  const saveUser = async (event) => {
    event.preventDefault()
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

  const savePassword = async (event) => {
    event.preventDefault()
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

  const confirmDelete = (user) =>
    setConfirm({
      title: `${t('Delete')} ${nameOf(user)}`,
      body: `${t('This removes login account for')} ${t(roleKeyForConfirm[user.profileType] || 'User')}.`,
      confirmLabel: t('Delete account'),
      danger: true,
      run: () => deleteUserAccount({ profileType: user.profileType, profileId: user.profileId })
    })

  const confirmResetMfa = (user) =>
    setConfirm({
      title: `${t('Reset MFA')}: ${nameOf(user)}`,
      body: t('Reset MFA confirm body'),
      confirmLabel: t('Reset MFA'),
      run: () => resetUserMfa({ profileType: user.profileType, profileId: user.profileId })
    })

  const toggleUserMfaRequirement = (user) =>
    updateUserMfaRequirement({ profileType: user.profileType, profileId: user.profileId, requiredByAdmin: !user.mfa?.requiredByAdmin })

  const runConfirm = async () => {
    setSaving(true)
    await confirm.run()
    setSaving(false)
    setConfirm(null)
  }

  const counts = {
    all: users.length,
    patient: users.filter((user) => user.profileType === 'patient').length,
    doctor: users.filter((user) => user.profileType === 'doctor').length,
    receptionist: users.filter((user) => user.profileType === 'receptionist').length
  }

  return (
    <AdminPage
      icon={UsersRound}
      title={t('All users')}
      description={t('Users page description')}
      actions={
        <>
          <div className='relative' ref={addMenuRef}>
            <Button size='sm' onClick={() => setAddMenuOpen((open) => !open)} aria-expanded={addMenuOpen} aria-haspopup='menu' leadingIcon={<Plus aria-hidden='true' className='size-4' />} trailingIcon={<ChevronDown aria-hidden='true' className='size-4' />}>
              {t('Add user')}
            </Button>
            {addMenuOpen && (
              <div role='menu' className='absolute end-0 top-full z-(--z-popover,40) mt-1 w-52 rounded-control border border-line bg-surface-raised py-1 shadow-e2'>
                <MenuItem icon={UserRound} onSelect={openCreatePatient}>{t('Add patient')}</MenuItem>
                <MenuItem icon={Stethoscope} onSelect={goAddDoctor}>{t('Add doctor')}</MenuItem>
                <MenuItem icon={UserCog} onSelect={goAddReceptionist}>{t('Add receptionist')}</MenuItem>
              </div>
            )}
          </div>
          <ExportButton onExport={exportUsers} disabled={!filteredUsers.length} />
          <Button variant='secondary' size='sm' onClick={refreshUsers} disabled={refreshing} leadingIcon={<RefreshCw aria-hidden='true' className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />}>
            {t('Refresh')}
          </Button>
        </>
      }
    >
      <div className='mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4'>
        <StatCard label={t('All users')} value={localizeDigits(counts.all)} onClick={() => setRoleFilter('all')} />
        <StatCard label={t('Patients')} value={localizeDigits(counts.patient)} onClick={() => navigate('/patients')} />
        <StatCard label={t('Doctors')} value={localizeDigits(counts.doctor)} onClick={() => navigate('/doctor-list')} />
        <StatCard label={t('Receptionists')} value={localizeDigits(counts.receptionist)} onClick={() => navigate('/receptionist-list')} />
      </div>

      <div className='mb-4 grid grid-cols-1 gap-3 rounded-card border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_13rem_13rem_auto] lg:items-end'>
        <div className='relative sm:col-span-2 lg:col-span-1'>
          <Field label={t('Search')}>
            <Input className='ps-10' value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t('Search name, email, phone, ID, speciality…')} />
          </Field>
          <Search aria-hidden='true' className='pointer-events-none absolute bottom-3.5 start-3 size-4 text-ink-3' />
        </div>
        <Field label={t('Role')}>
          <Select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value='all'>{t('All roles')}</option>
            <option value='patient'>{t('Patients only')}</option>
            <option value='doctor'>{t('Doctors only')}</option>
            <option value='receptionist'>{t('Receptionists only')}</option>
          </Select>
        </Field>
        <Field label={t('Insurance')}>
          <Select value={insuranceFilter} onChange={(event) => setInsuranceFilter(event.target.value)}>
            <option value='all'>{t('Insurance: all')}</option>
            <option value='with'>{t('With insurance')}</option>
            <option value='without'>{t('Without insurance')}</option>
          </Select>
        </Field>
        <p className='pb-2.5 text-body-sm text-ink-3'>{`${t('Showing')} ${localizeDigits(filteredUsers.length)} ${t('of')} ${localizeDigits(users.length)}`}</p>
      </div>

      <BulkBar count={selection.count} onClear={() => setSelected([])}>
        <Button size='sm' variant='secondary' onClick={() => runBulk((list) => bulkUserStatus(list, true))} leadingIcon={<UserCheck aria-hidden='true' className='size-4' />}>{t('Activate')}</Button>
        <Button size='sm' variant='secondary' onClick={() => runBulk((list) => bulkUserStatus(list, false))} leadingIcon={<UserX aria-hidden='true' className='size-4' />}>{t('Deactivate')}</Button>
        <Button size='sm' variant='secondary' onClick={() => runBulk((list) => bulkUserMfa(list, true))} leadingIcon={<ShieldCheck aria-hidden='true' className='size-4' />}>{t('Require MFA')}</Button>
        <Button size='sm' variant='secondary' onClick={() => runBulk((list) => bulkUserMfa(list, false))} leadingIcon={<ShieldOff aria-hidden='true' className='size-4' />}>{t('Make MFA optional')}</Button>
        <Button
          size='sm'
          variant='secondary'
          leadingIcon={<RotateCcw aria-hidden='true' className='size-4' />}
          onClick={() =>
            setConfirm({
              title: `${t('Reset MFA')}: ${localizeDigits(selection.count)}`,
              body: t('Reset MFA confirm body'),
              confirmLabel: t('Reset MFA'),
              danger: true,
              run: () => runBulk(bulkResetMfa)
            })
          }
        >
          {t('Reset MFA')}
        </Button>
      </BulkBar>

      <div className='rounded-card border border-line bg-surface'>
        {loading ? (
          <SkeletonGroup className='space-y-3 p-4'>
            {[0, 1, 2, 3].map((key) => <Skeleton key={key} className='h-14 w-full' />)}
          </SkeletonGroup>
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            icon={<UsersRound aria-hidden='true' />}
            title={t('No users match')}
            description={t('Try another search or add a new account.')}
            action={
              <div className='flex flex-wrap justify-center gap-2'>
                <Button onClick={openCreatePatient} leadingIcon={<UserRound aria-hidden='true' className='size-4' />}>{t('Add patient')}</Button>
                <Button variant='secondary' onClick={goAddDoctor} leadingIcon={<Stethoscope aria-hidden='true' className='size-4' />}>{t('Add doctor')}</Button>
              </div>
            }
          />
        ) : (
          <>
            <label className='flex items-center gap-3 rounded-t-card border-b border-line bg-surface-sunken px-4 py-2.5 text-caption font-semibold text-ink-3'>
              <SelectBox label={t('Select all')} checked={selection.all} indeterminate={selection.some} onChange={(on) => setSelected(on ? visibleKeys : [])} />
              {t('Select all')}
            </label>
            <ul className='divide-y divide-line'>
              {filteredUsers.map((user) => {
                const key = userRowKey(user)
                return (
                  <li key={key} className='flex flex-wrap items-start gap-x-4 gap-y-3 px-4 py-3.5'>
                    <span className='pt-3'>
                      <SelectBox label={`${t('Select')} ${nameOf(user)}`} checked={selected.includes(key)} onChange={(on) => setSelected((previous) => (on ? [...previous, key] : previous.filter((value) => value !== key)))} />
                    </span>
                    <div className='flex min-w-0 flex-1 basis-52 items-center gap-3'>
                      {user.image ? (
                        <img className='size-11 shrink-0 rounded-full border border-line bg-surface-sunken object-cover' src={user.image} alt='' />
                      ) : (
                        <span aria-hidden='true' className='flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-brand'>
                          {nameOf(user)?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      )}
                      <div className='min-w-0'>
                        <p className='truncate font-semibold text-ink'>{nameOf(user)}</p>
                        <Badge tone={roleTones[user.profileType]}>{getUserRoleLabel(user, t)}</Badge>
                      </div>
                    </div>
                    <div className='min-w-0 flex-1 basis-52 space-y-0.5 text-body-sm text-ink-2'>
                      <p className='flex min-w-0 items-center gap-1.5'>
                        <Mail aria-hidden='true' className='size-4 shrink-0 text-ink-3' />
                        <span dir='ltr' className='truncate'>{user.email}</span>
                      </p>
                      <p className='flex items-center gap-1.5 text-ink-3'>
                        <Phone aria-hidden='true' className='size-4 shrink-0' />
                        <span dir='ltr'>{user.phone || t('No phone')}</span>
                      </p>
                      <p className='text-caption text-ink-3'>{getUserIdentifier(user, t)}</p>
                    </div>
                    <div className='min-w-0 flex-1 basis-40'>
                      {user.profileType !== 'patient' ? (
                        <span className='text-ink-3'>—</span>
                      ) : user.insurance?.enabled ? (
                        <div className='space-y-1'>
                          <InsuranceStatusBadge insurance={user.insurance} t={t} />
                          <p className='truncate text-caption text-ink-3' title={user.insurance.provider}>
                            {user.insurance.provider || t('Provider not set')}
                          </p>
                        </div>
                      ) : (
                        <Badge>{t('None on file')}</Badge>
                      )}
                    </div>
                    <div className='flex flex-1 basis-36 flex-wrap items-center gap-1'>
                      <Badge tone={user.isActive ? 'success' : 'danger'} dot>{user.isActive ? t('Active') : t('Disabled')}</Badge>
                      <Badge tone={user.mfa?.enabled ? 'brand' : 'neutral'}>{user.mfa?.enabled ? t('MFA On') : t('MFA Off')}</Badge>
                      {user.mfa?.requiredByAdmin && <Badge tone='warning'>{t('MFA required')}</Badge>}
                    </div>
                    <UserRowActionsMenu
                      user={user}
                      t={t}
                      isOpen={actionsMenuKey === key}
                      onToggle={(open) => setActionsMenuKey(open ? key : null)}
                      onEdit={() => openEdit(user)}
                      onResetPassword={() => setPasswordUser(user)}
                      onToggleMfaRequirement={() => toggleUserMfaRequirement(user)}
                      onResetMfa={() => confirmResetMfa(user)}
                      onDelete={() => confirmDelete(user)}
                      onOpenPatientInsurance={() => navigate('/patients', { state: { openPatientId: user.profileId } })}
                      onOpenDoctorProfile={() => navigate('/doctor-list', { state: { openDoctorId: user.profileId } })}
                      onOpenReceptionistProfile={() => navigate(`/edit-receptionist/${user.profileId}`)}
                    />
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>

      <Modal open={creatingUser} onClose={closeCreate} title={t('Add patient')} size='lg'>
        <form onSubmit={saveNewUser}>
          <p className='mb-4 rounded-control bg-info-soft px-3 py-2 text-caption text-info-ink'>
            {t('Quick patient registration note')}{' '}
            <button type='button' onClick={() => { closeCreate(); goAddDoctor() }} className='cursor-pointer font-semibold underline'>{t('Add doctor')}</button>
            {' '}{t('Quick patient registration note middle')}{' '}
            {t('Quick patient registration note receptionist')}{' '}
            <button type='button' onClick={() => { closeCreate(); goAddReceptionist() }} className='cursor-pointer font-semibold underline'>{t('Add receptionist')}</button>.
          </p>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <Field label={t('Name')} required>
              <Input data-autofocus required value={createForm.name} onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))} />
            </Field>
            <Field label={t('Email')} required>
              <Input dir='ltr' style={{ textAlign: 'start' }} required type='email' value={createForm.email} onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))} />
            </Field>
            <Field label={t('Phone')} required>
              <Input dir='ltr' style={{ textAlign: 'start' }} required type='tel' value={createForm.phone} onChange={(event) => setCreateForm((prev) => ({ ...prev, phone: event.target.value }))} />
            </Field>
            <Field label={t('Password')} required hint={t('Minimum 8 characters')}>
              <Input required type='password' autoComplete='new-password' value={createForm.password} onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))} />
            </Field>
            <PatientFields form={createForm} setForm={setCreateForm} t={t} />
          </div>
          <div className='mt-5 flex justify-end gap-2'>
            <Button variant='secondary' onClick={closeCreate}>{t('Cancel')}</Button>
            <Button type='submit' loading={saving}>{t('Create patient')}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(editingUser)} onClose={closeEdit} title={editingUser ? `${t('Edit')}: ${nameOf(editingUser)}` : ''} size='lg'>
        {editingUser && (
          <form onSubmit={saveUser}>
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
              <Field label={t('Name')} hint={editingUser.profileType !== 'patient' ? t('Saved in both languages automatically.') : undefined}>
                <Input data-autofocus value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
              </Field>
              <Field label={t('Email')}>
                <Input dir='ltr' style={{ textAlign: 'start' }} type='email' value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
              </Field>
              <Field label={t('Phone')}>
                <Input dir='ltr' style={{ textAlign: 'start' }} type='tel' value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} />
              </Field>
              {editingUser.profileType === 'patient' && <PatientFields form={form} setForm={setForm} t={t} />}
            </div>
            <div className='mt-5 flex justify-end gap-2'>
              <Button variant='secondary' onClick={closeEdit}>{t('Cancel')}</Button>
              <Button type='submit' loading={saving}>{t('Save Changes')}</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={Boolean(passwordUser)} onClose={closePassword} title={t('Reset Password')} size='sm'>
        {passwordUser && (
          <form onSubmit={savePassword}>
            <Field label={`${t('Set new password for')} ${nameOf(passwordUser)}`} hint={t('Minimum 8 characters')}>
              <Input data-autofocus required type='password' autoComplete='new-password' value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            </Field>
            <div className='mt-5 flex justify-end gap-2'>
              <Button variant='secondary' onClick={closePassword}>{t('Cancel')}</Button>
              <Button type='submit' loading={saving}>{t('Reset Password')}</Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        body={confirm?.body}
        confirmLabel={confirm?.confirmLabel}
        danger={confirm?.danger}
        busy={saving}
        onConfirm={runConfirm}
        onClose={() => setConfirm(null)}
      />
    </AdminPage>
  )
}

export default Users
