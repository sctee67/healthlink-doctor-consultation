import path from 'node:path';

export interface AppConfig {
  port: number;
  /** Comma-separated list of origins allowed by CORS. */
  corsOrigins: string[];
  /** `file` persists to disk (default); `memory` is used by tests. */
  storage: 'file' | 'memory';
  dataFile: string;
  /** Header a real auth layer would replace; see http/middleware/patient-context.ts */
  defaultPatientId: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number(env['PORT'] ?? 3000),
    corsOrigins: (env['CORS_ORIGINS'] ?? 'http://localhost:4200')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    storage: env['STORAGE'] === 'memory' ? 'memory' : 'file',
    dataFile: path.resolve(env['DATA_FILE'] ?? 'data/db.json'),
    defaultPatientId: env['DEFAULT_PATIENT_ID'] ?? 'pat_john',
  };
}
