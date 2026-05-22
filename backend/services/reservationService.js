import counterModel from '../models/counterModel.js'

const getNextReservationNumber = async () => {
  const counter = await counterModel.findByIdAndUpdate(
    'reservationNumber',
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  )

  return `RES${counter.seq.toString().padStart(6, '0')}`
}

export { getNextReservationNumber }
