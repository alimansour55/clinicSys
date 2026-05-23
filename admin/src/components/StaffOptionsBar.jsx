import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'

const StaffOptionsBar = ({ links }) => {
  const { pathname } = useLocation()

  return (
    <div className='sticky top-0 z-30 border-b border-gray-200 bg-[#F8F9FD]/95 px-3 py-3 backdrop-blur sm:px-4 md:hidden'>
      <div className='flex gap-2 overflow-x-auto overscroll-x-contain pb-0.5 [-webkit-overflow-scrolling:touch]'>
        {links.map((option) => {
          const Icon = option.icon
          const active = pathname === option.path
          return (
            <NavLink
              key={option.path}
              to={option.path}
              className={`flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold whitespace-nowrap transition active:scale-[0.98] sm:text-sm ${
                active ? `${option.active} text-white` : option.tone
              }`}
            >
              {Icon ? <Icon className='h-4 w-4 shrink-0' /> : null}
              {option.label}
            </NavLink>
          )
        })}
      </div>
    </div>
  )
}

export default StaffOptionsBar
