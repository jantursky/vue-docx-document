import { renderToBlob } from 'vue-pdf-document'

import InvoiceTemplate from './InvoiceTemplate.vue'
import { pdfKit } from './kit/pdf'
import { withKit } from './kit/context'
import type { InvoiceDocumentProps } from './model'

export const InvoicePdf = withKit<InvoiceDocumentProps>(pdfKit, InvoiceTemplate)

export const renderInvoicePdf = (props: InvoiceDocumentProps): Promise<Blob> => renderToBlob(InvoicePdf, props)
