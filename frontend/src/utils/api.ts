import { API_BASE } from '../services/config';
import { getAuthHeaders, removeToken } from '../services/auth';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// 401 统一处理：清除 token 并跳转登录
function handle401(): ApiResponse {
  removeToken();
  window.location.href = '/login';
  return { success: false, error: '登录已过期' };
}

export async function apiGet<T = any>(endpoint: string): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: getAuthHeaders(),
    });

    if (response.status === 401) return handle401();

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return {
        success: false,
        error: '服务器返回了非 JSON 响应'
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error: any) {
    console.error(`API GET ${endpoint} 失败:`, error);
    return {
      success: false,
      error: error.message || '网络请求失败'
    };
  }
}

export async function apiPost<T = any>(
  endpoint: string,
  body?: any,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
        ...options?.headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });

    if (response.status === 401) return handle401();

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return {
        success: false,
        error: '服务器返回了非 JSON 响应'
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error: any) {
    console.error(`API POST ${endpoint} 失败:`, error);
    return {
      success: false,
      error: error.message || '网络请求失败'
    };
  }
}

export async function apiPut<T = any>(
  endpoint: string,
  body?: any
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 401) return handle401();

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error: any) {
    console.error(`API PUT ${endpoint} 失败:`, error);
    return {
      success: false,
      error: error.message || '网络请求失败'
    };
  }
}

export async function apiDelete<T = any>(
  endpoint: string
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (response.status === 401) return handle401();

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error: any) {
    console.error(`API DELETE ${endpoint} 失败:`, error);
    return {
      success: false,
      error: error.message || '网络请求失败'
    };
  }
}

export { API_BASE };

// 视频因子相关API
export interface VideoFactor {
  id: string;
  projectId: string;
  openingStyle?: string;
  bgmStyle?: string;
  bgmVolume?: number;
  voiceoverStyle?: string;
  voiceoverGender?: string;
  colorTone?: string;
  saturation?: string;
  subtitleStyle?: string;
  subtitlePosition?: string;
  aspectRatio?: string;
  duration?: number;
  sceneCount?: number;
  resolution?: string;
  productName?: string;
  productCategory?: string;
  createdAt: string;
}

export interface PublishingRecord {
  id: string;
  projectId: string;
  videoFactorId?: string;
  platform: string;
  publishedAt: string;
  status: string;
  mockViews: number;
  mockCompletionRate: number;
  mockClickRate: number;
  mockConversionRate: number;
  mockLikes: number;
  mockComments: number;
  mockShares: number;
  experimentId?: string;
  variantId?: string;
  openingStyle?: string;
  bgmStyle?: string;
  voiceoverStyle?: string;
  colorTone?: string;
  aspectRatio?: string;
  duration?: number;
  sceneCount?: number;
}

export async function recordVideoFactors(
  projectId: string,
  factors: Partial<VideoFactor>
): Promise<ApiResponse<VideoFactor>> {
  return apiPost('/api/video-factors/factors', { projectId, ...factors });
}

export async function getVideoFactorsByProject(
  projectId: string
): Promise<ApiResponse<VideoFactor[]>> {
  return apiGet(`/api/video-factors/factors/project/${projectId}`);
}

export async function publishVideo(
  projectId: string,
  options?: {
    platform?: string;
    productName?: string;
    experimentId?: string;
    variantId?: string;
  }
): Promise<ApiResponse<PublishingRecord>> {
  return apiPost('/api/video-factors/publish', { projectId, ...options });
}

export async function getPublishingRecordsByProject(
  projectId: string
): Promise<ApiResponse<PublishingRecord[]>> {
  return apiGet(`/api/video-factors/publish/project/${projectId}`);
}

export async function getPublishingRecordsByExperiment(
  experimentId: string
): Promise<ApiResponse<PublishingRecord[]>> {
  return apiGet(`/api/video-factors/publish/experiment/${experimentId}`);
}

export async function getVideoFactorStats(): Promise<
  ApiResponse<{
    totalVideos: number;
    totalPublished: number;
    totalViews: number;
    avgCompletionRate: number;
    avgConversionRate: number;
  }>
> {
  return apiGet('/api/video-factors/stats');
}
