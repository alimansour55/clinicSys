import mongoose, { Mongoose } from 'mongoose';

const doctorSchema = new mongoose.Schema({
    name: {type: String, required:true},
    email: {type: String, required:true, unique:true},
    password: {type:String, required:true},
    image: {type:String, required:true},  
    speciality: {type:String, required:true},
    degree: {type:String, required:true},
    gender: { type: String, enum: ['', 'Male', 'Female'], default: '' },
    title: { type: String, enum: ['', 'Professor', 'Lecturer', 'Consultant', 'Specialist'], default: '' },
    experience: {type:String, required:true},
    about: {type:String, required:true},
    available: {type:Boolean, default:true},
    fees: { type: String, default: '' },
    address: {type:Object, required:true},
    locations: { type: [String], default: [] },
    locationSchedules: { type: Object, default: {} },
    acceptsCash: { type: Boolean, default: true },
    acceptsOnlinePayment: { type: Boolean, default: true },
    acceptsVoiceCall: { type: Boolean, default: true },
    acceptsVideoCall: { type: Boolean, default: true },
    promoCode: {
        code: { type: String, default: '' },
        discountType: { type: String, enum: ['percentage', 'fixed'], default: 'percentage' },
        discountValue: { type: Number, default: 0 },
        active: { type: Boolean, default: false }
    },
    /** Admin-only: how doctor compensation is calculated for analytics */
    financialCompensation: {
        mode: { type: String, enum: ['percentage', 'fixed', 'hybrid'], default: 'percentage' },
        percentageEnabled: { type: Boolean, default: false },
        percentage: { type: Number, default: 0, min: 0, max: 100 },
        fixedSalary: { type: Number, default: 0, min: 0 }
    },
    phone: { type: String, required: true },
    date: {type:Number, required:true},
    clinics: [{ type: mongoose.Schema.Types.ObjectId, ref: 'clinic' }],
    schedule: {
        workingDays: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] },
        startTime: { type: String, default: '10:00' },
        endTime: { type: String, default: '21:00' },
        breaks: [{
            startTime: { type: String, default: '' },
            endTime: { type: String, default: '' }
        }],
        slotDuration: { type: Number, default: 30 },
        blockedDates: { type: [String], default: [] }
    },
    homeVisitSchedule: {
        workingDays: { type: [Number], default: [] },
        startTime: { type: String, default: '10:00' },
        endTime: { type: String, default: '21:00' },
        breaks: [{
            startTime: { type: String, default: '' },
            endTime: { type: String, default: '' }
        }],
        slotDuration: { type: Number, default: 60 },
        blockedDates: { type: [String], default: [] }
    },
    /** Subset of system-supported areas where this doctor accepts home visits */
    homeVisitAreas: { type: [String], default: [] },
    mfa: {
        enabled: { type: Boolean, default: false },
        secret: { type: String, default: '' },
        requiredByAdmin: { type: Boolean, default: false },
        configuredAt: { type: Number, default: 0 },
        resetAt: { type: Number, default: 0 }
    },
    slots_booked: {type:Object,default:{}},
    home_visit_slots_booked: {type:Object,default:{}}

},{minimize:false})


const doctorModel = mongoose.models.doctor || mongoose.model('doctor', doctorSchema)

export default doctorModel
