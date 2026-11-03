import React, { useState } from 'react'
import { Button, Field, Input, Select } from '../ui'

/** Booking a home visit needs a real address, so the assistant asks for one here. */
const HomeAddressForm = ({ areas, initial, areaLabel, onSubmit, t }) => {
  const [address, setAddress] = useState({
    area: initial?.area || (areas.length === 1 ? areas[0] : ''),
    street: initial?.street || '',
    building: initial?.building || '',
    floor: initial?.floor || '',
    apartment: initial?.apartment || ''
  })
  const [showError, setShowError] = useState(false)

  const update = (key) => (event) => setAddress((current) => ({ ...current, [key]: event.target.value }))
  const missing = !address.area || !address.street.trim()

  const submit = (event) => {
    event.preventDefault()
    if (missing) {
      setShowError(true)
      return
    }
    onSubmit({ ...address, street: address.street.trim() })
  }

  return (
    <form onSubmit={submit} noValidate className='animate-rise space-y-3 rounded-card border border-line bg-surface p-3 shadow-e1'>
      <Field label={t('assistant.homeArea')} required>
        <Select value={address.area} onChange={update('area')}>
          <option value=''>{t('assistant.homeAreaPlaceholder')}</option>
          {areas.map((area) => (
            <option key={area} value={area}>
              {areaLabel(area)}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label={t('assistant.homeStreet')}
        required
        error={showError && missing ? t('assistant.homeRequired') : undefined}
      >
        <Input value={address.street} onChange={update('street')} autoComplete='street-address' />
      </Field>
      <div className='grid grid-cols-3 gap-2'>
        <Field label={t('assistant.homeBuilding')}>
          <Input value={address.building} onChange={update('building')} />
        </Field>
        <Field label={t('assistant.homeFloor')}>
          <Input value={address.floor} onChange={update('floor')} />
        </Field>
        <Field label={t('assistant.homeApartment')}>
          <Input value={address.apartment} onChange={update('apartment')} />
        </Field>
      </div>
      <Button type='submit' fullWidth>
        {t('assistant.homeContinue')}
      </Button>
    </form>
  )
}

export default HomeAddressForm
