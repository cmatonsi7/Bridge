import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound: RequestHandler = (_req, _res, next) =>
  next(new HttpError(404, 'NOT_FOUND', 'Not found'));

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION',
        message: 'Check the highlighted fields',
        fields: err.flatten().fieldErrors,
      },
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({
      error: {
        code: 'TOO_LARGE',
        message:
          'That request is too large. For spreadsheets, split the file into smaller ones (500 rows at most).',
      },
    });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'BAD_JSON', message: 'Request body is not valid JSON' } });
    return;
  }
  console.error('[api] unhandled error', err);
  res
    .status(500)
    .json({ error: { code: 'INTERNAL', message: 'Something went wrong on our side. Try again.' } });
};
