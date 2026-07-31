const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
const GATEWAY_BASE_URL: string = import.meta.env.VITE_GATEWAY_BASE_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, init);
  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(body || response.statusText, response.status);
  }
  return response.json() as Promise<T>;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(API_BASE_URL, path);
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(API_BASE_URL, path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function apiUpload<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);
  return request<T>(API_BASE_URL, path, { method: "POST", body: formData });
}

export function gatewayPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(GATEWAY_BASE_URL, path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
