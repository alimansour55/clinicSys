import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { KeyRound, QrCode, ShieldCheck } from 'lucide-react'
import { useLanguage } from '../i18n'

const MfaSetupBox = ({ mode = 'verify', setup }) => {
  const { t } = useLanguage()
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [qrFailed, setQrFailed] = useState(false)

  useEffect(() => {
    let mounted = true
    setQrCodeUrl('')
    setQrFailed(false)

    if (mode !== 'setup' || !setup?.otpauthUrl) return undefined

    QRCode.toDataURL(setup.otpauthUrl, {
      errorCorrectionLevel: 'M',
      margin: 4,
      width: 420,
      color: {
        dark: '#111827',
        light: '#ffffff'
      }
    })
      .then((dataUrl) => {
        if (mounted) setQrCodeUrl(dataUrl)
      })
      .catch(() => {
        if (mounted) setQrFailed(true)
      })

    return () => {
      mounted = false
    }
  }, [mode, setup?.otpauthUrl])

  return (
    <div className='rounded-card bg-primary-soft p-4 text-body-sm text-ink sm:p-5'>
      <div className='flex items-start gap-3'>
        <div className='mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-control bg-surface text-brand shadow-e1'>
          {mode === 'setup' ? <QrCode className='h-5 w-5' /> : <ShieldCheck className='h-5 w-5' />}
        </div>
        <div className='min-w-0 flex-1'>
          <p className='text-subtitle font-semibold'>{mode === 'setup' ? t('Scan the QR code') : t('Authenticator verification')}</p>
          <p className='mt-1 text-body-sm text-ink-2'>
            {mode === 'setup'
              ? t('Open Google Authenticator or Microsoft Authenticator, scan the QR code, then enter the 6-digit code.')
              : t('Enter the 6-digit code from your authenticator app.')}
          </p>
        </div>
      </div>

      {mode === 'setup' && setup && (
        <div className='mt-5 flex flex-col items-center gap-5'>
          {qrCodeUrl && !qrFailed ? (
            <div className='w-full max-w-[20rem] rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:max-w-xs sm:p-6'>
              <div className='rounded-2xl bg-white p-2 sm:p-4'>
                <img className='mx-auto h-auto w-full max-w-[16rem] object-contain sm:max-w-[18rem]' src={qrCodeUrl} alt={t('Authenticator setup QR code')} />
              </div>
            </div>
          ) : (
            <div className='w-full max-w-md rounded-control bg-warning-soft p-5 text-body-sm text-warning-ink'>
              <p className='font-bold'>{t('QR code image could not load.')}</p>
              <p className='mt-1'>{t('Use the manual setup key, or open the authenticator setup link below.')}</p>
            </div>
          )}
          <div className='w-full max-w-md space-y-3'>
            <div>
              <p className='text-caption font-semibold text-brand'>{t('Manual setup key')}</p>
              <p dir='ltr' className='mt-1 break-all rounded-control border border-line bg-surface p-3 font-mono text-body-sm font-semibold text-ink'>{setup.secret}</p>
            </div>
            {setup.otpauthUrl && (
              <a className='inline-flex items-center gap-2 text-body-sm font-semibold text-brand underline' href={setup.otpauthUrl}>
                <KeyRound className='h-3.5 w-3.5 shrink-0' />
                {t('Open authenticator setup link')}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default MfaSetupBox
