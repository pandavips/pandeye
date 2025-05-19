import { Monitor } from '@/monitors';
import { ReporterBaseData } from '@/types';
import { Original } from '@/utils';
import { Reporter } from '@/utils/reporter';

/** 需要被监控/覆盖的控制台方法列表 */
const METHOD_KEYS: (keyof Console)[] = [
  // 'debug',
  'error',
  'info',
  'log',
  'warn',
  // 'dir',
  // 'dirxml',
  // 'table',
  // 'trace',
  // 'group',
  // 'groupCollapsed',
  // 'groupEnd',
  // 'clear',
  // 'count',
  // 'countReset',
  // 'assert',
  // 'time',
  // 'timeLog',
  // 'timeEnd',
  // 'timeStamp',
];

/**
 * ConsoleMonitor类
 * 通过覆盖原生控制台方法来监控和捕获控制台输出
 */
export class ConsoleMonitor extends Monitor {
  /** 原始控制台对象的引用 */
  private originalConsole: Record<string, unknown> = {};
  /**
   * 构造函数初始化监控器
   */
  constructor(reporter: Reporter) {
    super(reporter);
    this.init();
  }
  init(): void {
    this.overrideConsoleMethods();
    Original.consoleLog('ConsoleMonitor initialized');
  }
  start(): void {
    this.isTracking = true;
  }
  stop(): void {
    this.isTracking = false;
  }
  report(data: ReporterBaseData): void {
    this.reporter.report({
      type: 'console',
      payload: data,
    });
  }
  private safeStringify(obj: object): string {
    try {
      return JSON.stringify(obj);
    } catch (err) {
      return `stringify error for ${String(obj)}: ${err}`;
    }
  }
  private overrideConsoleMethods(): void {
    METHOD_KEYS.forEach((method: keyof Console) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const original = window.console[method] as any;
      this.originalConsole[method] = original; // 保存原始方法
      window.console[method] = (...args: unknown[]) => {
        const result = original.apply(window.console, args);
        if (this.isTracking) {
          this.report({
            type: method,
            payload: {
              args: this.safeStringify(args),
              result,
            },
            timestamp: Date.now(),
          });
        }
        return result;
      };
    });
  }

  public destroy(): void {
    // 还原所有被覆盖的原始方法
    METHOD_KEYS.forEach((method: keyof Console) => {
      window.console[method] = this.originalConsole[method] as never;
    });
    this.isTracking = false;
  }
}
