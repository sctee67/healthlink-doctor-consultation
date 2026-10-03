import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { AppConfig } from './config/env.js';
import { JsonFileStore, MemoryStore, type Store } from './storage/store.js';
import { buildSeed } from './storage/seed.js';
import {
  ConsultationRepository,
  DoctorRepository,
  IdempotencyRepository,
  PatientRepository,
} from './repositories/repositories.js';
import { DoctorService } from './services/doctor.service.js';
import { ConsultationService } from './services/consultation.service.js';
import { accessLog, errorHandler, notFound, patientContext, requestId } from './http/middleware/middleware.js';
import { consultationRoutes, doctorRoutes, metaRoutes } from './http/routes.js';

export interface AppDeps {
  config: AppConfig;
  clock?: () => Date;
  store?: Store;
  /** Disables access logs and rate limits (tests). */
  quiet?: boolean;
}

/** Composition root: wires storage → repositories → services → routes. */
export function createApp({ config, clock = () => new Date(), store, quiet = false }: AppDeps): Express {
  const db =
    store ??
    (config.storage === 'memory'
      ? new MemoryStore(buildSeed(clock()))
      : JsonFileStore.open(config.dataFile, () => buildSeed(clock())));

  const doctorRepo = new DoctorRepository(db);
  const patientRepo = new PatientRepository(db);
  const consultationRepo = new ConsultationRepository(db);
  const idempotencyRepo = new IdempotencyRepository(db);

  const doctorService = new DoctorService(doctorRepo, consultationRepo, clock);
  const consultationService = new ConsultationService(consultationRepo, doctorRepo, idempotencyRepo, clock);

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(requestId);
  app.use(accessLog(quiet));
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins,
      exposedHeaders: ['X-Request-Id', 'Location', 'Idempotent-Replayed'],
    }),
  );
  app.use(express.json({ limit: '16kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const api = express.Router();
  api.use(patientContext(patientRepo, config.defaultPatientId));
  api.use('/', metaRoutes());
  api.use('/doctors', doctorRoutes(doctorService));
  api.use('/consultations', consultationRoutes(consultationService, !quiet));
  app.use('/api', api);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
