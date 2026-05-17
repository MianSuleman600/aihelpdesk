const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  params?: Record<string, string>;
  stream?: boolean;
};

class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;

  constructor(status: number, message: string, errors?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('helpdesk_token');
}

function setAccessToken(token: string): void {
  localStorage.setItem('helpdesk_token', token);
}

function removeAccessToken(): void {
  localStorage.removeItem('helpdesk_token');
}

async function refreshToken(): Promise<void> {
  const currentToken = getAccessToken();
  if (!currentToken) {
    window.location.href = '/login';
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${currentToken}`,
      },
    });

    if (!res.ok) {
      removeAccessToken();
      window.location.href = '/login';
      return;
    }

    const data = await res.json();
    setAccessToken(data.access_token);
  } catch {
    removeAccessToken();
    window.location.href = '/login';
  }
}

export { ApiError };

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params, stream } = options;
  const url = new URL(BASE_URL + endpoint);

  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const token = getAccessToken();

  const headers: Record<string, string> = {};

  let finalBody: BodyInit | undefined = undefined;
  if (body instanceof URLSearchParams || typeof FormData !== 'undefined' && body instanceof FormData) {
    finalBody = body;
  } else if (body !== undefined && body !== null) {
    headers['Content-Type'] = 'application/json';
    finalBody = JSON.stringify(body);
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: finalBody,
    credentials: 'include',
  });

  if (res.status === 401) {
    await refreshToken();
    const newToken = getAccessToken();
    if (newToken) {
      const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` };
      const retryRes = await fetch(url.toString(), {
        method,
        headers: retryHeaders,
        body: finalBody,
        credentials: 'include',
      });

      if (!retryRes.ok) {
        const err = await retryRes.json().catch(() => ({}));
        throw new ApiError(retryRes.status, err.message || 'Request failed', err.errors);
      }

      if (stream) return retryRes as unknown as T;
      return retryRes.json() as Promise<T>;
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(res.status, err.message || err.detail || 'Request failed', err.errors);
  }

  if (stream) return res as unknown as T;
  return res.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(endpoint: string, params?: Record<string, string>) =>
    request<T>(endpoint, { method: 'GET', params }),

  post: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: 'POST', body }),

  patch: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: 'PATCH', body }),

  put: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, { method: 'PUT', body }),

  delete: <T>(endpoint: string) =>
    request<T>(endpoint, { method: 'DELETE' }),

  stream: (endpoint: string, body: unknown) =>
    request<Response>(endpoint, { method: 'POST', body, stream: true }),
};

export const tokenUtils = {
  get: getAccessToken,
  set: setAccessToken,
  remove: removeAccessToken,
};