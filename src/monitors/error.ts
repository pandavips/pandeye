import { ErrorInfo } from '../types';

/**
 * 错误监控类
 * 负责捕获和收集各类错误：
 * 1. JavaScript 运行时错误
 * 2. Promise 未处理的异常
 * 3. 资源加载错误
 * 4. API 请求错误
 */
export class ErrorMonitor {
  private errors: ErrorInfo[] = [];
  private maxErrors: number = 100;

  constructor() {
    this.init();
  }

  private init(): void {
    this.handleJsError();
    this.handlePromiseError();
    this.handleResourceError();
  }

  /**
   * 处理 JavaScript 运行时错误
   * @private
   */
  private handleJsError(): void {
    window.addEventListener('error', (event) => {
      // 过滤掉资源加载错误
      if (event.error && !event.filename?.includes('://')) {
        this.addError({
          type: 'js',
          message: event.error.message,
          stack: event.error.stack,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          timestamp: Date.now()
        });
      }
    }, true);
  }

  /**
   * 处理 Promise 未捕获的异常
   * @private
   */
  private handlePromiseError(): void {
    window.addEventListener('unhandledrejection', (event) => {
      this.addError({
        type: 'promise',
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        timestamp: Date.now()
      });
    });
  }

  /**
   * 处理资源加载错误
   * 包括图片、脚本、样式表等静态资源
   * @private
   */
  private handleResourceError(): void {
    window.addEventListener('error', (event) => {
      const target = event.target;
      // 检查是否是资源加载错误
      if (target instanceof HTMLElement) {
        const src = (target as HTMLImageElement | HTMLScriptElement).src 
                   || (target as HTMLLinkElement).href;
        if (src) {
          this.addError({
            type: 'resource',
            message: `Failed to load resource: ${src}`,
            filename: src,
            timestamp: Date.now()
          });
        }
      }
    }, true);
  }

  /**
   * 处理 API 请求错误
   * @param error API错误对象
   * @public
   */
  public handleApiError(error: Error | { message?: string; stack?: string }): void {
    this.addError({
      type: 'api',
      message: error.message || '请求失败',
      stack: error.stack,
      timestamp: Date.now()
    });
  }

  /**
   * 添加错误到错误队列
   * 当队列达到最大长度时，移除最早的错误
   * @param error 错误信息
   * @private
   */
  private addError(error: ErrorInfo): void {
    if (this.errors.length >= this.maxErrors) {
      this.errors.shift();
    }
    this.errors.push(error);
  }

  /**
   * 获取所有收集的错误
   * @returns 错误信息数组
   * @public
   */
  public getErrors(): ErrorInfo[] {
    return this.errors;
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
