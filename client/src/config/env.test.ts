import { describe, expect, it } from "vitest";
import { parseClientEnv } from "./env";

describe("frontend environment doğrulaması", () => {
  it("API ve Socket URL değerlerini merkezî olarak doğrular", () => {
    expect(
      parseClientEnv({
        VITE_API_URL: "https://api.example.com/",
        VITE_SOCKET_URL: "https://api.example.com",
        PROD: true
      })
    ).toEqual({
      API_URL: "https://api.example.com",
      SOCKET_URL: "https://api.example.com",
      IS_PRODUCTION: true
    });
  });

  it("eksik production adresini anlaşılır hatayla reddeder", () => {
    expect(() =>
      parseClientEnv({ VITE_API_URL: "https://api.example.com", PROD: true })
    ).toThrow(/VITE_SOCKET_URL/);
  });

  it("VITE_ önekli secret değişkenlerini reddeder", () => {
    expect(() =>
      parseClientEnv({
        VITE_API_URL: "https://api.example.com",
        VITE_SOCKET_URL: "https://api.example.com",
        VITE_JWT_SECRET: "should-not-exist"
      } as never)
    ).toThrow(/secret içeremez/);
  });
});
