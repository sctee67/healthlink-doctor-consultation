export interface FieldError {
  field: string;
  message: string;
}

/**
 * Domain/application error rendered as RFC 9457 `application/problem+json`.
 * `code` is a stable machine-readable identifier the frontend can switch on.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly errors?: FieldError[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  validation: (errors: FieldError[]) =>
    new AppError(400, 'VALIDATION_FAILED', 'One or more fields are invalid.', errors),
  unauthorized: () => new AppError(401, 'UNAUTHENTICATED', 'Unknown or missing patient identity.'),
  notFound: (what: string) => new AppError(404, 'NOT_FOUND', `${what} was not found.`),
  conflict: (code: string, message: string) => new AppError(409, code, message),
  unprocessable: (code: string, message: string) => new AppError(422, code, message),
};
