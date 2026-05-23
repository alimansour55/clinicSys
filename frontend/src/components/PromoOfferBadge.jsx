import React, { useContext } from 'react'
import { Tag } from 'lucide-react'
import { useLanguage } from '../i18n'
import { AppContext } from '../context/AppContext'
import { getPromoOfferLabel } from '../utils/promo'

const PromoOfferBadge = ({ doctor, currencySymbol, formatMoney: formatMoneyProp, className = '' }) => {
  const ctx = useContext(AppContext)
  const formatMoney = formatMoneyProp || ctx?.formatMoney
  const { t, language, localizeDigits } = useLanguage()
  const offerLabel = getPromoOfferLabel(doctor, formatMoney || currencySymbol || '', t, language)
  if (!offerLabel) return null

  return (
    <span
      dir='ltr'
      className={`inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm ${className}`}
    >
      <Tag className='h-3 w-3' />
      {localizeDigits(offerLabel)}
    </span>
  )
}

export default PromoOfferBadge
