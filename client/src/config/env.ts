interface ClientEnvSource {
  VITE_API_URL?: unknown;
  VITE_SOCKET_URL?: unknown;
  PROD?: unknown;
}

function requiredUrl(name: "VITE_API_URL" | "VITE_SOCKET_URL", value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} tanımlanmalıdır.`);
  }
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("unsupported protocol");
    return url.origin;
  } catch {
    throw new Error(`${name} geçerli bir http veya https URL olmalıdır.`);
  }
}

export function parseClientEnv(source: ClientEnvSource) {
  const forbiddenSecret = Object.keys(source).find(
    (key) => key.startsWith("VITE_") && /SECRET|PASSWORD|TOKEN|DATABASE|PRIVATE_KEY/i.test(key)
  );
  if (forbiddenSecret) {
    throw new Error(`Frontend environment variable secret içeremez: ${forbiddenSecret}`);
  }

  return Object.freeze({
    API_URL: requiredUrl("VITE_API_URL", source.VITE_API_URL),
    SOCKET_URL: requiredUrl("VITE_SOCKET_URL", source.VITE_SOCKET_URL),
    IS_PRODUCTION: source.PROD === true
  });
}

export const clientEnv = parseClientEnv(import.meta.env);
