import type { Currency, Language, PaymentMethod } from './model'

const en = {
  invoice: 'Invoice',
  number: 'No.',
  supplier: 'Supplier',
  customer: 'Customer',
  companyId: 'Company ID',
  taxId: 'Tax ID',
  vatId: 'VAT ID',
  issueDate: 'Issue date',
  deliveryDate: 'Date of supply',
  dueDate: 'Due date',
  orderNumber: 'Order no.',
  paymentMethod: 'Payment',
  variableSymbol: 'Reference',
  bank: 'Bank',
  iban: 'IBAN',
  bic: 'BIC',
  item: 'Description',
  quantity: 'Qty',
  unit: 'Unit',
  unitPrice: 'Unit price',
  discount: 'Disc.',
  vatRate: 'VAT',
  amount: 'Amount',
  vatRecap: 'VAT summary',
  base: 'Base',
  vat: 'VAT',
  total: 'Total',
  amountDue: 'Amount due',
  scanToPay: 'Scan to pay',
  issuedBy: 'Issued by',
  notVatPayer: 'The supplier is not registered for VAT.',
  reverseCharge: 'Reverse charge: VAT to be accounted for by the customer.',
  page: 'Page {page} of {total}',
  methods: { transfer: 'Bank transfer', card: 'Card', cash: 'Cash' } satisfies Record<PaymentMethod, string>,
}

export type Labels = typeof en

const sk: Labels = {
  invoice: 'Faktúra',
  number: 'č.',
  supplier: 'Dodávateľ',
  customer: 'Odberateľ',
  companyId: 'IČO',
  taxId: 'DIČ',
  vatId: 'IČ DPH',
  issueDate: 'Dátum vystavenia',
  deliveryDate: 'Dátum dodania',
  dueDate: 'Dátum splatnosti',
  orderNumber: 'Objednávka č.',
  paymentMethod: 'Forma úhrady',
  variableSymbol: 'Variabilný symbol',
  bank: 'Banka',
  iban: 'IBAN',
  bic: 'SWIFT',
  item: 'Popis',
  quantity: 'Množ.',
  unit: 'MJ',
  unitPrice: 'Cena za MJ',
  discount: 'Zľava',
  vatRate: 'DPH',
  amount: 'Spolu',
  vatRecap: 'Rekapitulácia DPH',
  base: 'Základ',
  vat: 'DPH',
  total: 'Spolu',
  amountDue: 'Suma na úhradu',
  scanToPay: 'Naskenujte a zaplaťte',
  issuedBy: 'Vystavil',
  notVatPayer: 'Dodávateľ nie je platiteľom DPH.',
  reverseCharge: 'Prenesenie daňovej povinnosti – daň odvedie odberateľ.',
  page: 'Strana {page} z {total}',
  methods: { transfer: 'Prevodom', card: 'Kartou', cash: 'V hotovosti' },
}

export const labels: Record<Language, Labels> = { en, sk }

const locales: Record<Language, string> = { en: 'en-GB', sk: 'sk-SK' }

// Roboto, which the PDF embeds, has no narrow no-break space (U+202F), and some locales put one in numbers.
const safeSpaces = (text: string) => text.replace(/\u202f/g, '\u00a0')

export const formatters = (language: Language, currency: Currency) => {
  const locale = locales[language]
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency })
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 })
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' })
  return {
    money: (value: number) => safeSpaces(money.format(value)),
    number: (value: number) => safeSpaces(number.format(value)),
    percent: (value: number) => `${safeSpaces(number.format(value))} %`,
    date: (iso: string) => (iso ? date.format(new Date(`${iso}T00:00:00Z`)) : '–'),
  }
}
