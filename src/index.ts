import { BehaviorMonitor } from './monitors/behavior';
import { PerformanceMonitor } from './monitors/performance';
import { ErrorMonitor } from './monitors/error';
import { Reporter } from './utils/reporter';
import { PandeyeOptions, ManualReportData } from './types';

/**
 * Pandeye监控系统主类
 * 整合行为、性能、错误监控等功能
 */
export class Pandeye {
  private static instance: Pandeye;
  private options: PandeyeOptions;
  private reporter: Reporter;
  private behaviorMonitor?: BehaviorMonitor;
  private performanceMonitor?: PerformanceMonitor;
  private errorMonitor?: ErrorMonitor;
  private reportTimer?: number;

  /**
   * 创建Pandeye实例
   * 使用单例模式确保只有一个监控实例
   */
  private constructor(options: PandeyeOptions) {
    // 必填选项检查
    if (!options.appId) {
      throw new Error('appId is required');
    }

    // 设置默认选项
    const defaultOptions = {
      env: 'prod',
      reportUrl: 'https://monitor-api.example.com/report',
      reportTime: 'beforeunload' as const,
      autoStart: true,
      enablePerformance: true,
      enableError: true,
      enableBehavior: true,
      enableConsole: false,
    };

    // 合并用户选项
    this.options = {
      ...defaultOptions,
      ...options
    };

    this.reporter = new Reporter(this.options.reportUrl!);
    
    if (this.options.autoStart) {
      this.start();
    }
  }

  /**
   * 获取Pandeye实例
   * @param options 配置选项
   */
  public static getInstance(options: PandeyeOptions): Pandeye {
    if (!Pandeye.instance) {
      Pandeye.instance = new Pandeye(options);
    }
    return Pandeye.instance;
  }

  /**
   * 启动监控系统
   */
  public start(): void {
    // 初始化各个监控模块
    if (this.options.enableBehavior) {
      this.behaviorMonitor = new BehaviorMonitor();
    }

    if (this.options.enablePerformance) {
      this.performanceMonitor = new PerformanceMonitor();
    }

    if (this.options.enableError) {
      this.errorMonitor = new ErrorMonitor();
    }

    if (this.options.enableConsole) {
      this.setupConsoleMonitor();
    }

    // 设置数据上报
    this.setupReporting();
  }

  /**
   * 设置控制台日志监控
   */
  private setupConsoleMonitor(): void {
    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error
    };

    // 代理console方法
    type ConsoleMethod = keyof typeof originalConsole;
    ['log', 'info', 'warn', 'error'].forEach(level => {
      const method = level as ConsoleMethod;
      console[method] = (...args: any[]) => {
        // 调用原始方法
        originalConsole[method].apply(console, args);

        // 记录日志
        this.reporter.report({
          appId: this.options.appId,
          env: this.options.env,
          timestamp: Date.now(),
          type: 'console',
          data: {
            level,
            messages: args.map(arg => {
              try {
                return JSON.stringify(arg);
              } catch {
                return String(arg);
              }
            })
          }
        });
      };
    });
  }

  /**
   * 设置数据上报机制
   */
  private setupReporting(): void {
    const reportData = async () => {
      const data = {
        appId: this.options.appId,
        timestamp: Date.now(),
        customData: this.options.customReport || {},
        behavior: this.behaviorMonitor?.getBehaviors() || [],
        performance: this.performanceMonitor?.getMetrics() || null,
        errors: this.errorMonitor?.getErrors() || []
      };

      await this.reporter.report({
        appId: this.options.appId,
        env: this.options.env,
        timestamp: Date.now(),
        type: 'batch',
        data
      });

      // 清理已上报的数据
      this.behaviorMonitor?.clearBehaviors();
      this.errorMonitor?.clearErrors();
    };

    // 根据配置设置上报时机
    if (typeof this.options.reportTime === 'number') {
      // 定时上报
      this.reportTimer = window.setInterval(reportData, this.options.reportTime);
    } else if (this.options.reportTime === 'beforeunload') {
      // 页面关闭前上报
      window.addEventListener('beforeunload', () => {
        reportData();
      });
    } else {
      // 实时上报，不需要特殊处理，数据会立即通过reporter发送
    }
  }

  /**
   * 手动触发数据上报
   */
  public async flush(): Promise<void> {
    await this.reporter.flush();
  }

  /**
   * 停止监控
   */
  public stop(): void {
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
    }
  }

  /**
   * 手动记录自定义事件
   * @param eventName 事件名称
   * @param data 事件数据
   */
  public trackEvent(eventName: string, data: any): void {
    if (this.behaviorMonitor) {
      this.behaviorMonitor.trackCustomEvent(eventName, data);
    }
  }

  /**
   * 主动上报数据
   * @param data 要上报的数据
   */
  public report(data: ManualReportData): void {
    this.reporter.report({
      appId: this.options.appId,
      env: this.options.env,
      timestamp: Date.now(),
      type: 'manual',
      data
    });
  }

  /**
   * 主动批量上报数据
   * @param dataList 要上报的数据列表
   */
  public batchReport(dataList: ManualReportData[]): void {
    const timestamp = Date.now();
    dataList.forEach(data => {
      this.reporter.report({
        appId: this.options.appId,
        env: this.options.env,
        timestamp,
        type: 'manual',
        data
      });
    });
  }

  public getData(): any {
    return {
      behavior: this.behaviorMonitor?.getBehaviors() || [],
      performance: this.performanceMonitor?.getMetrics() || null,
      errors: this.errorMonitor?.getErrors() || []
    };
  }
}

// 导出类型定义
export * from './types';
