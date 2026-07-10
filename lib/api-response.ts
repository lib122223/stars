import { NextResponse } from "next/server";

export const ErrorCode = {
  SUCCESS: 0,
  INVALID_PARAMS: 4001,
  NOT_FOUND: 4041,
  INTERNAL_ERROR: 5001,
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

const errorCodeToHttpStatus: Record<Exclude<ErrorCodeValue, 0>, number> = {
  [ErrorCode.INVALID_PARAMS]: 400,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.INTERNAL_ERROR]: 500,
};

interface ApiSuccess<T> {
  code: 0;
  data: T;
  message: string;
}

interface ApiFailure {
  code: Exclude<ErrorCodeValue, 0>;
  data: null;
  message: string;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiFailure;

export function apiSuccess<T>(data: T, message = "ok"): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ code: 0 as const, data, message });
}

export function apiError(
  code: Exclude<ErrorCodeValue, 0>,
  message: string,
  status?: number,
): NextResponse<ApiFailure> {
  const httpStatus = status ?? errorCodeToHttpStatus[code];
  return NextResponse.json({ code, data: null, message }, { status: httpStatus });
}
