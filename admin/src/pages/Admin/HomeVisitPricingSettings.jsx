import { useContext, useEffect, useState } from 'react'
import axios from 'axios'
import { Banknote, Home, Percent, Save } from 'lucide-react'
import { AdminContext } from '../../context/AdminContext'
import { AppContext } from '../../context/AppContext'
import { useLanguage } from '../../i18n'
import { AdminPage } from '../../components/admin/AdminPage'
import { Button, Card, CardBody, Field, Input, notify, Skeleton, SkeletonGroup } from '../../components/ui'
import { computeHomeVisitSurcharge, DEFAULT_HOME_VISIT_PRICING, normalizeHomeVisitPricing } from '../../utils/homeVisitPricing'

const EXAMPLE_DOCTOR_FEE = 500

/*
 * The fixed rule is the server's. The server silently clamps a percentage to 0 to 200,
 * so it is refused here instead: what the admin saves is what they typed.
 */
const validatePricing = (form, t) => {
  if (form.pricingType === 'fixed') {
    return Number(form.fixedAmount) > 0 ? undefined : t('Fixed home visit amount must be greater than zero')
  }
  const percentage = Number(form.percentageValue)
  const valid = String(form.percentageValue).trim() !== '' && percentage >= 0 && percentage <= 200
  return valid ? undefined : t('Percentage must be between 0 and 200')
}

const UnitInput = ({ unit, ...props }) => (
  <div className='flex items-stretch gap-2'>
    <Input type='number' min={0} step='any' inputMode='decimal' className='min-w-0 flex-1' {...props} />
    <span className='flex shrink-0 items-center rounded-control bg-surface-sunken px-3 text-caption font-semibold text-ink-2'>{unit}</span>
  </div>
)

const ModeOption = ({ checked, onChange, value, icon, title, hint }) => (
  <label
    className={`flex cursor-pointer items-start gap-3 rounded-control border p-4 transition duration-(--duration-fast) ease-standard ${
      checked ? 'border-primary bg-primary-soft' : 'border-line hover:bg-surface-sunken'
    }`}
  >
    <input
      type='radio'
      name='pricingType'
      value={value}
      checked={checked}
      onChange={onChange}
      className='mt-0.5 size-4 shrink-0 cursor-pointer accent-(--color-primary)'
    />
    <span className='min-w-0'>
      <span className='flex items-center gap-2 text-body-sm font-semibold text-ink'>
        {icon}
        {title}
      </span>
      <span className='mt-1 block text-caption text-ink-2'>{hint}</span>
    </span>
  </label>
)

const ExampleRow = ({ label, value, strong = false }) => (
  <div className='flex items-baseline justify-between gap-4 py-1.5'>
    <dt className='text-body-sm text-ink-2'>{label}</dt>
    <dd className={`text-body-sm tabular-nums text-ink ${strong ? 'font-semibold' : ''}`}>
      <bdi>{value}</bdi>
    </dd>
  </div>
)

const HomeVisitPricingSettings = () => {
  const { aToken, backendUrl, updateHomeVisitPricingSettings } = useContext(AdminContext)
  const { currency } = useContext(AppContext)
  const { t } = useLanguage()
  const [form, setForm] = useState(DEFAULT_HOME_VISIT_PRICING)
  const [loadState, setLoadState] = useState('loading')
  const [attempted, setAttempted] = useState(false)
  const [saving, setSaving] = useState(false)

  /* Read from the server, not the cached copy, so a save can never write stale or default pricing. */
  const loadSettings = async () => {
    setLoadState('loading')
    try {
      const { data } = await axios.get(`${backendUrl}/api/admin/site-settings`, { headers: { aToken } })
      if (!data.success) throw new Error(data.message)
      setForm(normalizeHomeVisitPricing(data.settings?.homeVisitPricing))
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

  const error = validatePricing(form, t)
  const isFixed = form.pricingType === 'fixed'
  const money = (amount) => `${currency}${Math.round(amount * 100) / 100}`
  const surcharge = error ? 0 : computeHomeVisitSurcharge(EXAMPLE_DOCTOR_FEE, form)
  /* A percentage out of range is plainly wrong while typing. An empty fixed amount waits for a save. */
  const shownError = attempted || (!isFixed && String(form.percentageValue).trim() !== '') ? error : undefined

  const handleSubmit = async (event) => {
    event.preventDefault()
    setAttempted(true)
    if (error) {
      notify.error(error)
      return
    }
    setSaving(true)
    await updateHomeVisitPricingSettings({
      pricingType: form.pricingType,
      percentageValue: Number(form.percentageValue),
      fixedAmount: Number(form.fixedAmount)
    })
    setSaving(false)
  }

  return (
    <AdminPage
      title={t('Home visit pricing')}
      description={t('Set what a home visit adds to the examination fee, as a percentage or a fixed amount. Patients see it when they book.')}
      icon={Home}
      width='max-w-2xl'
    >
      {loadState === 'loading' && (
        <SkeletonGroup className='space-y-4 rounded-card border border-line bg-surface p-5'>
          <Skeleton className='h-16 w-full' />
          <Skeleton className='h-16 w-full' />
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
              <fieldset className='space-y-3'>
                <legend className='mb-3 text-body-sm font-semibold text-ink'>{t('Pricing mode')}</legend>
                <ModeOption
                  value='percentage'
                  checked={!isFixed}
                  onChange={() => updateField('pricingType', 'percentage')}
                  icon={<Percent aria-hidden='true' className='size-4 shrink-0 text-brand' />}
                  title={t('Percentage of the examination fee')}
                  hint={t('For example, 50% adds half of the examination fee.')}
                />
                <ModeOption
                  value='fixed'
                  checked={isFixed}
                  onChange={() => updateField('pricingType', 'fixed')}
                  icon={<Banknote aria-hidden='true' className='size-4 shrink-0 text-brand' />}
                  title={t('Fixed amount')}
                  hint={t('Every home visit adds the same amount, whatever the doctor charges.')}
                />
              </fieldset>

              {isFixed ? (
                <Field label={t('Fixed home visit amount')} error={shownError} required>
                  <UnitInput unit={currency.trim()} value={form.fixedAmount} onChange={(event) => updateField('fixedAmount', event.target.value)} />
                </Field>
              ) : (
                <Field label={t('Percentage value')} hint={t('From 0 to 200.')} error={shownError} required>
                  <UnitInput unit='%' max={200} value={form.percentageValue} onChange={(event) => updateField('percentageValue', event.target.value)} />
                </Field>
              )}

              <section className='rounded-control bg-surface-sunken p-4'>
                <h2 className='text-body-sm font-semibold text-ink'>{t('Worked example')}</h2>
                {error ? (
                  <p className='mt-1 text-body-sm text-ink-3'>{t('Enter a valid value to see what a patient would pay.')}</p>
                ) : (
                  <dl className='mt-2 divide-y divide-line'>
                    <ExampleRow label={t('If the examination fee is')} value={money(EXAMPLE_DOCTOR_FEE)} />
                    <ExampleRow label={t('The home visit adds')} value={money(surcharge)} />
                    <ExampleRow label={t('The patient pays')} value={money(EXAMPLE_DOCTOR_FEE + surcharge)} strong />
                  </dl>
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

export default HomeVisitPricingSettings
