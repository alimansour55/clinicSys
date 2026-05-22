import mongoose from 'mongoose';

const receptionistSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    image: { type: String, default: '' },
    address: {
        line1: { type: String, default: '' },
        line2: { type: String, default: '' },
        city: { type: String, default: '' },
        state: { type: String, default: '' },
        postalCode: { type: String, default: '' },
        country: { type: String, default: '' }
    },
    jobTitle: { type: String, default: 'Receptionist' },
    department: { type: String, default: '' },
    employeeId: { type: String, default: '' },
    bio: { type: String, default: '' },
    emergencyContact: {
        name: { type: String, default: '' },
        phone: { type: String, default: '' },
        relationship: { type: String, default: '' }
    },
    adminNotes: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    mfa: {
        enabled: { type: Boolean, default: false },
        secret: { type: String, default: '' },
        requiredByAdmin: { type: Boolean, default: false },
        configuredAt: { type: Number, default: 0 },
        resetAt: { type: Number, default: 0 }
    },
    date: { type: Number, required: true }
}, { minimize: false })

const receptionistModel = mongoose.models.receptionist || mongoose.model('receptionist', receptionistSchema)

export default receptionistModel
