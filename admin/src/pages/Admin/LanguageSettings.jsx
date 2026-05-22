import React, { useContext, useEffect, useMemo, useState } from 'react'
import { AdminContext } from '../../context/AdminContext'
import { useLanguage } from '../../i18n'
import {
  LANGUAGE_ROLES,
  normalizeLanguagePolicies,
  normalizeRoleLanguagePolicy
} from '../../utils/languageAvailability'
import { Globe, Loader2, Save, Shield, Stethoscope, UserCog, UserRound } from 'lucide-react'

const ROLE_META = [
  { key: 'patient', labelKey: 'Patients', hintKey: 'Patients language hint', icon: UserRound, accent: 'bg-blue-50 text-blue-700' },
  { key: 'doctor', labelKey: 'Doctors', hintKey: 'Doctors language hint', icon: Stethoscope, accent: 'bg-indigo-50 text-indigo-700' },
  { key: 'receptionist', labelKey: 'Receptionists', hintKey: 'Receptionists language hint', icon: UserCog, accent: 'bg-violet-50 text-violet-700' },
  { key: 'admin', labelKey: 'Admin', hintKey: 'Admins language hint', icon: Shield, accent: 'bg-slate-100 text-slate-800' }
]

const LanguageSettings = () => {
  const { aToken, siteSettings, getSiteSettings, updateLanguagePoliciesSettings } = useContext(AdminContext)
  const { t } = useLanguage()
  const [form, setForm] = useState(() => normalizeLanguagePolicies(null, 'both'))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (aToken) getSiteSettings()
  }, [aToken])

  useEffect(() => {
    if (siteSettings) {
      setForm(
        normalizeLanguagePolicies(
          siteSettings.languagePolicies,
          siteSettings.languageAvailability
        )
      )
    }
  }, [siteSettings])

  const validationError = useMemo(() => {
    return LANGUAGE_ROLES.some((role) => {
      const policy = form[role]
      return !policy?.en && !policy?.ar
    })
  }, [form])

  const updateRoleLang = (role, lang, enabled) => {
    setForm((previous) => {
      const current = normalizeRoleLanguagePolicy(previous[role])
      const next = { ...current, [lang]: enabled }
      if (!next.en && !next.ar) return previous
      return { ...previous, [role]: next }
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (validationError) return
    setSaving(true)
    await updateLanguagePoliciesSettings(form)
    setSaving(false)
  }

  return (
    <div className='mx-auto max-w-3xl p-4 sm:p-6'>
      <div className='mb-6'>
        <h1 className='flex items-center gap-2 text-xl font-bold text-gray-900 sm:text-2xl'>
          <Globe className='h-6 w-6 text-primary' />
          {t('User languages settings')}
        </h1>
        <p className='mt-2 text-sm text-gray-600'>{t('User languages settings description')}</p>
      </div>

      <form onSubmit={handleSubmit} className='space-y-4'>
        {ROLE_META.map(({ key, labelKey, hintKey, icon: Icon, accent }) => {
          const policy = normalizeRoleLanguagePolicy(form[key])
          return (
            <section key={key} className='rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5'>
              <div className='mb-4 flex items-start gap-3'>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accent}`}>
                  <Icon className='h-5 w-5' />
                </div>
                <div>
                  <h2 className='text-base font-semibold text-gray-900'>{t(labelKey)}</h2>
                  <p className='mt-0.5 text-xs text-gray-500'>{t(hintKey)}</p>
                </div>
              </div>
              <div className='grid gap-3 sm:grid-cols-2'>
                <label className='flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50'>
                  <span className='text-sm font-semibold text-gray-900'>{t('Enable English')}</span>
                  <input
                    type='checkbox'
                    checked={policy.en}
                    onChange={(e) => updateRoleLang(key, 'en', e.target.checked)}
                    className='h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary'
                  />
                </label>
                <label className='flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50'>
                  <span className='text-sm font-semibold text-gray-900'>{t('Enable Arabic')}</span>
                  <input
                    type='checkbox'
                    checked={policy.ar}
                    onChange={(e) => updateRoleLang(key, 'ar', e.target.checked)}
                    className='h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary'
                  />
                </label>
              </div>
            </section>
          )
        })}

        {validationError && (
          <p className='text-sm font-medium text-red-600'>{t('At least one language required')}</p>
        )}

        <div className='flex justify-end'>
          <button
            type='submit'
            disabled={saving || validationError}
            className='inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60'
          >
            {saving ? <Loader2 className='h-4 w-4 animate-spin' /> : <Save className='h-4 w-4' />}
            {t('Save')}
          </button>
        </div>
      </form>
    </div>
  )
}

export default LanguageSettings
