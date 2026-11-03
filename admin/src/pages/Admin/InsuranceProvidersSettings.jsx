import React, { useContext, useEffect, useState } from 'react'
import { Building2, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { AdminContext } from '../../context/AdminContext'
import { useLanguage } from '../../i18n'
import { translateInsuranceProviderName } from '../../data/insuranceProviderNamesAr'
import BilingualField from '../../components/BilingualField'
import { AdminPage } from '../../components/admin/AdminPage'
import { Badge, Button, Card, CardBody, IconButton } from '../../components/ui'
import { bilingualIsEmpty, bilingualPayload, emptyBilingual } from '../../utils/bilingualValue'

/** A provider as the form edits it. The built-in names already have reviewed Arabic in the app. */
const toRow = (name, stored, t) => {
  const known = translateInsuranceProviderName(name, t, 'ar')
  const ar = stored?.ar || (known !== name ? known : '')
  return { key: name, value: { en: stored?.en || name, ar, source: stored?.source === 'ar' ? 'ar' : 'en', manual: stored?.manual === true || Boolean(ar && !stored?.ar), status: stored?.status === 'pending' ? 'pending' : 'complete' } }
}

const textOf = (value) => (value.en || value.ar || '').trim().toLowerCase()

const InsuranceProvidersSettings = () => {
  const { aToken, siteSettings, getSiteSettings, updateInsuranceProviders, translatePreview } = useContext(AdminContext)
  const { t, language } = useLanguage()
  const [rows, setRows] = useState([])
  const [editingKey, setEditingKey] = useState(null)
  const [draft, setDraft] = useState(emptyBilingual)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (aToken) getSiteSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aToken])

  useEffect(() => {
    const names = siteSettings?.insuranceProviders
    if (!Array.isArray(names) || names.length === 0) return
    const stored = siteSettings?.insuranceProvidersI18n || []
    setRows(names.map((name, index) => toRow(name, stored[index]?.name === name ? stored[index] : stored.find((item) => item.name === name), t)))
    setEditingKey(null)
    // `t` changes with the language, which must not throw away unsaved edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteSettings])

  const removeAt = (key) => setRows((previous) => previous.filter((row) => row.key !== key))
  const editRow = (key, value) => setRows((previous) => previous.map((row) => (row.key === key ? { ...row, value } : row)))

  const addProvider = () => {
    if (bilingualIsEmpty(draft)) return
    if (!rows.some((row) => textOf(row.value) === textOf(draft))) {
      setRows((previous) => [...previous, { key: `new-${Date.now()}`, value: draft }])
    }
    setDraft(emptyBilingual())
  }

  const handleSave = async () => {
    setSaving(true)
    await updateInsuranceProviders(rows.map((row) => bilingualPayload(row.value)))
    setSaving(false)
  }

  const labelOf = (value) => (language === 'ar' ? value.ar || value.en : value.en || value.ar)

  return (
    <AdminPage icon={Building2} width='max-w-3xl' title={t('Insurance providers')} description={t('Insurance providers page description')}>
      <div className='space-y-5'>
        <Card variant='flat'>
          <CardBody className='space-y-4'>
            <p className='text-body-sm text-ink-2'>{t('Insurance providers list hint')}</p>
            <ul className='max-h-[28rem] divide-y divide-line overflow-y-auto rounded-control border border-line'>
              {rows.map(({ key, value }) => (
                <li key={key} className='px-3 py-2.5'>
                  {editingKey === key ? (
                    <div className='space-y-2'>
                      <BilingualField label={t('Provider name')} value={value} onChange={(next) => editRow(key, next)} translate={translatePreview} kind='label' />
                      <Button size='sm' variant='secondary' onClick={() => setEditingKey(null)} leadingIcon={<X aria-hidden='true' className='size-4' />}>
                        {t('Done')}
                      </Button>
                    </div>
                  ) : (
                    <div className='flex items-center gap-2'>
                      <span className='min-w-0 flex-1'>
                        <span className='block break-words text-body-sm font-medium text-ink'>{labelOf(value)}</span>
                        <span className='block break-words text-caption text-ink-3'>{language === 'ar' ? value.en : value.ar}</span>
                      </span>
                      {value.status === 'pending' && <Badge tone='warning'>{t('Translation pending')}</Badge>}
                      <IconButton size='sm' variant='ghost' label={t('Edit')} onClick={() => setEditingKey(key)}>
                        <Pencil aria-hidden='true' className='size-4' />
                      </IconButton>
                      <IconButton
                        size='sm'
                        variant='ghost'
                        label={rows.length <= 1 ? t('Keep at least one provider') : t('Remove')}
                        disabled={rows.length <= 1}
                        onClick={() => removeAt(key)}
                      >
                        <Trash2 aria-hidden='true' className='size-4 text-danger-ink' />
                      </IconButton>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <div className='rounded-control bg-surface-sunken p-3'>
              <BilingualField label={t('New provider name')} value={draft} onChange={setDraft} translate={translatePreview} kind='label' />
              <Button className='mt-2' size='sm' variant='secondary' onClick={addProvider} disabled={bilingualIsEmpty(draft)} leadingIcon={<Plus aria-hidden='true' className='size-4' />}>
                {t('Add')}
              </Button>
            </div>

            <Button onClick={handleSave} loading={saving} disabled={rows.length < 1} leadingIcon={<Save aria-hidden='true' className='size-4' />}>
              {t('Save list')}
            </Button>
          </CardBody>
        </Card>
      </div>
    </AdminPage>
  )
}

export default InsuranceProvidersSettings
