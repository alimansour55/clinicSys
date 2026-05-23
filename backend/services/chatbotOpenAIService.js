import OpenAI from 'openai'
import { listKnownSpecialties } from './chatbotSymptomMap.js'

let openaiClient = null

const getClient = () => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

const buildSystemPrompt = ({ language, doctorsContext, siteName }) => {
  const specialties = listKnownSpecialties().join(', ')
  const langLabel = language === 'ar' ? 'Arabic' : 'English'

  return `You are a helpful medical appointment assistant for ${siteName || 'the clinic'}.
You help patients choose a specialty and book clinic appointments. You are NOT a doctor.

RULES (always follow):
1. Reply ONLY in ${langLabel}. Use simple, friendly language for patients.
2. NEVER give a final medical diagnosis. Say the doctor will examine and decide.
3. For emergencies (severe chest pain, trouble breathing, heavy bleeding, stroke signs, loss of consciousness): tell the patient to go to the emergency room immediately — do not book a routine appointment.
4. Collect booking details step by step: symptoms/reason, suggested specialty, doctor choice, date/time, patient name and phone if needed.
5. When suggesting a specialty, pick from: ${specialties}. Match symptoms to the closest specialty.
6. Only mention doctors from the provided list. Do not invent doctors or times.
7. Keep replies concise (2-4 short paragraphs max). Use bullet points for slot lists when helpful.

Available doctors (JSON):
${doctorsContext}

If the patient is ready to book, confirm: doctor name, date, time, and that they are logged in or will provide name and phone.`
}

export const generateChatbotReply = async ({
  messages = [],
  language = 'en',
  doctorsContext = '[]',
  siteName = 'Clinivo'
}) => {
  const client = getClient()
  if (!client) {
    return {
      reply:
        language === 'ar'
          ? 'مساعد الحجز غير متاح حالياً. يمكنك تصفح الأطباء وحجز موعد من صفحة الأطباء.'
          : 'The booking assistant is temporarily unavailable. You can browse doctors and book from the Doctors page.',
      fromAI: false
    }
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.35,
    max_tokens: 700,
    messages: [
      { role: 'system', content: buildSystemPrompt({ language, doctorsContext, siteName }) },
      ...messages.slice(-12).map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || '').slice(0, 2000)
      }))
    ]
  })

  const reply = completion.choices?.[0]?.message?.content?.trim() || ''
  return { reply, fromAI: true }
}
