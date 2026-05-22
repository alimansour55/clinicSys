import bcrypt from 'bcryptjs'
import userModel from '../../../models/userModel.js'
import doctorModel from '../../../models/doctorModel.js'
import receptionistModel from '../../../models/receptionistModel.js'
import siteSettingModel from '../../../models/siteSettingModel.js'
import counterModel from '../../../models/counterModel.js'

export const TEST_PASSWORD = 'TestPass1!'

/** Latest seed document ids (refreshed each beforeEach). */
export const testIds = {
  patientId: '',
  doctorId: '',
  receptionistId: '',
}

export const testUsers = {
  patient: { email: 'patient@test.com', phone: '01012345678' },
  doctor: { email: 'doctor@test.com' },
  receptionist: { email: 'receptionist@test.com' },
  inactivePatient: { email: 'inactive@test.com', phone: '01098765432' },
}

const clinicSchedule = {
  workingDays: [0, 1, 2, 3, 4, 5, 6],
  startTime: '09:00',
  endTime: '17:00',
  slotDuration: 30,
  breaks: [],
  blockedDates: [],
}

const doctorAddress = { line1: 'Clinic St', line2: 'Cairo' }

/** Populates in-memory DB; IDs available on returned object after seed. */
export async function seedDatabase() {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 4)

  const site = await siteSettingModel.create({
    key: 'site-settings',
    security: {
      mfaEnabled: false,
      mfaRequiredGlobally: false,
      mfaAllowUserOptIn: true,
      enforceStrongPasswords: true,
      auditLogsEnabled: true,
    },
    globalVisitFees: { enabled: false, examinationFee: 0, consultationFee: 0 },
    homeVisitPricing: { pricingType: 'percentage', percentageValue: 50, fixedAmount: 0 },
    languagePolicies: {
      patient: { en: true, ar: true },
      doctor: { en: true, ar: true },
      receptionist: { en: true, ar: true },
      admin: { en: true, ar: true },
    },
  })

  const patient = await userModel.create({
    name: 'Test Patient',
    email: testUsers.patient.email,
    password: passwordHash,
    phone: testUsers.patient.phone,
    patientId: 'PAT-TEST-001',
    emailVerified: true,
    phoneVerified: true,
    accountVerifiedAt: Date.now(),
    isActive: true,
  })

  await userModel.create({
    name: 'Inactive Patient',
    email: testUsers.inactivePatient.email,
    password: passwordHash,
    phone: testUsers.inactivePatient.phone,
    patientId: 'PAT-TEST-002',
    emailVerified: true,
    phoneVerified: true,
    accountVerifiedAt: Date.now(),
    isActive: false,
  })

  const doctor = await doctorModel.create({
    name: 'Dr Test',
    email: testUsers.doctor.email,
    password: passwordHash,
    image: 'https://example.com/doctor.png',
    speciality: 'General',
    degree: 'MD',
    experience: '10',
    about: 'Test doctor',
    available: true,
    fees: '500',
    address: doctorAddress,
    locations: ['Main Clinic'],
    phone: '01022223333',
    date: Date.now(),
    schedule: clinicSchedule,
    homeVisitSchedule: {
      workingDays: [2, 4],
      startTime: '10:00',
      endTime: '14:00',
      slotDuration: 60,
      breaks: [],
      blockedDates: [],
    },
    homeVisitAreas: ['Cairo', 'Maadi'],
    acceptsCash: true,
    acceptsOnlinePayment: true,
  })

  const receptionist = await receptionistModel.create({
    name: 'Test Reception',
    email: testUsers.receptionist.email,
    password: passwordHash,
    phone: '01033334444',
    date: Date.now(),
    isActive: true,
  })

  await counterModel.findByIdAndUpdate('reservationNumber', { seq: 100 }, { upsert: true })

  testIds.patientId = String(patient._id)
  testIds.doctorId = String(doctor._id)
  testIds.receptionistId = String(receptionist._id)

  return { site, patient, doctor, receptionist, ids: { ...testIds } }
}
