import { PandeyeOptions } from './types';
import { PerformanceMonitor } from './monitors/performance';
import { ErrorMonitor } from './monitors/error';
import { BehaviorMonitor } from './monitors/behavior';
import { Reporter } from './utils/reporter';

/**
 * Pandeye 前端监控类
 * 用于收集和上报前端性能、错误和用户行为数据
 * 
 * 功能特点：
 * 1. 支持性能监控（页面加载时间、资源加载等）
 * 2. 支持错误监控（JS错误、Promise错误、资源加载错误等）
 * 3. 支持用户行为监控（PV、点击、路由变化等）
 * 4. 支持自定义事件追踪
 * 5. 支持立即上报和定时上报两种模式
 */
class Pandeye {
  private options: PandeyeOptions;
  private reporter: Reporter;
  private performanceMonitor: PerformanceMonitor;
  private errorMonitor: ErrorMonitor;
  private behaviorMonitor: BehaviorMonitor;
  private reportTimer: number | null = null;

  /**
   * 创建一个新的 Pandeye 实例
   * @param options 配置选项
   * @param options.appId - 应用ID（必需）
   * @param options.reportUrl - 数据上报地址
   * @param options.reportTime - 上报时机 ('immediately' | 'beforeunload' | number)
   * @param options.autoStart - 是否自动开始监控
   * @param options.enablePerformance - 是否启用性能监控
   * @param options.enableError - 是否启用错误监控
   * @param options.enableBehavior - 是否启用行为监控
   * @param options.enableConsole - 是否启用控制台监控
   * @param options.customReport - 自定义上报数据
   * @throws {Error} 当未提供 appId 时抛出错误
   */
  constructor(options: PandeyeOptions) {
    if (!options.appId) {
      throw new Error('appId is required');
    }

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

    this.reporter = new Reporter(this.options.reportUrl || 'https://report.pandeye.com/collect');
    this.init();

    if (this.options.autoStart) {
      this.start();
    }
  }

  /**
   * 初始化监控模块
   * 根据配置项初始化各个监控模块（性能、错误、行为），并设置定时上报
   * @private
   */
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

  /**
   * 执行数据上报
   * 收集各个监控模块的数据并进行上报，支持批量上报和立即上报
   * @private
   * @returns Promise<void>
   */
  private async report(): Promise<void> {
    const now = Date.now();
    const commonData = {
      appId: this.options.appId,
      timestamp: now,
      ...this.options.customReport
    };

    // 上报性能数据
    if (this.options.enablePerformance && this.performanceMonitor) {
      await this.reporter.report({
        ...commonData,
        type: 'performance',
        data: this.performanceMonitor.getMetrics()
      });
    }

    // 上报错误数据
    if (this.options.enableError && this.errorMonitor) {
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
    if (this.options.enableBehavior && this.behaviorMonitor) {
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

  /**
   * 启动监控
   * 开始收集和上报数据
   * @public
   */
  public start(): void {
    console.log('Pandeye 监控已启动');
  }

  /**
   * 停止监控
   * 停止数据收集和定时上报
   * @public
   */
  public stop(): void {
    if (this.reportTimer) {
      window.clearInterval(this.reportTimer);
      this.reportTimer = null;
    }
    console.log('Pandeye 监控已停止');
  }

  /**
   * 强制执行一次数据上报
   * 立即收集并上报所有监控数据
   * @public
   * @returns Promise<void>
   */
  public async forceReport(): Promise<void> {
    await this.report();
    await this.reporter.flush();
  }

  // 自定义事件追踪
  /**
   * 追踪自定义事件
   * @public
   * @param eventName - 事件名称
   * @param data - 事件数据
   */
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
