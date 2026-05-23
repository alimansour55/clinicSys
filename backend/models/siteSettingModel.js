import mongoose from 'mongoose'

const homeHeroSchema = new mongoose.Schema({
  title: {
    type: String,
    default: 'Book Appointment With Trusted Doctors',
    trim: true
  },
  subtitle: {
    type: String,
    default: 'Simply browse through our extensive list of trusted doctors, schedule your appointment hassle-free.',
    trim: true
  },
  heroImage: {
    type: String,
    default: ''
  },
  groupImage: {
    type: String,
    default: ''
  },
  backgroundColor: {
    type: String,
    default: '#169b8a',
    trim: true
  },
  showGroupImage: {
    type: Boolean,
    default: true
  },
  showBookButton: {
    type: Boolean,
    default: true
  },
  bookButtonText: {
    type: String,
    default: 'Book appointment',
    trim: true
  },
  showAppointmentsButton: {
    type: Boolean,
    default: true
  },
  appointmentsButtonText: {
    type: String,
    default: 'My appointments',
    trim: true
  }
}, { _id: false })

const homeBannerSchema = new mongoose.Schema({
  title: {
    type: String,
    default: 'Book Appointment\nWith 100+ Trusted Doctors',
    trim: true
  },
  bannerImage: {
    type: String,
    default: ''
  },
  backgroundColor: {
    type: String,
    default: '#169b8a',
    trim: true
  },
  showImage: {
    type: Boolean,
    default: true
  },
  showAppointmentsButton: {
    type: Boolean,
    default: true
  },
  appointmentsButtonText: {
    type: String,
    default: 'My appointments',
    trim: true
  },
  showProfileButton: {
    type: Boolean,
    default: true
  },
  profileButtonText: {
    type: String,
    default: 'My profile',
    trim: true
  }
}, { _id: false })

const homeServiceCardsSchema = new mongoose.Schema({
  teleconsultationTitle: { type: String, default: 'Teleconsultation', trim: true },
  teleconsultationDescription: { type: String, default: 'Schedule a voice or video call with a specialist doctor.', trim: true },
  teleconsultationImage: { type: String, default: '' },
  showTeleconsultation: { type: Boolean, default: true },
  teleconsultationButtonText: { type: String, default: 'Book', trim: true },
  homeVisitTitle: { type: String, default: 'Home Visit', trim: true },
  homeVisitDescription: { type: String, default: 'Book a doctor visit at your home in supported Cairo and Giza areas.', trim: true },
  homeVisitImage: { type: String, default: '' },
  showHomeVisit: { type: Boolean, default: true },
  homeVisitButtonText: { type: String, default: 'Book', trim: true }
}, { _id: false })

const footerSchema = new mongoose.Schema({
  description: {
    type: String,
    default: "Simplifying healthcare access through smart appointment management. Book your doctor, anytime, anywhere with our intelligent scheduling system. No more long waits or booking hassles — just efficient, reliable, and patient-focused healthcare at your convenience.",
    trim: true
  },
  companyTitle: {
    type: String,
    default: 'Company',
    trim: true
  },
  contactTitle: {
    type: String,
    default: 'Get in touch',
    trim: true
  },
  homeLabel: {
    type: String,
    default: 'Home',
    trim: true
  },
  aboutLabel: {
    type: String,
    default: 'About',
    trim: true
  },
  doctorsLabel: {
    type: String,
    default: 'All Doctors',
    trim: true
  },
  contactLabel: {
    type: String,
    default: 'Contact Us',
    trim: true
  },
  appointmentsLabel: {
    type: String,
    default: 'My Appointments',
    trim: true
  },
  profileLabel: {
    type: String,
    default: 'My Profile',
    trim: true
  },
  privacyLabel: {
    type: String,
    default: 'Privacy Policy',
    trim: true
  },
  phoneLabel: {
    type: String,
    default: 'Phone',
    trim: true
  },
  phoneNumber: {
    type: String,
    default: '+20 101 881 1142',
    trim: true
  },
  emailLabel: {
    type: String,
    default: 'Email',
    trim: true
  },
  email: {
    type: String,
    default: 'contact@clinivo.com',
    trim: true
  },
  copyrightText: {
    type: String,
    default: () => `Copyright ${new Date().getFullYear()} © Clinivo - All Rights Reserved.`,
    trim: true
  },
  showHomeLink: {
    type: Boolean,
    default: true
  },
  showAboutLink: {
    type: Boolean,
    default: true
  },
  showDoctorsLink: {
    type: Boolean,
    default: true
  },
  showContactLink: {
    type: Boolean,
    default: true
  },
  showPatientLinks: {
    type: Boolean,
    default: true
  },
  showPrivacyLink: {
    type: Boolean,
    default: true
  }
}, { _id: false })

const globalVisitFeesSchema = new mongoose.Schema({
  /** When true, examinationFee and consultationFee apply to all doctors and override doctor.fees */
  enabled: { type: Boolean, default: false },
  /** Examination / كشف — full visit fee */
  examinationFee: { type: Number, default: 0, min: 0 },
  /** Follow-up consultation / استشارة — lower fee, only after recent examination */
  consultationFee: { type: Number, default: 0, min: 0 }
}, { _id: false })

