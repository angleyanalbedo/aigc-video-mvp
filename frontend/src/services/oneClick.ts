import { API_BASE_URL } from './config';

export interface OneClickOptions {
  resolution?: string;
  ratio?: string;
  enableTTS?: boolean;
  transition?: string;
  sceneCount?: number;
}

export interface OneClickStatus {
  status: string;
  progress: number;
  phase: string;
  message: string;
  videoUrl?: string;
  script?: any;
  productInfo?: any;
  error?: string;
  duration?: number;
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

  static async getStatus(taskId: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/api/one-click/status/${taskId}`);
    return await res.json();
  }

  static async subscribe(
    taskId: string,
    onUpdate: (status: OneClickStatus) => void,
    onError?: (err: any) => void
  ): Promise<() => void> {
    let active = true;
    let eventSource: EventSource | null = null;
    let pollInterval: any = null;

    const startPolling = () => {
      if (pollInterval) return;
      console.log(`[OneClickService] SSE failed, starting robust HTTP polling fallback for taskId: ${taskId}`);
      pollInterval = setInterval(async () => {
        if (!active) {
          clearInterval(pollInterval);
          return;
        }
        try {
          const res = await this.getStatus(taskId);
          if (res && res.success) {
            const { success, ...statusData } = res;
            onUpdate(statusData as OneClickStatus);
            if (statusData.status === 'completed' || statusData.status === 'failed') {
              clearInterval(pollInterval);
            }
          }
        } catch (err) {
          console.warn('[OneClickService] Polling fetch error:', err);
        }
      }, 2000);
    };

    try {
      eventSource = new EventSource(`${API_BASE_URL}/api/one-click/stream/${taskId}`);
      eventSource.onmessage = (event) => {
        if (!active) return;
        try {
          const data = JSON.parse(event.data);
          onUpdate(data);
        } catch (e) {
          console.warn('[OneClickService] SSE parse error:', e);
        }
      };

      eventSource.onerror = (err) => {
        if (!active) return;
        console.warn('[OneClickService] SSE connection failed, falling back to HTTP polling...', err);
        if (eventSource) {
          eventSource.close();
        }
        if (onError) onError(err);
        startPolling();
      };
    } catch (err) {
      console.warn('[OneClickService] Failed to initialize SSE, using HTTP polling directly:', err);
      if (onError) onError(err);
      startPolling();
    }

    return () => {
      active = false;
      if (eventSource) {
        eventSource.close();
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }
}
