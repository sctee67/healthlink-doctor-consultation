import fs from 'node:fs';
import { loadConfig } from '../config/env.js';

const { dataFile } = loadConfig();
fs.rmSync(dataFile, { force: true });
console.log(`Removed ${dataFile}. Fresh seed data will be written on next start.`);
