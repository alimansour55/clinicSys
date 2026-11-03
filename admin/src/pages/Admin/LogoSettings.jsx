import { useContext, useEffect, useRef, useState } from 'react'
import { Image as ImageIcon, RotateCcw, Save, Sparkles, Upload, X } from 'lucide-react'
import { AdminContext } from '../../context/AdminContext'
import { useLanguage } from '../../i18n'
import { assets } from '../../assets/assets'
import { AdminPage, ConfirmDialog } from '../../components/admin/AdminPage'
import { Badge, Button, Card, CardBody, CardHeader, Field, Input, notify } from '../../components/ui'
import { patientHeaderLogoClassName } from '../../utils/brandingLogo'
import { DEFAULT_APP_DISPLAY_NAME } from '../../utils/appDisplayName'

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

const LogoSettings = () => {
  const { aToken, siteSettings, getSiteSettings, updateBrandingSettings } = useContext(AdminContext)
  const { t } = useLanguage()
  const [altText, setAltText] = useState(DEFAULT_APP_DISPLAY_NAME)
  const [file, setFile] = useState(null)
  const [filePreview, setFilePreview] = useState('')
  const [saving, setSaving] = useState(false)
  const [settled, setSettled] = useState(false)
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const fileInput = useRef(null)

  const loadSettings = async () => {
    setSettled(false)
    await getSiteSettings()
    setSettled(true)
  }

  useEffect(() => {
    if (aToken) loadSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aToken])

  const savedAltText = siteSettings?.branding?.altText
  useEffect(() => {
    if (savedAltText) setAltText(savedAltText)
  }, [savedAltText])

  /* One object URL per chosen file, released when the file changes or the page closes. */
  useEffect(() => {
    if (!file) {
      setFilePreview('')
      return undefined
    }
    const url = URL.createObjectURL(file)
    setFilePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  /* Saving before the current settings are known would overwrite the alt text with the default. */
  const settingsKnown = Boolean(siteSettings?.branding)
  const customUrl = siteSettings?.branding?.headerLogoUrl
  const previewSrc = filePreview || customUrl || assets.site_default_logo

  const onPickFile = (event) => {
    const picked = event.target.files?.[0]
    /* Cleared so choosing the same file again still fires a change. */
    event.target.value = ''
    if (!picked) return
    if (!ACCEPTED_TYPES.includes(picked.type)) {
      notify.error(t('Choose a PNG, JPG, WebP or SVG file'))
      return
    }
    setFile(picked)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    let ok
    if (file) {
      const formData = new FormData()
      formData.append('altText', altText.trim())
      formData.append('headerLogo', file)
      ok = await updateBrandingSettings(formData)
    } else {
      ok = await updateBrandingSettings({ altText: altText.trim() })
    }
    if (ok) setFile(null)
    setSaving(false)
  }

  const handleRemoveLogo = async () => {
    setSaving(true)
    const ok = await updateBrandingSettings({ altText: altText.trim(), clearHeaderLogo: true })
    if (ok) setFile(null)
    setSaving(false)
    setConfirmingRemove(false)
  }

  let status = { tone: 'neutral', label: t('Clinivo mark (default)'), text: t('No logo is uploaded, so the patient site, staff portal and sign-in screen all show the Clinivo mark.') }
  if (file) status = { tone: 'warning', label: t('Not saved yet'), text: t('This is a preview of the file you chose. Nobody else sees it until you save.') }
  else if (customUrl) status = { tone: 'success', label: t('Your logo'), text: t('Your uploaded logo is showing on the patient site, staff portal and sign-in screen.') }

  return (
    <AdminPage
      title={t('Site logo')}
      description={t('Upload your logo for the patient website, staff portal header and sign-in screen. Its size on the site is fixed to keep the layout consistent.')}
      icon={Sparkles}
      width='max-w-3xl'
    >
      {settled && !settingsKnown && (
        <div role='alert' className='mb-5 flex flex-wrap items-center justify-between gap-3 rounded-card bg-danger-soft px-4 py-3 text-body-sm text-danger-ink'>
          <span className='min-w-0'>{t('These settings could not be loaded, so nothing can be saved yet.')}</span>
          <Button variant='secondary' size='sm' onClick={loadSettings}>{t('Try again')}</Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className='space-y-5'>
        <Card>
          <CardHeader
            headingLevel={2}
            className='flex-wrap'
            title={
              <span className='flex items-center gap-2'>
                <ImageIcon aria-hidden='true' className='size-5 shrink-0 text-brand' />
                {t('Preview at the size of the patient header')}
              </span>
            }
            action={settingsKnown ? <Badge tone={status.tone} dot>{status.label}</Badge> : null}
          />
          <CardBody className='space-y-3'>
            <div className='flex min-h-16 items-center overflow-hidden rounded-control border border-line bg-surface px-4 py-3'>
              <img src={previewSrc} alt={altText || t('Site logo')} className={patientHeaderLogoClassName} />
            </div>
            {settingsKnown && <p className='text-body-sm text-ink-2'>{status.text}</p>}
            <p className='text-caption text-ink-3'>
              {t('In dark theme every logo, the Clinivo mark included, sits on a small white plate so it stays readable.')}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className='space-y-5'>
            <div>
              <p className='text-body-sm font-medium text-ink'>{t('Logo image')}</p>
              <input ref={fileInput} type='file' accept={ACCEPTED_TYPES.join(',')} onChange={onPickFile} className='hidden' />
              <div className='mt-1.5 flex flex-wrap items-center gap-2'>
                <Button variant='secondary' onClick={() => fileInput.current?.click()} leadingIcon={<Upload aria-hidden='true' className='size-4' />}>
                  {t('Choose a file')}
                </Button>
                {file && (
                  <>
                    <span dir='ltr' className='min-w-0 max-w-full truncate text-body-sm text-ink-2'>{file.name}</span>
                    <Button variant='ghost' size='sm' onClick={() => setFile(null)} leadingIcon={<X aria-hidden='true' className='size-4' />}>
                      {t('Discard chosen file')}
                    </Button>
                  </>
                )}
              </div>
              <p className='mt-1.5 text-caption text-ink-3'>{t('PNG, JPG, WebP or SVG. A horizontal mark with clear margins works best.')}</p>
            </div>

            <Field label={t('Alt text (accessibility)')} hint={t('Read out by screen readers, and shown if the image cannot load.')}>
              <Input type='text' value={altText} onChange={(event) => setAltText(event.target.value)} placeholder={DEFAULT_APP_DISPLAY_NAME} />
            </Field>
          </CardBody>
        </Card>

        <div className='flex flex-wrap items-center gap-3'>
          <Button type='submit' loading={saving} disabled={!settingsKnown} leadingIcon={<Save aria-hidden='true' className='size-4' />}>
            {t('Save logo')}
          </Button>
          <Button
            variant='secondary'
            disabled={saving || !customUrl}
            onClick={() => setConfirmingRemove(true)}
            leadingIcon={<RotateCcw aria-hidden='true' className='size-4' />}
          >
            {t('Remove logo')}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmingRemove}
        title={t('Remove this logo?')}
        body={t('The patient site, staff portal and sign-in screen go back to the Clinivo mark straight away.')}
        confirmLabel={t('Remove logo')}
        danger
        busy={saving}
        onConfirm={handleRemoveLogo}
        onClose={() => setConfirmingRemove(false)}
      />
    </AdminPage>
  )
}

export default LogoSettings
