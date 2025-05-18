import { Monitor } from '@/monitors';
import { Original } from '@/utils';
import { Reporter } from '@/utils/reporter';

interface NetworkRequestInfo {
  method: string;
  url: string;
  body?: any;
  headers?: Record<string, string>;
  startTime: number;
  status?: number;
  statusText?: string;
  response?: any;
  endTime?: number;
  duration?: number;
  error?: Error;
}

/**
 * 网络监控
 * 监控XMLHttpRequest和fetch请求
 */
export class NetworkMonitor extends Monitor {
  private originalXHR: typeof XMLHttpRequest;
  private originalFetch: typeof fetch;

  constructor(reporter: Reporter) {
    super(reporter);
    this.originalXHR = Original.XMLHttpRequest;
    this.originalFetch = Original.fetch;
    this.init();
  }

  init(): void {
    Original.consoleLog('NetworkMonitor initialized');
  }

  start(): void {
    if (this.isTracking) return;
    this.isTracking = true;
    this.overrideXHR();
    this.overrideFetch();
  }

  stop(): void {
    if (!this.isTracking) return;
    this.isTracking = false;
    window.XMLHttpRequest = this.originalXHR;
    window.fetch = this.originalFetch;
  }

  destroy(): void {
    this.stop();
  }

  report(data: any): void {
    this.reporter.report({
      type: 'network',
      payload: data,
    });
  }

  private overrideXHR(): void {
    const self = this;
    const XHR = this.originalXHR;

    window.XMLHttpRequest = function () {
      const xhr = new XHR();
      const requestInfo: NetworkRequestInfo = {
        method: '',
        url: '',
        startTime: 0,
      };

      // 重写 open 方法
      const originalOpen = xhr.open;
      xhr.open = function (method: string, url: string) {
        requestInfo.method = method;
        requestInfo.url = url;
        return originalOpen.apply(this, arguments as any);
      };

      // 重写 send 方法
      const originalSend = xhr.send;
      xhr.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
        requestInfo.startTime = Date.now();
        requestInfo.body = body;

        // 监听加载完成
        xhr.addEventListener('load', () => {
          const endTime = Date.now();
          requestInfo.endTime = endTime;
          requestInfo.duration = endTime - requestInfo.startTime;
          requestInfo.status = xhr.status;
          requestInfo.statusText = xhr.statusText;
          requestInfo.response = self.parseResponse(xhr.responseType, xhr.response);

          self.report({
            type: 'xhr',
            ...requestInfo,
          });
        });

        // 监听错误
        xhr.addEventListener('error', () => {
          const endTime = Date.now();
          requestInfo.endTime = endTime;
          requestInfo.duration = endTime - requestInfo.startTime;
          requestInfo.error = new Error('XHR request failed');

          self.report({
            type: 'xhr_error',
            ...requestInfo,
          });
        });

        // 监听abort
        xhr.addEventListener('abort', () => {
          const endTime = Date.now();
          requestInfo.endTime = endTime;
          requestInfo.duration = endTime - requestInfo.startTime;

          self.report({
            type: 'xhr_abort',
            ...requestInfo,
          });
        });

        return originalSend.apply(this, arguments as any);
      };

      return xhr;
    } as unknown as typeof XMLHttpRequest;
  }

  private overrideFetch(): void {
    const self = this;

    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
      const headers = init?.headers as Record<string, string>;

      const startTime = Date.now();
      const url = input instanceof Request ? input.url : input.toString();
      const method = init?.method || (input instanceof Request ? input.method : 'GET');

      const requestInfo: NetworkRequestInfo = {
        method,
        url,
        startTime,
        body: init?.body,
        headers: headers,
      };

      try {
        const response = await Original.fetch(input, init);
        const endTime = Date.now();
        const duration = endTime - startTime;

        const responseData = {
          ...requestInfo,
          endTime,
          duration,
          status: response.status,
          statusText: response.statusText,
          response: await self.cloneResponse(response),
        };

        self.report({
          type: 'fetch',
          ...responseData,
        });

        return response;
      } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;

        self.report({
          type: 'fetch_error',
          ...requestInfo,
          endTime,
          duration,
          error,
        });

        throw error;
      }
    } as typeof fetch;
  }

  private async cloneResponse(response: Response): Promise<any> {
    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.clone().json();
      }
      if (contentType?.includes('text/')) {
        return await response.clone().text();
      }
      return null;
    } catch {
      return null;
    }
  }

  private parseResponse(type: string, response: any): any {
    try {
      if (type === 'json') {
        return typeof response === 'string' ? JSON.parse(response) : response;
      }
      return response;
    } catch {
      return response;
    }
  }
}
