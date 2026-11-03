import { useId, useRef, useState } from 'react'
import { Clock, Languages, Loader2, PenLine, RefreshCw } from 'lucide-react'
import { useLanguage } from '../i18n'
import { Badge, Input, Textarea } from './ui'

const LANGUAGES = [
  { key: 'en', label: 'English', dir: 'ltr' },
  { key: 'ar', label: 'العربية', dir: 'rtl' },
]

const other = (language) => (language === 'en' ? 'ar' : 'en')

/**
 * Type in either language and the other fills itself in. Both stay visible and editable. Pair with
 * bilingualFromRecord / bilingualPayload from utils/bilingualValue, and post it as `<field>I18n`.
 *
 * `translate(text, target, kind)` resolves to the suggestion, or '' when no translator is available.
 * Saving still works without one: the server stores the record as pending and retries it.
 */
export default function BilingualField({
  label,
  value,
  onChange,
  translate,
  kind = 'text',
  multiline = false,
  required = false,
  hint,
  placeholders = {},
  /** Id of a <datalist> offering suggestions on the English side. */
  list,
  className = '',
}) {
  const { t } = useLanguage()
  const baseId = useId()
  const [translating, setTranslating] = useState(false)
  /* Text the current suggestion was made from, so blurring without an edit makes no request */
  const translatedFrom = useRef(value[value.source] || '')
  const latest = useRef(value)
  latest.current = value
  const request = useRef(0)

  const Control = multiline ? Textarea : Input
  const target = other(value.source)

  const suggest = async (source) => {
    const text = latest.current[source].trim()
    const to = other(source)
    translatedFrom.current = text
    if (!text || !translate) return
    const id = ++request.current
    setTranslating(true)
    let suggestion = ''
    try {
      suggestion = await translate(text, to, kind)
    } catch {
      suggestion = ''
    }
    if (id !== request.current) return
    setTranslating(false)
    /* The admin may have corrected it, or typed on, while this was in flight */
    const current = latest.current
    if (current.manual || current.source !== source || current[source].trim() !== text) return
    onChange({ ...current, [to]: suggestion || '', status: suggestion ? 'complete' : 'pending' })
  }

  const edit = (language, text) => {
    const isSourceEdit = language === value.source
    const sourceStillEmpty = !value[value.source].trim()
    if (isSourceEdit || sourceStillEmpty) {
      /* Editing the source invalidates whatever was generated or corrected from it */
      onChange({ ...value, [language]: text, source: language, manual: false })
      return
    }
    onChange({ ...value, [language]: text, manual: Boolean(text.trim()) })
  }

  const blur = (language) => {
    if (language !== value.source) return
    const text = value[language].trim()
    if (text !== translatedFrom.current) suggest(language)
  }

  const retranslate = () => {
    onChange({ ...value, manual: false })
    latest.current = { ...value, manual: false }
    suggest(value.source)
  }

  const hasSource = Boolean(value[value.source]?.trim())
  const status = (() => {
    if (!hasSource) return null
    if (translating) return { tone: 'neutral', icon: Loader2, spin: true, text: t('Translating…') }
    if (value.manual) return { tone: 'brand', icon: PenLine, text: t('Corrected by hand') }
    if (!value[target]?.trim()) return { tone: 'warning', icon: Clock, text: t('Will translate after saving') }
    return { tone: 'success', icon: Languages, text: t('Translated automatically') }
  })()

  return (
    <fieldset data-input-field className={`min-w-0 ${className}`}>
      <legend className='mb-1.5 text-body-sm font-medium text-ink'>
        {label}
        {required && (
          <span aria-hidden='true' className='ms-1 text-danger-ink'>
            *
          </span>
        )}
      </legend>
      <div className='grid gap-3 sm:grid-cols-2'>
        {LANGUAGES.map(({ key, label: languageLabel, dir }) => (
          <div key={key} className='min-w-0'>
            <label htmlFor={`${baseId}-${key}`} lang={key} className='mb-1 block text-caption font-medium text-ink-3'>
              {languageLabel}
            </label>
            <Control
              id={`${baseId}-${key}`}
              dir={dir}
              lang={key}
              value={value[key]}
              required={required && !value[other(key)]?.trim()}
              placeholder={placeholders[key]}
              list={key === 'en' ? list : undefined}
              onChange={(event) => edit(key, event.target.value)}
              onBlur={() => blur(key)}
              style={{ textAlign: 'start' }}
            />
          </div>
        ))}
      </div>
      <div className='mt-2 flex min-h-6 flex-wrap items-center gap-2' aria-live='polite'>
        {status && (
          <Badge tone={status.tone}>
            <status.icon aria-hidden='true' className={`size-3 ${status.spin ? 'animate-spin' : ''}`} />
            {status.text}
          </Badge>
        )}
        {hasSource && !translating && translate && (
          <button
            type='button'
            onClick={retranslate}
            className='inline-flex cursor-pointer items-center gap-1 text-caption font-semibold text-brand hover:underline'
          >
            <RefreshCw aria-hidden='true' className='size-3' />
            {t('Translate again')}
          </button>
        )}
        {hint && <span className='text-caption text-ink-3'>{hint}</span>}
      </div>
    </fieldset>
  )
}
