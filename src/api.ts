const configuredBase = window.__APP_CONFIG__?.API_BASE_URL ?? import.meta.env.VITE_API_BASE_URL ?? '';
export const apiBase = configuredBase.replace(/\/$/, '');

export const authTokenKey = 'game_goods_auth_token';

export function authorizationHeaders(): Record<string, string> {
  const token = localStorage.getItem(authTokenKey);
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body?.error === 'string' ? body.error : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}

export function authApi<T>(path: string, init?: RequestInit): Promise<T> {
  return api<T>(path, {
    ...init,
    headers: { ...authorizationHeaders(), ...init?.headers },
  });
}
