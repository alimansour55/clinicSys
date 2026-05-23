import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  Calculator,
  Filter,
  Layers,
  LineChart,
  Percent,
  PiggyBank,
  RefreshCw,
  Save,
  Sparkles,
  Users
} from 'lucide-react'
import { AdminContext } from '../../context/AdminContext'
import { AppContext } from '../../context/AppContext'
import { useLanguage } from '../../i18n'
import { describeCompensationAttribution, normalizeFinancialCompensation } from '../../utils/financialCompensation'

const aggregateTotals = (breakdown) => {
  if (!breakdown?.length) {
    return {
      paidRevenue: 0,
      outstandingAmount: 0,
      totalAppointments: 0,
      paidVisitCount: 0,
      revenueShareToDoctors: 0,
      fixedMonthlySalarySum: 0,
      totalDoctorCompensationEstimate: 0
    }
  }
  let revenueShareToDoctors = 0
  let fixedMonthlySalarySum = 0
  for (const r of breakdown) {
    if (r.isHybrid) {
      revenueShareToDoctors += Number(r.revenueSharePart || 0)
      fixedMonthlySalarySum += Number(r.fixedMonthlyPart || 0)
    } else if (r.isFixedMonthly) fixedMonthlySalarySum += Number(r.doctorAttributed || 0)
    else revenueShareToDoctors += Number(r.doctorAttributed || 0)
  }
  return {
    paidRevenue: breakdown.reduce((s, r) => s + Number(r.paidRevenue || 0), 0),
    outstandingAmount: breakdown.reduce((s, r) => s + Number(r.outstandingAmount || 0), 0),
    totalAppointments: breakdown.reduce((s, r) => s + Number(r.totalAppointments || 0), 0),
    paidVisitCount: breakdown.reduce((s, r) => s + Number(r.paidVisitCount || 0), 0),
    revenueShareToDoctors,
    fixedMonthlySalarySum,
    totalDoctorCompensationEstimate: revenueShareToDoctors + fixedMonthlySalarySum
  }
}

