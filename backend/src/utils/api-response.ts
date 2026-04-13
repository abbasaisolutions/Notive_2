import type { Response } from 'express';

export interface ApiError {
    code: string;
    message: string;
    /** Whether the client should retry after a delay */
    retryable?: boolean;
}

export interface ApiSuccess<T> {
    success: true;
    data: T;
}

export interface ApiFailure {
    success: false;
    error: ApiError;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/** Send a successful JSON response wrapped in the standard envelope. */
export function ok<T>(res: Response, data: T, status = 200): Response {
    return res.status(status).json({ success: true, data } satisfies ApiSuccess<T>);
}

/** Send an error JSON response wrapped in the standard envelope. */
export function fail(
    res: Response,
    code: string,
    message: string,
    status = 400,
    retryable?: boolean,
): Response {
    const body: ApiFailure = { success: false, error: { code, message, ...(retryable != null ? { retryable } : {}) } };
    return res.status(status).json(body);
}

/** Common error codes */
export const ErrCode = {
    VALIDATION: 'VALIDATION_ERROR',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    INTERNAL: 'INTERNAL_ERROR',
    RATE_LIMITED: 'RATE_LIMITED',
} as const;
