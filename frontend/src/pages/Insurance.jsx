import React, { useContext, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { AppContext } from '../context/AppContext'
import { useLanguage } from '../i18n'
import { Badge, Button, Card, CardBody, CardFooter, Skeleton, SkeletonGroup, notify } from '../components/ui'
import { FormError, useAccountApi, useServerText } from '../components/account/accountUi'
import InsuranceFields, { emptyInsurance, insuranceProblem } from '../components/account/InsuranceFields'
import { getInsuranceStatus, insuranceStatusLabel, isInsuranceExpired } from '../utils/insuranceVerification'

const today = new Date().toISOString().split('T')[0]

const STATUS_TONES = { approved: 'success', declined: 'danger', pending: 'warning', none: 'neutral' }

const STATUS_NOTES = {
  pending: 'Your insurance is on file and waiting for reception desk review.',
  approved: 'Your insurance is approved and can be used when you book.',
  declined: 'Please correct your details and save them for another review.'
}

const pick = (source = {}) => ({
  provider: source.provider || '',
  fullName: source.fullName || '',
  birthDate: source.birthDate || '',
  idNumber: source.idNumber || '',
  expiryDate: source.expiryDate || ''
})

const Insurance = () => {
  const { token, userData, loadUserProfileData } = useContext(AppContext)
  const { t } = useLanguage()
  const api = useAccountApi()
  const say = useServerText()
  const navigate = useNavigate()
  const [enabled, setEnabled] = useState(false)
  const [values, setValues] = useState(emptyInsurance)
  const [cardFile, setCardFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      navigate('/login?mode=login', { replace: true })
      return
    }
    // Reception may have reviewed the card, so reload rather than trust what is in memory.
    loadUserProfileData()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load fresh insurance on each visit
  }, [token])

  useEffect(() => {
    setEnabled(Boolean(userData?.insurance?.enabled))
    setValues(pick(userData?.insurance))
  }, [userData])

  if (!userData) {
    return (
      <main className='py-8'>
        <SkeletonGroup label={t('Loading...')}>
          <Skeleton className='mx-auto h-96 max-w-3xl rounded-card' />
        </SkeletonGroup>
      </main>
    )
  }

  const stored = userData.insurance || {}
  const status = getInsuranceStatus(stored)
  const existingCard = stored.medicalCardPhoto || ''
  const expired = stored.enabled && isInsuranceExpired(stored.expiryDate)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if (enabled) {
      const problem = insuranceProblem(values, { file: cardFile, hasExistingCard: Boolean(existingCard) })
      if (problem) return setError(say(problem))
    }

    const formData = new FormData()
    formData.append('insuranceEnabled', enabled)
    if (enabled) {
      formData.append('insuranceProvider', values.provider)
      formData.append('insuranceFullName', values.fullName)
      formData.append('insuranceBirthDate', values.birthDate)
      formData.append('insuranceIdNumber', values.idNumber)
      formData.append('insuranceExpiryDate', values.expiryDate)
      if (cardFile) formData.append('insuranceCardPhoto', cardFile)
    }

    setSaving(true)
    const data = await api('post', '/api/user/update-insurance', formData)
    setSaving(false)
    if (!data.success) return setError(say(data.message))
    notify.success(say(data.message))
    setCardFile(null)
    await loadUserProfileData()
  }

  return (
    <main className='mx-auto max-w-3xl pt-6 pb-12'>
      <Link to='/my-profile' className='mb-4 inline-flex min-h-9 items-center gap-2 text-body-sm text-ink-2 hover:text-ink'>
        <ArrowLeft className='size-4 rtl:-scale-x-100' aria-hidden='true' /> {t('Your health space')}
      </Link>
      <header className='mb-6 flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h1 className='font-display text-display text-ink'>{t('Insurance')}</h1>
          <p className='mt-2 text-body-sm text-ink-2'>{t('Add or edit your medical insurance details.')}</p>
        </div>
        {stored.enabled && <Badge tone={STATUS_TONES[status]} dot>{insuranceStatusLabel(status, t)}</Badge>}
      </header>

      {stored.enabled && (
        <div className='mb-5 space-y-1 rounded-control bg-surface-sunken px-4 py-3 text-body-sm text-ink-2'>
          {STATUS_NOTES[status] && <p>{t(STATUS_NOTES[status])}</p>}
          {status === 'declined' && stored.declineReason && <p dir='auto'><span className='font-semibold text-danger-ink'>{t('Reason')}: </span>{stored.declineReason}</p>}
          {expired && <p className='font-semibold text-danger-ink'>{t('Your card expiry date has passed. Please update your details.')}</p>}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardBody className='space-y-5'>
            <label className='flex min-h-11 cursor-pointer items-center gap-3 text-body-sm font-semibold text-ink'>
              <input type='checkbox' checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className='size-5 accent-primary' />
              <span>
                {t('Use my insurance')}
                <span className='block text-caption font-normal text-ink-2'>{t('Turn this off to remove your insurance and your card from your account.')}</span>
              </span>
            </label>
            {enabled && (
              <InsuranceFields values={values} onChange={setValues} file={cardFile} onFileChange={setCardFile} existingCardUrl={existingCard} today={today} />
            )}
            <FormError>{error}</FormError>
          </CardBody>
          <CardFooter>
            <Button type='submit' loading={saving} leadingIcon={<Save className='size-4' />}>{t('Save Insurance')}</Button>
          </CardFooter>
        </Card>
      </form>
    </main>
  )
}

export default Insurance
