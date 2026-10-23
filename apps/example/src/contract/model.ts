import { isBoolean, isDate, isNumber, isOneOf, isRaw, isString, record, strings } from '../validate'

export type FeeType = 'fixed' | 'hourly'
export type Currency = 'EUR' | 'GBP' | 'USD'
export type IpMode = 'assign' | 'license'
export type GoverningLaw = 'england' | 'ireland' | 'new-york' | 'delaware'

export const GOVERNING_LAWS: Record<GoverningLaw, { name: string; courts: string }> = {
  england: { name: 'England and Wales', courts: 'the courts of England and Wales' },
  ireland: { name: 'Ireland', courts: 'the courts of Ireland' },
  'new-york': { name: 'the State of New York', courts: 'the state and federal courts located in New York County' },
  delaware: { name: 'the State of Delaware', courts: 'the state and federal courts located in Delaware' },
}

export interface ContractParty {
  company: string
  address: string
  registrationNo: string
  signatory: string
  title: string
}

export interface Deliverable {
  id: number
  title: string
  /** Sub-items, one per line. */
  details: string
}

export interface Contract {
  title: string
  effectiveDate: string
  termMonths: number
  autoRenew: boolean
  tableOfContents: boolean
  client: ContractParty
  provider: ContractParty
  deliverables: Deliverable[]
  feeType: FeeType
  /** The fixed fee, or the hourly rate. */
  amount: number
  /** Hours the work is expected to take, for an hourly fee. */
  estimateHours: number
  currency: Currency
  paymentDays: number
  governingLaw: GoverningLaw
  confidentiality: boolean
  ip: IpMode
  liability: boolean
  /** The liability cap as a percent of the fees paid in the previous 12 months. */
  liabilityCapPercent: number
  nonSolicitation: boolean
  terminationForConvenience: boolean
  noticeDays: number
}

const emptyParty = (): ContractParty => ({ company: '', address: '', registrationNo: '', signatory: '', title: '' })

const isoDate = (date: Date) => date.toISOString().slice(0, 10)

export const sampleContract = (today = new Date()): Contract => ({
  title: 'Services Agreement',
  effectiveDate: isoDate(today),
  termMonths: 12,
  autoRenew: true,
  tableOfContents: true,
  client: {
    company: 'Harbor & Finch Ltd.',
    address: '22 Wharf Lane, London EC3R 7AA, United Kingdom',
    registrationNo: '01234567',
    signatory: 'Priya Raman',
    title: 'Chief Operating Officer',
  },
  provider: {
    company: 'Brightline Studio Ltd.',
    address: '14 Merrion Square, Dublin 2, D02 XY45, Ireland',
    registrationNo: '582417',
    signatory: 'Maeve Brennan',
    title: 'Managing Director',
  },
  deliverables: [
    {
      id: 1,
      title: 'Discovery and planning',
      details: 'Stakeholder interviews\nCurrent-state review\nProject plan and timeline',
    },
    {
      id: 2,
      title: 'Customer portal',
      details: 'Design system and prototypes\nFront-end build\nAccessibility review',
    },
    { id: 3, title: 'Launch support', details: 'Handover workshop\nFour weeks of post-launch fixes' },
  ],
  feeType: 'fixed',
  amount: 48000,
  estimateHours: 320,
  currency: 'EUR',
  paymentDays: 30,
  governingLaw: 'ireland',
  confidentiality: true,
  ip: 'assign',
  liability: true,
  liabilityCapPercent: 100,
  nonSolicitation: false,
  terminationForConvenience: true,
  noticeDays: 30,
})

export const blankContract = (today = new Date()): Contract => ({
  ...sampleContract(today),
  title: '',
  client: emptyParty(),
  provider: emptyParty(),
  deliverables: [],
  amount: 0,
  estimateHours: 0,
})

const CURRENCIES: readonly Currency[] = ['EUR', 'GBP', 'USD']
const FEE_TYPES: readonly FeeType[] = ['fixed', 'hourly']
const IP_MODES: readonly IpMode[] = ['assign', 'license']
const LAWS = Object.keys(GOVERNING_LAWS) as GoverningLaw[]

/**
 * Turns a parsed JSON value into a contract, or `null` when a field has the wrong type or an
 * unusable value. Missing optional fields take the blank contract's values and unknown keys are dropped.
 */
export const parseContract = (value: unknown): Contract | null => {
  if (!isRaw(value) || !isString(value.title) || !isRaw(value.client) || !isRaw(value.provider)) return null
  if (!Array.isArray(value.deliverables)) return null

  const blank = blankContract()
  const client = record(value.client, emptyParty(), strings(emptyParty()))
  const provider = record(value.provider, emptyParty(), strings(emptyParty()))
  const deliverables = (value.deliverables as unknown[]).map((item) =>
    record(item, { id: 0, title: '', details: '' }, { id: isNumber(0), title: isString, details: isString }, true),
  )
  const { client: _client, provider: _provider, deliverables: _deliverables, ...scalars } = blank
  const top = record(value, scalars, {
    title: isString,
    effectiveDate: isDate,
    termMonths: isNumber(1, 600),
    autoRenew: isBoolean,
    tableOfContents: isBoolean,
    feeType: isOneOf(FEE_TYPES),
    amount: isNumber(0),
    estimateHours: isNumber(0),
    currency: isOneOf(CURRENCIES),
    paymentDays: isNumber(0, 365),
    governingLaw: isOneOf(LAWS),
    confidentiality: isBoolean,
    ip: isOneOf(IP_MODES),
    liability: isBoolean,
    liabilityCapPercent: isNumber(0, 10_000),
    nonSolicitation: isBoolean,
    terminationForConvenience: isBoolean,
    noticeDays: isNumber(0, 365),
  })
  if (!top || !client || !provider || deliverables.some((item) => !item)) return null
  return { ...top, client, provider, deliverables: deliverables as Deliverable[] }
}
