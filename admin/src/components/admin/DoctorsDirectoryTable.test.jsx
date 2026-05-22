import { describe, it, expect, vi } from 'vitest'
import { fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DoctorsDirectoryTable from './DoctorsDirectoryTable'
import { renderWithLanguage } from '../../test/renderWithLanguage'

const renderTable = (props) =>
  renderWithLanguage(
    <MemoryRouter>
      <DoctorsDirectoryTable {...props} />
    </MemoryRouter>
  )

const doctors = [
  {
    _id: 'd1',
    name: 'Dr. Ahmed',
    email: 'ahmed@clinic.test',
    phone: '01012345678',
    speciality: 'Cardiology',
    fees: 500,
    available: true,
    image: '/img.png',
    locations: ['Cairo'],
    ratingSummary: { averageRating: 4.2, ratingCount: 5 },
  },
  {
    _id: 'd2',
    name: 'Dr. Sara',
    email: 'sara@clinic.test',
    phone: '',
    speciality: 'Dermatology',
    fees: 300,
    available: false,
    image: '/img2.png',
    locations: [],
    ratingSummary: { averageRating: 0, ratingCount: 0 },
  },
]

const defaultProps = () => ({
  doctors,
  sortedDoctors: doctors,
  doctorsLoading: false,
  doctorStats: { total: 2, available: 1, unavailable: 1 },
  currency: 'EGP ',
  searchQuery: '',
  setSearchQuery: vi.fn(),
  availabilityFilter: 'all',
  setAvailabilityFilter: vi.fn(),
  sortBy: 'name',
  sortDir: 'asc',
  setSortBy: vi.fn(),
  setSortDir: vi.fn(),
  refreshing: false,
  onRefresh: vi.fn(),
  onOpenDoctor: vi.fn(),
  onToggleAvailability: vi.fn(),
})

describe('DoctorsDirectoryTable', () => {
  it('renders header stats and doctor rows', () => {
    const { container } = renderTable(defaultProps())
    const scope = within(container)
    expect(scope.getByText('All doctors')).toBeInTheDocument()
    expect(scope.getByText('Dr. Ahmed')).toBeInTheDocument()
    expect(scope.getByText('Dr. Sara')).toBeInTheDocument()
    expect(scope.getByText(/showing/i)).toHaveTextContent('2')
  })

  it('shows loading state', () => {
    const { container } = renderTable({ ...defaultProps(), doctorsLoading: true })
    expect(container.querySelector('.animate-spin')).toBeTruthy()
  })

  it('shows empty state when no doctors match', () => {
    const { container } = renderTable({ ...defaultProps(), sortedDoctors: [] })
    expect(within(container).getByText('No doctors match')).toBeInTheDocument()
  })

  it('updates search query', () => {
    const setSearchQuery = vi.fn()
    const { container } = renderTable({ ...defaultProps(), setSearchQuery })
    fireEvent.change(within(container).getByPlaceholderText(/search name/i), {
      target: { value: 'ahmed' },
    })
    expect(setSearchQuery).toHaveBeenCalledWith('ahmed')
  })

  it('clears search with clear button', () => {
    const setSearchQuery = vi.fn()
    const { container } = renderTable({ ...defaultProps(), searchQuery: 'test', setSearchQuery })
    fireEvent.click(within(container).getByRole('button', { name: /clear search/i }))
    expect(setSearchQuery).toHaveBeenCalledWith('')
  })

  it('changes availability filter', () => {
    const setAvailabilityFilter = vi.fn()
    const { container } = renderTable({ ...defaultProps(), setAvailabilityFilter })
    fireEvent.change(within(container).getByDisplayValue('All availability'), {
      target: { value: 'available' },
    })
    expect(setAvailabilityFilter).toHaveBeenCalledWith('available')
  })

  it('changes sort order from dropdown', () => {
    const setSortBy = vi.fn()
    const setSortDir = vi.fn()
    const { container } = renderTable({ ...defaultProps(), setSortBy, setSortDir })
    fireEvent.change(within(container).getByDisplayValue('Name A → Z'), {
      target: { value: 'fees:desc' },
    })
    expect(setSortBy).toHaveBeenCalledWith('fees')
    expect(setSortDir).toHaveBeenCalledWith('desc')
  })

  it('links to add doctor from header', () => {
    const { container } = renderTable(defaultProps())
    const scope = within(container)
    expect(scope.getByRole('link', { name: /add doctor/i })).toHaveAttribute('href', '/add-doctor')
  })

  it('calls refresh and open profile handlers', () => {
    const onRefresh = vi.fn()
    const onOpenDoctor = vi.fn()
    const { container } = renderTable({ ...defaultProps(), onRefresh, onOpenDoctor })
    const scope = within(container)
    fireEvent.click(scope.getByRole('button', { name: /refresh/i }))
    expect(onRefresh).toHaveBeenCalled()
    fireEvent.click(scope.getAllByRole('button', { name: /open profile/i })[0])
    expect(onOpenDoctor).toHaveBeenCalledWith('d1')
  })

  it('toggles doctor availability', () => {
    const onToggleAvailability = vi.fn()
    const { container } = renderTable({ ...defaultProps(), onToggleAvailability })
    const checkbox = within(container).getAllByRole('checkbox')[0]
    fireEvent.click(checkbox)
    expect(onToggleAvailability).toHaveBeenCalled()
  })
})
