import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { KeyRound, QrCode, ShieldCheck } from 'lucide-react'

const MfaSetupBox = ({ mode = 'verify', setup }) => {
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
          <p className='text-base font-bold'>{mode === 'setup' ? 'Scan the QR code' : 'Authenticator verification'}</p>
          <p className='mt-1 text-sm leading-5 text-blue-800'>
            {mode === 'setup'
              ? 'Open Google Authenticator or Microsoft Authenticator, scan the QR code, then enter the 6-digit code.'
              : 'Enter the 6-digit code from your authenticator app.'}
          </p>
        </div>
      </div>

      {mode === 'setup' && setup && (
        <div className='mt-5 flex flex-col items-center gap-5'>
          {qrCodeUrl && !qrFailed ? (
            <div className='w-full max-w-[20rem] rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:max-w-xs sm:p-6'>
              <div className='rounded-2xl bg-white p-2 sm:p-4'>
                <img className='mx-auto h-auto w-full max-w-[16rem] object-contain sm:max-w-[18rem]' src={qrCodeUrl} alt='Authenticator setup QR code' />
              </div>
            </div>
          ) : (
            <div className='w-full max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900'>
              <p className='font-bold'>QR code image could not load.</p>
              <p className='mt-1'>Use the manual setup key, or open the authenticator setup link below.</p>
            </div>
          )}
          <div className='w-full max-w-md space-y-3'>
            <div>
              <p className='text-xs font-bold uppercase text-blue-700'>Manual setup key</p>
              <p className='mt-1 break-all rounded-xl border border-blue-100 bg-white p-3 font-mono text-sm font-semibold text-gray-900'>{setup.secret}</p>
            </div>
            {setup.otpauthUrl && (
              <a className='inline-flex items-center gap-2 text-sm font-semibold text-blue-700 underline' href={setup.otpauthUrl}>
                <KeyRound className='h-3.5 w-3.5 shrink-0' />
                Open authenticator setup link
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default MfaSetupBox
