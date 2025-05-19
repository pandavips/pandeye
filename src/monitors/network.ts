import { Monitor } from '@/monitors';
import { Original } from '@/utils';
import { Reporter } from '@/utils/reporter';

interface NetworkReportData extends NetworkRequestInfo {
  type: 'xhr' | 'xhr_error' | 'xhr_abort' | 'fetch' | 'fetch_error';
}

interface NetworkRequestInfo {
  method: string;
  url: string;
  body?: Document | XMLHttpRequestBodyInit | BodyInit | null;
  headers?: Record<string, string>;
  startTime: number;
  status?: number;
  statusText?: string;
  response?: unknown;
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

  override report(data: NetworkReportData): void {
    this.reporter.report({
      type: 'network',
      payload: data,
    });
  }

  private overrideXHR(): void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
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

      xhr.open = function (
        method: string,
        url: string | URL,
        async = true,
        username?: string | null | undefined,
        password?: string | null | undefined
      ) {
        requestInfo.method = method;
        requestInfo.url = url.toString();
        return originalOpen.apply(this, [method, url, !!async, username, password]);
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
          } as NetworkReportData);
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
          } as NetworkReportData);
        });

        // 监听abort
        xhr.addEventListener('abort', () => {
          const endTime = Date.now();
          requestInfo.endTime = endTime;
          requestInfo.duration = endTime - requestInfo.startTime;

          self.report({
            type: 'xhr_abort',
            ...requestInfo,
          } as NetworkReportData);
        });

        return originalSend.apply(this, body === undefined ? [] : [body]);
      };

      return xhr;
    } as unknown as typeof XMLHttpRequest;
  }

  private overrideFetch(): void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
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
        } as NetworkReportData);

        return response;
      } catch (error: unknown) {
        const endTime = Date.now();
        const duration = endTime - startTime;

        self.report({
          type: 'fetch_error',
          ...requestInfo,
          endTime,
          duration,
          error: error instanceof Error ? error : new Error('Unknown error occurred'),
        } as NetworkReportData);

        throw error;
      }
    } as typeof fetch;
  }

  private async cloneResponse(response: Response): Promise<unknown> {
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

  private parseResponse(type: string, response: unknown): unknown {
    try {
      if (type === 'json' && typeof response === 'string') {
        return JSON.parse(response);
      }
      return response;
    } catch {
      return response;
    }
  }
}
