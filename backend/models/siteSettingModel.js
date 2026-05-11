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
    default: "Simplifying healthcare access through smart appointment management. Book your doctor, anytime, anywhere with Prescripto's intelligent scheduling system. No more long waits or booking hassles - just efficient, reliable, and patient-focused healthcare at your convenience.",
    trim: true
  },
  companyTitle: {
    type: String,
    default: 'COMPANY',
    trim: true
  },
  contactTitle: {
    type: String,
    default: 'GET IN TOUCH',
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
    default: '+92 343 2705821',
    trim: true
  },
  emailLabel: {
    type: String,
    default: 'Email',
    trim: true
  },
  email: {
    type: String,
    default: 'marqum987@gmail.com',
    trim: true
  },
  copyrightText: {
    type: String,
    default: 'Copyright 2026 © Prescripto - All Rights Reserved.',
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

const siteSettingSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'site-settings'
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
  }
}, { timestamps: true })

const siteSettingModel = mongoose.models.siteSetting || mongoose.model('siteSetting', siteSettingSchema)

export default siteSettingModel
