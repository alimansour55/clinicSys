import mongoose, { Mongoose } from 'mongoose';

const doctorSchema = new mongoose.Schema({
    name: {type: String, required:true},
    email: {type: String, required:true, unique:true},
    password: {type:String, required:true},
    image: {type:String, required:true},  
    speciality: {type:String, required:true},
    degree: {type:String, required:true},
    experience: {type:String, required:true},
    about: {type:String, required:true},
    available: {type:Boolean, default:true},
    fees: {type:String, required:true},
    address: {type:Object, required:true},
    locations: { type: [String], default: [] },
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
    slots_booked: {type:Object,default:{}}

},{minimize:false})


const doctorModel = mongoose.models.doctor || mongoose.model('doctor', doctorSchema)

export default doctorModel
