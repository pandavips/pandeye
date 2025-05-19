import { Monitor } from '@/monitors';
import { ReporterBaseData } from '@/types';
import { Original } from '@/utils';
import { Reporter } from '@/utils/reporter';

/**
 * 错误监控器类
 * 用于捕获和上报页面中的各类错误
 */
export class ErrorMonitor extends Monitor {
  constructor(reporter: Reporter) {
    super(reporter);
    this.init();
  }

  init(): void {
    Original.consoleLog('ErrorMonitor initialized');
  }

  start(): void {
    if (this.isTracking) return;
    this.isTracking = true;

    // 监听全局错误
    window.addEventListener('error', this.handleError, true);
    // 监听 Promise 未捕获的rejection
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  stop(): void {
    if (!this.isTracking) return;
    this.isTracking = false;

    window.removeEventListener('error', this.handleError, true);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  destroy(): void {
    this.stop();
  }

  report(data: ReporterBaseData): void {
    this.reporter.report({
      type: 'error',
      payload: data,
    });
  }

  // 处理运行时错误和资源加载错误
  private handleError = (event: ErrorEvent | Event): void => {
    if (event instanceof ErrorEvent) {
      // JavaScript 运行时错误
      this.report({
        type: 'runtime',
        payload: {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack || '',
        },
        timestamp: Date.now(),
      });
    } else {
      // 资源加载错误
      const target = event.target as HTMLElement;
      if (target && target.tagName) {
        this.report({
          type: 'resource',
          payload: {
            tagName: target.tagName.toLowerCase(),
            source: this.getResourceUrl(target),
            type: target.getAttribute('type') || '',
            id: target.id,
            className: target.className,
          },
          timestamp: Date.now(),
        });
      }
    }
  };

  // 处理未捕获的Promise错误
  private handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
    const reason = event.reason;
    let stack = '';
    let message = '';

    if (reason instanceof Error) {
      message = reason.message;
      stack = reason.stack || '';
    } else {
      message = String(reason);
    }

    this.report({
      type: 'unhandledrejection',
      payload: {
        message,
        stack,
      },
      timestamp: Date.now(),
    });
  };

  // 获取资源URL
  private getResourceUrl(target: HTMLElement): string {
    if (target instanceof HTMLScriptElement || target instanceof HTMLImageElement) {
      return target.src;
    }
    if (target instanceof HTMLLinkElement) {
      return target.href;
    }
    return '';
  }
}
