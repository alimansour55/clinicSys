import { CHAT_STEPS } from './chatbotSteps.js'

export { CHAT_STEPS }

export const emptyBookingData = () => ({
  symptoms: '',
  detectedSpecialty: '',
  selectedDoctor: null,
  appointmentType: 'Clinic',
  visitFeeType: 'examination',
  homeVisitArea: '',
  date: null,
  slotDate: '',
  time: '',
  patientName: '',
  phone: ''
})

export const captureChatSnapshot = (state) => ({
  chatStep: state.chatStep,
  bookingData: { ...state.bookingData },
  matchedDoctors: [...(state.matchedDoctors || [])],
  quickReplies: [...(state.quickReplies || [])],
  slotDays: [...(state.slotDays || [])],
  clinicLocation: state.clinicLocation || '',
  dateOptions: [...(state.dateOptions || [])],
  timeOptions: [...(state.timeOptions || [])],
  locationOptions: [...(state.locationOptions || [])],
  appointmentTypeOptions: [...(state.appointmentTypeOptions || [])],
  homeVisitAreaOptions: [...(state.homeVisitAreaOptions || [])],
  canBookConsultation: Boolean(state.canBookConsultation),
  selectedClinicSection: state.selectedClinicSection
    ? { ...state.selectedClinicSection }
    : null
})

/** Which step “Change selection” returns to from the current step. */
export const getChangeSelectionStep = (step) => {
  switch (step) {
    case CHAT_STEPS.CONFIRMING:
    case CHAT_STEPS.WAITING_VISIT_FEE:
      return CHAT_STEPS.WAITING_TIME
    case CHAT_STEPS.WAITING_TIME:
      return CHAT_STEPS.WAITING_DATE
    case CHAT_STEPS.WAITING_DATE:
    case CHAT_STEPS.WAITING_LOCATION:
    case CHAT_STEPS.WAITING_HOME_AREA:
      return CHAT_STEPS.WAITING_APPOINTMENT_TYPE
    case CHAT_STEPS.WAITING_APPOINTMENT_TYPE:
      return CHAT_STEPS.SHOWING_DOCTORS
    case CHAT_STEPS.SHOWING_DOCTORS:
    case CHAT_STEPS.CLARIFY_AUDIENCE:
    case CHAT_STEPS.SUGGESTING_ALTERNATIVES:
      return CHAT_STEPS.WAITING_SYMPTOMS
    default:
      return CHAT_STEPS.WAITING_SYMPTOMS
  }
}

export const canShowNavControls = (step) =>
  step !== CHAT_STEPS.WAITING_SYMPTOMS &&
  step !== CHAT_STEPS.SUCCESS &&
  step !== CHAT_STEPS.FAILED

export const canGoBack = (step, historyLength) =>
  historyLength > 0 && canShowNavControls(step)
