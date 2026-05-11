import mongoose, { Types } from 'mongoose';

const appointmentSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    docId: { type: String, required: true },
    slotDate: { type: String, required: true },
    slotTime: { type: String, required: true },
    clinicLocation: { type: String, default: '' },
    appointmentType: {
        type: String,
        enum: ['Clinic', 'Voice Call', 'Video Call', 'Home Visit'],
        default: 'Clinic'
    },
    teleconsultationLink: { type: String, default: '' },
    homeVisitAddress: {
        area: { type: String, default: '' },
        street: { type: String, default: '' },
        building: { type: String, default: '' },
        floor: { type: String, default: '' },
        apartment: { type: String, default: '' },
        notes: { type: String, default: '' },
        updatedBy: { type: String, default: '' },
        updatedAt: { type: Number, default: 0 }
    },
    userData: { type: Object, required: true },
    docData: { type: Object, required: true },
    amount: { type: Number, required: true },
    originalAmount: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    discountReason: { type: String, default: '' },
    coveredByInsurance: { type: Boolean, default: false },
    date: { type: Number, required: true },
    appointmentStatus: {
        type: String,
        enum: ['Booked', 'Checked In', 'In Progress', 'Finished', 'Cancelled'],
        default: 'Booked'
    },
    paymentStatus: {
        type: String,
        enum: ['Paid', 'Not Paid'],
        default: 'Not Paid'
    },
    paymentMethod: {
        type: String,
        enum: ['Cash', 'Visa', 'Insurance', 'Free', ''],
        default: ''
    },
    paymentNote: { type: String, default: '' },
    paidAt: { type: Number, default: 0 },
    stripePaymentIntentId: { type: String, default: '' },
    stripeChargeId: { type: String, default: '' },
    refundStatus: {
        type: String,
        enum: ['Not Refunded', 'Refund Pending', 'Refunded', 'Refund Failed'],
        default: 'Not Refunded'
    },
    stripeRefundId: { type: String, default: '' },
    refundedAt: { type: Number, default: 0 },
    refundAmount: { type: Number, default: 0 },
    refundNote: { type: String, default: '' },
    checkedInAt: { type: Number, default: 0 },
    statusUpdatedAt: { type: Number, default: Date.now },
    bookedBy: { type: String, enum: ['Patient', 'Receptionist'], default: 'Patient' },
    receptionistId: { type: String, default: '' },
    cancelled: { type: Boolean, default: false },
    isCompleted: {type: Boolean, default: false}
})


const appointmentModel = mongoose.models.appointment || mongoose.model('appointment', appointmentSchema)

export default appointmentModel
