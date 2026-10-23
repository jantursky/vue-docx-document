import type { Invoice, LineItem } from './model'

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export interface VatLine {
  rate: number
  base: number
  vat: number
  total: number
}

export interface Totals {
  /** Line totals before VAT, in item order. */
  lines: number[]
  /** One row per VAT rate, highest rate first. */
  vat: VatLine[]
  subtotal: number
  vatTotal: number
  total: number
}

/** A line's amount before VAT, after its discount, rounded to cents. */
export const lineTotal = (item: LineItem): number =>
  round(item.quantity * item.unitPrice * (1 - Math.min(Math.max(item.discount, 0), 100) / 100))

/**
 * VAT is computed per rate on the sum of that rate's lines, the way the VAT recap on
 * an invoice states it. A non-VAT payer or a reverse-charge invoice charges none.
 */
export const computeTotals = (invoice: Invoice): Totals => {
  const lines = invoice.items.map(lineTotal)
  const chargesVat = invoice.vatPayer && !invoice.reverseCharge
  const byRate = new Map<number, number>()
  invoice.items.forEach((item, index) => {
    const rate = chargesVat ? item.vatRate : 0
    byRate.set(rate, round((byRate.get(rate) ?? 0) + (lines[index] ?? 0)))
  })
  const vat = [...byRate.entries()]
    .sort(([a], [b]) => b - a)
    .map(([rate, base]) => {
      const tax = round((base * rate) / 100)
      return { rate, base, vat: tax, total: round(base + tax) }
    })
  const subtotal = round(lines.reduce((sum, line) => sum + line, 0))
  const vatTotal = round(vat.reduce((sum, line) => sum + line.vat, 0))
  return { lines, vat, subtotal, vatTotal, total: round(subtotal + vatTotal) }
}

/**
 * The EPC069-12 payload ("SEPA QR") that banking apps across the EU scan to prefill a
 * transfer. Returns null when the invoice can't be paid that way.
 */
export const epcPayload = (invoice: Invoice, amount: number): string | null => {
  const iban = invoice.payment.iban.replace(/\s+/g, '').toUpperCase()
  if (
    invoice.currency !== 'EUR' ||
    invoice.payment.method !== 'transfer' ||
    !iban ||
    !invoice.seller.name.trim() ||
    amount <= 0
  )
    return null
  const reference = [
    invoice.payment.variableSymbol && `VS${invoice.payment.variableSymbol}`,
    invoice.number && `Invoice ${invoice.number}`,
  ]
    .filter(Boolean)
    .join(' ')
  return [
    'BCD',
    '002',
    '1',
    'SCT',
    invoice.payment.bic.replace(/\s+/g, '').toUpperCase(),
    invoice.seller.name.slice(0, 70),
    iban,
    `EUR${amount.toFixed(2)}`,
    '',
    '',
    reference.slice(0, 140),
  ].join('\n')
}
