import { API_BASE_URL } from './config';

export interface OneClickOptions {
  resolution?: string;
  ratio?: string;
  enableTTS?: boolean;
  transition?: string;
}

export interface OneClickStatus {
  status: string;
  progress: number;
  phase: string;
  message: string;
  videoUrl?: string;
  script?: any;
  productInfo?: any;
}

export class OneClickService {
  static async generate(params: {
    productLink?: string;
    productImage?: string;
    productInfo?: any;
    templateId?: string;
    referenceVideoId?: string;
    options?: OneClickOptions;
  }): Promise<{ success: boolean; taskId?: string; error?: string }> {
    const res = await fetch(`${API_BASE_URL}/api/one-click/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await res.json();
  }

  static async getStatus(taskId: string): Promise<{ success: boolean; data?: OneClickStatus; error?: string }> {
    const res = await fetch(`${API_BASE_URL}/api/one-click/status/${taskId}`);
    return await res.json();
  }

  static async subscribe(taskId: string, onUpdate: (status: OneClickStatus) => void): Promise<() => void> {
    const eventSource = new EventSource(`${API_BASE_URL}/api/one-click/stream/${taskId}`);
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onUpdate(data);
      } catch (e) {
        console.warn('SSE parse error:', e);
      }
    };
    eventSource.onerror = (err) => {
      console.warn('SSE error:', err);
      eventSource.close();
    };
    return () => eventSource.close();
  }
}