const homeVisitPricingSchema = new mongoose.Schema({
  /** percentage = % of doctor list consultation fee; fixed = flat amount in major currency */
  pricingType: {
    type: String,
    enum: ['percentage', 'fixed'],
    default: 'percentage'
  },
  percentageValue: {
    type: Number,
    default: 50,
    min: 0,
    max: 200
  },
  fixedAmount: {
    type: Number,
    default: 0,
    min: 0
  }
}, { _id: false })

const adminProfileSchema = new mongoose.Schema({
  name: { type: String, default: 'Administrator', trim: true, maxlength: 120 },
  phone: { type: String, default: '', trim: true },
  image: { type: String, default: '', trim: true },
  jobTitle: { type: String, default: 'Clinic Administrator', trim: true, maxlength: 80 },
  bio: { type: String, default: '', trim: true, maxlength: 500 }
}, { _id: false })

const securitySchema = new mongoose.Schema({
  mfaEnabled: { type: Boolean, default: false },
  mfaRequiredGlobally: { type: Boolean, default: false },
  mfaAllowUserOptIn: { type: Boolean, default: true },
  adminMfa: {
    enabled: { type: Boolean, default: false },
    secret: { type: String, default: '' },
    configuredAt: { type: Number, default: 0 },
    resetAt: { type: Number, default: 0 }
  },
  mfaRequiredForAdmins: { type: Boolean, default: false },
  mfaRequiredForDoctors: { type: Boolean, default: false },
  mfaRequiredForReceptionists: { type: Boolean, default: false },
  mfaRequiredForPatients: { type: Boolean, default: false },
  enforceStrongPasswords: { type: Boolean, default: true },
  passwordMinLength: { type: Number, default: 8, min: 6, max: 128 },
  requireUppercase: { type: Boolean, default: true },
  requireLowercase: { type: Boolean, default: true },
  requireNumber: { type: Boolean, default: true },
  requireSpecialCharacter: { type: Boolean, default: true },
  preventCommonPasswords: { type: Boolean, default: true },
  passwordExpiryDays: { type: Number, default: 180, min: 0, max: 3650 },
  maxLoginAttempts: { type: Number, default: 5, min: 3, max: 20 },
  lockoutMinutes: { type: Number, default: 15, min: 1, max: 1440 },
  sessionTimeoutMinutes: { type: Number, default: 60, min: 5, max: 1440 },
  auditLogsEnabled: { type: Boolean, default: true },
  auditLogRetentionDays: { type: Number, default: 365, min: 30, max: 3650 },
  dataRetentionDays: { type: Number, default: 2555, min: 30, max: 3650 },
  inactiveAccountRetentionDays: { type: Number, default: 730, min: 30, max: 3650 },
  allowPatientSelfRegistration: { type: Boolean, default: true },
  requireEmailVerification: { type: Boolean, default: false },
  enforceHttpsOnly: { type: Boolean, default: true },
  allowIpTracking: { type: Boolean, default: true }
}, { _id: false })

const brandingSchema = new mongoose.Schema({
  /** Public site header logo (full mark). Empty = use built-in asset in apps. */
  headerLogoUrl: {
    type: String,
    default: '',
    trim: true
  },
  altText: {
    type: String,
    default: 'Clinivo',
    trim: true
  },
  /** Max display width in px (0 = use built-in default). Applied everywhere the brand logo is shown. */
  logoMaxWidthPx: {
    type: Number,
    default: 0,
    min: 0,
    max: 480
  },
  /** Max display height in px (0 = use built-in default). */
  logoMaxHeightPx: {
    type: Number,
    default: 0,
    min: 0,
    max: 200
  }
}, { _id: false })

const siteSettingSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'site-settings'
  },
  branding: {
    type: brandingSchema,
    default: () => ({})
  },
  homeHero: {
    type: homeHeroSchema,
    default: () => ({})
  },
  homeBanner: {
    type: homeBannerSchema,
    default: () => ({})
  },
  homeServiceCards: {
    type: homeServiceCardsSchema,
    default: () => ({})
  },
  footer: {
    type: footerSchema,
    default: () => ({})
  },
  security: {
    type: securitySchema,
    default: () => ({})
  },
  adminProfile: {
    type: adminProfileSchema,
    default: () => ({})
  },
  homeVisitPricing: {
    type: homeVisitPricingSchema,
    default: () => ({})
  },
  globalVisitFees: {
    type: globalVisitFeesSchema,
    default: () => ({})
  },
  /** When empty or missing, app uses built-in default list from insuranceProvidersService */
  insuranceProviders: {
    type: [String],
    default: []
  },
  /** @deprecated use languagePolicies — kept for backward compatibility */
  languageAvailability: {
    type: String,
    enum: ['both', 'en', 'ar'],
    default: 'both'
  },
  languagePolicies: {
    patient: {
      en: { type: Boolean, default: true },
      ar: { type: Boolean, default: true }
    },
    doctor: {
      en: { type: Boolean, default: true },
      ar: { type: Boolean, default: true }
    },
    receptionist: {
      en: { type: Boolean, default: true },
      ar: { type: Boolean, default: true }
    },
    admin: {
      en: { type: Boolean, default: true },
      ar: { type: Boolean, default: true }
    }
  }
}, { timestamps: true })

const siteSettingModel = mongoose.models.siteSetting || mongoose.model('siteSetting', siteSettingSchema)

export default siteSettingModel
