/** Shared doctor / schedule fixtures for service tests. */

export const baseClinicSchedule = {
  workingDays: [0, 1, 2, 3, 4, 5, 6],
  startTime: '09:00',
  endTime: '17:00',
  slotDuration: 30,
  breaks: [{ startTime: '12:00', endTime: '13:00' }],
  blockedDates: [],
}

export const doctorWithClinicSchedule = (overrides = {}) => ({
  available: true,
  fees: 500,
  locations: ['Main Branch'],
  schedule: { ...baseClinicSchedule },
  homeVisitSchedule: {
    workingDays: [1, 3],
    startTime: '10:00',
    endTime: '14:00',
    slotDuration: 60,
    breaks: [],
    blockedDates: [],
  },
  homeVisitAreas: ['Cairo', 'Maadi'],
  acceptsVoiceCall: true,
  acceptsVideoCall: true,
  ...overrides,
})

/** slotDate format: DD_MM_YYYY for a weekday in workingDays, ~7 days ahead. */
export const futureSlotOnWeekday = (weekday = 1) => {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  while (date.getDay() !== weekday) {
    date.setDate(date.getDate() + 1)
  }
  if (date <= new Date()) date.setDate(date.getDate() + 7)
  const day = date.getDate()
  const month = date.getMonth() + 1
  const year = date.getFullYear()
  return {
    date,
    slotDate: `${day}_${month}_${year}`,
    slotTime: '10:00',
  }
}

export const doctorWithPromo = (overrides = {}) => ({
  fees: 200,
  promoCode: {
    active: true,
    code: 'SAVE10',
    discountType: 'percentage',
    discountValue: 10,
  },
  ...overrides,
})
