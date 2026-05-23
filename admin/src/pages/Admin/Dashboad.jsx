import React, { useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AdminContext } from '../../context/AdminContext'
import { AppContext } from '../../context/AppContext'
import { assets } from '../../assets/assets'
import { Building2, CalendarDays, CreditCard, LineChart, Stethoscope, UserRound, WalletCards } from 'lucide-react'
import { useLanguage } from '../../i18n'

const StatTile = ({ icon, label, value, accent = 'bg-blue-50 text-blue-700' }) => (
  <div className='bg-white border border-gray-200 rounded-lg p-4'>
    <div className='flex items-center justify-between gap-3'>
      <div>
        <p className='text-xs sm:text-sm text-gray-500'>{label}</p>
        <p className='mt-1 text-xl sm:text-2xl font-bold text-gray-900'>{value}</p>
      </div>
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${accent}`}>
        {icon}
      </div>
    </div>
  </div>
)

const TrendBars = ({ data, emptyLabel }) => {
  const maxCount = Math.max(...data.map((item) => item.count), 1)

  if (!data.length) {
    return <div className='h-56 flex items-center justify-center text-sm text-gray-500'>{emptyLabel}</div>
  }

  return (
    <div className='h-56 flex items-end gap-2 overflow-x-auto pb-1'>
      {data.map((item) => (
        <div key={item.label} className='min-w-12 flex-1 flex flex-col items-center gap-2'>
          <div className='text-xs font-semibold text-gray-700'>{item.count}</div>
          <div className='w-full flex items-end justify-center h-36 bg-gray-50 rounded-md overflow-hidden'>
            <div
              className='w-full bg-blue-600 rounded-t-md'
              style={{ height: `${Math.max((item.count / maxCount) * 100, 8)}%` }}
            />
          </div>
          <div className='text-[10px] text-gray-500 whitespace-nowrap'>{item.label}</div>
        </div>
      ))}
    </div>
  )
}

const Dashboard = () => {
  const navigate = useNavigate()
  const { aToken, getDashData, cancelAppointment, dashData } = useContext(AdminContext)
  const { slotDateFormat, currency } = useContext(AppContext)
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [trendRange, setTrendRange] = useState('day')

  const fillT = (key, vars = {}) => {
    let s = String(t(key))
    Object.entries(vars).forEach(([k, v]) => {
      s = s.split(`{{${k}}}`).join(String(v))
    })
    return s
  }

  const trendRangeLabel = { day: t('Day'), week: t('Week'), month: t('Month') }

  useEffect(() => {
    const fetchData = async () => {
      if (aToken) {
        setLoading(true)
        await getDashData()
        setLoading(false)
      }
    }

    fetchData()
  }, [aToken])

  const paymentTotal = (dashData?.paidAppointments || 0) + (dashData?.unpaidAppointments || 0)
  const paidPercent = paymentTotal ? Math.round(((dashData?.paidAppointments || 0) / paymentTotal) * 100) : 0

  const trendData = useMemo(() => {
    return dashData?.appointmentTrends?.[trendRange] || []
  }, [dashData, trendRange])

  const handleCancelAppointment = async (appointmentId) => {
    await cancelAppointment(appointmentId)
    getDashData()
  }

  if (loading) {
    return (
      <div className='p-3 sm:p-5 md:p-6 lg:p-8'>
        <div className='max-w-7xl'>
          <div className='mb-5'>
            <h1 className='text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900'>{t('Dashboard')}</h1>
            <p className='text-sm text-gray-600 mt-1'>
              {t('Patients, doctors, revenue, payments, appointment trends, and clinic performance.')}
            </p>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5'>
            {[...Array(8)].map((_, index) => (
              <div key={index} className='h-28 bg-white border border-gray-200 rounded-lg animate-pulse' />
            ))}
          </div>
          <div className='h-72 bg-white border border-gray-200 rounded-lg animate-pulse' />
        </div>
      </div>
    )
  }

  return (
      <div className='p-3 sm:p-5 md:p-6 lg:p-8'>
        <div className='max-w-7xl'>
          <div className='mb-5'>
            <h1 className='text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900'>{t('Dashboard')}</h1>
            <p className='text-sm text-gray-600 mt-1'>
              {t('Patients, doctors, revenue, payments, appointment trends, and clinic performance.')}
            </p>
          </div>


          <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5'>
            <button type='button' onClick={() => navigate('/patients')} className='text-left rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'>
              <StatTile icon={<UserRound className='w-5 h-5' />} label={t('Total Patients')} value={dashData?.patients || 0} accent='bg-blue-50 text-blue-700' />
            </button>
            <StatTile icon={<Stethoscope className='w-5 h-5' />} label={t('Total Doctors')} value={dashData?.doctors || 0} accent='bg-indigo-50 text-indigo-700' />
            <StatTile icon={<CalendarDays className='w-5 h-5' />} label={t('Appointments')} value={dashData?.appointments || 0} accent='bg-purple-50 text-purple-700' />
            <StatTile icon={<WalletCards className='w-5 h-5' />} label={t('Revenue')} value={`${currency}${dashData?.revenue || 0}`} accent='bg-green-50 text-green-700' />
          </div>

          <div className='grid grid-cols-1 lg:grid-cols-[1.4fr_0.9fr] gap-5 mb-5'>
            <div className='bg-white border border-gray-200 rounded-lg p-4 sm:p-5'>
              <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4'>
                <div className='flex items-center gap-2'>
                  <LineChart className='w-5 h-5 text-blue-600' />
                  <h2 className='font-semibold text-gray-800'>{t('Appointment Trends')}</h2>
                </div>
                <div className='inline-flex w-fit rounded-lg border border-gray-200 overflow-hidden'>
                  {['day', 'week', 'month'].map((range) => (
                    <button
                      key={range}
                      onClick={() => setTrendRange(range)}
                      className={`px-3 py-1.5 text-xs sm:text-sm capitalize ${trendRange === range ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                      {trendRangeLabel[range]}
                    </button>
                  ))}
                </div>
              </div>
              <TrendBars data={trendData} emptyLabel={t('No appointment trend data yet.')} />
            </div>

            <div className='bg-white border border-gray-200 rounded-lg p-4 sm:p-5'>
              <div className='flex items-center gap-2 mb-4'>
                <CreditCard className='w-5 h-5 text-blue-600' />
                <h2 className='font-semibold text-gray-800'>{t('Paid vs Unpaid')}</h2>
              </div>

              <div className='mb-5'>
                <div className='h-4 bg-amber-100 rounded-full overflow-hidden'>
                  <div className='h-full bg-green-600 rounded-full' style={{ width: `${paidPercent}%` }} />
                </div>
                <div className='mt-2 flex justify-between text-sm text-gray-600'>
                  <span>{fillT('{{pct}}% paid', { pct: paidPercent })}</span>
                  <span>
                    {paymentTotal} {t('Active payments')}
                  </span>
                </div>
              </div>

              <div className='grid grid-cols-2 gap-3 mb-5'>
                <div className='rounded-lg bg-green-50 p-3'>
                  <p className='text-xs text-green-700'>{t('Paid')}</p>
                  <p className='text-2xl font-bold text-green-800'>{dashData.paidAppointments || 0}</p>
                </div>
                <div className='rounded-lg bg-amber-50 p-3'>
                  <p className='text-xs text-amber-700'>{t('Unpaid')}</p>
                  <p className='text-2xl font-bold text-amber-800'>{dashData.unpaidAppointments || 0}</p>
                </div>
              </div>

              <div className='grid grid-cols-2 gap-3'>
                <div className='rounded-lg bg-gray-100 p-3'>
                  <p className='text-xs text-gray-600'>{t('Completed')}</p>
                  <p className='text-xl font-bold text-gray-800'>{dashData.completedAppointments || 0}</p>
                </div>
                <div className='rounded-lg bg-red-50 p-3'>
                  <p className='text-xs text-red-700'>{t('Cancelled')}</p>
                  <p className='text-xl font-bold text-red-800'>{dashData.cancelledAppointments || 0}</p>
                </div>
              </div>
            </div>
          </div>

          <div className='grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-5'>
            <div className='bg-white border border-gray-200 rounded-lg overflow-hidden'>
              <div className='flex items-center gap-2 px-4 py-3 border-b bg-gray-50'>
                <Building2 className='w-5 h-5 text-blue-600' />
                <h2 className='font-semibold text-gray-800'>{t('Clinic Statistics')}</h2>
              </div>

              <div className='overflow-x-auto'>
                <div className='min-w-[720px]'>
                  <div className='grid grid-cols-[1.5fr_0.7fr_0.8fr_0.8fr_0.8fr_0.9fr] gap-3 px-4 py-3 text-sm font-semibold text-gray-700 bg-white border-b'>
                    <p>{t('Clinic')}</p>
                    <p>{t('Doctors')}</p>
                    <p>{t('Patients')}</p>
                    <p>{t('Appointments')}</p>
                    <p>{t('Paid')}</p>
                    <p>{t('Revenue')}</p>
                  </div>
                  {(dashData?.clinicStats || []).length === 0 ? (
                    <div className='px-4 py-8 text-center text-sm text-gray-500'>{t('No clinic statistics available.')}</div>
                  ) : (
                    dashData.clinicStats.map((clinic) => (
                      <div key={clinic.name} className='grid grid-cols-[1.5fr_0.7fr_0.8fr_0.8fr_0.8fr_0.9fr] gap-3 px-4 py-3 text-sm text-gray-600 border-b hover:bg-gray-50'>
                        <p className='font-medium text-gray-800 truncate'>{clinic.name}</p>
                        <p>{clinic.doctors}</p>
                        <p>{clinic.patients}</p>
                        <p>{clinic.appointments}</p>
                        <p>{clinic.paidAppointments}</p>
                        <p>{currency}{clinic.revenue}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className='bg-white border border-gray-200 rounded-lg overflow-hidden'>
              <div className='flex items-center gap-2 px-4 py-3 border-b bg-gray-50'>
                <img className='w-5 h-5' src={assets.list_icon} alt='List' />
                <h2 className='font-semibold text-gray-800'>{t('Latest Bookings')}</h2>
              </div>

              <div className='divide-y divide-gray-100 max-h-[440px] overflow-y-auto'>
                {dashData?.latestAppointments && dashData.latestAppointments.length > 0 ? (
                  dashData.latestAppointments.map((item) => (
                    <div className='flex items-center px-4 py-3 gap-3 hover:bg-gray-50 transition-colors' key={item._id}>
                      <img className='rounded-full w-11 h-11 object-cover bg-gray-100 flex-shrink-0' src={item.docData.image} alt={item.docData.name} />
                      <div className='flex-1 min-w-0'>
                        <p className='text-gray-800 font-medium text-sm truncate'>{item.docData.name}</p>
                        <p className='text-gray-500 text-xs'>
                          {t('Appointment date')}: {slotDateFormat(item.slotDate)}, {item.slotTime}
                        </p>
                        <p className='text-gray-500 text-xs truncate'>
                          {t('Patient')}: {item.userData?.name || t('Unknown')}
                        </p>
                      </div>

                      <div className='flex-shrink-0'>
                        {item.cancelled ? (
                          <p className='text-red-500 text-xs font-medium px-2 py-1 bg-red-50 rounded-full'>{t('Cancelled')}</p>
                        ) : item.isCompleted ? (
                          <p className='text-green-600 text-xs font-medium px-2 py-1 bg-green-50 rounded-full'>{t('Completed')}</p>
                        ) : (
                          <img onClick={() => handleCancelAppointment(item._id)} className='w-8 cursor-pointer hover:scale-110 transition-transform' src={assets.cancel_icon} alt={t('Cancel')} />
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className='text-center py-10'>
                    <p className='text-gray-400 text-sm'>{t('No appointments yet')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
  )
}

export default Dashboard
