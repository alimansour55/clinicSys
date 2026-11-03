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
    <div className='rounded-card bg-info-soft p-4 text-body-sm text-info-ink sm:p-5'>
      <div className='flex items-start gap-3'>
        <div className='mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-surface text-brand shadow-e1'>
          {mode === 'setup' ? <QrCode className='h-5 w-5' /> : <ShieldCheck className='h-5 w-5' />}
        </div>
        <div className='min-w-0 flex-1'>
          <p className='text-base font-bold'>{mode === 'setup' ? t('Scan the QR code') : t('Authenticator verification')}</p>
          <p className='mt-1 text-body-sm'>
            {mode === 'setup' ? t('MFA setup scan instructions') : t('MFA verify enter code')}
          </p>
        </div>
      </div>

      {mode === 'setup' && setup && (
        <div className='mt-5 space-y-5'>
          <div className='flex flex-col items-center gap-5'>
            {qrCodeUrl && !qrFailed ? (
              <div className='w-full max-w-[280px] rounded-card bg-white p-3 shadow-e1'>
                <img className='aspect-square w-full object-contain' src={qrCodeUrl} alt={t('Authenticator setup QR code alt')} />
              </div>
            ) : (
              <div className='w-full rounded-card bg-warning-soft p-4 text-body-sm text-warning-ink'>
                <p className='font-bold'>{t('QR code could not load')}</p>
                <p className='mt-1'>{t('MFA manual key hint')}</p>
              </div>
            )}
            <div className='w-full max-w-md space-y-3'>
              <div>
                <p className='text-caption font-bold'>{t('Manual setup key')}</p>
                <p className='mt-1 overflow-hidden rounded-control bg-surface p-3 font-mono text-caption font-semibold text-ink' dir='ltr' style={{ wordBreak: 'break-all', wordWrap: 'break-word' }}>
                  {setup.secret}
                </p>
              </div>
              {setup.otpauthUrl && (
                <a className='inline-flex min-h-9 items-center gap-2 text-body-sm font-semibold text-brand underline' href={setup.otpauthUrl}>
                  <KeyRound className='h-3.5 w-3.5 shrink-0' />
                  {t('Open authenticator setup link')}
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MfaSetupBox
