import { Check, Plus } from 'lucide-react'
import { useLanguage } from '../../i18n'
import { hasInText } from './hubLogic'

const CHIPS = {
  allergies: ['Penicillin', 'Aspirin', 'Sulfa drugs', 'Peanuts', 'Seafood', 'Eggs', 'Milk', 'Dust', 'No known allergies'],
  conditions: ['Diabetes', 'High blood pressure', 'Asthma', 'Heart disease', 'Thyroid disorder', 'Anemia']
}


/** Quick answers for common items, entered as text in the person's language, so doctors read them as before. */
export const QuickChips = ({ group, value, onToggle }) => {
  const { t } = useLanguage()
  return (
    <div className='mt-2 flex flex-wrap gap-1.5'>
      {CHIPS[group].map((chip) => {
        const label = t(chip)
        const selected = hasInText(value, label)
        return (
          <button
            key={chip}
            type='button'
            aria-pressed={selected}
            onClick={() => onToggle(label)}
            className={`inline-flex min-h-9 items-center gap-1 rounded-control px-2.5 text-caption font-medium transition ${selected ? 'bg-primary-soft text-brand' : 'bg-surface-sunken text-ink-2 hover:text-ink'}`}
          >
            {selected ? <Check className='size-3.5' aria-hidden='true' /> : <Plus className='size-3.5' aria-hidden='true' />}
            {label}
          </button>
        )
      })}
    </div>
  )
}
