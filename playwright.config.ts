import {mkdirSync} from 'node:fs';mkdirSync('runtime/reports/screenshots',{recursive:true});
import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests/e2e',outputDir:'runtime/reports/playwright-results',timeout:60000,fullyParallel:false,workers:1,use:{channel:process.env.PLAYWRIGHT_CHANNEL||undefined,baseURL:'http://127.0.0.1:3002',viewport:{width:1440,height:1000},screenshot:'only-on-failure',trace:'retain-on-failure'},webServer:{command:'npx tsx scripts/start-e2e-server.ts',url:'http://127.0.0.1:3002/api/health',reuseExistingServer:false,timeout:60000},reporter:[['list'],['json',{outputFile:'runtime/reports/e2e-results.json'}]]});

