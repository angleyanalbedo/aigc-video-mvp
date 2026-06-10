import { API_BASE_URL, authFetch } from './config';

export interface VideoLibraryItem {
  id: string;
  title: string;
  sourceUrl?: string;
  platform?: string;
  category?: string;
  tags?: string[];
  thumbnailUrl?: string;
  videoUrl?: string;
  hookTechnique?: string;
  sellingPoints?: string;
  shotAnalysis?: string;
  styleAnalysis?: string;
  structureAnalysis?: string;
  fullAnalysis?: any;
  duration?: number;
  viewCount?: number;
  likeCount?: number;
  sourceDeclaration?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VideoLibraryStats {
  total: number;
  byCategory: Record<string, number>[];
  byPlatform: Record<string, number>[];
  analyzed: number;
}

export class VideoLibraryService {
  static async getAll(params?: {
    category?: string;
    keyword?: string;
    platform?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ success: boolean; data: VideoLibraryItem[] }> {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.keyword) query.set('keyword', params.keyword);
    if (params?.platform) query.set('platform', params.platform);
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());

    const res = await authFetch(`${API_BASE_URL}/api/video-library?${query}`);
    return await res.json();
  }

  static async getById(id: string): Promise<{ success: boolean; data?: VideoLibraryItem; error?: string }> {
    const res = await authFetch(`${API_BASE_URL}/api/video-library/${id}`);
    return await res.json();
  }

  static async create(data: Partial<VideoLibraryItem>): Promise<{ success: boolean; data?: VideoLibraryItem; error?: string }> {
    const res = await authFetch(`${API_BASE_URL}/api/video-library`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await res.json();
  }

  static async update(id: string, data: Partial<VideoLibraryItem>): Promise<{ success: boolean; data?: VideoLibraryItem; error?: string }> {
    const res = await authFetch(`${API_BASE_URL}/api/video-library/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await res.json();
  }

  static async delete(id: string): Promise<{ success: boolean }> {
    const res = await authFetch(`${API_BASE_URL}/api/video-library/${id}`, { method: 'DELETE' });
    return await res.json();
  }

  static async analyze(id: string): Promise<{ success: boolean; data?: any; error?: string }> {
    const res = await authFetch(`${API_BASE_URL}/api/video-library/${id}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return await res.json();
  }

  static async getStats(): Promise<{ success: boolean; data?: VideoLibraryStats }> {
    const res = await authFetch(`${API_BASE_URL}/api/video-library/stats`);
    return await res.json();
  }

  static async getCategories(): Promise<{ success: boolean; data: string[] }> {
    const res = await authFetch(`${API_BASE_URL}/api/video-library/categories`);
    return await res.json();
  }
}
