/**
 * 错误监控模块
 * 负责捕获和收集各类错误：
 * 1. JavaScript 运行时错误
 * 2. Promise 未处理的异常
 * 3. 资源加载错误
 * 4. API 请求错误
 *
 * 特性：
 * - 错误去重
 * - 错误分类
 * - 完整的错误上下文信息
 * - 支持 XMLHttpRequest 和 Fetch API 拦截
 *
 * @module monitors/error
 * @author Pandeye Team
 * @version 0.1.0
 */

import { EVENT_TYPES, LIMITS } from '../constants';
import { ErrorInfo, ErrorType } from '../types';
import { createErrorInfo, isErrorDuplicate } from '../utils/error';
import { ErrorSampler, SamplingConfig } from '../utils/error-sampler';
import { RetryQueue } from '../utils/retry-queue';

/**
 * 错误监控类
 */
export class ErrorMonitor {
  private errors: ErrorInfo[] = [];
  private readonly maxErrors: number;
  private isMonitoring: boolean = false;
  private retryQueue: RetryQueue<ErrorInfo>;
  private errorSampler: ErrorSampler;

  // 错误处理函数的引用，用于移除事件监听器
  private errorHandler: (event: ErrorEvent) => void;
  private rejectionHandler: (event: PromiseRejectionEvent) => void;
  private retryProcessor: (error: ErrorInfo) => Promise<boolean>;

  /**
   * 创建错误监控实例
   * @param maxErrors - 最大缓存错误数量，默认使用常量配置
   */
  constructor(
    maxErrors: number = LIMITS.MAX_ERROR_RECORDS,
    samplingConfig?: Partial<SamplingConfig>
  ) {
    this.maxErrors = maxErrors;

    // 初始化错误重试队列
    this.retryQueue = new RetryQueue<ErrorInfo>();

    // 初始化错误采样器
    this.errorSampler = new ErrorSampler({
      ...samplingConfig,
      priorityConfig: {
        [EVENT_TYPES.ERROR.JS]: 1.0, // JavaScript错误保持完整采样
        [EVENT_TYPES.ERROR.PROMISE]: 1.0, // Promise错误保持完整采样
        [EVENT_TYPES.ERROR.API]: 0.8, // API错误适当降低采样
        [EVENT_TYPES.ERROR.RESOURCE]: 0.6, // 资源错误可以更多采样
        [EVENT_TYPES.ERROR.CUSTOM]: 0.5, // 自定义错误最低采样
        ...samplingConfig?.priorityConfig,
      },
    });

    // 绑定方法的this指向
    this.errorHandler = this.handleError.bind(this);
    this.rejectionHandler = this.handleRejection.bind(this);
    this.retryProcessor = this.processErrorRetry.bind(this);

    // 初始化监控
    this.init();
  }

  /**
   * 处理错误重试
   * @param error - 需要重试的错误
   * @returns 是否处理成功
   * @private
   */
  private async processErrorRetry(_error: ErrorInfo): Promise<boolean> {
    try {
      // 这里可以实现具体的错误处理逻辑
      // 例如重新发送请求、重新加载资源等
      // 返回 true 表示处理成功，false 表示需要继续重试
      return true;
    } catch (e) {
      console.error('Error retry failed:', e);
      return false;
    }
  }

  /**
   * 处理错误
   * 实现具体的错误处理逻辑
   * @param error - 错误信息
   * @private
   */
  private async processError(error: ErrorInfo): Promise<void> {
    try {
      // 存储到本地存储以防网络问题
      this.storeErrorLocally(error);

      // 尝试发送到远程服务器（如果配置了的话）
      await this.sendErrorToServer(error);

      // 触发自定义事件，允许外部监听和处理
      this.dispatchErrorEvent(error);
    } catch (e) {
      console.error('Failed to process error:', e);
      throw e; // 重新抛出异常以触发重试机制
    }
  }

  /**
   * 将错误存储到本地
   * @param error - 错误信息
   * @private
   */
  private storeErrorLocally(error: ErrorInfo): void {
    try {
      const key = `pandeye_error_${Date.now()}`;
      const storageData = {
        error,
        timestamp: Date.now(),
      };

      localStorage.setItem(key, JSON.stringify(storageData));

      // 清理过期的错误记录（保留最近的100条）
      this.cleanupLocalStorage();
    } catch (e) {
      console.warn('Failed to store error locally:', e);
    }
  }

  /**
   * 清理本地存储中的过期错误记录
   * @private
   */
  private cleanupLocalStorage(): void {
    const maxStorageItems = 100;
    const keys = Object.keys(localStorage)
      .filter(key => key.startsWith('pandeye_error_'))
      .sort((a, b) => parseInt(b.split('_')[2]) - parseInt(a.split('_')[2]));

    if (keys.length > maxStorageItems) {
      keys.slice(maxStorageItems).forEach(key => {
        localStorage.removeItem(key);
      });
    }
  }

