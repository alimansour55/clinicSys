import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import axios from 'axios'
import NotificationBell from './NotificationBell'
import { AdminContext } from '../context/AdminContext'
import { DoctorContext } from '../context/DoctorContext'
import { ReceptionistContext } from '../context/ReceptionistContext'
import { renderWithLanguage } from '../test/renderWithLanguage'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('axios')

function mockNotificationApi({ unread = 1, notifications = [] } = {}) {
  vi.mocked(axios.get).mockImplementation((url) => {
    if (String(url).includes('unread-count')) {
      return Promise.resolve({ data: { success: true, unreadCount: unread } })
    }
    if (String(url).includes('/api/notifications?')) {
      return Promise.resolve({ data: { success: true, notifications } })
    }
    return Promise.reject(new Error(`Unexpected GET ${url}`))
  })
  vi.mocked(axios.post).mockResolvedValue({ data: { success: true } })
}

function renderBell({ aToken = 'admin-token', dToken = null, rToken = null } = {}) {
  return renderWithLanguage(
    <AdminContext.Provider value={{ aToken }}>
      <DoctorContext.Provider value={{ dToken }}>
        <ReceptionistContext.Provider value={{ rToken }}>
          <MemoryRouter>
            <NotificationBell />
          </MemoryRouter>
        </ReceptionistContext.Provider>
      </DoctorContext.Provider>
    </AdminContext.Provider>
  )
}

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(axios.get).mockReset()
    vi.mocked(axios.post).mockReset()
    vi.stubEnv('VITE_BACKEND_URL', 'http://localhost:4000')
  })

  it('renders nothing without any staff token', () => {
    const { container } = renderBell({ aToken: null })
    expect(container.firstChild).toBeNull()
  })

  it('shows unread count and lists notifications for admin', async () => {
    mockNotificationApi({
      unread: 3,
      notifications: [
        {
          _id: 'a1',
          title: 'New booking',
          message: 'Patient booked',
          read: false,
          createdAt: new Date().toISOString(),
          type: 'appointment_booked',
        },
      ],
    })

    const { container } = renderBell()
    const scope = within(container)
    await waitFor(() => expect(scope.getByText('3')).toBeInTheDocument())
    fireEvent.click(scope.getByRole('button', { name: /notifications/i }))
    await waitFor(() => expect(scope.getByText('New booking')).toBeInTheDocument())
  })

  it('navigates admin appointment notifications to appointments route', async () => {
    mockNotificationApi({
      unread: 1,
      notifications: [
        {
          _id: 'a2',
          title: 'Status',
          message: 'Updated',
          read: false,
          createdAt: new Date().toISOString(),
          type: 'appointment_status',
        },
      ],
    })

    const { container } = renderBell()
    const scope = within(container)
    await waitFor(() => scope.getByText('1'))
    fireEvent.click(scope.getByRole('button', { name: /notifications/i }))
    await waitFor(() => scope.getByText('Status'))
    fireEvent.click(scope.getByText('Status'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/actual-appointments'))
  })
})
