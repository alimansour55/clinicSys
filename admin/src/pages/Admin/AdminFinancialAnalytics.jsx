import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calculator,
  Layers,
  LineChart,
  Percent,
  PiggyBank,
  RefreshCw,
  Save,
  Sparkles,
  Users,
  Wallet
} from 'lucide-react'
import { AdminContext } from '../../context/AdminContext'
import { AppContext } from '../../context/AppContext'
import { useLanguage } from '../../i18n'
import { AdminPage, ExportButton, StatCard } from '../../components/admin/AdminPage'
import { Badge, Button, EmptyState, Field, Input, Select, Skeleton, SkeletonGroup, notify } from '../../components/ui'
import { downloadCsv } from '../../utils/csvExport'
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

/** Typing replaces the value rather than appending to the 0 already there. */
const selectOnFocus = (e) => e.target.select()

const numberFrom = (raw) => {
  const n = raw === '' ? 0 : Number(raw)
  return Number.isFinite(n) ? n : 0
}

const ShareControl = ({ value, onChange, note }) => {
  const { t } = useLanguage()
  const safe = Number.isFinite(value) ? value : 0
  return (
    <div className='space-y-3'>
      <Field label={t('Revenue share (0–100%)')}>
        <Input
          type='number'
          min={0}
          max={100}
          step={1}
          inputMode='numeric'
          value={safe}
          onFocus={selectOnFocus}
          onChange={(e) => onChange(Math.min(100, Math.max(0, numberFrom(e.target.value))))}
          className='max-w-32 font-semibold tabular-nums'
        />
      </Field>
      <input
        type='range'
        min={0}
        max={100}
        value={safe}
        aria-label={t('Revenue share (0–100%)')}
        onChange={(e) => onChange(Number(e.target.value))}
        className='h-6 w-full cursor-pointer accent-(--color-primary)'
      />
      <p className='text-caption text-ink-3'>{note}</p>
    </div>
  )
}

const FixedControl = ({ value, onChange, label, note }) => (
  <Field label={label} hint={note}>
    <Input
      type='number'
      min={0}
      inputMode='numeric'
      value={Number.isFinite(value) ? value : 0}
      onFocus={selectOnFocus}
      onChange={(e) => onChange(Math.max(0, numberFrom(e.target.value)))}
      className='max-w-xs font-semibold tabular-nums'
    />
  </Field>
)

