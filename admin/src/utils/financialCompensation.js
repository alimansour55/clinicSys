/** Mirrors backend/services/financialCompensationService.js for UI display. */



export const normalizeFinancialCompensation = (input = {}) => {

  const source = typeof input === 'string'

    ? (() => { try { return JSON.parse(input) } catch { return {} } })()

    : (input && typeof input === 'object' ? input : {})



  const raw = String(source.mode || '').toLowerCase()

  const mode = raw === 'fixed' ? 'fixed' : raw === 'hybrid' ? 'hybrid' : 'percentage'

  const percentage = Math.min(100, Math.max(0, Number.isFinite(Number(source.percentage)) ? Number(source.percentage) : 0))

  const fixedSalary = Math.max(0, Number.isFinite(Number(source.fixedSalary)) ? Number(source.fixedSalary) : 0)

  const percentageEnabled = Boolean(source.percentageEnabled) || percentage > 0



  return { mode, percentageEnabled, percentage, fixedSalary }

}



const visitCountPhrase = (n) => {

  const v = Math.max(0, Math.floor(Number(n)))

  if (!Number.isFinite(v)) return ''

  if (v <= 0) return ''

  return ` across ${v} paid patient visit${v === 1 ? '' : 's'}`

}



export const describeCompensationAttribution = (paidRevenue, compensation, options = {}) => {

  const c = normalizeFinancialCompensation(compensation)

  const revenue = Math.max(0, Number(paidRevenue || 0))

  const paidVisitCount = Number(options.paidVisitCount)

  const visitsOk = Number.isFinite(paidVisitCount) && paidVisitCount >= 0

  const visitSuffix = visitsOk ? visitCountPhrase(paidVisitCount) : ''



  const emptyHybrid = {

    label: 'Hybrid compensation (not set)',

    doctorAttributed: 0,

    clinicAttributed: revenue,

    isFixedMonthly: false,

    isHybrid: true,

    revenueSharePart: 0,

    fixedMonthlyPart: 0,

    percentageApplied: null,

    detail: `Set a revenue share % and/or a fixed monthly amount under Financial analytics → Pay doctor (hybrid).${visitsOk ? ` Currently ${paidVisitCount} paid visit${paidVisitCount === 1 ? '' : 's'} in this view.` : ''}`

  }



  if (c.mode === 'fixed') {

    const amount = c.fixedSalary

    return {

      label: amount > 0 ? 'Fixed monthly salary' : 'Fixed salary (not set)',

      doctorAttributed: amount,

      clinicAttributed: null,

      isFixedMonthly: true,

      isHybrid: false,

      revenueSharePart: 0,

      fixedMonthlyPart: amount,

      percentageApplied: null,

      detail:

        amount > 0

          ? `Monthly amount set by admin (${amount.toLocaleString()}). The doctor sees this fixed pay on their financial page; it is separate from per-visit revenue totals.`

          : 'Admin can set a fixed monthly amount under Financial analytics → Pay doctor, or in Doctors → Edit profile.'

    }

  }



  if (c.mode === 'hybrid') {

    const pctShare = c.percentage > 0 ? Math.round((revenue * c.percentage) / 100) : 0

    const fixAmt = c.fixedSalary > 0 ? c.fixedSalary : 0

    if (c.percentage <= 0 && fixAmt <= 0) {

      return emptyHybrid

    }

    const doctorAttributed = pctShare + fixAmt

    const labelParts = []

    if (c.percentage > 0) labelParts.push(`${c.percentage}% of paid visit revenue`)

    if (fixAmt > 0) labelParts.push(`${fixAmt.toLocaleString()}/month fixed`)

    const detailParts = []

    if (c.percentage > 0) {

      detailParts.push(

        `${c.percentage}% of paid visit revenue${visitSuffix} ≈ ${pctShare.toLocaleString()} from this view’s paid revenue.`

      )

    }

    if (fixAmt > 0) {

      detailParts.push(`Plus a fixed ${fixAmt.toLocaleString()} per month (guaranteed).`)

    }

    return {

      label: labelParts.join(' + ') || 'Hybrid compensation',

      doctorAttributed,

      clinicAttributed: Math.max(0, revenue - pctShare),

      isFixedMonthly: false,

      isHybrid: true,

      revenueSharePart: pctShare,

      fixedMonthlyPart: fixAmt,

      percentageApplied: c.percentage > 0 ? c.percentage : null,

      detail: detailParts.join(' ')

    }

  }



  if (c.percentage <= 0) {

    return {

      label: 'Percentage not set',

      doctorAttributed: 0,

      clinicAttributed: revenue,

      isFixedMonthly: false,

      isHybrid: false,

      revenueSharePart: 0,

      fixedMonthlyPart: 0,

      percentageApplied: null,

      detail: `Set a percentage (1–100) of revenue from paid patient visits${visitsOk ? ` (currently ${paidVisitCount} paid visit${paidVisitCount === 1 ? '' : 's'})` : ''} under Financial analytics → Pay doctor.`

    }

  }



  const doctorAttributed = Math.round((revenue * c.percentage) / 100)

  return {

    label: `${c.percentage}% of paid visit revenue`,

    doctorAttributed,

    clinicAttributed: Math.max(0, revenue - doctorAttributed),

    isFixedMonthly: false,

    isHybrid: false,

    revenueSharePart: doctorAttributed,

    fixedMonthlyPart: 0,

    percentageApplied: c.percentage,

    detail: `Admin assigned ${c.percentage}% of money collected from paid patient visits${visitSuffix}. Estimated share = ${c.percentage}% × paid revenue in this view.`

  }

}