const AdminFinancialAnalytics = () => {
  const { aToken, backendUrl, doctors, getAllDoctors } = useContext(AdminContext)
  const { currency } = useContext(AppContext)
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)

  const fillT = (key, vars = {}) => {
    let s = String(t(key))
    Object.entries(vars).forEach(([k, v]) => {
      s = s.split(`{{${k}}}`).join(String(v))
    })
    return s
  }
  const [doctorId, setDoctorId] = useState('')
  const [payload, setPayload] = useState(null)
  const [savingPay, setSavingPay] = useState(false)

  const [payDocId, setPayDocId] = useState('')
  const [payMode, setPayMode] = useState('percentage')
  const [payPercentage, setPayPercentage] = useState(50)
  const [payFixed, setPayFixed] = useState(0)
  /** Avoid re-loading pay form from `doctors` on every list refresh (that was resetting % vs fixed for unsaved edits). */
  const lastPayFormSyncedForDocId = useRef(null)

  const load = useCallback(async () => {
    if (!aToken) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { data } = await axios.get(`${backendUrl}/api/admin/financial-analytics`, {
        headers: { aToken }
      })
      if (data.success) {
        setPayload(data)
      } else {
        toast.error(data.message || t('Failed to load analytics'))
      }
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [aToken, backendUrl, t])

  useEffect(() => {
    if (aToken) getAllDoctors()
  }, [aToken, getAllDoctors])

  useEffect(() => {
    load()
  }, [load])

  const allRows = useMemo(() => payload?.doctors || [], [payload])

  const displayRows = useMemo(() => {
    const id = doctorId.trim()
    if (!id) return allRows
    return allRows.filter((r) => String(r.docId) === id)
  }, [allRows, doctorId])

  const totals = useMemo(() => aggregateTotals(displayRows), [displayRows])

  const doctorOptions = useMemo(
    () =>
      (doctors || [])
        .map((d) => ({ id: String(d._id), name: d.name || 'Doctor' }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [doctors]
  )

  useEffect(() => {
    if (!doctorOptions.length) return
    const valid = new Set(doctorOptions.map((d) => d.id))
    if (!payDocId || !valid.has(String(payDocId))) {
      setPayDocId(doctorOptions[0].id)
    }
  }, [doctorOptions, payDocId])

  useEffect(() => {
    if (!payDocId || !(doctors || []).length) return
    const doc = doctors.find((d) => String(d._id) === String(payDocId))
    if (!doc) return

    const prevSynced = lastPayFormSyncedForDocId.current
    const doctorChanged = prevSynced !== String(payDocId)
    if (!doctorChanged) return

    lastPayFormSyncedForDocId.current = String(payDocId)
    const fc = normalizeFinancialCompensation(doc.financialCompensation)
    setPayMode(fc.mode === 'fixed' ? 'fixed' : fc.mode === 'hybrid' ? 'hybrid' : 'percentage')
    setPayPercentage(fc.percentage)
    setPayFixed(fc.fixedSalary)
  }, [payDocId, doctors])

  const payPreviewRow = useMemo(
    () => allRows.find((r) => String(r.docId) === String(payDocId)),
    [allRows, payDocId]
  )

  const previewRevenue = payPreviewRow?.paidRevenue ?? 0
  const previewPaidVisits = payPreviewRow?.paidVisitCount ?? 0

  const previewAttr = useMemo(() => {
    return describeCompensationAttribution(
      previewRevenue,
      {
        mode: payMode,
        percentage: payMode === 'fixed' ? 0 : payPercentage,
        fixedSalary: payMode === 'percentage' ? 0 : payFixed
      },
      { paidVisitCount: previewPaidVisits, t }
    )
  }, [previewRevenue, previewPaidVisits, payMode, payPercentage, payFixed, t])

  const formatMoney = (n) => `${currency}${Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`

  const saveDoctorPay = async () => {
    if (!doctorOptions.length) {
      toast.warn(t('No doctors in the system'))
      return
    }
    if (!payDocId) {
      toast.warn(t('Choose a doctor'))
      return
    }
    setSavingPay(true)
    try {
      const pct = Math.min(100, Math.max(0, Math.round(Number(payPercentage)) || 0))
      const fix = Math.max(0, Math.round(Number(payFixed)) || 0)
      if (payMode === 'hybrid' && pct <= 0 && fix <= 0) {
        toast.warn(t('Hybrid pay needs a percentage above 0 and/or a fixed monthly amount'))
        setSavingPay(false)
        return
      }
      let compPayload
      if (payMode === 'fixed') {
        compPayload = { mode: 'fixed', percentage: 0, fixedSalary: fix, percentageEnabled: false }
      } else if (payMode === 'hybrid') {
        compPayload = { mode: 'hybrid', percentage: pct, fixedSalary: fix, percentageEnabled: pct > 0 }
      } else {
        compPayload = { mode: 'percentage', percentage: pct, fixedSalary: 0, percentageEnabled: pct > 0 }
      }
      const formData = new FormData()
      formData.append('docId', payDocId)
      formData.append('financialCompensation', JSON.stringify(normalizeFinancialCompensation(compPayload)))
      const { data } = await axios.post(`${backendUrl}/api/admin/update-doctor`, formData, {
        headers: { aToken, 'Content-Type': 'multipart/form-data' }
      })
      if (!data.success) {
        toast.error(data.message || t('Save failed'))
        return
      }
      toast.success(data.message || t('Pay settings saved'))
      await getAllDoctors()
      await load()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSavingPay(false)
    }
  }

  const estClinicRetains = useMemo(() => {
    if (!totals) return 0
    return Math.max(0, (totals.paidRevenue || 0) - (totals.revenueShareToDoctors || 0))
  }, [totals])

  return (
    <div className='min-h-full w-full bg-[#f4f6fb] p-3 sm:p-5 md:p-8'>
      <div className='mx-auto max-w-7xl space-y-8'>
        <header className='relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8'>
          <div className='pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-100/80 blur-3xl' />
          <div className='pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-emerald-100/70 blur-3xl' />
          <div className='relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between'>
            <div>
              <div className='mb-3 inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white'>
                <Building2 className='h-3.5 w-3.5' />
                {t('Admin · Financial control')}
              </div>
              <h1 className='flex flex-wrap items-center gap-3 text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl'>
                <span className='flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30'>
                  <BarChart3 className='h-7 w-7' />
                </span>
                {t('Financial analytics')}
              </h1>
              <p className='mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 md:text-base'>
                {t('Financial analytics intro')}
              </p>
            </div>
            <div className='flex flex-wrap items-end gap-3'>
              <div className='min-w-[220px]'>
                <label className='mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500'>
                  <Filter className='h-3.5 w-3.5' />
                  {t('Table filter')}
                </label>
                <select
                  value={doctorId}
                  onChange={(e) => setDoctorId(e.target.value)}
                  className='w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm font-semibold text-slate-900 shadow-inner outline-none ring-slate-200 transition focus:bg-white focus:ring-2 focus:ring-indigo-500'
                >
                  <option value=''>{t('All doctors')}</option>
                  {doctorOptions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type='button'
                onClick={() => load()}
                disabled={loading}
                className='inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50'
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {t('Refresh')}
              </button>
            </div>
          </div>
        </header>

        {loading && !payload ? (
          <div className='rounded-3xl border border-slate-200 bg-white p-16 text-center font-medium text-slate-500 shadow-sm'>
            {t('Loading analytics…')}
          </div>
        ) : (
          <>
            <section className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'>
              <div className='rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-white to-emerald-50/90 p-5 shadow-sm xl:col-span-1'>
                <p className='text-[11px] font-bold uppercase tracking-wide text-emerald-800'>{t('Paid revenue')}</p>
                <p className='mt-2 text-2xl font-black text-emerald-950'>{formatMoney(totals?.paidRevenue)}</p>
                <p className='mt-2 flex items-center gap-1 text-xs font-medium text-emerald-800/80'>
                  <ArrowUpRight className='h-3.5 w-3.5 shrink-0' />
                  {t('Paid / completed visits')}
                </p>
              </div>
              <div className='rounded-2xl border border-amber-200/60 bg-gradient-to-br from-white to-amber-50/90 p-5 shadow-sm xl:col-span-1'>
                <p className='text-[11px] font-bold uppercase tracking-wide text-amber-900'>{t('Outstanding')}</p>
                <p className='mt-2 text-2xl font-black text-amber-950'>{formatMoney(totals?.outstandingAmount)}</p>
                <p className='mt-2 flex items-center gap-1 text-xs font-medium text-amber-900/80'>
                  <ArrowDownRight className='h-3.5 w-3.5 shrink-0' />
                  {t('Unpaid active visits')}
                </p>
              </div>
              <div className='rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-1'>
                <p className='text-[11px] font-bold uppercase tracking-wide text-slate-500'>{t('Paid visits')}</p>
                <p className='mt-2 text-2xl font-black text-slate-900'>{totals?.paidVisitCount ?? 0}</p>
                <p className='mt-2 text-xs text-slate-500'>{t('Visits counted in paid revenue')}</p>
              </div>
              <div className='rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm xl:col-span-1'>
                <p className='text-[11px] font-bold uppercase tracking-wide text-indigo-900'>{t('% share to doctors')}</p>
                <p className='mt-2 text-2xl font-black text-indigo-950'>{formatMoney(totals?.revenueShareToDoctors)}</p>
                <p className='mt-2 text-xs text-indigo-800/80'>{t('Share of paid visit revenue (% doctors)')}</p>
              </div>
              <div className='rounded-2xl border border-violet-200/60 bg-gradient-to-br from-violet-50 to-white p-5 shadow-sm xl:col-span-1'>
                <p className='text-[11px] font-bold uppercase tracking-wide text-violet-900'>{t('Fixed / month')}</p>
                <p className='mt-2 text-2xl font-black text-violet-950'>{formatMoney(totals?.fixedMonthlySalarySum)}</p>
                <p className='mt-2 text-xs text-violet-800/80'>{t('Sum of monthly fixed')}</p>
              </div>
              <div className='rounded-2xl border border-slate-900/10 bg-slate-900 p-5 text-white shadow-lg xl:col-span-1'>
                <p className='text-[11px] font-bold uppercase tracking-wide text-white/70'>{t('Total doctor pay (est.)')}</p>
                <p className='mt-2 text-2xl font-black'>{formatMoney(totals?.totalDoctorCompensationEstimate)}</p>
                <p className='mt-2 text-xs text-white/65'>{t('% share + fixed salaries')}</p>
                <p className='mt-3 border-t border-white/10 pt-3 text-[11px] text-white/60'>
                  {t('Clinic from paid revenue (after % only):')} {formatMoney(estClinicRetains)}
                </p>
              </div>
            </section>

            <section className='overflow-hidden rounded-3xl border border-indigo-200/50 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-[1px] shadow-xl shadow-indigo-500/15'>
              <div className='rounded-[23px] bg-white p-5 sm:p-7'>
                <div className='flex flex-col gap-8 lg:flex-row lg:items-stretch lg:justify-between'>
                  <div className='max-w-md shrink-0 lg:border-r lg:border-slate-100 lg:pr-8'>
                    <div className='mb-2 inline-flex items-center gap-2 text-indigo-700'>
                      <PiggyBank className='h-5 w-5' />
                      <span className='text-xs font-bold uppercase tracking-wider'>{t('Pay doctor')}</span>
                    </div>
                    <h2 className='text-xl font-bold text-slate-900 sm:text-2xl'>{t('How this doctor is paid')}</h2>
                    <p className='mt-3 text-sm leading-relaxed text-slate-600'>{t('Pay doctor intro')}</p>
                    <ul className='mt-4 space-y-2 text-xs font-medium text-slate-500'>
                      <li className='flex gap-2'>
                        <Percent className='mt-0.5 h-4 w-4 shrink-0 text-indigo-500' />
                        {t('Percent / hybrid share uses only paid / completed visit amounts, not unpaid bookings.')}
                      </li>
                      <li className='flex gap-2'>
                        <Users className='mt-0.5 h-4 w-4 shrink-0 text-indigo-500' />
                        {t('Preview always uses this doctor’s real paid visit count and revenue, even when the table is filtered.')}
                      </li>
                    </ul>
                  </div>
                  <div className='flex min-w-0 flex-1 flex-col gap-5'>
                    <div className='grid gap-4 sm:grid-cols-3'>
                      <div className='rounded-2xl border border-slate-200 bg-slate-50/90 p-4 text-center shadow-inner'>
                        <p className='text-[10px] font-bold uppercase tracking-wide text-slate-500'>{t('Paid visits')}</p>
                        <p className='mt-1 text-2xl font-black text-slate-900'>{previewPaidVisits}</p>
                        <p className='mt-1 text-[11px] text-slate-500'>{t('For selected doctor')}</p>
                      </div>
                      <div className='rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 text-center shadow-inner'>
                        <p className='text-[10px] font-bold uppercase tracking-wide text-emerald-800'>{t('Paid visit revenue')}</p>
                        <p className='mt-1 text-lg font-black text-emerald-950'>{formatMoney(previewRevenue)}</p>
                        <p className='mt-1 text-[11px] text-emerald-800/80'>{t('Basis for % mode')}</p>
                      </div>
                      <div className='rounded-2xl border border-indigo-100 bg-indigo-50/80 p-4 text-center shadow-inner'>
                        <p className='text-[10px] font-bold uppercase tracking-wide text-indigo-900'>{t('Live estimate')}</p>
                        <p className='mt-1 text-lg font-black text-indigo-950'>{formatMoney(previewAttr.doctorAttributed)}</p>
                        <p className='mt-1 text-[11px] text-indigo-800/80'>
                          {payMode === 'fixed'
                            ? t('Per month')
                            : payMode === 'hybrid'
                              ? t('% share + fixed (combined)')
                              : t('From current %')}
                        </p>
                      </div>
                    </div>

                    <div className='rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5'>
                      <label className='mb-2 block text-xs font-bold uppercase text-slate-500'>{t('Doctor')}</label>
                      <select
                        value={payDocId}
                        onChange={(e) => setPayDocId(e.target.value)}
                        disabled={!doctorOptions.length}
                        className='w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100'
                      >
                        {!doctorOptions.length ? (
                          <option value=''>{t('No doctors yet')}</option>
                        ) : (
                          doctorOptions.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))
                        )}
                      </select>

                      <p className='mt-4 text-xs font-bold uppercase text-slate-500'>{t('Pay type')}</p>
                      <div className='mt-2 grid gap-3 sm:grid-cols-3'>
                        <button
                          type='button'
                          onClick={() => setPayMode('percentage')}
                          className={`rounded-2xl border-2 px-4 py-4 text-left transition ${
                            payMode === 'percentage'
                              ? 'border-indigo-500 bg-indigo-50/90 shadow-md ring-1 ring-indigo-200'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className='flex items-center gap-2 text-sm font-bold text-slate-900'>
                            <Percent className='h-4 w-4 text-indigo-600' />
                            {t('% of paid visit revenue')}
                          </div>
                          <p className='mt-1 text-xs leading-relaxed text-slate-600'>
                            {t('Doctor earns a share of money from visits marked paid.')}
                          </p>
                        </button>
                        <button
                          type='button'
                          onClick={() => setPayMode('fixed')}
                          className={`rounded-2xl border-2 px-4 py-4 text-left transition ${
                            payMode === 'fixed'
                              ? 'border-violet-500 bg-violet-50/90 shadow-md ring-1 ring-violet-200'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className='flex items-center gap-2 text-sm font-bold text-slate-900'>
                            <PiggyBank className='h-4 w-4 text-violet-600' />
                            {t('Fixed monthly')}
                          </div>
                          <p className='mt-1 text-xs leading-relaxed text-slate-600'>
                            {t('Same amount each month, regardless of visit count.')}
                          </p>
                        </button>
                        <button
                          type='button'
                          onClick={() => setPayMode('hybrid')}
                          className={`rounded-2xl border-2 px-4 py-4 text-left transition sm:col-span-1 ${
                            payMode === 'hybrid'
                              ? 'border-fuchsia-500 bg-fuchsia-50/90 shadow-md ring-1 ring-fuchsia-200'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className='flex items-center gap-2 text-sm font-bold text-slate-900'>
                            <Layers className='h-4 w-4 text-fuchsia-600' />
                            {t('% + fixed together')}
                          </div>
                          <p className='mt-1 text-xs leading-relaxed text-slate-600'>
                            {t('Revenue share on paid visits plus a guaranteed monthly amount.')}
                          </p>
                        </button>
                      </div>

                      {payMode === 'percentage' && (
                        <div className='mt-5'>
                          <div className='mb-2 flex flex-wrap items-end justify-between gap-2'>
                            <label className='text-xs font-bold uppercase text-slate-500'>{t('Revenue share (0–100%)')}</label>
                            <span className='text-sm font-black text-indigo-700'>{Number.isFinite(payPercentage) ? payPercentage : 0}%</span>
                          </div>
                          <input
                            type='range'
                            min={0}
                            max={100}
                            value={Number.isFinite(payPercentage) ? payPercentage : 0}
                            onChange={(e) => setPayPercentage(Number(e.target.value))}
                            className='mb-3 h-2 w-full cursor-pointer accent-indigo-600'
                          />
                          <div className='flex flex-wrap items-center gap-3'>
                            <input
                              type='number'
                              min={0}
                              max={100}
                              value={Number.isFinite(payPercentage) ? payPercentage : 0}
                              onChange={(e) => {
                                const raw = e.target.value
                                const n = raw === '' ? 0 : Number(raw)
                                setPayPercentage(Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0)
                              }}
                              className='w-24 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-lg font-black text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500'
                            />
                            <span className='text-sm text-slate-600'>{t('of this doctor’s paid visit revenue (see table).')}</span>
                          </div>
                        </div>
                      )}

                      {payMode === 'fixed' && (
                        <div className='mt-5'>
                          <label className='mb-2 block text-xs font-bold uppercase text-slate-500'>
                            {fillT('Monthly fixed amount ({{currency}})', { currency: currency.trim() })}
                          </label>
                          <input
                            type='number'
                            min={0}
                            value={Number.isFinite(payFixed) ? payFixed : 0}
                            onChange={(e) => {
                              const raw = e.target.value
                              const n = raw === '' ? 0 : Number(raw)
                              setPayFixed(Number.isFinite(n) ? Math.max(0, n) : 0)
                            }}
                            className='w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-lg font-bold text-slate-900 outline-none focus:ring-2 focus:ring-violet-500'
                          />
                          <p className='mt-2 text-xs text-slate-500'>{t('Shown to the doctor as their fixed monthly pay.')}</p>
                        </div>
                      )}

                      {payMode === 'hybrid' && (
                        <div className='mt-5 space-y-5'>
                          <div>
                            <div className='mb-2 flex flex-wrap items-end justify-between gap-2'>
                              <label className='text-xs font-bold uppercase text-slate-500'>{t('Revenue share (0–100%)')}</label>
                              <span className='text-sm font-black text-indigo-700'>{Number.isFinite(payPercentage) ? payPercentage : 0}%</span>
                            </div>
                            <input
                              type='range'
                              min={0}
                              max={100}
                              value={Number.isFinite(payPercentage) ? payPercentage : 0}
                              onChange={(e) => setPayPercentage(Number(e.target.value))}
                              className='mb-3 h-2 w-full cursor-pointer accent-indigo-600'
                            />
                            <div className='flex flex-wrap items-center gap-3'>
                              <input
                                type='number'
                                min={0}
                                max={100}
                                value={Number.isFinite(payPercentage) ? payPercentage : 0}
                                onChange={(e) => {
                                  const raw = e.target.value
                                  const n = raw === '' ? 0 : Number(raw)
                                  setPayPercentage(Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0)
                                }}
                                className='w-24 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-lg font-black text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500'
                              />
                              <span className='text-sm text-slate-600'>{t('of paid visit revenue (this view).')}</span>
                            </div>
                          </div>
                          <div>
                            <label className='mb-2 block text-xs font-bold uppercase text-slate-500'>
                              Monthly fixed amount ({currency.trim()})
                            </label>
                            <input
                              type='number'
                              min={0}
                              value={Number.isFinite(payFixed) ? payFixed : 0}
                              onChange={(e) => {
                                const raw = e.target.value
                                const n = raw === '' ? 0 : Number(raw)
                                setPayFixed(Number.isFinite(n) ? Math.max(0, n) : 0)
                              }}
                              className='w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-lg font-bold text-slate-900 outline-none focus:ring-2 focus:ring-fuchsia-500'
                            />
                            <p className='mt-2 text-xs text-slate-500'>{t('Paid on top of the percentage share from visits.')}</p>
                          </div>
                        </div>
                      )}

                      <div className='mt-6 flex flex-col gap-4 rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-4 sm:flex-row sm:items-center sm:justify-between'>
                        <div className='flex min-w-0 items-start gap-3'>
                          <Calculator className='mt-0.5 h-5 w-5 shrink-0 text-indigo-600' />
                          <div className='min-w-0'>
                            <p className='text-xs font-bold uppercase text-indigo-900'>{t('Doctor will see')}</p>
                            <p className='mt-1 text-sm font-semibold text-indigo-950'>
                              <strong>{formatMoney(previewAttr.doctorAttributed)}</strong>
                              {payMode === 'fixed' ? t(' / month') : ` · ${previewAttr.label}`}
                            </p>
                            <p className='mt-1 text-xs leading-relaxed text-indigo-900/80'>{previewAttr.detail}</p>
                          </div>
                        </div>
                        <button
                          type='button'
                          onClick={saveDoctorPay}
                          disabled={savingPay || !doctorOptions.length}
                          className='inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-indigo-700 disabled:opacity-50'
                        >
                          <Save className='h-4 w-4' />
                          {savingPay ? t('Saving…') : t('Save pay settings')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className='overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm'>
              <div className='flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50 px-5 py-4 sm:px-6'>
                <div className='flex items-center gap-3'>
                  <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow ring-1 ring-slate-200'>
                    <LineChart className='h-5 w-5 text-indigo-600' />
                  </div>
                  <div>
                    <h2 className='text-lg font-bold text-slate-900'>{t('Doctor breakdown')}</h2>
                    <p className='text-xs font-medium text-slate-500'>
                      {fillT(displayRows.length === 1 ? '{{scope}} · {{rows}} row · {{appts}} appointments in view' : '{{scope}} · {{rows}} rows · {{appts}} appointments in view', {
                        scope: doctorId.trim() ? t('Filtered to one doctor') : t('All doctors'),
                        rows: displayRows.length,
                        appts: totals?.totalAppointments ?? 0
                      })}
                    </p>
                  </div>
                </div>
                <p className='flex items-center gap-2 text-xs font-medium text-slate-500'>
                  <Sparkles className='h-4 w-4 text-amber-500' />
                  {t('Full profile: Doctors → select doctor → Edit')}
                </p>
              </div>
              <div className='overflow-x-auto'>
                <table className='min-w-[980px] w-full text-sm'>
                  <thead>
                    <tr className='border-b border-slate-200 bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500'>
                      <th className='px-5 py-3 sm:px-6'>{t('Doctor')}</th>
                      <th className='px-4 py-3'>{t('Speciality')}</th>
                      <th className='px-4 py-3 text-right'>{t('Paid revenue')}</th>
                      <th className='px-4 py-3 text-right'>{t('Outstanding')}</th>
                      <th className='px-4 py-3 text-center'>{t('Paid visits')}</th>
                      <th className='px-4 py-3 text-center'>{t('All appts')}</th>
                      <th className='px-4 py-3 text-center'>{t('Rate')}</th>
                      <th className='px-4 py-3'>{t('Pay model')}</th>
                      <th className='px-4 py-3 text-right'>{t('Doctor earns (est.)')}</th>
                      <th className='px-5 py-3 text-right sm:px-6'>{t('Clinic after %')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className='px-6 py-14 text-center text-slate-500'>
                          {t('No rows for this filter.')}
                        </td>
                      </tr>
                    ) : (
                      displayRows.map((r, idx) => {
                        const rowComp = describeCompensationAttribution(r.paidRevenue, r.financialCompensation, {
                          paidVisitCount: r.paidVisitCount,
                          t
                        })
                        return (
                        <tr
                          key={r.docId}
                          className={`border-b border-slate-100 transition hover:bg-indigo-50/40 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                        >
                          <td className='px-5 py-3 sm:px-6'>
                            <div className='font-bold text-slate-900'>{r.doctorName}</div>
                            <div className='text-xs text-slate-500'>{r.email || '—'}</div>
                          </td>
                          <td className='px-4 py-3 text-slate-600'>{r.speciality ? t(r.speciality) : '—'}</td>
                          <td className='px-4 py-3 text-right font-bold text-emerald-800'>{formatMoney(r.paidRevenue)}</td>
                          <td className='px-4 py-3 text-right font-medium text-amber-800'>{formatMoney(r.outstandingAmount)}</td>
                          <td className='px-4 py-3 text-center font-semibold text-slate-800'>{r.paidVisitCount ?? 0}</td>
                          <td className='px-4 py-3 text-center text-slate-600'>{r.totalAppointments}</td>
                          <td className='px-4 py-3 text-center align-middle'>
                            {r.isFixedMonthly ? (
                              <div>
                                <span className='inline-flex rounded-lg bg-violet-100 px-2 py-0.5 text-xs font-black text-violet-900'>
                                  {t('Fixed')}
                                </span>
                                <p className='mt-1 text-[11px] font-semibold text-violet-800'>{formatMoney(r.doctorAttributed)}/mo</p>
                              </div>
                            ) : r.isHybrid ? (
                              <div className='flex flex-col items-center gap-1'>
                                <span className='inline-flex rounded-lg bg-fuchsia-100 px-2 py-0.5 text-[10px] font-black uppercase text-fuchsia-900'>
                                  {t('Hybrid')}
                                </span>
                                {(r.percentageApplied ?? 0) > 0 ? (
                                  <span className='text-lg font-black tabular-nums text-indigo-800'>{r.percentageApplied}%</span>
                                ) : null}
                                {(r.fixedMonthlyPart || 0) > 0 ? (
                                  <span className='text-[11px] font-bold text-fuchsia-900'>+ {formatMoney(r.fixedMonthlyPart)}/mo</span>
                                ) : null}
                                {(r.percentageApplied ?? 0) <= 0 && (r.fixedMonthlyPart || 0) <= 0 ? (
                                  <span className='text-xs text-slate-400'>{t('Not set')}</span>
                                ) : null}
                              </div>
                            ) : r.percentageApplied != null && r.percentageApplied > 0 ? (
                              <span className='text-lg font-black tabular-nums text-indigo-800'>{r.percentageApplied}%</span>
                            ) : (
                              <span className='text-slate-400'>—</span>
                            )}
                          </td>
                          <td className='max-w-[220px] px-4 py-3'>
                            <span className='inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-800'>
                              {rowComp.label}
                            </span>
                            <p className='mt-1 text-[11px] leading-snug text-slate-500'>{rowComp.detail}</p>
                          </td>
                          <td className='px-4 py-3 text-right text-base font-black text-indigo-900'>
                            {r.isFixedMonthly ? `${formatMoney(r.doctorAttributed)}/mo` : formatMoney(r.doctorAttributed)}
                          </td>
                          <td className='px-5 py-3 text-right text-slate-600 sm:px-6'>
                            {r.clinicAttributed == null ? '—' : formatMoney(r.clinicAttributed)}
                          </td>
                        </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

export default AdminFinancialAnalytics
