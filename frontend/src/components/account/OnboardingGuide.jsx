import { useContext, useState } from 'react'
import { BellRing, CheckCircle2, HeartPulse, Sparkles, Users } from 'lucide-react'
import { AppContext } from '../../context/AppContext'
import { useLanguage } from '../../i18n'
import { Button, Field, Input, Modal, Select, Textarea, notify } from '../ui'
import { useAccountApi, useServerText } from './accountUi'
import { BLOOD_TYPES } from './FamilyPanel'
import { QuickChips, toggleInText } from './QuickChips'

const STEP_COUNT = 4

/**
 * The first few minutes in a new account. Every step can be skipped, and whatever is entered is saved as soon as
 * the person moves on, so closing halfway loses nothing.
 */
const OnboardingGuide = ({ userData, hub, onClose, onOpenTab }) => {
  const { loadUserProfileData, displayPersonName } = useContext(AppContext)
  const { t, localizeDigits } = useLanguage()
  const api = useAccountApi()
  const say = useServerText()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState({
    allergies: userData.medicalHistory?.allergies || '',
    conditions: userData.medicalHistory?.conditions || ''
  })
  const [emergency, setEmergency] = useState({
    bloodType: hub.emergency?.bloodType || '',
    contactName: hub.emergency?.contactName || '',
    contactPhone: hub.emergency?.contactPhone || ''
  })

  const firstName = String(displayPersonName(userData.name) || userData.name || '').split(' ')[0]

  const saveCurrent = async () => {
    if (step === 1 && (history.allergies !== (userData.medicalHistory?.allergies || '') || history.conditions !== (userData.medicalHistory?.conditions || ''))) {
      const data = await api('put', '/api/user/medical-history', { medicalHistory: { ...userData.medicalHistory, ...history } })
      if (!data.success) {
        notify.error(say(data.message))
        return false
      }
    }
    if (step === 2 && (emergency.bloodType || emergency.contactName || emergency.contactPhone)) {
      const data = await api('put', '/api/account/emergency', emergency)
      if (!data.success) {
        notify.error(say(data.message))
        return false
      }
    }
    return true
  }

  const next = async () => {
    setBusy(true)
    const saved = await saveCurrent()
    setBusy(false)
    if (saved) setStep((value) => value + 1)
  }

  const finish = async (action, tab) => {
    await api('post', '/api/account/onboarding', { action })
    await loadUserProfileData()
    onClose()
    if (tab) onOpenTab(tab)
  }

  const footer = step === STEP_COUNT - 1 ? (
    <Button onClick={() => finish('complete')}>{t('Open my health space')}</Button>
  ) : (
    <div className='flex w-full flex-wrap items-center justify-between gap-2'>
      <span className='text-caption text-ink-3'>{localizeDigits(String(t('Step {{n}} of 4')).replace('{{n}}', step + 1))}</span>
      <span className='flex gap-2'>
        {step > 0 && <Button variant='ghost' onClick={() => setStep((value) => value + 1)}>{t('Skip this step')}</Button>}
        <Button loading={busy} onClick={next}>{step === 0 ? t('Let us begin') : t('Next')}</Button>
      </span>
    </div>
  )

  return (
    <Modal open onClose={() => finish('dismiss')} title={t('Welcome to Clinivo')} size='md' footer={footer}>
      <div aria-live='polite'>
        {step === 0 && (
          <div className='space-y-4'>
            <Sparkles className='size-8 text-brand' aria-hidden='true' />
            <p className='font-display text-title-lg text-ink'>{String(t('{{name}}, this is your health space.')).replace('{{name}}', firstName)}</p>
            <p className='text-body-sm text-ink-2'>{t('Your visits, prescriptions, medicines and family, all in one calm place. Two minutes now could save a doctor from guessing later.')}</p>
          </div>
        )}

        {step === 1 && (
          <div className='space-y-4'>
            <p className='flex items-center gap-2 text-subtitle font-semibold text-ink'><HeartPulse className='size-5 text-brand' aria-hidden='true' /> {t('What should a doctor always know?')}</p>
            <div>
              <Field label={t('Allergies')} hint={t('Tap to add, or type your own.')}>
                <Textarea data-autofocus dir='auto' rows={2} maxLength={5000} value={history.allergies} onChange={(event) => setHistory((current) => ({ ...current, allergies: event.target.value }))} />
              </Field>
              <QuickChips group='allergies' value={history.allergies} onToggle={(item) => setHistory((current) => ({ ...current, allergies: toggleInText(current.allergies, item) }))} />
            </div>
            <div>
              <Field label={t('Conditions')}>
                <Textarea dir='auto' rows={2} maxLength={5000} value={history.conditions} onChange={(event) => setHistory((current) => ({ ...current, conditions: event.target.value }))} />
              </Field>
              <QuickChips group='conditions' value={history.conditions} onToggle={(item) => setHistory((current) => ({ ...current, conditions: toggleInText(current.conditions, item) }))} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className='space-y-4'>
            <p className='text-subtitle font-semibold text-ink'>{t('Who should we call in an emergency?')}</p>
            <Field label={t('Blood type')}>
              <Select dir='ltr' value={emergency.bloodType} onChange={(event) => setEmergency((current) => ({ ...current, bloodType: event.target.value }))}>
                <option value=''>{t('Not sure')}</option>
                {BLOOD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </Select>
            </Field>
            <Field label={t('Emergency contact name')}>
              <Input dir='auto' maxLength={120} value={emergency.contactName} onChange={(event) => setEmergency((current) => ({ ...current, contactName: event.target.value }))} />
            </Field>
            <Field label={t('Emergency contact phone')}>
              <Input dir='ltr' type='tel' maxLength={24} value={emergency.contactPhone} onChange={(event) => setEmergency((current) => ({ ...current, contactPhone: event.target.value }))} />
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className='space-y-4'>
            <CheckCircle2 className='size-8 text-success-ink' aria-hidden='true' />
            <p className='font-display text-title-lg text-ink'>{t('You are all set.')}</p>
            <p className='text-body-sm text-ink-2'>{t('When you are ready, here is what to try next.')}</p>
            <div className='grid grid-cols-1 gap-2'>
              <Button variant='secondary' leadingIcon={<BellRing className='size-4' />} onClick={() => finish('complete', 'reminders')}>{t('Add a medicine reminder')}</Button>
              <Button variant='secondary' leadingIcon={<Users className='size-4' />} onClick={() => finish('complete', 'family')}>{t('Add a family member')}</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default OnboardingGuide
