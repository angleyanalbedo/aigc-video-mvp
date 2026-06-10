import { API_BASE_URL, authFetch } from './config';

export interface TemplateFactor {
  opening?: string;
  closing?: string;
  visual?: string;
  voiceover?: string;
  bgm?: string;
  color_tone?: string;
  [key: string]: string | undefined;
}

export interface InspirationTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  strategy: string;
  factors: TemplateFactor;
  constraintRules?: string;
  sourceVideoIds?: string[];
  usageCount?: number;
  rating?: number;
  thumbnailUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class TemplateService {
  static async getAll(params?: {
    category?: string;
    keyword?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ success: boolean; data: InspirationTemplate[] }> {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.keyword) query.set('keyword', params.keyword);
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());

    const res = await authFetch(`${API_BASE_URL}/api/templates?${query}`);
    return await res.json();
  }

  static async getById(id: string): Promise<{ success: boolean; data?: InspirationTemplate; error?: string }> {
    const res = await authFetch(`${API_BASE_URL}/api/templates/${id}`);
    return await res.json();
  }

  static async create(data: Partial<InspirationTemplate>): Promise<{ success: boolean; data?: InspirationTemplate; error?: string }> {
    const res = await authFetch(`${API_BASE_URL}/api/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await res.json();
  }

  static async update(id: string, data: Partial<InspirationTemplate>): Promise<{ success: boolean; data?: InspirationTemplate; error?: string }> {
    const res = await authFetch(`${API_BASE_URL}/api/templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await res.json();
  }

  static async delete(id: string): Promise<{ success: boolean }> {
    const res = await authFetch(`${API_BASE_URL}/api/templates/${id}`, { method: 'DELETE' });
    return await res.json();
  }

  static async extractFromVideos(videoIds: string[]): Promise<{ success: boolean; data?: InspirationTemplate; error?: string }> {
    const res = await authFetch(`${API_BASE_URL}/api/templates/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoIds }),
    });
    return await res.json();
  }

  static async generateScript(templateId: string, productInfo: any): Promise<{ success: boolean; data?: any; error?: string }> {
    const res = await authFetch(`${API_BASE_URL}/api/templates/${templateId}/generate-script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productInfo }),
    });
    return await res.json();
  }

  static async getCategories(): Promise<{ success: boolean; data: string[] }> {
    const res = await authFetch(`${API_BASE_URL}/api/templates/categories`);
    return await res.json();
  }
}
