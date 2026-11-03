import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import BilingualField from './BilingualField'
import { renderWithLanguage } from '../test/renderWithLanguage'
import { bilingualFromRecord, bilingualIsEmpty, bilingualPayload, emptyBilingual } from '../utils/bilingualValue'

let latest

const Harness = ({ translate, initial = emptyBilingual() }) => {
  const [value, setValue] = useState(initial)
  latest = value
  return <BilingualField label='Name' value={value} onChange={setValue} translate={translate} />
}

const english = () => screen.getByLabelText('English')
const arabic = () => screen.getByLabelText('العربية')

const typeAndLeave = (input, text) => {
  fireEvent.change(input, { target: { value: text } })
  fireEvent.blur(input)
}

beforeEach(() => localStorage.clear())
afterEach(cleanup)

describe('BilingualField', () => {
  it('sets each side to its own direction', () => {
    renderWithLanguage(<Harness />)
    expect(english()).toHaveAttribute('dir', 'ltr')
    expect(arabic()).toHaveAttribute('dir', 'rtl')
  })

  it('fills Arabic after typing English', async () => {
    const translate = vi.fn(async () => 'عيادة')
    renderWithLanguage(<Harness translate={translate} />)
    typeAndLeave(english(), 'Clinic')
    await waitFor(() => expect(arabic()).toHaveValue('عيادة'))
    expect(translate).toHaveBeenCalledWith('Clinic', 'ar', 'text')
    expect(latest).toMatchObject({ source: 'en', manual: false })
    expect(screen.getByText('Translated automatically')).toBeInTheDocument()
  })

  it('fills English after typing Arabic', async () => {
    const translate = vi.fn(async () => 'Clinic')
    renderWithLanguage(<Harness translate={translate} />)
    typeAndLeave(arabic(), 'عيادة')
    await waitFor(() => expect(english()).toHaveValue('Clinic'))
    expect(translate).toHaveBeenCalledWith('عيادة', 'en', 'text')
    expect(latest.source).toBe('ar')
  })

  it('marks a correction as manual and keeps it on a later blur', async () => {
    const translate = vi.fn(async () => 'عيادة')
    renderWithLanguage(<Harness translate={translate} />)
    typeAndLeave(english(), 'Clinic')
    await waitFor(() => expect(arabic()).toHaveValue('عيادة'))

    typeAndLeave(arabic(), 'عيادتي')
    expect(latest).toMatchObject({ ar: 'عيادتي', source: 'en', manual: true })
    expect(screen.getByText('Corrected by hand')).toBeInTheDocument()

    fireEvent.blur(english())
    expect(translate).toHaveBeenCalledTimes(1)
    expect(arabic()).toHaveValue('عيادتي')
  })

  it('translates again when the source changes, even after a correction', async () => {
    const translate = vi.fn(async (text) => `ar:${text}`)
    renderWithLanguage(<Harness translate={translate} />)
    typeAndLeave(english(), 'Clinic')
    await waitFor(() => expect(arabic()).toHaveValue('ar:Clinic'))
    typeAndLeave(arabic(), 'عيادتي')
    typeAndLeave(english(), 'Pharmacy')
    await waitFor(() => expect(arabic()).toHaveValue('ar:Pharmacy'))
    expect(latest.manual).toBe(false)
  })

  it('does not let a slow answer overwrite a correction', async () => {
    let finish
    const translate = vi.fn(() => new Promise((resolve) => (finish = resolve)))
    renderWithLanguage(<Harness translate={translate} />)
    typeAndLeave(english(), 'Clinic')
    fireEvent.change(arabic(), { target: { value: 'عيادتي' } })
    finish('عيادة')
    await waitFor(() => expect(screen.queryByText('Translating…')).not.toBeInTheDocument())
    expect(arabic()).toHaveValue('عيادتي')
  })

  it('blanks an out-of-date translation and says it will finish after saving when no translator answers', async () => {
    const translate = vi.fn(async () => '')
    const initial = { en: 'Clinic', ar: 'عيادة', source: 'en', manual: false, status: 'complete' }
    renderWithLanguage(<Harness translate={translate} initial={initial} />)
    typeAndLeave(english(), 'Pharmacy')
    await waitFor(() => expect(arabic()).toHaveValue(''))
    expect(latest.status).toBe('pending')
    expect(screen.getByText('Will translate after saving')).toBeInTheDocument()
  })

  it('survives a translator error', async () => {
    const translate = vi.fn(async () => {
      throw new Error('down')
    })
    renderWithLanguage(<Harness translate={translate} />)
    typeAndLeave(english(), 'Clinic')
    await waitFor(() => expect(screen.getByText('Will translate after saving')).toBeInTheDocument())
    expect(english()).toHaveValue('Clinic')
  })

  it('retranslates on request, dropping a correction', async () => {
    const translate = vi.fn(async () => 'عيادة')
    const initial = { en: 'Clinic', ar: 'عيادتي', source: 'en', manual: true, status: 'complete' }
    renderWithLanguage(<Harness translate={translate} initial={initial} />)
    fireEvent.click(screen.getByRole('button', { name: 'Translate again' }))
    await waitFor(() => expect(arabic()).toHaveValue('عيادة'))
    expect(latest.manual).toBe(false)
  })

  it('makes no request when the field is left unchanged', () => {
    const translate = vi.fn(async () => '')
    const initial = { en: 'Clinic', ar: 'عيادة', source: 'en', manual: false, status: 'complete' }
    renderWithLanguage(<Harness translate={translate} initial={initial} />)
    fireEvent.blur(english())
    expect(translate).not.toHaveBeenCalled()
  })
})

describe('bilingualValue', () => {
  it('reads what the record stores', () => {
    const record = { name: 'Clinic', i18n: { name: { en: 'Clinic', ar: 'عيادة', source: 'en', manual: true, status: 'complete' } } }
    expect(bilingualFromRecord(record, 'name')).toMatchObject({ en: 'Clinic', ar: 'عيادة', manual: true })
  })

  it('falls back to the plain field, working out its language', () => {
    expect(bilingualFromRecord({ name: 'Clinic' }, 'name')).toMatchObject({ en: 'Clinic', ar: '', source: 'en' })
    expect(bilingualFromRecord({ name: 'عيادة' }, 'name')).toMatchObject({ en: '', ar: 'عيادة', source: 'ar' })
  })

  it('leaves the status out of the payload', () => {
    expect(bilingualPayload({ en: 'a', ar: 'b', source: 'en', manual: true, status: 'pending' })).toEqual({
      en: 'a',
      ar: 'b',
      source: 'en',
      manual: true,
    })
  })

  it('knows when nothing was entered', () => {
    expect(bilingualIsEmpty(emptyBilingual())).toBe(true)
    expect(bilingualIsEmpty({ en: ' ', ar: 'x' })).toBe(false)
  })
})
