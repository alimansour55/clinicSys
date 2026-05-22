import React from 'react'
import { NavLink } from 'react-router-dom'

/** Sidebar / staff nav item — uses NavLink so React Router updates the page immediately. */
const StaffNavButton = ({ to, className = '', activeClassName = '', inactiveClassName = '', children, onAfterNavigate }) => (
  <NavLink
    to={to}
    onClick={() => onAfterNavigate?.()}
    className={({ isActive }) => (isActive ? activeClassName || className : inactiveClassName || className)}
  >
    {children}
  </NavLink>
)

export default StaffNavButton
