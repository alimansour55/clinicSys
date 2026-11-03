import React, { useContext, useEffect, useMemo, useState } from 'react'
import { AdminContext } from '../../context/AdminContext'
import { useLanguage } from '../../i18n'
import {
  LANGUAGE_ROLES,
  normalizeLanguagePolicies,
  normalizeRoleLanguagePolicy
} from '../../utils/languageAvailability'
import { Globe, Languages, RefreshCw, Save, Shield, Stethoscope, UserCog, UserRound } from 'lucide-react'
import { Badge, Button, Card, CardBody, notify } from '../../components/ui'

const ROLE_META = [
  { key: 'patient', labelKey: 'Patients', hintKey: 'Patients language hint', icon: UserRound },
  { key: 'doctor', labelKey: 'Doctors', hintKey: 'Doctors language hint', icon: Stethoscope },
  { key: 'receptionist', labelKey: 'Receptionists', hintKey: 'Receptionists language hint', icon: UserCog },
  { key: 'admin', labelKey: 'Admin', hintKey: 'Admins language hint', icon: Shield }
]

const LANGUAGE_CHOICES = [
  { lang: 'en', labelKey: 'Enable English' },
  { lang: 'ar', labelKey: 'Enable Arabic' }
]

const LanguageSettings = () => {
  const { aToken, siteSettings, getSiteSettings, updateLanguagePoliciesSettings, getTranslationStatus, retryTranslations } =
    useContext(AdminContext)
  const { t } = useLanguage()
  const [form, setForm] = useState(() => normalizeLanguagePolicies(null, 'both'))
  const [saving, setSaving] = useState(false)
  const [pendingCount, setPendingCount] = useState(null)
  const [retrying, setRetrying] = useState(false)

  const refreshPending = async () => {
    try {
      const status = await getTranslationStatus()
      if (status) setPendingCount(status.pending)
    } catch {
      setPendingCount(null)
    }
  }

  const handleRetry = async () => {
    setRetrying(true)
    try {
      const result = await retryTranslations()
      if (result?.completed) notify.success(t('Translations updated'))
      else notify.info(t('No translator is available right now'))
    } catch {
      notify.error(t('Could not reach the translation service'))
    }
    await refreshPending()
    setRetrying(false)
  }

  useEffect(() => {
    if (aToken) {
      getSiteSettings()
      refreshPending()
    }
    // Context methods are recreated on render in this app; depend on the token to match existing admin pages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div className='mx-auto max-w-3xl space-y-6 p-4 sm:p-6'>
      <div>
        <h1 className='flex items-center gap-2 text-title-lg font-bold text-ink'>
          <Globe aria-hidden='true' className='size-6 text-brand' />
          {t('User languages settings')}
        </h1>
        <p className='mt-2 text-body-sm text-ink-3'>{t('User languages settings description')}</p>
      </div>

      <Card variant='flat'>
        <CardBody className='flex flex-wrap items-center gap-4'>
          <span aria-hidden='true' className='flex size-10 shrink-0 items-center justify-center rounded-control bg-primary-soft text-brand'>
            <Languages className='size-5' />
          </span>
          <div className='min-w-0 flex-1'>
            <h2 className='text-subtitle font-semibold text-ink'>{t('Content translation')}</h2>
            <p className='mt-0.5 text-caption text-ink-3'>{t('Content translation hint')}</p>
          </div>
          {pendingCount === 0 && (
            <Badge tone='success' dot>
              {t('All translated')}
            </Badge>
          )}
          {pendingCount > 0 && (
            <>
              <Badge tone='warning' dot>
                {`${t('Waiting for translation')}: ${pendingCount}`}
              </Badge>
              <Button
                size='sm'
                variant='secondary'
                loading={retrying}
                onClick={handleRetry}
                leadingIcon={<RefreshCw aria-hidden='true' className='size-4' />}
              >
                {t('Try again')}
              </Button>
            </>
          )}
        </CardBody>
      </Card>

      <form onSubmit={handleSubmit} className='space-y-4'>
        <div className='overflow-hidden rounded-card border border-line bg-surface'>
          {ROLE_META.map(({ key, labelKey, hintKey, icon: Icon }) => {
            const policy = normalizeRoleLanguagePolicy(form[key])
            return (
              <section key={key} className='flex flex-wrap items-center gap-4 border-b border-line p-4 last:border-b-0 sm:p-5'>
                <span aria-hidden='true' className='flex size-10 shrink-0 items-center justify-center rounded-control bg-surface-sunken text-ink-2'>
                  <Icon className='size-5' />
                </span>
                <div className='min-w-40 flex-1'>
                  <h2 className='text-subtitle font-semibold text-ink'>{t(labelKey)}</h2>
                  <p className='mt-0.5 text-caption text-ink-3'>{t(hintKey)}</p>
                </div>
                <div className='flex flex-wrap gap-2'>
                  {LANGUAGE_CHOICES.map(({ lang, labelKey: choiceKey }) => (
                    <label
                      key={lang}
                      className='flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-line px-3 text-body-sm font-medium text-ink transition duration-(--duration-fast) ease-standard hover:border-primary has-checked:border-primary has-checked:bg-primary-soft'
                    >
                      <input
                        type='checkbox'
                        checked={policy[lang]}
                        onChange={(e) => updateRoleLang(key, lang, e.target.checked)}
                        className='size-4 accent-(--color-primary)'
                      />
                      {t(choiceKey)}
                    </label>
                  ))}
                </div>
              </section>
            )
          })}
        </div>

        {validationError && <p className='text-body-sm font-medium text-danger-ink'>{t('At least one language required')}</p>}

        <div className='flex justify-end'>
          <Button type='submit' loading={saving} disabled={validationError} leadingIcon={<Save aria-hidden='true' className='size-4' />}>
            {t('Save')}
          </Button>
        </div>
      </form>
    </div>
  )
}

export default LanguageSettings
