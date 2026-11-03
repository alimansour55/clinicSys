import { describe, expect, it } from 'vitest'
import { liftFor } from './useLauncherClearance'

const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height })

describe('liftFor', () => {
  const viewport = 800
  /* Button resting at the bottom end corner in LTR: x 300–360, y 724–784. */
  const restLtr = box(300, 724, 60, 60)

  it('lifts the button above a bottom bar it would cover', () => {
    const bar = box(0, 720, 375, 80)
    expect(liftFor(restLtr, [bar], viewport)).toBe(784 - 720 + 12)
  })

  it('stays put when nothing is underneath', () => {
    expect(liftFor(restLtr, [box(0, 100, 375, 80)], viewport)).toBe(0)
    expect(liftFor(restLtr, [], viewport)).toBe(0)
  })

  it('works on the start side in RTL, where the button sits on the left', () => {
    const restRtl = box(12, 724, 60, 60)
    const saveOnRight = box(250, 740, 110, 44)
    const saveOnLeft = box(16, 740, 110, 44)
    expect(liftFor(restRtl, [saveOnRight], viewport)).toBe(0)
    expect(liftFor(restRtl, [saveOnLeft], viewport)).toBe(784 - 740 + 12)
  })

  it('ignores hidden elements and whole page sections', () => {
    expect(liftFor(restLtr, [box(300, 740, 0, 0)], viewport)).toBe(0)
    expect(liftFor(restLtr, [box(0, 300, 375, 500)], viewport)).toBe(0)
  })
})
