import { clientEnv } from "../config/env";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${clientEnv.API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers }
  });
  const payload = await response.json().catch(() => ({
    success: false,
    error: { message: "Sunucudan geçersiz bir yanıt alındı." }
  }));
  if (!response.ok || !payload.success) throw new Error(payload.error?.message ?? "İstek tamamlanamadı.");
  return payload.data as T;
}
