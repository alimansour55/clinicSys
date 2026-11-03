import { useState } from 'react'
import { Pencil, Trash2, UserPlus, Users } from 'lucide-react'
import { useLanguage } from '../../i18n'
import { Button, Card, CardBody, EmptyState, Field, IconButton, Input, Modal, Select, Textarea, notify } from '../ui'
import { useAccountApi, useServerText } from './accountApi'
import { BLOOD_TYPES, ageInYears, todayIso } from './hubLogic'

const RELATIONS = [
  { value: 'child', label: 'Child (relation)' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'parent', label: 'Parent' },
  { value: 'sibling', label: 'Brother or sister' },
  { value: 'other', label: 'Someone else' }
]

const blank = { name: '', relation: 'child', dob: '', gender: 'Not Selected', bloodType: '', allergies: '', conditions: '', medications: '', notes: '' }

const MemberModal = ({ member, onClose, onSaved }) => {
  const { t } = useLanguage()
  const api = useAccountApi()
  const say = useServerText()
  const [form, setForm] = useState({ ...blank, ...(member || {}) })
  const [saving, setSaving] = useState(false)
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const save = async () => {
    setSaving(true)
    const data = member
      ? await api('put', `/api/account/family/${member._id}`, form)
      : await api('post', '/api/account/family', form)
    setSaving(false)
    if (!data.success) return notify.error(say(data.message))
    notify.success(say(data.message))
    onSaved()
  }

  return (
    <Modal
      open
      onClose={onClose}
      size='lg'
      title={member ? t('Edit family profile') : t('Add a family member')}
      description={t('Keep the health details of the people you care for in one place. Only you can see them.')}
      footer={<Button loading={saving} onClick={save}>{t('Save')}</Button>}
    >
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <Field label={t('Name')} required>
          <Input data-autofocus dir='auto' maxLength={120} value={form.name} onChange={set('name')} />
        </Field>
        <Field label={t('Relationship')}>
          <Select value={form.relation} onChange={set('relation')}>
            {RELATIONS.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
          </Select>
        </Field>
        <Field label={t('Birth date')}>
          <Input type='date' max={todayIso()} value={form.dob} onChange={set('dob')} className='date-field-input' />
        </Field>
        <Field label={t('Gender')}>
          <Select value={form.gender} onChange={set('gender')}>
            <option value='Not Selected'>{t('Prefer not to say')}</option>
            <option value='Male'>{t('Male')}</option>
            <option value='Female'>{t('Female')}</option>
          </Select>
        </Field>
        <Field label={t('Blood type')}>
          <Select dir='ltr' value={form.bloodType} onChange={set('bloodType')}>
            <option value=''>{t('Not sure')}</option>
            {BLOOD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </Select>
        </Field>
        <Field label={t('Allergies')}>
          <Textarea dir='auto' rows={2} maxLength={2000} value={form.allergies} onChange={set('allergies')} />
        </Field>
        <Field label={t('Conditions')}>
          <Textarea dir='auto' rows={2} maxLength={2000} value={form.conditions} onChange={set('conditions')} />
        </Field>
        <Field label={t('Regular medicines')}>
          <Textarea dir='auto' rows={2} maxLength={2000} value={form.medications} onChange={set('medications')} />
        </Field>
        <Field label={t('Notes')} className='sm:col-span-2'>
          <Textarea dir='auto' rows={2} maxLength={2000} value={form.notes} onChange={set('notes')} />
        </Field>
      </div>
    </Modal>
  )
}

const FamilyPanel = ({ members, reload }) => {
  const { t, localizeDigits } = useLanguage()
  const api = useAccountApi()
  const say = useServerText()
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const [removing, setRemoving] = useState(null)

  const ageOf = (dob) => {
    const years = ageInYears(dob)
    if (years === null) return ''
    return localizeDigits(String(t('{{n}} years old')).replace('{{n}}', years))
  }

  const remove = async () => {
    const data = await api('delete', `/api/account/family/${removing._id}`)
    setRemoving(null)
    if (!data.success) return notify.error(say(data.message))
    notify.success(say(data.message))
    reload()
  }

  return (
    <section aria-label={t('Family')} className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='max-w-xl text-body-sm text-ink-2'>{t('Each person gets their own timeline, reminders and health passport.')}</p>
        <Button leadingIcon={<UserPlus className='size-4' />} onClick={() => setCreating(true)}>{t('Add a family member')}</Button>
      </div>

      {members.length === 0 ? (
        <EmptyState icon={<Users className='size-6' />} title={t('Caring for someone else?')} description={t('Add your children or parents, and always have their allergies and medicines to hand.')} headingLevel={3} />
      ) : (
        <ul className='grid grid-cols-1 gap-3 md:grid-cols-2'>
          {members.map((member) => (
            <li key={member._id}>
              <Card className='h-full'>
                <CardBody>
                  <div className='flex items-start justify-between gap-2'>
                    <div className='min-w-0'>
                      <p dir='auto' className='text-body font-semibold text-ink'>{member.name}</p>
                      <p className='text-caption text-ink-2'>{[t(RELATIONS.find((relation) => relation.value === member.relation)?.label || 'Someone else'), member.dob && ageOf(member.dob)].filter(Boolean).join(' · ')}</p>
                    </div>
                    <span className='flex gap-1'>
                      <IconButton label={t('Edit')} variant='ghost' size='sm' onClick={() => setEditing(member)}><Pencil className='size-4' /></IconButton>
                      <IconButton label={t('Remove')} variant='ghost' size='sm' onClick={() => setRemoving(member)}><Trash2 className='size-4' /></IconButton>
                    </span>
                  </div>
                  <dl className='mt-3 space-y-1 text-body-sm'>
                    {member.bloodType && <div className='flex gap-2'><dt className='text-ink-3'>{t('Blood type')}:</dt><dd dir='ltr' className='font-medium text-ink'>{member.bloodType}</dd></div>}
                    {member.allergies && <div className='flex gap-2'><dt className='shrink-0 text-ink-3'>{t('Allergies')}:</dt><dd dir='auto' className='text-danger-ink'>{member.allergies}</dd></div>}
                    {member.conditions && <div className='flex gap-2'><dt className='shrink-0 text-ink-3'>{t('Conditions')}:</dt><dd dir='auto' className='text-ink'>{member.conditions}</dd></div>}
                  </dl>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {(creating || editing) && (
        <MemberModal
          member={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => {
            setCreating(false)
            setEditing(null)
            reload()
          }}
        />
      )}
      {removing && (
        <Modal
          open
          size='sm'
          onClose={() => setRemoving(null)}
          title={t('Remove this family member?')}
          description={t('Their timeline and reminders will be deleted too. This cannot be undone.')}
          footer={<Button variant='danger' onClick={remove}>{t('Remove')}</Button>}
        />
      )}
    </section>
  )
}

export default FamilyPanel
