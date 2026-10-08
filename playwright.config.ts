import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './testing/e2e', fullyParallel: false, workers: 1, timeout: 30000, use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173', browserName: 'chromium' }, reporter: [['list'],['json',{outputFile:'research/evidence/browser-results.json'}]], outputDir:'research/evidence/browser-artifacts' });
