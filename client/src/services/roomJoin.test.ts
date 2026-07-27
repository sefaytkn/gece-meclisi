import { beforeEach, describe, expect, it, vi } from "vitest";
import { emitAck } from "./socket";
import { joinRoomOnce, resetPendingRoomJoinsForTests } from "./roomJoin";

vi.mock("./socket", () => ({ emitAck: vi.fn() }));

describe("oda katılımı", () => {
  beforeEach(() => {
    resetPendingRoomJoinsForTests();
    vi.mocked(emitAck).mockReset();
  });

  it("React StrictMode tekrarında aynı katılım isteğini tek kez gönderir", async () => {
    let resolveJoin!: (value: never) => void;
    vi.mocked(emitAck).mockReturnValue(
      new Promise((resolve) => {
        resolveJoin = resolve;
      })
    );

    const first = joinRoomOnce("abc123", "reconnect-token");
    const second = joinRoomOnce("ABC123", "reconnect-token");

    expect(first).toBe(second);
    expect(emitAck).toHaveBeenCalledTimes(1);

    resolveJoin({} as never);
    await first;
  });
});
