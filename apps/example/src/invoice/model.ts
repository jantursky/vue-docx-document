export type Currency = 'EUR' | 'CZK' | 'USD' | 'GBP'
export type Language = 'en' | 'sk'
export type PaymentMethod = 'transfer' | 'card' | 'cash'

export interface Party {
  name: string
  street: string
  postalCode: string
  city: string
  country: string
  /** Company registration number (IČO). */
  companyId: string
  /** Tax ID (DIČ). */
  taxId: string
  /** VAT ID (IČ DPH). */
  vatId: string
  email: string
  phone: string
}

export interface LineItem {
  id: number
  description: string
  quantity: number
  unit: string
  unitPrice: number
  /** Percent off the line, 0–100. */
  discount: number
  /** VAT rate in percent. */
  vatRate: number
}

export interface Invoice {
  number: string
  orderNumber: string
  issueDate: string
  deliveryDate: string
  dueDate: string
  currency: Currency
  language: Language
  seller: Party
  buyer: Party
  payment: {
    method: PaymentMethod
    bankName: string
    iban: string
    bic: string
    variableSymbol: string
    /** Print an EPC (SEPA) payment QR code. Only for EUR transfers with an IBAN. */
    qr: boolean
  }
  vatPayer: boolean
  reverseCharge: boolean
  items: LineItem[]
  notes: string
  issuedBy: string
  accent: string
  /** A PNG or JPEG data URI. */
  logo: string | null
}

const emptyParty = (): Party => ({
  name: '',
  street: '',
  postalCode: '',
  city: '',
  country: '',
  companyId: '',
  taxId: '',
  vatId: '',
  email: '',
  phone: '',
})

const isoDate = (date: Date) => date.toISOString().slice(0, 10)
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000)

export const sampleInvoice = (today = new Date()): Invoice => ({
  number: `${today.getFullYear()}0042`,
  orderNumber: 'PO-7781',
  issueDate: isoDate(today),
  deliveryDate: isoDate(today),
  dueDate: isoDate(addDays(today, 14)),
  currency: 'EUR',
  language: 'en',
  seller: {
    name: 'Apptiary s.r.o.',
    street: 'Hlavná 12',
    postalCode: '811 01',
    city: 'Bratislava',
    country: 'Slovakia',
    companyId: '12345678',
    taxId: '2020123456',
    vatId: 'SK2020123456',
    email: 'billing@apptiary.example',
    phone: '+421 900 123 456',
  },
  buyer: {
    name: 'Northwind Traders GmbH',
    street: 'Friedrichstraße 68',
    postalCode: '10117',
    city: 'Berlin',
    country: 'Germany',
    companyId: 'HRB 123456',
    taxId: '',
    vatId: 'DE123456789',
    email: 'ap@northwind.example',
    phone: '',
  },
  payment: {
    method: 'transfer',
    bankName: 'Tatra banka, a.s.',
    iban: 'SK31 1100 0000 0026 1234 5678',
    bic: 'TATRSKBX',
    variableSymbol: `${today.getFullYear()}0042`,
    qr: true,
  },
  vatPayer: true,
  reverseCharge: false,
  items: [
    { id: 1, description: 'Discovery workshop', quantity: 1, unit: 'day', unitPrice: 900, discount: 0, vatRate: 23 },
    {
      id: 2,
      description: 'Vue 3 front-end development',
      quantity: 64,
      unit: 'h',
      unitPrice: 75,
      discount: 0,
      vatRate: 23,
    },
    {
      id: 3,
      description: 'Document export module',
      quantity: 1,
      unit: 'pc',
      unitPrice: 1800,
      discount: 10,
      vatRate: 23,
    },
    {
      id: 4,
      description: 'Technical book: Vue in Practice',
      quantity: 2,
      unit: 'pc',
      unitPrice: 39.9,
      discount: 0,
      vatRate: 5,
    },
  ],
  notes: 'Thank you for your business. Please quote the invoice number with your payment.',
  issuedBy: 'Ján Novák',
  accent: '#1f4e79',
  logo: null,
})

export const blankInvoice = (today = new Date()): Invoice => ({
  ...sampleInvoice(today),
  orderNumber: '',
  seller: emptyParty(),
  buyer: emptyParty(),
  payment: { method: 'transfer', bankName: '', iban: '', bic: '', variableSymbol: '', qr: false },
  items: [],
  notes: '',
  issuedBy: '',
  logo: null,
})

type Raw = Record<string, unknown>

