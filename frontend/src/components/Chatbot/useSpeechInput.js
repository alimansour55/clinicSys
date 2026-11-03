import { useCallback, useEffect, useRef, useState } from 'react'

const getRecognitionClass = () =>
  typeof window === 'undefined' ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null

/**
 * Voice input through the browser's speech API. Chrome, Edge and Safari support it, including
 * Egyptian Arabic through ar-EG. Firefox does not, so `supported` hides the button there.
 * The words land in the text box for the person to read before sending: a misheard
 * symptom should never be acted on unseen.
 */
export const useSpeechInput = ({ language, getBaseText, onText, onError }) => {
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)
  const handlers = useRef({ getBaseText, onText, onError })

  useEffect(() => {
    handlers.current = { getBaseText, onText, onError }
  })

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    const Recognition = getRecognitionClass()
    if (!Recognition || recognitionRef.current) return

    const recognition = new Recognition()
    recognition.lang = language === 'ar' ? 'ar-EG' : 'en-US'
    recognition.interimResults = true
    recognition.continuous = false
    recognition.maxAlternatives = 1

    const base = String(handlers.current.getBaseText?.() || '').trim()

    recognition.onresult = (event) => {
      const heard = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join(' ')
        .trim()
      handlers.current.onText?.(base ? `${base} ${heard}` : heard)
    }

    recognition.onerror = (event) => {
      if (event.error === 'aborted') return
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        handlers.current.onError?.('assistant.voice.denied')
      } else if (event.error === 'no-speech') {
        handlers.current.onError?.('assistant.voice.noSpeech')
      } else {
        handlers.current.onError?.('assistant.voice.failed')
      }
    }

    recognition.onend = () => {
      recognitionRef.current = null
      setListening(false)
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
      setListening(true)
    } catch {
      recognitionRef.current = null
      setListening(false)
      handlers.current.onError?.('assistant.voice.failed')
    }
  }, [language])

  useEffect(() => () => recognitionRef.current?.abort(), [])

  return { supported: Boolean(getRecognitionClass()), listening, start, stop }
}
