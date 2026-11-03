import React from 'react'
import { Star } from 'lucide-react'

export const formatRatingDate = (value) => {
  if (!value) return ''
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export const RatingBadge = ({ summary, className = '' }) => {
  const average = Number(summary?.averageRating || 0)
  const count = Number(summary?.ratingCount || 0)
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-yellow-400 px-2.5 py-1 text-xs font-bold text-yellow-950 shadow-sm ${className}`}>
      <Star className='h-3.5 w-3.5 fill-current' />
      {count > 0 ? `${average.toFixed(1)} (${count})` : 'New'}
    </span>
  )
}

export const StarRow = ({ value = 0, size = 'h-4 w-4' }) => (
  <span className='inline-flex items-center gap-0.5 text-yellow-400'>
    {[1, 2, 3, 4, 5].map((star) => (
      <Star key={star} className={`${size} ${star <= Math.round(Number(value || 0)) ? 'fill-current' : 'fill-none text-yellow-300'}`} />
    ))}
  </span>
)

export const RatingsList = ({ ratings = [], canDelete = false, onDelete }) => {
  if (!ratings.length) {
    return <div className='rounded-lg border border-dashed border-gray-300 bg-gray-50 p-5 text-center text-sm text-gray-500'>No ratings yet.</div>
  }

  return (
    <div className='space-y-3'>
      {ratings.map((rating) => (
        <div key={rating._id} className='rounded-lg border border-yellow-100 bg-white p-4 shadow-sm'>
          <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
            <div>
              <div className='flex items-center gap-2'>
                <StarRow value={rating.rating} />
                <span className='text-sm font-semibold text-gray-900'>{rating.rating}/5</span>
              </div>
              <p className='mt-1 text-xs text-gray-500'>{rating.patientName || 'Patient'} - {formatRatingDate(rating.createdAt)}</p>
            </div>
            {canDelete && (
              <button type='button' onClick={() => onDelete?.(rating._id)} className='rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50'>Delete</button>
            )}
          </div>
          {rating.comment && <p className='mt-3 whitespace-pre-line rounded-lg bg-yellow-50 p-3 text-sm leading-relaxed text-gray-700'>{rating.comment}</p>}
        </div>
      ))}
    </div>
  )
}
