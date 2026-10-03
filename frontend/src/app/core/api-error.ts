import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export interface FieldError {
  field: string;
  message: string;
}

/** Normalised error every caller sees, whatever went wrong on the wire. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors: FieldError[] = [],
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }
}

interface ProblemDetails {
  title?: string;
  code?: string;
  errors?: FieldError[];
  requestId?: string;
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return new ApiError(0, 'NETWORK', 'Cannot reach HealthLink. Check your connection and try again.');
    }
    const body = (typeof err.error === 'object' && err.error) as ProblemDetails | false;
    return new ApiError(
      err.status,
      (body && body.code) || `HTTP_${err.status}`,
      (body && body.title) || 'Something went wrong. Please try again.',
      (body && body.errors) || [],
      (body && body.requestId) || err.headers.get('X-Request-Id') || undefined,
    );
  }
  return new ApiError(-1, 'UNKNOWN', 'Something unexpected happened. Please try again.');
}

/** Converts RFC 9457 problem responses into ApiError so components never parse HTTP errors. */
export const apiErrorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(catchError((err: unknown) => throwError(() => toApiError(err))));
