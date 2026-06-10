import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios'
import { getToken, removeToken } from './services/auth'
import App from './App.tsx'

// ====== 全局认证注入 ======

// axios 拦截器
axios.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      removeToken()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// 全局 fetch 包装：自动注入 Authorization header
const originalFetch = window.fetch;
window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = getToken();
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  // 登录/验证/健康检查接口不注入 token
  const skipAuth = url.includes('/api/auth/') || url.includes('/api/health');
  const headers: Record<string, string> = {};

  if (token && !skipAuth) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const mergedInit: RequestInit = {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers as Record<string, string> || {}),
    },
  };

  const response = await originalFetch.call(window, input, mergedInit);

  if (response.status === 401 && !skipAuth) {
    removeToken();
    window.location.href = '/login';
  }

  return response;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
