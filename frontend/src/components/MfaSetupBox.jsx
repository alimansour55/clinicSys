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
    <div className='rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950 shadow-sm sm:p-5'>
      <div className='flex items-start gap-3'>
        <div className='mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm'>
          {mode === 'setup' ? <QrCode className='h-5 w-5' /> : <ShieldCheck className='h-5 w-5' />}
        </div>
        <div className='min-w-0 flex-1'>
          <p className='text-base font-bold'>{mode === 'setup' ? t('Scan the QR code') : t('Authenticator verification')}</p>
          <p className='mt-1 text-sm leading-5 text-blue-800'>
            {mode === 'setup' ? t('MFA setup scan instructions') : t('MFA verify enter code')}
          </p>
        </div>
      </div>

      {mode === 'setup' && setup && (
        <div className='mt-5 space-y-5'>
          <div className='flex flex-col items-center gap-5'>
            {qrCodeUrl && !qrFailed ? (
              <div className='rounded-3xl border border-gray-200 bg-white p-6 shadow-sm'>
                <img className='h-[480px] w-[480px] object-contain' src={qrCodeUrl} alt={t('Authenticator setup QR code alt')} />
              </div>
            ) : (
              <div className='w-full rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900'>
                <p className='font-bold'>{t('QR code could not load')}</p>
                <p className='mt-1'>{t('MFA manual key hint')}</p>
              </div>
            )}
            <div className='w-full max-w-md space-y-3'>
              <div>
                <p className='text-xs font-bold uppercase text-blue-700'>{t('Manual setup key')}</p>
                <p className='mt-1 overflow-hidden rounded-xl border border-blue-100 bg-white p-3 font-mono text-xs font-semibold text-gray-900 sm:text-sm' style={{ wordBreak: 'break-all', wordWrap: 'break-word' }}>
                  {setup.secret}
                </p>
              </div>
              {setup.otpauthUrl && (
                <a className='inline-flex items-center gap-2 text-sm font-semibold text-blue-700 underline hover:text-blue-800' href={setup.otpauthUrl}>
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
