/**
 * Fixed, layout-safe logo sizing (no admin width/height). Logos scale inside these bounds only.
 * Tweak these strings if the brand mark needs a different footprint.
 */

/** Patient main header — large mark without stretching the bar (flex-safe). */
export const patientHeaderLogoClassName =
  'brand-logo h-9 w-auto max-h-9 max-w-[min(9rem,38vw)] shrink-0 object-contain object-left rtl:object-right sm:h-11 sm:max-h-11 sm:max-w-[min(18rem,40vw)]'

/** Mobile drawer top bar */
export const patientDrawerLogoClassName =
  'brand-logo h-9 w-auto max-h-9 max-w-[13rem] shrink-0 cursor-pointer object-contain object-left rtl:object-right'

/** Footer — slightly larger than header */
export const patientFooterLogoClassName =
  'brand-logo mb-4 h-12 w-auto max-h-12 max-w-[min(20rem,90vw)] shrink-0 cursor-pointer object-contain object-left rtl:object-right sm:mb-5 sm:h-14 sm:max-h-14'

/** Staff portal navbar (under ~4.5rem bar) */
export const staffHeaderLogoClassName =
  'brand-logo h-9 w-auto max-h-9 max-w-[11rem] shrink-0 object-contain object-left rtl:object-right sm:h-10 sm:max-h-10 sm:max-w-[13rem]'

/** Staff login card */
export const staffLoginLogoClassName =
  'brand-logo mx-auto h-12 w-auto max-h-14 max-w-[min(18rem,88vw)] object-contain'
