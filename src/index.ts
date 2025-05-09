import { PandeyeOptions } from './types';
import { PerformanceMonitor } from './monitors/performance';
import { ErrorMonitor } from './monitors/error';
import { BehaviorMonitor } from './monitors/behavior';
import { Reporter } from './utils/reporter';

class Pandeye {
  private options: PandeyeOptions;
  private reporter: Reporter;
  private performanceMonitor: PerformanceMonitor;
  private errorMonitor: ErrorMonitor;
  private behaviorMonitor: BehaviorMonitor;
  private reportTimer: number | null = null;

  constructor(options: PandeyeOptions) {
    this.options = {
      reportUrl: 'https://report.pandeye.com/collect',
      reportTime: 'immediately',
      autoStart: true,
      enablePerformance: true,
      enableError: true,
      enableBehavior: true,
      enableConsole: false,
      ...options
    };

    this.reporter = new Reporter(this.options.reportUrl);
    this.init();

    if (this.options.autoStart) {
      this.start();
    }
  }

  private init(): void {
    // 初始化各个监控模块
    if (this.options.enablePerformance) {
      this.performanceMonitor = new PerformanceMonitor();
    }

    if (this.options.enableError) {
      this.errorMonitor = new ErrorMonitor();
    }

    if (this.options.enableBehavior) {
      this.behaviorMonitor = new BehaviorMonitor();
    }

    // 设置定时上报
    if (typeof this.options.reportTime === 'number') {
      this.reportTimer = window.setInterval(
        () => this.report(),
        this.options.reportTime
      );
    }
  }

  private async report(): Promise<void> {
    const now = Date.now();
    const commonData = {
      appId: this.options.appId,
      timestamp: now,
      ...this.options.customReport
    };

    // 上报性能数据
    if (this.options.enablePerformance) {
      await this.reporter.report({
        ...commonData,
        type: 'performance',
        data: this.performanceMonitor.getMetrics()
      });
    }

    // 上报错误数据
    if (this.options.enableError) {
      const errors = this.errorMonitor.getErrors();
      if (errors.length > 0) {
        await this.reporter.report({
          ...commonData,
          type: 'error',
          data: errors
        });
        this.errorMonitor.clearErrors();
      }
    }

    // 上报行为数据
    if (this.options.enableBehavior) {
      const behaviors = this.behaviorMonitor.getBehaviors();
      if (behaviors.length > 0) {
        await this.reporter.report({
          ...commonData,
          type: 'behavior',
          data: behaviors
        });
        this.behaviorMonitor.clearBehaviors();
      }
    }

    // 如果设置为即时上报，立即发送数据
    if (this.options.reportTime === 'immediately') {
      await this.reporter.flush();
    }
  }

  public start(): void {
    console.log('Pandeye 监控已启动');
  }

  public stop(): void {
    if (this.reportTimer) {
      window.clearInterval(this.reportTimer);
      this.reportTimer = null;
    }
    console.log('Pandeye 监控已停止');
  }

  public async forceReport(): Promise<void> {
    await this.report();
    await this.reporter.flush();
  }

  // 自定义事件追踪
  public trackEvent(eventName: string, data: any): void {
    if (this.behaviorMonitor) {
      this.behaviorMonitor.trackCustomEvent(eventName, data);
      if (this.options.reportTime === 'immediately') {
        this.report();
      }
    }
  }
}

export default Pandeye;
