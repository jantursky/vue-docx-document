import { GOVERNING_LAWS, type Contract } from './model'

export interface Point {
  text: string
  /** A note for the foot of the page, attached to the end of the text. */
  footnote?: string
}

export interface Clause {
  /** The clause heading, such as `Fees and payment`. */
  title: string
  /** The sub-clauses, numbered 1.1, 1.2 and so on under the clause. */
  points: Point[]
}

const point = (text: string, footnote?: string): Point => ({ text, footnote })

export const formatDate = (iso: string): string =>
  iso
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
        new Date(`${iso}T00:00:00Z`),
      )
    : '[date]'

export const formatMoney = (value: number, currency: Contract['currency']): string =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value)

const feeText = (contract: Contract): string => {
  const { amount, currency, estimateHours } = contract
  if (contract.feeType === 'fixed') {
    return `The Client shall pay the Provider a fixed fee of ${formatMoney(amount, currency)} for the Services, excluding any applicable taxes.`
  }
  return (
    `The Client shall pay the Provider ${formatMoney(amount, currency)} for each hour of Services, excluding any applicable taxes. ` +
    `The Provider estimates ${estimateHours} hours, or ${formatMoney(amount * estimateHours, currency)}; the estimate is not a cap and the Provider shall tell the Client before it is likely to be exceeded.`
  )
}

const termText = (contract: Contract): string => {
  const months = `${contract.termMonths} ${contract.termMonths === 1 ? 'month' : 'months'}`
  const start = `This Agreement starts on ${formatDate(contract.effectiveDate)} and continues for ${months}`
  return contract.autoRenew
    ? `${start}. It then renews for successive periods of the same length unless either party gives the other written notice of non-renewal at least 30 days before the current period ends.`
    : `${start}, unless it is ended earlier under this Agreement or extended in writing by both parties.`
}

/** The numbered clauses of the agreement, from the options the user switched on. */
export const buildClauses = (contract: Contract): Clause[] => {
  const clauses: Clause[] = [
    {
      title: 'Definitions',
      points: [
        point('"Agreement" means these terms together with Schedule A.'),
        point('"Client" and "Provider" mean the parties named above.'),
        point('"Services" means the work described in Schedule A.'),
        point('"Fees" means the amounts payable for the Services under clause 3.'),
        ...(contract.confidentiality
          ? [
              point(
                '"Confidential Information" means non-public information that one party discloses to the other in connection with this Agreement.',
              ),
            ]
          : []),
      ],
    },
    {
      title: 'Services',
      points: [
        point(
          'The Provider shall perform the Services described in Schedule A with reasonable skill and care, and the Client shall give the Provider the information and access it reasonably needs to do so.',
        ),
      ],
    },
    {
      title: 'Fees and payment',
      points: [
        point(feeText(contract)),
        point(
          `The Provider shall invoice the Fees monthly in arrears, and the Client shall pay each invoice within ${contract.paymentDays} days of its date.`,
        ),
        point(
          'Sums not paid when due bear interest at 8% a year above the base rate of the central bank of the currency of the invoice, from the due date until payment.',
          'Interest on late payment is a commercial default, not a legal minimum. Check the late-payment rules that apply in the governing jurisdiction before relying on it.',
        ),
      ],
    },
    { title: 'Term', points: [point(termText(contract))] },
  ]

  if (contract.confidentiality) {
    clauses.push({
      title: 'Confidentiality',
      points: [
        point(
          "Each party shall keep the other's Confidential Information secret, use it only for this Agreement, and disclose it only to people who need it and are bound by the same duty.",
        ),
        point(
          'This clause does not apply to information that is public through no fault of the receiving party, or that the law requires it to disclose.',
        ),
      ],
    })
  }

  clauses.push({
    title: 'Intellectual property',
    points:
      contract.ip === 'assign'
        ? [
            point(
              'On receipt of full payment, the Provider assigns to the Client all intellectual property rights in the deliverables created for the Client under this Agreement.',
            ),
            point(
              'The Provider keeps its pre-existing materials and tools, and grants the Client a perpetual licence to use any of them that are part of a deliverable.',
            ),
          ]
        : [
            point('The Provider keeps all intellectual property rights in the deliverables.'),
            point(
              'On receipt of full payment, the Provider grants the Client a non-exclusive, perpetual, worldwide licence to use the deliverables for its own business.',
            ),
          ],
  })

  if (contract.liability) {
    clauses.push({
      title: 'Limitation of liability',
      points: [
        point('Neither party excludes liability that cannot be excluded by law.'),
        point(
          `Subject to that, each party's total liability under this Agreement is limited to ${contract.liabilityCapPercent}% of the Fees paid in the 12 months before the claim arose, and neither party is liable for lost profits or indirect loss.`,
        ),
      ],
    })
  }

  if (contract.nonSolicitation) {
    clauses.push({
      title: 'Non-solicitation',
      points: [
        point(
          'During this Agreement and for 12 months after it ends, neither party shall directly solicit for employment anyone who worked on the Services for the other party, other than through a general advertisement.',
        ),
      ],
    })
  }

  clauses.push({
    title: 'Termination',
    points: [
      point(
        'Either party may end this Agreement by written notice if the other commits a material breach and does not fix it within 30 days of being told.',
      ),
      ...(contract.terminationForConvenience
        ? [
            point(
              `Either party may end it for any reason by giving the other ${contract.noticeDays} days' written notice. The Client shall pay for Services performed up to the end date.`,
            ),
          ]
        : []),
      point('Clauses that are meant to continue after the end of this Agreement continue to apply.'),
    ],
  })

  const law = GOVERNING_LAWS[contract.governingLaw]
  clauses.push(
    {
      title: 'Governing law',
      points: [
        point(
          `This Agreement and any dispute arising from it are governed by the law of ${law.name}, and ${law.courts} have exclusive jurisdiction.`,
        ),
      ],
    },
    {
      title: 'General',
      points: [
        point('This Agreement is the whole agreement between the parties on its subject.'),
        point('Changes must be in writing and signed by both parties.'),
        point('It may be signed in counterparts, which together form one document.'),
      ],
    },
  )
  return clauses
}
