import { defineConfig } from 'vite';

/**
 * CONFIGURACIÓN DE VITE
 * Servidor de desarrollo ultrarrápido con Hot Module Replacement (HMR) sub-10ms.
 */
export default defineConfig({
  server: {
    port: 3000,
    open: true
  }
});
