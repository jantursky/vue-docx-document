import { isBoolean, isDate, isNumber, isOneOf, isRaw, isString, record, strings } from '../validate'

export type Currency = 'EUR' | 'CZK' | 'USD' | 'GBP'
export type Language = 'en' | 'sk'
export type PaymentMethod = 'transfer' | 'card' | 'cash'

export interface Party {
  name: string
  street: string
  postalCode: string
  city: string
  country: string
  /** Company registration number. */
  companyId: string
  /** Tax ID. */
  taxId: string
  /** VAT ID. */
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
    name: 'Brightline Studio Ltd.',
    street: '14 Merrion Square',
    postalCode: 'D02 XY45',
    city: 'Dublin 2',
    country: 'Ireland',
    companyId: '582417',
    taxId: '6388047V',
    vatId: 'IE6388047V',
    email: 'accounts@brightline.example',
    phone: '+353 1 555 0142',
  },
  buyer: {
    name: 'Harbor & Finch Ltd.',
    street: '22 Wharf Lane',
    postalCode: 'EC3R 7AA',
    city: 'London',
    country: 'United Kingdom',
    companyId: '01234567',
    taxId: '',
    vatId: 'GB123456789',
    email: 'payables@harborfinch.example',
    phone: '',
  },
  payment: {
    method: 'transfer',
    bankName: 'Bank of Ireland',
    iban: 'IE70 BOFI 9000 1712 3456 78',
    bic: 'BOFIIE2D',
    variableSymbol: `${today.getFullYear()}0042`,
    qr: true,
  },
  vatPayer: true,
  reverseCharge: false,
  items: [
    { id: 1, description: 'Discovery workshop', quantity: 1, unit: 'day', unitPrice: 900, discount: 0, vatRate: 23 },
    {
      id: 2,
      description: 'Front-end development',
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
      vatRate: 9,
    },
  ],
  notes: 'Thank you for your business. Please quote the invoice number with your payment.',
  issuedBy: 'Maeve Brennan',
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

const CURRENCIES: readonly Currency[] = ['EUR', 'CZK', 'USD', 'GBP']
const LANGUAGES: readonly Language[] = ['en', 'sk']
const METHODS: readonly PaymentMethod[] = ['transfer', 'card', 'cash']

const isLogo = (value: unknown): value is string | null =>
  value === null || (typeof value === 'string' && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value))
const isAccent = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)

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
