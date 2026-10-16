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
  if (!response.ok) {
    if (response.status === 401) throw new Error("Your session has expired. Sign in again before saving.");
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.error === "string" ? body.error : "Unable to save this record. Please try again.");
  }
  return response.json();
}
