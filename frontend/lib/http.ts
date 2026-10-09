const API_URL = "/api/backend";

export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new Error("Cannot reach the service. Please try again in a moment.");
  }
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.location.replace("/auth/sign-in");
    }
    let message = `Backend request failed (${response.status}).`;
    try {
      const body = (await response.json()) as {
        detail?: string | Array<{ msg: string; loc: Array<string | number> }>;
      };
      if (typeof body.detail === "string") message = body.detail;
      else if (Array.isArray(body.detail))
        message = body.detail
          .map((item) => `${item.loc.slice(1).join(".")}: ${item.msg}`)
          .join("; ");
    } catch {
      /* Keep the HTTP status if no JSON error is available. */
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
export function post<T>(path: string, payload: object, signal?: AbortSignal) {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
}
