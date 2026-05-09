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
  }
}, { timestamps: true })

const siteSettingModel = mongoose.models.siteSetting || mongoose.model('siteSetting', siteSettingSchema)

export default siteSettingModel
