import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-date': ['date-fns'],
        },
      },
    },
    // Target modern browsers
    target: 'es2020',
    // Inline small assets
    assetsInlineLimit: 4096,
  },
  // Optimize deps
  optimizeDeps: {
    include: ['react', 'react-dom', '@supabase/supabase-js', 'date-fns'],
  },
})
