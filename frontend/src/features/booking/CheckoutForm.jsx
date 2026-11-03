import { useState } from 'react'
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { CreditCard, Lock } from 'lucide-react'
import { useLanguage } from '../../i18n'
import { useTheme } from '../../utils/theme'
import { Button } from '../../components/ui'
import CountdownTimer from '../../components/CountdownTimer'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_51Om5RIFYci1ONXhwffRNoKDSSkbwm6HLTtHRqHo4fG9VVWB74kE41EZG0Q65BvZU0QXQt7BCddGNcMnnOTRzia2500UZzolAxd')

const cardStyle = () => {
  const root = getComputedStyle(document.documentElement)
  const read = (name, fallback) => root.getPropertyValue(name).trim() || fallback
  return {
    hidePostalCode: true,
    style: {
      base: {
        color: read('--color-ink', '#17211e'),
        fontFamily: 'inherit',
        fontSize: '16px',
        '::placeholder': { color: read('--color-ink-3', '#5d6a65') },
        iconColor: read('--color-ink-2', '#3d4a45')
      },
      invalid: { color: read('--color-danger', '#b3261e') }
    }
  }
}

const CardForm = ({ amountLabel, holdExpiresAt, clientSecret, onConfirmed, onHoldExpired, onBack, payLabel }) => {
  const stripe = useStripe()
  const elements = useElements()
  const { t } = useLanguage()
  const { theme } = useTheme()
  const [paying, setPaying] = useState(false)
  const [message, setMessage] = useState('')

  const pay = async (event) => {
    event.preventDefault()
    if (!stripe || !elements || paying) return
    setPaying(true)
    setMessage('')

    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: elements.getElement(CardElement) }
    })

    if (error) {
      // A card that succeeded on an earlier attempt comes back as an error here. The server is the one to ask.
      if (error.payment_intent?.status === 'succeeded') {
        await onConfirmed(error.payment_intent.id)
      } else {
        setMessage(error.message || t('Payment failed'))
      }
      setPaying(false)
      return
    }

    if (paymentIntent?.status === 'succeeded') {
      await onConfirmed(paymentIntent.id)
    } else {
      setMessage(t('Payment was not completed'))
    }
    setPaying(false)
  }

  return (
    <form onSubmit={pay}>
      <div className='mb-3 flex items-center justify-between gap-3'>
        <p className='flex items-center gap-2 text-subtitle font-semibold text-ink'>
          <CreditCard className='h-5 w-5 text-brand' aria-hidden='true' />
          {t('Card details')}
        </p>
        {holdExpiresAt && (
          <span className='flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-caption font-semibold text-accent-ink'>
            {t('Held for you')}
            <CountdownTimer expiresAt={holdExpiresAt} onExpire={onHoldExpired} />
          </span>
        )}
      </div>

      <div className='rounded-control border border-field bg-surface p-3.5 focus-within:border-primary'>
        <CardElement key={theme} options={cardStyle()} />
      </div>

      {message && <p role='alert' className='mt-2 text-body-sm text-danger-ink'>{message}</p>}

      <div className='mt-4 flex flex-wrap items-center gap-2'>
        <Button type='submit' size='lg' loading={paying} disabled={!stripe} leadingIcon={<Lock className='h-4 w-4' aria-hidden='true' />}>
          {payLabel} · {amountLabel}
        </Button>
        {onBack && (
          <Button type='button' variant='ghost' disabled={paying} onClick={onBack}>
            {t('Change something')}
          </Button>
        )}
      </div>
      <p className='mt-2 text-caption text-ink-3'>{t('Card details go directly to Stripe. Clinivo never sees your card number.')}</p>
    </form>
  )
}

const CheckoutForm = (props) => (
  <Elements stripe={stripePromise} options={{ clientSecret: undefined }}>
    <CardForm {...props} />
  </Elements>
)

export default CheckoutForm
