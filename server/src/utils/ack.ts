import { AppError } from "./AppError.js";
import { ZodError } from "zod";

export type AckSuccess<T> = { success: true; data: T };
export type AckFailure = { success: false; error: { code: string; message: string } };
export type Ack<T> = AckSuccess<T> | AckFailure;
export type AckCallback<T> = (response: Ack<T>) => void;

export const ok = <T>(data: T): AckSuccess<T> => ({ success: true, data });

export function fail(error: unknown): AckFailure {
  if (error instanceof AppError) {
    return { success: false, error: { code: error.code, message: error.message } };
  }
  if (error instanceof ZodError) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: error.issues[0]?.message ?? "Geçersiz veri."
      }
    };
  }
  return {
    success: false,
    error: { code: "INTERNAL_ERROR", message: "Beklenmeyen bir sunucu hatası oluştu." }
  };
}
