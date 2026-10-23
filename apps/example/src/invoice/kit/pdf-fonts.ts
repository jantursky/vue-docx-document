import robotoBold from 'roboto-fontface/fonts/roboto/Roboto-Bold.woff?url'
import robotoRegular from 'roboto-fontface/fonts/roboto/Roboto-Regular.woff?url'
import { Font } from 'vue-pdf-document'

// The standard PDF fonts only cover Latin-1, so Slovak letters such as č and ť need an
// embedded font. Vite serves the files and the layout engine fetches them on first use.
Font.register({
  family: 'Roboto',
  fonts: [{ src: robotoRegular }, { src: robotoBold, fontWeight: 700 }],
})
