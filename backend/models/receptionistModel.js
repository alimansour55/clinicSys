import mongoose from 'mongoose';

const receptionistSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    date: { type: Number, required: true }
})

const receptionistModel = mongoose.models.receptionist || mongoose.model('receptionist', receptionistSchema)

export default receptionistModel
