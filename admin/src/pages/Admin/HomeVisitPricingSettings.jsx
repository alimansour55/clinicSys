import React, { useContext, useEffect, useState } from 'react'
import { AdminContext } from '../../context/AdminContext'
import { AppContext } from '../../context/AppContext'
import { Home, Loader2, Percent, Save } from 'lucide-react'
import { DEFAULT_HOME_VISIT_PRICING, normalizeHomeVisitPricing } from '../../utils/homeVisitPricing'

const HomeVisitPricingSettings = () => {
  const { aToken, siteSettings, getSiteSettings, updateHomeVisitPricingSettings } = useContext(AdminContext)
  const { currency, t } = useContext(AppContext)
  const [form, setForm] = useState(DEFAULT_HOME_VISIT_PRICING)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (aToken) getSiteSettings()
  }, [aToken])

  useEffect(() => {
    if (siteSettings?.homeVisitPricing) {
      setForm(normalizeHomeVisitPricing(siteSettings.homeVisitPricing))
    }
  }, [siteSettings])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    const payload = {
      pricingType: form.pricingType,
      percentageValue: Number(form.percentageValue),
      fixedAmount: Number(form.fixedAmount)
    }
    await updateHomeVisitPricingSettings(payload)
    setSaving(false)
  }

  return (
    <div className='mx-auto max-w-2xl p-4 sm:p-6'>
      <div className='mb-6'>
        <h1 className='flex items-center gap-2 text-xl font-bold text-gray-900 sm:text-2xl'>
          <Home className='h-6 w-6 text-primary' />
          {t('Home visit pricing')}
        </h1>
        <p className='mt-2 text-sm text-gray-600'>{t('Home visit pricing description')}</p>
      </div>

      <form onSubmit={handleSubmit} className='space-y-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6'>
        <fieldset className='space-y-3'>
          <legend className='text-sm font-semibold text-gray-900'>{t('Pricing mode')}</legend>
          <label className='flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50'>
            <input
              type='radio'
              name='pricingType'
              value='percentage'
              checked={form.pricingType === 'percentage'}
              onChange={() => setForm((prev) => ({ ...prev, pricingType: 'percentage' }))}
              className='mt-1 text-primary focus:ring-primary'
            />
            <span>
              <span className='flex items-center gap-2 text-sm font-semibold text-gray-900'>
                <Percent className='h-4 w-4 text-primary' />
                {t('Percentage of consultation fee')}
              </span>
              <span className='mt-1 block text-xs text-gray-500'>{t('Percentage mode hint')}</span>
            </span>
          </label>
          <label className='flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50'>
            <input
              type='radio'
              name='pricingType'
              value='fixed'
              checked={form.pricingType === 'fixed'}
              onChange={() => setForm((prev) => ({ ...prev, pricingType: 'fixed' }))}
              className='mt-1 text-primary focus:ring-primary'
            />
            <span>
              <span className='block text-sm font-semibold text-gray-900'>{t('Fixed amount')}</span>
              <span className='mt-1 block text-xs text-gray-500'>{t('Fixed mode hint')}</span>
            </span>
          </label>
        </fieldset>

        {form.pricingType === 'percentage' ? (
          <div>
            <label className='mb-2 block text-sm font-semibold text-gray-700'>{t('Percentage value')}</label>
            <div className='flex rounded-lg border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-primary'>
              <input
                type='number'
                min={0}
                max={200}
                step={1}
                value={form.percentageValue}
                onChange={(e) => setForm((prev) => ({ ...prev, percentageValue: e.target.value }))}
                className='min-w-0 flex-1 rounded-l-lg px-3 py-2.5 text-sm outline-none'
                required
              />
              <span className='flex items-center rounded-r-lg border-l border-gray-200 bg-gray-50 px-3 text-xs font-semibold text-gray-500'>%</span>
            </div>
            <p className='mt-2 text-xs text-gray-500'>
              {t('Example')}: {t('If doctor fee is')} {currency}500 → {t('home visit adds')} {currency}
              {(500 * Number(form.percentageValue || 0)) / 100} ({t('total')} {currency}
              {500 + (500 * Number(form.percentageValue || 0)) / 100})
            </p>
          </div>
        ) : (
          <div>
            <label className='mb-2 block text-sm font-semibold text-gray-700'>{t('Fixed home visit amount')}</label>
            <div className='flex rounded-lg border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-primary'>
              <span className='flex items-center rounded-l-lg border-r border-gray-200 bg-gray-50 px-3 text-xs font-semibold text-gray-500'>{currency}</span>
              <input
                type='number'
                min={0}
                step={1}
                value={form.fixedAmount}
                onChange={(e) => setForm((prev) => ({ ...prev, fixedAmount: e.target.value }))}
                className='min-w-0 flex-1 rounded-r-lg px-3 py-2.5 text-sm outline-none'
                required
              />
            </div>
          </div>
        )}

        <button
          type='submit'
          disabled={saving}
          className='flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary/90 disabled:bg-gray-400'
        >
          {saving ? <Loader2 className='h-4 w-4 animate-spin' /> : <Save className='h-4 w-4' />}
          {saving ? t('Saving...') : t('Save settings')}
        </button>
      </form>
    </div>
  )
}

export default HomeVisitPricingSettings
