import { createContext, useContext } from 'react'
import { zh } from './zh'
import { en } from './en'

export type Locale = 'zh' | 'en'
export type TranslationMap = { [K in keyof typeof zh]: string }

const translations: Record<Locale, TranslationMap> = { zh, en }

export interface LocaleContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  t: TranslationMap
}

export const LocaleContext = createContext<LocaleContextValue>({
  locale: 'zh',
  setLocale: () => {},
  t: zh,
})

export function useLocale() {
  return useContext(LocaleContext)
}

export function getTranslations(locale: Locale): TranslationMap {
  return translations[locale]
}

export function getStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem('aida-locale')
    if (stored === 'en' || stored === 'zh') return stored
  } catch {}
  return 'zh'
}

export function storeLocale(locale: Locale): void {
  try {
    localStorage.setItem('aida-locale', locale)
  } catch {}
}
