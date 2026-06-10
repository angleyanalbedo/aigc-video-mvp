import { getAuthHeaders, removeToken } from './auth';

export const API_BASE_URL = import.meta.env.VITE_API_BASE || '';
export const API_BASE = API_BASE_URL;

/**
 * 带认证的 fetch 包装函数，自动注入 Authorization header
 * 401 时自动清除 token 并跳转登录页
 */
export async function authFetch(input: string, init?: RequestInit): Promise<Response> {
  const headers = {
    ...getAuthHeaders(),
    ...init?.headers,
  };
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401) {
    removeToken();
    window.location.href = '/login';
  }
  return response;
}
