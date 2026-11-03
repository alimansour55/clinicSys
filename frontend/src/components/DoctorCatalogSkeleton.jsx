import React from 'react'
import { Skeleton, SkeletonGroup } from './ui'

const CardShape = () => (
  <div className='overflow-hidden rounded-card border border-line bg-surface shadow-e1'>
    <Skeleton className='aspect-[4/3] w-full rounded-none!' />
    <div className='space-y-2.5 p-4'>
      <Skeleton className='h-5 w-3/4' />
      <Skeleton className='h-4 w-1/2' />
      <Skeleton className='h-4 w-2/3' />
      <Skeleton className='h-6 w-36 rounded-full!' />
    </div>
  </div>
)

export const ClinicChipSkeleton = ({ count = 4 }) => (
  <>
    {Array.from({ length: count }).map((_, index) => (
      <li key={index} aria-hidden='true'><Skeleton className='h-36 rounded-card!' /></li>
    ))}
  </>
)

/** Same shape as DoctorCard, so nothing jumps when the list arrives. */
export const DoctorCardSkeleton = ({ count = 4, className = '' }) => (
  <SkeletonGroup className={`grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 ${className}`.trim()}>
    {Array.from({ length: count }).map((_, index) => <CardShape key={index} />)}
  </SkeletonGroup>
)

export const DoctorListSkeleton = ({ count = 6 }) => (
  <SkeletonGroup className='grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4'>
    {Array.from({ length: count }).map((_, index) => <CardShape key={index} />)}
  </SkeletonGroup>
)