  /**
   * 发送错误到远程服务器
   * @param error - 错误信息
   * @private
   */
  private async sendErrorToServer(_error: ErrorInfo): Promise<void> {
    // TODO: 实现发送到具体的错误收集服务器
    // 这里先模拟一个发送过程
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) {
          // 90% 成功率
          resolve();
        } else {
          reject(new Error('Network error'));
        }
      }, 100);
    });
  }

  /**
   * 触发自定义错误事件
   * @param error - 错误信息
   * @private
   */
  private dispatchErrorEvent(error: ErrorInfo): void {
    const event = new CustomEvent('pandeye_error', {
      detail: error,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
  }

  /**
   * 初始化错误监控
   * 设置各类错误的捕获监听器
   * @private
   */
  private init(): void {
    this.startMonitoring();
  }

  /**
   * 开始监控错误
   * @public
   */
  public startMonitoring(): void {
    if (this.isMonitoring) return;

    // 监听JavaScript运行时错误和资源加载错误
    window.addEventListener('error', this.errorHandler, true);

    // 监听未捕获的Promise异常
    window.addEventListener('unhandledrejection', this.rejectionHandler, true);

    // 添加网络请求拦截器
    this.setupXHRInterceptor();
    this.setupFetchInterceptor();

    this.isMonitoring = true;
  }

  /**
   * 停止监控错误
   * @public
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) return;

    window.removeEventListener('error', this.errorHandler, true);
    window.removeEventListener('unhandledrejection', this.rejectionHandler, true);

    this.isMonitoring = false;
  }

  /**
   * 处理一般错误事件
   * 区分JavaScript运行时错误和资源加载错误
   * @param event - 错误事件
   * @private
   */
  private handleError(event: ErrorEvent): void {
    // 检查是否为资源加载错误
    const target = event.target || event.currentTarget;

    if (target instanceof HTMLElement || target instanceof Element) {
      this.handleResourceError(event, target);
    } else if (event.error) {
      // JavaScript运行时错误
      this.captureJsError(event);
    }
  }

  /**
   * 处理JavaScript运行时错误
   * @param event - 错误事件
   * @private
   */
  private captureJsError(event: ErrorEvent): void {
    const errorInfo = createErrorInfo(EVENT_TYPES.ERROR.JS as ErrorType, event.error, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });

    this.addError(errorInfo);
  }

  /**
   * 处理资源加载错误
   * @param event - 错误事件
   * @param target - 发生错误的目标元素
   * @private
   */
  private handleResourceError(event: ErrorEvent, target: Element): void {
    // 确定资源URL
    let resourceUrl = '';
    const tagName = target.tagName.toLowerCase();

    if (target instanceof HTMLImageElement || target instanceof HTMLScriptElement) {
      resourceUrl = target.src;
    } else if (target instanceof HTMLLinkElement) {
      resourceUrl = target.href;
    } else if ('src' in target) {
      // 处理其他可能有src属性的元素
      resourceUrl = (target as any).src;
    }

    if (resourceUrl) {
      const errorInfo = createErrorInfo(
        EVENT_TYPES.ERROR.RESOURCE as ErrorType,
        `Failed to load resource: ${resourceUrl}`,
        {
          filename: resourceUrl,
          extra: { tagName, resourceType: tagName },
        }
      );

      this.addError(errorInfo);
    }
  }

  /**
   * 处理Promise未捕获异常
   * @param event - Promise异常事件
   * @private
   */
  private handleRejection(event: PromiseRejectionEvent): void {
    // 提取有关Promise异常的详细信息
    const errorInfo = createErrorInfo(
      EVENT_TYPES.ERROR.PROMISE as ErrorType,
      event.reason || 'Unhandled Promise rejection'
    );

    this.addError(errorInfo);
  }

  /**
   * 设置XMLHttpRequest拦截器
   * 捕获AJAX请求错误
   * @private
   */
  private setupXHRInterceptor(): void {
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (
      method: string,
      url: string,
      async: boolean = true,
      username?: string | null,
      password?: string | null
    ): void {
      // 保存请求信息以便错误时使用
      (this as any).__pandeyeRequest = { method, url };
      return originalXHROpen.call(this, method, url, async, username, password);
    };

    const addError = this.addError.bind(this);
    const parseResponse = this.tryParseResponse.bind(this);

    XMLHttpRequest.prototype.send = function (
      body?: Document | XMLHttpRequestBodyInit | null
    ): void {
      // 监听请求错误
      this.addEventListener('error', (_event: Event) => {
        const request = (this as any).__pandeyeRequest || {};

        addError(
          createErrorInfo(
            EVENT_TYPES.ERROR.API as ErrorType,
            `XHR request failed: ${request.url}`,
            {
              extra: {
                method: request.method,
                url: request.url,
                status: this.status,
                statusText: this.statusText,
              },
            }
          )
        );
      });

      // 监听状态变化，判断是否是响应错误
      this.addEventListener('load', () => {
        if (this.status >= 400) {
          const request = (this as any).__pandeyeRequest || {};

          addError(
            createErrorInfo(
              EVENT_TYPES.ERROR.API as ErrorType,
              `XHR request failed with status ${this.status}: ${request.url}`,
              {
                extra: {
                  method: request.method,
                  url: request.url,
                  status: this.status,
                  statusText: this.statusText,
                  response: parseResponse(this.responseText),
                },
              }
            )
          );
        }
      });

      return originalXHRSend.call(this, body);
    };
  }

  /**
   * 设置Fetch API拦截器
   * 捕获Fetch请求错误
   * @private
   */
  private setupFetchInterceptor(): void {
    const originalFetch = window.fetch;
    const addError = this.addError.bind(this);

    window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      return originalFetch
        .call(window, input, init)
        .then(response => {
          // 检查响应状态
          if (!response.ok) {
            const url =
              (typeof input === 'string'
                ? input
                : input instanceof Request
                  ? input.url
                  : String(input)) || 'unknown';
            const method = init?.method || 'GET';

            addError(
              createErrorInfo(
                EVENT_TYPES.ERROR.API as ErrorType,
                `Fetch request failed with status ${response.status}: ${url}`,
                {
                  extra: {
                    method,
                    url,
                    status: response.status,
                    statusText: response.statusText,
                  },
                }
              )
            );
          }
          return response;
        })
        .catch(error => {
          // 处理网络错误等
          const url =
            (typeof input === 'string'
              ? input
              : input instanceof Request
                ? input.url
                : String(input)) || 'unknown';
          const method = init?.method || 'GET';

          addError(
            createErrorInfo(
              EVENT_TYPES.ERROR.API as ErrorType,
              error instanceof Error ? error.message : `Fetch request failed: ${url || 'unknown'}`,
              {
                extra: {
                  method,
                  url: url || 'unknown',
                },
              }
            )
          );

          // 重新抛出错误以不影响原有的错误处理
          throw error;
        });
    };
  }

  /**
   * 尝试解析API响应
   * @param response - API响应文本
   * @returns 解析后的对象或原始文本
   * @private
   */
  private tryParseResponse(response: string): unknown {
    try {
      return JSON.parse(response);
    } catch {
      // 如果不是有效的JSON，返回截断的原始文本
      return response.length > 200 ? response.substring(0, 200) + '...' : response;
    }
  }

  /**
   * 主动记录API错误
   * 供外部模块使用，手动上报API错误
   * @param error - 错误对象或信息
   * @param apiInfo - API调用的相关信息
   * @public
   */
  public reportApiError(
    error: unknown,
    apiInfo: { url?: string; method?: string; [key: string]: unknown } = {}
  ): void {
    this.addError(createErrorInfo(EVENT_TYPES.ERROR.API as ErrorType, error, { extra: apiInfo }));
  }

  /**
   * 主动添加自定义错误
   * @param type - 错误类型
   * @param error - 错误信息或对象
   * @param extraInfo - 额外信息
   * @public
   */
  public reportError(
    type: ErrorType,
    error: unknown,
    extraInfo: Record<string, unknown> = {}
  ): void {
    this.addError(createErrorInfo(type, error, { extra: extraInfo }));
  }

  /**
   * 添加错误到错误队列
   * 实现错误去重和队列长度限制
   * @param error - 错误信息
   * @private
   */
  private addError(error: ErrorInfo): void {
    // 首先检查是否需要采样
    if (!this.errorSampler.shouldSample(error.type, error.errorId ?? 'unknown')) {
      return;
    }

    // 记录错误发生以更新频率统计
    this.errorSampler.recordError(error.type);

    // 错误去重检查
    if (isErrorDuplicate(error, this.errors)) {
      return;
    }

    // 队列长度限制
    if (this.errors.length >= this.maxErrors) {
      this.errors.shift();
    }

    // 添加到错误队列
    this.errors.push(error);

    // 尝试处理错误，如果失败则加入重试队列
    this.processError(error).catch(() => {
      // 确保errorId存在，如果不存在则使用时间戳作为备选
      const errorId = error.errorId || `error_${Date.now()}`;
      this.retryQueue.add(errorId, error, this.retryProcessor);
    });
  }

  /**
   * 获取所有收集的错误
   * @returns 错误信息数组
   * @public
   */
  public getErrors(): ErrorInfo[] {
    return [...this.errors];
  }

  /**
   * 清空错误队列
   * 通常在错误上报后调用
   * @public
   */
  public clearErrors(): void {
    this.errors = [];
  }
}
