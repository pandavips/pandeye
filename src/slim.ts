/**
 * PandEye精简版入口文件
 * 只包含核心功能，体积更小
 */

import { DEFAULT_CONFIG, EVENT_TYPES } from './constants';
import { BehaviorMonitor } from './monitors/behavior';
import { ErrorMonitor } from './monitors/error';
import { PerformanceMonitor } from './monitors/performance';
import { PandeyeOptions } from './types';
import { deepMerge } from './utils/common';
import { collectDeviceInfo } from './utils/device';
import { Reporter } from './utils/reporter';
import { getSessionId, initSession } from './utils/session';

/**
 * SDK版本号
 */
const VERSION = process.env.VERSION || '0.1.0';

/**
 * PandEye精简版
 * 只包含核心监控功能，体积更小
 */
export class PandeyeSlim {
  private static instance: PandeyeSlim;
  private options: PandeyeOptions;
  private reporter: Reporter;
  private behaviorMonitor?: BehaviorMonitor;
  private performanceMonitor?: PerformanceMonitor;
  private errorMonitor?: ErrorMonitor;
  private reportTimer?: number;
  private isRunning: boolean = false;
  private deviceInfo: any;

  /**
   * 创建PandEye实例
   */
  private constructor(options: PandeyeOptions) {
    // 必填选项检查
    if (!options.appId) {
      throw new Error('[PandEye] appId is required');
    }

    // 合并默认选项和用户选项
    this.options = deepMerge<PandeyeOptions>(
      {
        appId: options.appId,
        env: DEFAULT_CONFIG.ENV,
        reportUrl: DEFAULT_CONFIG.REPORT_URL,
        reportTime: DEFAULT_CONFIG.REPORT_TIME as 'beforeunload',
        autoStart: DEFAULT_CONFIG.AUTO_START,
        enablePerformance: DEFAULT_CONFIG.ENABLE_PERFORMANCE,
        enableError: DEFAULT_CONFIG.ENABLE_ERROR,
        enableBehavior: DEFAULT_CONFIG.ENABLE_BEHAVIOR,
        enableConsole: false, // 精简版默认不启用控制台监控
        customReport: {},
      },
      options
    );

    // 初始化会话
    initSession();

    // 收集设备信息
    this.deviceInfo = collectDeviceInfo();

    // 创建上报器
    this.reporter = new Reporter(this.options.reportUrl!);

    if (this.options.autoStart) {
      this.start();
    }
  }

  /**
   * 获取PandEye实例
   */
  public static getInstance(options: PandeyeOptions): PandeyeSlim {
    if (!PandeyeSlim.instance) {
      PandeyeSlim.instance = new PandeyeSlim(options);
    } else if (options) {
      console.warn('[PandEye] Instance already exists, updating configuration');
      PandeyeSlim.instance.updateConfig(options);
    }

    return PandeyeSlim.instance;
  }

  /**
   * 更新监控配置
   */
  private updateConfig(newOptions: Partial<PandeyeOptions>): void {
    // 保存旧配置的监控启用状态
    const wasRunning = this.isRunning;

    // 如果运行中，先停止
    if (wasRunning) {
      this.stop();
    }

    // 更新配置
    this.options = deepMerge(this.options, newOptions);

    // 如果reportUrl改变，重新创建上报器
    if (newOptions.reportUrl) {
      this.reporter = new Reporter(this.options.reportUrl!);
    }

    // 如果之前在运行，重新启动
    if (wasRunning) {
      this.start();
    }
  }

  /**
   * 启动监控
   */
  public start(): void {
    if (this.isRunning) return;

    this.isRunning = true;

    // 初始化各监控模块
    this.initMonitors();

    // 设置上报定时器
    this.setupReporting();
  }

  /**
   * 初始化监控模块
   */
  private initMonitors(): void {
    // 初始化错误监控
    if (this.options.enableError) {
      this.errorMonitor = new ErrorMonitor();
      this.errorMonitor.startMonitoring();
    }

    // 初始化性能监控
    if (this.options.enablePerformance) {
      this.performanceMonitor = new PerformanceMonitor();
    }

    // 初始化行为监控
    if (this.options.enableBehavior) {
      this.behaviorMonitor = new BehaviorMonitor();
      // BehaviorMonitor 没有 start 方法，在构造函数中已经初始化
    }
  }

  /**
   * 设置数据上报
   */
  private setupReporting(): void {
    // 清除已有定时器
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
    }

    // 配置定时上报
    this.reportTimer = window.setInterval(() => {
      this.report();
    }, this.options.reportTime as number);

    // 页面卸载前上报
    window.addEventListener('beforeunload', () => {
      this.report();
    });
  }

  /**
   * 上报数据
   */
  private report(): void {
    if (!this.isRunning) return;

    const reportData: any = {
      appId: this.options.appId,
      env: this.options.env,
      time: Date.now(),
      sessionId: getSessionId(),
      device: this.deviceInfo,
      data: {},
    };

    // 收集错误数据
    if (this.errorMonitor) {
      reportData.data.errors = this.errorMonitor.getErrors();
      this.errorMonitor.clearErrors();
    }

    // 收集性能数据
    if (this.performanceMonitor) {
      reportData.data.performance = this.performanceMonitor.getMetrics();
    }

    // 收集行为数据
    if (this.behaviorMonitor) {
      reportData.data.behavior = this.behaviorMonitor.getBehaviors();
      this.behaviorMonitor.clearBehaviors();
    }

    // 如果有自定义数据，也添加上
    if (this.options.customReport) {
      reportData.data.custom = this.options.customReport;
    }

    // 发送数据
    this.reporter.report(reportData).catch((error: Error) => {
      console.error('[PandEye] Failed to report data:', error);
    });
  }

  /**
   * 停止监控
   */
  public stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    // 停止各个监控模块
    if (this.errorMonitor) {
      this.errorMonitor.stopMonitoring();
    }

    if (this.behaviorMonitor) {
      this.behaviorMonitor.dispose();
    }

    // 清除上报定时器
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = undefined;
    }
  }

  /**
   * 手动上报错误
   */
  public reportError(error: Error | string, context?: any): void {
    if (!this.errorMonitor) return;

    if (typeof error === 'string') {
      error = new Error(error);
    }

    // 使用 ErrorType 类型中的一个有效值
    this.errorMonitor.reportError('js', error, context);
  }

  /**
   * 手动上报自定义事件
   */
  public reportCustom(name: string, data: any): void {
    if (!this.isRunning) return;

    const reportData = {
      appId: this.options.appId,
      env: this.options.env,
      timestamp: Date.now(),
      type: EVENT_TYPES.REPORT.CUSTOM,
      data: {
        event: name,
        ...data,
      },
      sessionId: getSessionId(),
      sdkVersion: VERSION,
    };

    this.reporter.report(reportData).catch((error: Error) => {
      console.error('[PandEye] Failed to report custom data:', error);
    });
  }

  /**
   * 获取版本号
   */
  public getVersion(): string {
    return VERSION;
  }
}

export default PandeyeSlim;
