# Pruebas de navegador

Con npm run dev activo: npx playwright install chromium y npx playwright test. E2E_BASE_URL permite un entorno de prueba autorizado distinto. El estado local se modifica mediante cuentas/perfiles creados por las propias pruebas.

La suite usa la interfaz real y axe-core. Las comprobaciones automáticas no certifican WCAG ni sustituyen SUS con usuarios. Evidencia generada en research/evidence/browser-results.json y browser-artifacts.
