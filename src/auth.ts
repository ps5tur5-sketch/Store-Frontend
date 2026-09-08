import { ref } from 'vue';
import { api, authApi, authTokenKey, ApiError } from './api';
import type { AccountUser, Cart } from './types';

export const accountUser = ref<AccountUser>();
export const cartCount = ref(0);
export const authReady = ref(false);

let authGeneration = 0;
let pendingRefresh:
  { token: string; generation: number; promise: Promise<AccountUser | undefined> } | undefined;
export async function refreshAccount(): Promise<AccountUser | undefined> {
  const token = localStorage.getItem(authTokenKey);
  if (!token) {
    accountUser.value = undefined;
    cartCount.value = 0;
    authReady.value = true;
    return;
  }
  if (pendingRefresh?.token === token && pendingRefresh.generation === authGeneration)
    return pendingRefresh.promise;
  const generation = authGeneration;
  const request = (async () => {
    try {
      const result = await authApi<{ user: AccountUser }>('/api/account');
      if (generation !== authGeneration || localStorage.getItem(authTokenKey) !== token)
        return accountUser.value;
      accountUser.value = result.user;
      await refreshCartCount();
      return result.user;
    } catch (error) {
      if (generation !== authGeneration || localStorage.getItem(authTokenKey) !== token)
        return accountUser.value;
      if (error instanceof ApiError && error.status === 401) {
        localStorage.removeItem(authTokenKey);
        accountUser.value = undefined;
        cartCount.value = 0;
        return;
      }
      throw error;
    } finally {
      if (generation === authGeneration) authReady.value = true;
    }
  })();
  pendingRefresh = { token, generation, promise: request };
  try {
    return await request;
  } finally {
    if (pendingRefresh?.promise === request) pendingRefresh = undefined;
  }
}

export async function register(
  username: string,
  password: string,
  role: 'buyer' | 'seller' = 'buyer',
  storeName?: string,
): Promise<AccountUser> {
  const result = await api<{ token: string; user: AccountUser }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, role, store_name: role === 'seller' ? storeName : undefined }),
  });
  authGeneration++;
  localStorage.setItem(authTokenKey, result.token);
  accountUser.value = result.user;
  cartCount.value = 0;
  authReady.value = true;
  return result.user;
}

export async function login(username: string, password: string): Promise<AccountUser> {
  const result = await api<{ token: string; user: AccountUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  authGeneration++;
  localStorage.setItem(authTokenKey, result.token);
  accountUser.value = result.user;
  authReady.value = true;
  await refreshCartCount();
  return result.user;
}

export async function logout(): Promise<void> {
  authGeneration++;
  try {
    await authApi('/api/auth/logout', { method: 'POST', body: '{}' });
  } catch {
    /* local logout still proceeds */
  }
  localStorage.removeItem(authTokenKey);
  accountUser.value = undefined;
  cartCount.value = 0;
}

export async function refreshCartCount(): Promise<void> {
  if (!localStorage.getItem(authTokenKey) || !accountUser.value?.can_buy) {
    cartCount.value = 0;
    return;
  }
  const cart = await authApi<Cart>('/api/cart');
  cartCount.value = cart.item_count;
}

export async function becomeSeller(storeName: string) {
  const result = await authApi<{ user: AccountUser }>('/api/account/seller', {
    method: 'POST',
    body: JSON.stringify({ store_name: storeName }),
  });
  authGeneration++;
  accountUser.value = result.user;
  await refreshCartCount();
  return result.user;
}
