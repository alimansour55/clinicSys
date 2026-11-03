import { useContext, useEffect, useState } from 'react'
import axios from 'axios'
import { Save, Wallet } from 'lucide-react'
import { AdminContext } from '../../context/AdminContext'
import { AppContext } from '../../context/AppContext'
import { useLanguage } from '../../i18n'
import { AdminPage } from '../../components/admin/AdminPage'
import { Button, Card, CardBody, Field, Input, notify, Skeleton, SkeletonGroup } from '../../components/ui'
import { DEFAULT_GLOBAL_VISIT_FEES, normalizeGlobalVisitFees } from '../../utils/globalVisitFees'

/* The same rules as updateGlobalVisitFeesSettings on the server. They only apply while the fees are on. */
const validateFees = (form, t) => {
  if (!form.enabled) return {}
  const examination = Number(form.examinationFee)
  const consultation = Number(form.consultationFee)
  const errors = {}
  if (!(examination > 0)) errors.examinationFee = t('Examination fee must be greater than zero when global fees are enabled')
  if (!(consultation > 0)) errors.consultationFee = t('Follow-up consultation fee must be greater than zero when global fees are enabled')
  else if (consultation >= examination && examination > 0) errors.consultationFee = t('Follow-up consultation fee must be lower than the examination fee')
  return errors
}

const CurrencyInput = ({ currency, ...props }) => (
  <div className='flex items-stretch gap-2'>
    <span className='flex shrink-0 items-center rounded-control bg-surface-sunken px-3 text-caption font-semibold text-ink-2'>{currency.trim()}</span>
    <Input type='number' min={0} step='any' inputMode='decimal' className='min-w-0 flex-1' {...props} />
  </div>
)

const ExampleRow = ({ label, value, strong = false }) => (
  <div className='flex items-baseline justify-between gap-4 py-1.5'>
    <dt className='text-body-sm text-ink-2'>{label}</dt>
    <dd className={`text-body-sm tabular-nums text-ink ${strong ? 'font-semibold' : ''}`}>
      <bdi>{value}</bdi>
    </dd>
  </div>
)

