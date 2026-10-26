import {
  defineConfig,
  minimal2023Preset,
  type Preset,
} from '@vite-pwa/assets-generator/config'

const BRAND = '#4f46e5'

// Maskable and Apple icons get a brand-coloured background instead of white,
// so the icon looks intentional when the OS crops or pads it.
const preset: Preset = {
  ...minimal2023Preset,
  maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: BRAND } },
  apple: { ...minimal2023Preset.apple, resizeOptions: { background: BRAND } },
}

// Regenerates PNG/ICO icons from public/icons/logo.svg.
// Run `npm run generate-icons` after changing the logo; the output is committed.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset,
  images: ['public/icons/logo.svg'],
})
