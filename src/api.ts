export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function responseError(response: Response, fallback: string): Promise<ApiError> {
  const body = await response.json().catch(() => null);
  const message = response.status === 401
    ? "Your session has expired. Sign in again to continue."
    : typeof body?.error === "string" ? body.error : fallback;
  return new ApiError(message, response.status);
}

/** Fetch JSON while providing consistent network, HTTP, and session-expiry errors. */
export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch {
    throw new ApiError("Unable to reach the server. Check your connection and try again.");
  }
  if (!response.ok) throw await responseError(response, "The server could not complete the request. Please try again.");
  return response.json() as Promise<T>;
}

/** Save a financial record, propagating failures so the form can retain its draft. */
export async function saveRecord<T>(resource: string, data: { id?: string }): Promise<T> {

  let response: Response;
  try {
    response = await fetch(`/api/${resource}${data.id ? `/${encodeURIComponent(data.id)}` : ""}`, {
      method: data.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json"},
      body: JSON.stringify(data),
    });
  } catch {
    throw new Error("Unable to reach the server. Check your connection before retrying; verify the list if the request may have reached the server.");
  }
  if (!response.ok) throw await responseError(response, "Unable to save this record. Please try again.");
  return response.json();
}

export async function deleteRecord(resource: string, id: string): Promise<void> {
  await fetchJson<{ success: boolean }>(`/api/${resource}/${encodeURIComponent(id)}`, { method: "DELETE" });
}