const GlobalVisitFeesSettings = () => {
  const { aToken, backendUrl, updateGlobalVisitFeesSettings } = useContext(AdminContext)
  const { currency } = useContext(AppContext)
  const { t } = useLanguage()
  const [form, setForm] = useState(DEFAULT_GLOBAL_VISIT_FEES)
  const [loadState, setLoadState] = useState('loading')
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)

  /* Read from the server, not the cached copy, so a save can never write stale or default fees. */
  const loadSettings = async () => {
    setLoadState('loading')
    try {
      const { data } = await axios.get(`${backendUrl}/api/admin/site-settings`, { headers: { aToken } })
      if (!data.success) throw new Error(data.message)
      setForm(normalizeGlobalVisitFees(data.settings?.globalVisitFees))
      setLoadState('ready')
    } catch {
      setLoadState('failed')
    }
  }

  useEffect(() => {
    if (aToken) loadSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aToken])

  const updateField = (field, value) => setForm((previous) => ({ ...previous, [field]: value }))

  const errors = validateFees(form, t)
  const examination = Number(form.examinationFee) || 0
  const consultation = Number(form.consultationFee) || 0
  const money = (amount) => `${currency}${Math.round(amount * 100) / 100}`
  /* The lower-than rule shows as soon as both are typed. The rest wait for a save, so an empty form is not shouting. */
  const consultationError = attempted || (examination > 0 && consultation > 0) ? errors.consultationFee : undefined

  const handleSubmit = async (event) => {
    event.preventDefault()
    setAttempted(true)
    const firstError = errors.examinationFee || errors.consultationFee
    if (firstError) {
      notify.error(firstError)
      return
    }
    setSaving(true)
    await updateGlobalVisitFeesSettings({ enabled: form.enabled, examinationFee: examination, consultationFee: consultation })
    setSaving(false)
  }

  return (
    <AdminPage
      title={t('Global visit fees')}
      description={t('Set the default examination and follow-up fees for every doctor. A doctor with their own fee keeps it.')}
      icon={Wallet}
      width='max-w-2xl'
    >
      {loadState === 'loading' && (
        <SkeletonGroup className='space-y-4 rounded-card border border-line bg-surface p-5'>
          <Skeleton className='h-16 w-full' />
          <Skeleton className='h-11 w-full' />
          <Skeleton className='h-11 w-full' />
        </SkeletonGroup>
      )}

      {loadState === 'failed' && (
        <div role='alert' className='flex flex-wrap items-center justify-between gap-3 rounded-card bg-danger-soft px-4 py-3 text-body-sm text-danger-ink'>
          <span className='min-w-0'>{t('These settings could not be loaded, so nothing can be saved yet.')}</span>
          <Button variant='secondary' size='sm' onClick={loadSettings}>{t('Try again')}</Button>
        </div>
      )}

      {loadState === 'ready' && (
        <Card>
          <CardBody>
            <form onSubmit={handleSubmit} noValidate className='space-y-5'>
              <label className='flex cursor-pointer items-start gap-3 rounded-control border border-line p-4 transition duration-(--duration-fast) ease-standard hover:bg-surface-sunken'>
                <input
                  type='checkbox'
                  checked={form.enabled}
                  onChange={(event) => updateField('enabled', event.target.checked)}
                  className='mt-0.5 size-5 shrink-0 cursor-pointer accent-(--color-primary)'
                />
                <span className='min-w-0'>
                  <span className='block text-body-sm font-semibold text-ink'>{t('Apply global fees to all doctors')}</span>
                  <span className='mt-1 block text-caption text-ink-3'>
                    {t('Applies to doctors with no fee of their own. Set a fee on a doctor and these amounts stop applying to that doctor only.')}
                  </span>
                </span>
              </label>

              <Field
                label={t('Examination fee (Kashf)')}
                hint={t('The full visit, and the default choice when booking.')}
                error={attempted ? errors.examinationFee : undefined}
                required={form.enabled}
              >
                <CurrencyInput
                  currency={currency}
                  value={form.examinationFee}
                  disabled={!form.enabled}
                  onChange={(event) => updateField('examinationFee', event.target.value)}
                />
              </Field>

              <Field
                label={t('Follow-up consultation fee (Istishara)')}
                hint={t('A lower fee, offered only within 30 days of a completed examination with the same doctor.')}
                error={consultationError}
                required={form.enabled}
              >
                <CurrencyInput
                  currency={currency}
                  value={form.consultationFee}
                  disabled={!form.enabled}
                  onChange={(event) => updateField('consultationFee', event.target.value)}
                />
              </Field>

              <section className='rounded-control bg-surface-sunken p-4'>
                <h2 className='text-body-sm font-semibold text-ink'>{t('Worked example')}</h2>
                {!form.enabled && <p className='mt-1 text-body-sm text-ink-3'>{t('Global fees are off, so these amounts are not applied to any doctor.')}</p>}
                {form.enabled && Object.keys(errors).length > 0 && <p className='mt-1 text-body-sm text-ink-3'>{t('Enter valid fees to see what a patient would pay.')}</p>}
                {form.enabled && Object.keys(errors).length === 0 && (
                  <>
                    <p className='mt-1 text-caption text-ink-3'>{t('For a doctor with no fee of their own:')}</p>
                    <dl className='mt-2 divide-y divide-line'>
                      <ExampleRow label={t('First visit (examination)')} value={money(examination)} />
                      <ExampleRow label={t('Follow-up within 30 days')} value={money(consultation)} />
                      <ExampleRow label={t('The patient saves on a follow-up')} value={money(examination - consultation)} strong />
                    </dl>
                  </>
                )}
              </section>

              <Button type='submit' fullWidth loading={saving} leadingIcon={<Save aria-hidden='true' className='size-4' />}>
                {t('Save settings')}
              </Button>
            </form>
          </CardBody>
        </Card>
      )}
    </AdminPage>
  )
}

export default GlobalVisitFeesSettings