const AdminFinancialAnalytics = () => {
  const { aToken, backendUrl, doctors, getAllDoctors } = useContext(AdminContext)
  const { currency } = useContext(AppContext)
  const { t, tc, language } = useLanguage()
  const [loading, setLoading] = useState(Boolean(aToken))
  const [loadError, setLoadError] = useState(null)

  const locale = language === 'ar' ? 'ar-EG' : 'en-US'

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

  /* Holds no translated text, so switching language does not fetch again */
  const load = useCallback(async () => {
    if (!aToken) return
    setLoading(true)
    try {
      const { data } = await axios.get(`${backendUrl}/api/admin/financial-analytics`, {
        headers: { aToken }
      })
      if (data.success) {
        setPayload(data)
        setLoadError(null)
      } else {
        setLoadError({ message: data.message })
      }
    } catch (e) {
      setLoadError({ message: e.response?.data?.message })
    } finally {
      setLoading(false)
    }
  }, [aToken, backendUrl])

  /* getAllDoctors is a new function on every provider render, and calling it re-renders the provider */
  const getAllDoctorsRef = useRef(getAllDoctors)
  useEffect(() => {
    getAllDoctorsRef.current = getAllDoctors
  })

  useEffect(() => {
    if (aToken) getAllDoctorsRef.current()
  }, [aToken])

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

  const doctorById = useMemo(() => new Map((doctors || []).map((d) => [String(d._id), d])), [doctors])

  /* The analytics rows may not carry i18n, so the doctors list fills in the other language */
  const rowName = useCallback(
    (r) => {
      const name = tc(r.i18n?.name) || tc(doctorById.get(String(r.docId))?.i18n?.name) || r.doctorName
      return !name || name === 'Unknown doctor' ? t('Unknown doctor') : name
    },
    [doctorById, t, tc]
  )
  const rowSpeciality = (r) =>
    tc(r.i18n?.speciality) || tc(doctorById.get(String(r.docId))?.i18n?.speciality) || (r.speciality ? t(r.speciality) : '')

  const doctorOptions = useMemo(
    () =>
      (doctors || [])
        .map((d) => ({ id: String(d._id), name: tc(d.i18n?.name) || d.name || t('Doctor') }))
        .sort((a, b) => a.name.localeCompare(b.name, locale)),
    [doctors, locale, t, tc]
  )

  /* A removed doctor still has revenue in the table, so the filter has to reach them too */
  const tableOptions = useMemo(() => {
    const known = new Set(doctorOptions.map((d) => d.id))
    const extra = allRows
      .filter((r) => r.docId && !known.has(String(r.docId)))
      .map((r) => ({ id: String(r.docId), name: rowName(r) }))
    return [...doctorOptions, ...extra].sort((a, b) => a.name.localeCompare(b.name, locale))
  }, [allRows, doctorOptions, locale, rowName])

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

  const formatNumber = (n) => Number(n ?? 0).toLocaleString(locale, { maximumFractionDigits: 0 })
  const formatMoney = (n) => `${currency}${formatNumber(n)}`
  const perMonth = (n) => fillT('{{amount}} / month', { amount: formatMoney(n) })

  const saveDoctorPay = async () => {
    if (!doctorOptions.length) {
      notify.warning(t('No doctors in the system'))
      return
    }
    if (!payDocId) {
      notify.warning(t('Choose a doctor'))
      return
    }
    const pct = Math.min(100, Math.max(0, Math.round(Number(payPercentage)) || 0))
    const fix = Math.max(0, Math.round(Number(payFixed)) || 0)
    if (payMode === 'hybrid' && pct <= 0 && fix <= 0) {
      notify.warning(t('Hybrid pay needs a percentage above 0 and/or a fixed monthly amount'))
      return
    }
    setSavingPay(true)
    try {
      let compPayload
      if (payMode === 'fixed') {
        compPayload = { mode: 'fixed', percentage: 0, fixedSalary: fix, percentageEnabled: false }
      } else if (payMode === 'hybrid') {
        compPayload = { mode: 'hybrid', percentage: pct, fixedSalary: fix, percentageEnabled: pct > 0 }
      } else {
        compPayload = { mode: 'percentage', percentage: pct, fixedSalary: 0, percentageEnabled: pct > 0 }
      }
      const saved = normalizeFinancialCompensation(compPayload)
      const formData = new FormData()
      formData.append('docId', payDocId)
      formData.append('financialCompensation', JSON.stringify(saved))
      const { data } = await axios.post(`${backendUrl}/api/admin/update-doctor`, formData, {
        headers: { aToken }
      })
      if (!data.success) {
        notify.error(data.message ? t(data.message) : t('Save failed'))
        return
      }
      /* The form now shows what was stored, including the rounding above */
      setPayPercentage(saved.percentage)
      setPayFixed(saved.fixedSalary)
      notify.success(t('Pay settings saved'))
      await getAllDoctors()
      await load()
    } catch (e) {
      notify.error(e.response?.data?.message ? t(e.response.data.message) : t('Save failed'))
    } finally {
      setSavingPay(false)
    }
  }

  const estClinicRetains = Math.max(0, (totals.paidRevenue || 0) - (totals.revenueShareToDoctors || 0))

  const exportBreakdown = () => {
    downloadCsv(
      'financial-breakdown',
      [
        { label: t('Doctor'), value: rowName },
        { label: t('Email'), value: (r) => r.email },
        { label: t('Speciality'), value: rowSpeciality },
        { label: t('Paid revenue'), value: (r) => Number(r.paidRevenue || 0) },
        { label: t('Outstanding'), value: (r) => Number(r.outstandingAmount || 0) },
        { label: t('Paid visits'), value: (r) => Number(r.paidVisitCount || 0) },
        { label: t('All appts'), value: (r) => Number(r.totalAppointments || 0) },
        { label: t('Revenue share %'), value: (r) => r.percentageApplied ?? '' },
        { label: t('Fixed / month'), value: (r) => Number(r.fixedMonthlyPart || 0) },
        {
          label: t('Pay model'),
          value: (r) =>
            describeCompensationAttribution(r.paidRevenue, r.financialCompensation, { paidVisitCount: r.paidVisitCount, t }).label
        },
        { label: t('Doctor earns (est.)'), value: (r) => Number(r.doctorAttributed || 0) },
        { label: t('Clinic after %'), value: (r) => (r.clinicAttributed == null ? '' : Number(r.clinicAttributed)) }
      ],
      displayRows
    )
  }

  const payModes = [
    { value: 'percentage', icon: <Percent aria-hidden='true' className='size-4 shrink-0 text-brand' />, title: t('% of paid visit revenue'), body: t('Doctor earns a share of money from visits marked paid.') },
    { value: 'fixed', icon: <PiggyBank aria-hidden='true' className='size-4 shrink-0 text-brand' />, title: t('Fixed monthly'), body: t('Same amount each month, regardless of visit count.') },
    { value: 'hybrid', icon: <Layers aria-hidden='true' className='size-4 shrink-0 text-brand' />, title: t('% + fixed together'), body: t('Revenue share on paid visits plus a guaranteed monthly amount.') }
  ]

  const monthlyLabel = fillT('Monthly fixed amount ({{currency}})', { currency: currency.trim() })

  const rateCell = (r) => {
    if (r.isFixedMonthly) {
      return (
        <div className='flex flex-col items-center gap-1'>
          <Badge tone='info'>{t('Fixed')}</Badge>
          <span className='text-caption font-semibold text-ink-2'>{perMonth(r.doctorAttributed)}</span>
        </div>
      )
    }
    if (r.isHybrid) {
      const hasShare = (r.percentageApplied ?? 0) > 0
      const hasFixed = (r.fixedMonthlyPart || 0) > 0
      return (
        <div className='flex flex-col items-center gap-1'>
          <Badge tone='brand'>{t('Hybrid')}</Badge>
          {hasShare && <span className='font-bold tabular-nums text-brand'>{`${formatNumber(r.percentageApplied)}%`}</span>}
          {hasFixed && <span className='text-caption font-semibold text-ink-2'>{`+ ${perMonth(r.fixedMonthlyPart)}`}</span>}
          {!hasShare && !hasFixed && <span className='text-caption text-ink-3'>{t('Not set')}</span>}
        </div>
      )
    }
    if (r.percentageApplied != null && r.percentageApplied > 0) {
      return <span className='font-bold tabular-nums text-brand'>{`${formatNumber(r.percentageApplied)}%`}</span>
    }
    return <span className='text-ink-3'>—</span>
  }

  const earned = (r) => (r.isFixedMonthly ? perMonth(r.doctorAttributed) : formatMoney(r.doctorAttributed))
  const clinicAfter = (r) => (r.clinicAttributed == null ? '—' : formatMoney(r.clinicAttributed))
  const compensationFor = (r) =>
    describeCompensationAttribution(r.paidRevenue, r.financialCompensation, { paidVisitCount: r.paidVisitCount, t })

  const thClass = 'px-4 py-3 font-semibold'

  return (
    <AdminPage
      title={t('Financial analytics')}
      description={t('Financial analytics intro')}
      icon={BarChart3}
      actions={
        <>
          <ExportButton onExport={exportBreakdown} disabled={!displayRows.length} />
          <Button
            variant='secondary'
            size='sm'
            loading={loading}
            onClick={load}
            leadingIcon={<RefreshCw aria-hidden='true' className='size-4' />}
          >
            {t('Refresh')}
          </Button>
        </>
      }
    >
      {loading && !payload ? (
        <SkeletonGroup label={t('Loading analytics…')} className='grid grid-cols-2 gap-3 lg:grid-cols-3'>
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <Skeleton key={item} className='h-28 rounded-card!' />
          ))}
        </SkeletonGroup>
      ) : !payload ? (
        /* Without this a failed load showed zero revenue, as if that were the real figure */
        <div className='rounded-card border border-line bg-surface shadow-e1'>
          <EmptyState
            icon={<AlertCircle />}
            title={t('Failed to load analytics')}
            description={loadError?.message ? t(loadError.message) : t('Check your connection and try again.')}
            action={
              <Button variant='secondary' loading={loading} onClick={load}>
                {t('Try again')}
              </Button>
            }
          />
        </div>
      ) : (
        <div className='space-y-6'>
          {loadError && (
            <p role='alert' className='flex items-start gap-2 rounded-card bg-warning-soft p-4 text-body-sm text-warning-ink'>
              <AlertCircle aria-hidden='true' className='mt-0.5 size-4 shrink-0' />
              {t('Could not refresh. These figures are from the last successful load.')}
            </p>
          )}

          <Field label={t('Table filter')} className='w-full sm:max-w-xs'>
            <Select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              <option value=''>{t('All doctors')}</option>
              {tableOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>

          <section aria-label={t('Financial analytics')}>
            <div className='grid grid-cols-2 gap-3 lg:grid-cols-3'>
              <StatCard
                label={t('Paid revenue')}
                value={formatMoney(totals.paidRevenue)}
                hint={t('Paid / completed visits')}
                icon={ArrowUpRight}
                tone='text-success-ink rtl:-scale-x-100'
              />
              <StatCard
                label={t('Outstanding')}
                value={formatMoney(totals.outstandingAmount)}
                hint={t('Unpaid active visits')}
                icon={ArrowDownRight}
                tone='text-warning-ink rtl:-scale-x-100'
              />
              <StatCard
                label={t('Paid visits')}
                value={formatNumber(totals.paidVisitCount)}
                hint={t('Visits counted in paid revenue')}
                icon={Users}
                tone='text-ink-3'
              />
              <StatCard
                label={t('% share to doctors')}
                value={formatMoney(totals.revenueShareToDoctors)}
                hint={t('Share of paid visit revenue (% doctors)')}
                icon={Percent}
              />
              <StatCard
                label={t('Fixed / month')}
                value={formatMoney(totals.fixedMonthlySalarySum)}
                hint={t('Sum of monthly fixed')}
                icon={PiggyBank}
              />
              <StatCard
                label={t('Total doctor pay (est.)')}
                value={formatMoney(totals.totalDoctorCompensationEstimate)}
                hint={
                  <>
                    {t('% share + fixed salaries')}
                    <span className='mt-2 block border-t border-line pt-2'>
                      {`${t('Clinic from paid revenue (after % only):')} ${formatMoney(estClinicRetains)}`}
                    </span>
                  </>
                }
                icon={Wallet}
              />
            </div>
            <p className='mt-2 text-caption text-ink-3'>{t('Refunded visits are not counted in revenue or outstanding amounts.')}</p>
          </section>

          <section className='rounded-card rounded-se-signature border border-line bg-surface p-4 shadow-e1 sm:p-6'>
            <div className='grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]'>
              <div className='lg:border-e lg:border-line lg:pe-6'>
                <p className='mb-2 inline-flex items-center gap-2 text-caption font-semibold text-brand'>
                  <PiggyBank aria-hidden='true' className='size-4' />
                  {t('Pay doctor')}
                </p>
                <h2 className='text-title font-semibold text-ink'>{t('How this doctor is paid')}</h2>
                <p className='mt-2 text-body-sm text-ink-2'>{t('Pay doctor intro')}</p>
                <ul className='mt-4 space-y-2 text-caption text-ink-3'>
                  <li className='flex gap-2'>
                    <Percent aria-hidden='true' className='mt-0.5 size-4 shrink-0 text-brand' />
                    {t('Percent / hybrid share uses only paid / completed visit amounts, not unpaid bookings.')}
                  </li>
                  <li className='flex gap-2'>
                    <Users aria-hidden='true' className='mt-0.5 size-4 shrink-0 text-brand' />
                    {t('Preview always uses this doctor’s real paid visit count and revenue, even when the table is filtered.')}
                  </li>
                </ul>
              </div>

              <div className='flex min-w-0 flex-col gap-5'>
                <div className='grid gap-3 sm:grid-cols-3'>
                  <StatCard label={t('Paid visits')} value={formatNumber(previewPaidVisits)} hint={t('For selected doctor')} />
                  <StatCard label={t('Paid visit revenue')} value={formatMoney(previewRevenue)} hint={t('Basis for % mode')} />
                  <StatCard
                    label={t('Live estimate')}
                    value={formatMoney(previewAttr.doctorAttributed)}
                    hint={
                      payMode === 'fixed'
                        ? t('Per month')
                        : payMode === 'hybrid'
                          ? t('% share + fixed (combined)')
                          : t('From current %')
                    }
                  />
                </div>

                <Field label={t('Doctor')}>
                  <Select value={payDocId} onChange={(e) => setPayDocId(e.target.value)} disabled={!doctorOptions.length}>
                    {!doctorOptions.length ? (
                      <option value=''>{t('No doctors yet')}</option>
                    ) : (
                      doctorOptions.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))
                    )}
                  </Select>
                </Field>

                <div role='group' aria-label={t('Pay type')}>
                  <p aria-hidden='true' className='mb-1.5 text-body-sm font-medium text-ink'>{t('Pay type')}</p>
                  <div className='grid gap-3 sm:grid-cols-3'>
                    {payModes.map(({ value, icon, title, body }) => (
                      <button
                        key={value}
                        type='button'
                        aria-pressed={payMode === value}
                        onClick={() => setPayMode(value)}
                        className={`cursor-pointer rounded-card border-2 p-4 text-start transition duration-(--duration-fast) ease-standard ${
                          payMode === value ? 'border-primary bg-primary-soft' : 'border-line bg-surface hover:border-line-strong'
                        }`}
                      >
                        <span className='flex items-center gap-2 text-body-sm font-semibold text-ink'>
                          {icon}
                          {title}
                        </span>
                        <span className='mt-1 block text-caption text-ink-2'>{body}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {payMode === 'percentage' && (
                  <ShareControl value={payPercentage} onChange={setPayPercentage} note={t('of this doctor’s paid visit revenue (see table).')} />
                )}

                {payMode === 'fixed' && (
                  <FixedControl value={payFixed} onChange={setPayFixed} label={monthlyLabel} note={t('Shown to the doctor as their fixed monthly pay.')} />
                )}

                {payMode === 'hybrid' && (
                  <div className='space-y-5'>
                    <ShareControl value={payPercentage} onChange={setPayPercentage} note={t('of paid visit revenue (this view).')} />
                    <FixedControl value={payFixed} onChange={setPayFixed} label={monthlyLabel} note={t('Paid on top of the percentage share from visits.')} />
                  </div>
                )}

                <div className='flex flex-col gap-4 rounded-card bg-primary-soft p-4 sm:flex-row sm:items-center sm:justify-between'>
                  <div className='flex min-w-0 items-start gap-3'>
                    <Calculator aria-hidden='true' className='mt-0.5 size-5 shrink-0 text-brand' />
                    <div className='min-w-0'>
                      <p className='text-caption font-semibold text-brand'>{t('Doctor will see')}</p>
                      <p className='mt-1 break-words text-body-sm font-semibold text-ink'>
                        {formatMoney(previewAttr.doctorAttributed)}
                        {payMode === 'fixed' ? t(' / month') : ` · ${previewAttr.label}`}
                      </p>
                      <p className='mt-1 text-caption text-ink-2'>{previewAttr.detail}</p>
                    </div>
                  </div>
                  <Button
                    onClick={saveDoctorPay}
                    loading={savingPay}
                    disabled={!doctorOptions.length}
                    leadingIcon={<Save aria-hidden='true' className='size-4' />}
                  >
                    {savingPay ? t('Saving…') : t('Save pay settings')}
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <section className='overflow-hidden rounded-card border border-line bg-surface shadow-e1'>
            <div className='flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-5'>
              <div className='flex min-w-0 items-center gap-3'>
                <span aria-hidden='true' className='flex size-10 shrink-0 items-center justify-center rounded-control bg-primary-soft text-brand'>
                  <LineChart className='size-5' />
                </span>
                <div className='min-w-0'>
                  <h2 className='text-subtitle font-semibold text-ink'>{t('Doctor breakdown')}</h2>
                  <p className='text-caption text-ink-3'>
                    {fillT(displayRows.length === 1 ? '{{scope}} · {{rows}} row · {{appts}} appointments in view' : '{{scope}} · {{rows}} rows · {{appts}} appointments in view', {
                      scope: doctorId.trim() ? t('Filtered to one doctor') : t('All doctors'),
                      rows: formatNumber(displayRows.length),
                      appts: formatNumber(totals.totalAppointments)
                    })}
                  </p>
                </div>
              </div>
              <p className='flex items-center gap-2 text-caption text-ink-3'>
                <Sparkles aria-hidden='true' className='size-4 shrink-0 text-accent-ink' />
                {t('Full profile: Doctors → select doctor → Edit')}
              </p>
            </div>

            {displayRows.length === 0 ? (
              <p className='px-6 py-14 text-center text-body-sm text-ink-3'>{t('No rows for this filter.')}</p>
            ) : (
              <>
                {/* Phones and small tablets: one card per doctor, so nothing needs sideways scrolling */}
                <ul className='lg:hidden'>
                  {displayRows.map((r) => {
                    const comp = compensationFor(r)
                    const speciality = rowSpeciality(r)
                    return (
                      <li key={r.docId} className='border-b border-line p-4 last:border-b-0'>
                        <p className='break-words font-semibold text-ink'>{rowName(r)}</p>
                        {r.email && <p dir='ltr' className='break-all text-start text-caption text-ink-3 rtl:text-end'>{r.email}</p>}
                        {speciality && <p className='text-caption text-ink-3'>{speciality}</p>}
                        <dl className='mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-body-sm'>
                          <div>
                            <dt className='text-caption text-ink-3'>{t('Paid revenue')}</dt>
                            <dd className='font-semibold text-success-ink'>{formatMoney(r.paidRevenue)}</dd>
                          </div>
                          <div>
                            <dt className='text-caption text-ink-3'>{t('Outstanding')}</dt>
                            <dd className='font-medium text-warning-ink'>{formatMoney(r.outstandingAmount)}</dd>
                          </div>
                          <div>
                            <dt className='text-caption text-ink-3'>{t('Paid visits')}</dt>
                            <dd className='font-medium text-ink'>{formatNumber(r.paidVisitCount)}</dd>
                          </div>
                          <div>
                            <dt className='text-caption text-ink-3'>{t('All appts')}</dt>
                            <dd className='text-ink-2'>{formatNumber(r.totalAppointments)}</dd>
                          </div>
                          <div>
                            <dt className='text-caption text-ink-3'>{t('Doctor earns (est.)')}</dt>
                            <dd className='font-semibold text-brand'>{earned(r)}</dd>
                          </div>
                          <div>
                            <dt className='text-caption text-ink-3'>{t('Clinic after %')}</dt>
                            <dd className='text-ink-2'>{clinicAfter(r)}</dd>
                          </div>
                        </dl>
                        <div className='mt-3'>
                          <span className='text-caption font-semibold text-ink-2'>{comp.label}</span>
                          <p className='mt-0.5 text-caption text-ink-3'>{comp.detail}</p>
                        </div>
                      </li>
                    )
                  })}
                </ul>

                <div className='hidden overflow-x-auto lg:block'>
                  <table className='w-full min-w-[980px] text-body-sm'>
                    <thead>
                      <tr className='border-b border-line bg-surface-sunken text-caption text-ink-3'>
                        <th className={`${thClass} text-start`}>{t('Doctor')}</th>
                        <th className={`${thClass} text-start`}>{t('Speciality')}</th>
                        <th className={`${thClass} text-end`}>{t('Paid revenue')}</th>
                        <th className={`${thClass} text-end`}>{t('Outstanding')}</th>
                        <th className={`${thClass} text-center`}>{t('Paid visits')}</th>
                        <th className={`${thClass} text-center`}>{t('All appts')}</th>
                        <th className={`${thClass} text-center`}>{t('Rate')}</th>
                        <th className={`${thClass} text-start`}>{t('Pay model')}</th>
                        <th className={`${thClass} text-end`}>{t('Doctor earns (est.)')}</th>
                        <th className={`${thClass} text-end`}>{t('Clinic after %')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayRows.map((r) => {
                        const comp = compensationFor(r)
                        return (
                          <tr key={r.docId} className='border-b border-line transition last:border-b-0 hover:bg-primary-soft'>
                            <td className='px-4 py-3'>
                              <div className='font-semibold text-ink'>{rowName(r)}</div>
                              <div dir='ltr' className='text-start text-caption text-ink-3 rtl:text-end'>{r.email || '—'}</div>
                            </td>
                            <td className='px-4 py-3 text-ink-2'>{rowSpeciality(r) || '—'}</td>
                            <td className='px-4 py-3 text-end font-semibold text-success-ink'>{formatMoney(r.paidRevenue)}</td>
                            <td className='px-4 py-3 text-end font-medium text-warning-ink'>{formatMoney(r.outstandingAmount)}</td>
                            <td className='px-4 py-3 text-center font-medium text-ink'>{formatNumber(r.paidVisitCount)}</td>
                            <td className='px-4 py-3 text-center text-ink-2'>{formatNumber(r.totalAppointments)}</td>
                            <td className='px-4 py-3 text-center align-middle'>{rateCell(r)}</td>
                            <td className='max-w-[220px] px-4 py-3'>
                              <Badge className='whitespace-normal!'>{comp.label}</Badge>
                              <p className='mt-1 text-caption text-ink-3'>{comp.detail}</p>
                            </td>
                            <td className='px-4 py-3 text-end font-bold text-brand'>{earned(r)}</td>
                            <td className='px-4 py-3 text-end text-ink-2'>{clinicAfter(r)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </AdminPage>
  )
}

export default AdminFinancialAnalytics
