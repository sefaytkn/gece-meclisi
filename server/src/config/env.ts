import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });

const booleanString = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const optionalUrl = z.string().trim().url().optional();

const rawSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  PORT: z.coerce.number().int().min(1).max(65_535).optional(),
  DATABASE_URL: optionalUrl,
  DIRECT_URL: optionalUrl,
  JWT_SECRET: z.string().min(32).optional(),
  CLIENT_URL: optionalUrl,
  CORS_ORIGIN: z.string().trim().optional(),
  COOKIE_NAME: z.string().trim().min(1).default("gece_session"),
  COOKIE_SECURE: booleanString.optional(),
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).optional(),
  RECONNECT_GRACE_MS: z.coerce.number().int().min(10_000).max(300_000).default(60_000)
});

export type ServerEnv = ReturnType<typeof parseServerEnv>;

export function parseServerEnv(source: NodeJS.ProcessEnv) {
  const result = rawSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Environment variable doğrulaması başarısız: ${details}`);
  }

  const raw = result.data;
  const required = {
    NODE_ENV: raw.NODE_ENV,
    PORT: raw.PORT,
    DATABASE_URL: raw.DATABASE_URL,
    DIRECT_URL: raw.DIRECT_URL,
    JWT_SECRET: raw.JWT_SECRET,
    CLIENT_URL: raw.CLIENT_URL,
    CORS_ORIGIN: raw.CORS_ORIGIN,
    COOKIE_SECURE: raw.COOKIE_SECURE,
    COOKIE_SAME_SITE: raw.COOKIE_SAME_SITE
  };
  const missing = Object.entries(required)
    .filter(([, value]) => value === undefined || value === "")
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Zorunlu environment variable eksik: ${missing.join(", ")}`);
  }

  const isProduction = raw.NODE_ENV === "production";
  const frontendOrigins = [raw.CLIENT_URL, ...(raw.CORS_ORIGIN?.split(",") ?? [])]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  if (frontendOrigins.some((value) => value === "*")) {
    throw new Error("CORS wildcard kullanılamaz; izin verilen origin'leri açıkça yazın.");
  }

  let frontendUrls: URL[];
  try {
    frontendUrls = frontendOrigins.map((value) => new URL(value));
  } catch {
    throw new Error("CLIENT_URL ve CORS_ORIGIN değerleri geçerli URL origin'leri olmalıdır.");
  }
  if (
    frontendUrls.some(
      (url) =>
        !["http:", "https:"].includes(url.protocol) ||
        Boolean(url.username) ||
        Boolean(url.password) ||
        url.pathname !== "/" ||
        Boolean(url.search) ||
        Boolean(url.hash)
    )
  ) {
    throw new Error("CLIENT_URL ve CORS_ORIGIN yalnızca http/https origin değerleri içermelidir.");
  }

  if (isProduction) {
    if (!raw.COOKIE_SECURE) {
      throw new Error("Production ortamında COOKIE_SECURE=true olmalıdır.");
    }
    if (raw.COOKIE_SAME_SITE !== "none") {
      throw new Error("Vercel ve Render farklı domainlerde çalışırken COOKIE_SAME_SITE=none olmalıdır.");
    }
    if (raw.JWT_SECRET?.includes("replace-with")) {
      throw new Error("Production ortamında güçlü ve benzersiz bir JWT_SECRET tanımlanmalıdır.");
    }

    if (frontendUrls.some((url) => url.protocol !== "https:")) {
      throw new Error("Production CLIENT_URL ve CORS_ORIGIN değerleri HTTPS kullanmalıdır.");
    }
  }

  const databaseUrl = raw.DATABASE_URL!;
  const clientUrl = raw.CLIENT_URL!;

  return {
    NODE_ENV: raw.NODE_ENV!,
    PORT: raw.PORT!,
    DATABASE_URL: databaseUrl,
    DIRECT_URL: raw.DIRECT_URL!,
    JWT_SECRET: raw.JWT_SECRET!,
    CLIENT_URL: new URL(clientUrl).origin,
    CORS_ORIGIN: raw.CORS_ORIGIN!,
    COOKIE_NAME: raw.COOKIE_NAME,
    COOKIE_SECURE: raw.COOKIE_SECURE!,
    COOKIE_SAME_SITE: raw.COOKIE_SAME_SITE!,
    RECONNECT_GRACE_MS: raw.RECONNECT_GRACE_MS
  };
}

export const env = parseServerEnv(process.env);
