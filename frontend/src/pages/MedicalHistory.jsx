import React, { useContext, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, ShieldCheck } from 'lucide-react'
import { AppContext } from '../context/AppContext'
import { useLanguage } from '../i18n'
import { Button, Card, CardBody, EmptyState, Field, Skeleton, SkeletonGroup, Textarea, notify } from '../components/ui'
import { useAccountApi, useServerText } from '../components/account/accountUi'
import { QuickChips, toggleInText } from '../components/account/QuickChips'

const emptyHistory = { conditions: '', allergies: '', surgeries: '', familyHistory: '', socialHistory: '', notes: '' }

const fields = [
  { name: 'allergies', labelKey: 'Allergies', hintKey: 'Medicine, food, environmental, or other known allergies', chips: 'allergies' },
  { name: 'conditions', labelKey: 'Medical Conditions', hintKey: 'Chronic conditions, current diagnoses, or recurring concerns', chips: 'conditions' },
  { name: 'surgeries', labelKey: 'Surgeries', hintKey: 'Past operations, procedures, or hospital stays' },
  { name: 'familyHistory', labelKey: 'Family History', hintKey: 'Inherited conditions or major family health patterns' },
  { name: 'socialHistory', labelKey: 'Social History', hintKey: 'Smoking, alcohol, activity level, occupation, or lifestyle notes' },
  { name: 'notes', labelKey: 'Additional Notes', hintKey: 'Anything else your care team should know' }
]

const pickFields = (source = {}) => fields.reduce((acc, { name }) => ({ ...acc, [name]: source[name] || '' }), {})

const MedicalHistory = () => {
  const navigate = useNavigate()
  const { token, loadUserProfileData } = useContext(AppContext)
  const { t, language, localizeDigits, formatPercent } = useLanguage()
  const api = useAccountApi()
  const say = useServerText()
  const [history, setHistory] = useState(emptyHistory)
  const [saved, setSaved] = useState(emptyHistory)
  const [meta, setMeta] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)

  const hasChanges = JSON.stringify(history) !== JSON.stringify(saved)
  const filled = fields.filter(({ name }) => String(history[name]).trim()).length
  const percent = Math.round((filled / fields.length) * 100)

  const load = async () => {
    setLoading(true)
    setLoadFailed(false)
    const data = await api('get', '/api/user/medical-history')
    if (data.success) {
      const values = pickFields(data.medicalHistory)
      setHistory(values)
      setSaved(values)
      setMeta(data.medicalHistory || {})
    } else {
      setLoadFailed(true)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!token) {
      navigate('/login?mode=login', { replace: true })
      return
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loads when the session changes
  }, [token])

  // Long answers are easy to lose by closing a tab, so warn first.
  useEffect(() => {
    if (!hasChanges) return undefined
    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [hasChanges])

  const updatedText = () => {
    if (!meta.updatedAt) return t('Not updated yet')
    const when = new Date(meta.updatedAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    const who = meta.updatedBy && meta.updatedBy !== 'patient' ? t('by your doctor') : ''
    return `${localizeDigits(String(t('Last updated: {{time}}')).replace('{{time}}', when))} ${who}`.trim()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    const data = await api('put', '/api/user/medical-history', { medicalHistory: history })
    setSaving(false)
    if (!data.success) return notify.error(say(data.message))
    const values = pickFields(data.medicalHistory)
    setHistory(values)
    setSaved(values)
    setMeta(data.medicalHistory)
    notify.success(say(data.message))
    loadUserProfileData()
  }

  if (loading) {
    return (
      <main className='py-8'>
        <SkeletonGroup label={t('Loading...')}>
          <Skeleton className='mb-4 h-10 w-56' />
          <div className='grid gap-4 md:grid-cols-2'>
            {[...Array(6)].map((_, index) => <Skeleton key={index} className='h-40 rounded-card' />)}
          </div>
        </SkeletonGroup>
      </main>
    )
  }

  if (loadFailed) {
    return (
      <main className='py-12'>
        <EmptyState title={t('We could not open your medical history')} description={t('Please check your connection and try again.')} action={<Button onClick={load}>{t('Try again')}</Button>} />
      </main>
    )
  }

  return (
    <main className='mx-auto max-w-5xl pt-6 pb-24'>
      <Link to='/my-profile' className='mb-4 inline-flex min-h-9 items-center gap-2 text-body-sm text-ink-2 hover:text-ink'>
        <ArrowLeft className='size-4 rtl:-scale-x-100' aria-hidden='true' /> {t('Your health space')}
      </Link>
      <header className='mb-6'>
        <h1 className='font-display text-display text-ink'>{t('Medical History')}</h1>
        <p className='mt-2 max-w-2xl text-body-sm text-ink-2'>{t('Keep your health background up to date so doctors can review the right context before and after visits.')}</p>
        <div className='mt-3 flex flex-wrap items-center gap-3 text-caption text-ink-2'>
          <span className='inline-flex items-center gap-1.5'><ShieldCheck className='size-4 text-brand' aria-hidden='true' /> {updatedText()}</span>
          <span>·</span>
          <span>{localizeDigits(String(t('{{n}} complete')).replace('{{n}}', formatPercent(percent)))}</span>
        </div>
      </header>

      <form onSubmit={handleSubmit}>
        <div className='grid gap-4 md:grid-cols-2'>
          {fields.map((field) => (
            <Card key={field.name} variant='flat'>
              <CardBody>
                <Field label={t(field.labelKey)} hint={t(field.hintKey)}>
                  <Textarea
                    dir='auto'
                    rows={4}
                    maxLength={5000}
                    value={history[field.name]}
                    onChange={(event) => setHistory((current) => ({ ...current, [field.name]: event.target.value }))}
                    placeholder={t('Write here')}
                  />
                </Field>
                {field.chips && (
                  <QuickChips group={field.chips} value={history[field.name]} onToggle={(item) => setHistory((current) => ({ ...current, [field.name]: toggleInText(current[field.name], item) }))} />
                )}
              </CardBody>
            </Card>
          ))}
        </div>

        <div className='sticky bottom-0 z-10 mt-6 flex flex-col gap-3 border-t border-line bg-canvas py-4 sm:flex-row sm:items-center sm:justify-between'>
          <p className='text-caption text-ink-2'>{t('You can update this anytime. Doctors may also add notes after appointments.')}</p>
          <Button type='submit' loading={saving} disabled={!hasChanges} leadingIcon={<Save className='size-4' />}>{t('Save History')}</Button>
        </div>
      </form>
    </main>
  )
}

export default MedicalHistory
