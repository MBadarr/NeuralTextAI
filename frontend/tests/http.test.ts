import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("NLP request coordination", () => {
  it("serializes processing requests and skips canceled queued work", async () => {
    vi.resetModules();
    let complete!: (value: Response) => void;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            complete = resolve;
          }),
      )
      .mockResolvedValue(Response.json({ done: true }));
    vi.stubGlobal("fetch", fetchMock);
    const { post } = await import("@/lib/http");
    const first = post("/writing-feedback", { text: "First" });
    const controller = new AbortController();
    const canceled = post("/autocomplete", { text: "Old" }, controller.signal);
    const canceledResult = canceled.catch((error) => error);
    const last = post("/analysis", { text: "Latest" });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    controller.abort();
    complete(Response.json({ done: true }));
    await first;
    expect(await canceledResult).toMatchObject({ name: "AbortError" });
    await last;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/backend/analysis");
  });

  it("retries only processing-capacity rejections", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json(
          { detail: "Busy" },
          {
            status: 503,
            headers: { "X-Service-Error": "nlp_busy" },
          },
        ),
      )
      .mockResolvedValueOnce(Response.json({ done: true }))
      .mockResolvedValueOnce(
        Response.json({ detail: "Database unavailable" }, { status: 503 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const { post } = await import("@/lib/http");
    const pending = post("/analysis", { text: "First" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(await pending).toEqual({ done: true });
    await expect(post("/analysis", { text: "Second" })).rejects.toThrow(
      "Database unavailable",
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
