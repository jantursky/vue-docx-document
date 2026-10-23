import InvoiceTemplate from './InvoiceTemplate.vue'
import { docxKit } from './kit/docx'
import { withKit } from './kit/context'
import type { InvoiceDocumentProps } from './model'

// The same template as `pdfDocument.ts`, with the Word kit.
export const InvoiceDocx = withKit<InvoiceDocumentProps>(docxKit, InvoiceTemplate)
