import React, { useContext, useEffect, useState } from 'react'
import { AdminContext } from '../../context/AdminContext'
import { useLanguage } from '../../i18n'
import { translateInsuranceProviderName } from '../../data/insuranceProviderNamesAr'
import { Building2, Loader2, Plus, Save, Trash2 } from 'lucide-react'

const InsuranceProvidersSettings = () => {
  const { aToken, siteSettings, getSiteSettings, updateInsuranceProviders } = useContext(AdminContext)
  const { t } = useLanguage()
  const [providers, setProviders] = useState([])
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (aToken) getSiteSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aToken])

  useEffect(() => {
    const list = siteSettings?.insuranceProviders
    if (Array.isArray(list) && list.length > 0) setProviders([...list])
  }, [siteSettings])

  const removeAt = (index) => {
    setProviders((prev) => prev.filter((_, i) => i !== index))
  }

  const addProvider = () => {
    const name = newName.trim()
    if (!name) return
    if (providers.includes(name)) {
      setNewName('')
      return
    }
    setProviders((prev) => [...prev, name])
    setNewName('')
  }

  const handleSave = async () => {
    setSaving(true)
    await updateInsuranceProviders(providers)
    setSaving(false)
  }

  return (
    <div className='w-full min-h-screen p-3 sm:p-5 md:p-6 lg:p-8 bg-gray-50'>
      <div className='max-w-3xl mx-auto space-y-6'>
        <div className='flex items-start gap-3'>
          <div className='p-3 rounded-xl bg-primary/10 text-primary'>
            <Building2 className='w-7 h-7' />
          </div>
          <div>
            <h1 className='text-2xl font-bold text-gray-900'>{t('Insurance providers')}</h1>
            <p className='text-sm text-gray-600 mt-1'>{t('Insurance providers page description')}</p>
          </div>
        </div>

        <div className='bg-white border border-gray-200 rounded-xl p-5 sm:p-6 shadow-sm space-y-4'>
          <p className='text-sm text-gray-700'>{t('Insurance providers list hint')}</p>

          <ul className='divide-y divide-gray-100 border border-gray-200 rounded-lg max-h-[420px] overflow-y-auto'>
            {providers.map((name, index) => (
              <li key={`${name}-${index}`} className='flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50'>
                <span className='flex-1 text-sm font-medium text-gray-900 break-words'>
                  {translateInsuranceProviderName(name, t)}
                </span>
                <button
                  type='button'
                  onClick={() => removeAt(index)}
                  disabled={providers.length <= 1}
                  className='p-2 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed'
                  title={providers.length <= 1 ? t('Keep at least one provider') : t('Remove')}
                >
                  <Trash2 className='w-4 h-4' />
                </button>
              </li>
            ))}
          </ul>

          <div className='flex flex-col sm:flex-row gap-2'>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('New provider name')}
              className='flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary'
            />
            <button
              type='button'
              onClick={addProvider}
              className='inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50'
            >
              <Plus className='w-4 h-4' />
              {t('Add')}
            </button>
          </div>

          <button
            type='button'
            onClick={handleSave}
            disabled={saving || providers.length < 1}
            className='inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-50'
          >
            {saving ? <Loader2 className='w-4 h-4 animate-spin' /> : <Save className='w-4 h-4' />}
            {t('Save list')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default InsuranceProvidersSettings
