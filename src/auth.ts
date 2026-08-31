import { ref } from 'vue';
import { api, authApi, authTokenKey } from './api';
import type { AccountUser, Cart } from './types';

export const accountUser = ref<AccountUser>();
export const cartCount = ref(0);
export const authReady = ref(false);

export async function refreshAccount(): Promise<AccountUser | undefined> {
  const token = localStorage.getItem(authTokenKey);
  if (!token) {
    accountUser.value = undefined;
    cartCount.value = 0;
    authReady.value = true;
    return undefined;
  }
  try {
    const [account, cart] = await Promise.all([
      authApi<{ user: AccountUser }>('/api/account'),
      authApi<Cart>('/api/cart'),
    ]);
    accountUser.value = account.user;
    cartCount.value = cart.item_count;
    return account.user;
  } catch {
    localStorage.removeItem(authTokenKey);
    accountUser.value = undefined;
    cartCount.value = 0;
    return undefined;
  } finally {
    authReady.value = true;
  }
}

export async function register(username: string, password: string): Promise<AccountUser> {
  const result = await api<{ token: string; user: AccountUser }>('/api/auth/register', {
    method: 'POST', body: JSON.stringify({ username, password }),
  });
  localStorage.setItem(authTokenKey, result.token);
  accountUser.value = result.user;
  cartCount.value = 0;
  authReady.value = true;
  return result.user;
}

export async function login(username: string, password: string): Promise<AccountUser> {
  const result = await api<{ token: string; user: AccountUser }>('/api/auth/login', {
    method: 'POST', body: JSON.stringify({ username, password }),
  });
  localStorage.setItem(authTokenKey, result.token);
  accountUser.value = result.user;
  authReady.value = true;
  await refreshCartCount();
  return result.user;
}

export async function logout(): Promise<void> {
  try { await authApi('/api/auth/logout', { method: 'POST', body: '{}' }); } catch { /* local logout still proceeds */ }
  localStorage.removeItem(authTokenKey);
  accountUser.value = undefined;
  cartCount.value = 0;
}

export async function refreshCartCount(): Promise<void> {
  if (!localStorage.getItem(authTokenKey)) {
    cartCount.value = 0;
    return;
  }
  const cart = await authApi<Cart>('/api/cart');
  cartCount.value = cart.item_count;
}
