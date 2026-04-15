import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ⚠️ Troque 'family-finance' pelo nome do seu repositório no GitHub
// Exemplo: se seu repo for github.com/joao/meu-financeiro → base: '/meu-financeiro/'
export default defineConfig({
  plugins: [react()],
  base: '/family-finance/',
})
