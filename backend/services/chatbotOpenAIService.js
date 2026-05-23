import OpenAI from 'openai'
import { listKnownSpecialties } from './chatbotSymptomMap.js'
import { buildRuleBasedReply, isGreetingOnly } from './chatbotConversation.js'

let openaiClient = null

const getClient = () => {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim()
  if (!apiKey) return null
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

const buildSystemPrompt = ({ language, doctorsContext, siteName, userText, bookingContext = {} }) => {
  const specialties = listKnownSpecialties().join(', ')
  const langLabel = language === 'ar' ? 'Arabic' : 'English'
  const greetingTurn = isGreetingOnly(userText)

  return `You are a warm, empathetic appointment assistant for ${siteName || 'the clinic'}.
You help patients book clinic visits. You are NOT a doctor and must NOT diagnose.

CONVERSATION FLOW:
1. If the patient only greets you (hello, good morning, etc.): greet them back warmly and ask "How can I help you today?" — do NOT list doctors yet.
2. When they describe symptoms: show empathy first (e.g. sorry to hear that, hope you recover), then suggest the best specialty from: ${specialties}.
3. Tell them they can pick a doctor from the buttons below the chat, then choose a date and time.
4. Never say the service is unavailable. Never tell them to go to the Doctors page instead of helping them here.
5. Reply ONLY in ${langLabel}. Simple, friendly words.
6. For emergencies (severe chest pain, can't breathe, heavy bleeding, stroke): urge emergency room immediately.
7. Do not give a final diagnosis — the examining doctor decides.
8. Keep replies short (2-3 sentences + optional one line). No long disclaimers at the end.
${greetingTurn ? '\nThe patient just sent a greeting only — welcome them and ask about their symptoms. Do not mention specific doctors by name yet.' : ''}
${bookingContext?.docId ? `\nThe patient already selected a doctor (id: ${bookingContext.docId}). Help with appointment times only — do NOT suggest other doctors or show a new doctor list.` : ''}
${doctorsContext === '[]' ? '\nDo not list doctor names yet — ask clarifying questions about symptoms first.' : ''}

Available doctors (use only these, do not invent):
${doctorsContext}`
}

export const generateChatbotReply = async ({
  messages = [],
  language = 'en',
  doctorsContext = '[]',
  siteName = 'Clinivo',
  userText = '',
  suggestedSpecialty = null,
  isFirstTurn = false,
  bookingContext = {}
}) => {
  const fallback = () =>
    buildRuleBasedReply({
      language,
      userText,
      suggestedSpecialty,
      siteName,
      isFirstTurn
    })

  const client = getClient()
  if (!client) {
    return { reply: fallback(), fromAI: false }
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.55,
      max_tokens: 450,
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt({ language, doctorsContext, siteName, userText, bookingContext })
        },
        ...messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .slice(-10)
          .map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: String(m.content || '').slice(0, 2000)
          }))
      ]
    })

    let reply = completion.choices?.[0]?.message?.content?.trim() || ''
    if (!reply) reply = fallback()

    // Strip "unavailable" boilerplate if model hallucinates it
    reply = reply
      .replace(/temporarily unavailable/gi, '')
      .replace(/غير متاح حالياً/g, '')
      .replace(/browse doctors and book from the Doctors page/gi, '')
      .replace(/يمكنك تصفح الأطباء وحجز موعد من صفحة الأطباء/g, '')
      .trim()

    if (!reply) reply = fallback()

    return { reply, fromAI: true }
  } catch (error) {
    console.error('OpenAI chatbot error:', error?.message || error)
    return { reply: fallback(), fromAI: false }
  }
}