const isRaw = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value)

const CURRENCIES: readonly Currency[] = ['EUR', 'CZK', 'USD', 'GBP']
const LANGUAGES: readonly Language[] = ['en', 'sk']
const METHODS: readonly PaymentMethod[] = ['transfer', 'card', 'cash']

const isIsoDate = (value: string) =>
  value === '' || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)))

/** Reads `source[key]`: the fallback when the key is missing, `undefined` when the value is wrong. */
const field = <T>(source: Raw, key: string, fallback: T, valid: (value: unknown) => value is T): T | undefined => {
  if (!(key in source) || source[key] === undefined) return fallback
  return valid(source[key]) ? source[key] : undefined
}

const isString = (value: unknown): value is string => typeof value === 'string'
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'
const isNumber =
  (min: number, max = Infinity) =>
  (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
const isOneOf =
  <T extends string>(options: readonly T[]) =>
  (value: unknown): value is T =>
    typeof value === 'string' && options.includes(value as T)

/** Reads every key of `fallback` from `source`, or `undefined` when one is wrong. */
const record = <T extends object>(
  source: unknown,
  fallback: T,
  valid: { [K in keyof T]: (value: unknown) => value is T[K] },
  /** Every key must be present, with no fallbacks. */
  complete = false,
): T | undefined => {
  if (!isRaw(source)) return undefined
  if (complete && !Object.keys(fallback).every((key) => key in source)) return undefined
  const result: Partial<T> = {}
  for (const key of Object.keys(fallback) as (keyof T & string)[]) {
    const value = field(source, key, fallback[key], valid[key])
    if (value === undefined) return undefined
    result[key] = value
  }
  return result as T
}

const isDate = (value: unknown): value is string => typeof value === 'string' && isIsoDate(value)
const isLogo = (value: unknown): value is string | null =>
  value === null || (typeof value === 'string' && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value))
const isAccent = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)

const strings = <T extends object>(sample: T) =>
  Object.fromEntries(Object.keys(sample).map((key) => [key, isString])) as {
    [K in keyof T]: (value: unknown) => value is T[K]
  }

/**
 * Turns a parsed JSON value into an invoice, or `null` when any field has the wrong type or a
 * value the renderer can't handle. Missing optional fields take the blank invoice's values and
 * unknown keys are dropped, so nothing from an old draft or a foreign file leaks in.
 */
export const parseInvoice = (value: unknown): Invoice | null => {
  if (!isRaw(value)) return null
  const blank = blankInvoice()
  if (!isString(value.number) || !isRaw(value.seller) || !isRaw(value.buyer) || !isRaw(value.payment)) return null
  if (!Array.isArray(value.items)) return null

  const seller = record(value.seller, emptyParty(), strings(emptyParty()))
  const buyer = record(value.buyer, emptyParty(), strings(emptyParty()))
  const payment = record(value.payment, blank.payment, {
    method: isOneOf(METHODS),
    bankName: isString,
    iban: isString,
    bic: isString,
    variableSymbol: isString,
    qr: isBoolean,
  })
  const items = (value.items as unknown[]).map((item) =>
    record(
      item,
      { id: 0, description: '', quantity: 1, unit: '', unitPrice: 0, discount: 0, vatRate: 0 },
      {
        id: isNumber(0),
        description: isString,
        quantity: isNumber(0),
        unit: isString,
        unitPrice: isNumber(0),
        discount: isNumber(0, 100),
        vatRate: isNumber(0, 100),
      },
      true,
    ),
  )
  const { seller: _seller, buyer: _buyer, payment: _payment, items: _items, ...scalars } = blank
  const top = record(value, scalars, {
    number: isString,
    orderNumber: isString,
    issueDate: isDate,
    deliveryDate: isDate,
    dueDate: isDate,
    currency: isOneOf(CURRENCIES),
    language: isOneOf(LANGUAGES),
    vatPayer: isBoolean,
    reverseCharge: isBoolean,
    notes: isString,
    issuedBy: isString,
    accent: isAccent,
    logo: isLogo,
  })
  if (!top || !seller || !buyer || !payment || items.some((item) => !item)) return null
  return { ...top, seller, buyer, payment, items: items as LineItem[] }
}

/** The props of the invoice template, which both formats render. */
export interface InvoiceDocumentProps {
  invoice: Invoice
  /** The payment QR code as a PNG data URI, drawn by the caller because layout can't wait for a promise. */
  qr: string | null
}
