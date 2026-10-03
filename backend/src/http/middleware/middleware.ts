import { randomUUID } from 'node:crypto';
import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import { AppError, Errors } from '../../domain/errors.js';
import type { Patient } from '../../domain/models.js';
import type { PatientRepository } from '../../repositories/repositories.js';

export interface Locals {
  requestId: string;
  patient: Patient;
}

export const locals = (res: Response) => res.locals as Locals;

/** Propagates or assigns a correlation id, echoed back in `X-Request-Id`. */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  const id = incoming && /^[\w-]{1,64}$/.test(incoming) ? incoming : randomUUID();
  locals(res).requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
};

/** One structured log line per request. */
export const accessLog = (silent: boolean): RequestHandler => (req, res, next) => {
  if (silent) return next();
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(
      JSON.stringify({
        level: res.statusCode >= 500 ? 'error' : 'info',
        requestId: locals(res).requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Math.round(ms * 10) / 10,
      }),
    );
  });
  next();
};

/**
 * Stand-in for real authentication: resolves the current patient from
 * `X-Patient-Id`, falling back to the demo patient. In production this would
 * read a verified session/JWT instead — services only ever see `patient.id`.
 */
export const patientContext =
  (patients: PatientRepository, defaultPatientId: string): RequestHandler =>
  (req, res, next) => {
    const id = req.header('x-patient-id') ?? defaultPatientId;
    const patient = patients.findById(id);
    if (!patient) return next(Errors.unauthorized());
    locals(res).patient = patient;
    next();
  };

export const notFound: RequestHandler = (_req, _res, next) => next(Errors.notFound('Route'));

/** Renders every error as RFC 9457 problem+json. Unknown errors never leak internals. */
export const errorHandler: ErrorRequestHandler = (err, _req: Request, res: Response, _next: NextFunction) => {
  const requestId = locals(res).requestId;
  let appError: AppError;
  if (err instanceof AppError) {
    appError = err;
  } else if (err?.type === 'entity.parse.failed') {
    appError = new AppError(400, 'MALFORMED_JSON', 'Request body is not valid JSON.');
  } else if (err?.type === 'entity.too.large') {
    appError = new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.');
  } else {
    console.error(JSON.stringify({ level: 'error', requestId, message: String(err?.stack ?? err) }));
    appError = new AppError(500, 'INTERNAL_ERROR', 'Something went wrong on our side. Please try again.');
  }

  res
    .status(appError.status)
    .type('application/problem+json')
    .json({
      type: `https://healthlink.example/problems/${appError.code.toLowerCase().replaceAll('_', '-')}`,
      title: appError.message,
      status: appError.status,
      code: appError.code,
      requestId,
      ...(appError.errors ? { errors: appError.errors } : {}),
    });
};
