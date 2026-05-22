import React, { useContext, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Banknote,
  CalendarCheck,
  CircleDollarSign,
  CreditCard,
  PieChart,
  Scale,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  XCircle
} from 'lucide-react'
import { DoctorContext } from '../../context/DoctorContext'
import { AppContext } from '../../context/AppContext'
import { describeCompensationAttribution, normalizeFinancialCompensation } from '../../utils/financialCompensation'

const slotDateToDate = (slotDate) => {
  const [day, month, year] = String(slotDate || '').split('_').map(Number)
  if (!day || !month || !year) return null
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
}

const monthLabel = (date) => date.toLocaleDateString('en', { month: 'short', year: 'numeric' })

const StatCard = ({ icon, label, value, sub, tone = 'slate' }) => {
  const tones = {
    slate: 'from-slate-50 to-white border-slate-200 text-slate-800',
    emerald: 'from-emerald-50 to-white border-emerald-200 text-emerald-900',
    amber: 'from-amber-50 to-white border-amber-200 text-amber-950',
    indigo: 'from-indigo-50 to-white border-indigo-200 text-indigo-950',
    rose: 'from-rose-50 to-white border-rose-200 text-rose-900',
    violet: 'from-violet-50 to-white border-violet-200 text-violet-950'
  }
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-5 shadow-sm ${tones[tone]}`}>
      <div className='mb-3 flex items-center justify-between gap-2'>
        <span className='rounded-lg bg-white/80 p-2 shadow-sm ring-1 ring-black/5'>
          {React.createElement(icon, { className: 'h-5 w-5 text-indigo-600' })}
        </span>
      </div>
      <p className='text-2xl font-bold tracking-tight'>{value}</p>
      <p className='mt-1 text-sm font-medium text-slate-600'>{label}</p>
      {sub && <p className='mt-2 text-xs text-slate-500'>{sub}</p>}
    </div>
  )
}

const DoctorFinancialAnalysis = () => {
  const { dToken, appointments, getAppointments, profileData, getProfileData } = useContext(DoctorContext)
  const { currency } = useContext(AppContext)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!dToken) return
    const run = async () => {
      await Promise.all([getAppointments(), getProfileData()])
      setReady(true)
    }
    run()
  }, [dToken, getAppointments, getProfileData])

  const analysis = useMemo(() => {
    const rows = appointments || []
    const activeAppointments = rows.filter((item) => !item.cancelled && item.appointmentStatus !== 'Cancelled')
    const paidAppointments = rows.filter((item) => item.paymentStatus === 'Paid' || item.isCompleted)
    const completedAppointments = rows.filter((item) => item.isCompleted || item.appointmentStatus === 'Finished')
    const cancelledAppointments = rows.filter((item) => item.cancelled || item.appointmentStatus === 'Cancelled')
    const revenue = paidAppointments.reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const outstanding = activeAppointments
      .filter((item) => item.paymentStatus !== 'Paid')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const averageVisitValue = paidAppointments.length ? Math.round(revenue / paidAppointments.length) : 0

    const byType = rows.reduce((acc, item) => {
      const key = item.appointmentType || 'Clinic'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

    const byPayment = rows.reduce((acc, item) => {
      const key = item.paymentStatus === 'Paid' ? (item.paymentMethod || 'Paid') : 'Not Paid'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

    const monthlyRevenueMap = rows.reduce((acc, item) => {
      const date = slotDateToDate(item.slotDate)
      if (!date) return acc
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const existing = acc.get(key) || { label: monthLabel(date), revenue: 0, appointments: 0 }
      existing.appointments += 1
      if (item.paymentStatus === 'Paid' || item.isCompleted) existing.revenue += Number(item.amount || 0)
      acc.set(key, existing)
      return acc
    }, new Map())

    const monthlyRevenue = Array.from(monthlyRevenueMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([, value]) => value)

    const maxMonthlyRevenue = Math.max(1, ...monthlyRevenue.map((item) => item.revenue))
    const totalType = Object.values(byType).reduce((a, b) => a + b, 0) || 1

    return {
      totalAppointments: rows.length,
      paidVisitCount: paidAppointments.length,
      completedAppointments: completedAppointments.length,
      cancelledAppointments: cancelledAppointments.length,
      revenue,
      outstanding,
      averageVisitValue,
      completionRate: rows.length ? Math.round((completedAppointments.length / rows.length) * 100) : 0,
      cancellationRate: rows.length ? Math.round((cancelledAppointments.length / rows.length) * 100) : 0,
      byType,
      byPayment,
      monthlyRevenue,
      maxMonthlyRevenue,
      totalType
    }
  }, [appointments])

  const comp = useMemo(
    () =>
      describeCompensationAttribution(analysis.revenue, profileData?.financialCompensation, {
        paidVisitCount: analysis.paidVisitCount
      }),
    [analysis.revenue, analysis.paidVisitCount, profileData?.financialCompensation]
  )

  const fcNorm = useMemo(() => normalizeFinancialCompensation(profileData?.financialCompensation), [profileData?.financialCompensation])

  return (
    <div className='min-h-full w-full bg-gradient-to-b from-slate-50 via-white to-slate-50/80 p-3 sm:p-5 md:p-8'>
      <div className='mx-auto max-w-6xl space-y-6'>
        <header className='flex flex-col gap-3 border-b border-slate-200/80 pb-6 md:flex-row md:items-end md:justify-between'>
          <div>
            <div className='mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100'>
              <Sparkles className='h-3.5 w-3.5' />
              Doctor workspace
            </div>
            <h1 className='flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl'>
              <span className='rounded-xl bg-indigo-600 p-2.5 text-white shadow-lg shadow-indigo-600/30'>
                <BarChart3 className='h-7 w-7' />
              </span>
              Financial analysis
            </h1>
            <p className='mt-2 max-w-xl text-sm text-slate-600 md:text-base'>
              Revenue performance, receivables, and your compensation as configured by the clinic administrator.
            </p>
          </div>
        </header>

        {!ready ? (
          <div className='rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm'>Loading…</div>
        ) : (
          <>
            <section className='overflow-hidden rounded-2xl border border-indigo-200/80 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 p-1 shadow-xl shadow-indigo-500/20'>
              <div className='rounded-[14px] bg-white/95 p-5 sm:p-7'>
                <div className='flex flex-col gap-6 lg:flex-row lg:items-stretch lg:justify-between'>
                  <div className='min-w-0 flex-1'>
                    <div className='flex flex-wrap items-center gap-2 gap-y-2'>
                      <h2 className='text-lg font-bold text-slate-900 sm:text-xl'>Your pay (set by admin)</h2>
                      {fcNorm.mode === 'hybrid' && (
                        <span className='rounded-full bg-fuchsia-100 px-3 py-1 text-sm font-black text-fuchsia-900 ring-1 ring-fuchsia-200/80'>
                          Hybrid (% + fixed)
                        </span>
                      )}
                      {(fcNorm.mode === 'percentage' || fcNorm.mode === 'hybrid') && fcNorm.percentage > 0 && (
                        <span className='rounded-full bg-indigo-100 px-3 py-1 text-sm font-black text-indigo-900 ring-1 ring-indigo-200/80'>
                          {fcNorm.percentage}% of paid visit revenue
                        </span>
                      )}
                      {(fcNorm.mode === 'fixed' || fcNorm.mode === 'hybrid') && fcNorm.fixedSalary > 0 && (
                        <span className='rounded-full bg-violet-100 px-3 py-1 text-sm font-black text-violet-900 ring-1 ring-violet-200/80'>
                          Fixed {currency}
                          {Number(fcNorm.fixedSalary).toLocaleString()} / month
                        </span>
                      )}
                    </div>
                    <p className='mt-3 text-sm leading-relaxed text-slate-600'>{comp.detail}</p>
                    {comp.isHybrid && (
                      <p className='mt-3 rounded-xl border border-fuchsia-100 bg-fuchsia-50/80 px-4 py-3 text-sm text-fuchsia-950'>
                        <strong>Hybrid pay:</strong> revenue share on paid visits{' '}
                        {fcNorm.percentage > 0 ? (
                          <>
                            (<span className='font-semibold text-indigo-800'>{fcNorm.percentage}%</span> ×{' '}
                            {currency}
                            {Number(analysis.revenue || 0).toLocaleString()} ≈ {currency}
                            {Number(comp.revenueSharePart || 0).toLocaleString()})
                          </>
                        ) : (
                          <span className='text-slate-600'>(no % set)</span>
                        )}
                        {fcNorm.fixedSalary > 0 ? (
                          <>
                            {' '}
                            + fixed <strong>{currency}{Number(fcNorm.fixedSalary).toLocaleString()}</strong>/month
                          </>
                        ) : null}
                        . <strong>Total estimate:</strong> {currency}
                        {Number(comp.doctorAttributed || 0).toLocaleString()}.
                      </p>
                    )}
                    {!comp.isFixedMonthly && !comp.isHybrid && fcNorm.mode === 'percentage' && fcNorm.percentage > 0 && (
                      <p className='mt-3 rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm text-slate-800'>
                        <span className='font-semibold text-indigo-700'>{fcNorm.percentage}%</span> × paid visit revenue{' '}
                        <span className='font-mono font-bold'>
                          ({currency}
                          {Number(analysis.revenue || 0).toLocaleString()})
                        </span>{' '}
                        from <strong>{analysis.paidVisitCount}</strong> paid patient visit{analysis.paidVisitCount === 1 ? '' : 's'} ={' '}
                        <span className='font-bold text-emerald-800'>
                          {currency}
                          {Number(comp.doctorAttributed || 0).toLocaleString()}
                        </span>
                      </p>
                    )}
                    {comp.isFixedMonthly && fcNorm.fixedSalary > 0 && (
                      <p className='mt-3 rounded-xl border border-violet-100 bg-violet-50/80 px-4 py-3 text-sm text-violet-950'>
                        Your <strong>fixed monthly</strong> amount:{' '}
                        <strong className='text-lg'>
                          {currency}
                          {Number(fcNorm.fixedSalary).toLocaleString()}
                        </strong>{' '}
                        per month (admin). Per-visit revenue below is for your records only.
                      </p>
                    )}
                    <div className='mt-4 flex flex-wrap items-center gap-2'>
                      <span className='inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800 ring-1 ring-slate-200'>
                        <Scale className='h-3.5 w-3.5' />
                        {comp.label}
                      </span>
                      <span className='inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-100'>
                        <Users className='h-3.5 w-3.5' />
                        {analysis.paidVisitCount} paid visit{analysis.paidVisitCount === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                  <div className='flex flex-col items-stretch gap-3 sm:flex-row sm:items-center'>
                    <div className='rounded-2xl border border-emerald-100 bg-emerald-50/90 px-6 py-4 text-center shadow-inner sm:min-w-[200px]'>
                      <p className='text-xs font-semibold uppercase tracking-wide text-emerald-800'>You deserve (estimate)</p>
                      <p className='mt-1 text-3xl font-black text-emerald-900'>
                        {currency}
                        {Number(comp.doctorAttributed || 0).toLocaleString()}
                        {comp.isFixedMonthly ? <span className='block text-sm font-bold text-emerald-800/90'>per month</span> : null}
                        {comp.isHybrid ? (
                          <span className='block text-sm font-bold text-emerald-800/90'>visits (est.) + monthly fixed</span>
                        ) : null}
                      </p>
                      <p className='text-xs font-medium text-emerald-800/80'>
                        {comp.isFixedMonthly ? 'Fixed salary (admin)' : comp.isHybrid ? 'Hybrid: % of paid visits + fixed (admin)' : 'From your paid visits in this list'}
                      </p>
                    </div>
                    {!comp.isFixedMonthly && comp.clinicAttributed != null && (
                      <div className='rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-center'>
                        <p className='text-xs font-semibold uppercase text-slate-500'>Clinic share (est.)</p>
                        <p className='mt-1 text-xl font-bold text-slate-800'>
                          {currency}
                          {Number(comp.clinicAttributed || 0).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
              <StatCard
                icon={CircleDollarSign}
                label='Total paid revenue'
                value={`${currency}${Number(analysis.revenue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                sub='Completed or marked paid'
                tone='emerald'
              />
              <StatCard
                icon={CreditCard}
                label='Outstanding'
                value={`${currency}${Number(analysis.outstanding || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                sub='Active visits awaiting payment'
                tone='amber'
              />
              <StatCard icon={CalendarCheck} label='Completed visits' value={analysis.completedAppointments} tone='indigo' />
              <StatCard icon={XCircle} label='Cancelled' value={analysis.cancelledAppointments} tone='rose' />
            </section>

            <section className='grid gap-5 lg:grid-cols-[1.25fr_0.75fr]'>
              <div className='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6'>
                <div className='mb-5 flex items-center justify-between gap-3'>
                  <div>
                    <p className='text-lg font-bold text-slate-900'>Monthly revenue</p>
                    <p className='text-sm text-slate-500'>Last six months · paid amounts</p>
                  </div>
                  <TrendingUp className='h-6 w-6 text-emerald-500' />
                </div>
                <div className='space-y-5'>
                  {analysis.monthlyRevenue.length > 0 ? (
                    analysis.monthlyRevenue.map((item) => {
                      const pct = Math.min(100, Math.max(6, (item.revenue / analysis.maxMonthlyRevenue) * 100))
                      return (
                        <div key={item.label}>
                          <div className='mb-1.5 flex justify-between text-sm'>
                            <span className='font-semibold text-slate-800'>{item.label}</span>
                            <span className='text-slate-500'>
                              {currency}
                              {item.revenue} · {item.appointments} appts
                            </span>
                          </div>
                          <div className='h-3 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/60'>
                            <div
                              className='h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-500'
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <p className='rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500'>No revenue history yet.</p>
                  )}
                </div>
              </div>

              <div className='space-y-5'>
                <div className='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'>
                  <div className='mb-4 flex items-center gap-2'>
                    <PieChart className='h-5 w-5 text-indigo-600' />
                    <p className='font-bold text-slate-900'>Appointment mix</p>
                  </div>
                  <div className='space-y-3'>
                    {Object.entries(analysis.byType).map(([label, count]) => {
                      const pct = Math.round((count / analysis.totalType) * 100)
                      return (
                        <div key={label}>
                          <div className='mb-1 flex justify-between text-sm'>
                            <span className='font-medium text-slate-700'>{label}</span>
                            <span className='font-bold text-slate-900'>
                              {count}{' '}
                              <span className='text-xs font-normal text-slate-500'>({pct}%)</span>
                            </span>
                          </div>
                          <div className='h-2 overflow-hidden rounded-full bg-slate-100'>
                            <div className='h-full rounded-full bg-indigo-500' style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'>
                  <div className='mb-4 flex items-center gap-2'>
                    <Wallet className='h-5 w-5 text-emerald-600' />
                    <p className='font-bold text-slate-900'>Payment health</p>
                  </div>
                  <div className='grid grid-cols-2 gap-3'>
                    <div className='rounded-xl bg-emerald-50 p-4 text-center ring-1 ring-emerald-100'>
                      <p className='text-2xl font-black text-emerald-800'>{analysis.completionRate}%</p>
                      <p className='text-xs font-semibold text-emerald-900/80'>Completion</p>
                    </div>
                    <div className='rounded-xl bg-rose-50 p-4 text-center ring-1 ring-rose-100'>
                      <p className='text-2xl font-black text-rose-800'>{analysis.cancellationRate}%</p>
                      <p className='text-xs font-semibold text-rose-900/80'>Cancellation</p>
                    </div>
                    <div className='col-span-2 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 p-4 text-center text-white shadow-inner'>
                      <p className='text-xs font-semibold uppercase tracking-wide text-white/70'>Average paid visit</p>
                      <p className='mt-1 flex items-center justify-center gap-2 text-2xl font-black'>
                        <Banknote className='h-6 w-6 text-emerald-300' />
                        {currency}
                        {analysis.averageVisitValue}
                      </p>
                    </div>
                  </div>
                  <div className='mt-4 space-y-2 border-t border-slate-100 pt-4'>
                    {Object.entries(analysis.byPayment).map(([label, count]) => (
                      <div key={label} className='flex items-center justify-between text-sm text-slate-600'>
                        <span>{label}</span>
                        <span className='font-bold text-slate-900'>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

export default DoctorFinancialAnalysis
