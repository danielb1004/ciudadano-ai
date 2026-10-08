import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./testing/e2e',workers:1,fullyParallel:false,timeout:45000,
 use:{baseURL:process.env.E2E_BASE_URL ?? 'https://ciudadano-ai.3-142-230-27.sslip.io',browserName:'chromium',bypassCSP:true},
 reporter:[['list'],['json',{outputFile:'research/evidence/aws-browser-results.json'}]],
 outputDir:'research/evidence/aws-browser-artifacts'
});
