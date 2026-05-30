import React from 'react'

export const ClinicChipSkeleton = ({ count = 4 }) => (
  <>
    {Array.from({ length: count }).map((_, index) => (
      <div
        key={index}
        className="h-[3.25rem] min-w-[9.5rem] animate-pulse rounded-xl border border-gray-200 bg-gray-100 sm:shrink-0"
        aria-hidden="true"
      />
    ))}
  </>
)

export const DoctorCardSkeleton = ({ count = 4, className = '' }) => (
  <div
    className={`grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 ${className}`.trim()}
    aria-hidden="true"
  >
    {Array.from({ length: count }).map((_, index) => (
      <div
        key={index}
        className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm animate-pulse"
      >
        <div className="mx-2 mt-2 h-[120px] rounded-lg bg-gray-200 sm:mx-3 sm:mt-3 sm:h-[146px]" />
        <div className="space-y-2 px-2.5 py-2 sm:px-3 sm:py-2.5">
          <div className="h-3 w-16 rounded bg-gray-200" />
          <div className="h-4 w-3/4 rounded bg-gray-200" />
          <div className="h-3 w-1/2 rounded bg-gray-200" />
          <div className="h-3 w-full rounded bg-gray-200" />
        </div>
      </div>
    ))}
  </div>
)

export const DoctorListSkeleton = ({ count = 6, isMobile = false }) => (
  <div
    className={`grid gap-3 sm:gap-4 animate-pulse ${
      isMobile
        ? 'grid-cols-2'
        : 'grid-cols-[repeat(auto-fill,minmax(166px,188px))] justify-center sm:justify-start'
    }`}
    aria-hidden="true"
  >
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="mx-2 mt-2 h-[120px] rounded-lg bg-gray-200 sm:mx-3 sm:mt-3 sm:h-[146px]" />
        <div className="space-y-2 px-2.5 py-2 sm:px-3 sm:py-2.5">
          <div className="h-3 w-16 rounded bg-gray-200" />
          <div className="h-4 w-3/4 rounded bg-gray-200" />
          <div className="h-3 w-1/2 rounded bg-gray-200" />
        </div>
      </div>
    ))}
  </div>
)
