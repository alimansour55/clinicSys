import { ToastContainer, toast } from 'react-toastify'
import { useLanguage } from '../../i18n'

/**
 * Mount once per app. Follows the language direction and keeps the old call sites
 * working: `toast` from react-toastify and `notify` below end up in the same list.
 */
export function ToastViewport(props) {
  const { isRtl } = useLanguage()
  return (
    <ToastContainer
      position={isRtl ? 'top-left' : 'top-right'}
      rtl={isRtl}
      limit={3}
      autoClose={3500}
      closeOnClick
      draggable={false}
      {...props}
    />
  )
}

/** Pass text that has already been through t(). */
export const notify = {
  success: (message, options) => toast.success(message, options),
  error: (message, options) => toast.error(message, { autoClose: 6000, ...options }),
  warning: (message, options) => toast.warning(message, options),
  info: (message, options) => toast.info(message, options),
  dismiss: (id) => toast.dismiss(id),
}
