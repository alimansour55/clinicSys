import React from 'react'
import { render } from '@testing-library/react'
import { LanguageProvider } from '../i18n'

export function renderWithLanguage(ui, options = {}) {
  return render(<LanguageProvider>{ui}</LanguageProvider>, options)
}
