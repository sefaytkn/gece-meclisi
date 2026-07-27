const sensitiveKey = /authorization|cookie|password|passwordhash|jwt|session.?id|reconnect.?token|database_url|direct_url|secret|token/i;
const connectionString = /\bpostgres(?:ql)?:\/\/[^\s"'`]+/gi;
const bearerToken = /\bBearer\s+[A-Za-z0-9._~-]+/gi;
const jwtToken = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;

export function redactSensitive(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") {
    return value
      .replace(connectionString, "[REDACTED_DATABASE_URL]")
      .replace(bearerToken, "Bearer [REDACTED]")
      .replace(jwtToken, "[REDACTED_JWT]");
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactSensitive(value.message),
      ...(process.env.NODE_ENV === "production" ? {} : { stack: redactSensitive(value.stack) })
    };
  }
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item, seen));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      sensitiveKey.test(key) ? "[REDACTED]" : redactSensitive(item, seen)
    ])
  );
}

function write(level: "info" | "warn" | "error", message: string, metadata?: unknown) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(metadata === undefined ? {} : { metadata: redactSensitive(metadata) })
  };
  const output = JSON.stringify(entry);
  if (level === "error") console.error(output);
  else if (level === "warn") console.warn(output);
  else console.info(output);
}

export const logger = {
  info: (message: string, metadata?: unknown) => write("info", message, metadata),
  warn: (message: string, metadata?: unknown) => write("warn", message, metadata),
  error: (message: string, metadata?: unknown) => write("error", message, metadata)
};
