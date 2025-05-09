import { ErrorInfo } from '../types';

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

  private handleJsError(): void {
    window.addEventListener('error', (event) => {
      if (event.error) {
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

  private handleResourceError(): void {
    window.addEventListener('error', (event) => {
      const target = event.target as HTMLElement;
      if (target && (target.src || target.href)) {
        this.addError({
          type: 'resource',
          message: `Failed to load ${target.src || target.href}`,
          filename: target.src || target.href,
          timestamp: Date.now()
        });
      }
    }, true);
  }

  public handleApiError(error: any): void {
    this.addError({
      type: 'api',
      message: error.message || '请求失败',
      stack: error.stack,
      timestamp: Date.now()
    });
  }

  private addError(error: ErrorInfo): void {
    if (this.errors.length >= this.maxErrors) {
      this.errors.shift();
    }
    this.errors.push(error);
  }

  public getErrors(): ErrorInfo[] {
    return this.errors;
  }

  public clearErrors(): void {
    this.errors = [];
  }
}
