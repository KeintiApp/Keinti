import * as isoCountries from 'i18n-iso-countries';
import type { Alpha2Code, LocaleData } from 'i18n-iso-countries';
import { COUNTRIES } from '../constants/countries';
import type { Language } from './translations';

const localeEs = require('i18n-iso-countries/langs/es.json') as LocaleData;
const localeEn = require('i18n-iso-countries/langs/en.json') as LocaleData;
const localeFr = require('i18n-iso-countries/langs/fr.json') as LocaleData;
const localePt = require('i18n-iso-countries/langs/pt.json') as LocaleData;
const localeDe = require('i18n-iso-countries/langs/de.json') as LocaleData;
const localeIt = require('i18n-iso-countries/langs/it.json') as LocaleData;

[
  localeEs,
  localeEn,
  localeFr,
  localePt,
  localeDe,
  localeIt,
].forEach((localeData) => {
  isoCountries.registerLocale(localeData);
});

const COUNTRY_LANGUAGE_BY_APP_LANGUAGE: Record<Language, string> = {
  es: 'es',
  en: 'en',
  fr: 'fr',
  pt: 'pt',
  de: 'de',
  it: 'it',
};

const COUNTRY_CODE_OVERRIDES: Partial<Record<string, Alpha2Code>> = {
  'Bangladés': 'BD',
  'Baréin': 'BH',
  'Benín': 'BJ',
  'Birmania': 'MM',
  'Botsuana': 'BW',
  'Brunéi': 'BN',
  'Ciudad del Vaticano': 'VA',
  'Corea del Norte': 'KP',
  'Corea del Sur': 'KR',
  'Fiyi': 'FJ',
  'Guinea-Bisáu': 'GW',
  'Irak': 'IQ',
  'Laos': 'LA',
  'Palaos': 'PW',
  'Papúa Nueva Guinea': 'PG',
  'República del Congo': 'CG',
  'República Democrática del Congo': 'CD',
  'San Cristóbal y Nieves': 'KN',
  'Siria': 'SY',
  'Suazilandia': 'SZ',
  'Surinam': 'SR',
  'Timor Oriental': 'TL',
};

const LOOKUP_LANGUAGES = ['es', 'en', 'fr', 'pt', 'de', 'it'] as const;

const normalizeCountryValue = (value?: string | null) => String(value || '').trim();

const normalizeSearchText = (value?: string | null) => (
  normalizeCountryValue(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
);

const resolveNationalityCode = (value?: string | null): Alpha2Code | undefined => {
  const cleaned = normalizeCountryValue(value);
  if (!cleaned) {return undefined;}

  const overriddenCode = COUNTRY_CODE_OVERRIDES[cleaned];
  if (overriddenCode) {return overriddenCode;}

  for (const language of LOOKUP_LANGUAGES) {
    const code = isoCountries.getAlpha2Code(cleaned, language);
    if (code) {return code as Alpha2Code;}
  }

  return undefined;
};

export type LocalizedNationalityOption = {
  value: string;
  label: string;
};

export const getLocalizedNationalityName = (value: string, language: Language): string => {
  const cleaned = normalizeCountryValue(value);
  if (!cleaned) {return '';}

  const countryCode = resolveNationalityCode(cleaned);
  if (!countryCode) {return cleaned;}

  const localized = isoCountries.getName(countryCode, COUNTRY_LANGUAGE_BY_APP_LANGUAGE[language]);
  return typeof localized === 'string' && localized.trim() ? localized.trim() : cleaned;
};

export const getLocalizedNationalityOptions = (
  language: Language,
  searchQuery = '',
): LocalizedNationalityOption[] => {
  const normalizedQuery = normalizeSearchText(searchQuery);

  return COUNTRIES
    .map((value) => {
      const label = getLocalizedNationalityName(value, language);
      return {
        value,
        label,
        searchText: normalizeSearchText(`${label} ${value}`),
      };
    })
    .filter((option) => !normalizedQuery || option.searchText.includes(normalizedQuery))
    .map(({ value, label }) => ({ value, label }));
};
