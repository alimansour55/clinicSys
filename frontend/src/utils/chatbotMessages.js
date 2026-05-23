/** Resolve chat bubble text for the active chat language. */
export const messageText = (msg, language = 'en') => {
  if (!msg) return ''
  if (typeof msg.en === 'string' && typeof msg.ar === 'string') {
    return language === 'ar' ? msg.ar : msg.en
  }
  return msg.content ?? String(msg.en ?? msg.ar ?? '')
}

export const bilingualMessage = (role, en, ar) => ({ role, en, ar })

export const plainMessage = (role, content) => ({ role, content })
