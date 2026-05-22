import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import axios from 'axios'
import PatientNotificationBell from './PatientNotificationBell'
import { AppContext } from '../context/AppContext'
import { renderWithLanguage } from '../test/renderWithLanguage'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('axios')

function renderBell({ token = 'patient-token', backendUrl = 'http://localhost:4000' } = {}) {
  return renderWithLanguage(
    <AppContext.Provider value={{ token, backendUrl }}>
      <MemoryRouter>
        <PatientNotificationBell />
      </MemoryRouter>
    </AppContext.Provider>
  )
}

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

describe('PatientNotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(axios.get).mockReset()
    vi.mocked(axios.post).mockReset()
  })

  it('renders nothing without auth token', () => {
    const { container } = renderBell({ token: null })
    expect(container.firstChild).toBeNull()
  })

  it('shows unread badge and opens notification panel', async () => {
    mockNotificationApi({
      unread: 2,
      notifications: [
        {
          _id: 'n1',
          title: 'Appointment booked',
          message: 'See you soon',
          read: false,
          createdAt: new Date().toISOString(),
        },
      ],
    })

    const { container } = renderBell()
    const scope = within(container)
    await waitFor(() => expect(scope.getByText('2')).toBeInTheDocument())

    fireEvent.click(scope.getByRole('button', { name: /notifications/i }))
    await waitFor(() => expect(scope.getByText('Appointment booked')).toBeInTheDocument())
  })

  it('navigates to appointments when a row is clicked', async () => {
    mockNotificationApi({
      unread: 1,
      notifications: [
        {
          _id: 'n2',
          title: 'Update',
          message: 'Details',
          read: false,
          createdAt: new Date().toISOString(),
        },
      ],
    })

    const { container } = renderBell()
    const scope = within(container)
    await waitFor(() => scope.getByText('1'))
    fireEvent.click(scope.getByRole('button', { name: /notifications/i }))
    await waitFor(() => scope.getByText('Update'))
    fireEvent.click(scope.getByText('Update'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/my-appointments'))
  })
})
