import React, { useContext, useEffect, useState } from 'react'
import { AdminContext } from '../../context/AdminContext'
import { AppContext } from '../../context/AppContext'
import { Stethoscope, Loader2, Save, ToggleLeft, ToggleRight } from 'lucide-react'
import { DEFAULT_GLOBAL_VISIT_FEES, normalizeGlobalVisitFees } from '../../utils/globalVisitFees'

const GlobalVisitFeesSettings = () => {
  const { aToken, siteSettings, getSiteSettings, updateGlobalVisitFeesSettings } = useContext(AdminContext)
  const { currency, t } = useContext(AppContext)
  const [form, setForm] = useState(DEFAULT_GLOBAL_VISIT_FEES)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (aToken) getSiteSettings()
  }, [aToken])

  useEffect(() => {
    if (siteSettings?.globalVisitFees) {
      setForm(normalizeGlobalVisitFees(siteSettings.globalVisitFees))
    }
  }, [siteSettings])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    await updateGlobalVisitFeesSettings({
      enabled: form.enabled,
      examinationFee: Number(form.examinationFee),
      consultationFee: Number(form.consultationFee)
    })
    setSaving(false)
  }

  return (
    <div className='mx-auto max-w-2xl p-4 sm:p-6'>
      <div className='mb-6'>
        <h1 className='flex items-center gap-2 text-xl font-bold text-gray-900 sm:text-2xl'>
          <Stethoscope className='h-6 w-6 text-primary' />
          {t('Global visit fees')}
        </h1>
        <p className='mt-2 text-sm text-gray-600'>{t('Global visit fees description')}</p>
      </div>

      <form onSubmit={handleSubmit} className='space-y-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6'>
        <label className='flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50'>
          <input
            type='checkbox'
            checked={form.enabled}
            onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
            className='mt-1 h-4 w-4 rounded text-primary focus:ring-primary'
          />
          <span>
            <span className='flex items-center gap-2 text-sm font-semibold text-gray-900'>
              {form.enabled ? <ToggleRight className='h-4 w-4 text-primary' /> : <ToggleLeft className='h-4 w-4 text-gray-400' />}
              {t('Apply global fees to all doctors')}
            </span>
            <span className='mt-1 block text-xs text-gray-500'>{t('Global fees default hint')}</span>
          </span>
        </label>

        <div className={`space-y-4 ${form.enabled ? '' : 'pointer-events-none opacity-50'}`}>
          <div>
            <label className='mb-2 block text-sm font-semibold text-gray-700'>{t('Examination fee (Kashf)')}</label>
            <div className='flex rounded-lg border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-primary'>
              <span className='flex items-center rounded-l-lg border-r border-gray-200 bg-gray-50 px-3 text-xs font-semibold text-gray-500'>{currency}</span>
              <input
                type='number'
                min={0}
                step={1}
                value={form.examinationFee}
                onChange={(e) => setForm((prev) => ({ ...prev, examinationFee: e.target.value }))}
                className='min-w-0 flex-1 rounded-r-lg px-3 py-2.5 text-sm outline-none'
                required={form.enabled}
              />
            </div>
            <p className='mt-1 text-xs text-gray-500'>{t('Examination fee hint')}</p>
          </div>

          <div>
            <label className='mb-2 block text-sm font-semibold text-gray-700'>{t('Follow-up consultation fee (Istishara)')}</label>
            <div className='flex rounded-lg border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-primary'>
              <span className='flex items-center rounded-l-lg border-r border-gray-200 bg-gray-50 px-3 text-xs font-semibold text-gray-500'>{currency}</span>
              <input
                type='number'
                min={0}
                step={1}
                value={form.consultationFee}
                onChange={(e) => setForm((prev) => ({ ...prev, consultationFee: e.target.value }))}
                className='min-w-0 flex-1 rounded-r-lg px-3 py-2.5 text-sm outline-none'
                required={form.enabled}
              />
            </div>
            <p className='mt-1 text-xs text-gray-500'>{t('Follow-up consultation fee hint')}</p>
          </div>

          {form.enabled && Number(form.consultationFee) >= Number(form.examinationFee) && Number(form.examinationFee) > 0 && (
            <p className='rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900'>
              {t('Consultation must be lower than examination')}
            </p>
          )}
        </div>

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

export default GlobalVisitFeesSettings
