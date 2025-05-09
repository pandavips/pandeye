/**
 * Pandeye - 轻量级前端监控SDK
 *
 * 集成行为监控、性能监控、错误监控等多种监控功能
 * 提供完整的TypeScript类型支持和模块化架构
 *
 * @module Pandeye
 * @author Pandeye Team
 * @version 0.1.0
 */

import { DEFAULT_CONFIG, EVENT_TYPES, REPORT_TIMING } from './constants';
import { BehaviorMonitor } from './monitors/behavior';
import { ErrorMonitor } from './monitors/error';
import { PerformanceMonitor } from './monitors/performance';
import {
  BatchReportData,
  BehaviorInfo,
  DeviceInfo,
  ErrorInfo,
  ErrorType,
  ManualReportData,
  PandeyeOptions,
  ReportTimeType,
} from './types';
import { deepMerge, generateUniqueId, now } from './utils/common';
import { collectDeviceInfo } from './utils/device';
import { Reporter } from './utils/reporter';
import { getSessionId, initSession } from './utils/session';

/**
 * SDK版本号
 */
const VERSION = '0.1.0';

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
  private isRunning: boolean = false;
  private deviceInfo: DeviceInfo;

  /**
   * 创建Pandeye实例
   * 使用单例模式确保只有一个监控实例
   * @param options - 监控配置选项
   */
  private constructor(options: PandeyeOptions) {
    // 必填选项检查
    if (!options.appId) {
      throw new Error('[Pandeye] appId is required');
    }

    // 合并默认选项和用户选项
    this.options = deepMerge<PandeyeOptions>(
      {
        appId: options.appId,
        env: DEFAULT_CONFIG.ENV,
        reportUrl: DEFAULT_CONFIG.REPORT_URL,
        reportTime: DEFAULT_CONFIG.REPORT_TIME as ReportTimeType,
        autoStart: DEFAULT_CONFIG.AUTO_START,
        enablePerformance: DEFAULT_CONFIG.ENABLE_PERFORMANCE,
        enableError: DEFAULT_CONFIG.ENABLE_ERROR,
        enableBehavior: DEFAULT_CONFIG.ENABLE_BEHAVIOR,
        enableConsole: DEFAULT_CONFIG.ENABLE_CONSOLE,
        customReport: {},
      },
      options
    );

    // 初始化会话
    initSession();

    // 收集设备信息
    this.deviceInfo = collectDeviceInfo() as DeviceInfo;

    // 创建上报器
    this.reporter = new Reporter(this.options.reportUrl!);

    if (this.options.autoStart) {
      this.start();
    }

    // 添加监控SDK自身错误的处理
    this.setupGlobalErrorHandler();
  }

  /**
   * 设置全局错误处理
   * 用于捕获监控SDK自身的错误
   * @private
   */
  private setupGlobalErrorHandler(): void {
    const originalConsoleError = console.error;

    // 代理console.error，监控SDK内部错误
    console.error = (...args: any[]): void => {
      // 调用原始方法
      originalConsoleError.apply(console, args);

      // 筛选SDK内部错误
      const errorMessage = args.join(' ');
      if (errorMessage.includes('[Pandeye]')) {
        // 记录SDK内部错误但不上报，避免循环
      }
    };
  }

  /**
   * 获取Pandeye实例
   * 单例模式实现
   * @param options - 配置选项
   * @returns Pandeye实例
   * @public
   * @static
   */
  public static getInstance(options: PandeyeOptions): Pandeye {
    if (!Pandeye.instance) {
      Pandeye.instance = new Pandeye(options);
    } else if (options) {
      // 如果实例已存在但提供了新配置，更新配置
      console.warn('[Pandeye] Instance already exists, updating configuration');
      Pandeye.instance.updateConfig(options);
    }

    return Pandeye.instance;
  }

  /**
   * 更新监控配置
   * @param newOptions - 新的配置选项
   * @private
   */
  private updateConfig(newOptions: Partial<PandeyeOptions>): void {
    // 保存旧配置的监控启用状态
    const wasRunning = this.isRunning;
    const oldEnableError = this.options.enableError;
    const oldEnablePerformance = this.options.enablePerformance;
    const oldEnableBehavior = this.options.enableBehavior;
    const oldEnableConsole = this.options.enableConsole;

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

    // 单独处理各个监控模块的启用/禁用
    if (oldEnableError !== this.options.enableError) {
      this.toggleErrorMonitoring(!!this.options.enableError);
    }

    if (oldEnablePerformance !== this.options.enablePerformance) {
      this.togglePerformanceMonitoring(!!this.options.enablePerformance);
    }

    if (oldEnableBehavior !== this.options.enableBehavior) {
      this.toggleBehaviorMonitoring(!!this.options.enableBehavior);
    }

    if (oldEnableConsole !== this.options.enableConsole) {
      this.toggleConsoleMonitoring(!!this.options.enableConsole);
    }
  }

  /**
   * 启动监控系统
   * @public
   */
  public start(): void {
    if (this.isRunning) return;

    this.isRunning = true;

    try {
      // 初始化各个监控模块
      this.initMonitors();

      // 设置数据上报
      this.setupReporting();

      // 使用允许的 console.warn 替代 console.log
      console.warn(`[Pandeye] Monitoring started, version: ${VERSION}`);
    } catch (error) {
      console.error('[Pandeye] Failed to start monitoring:', error);
      this.isRunning = false;
    }
  }

  /**
   * 初始化监控模块
   * @private
   */
  private initMonitors(): void {
    if (this.options.enableBehavior) {
      this.toggleBehaviorMonitoring(true);
    }

    if (this.options.enablePerformance) {
      this.togglePerformanceMonitoring(true);
    }

    if (this.options.enableError) {
      this.toggleErrorMonitoring(true);
    }

    if (this.options.enableConsole) {
      this.toggleConsoleMonitoring(true);
    }
  }

  /**
   * 切换行为监控
   * @param enable - 是否启用
   * @private
   */
  private toggleBehaviorMonitoring(enable: boolean): void {
    if (enable) {
      if (!this.behaviorMonitor) {
        this.behaviorMonitor = new BehaviorMonitor();
      }
    } else if (this.behaviorMonitor) {
      // 清理资源
      this.behaviorMonitor.dispose();
      this.behaviorMonitor = undefined;
    }
  }

  /**
   * 切换性能监控
   * @param enable - 是否启用
   * @private
   */
  private togglePerformanceMonitoring(enable: boolean): void {
    if (enable) {
      if (!this.performanceMonitor) {
        this.performanceMonitor = new PerformanceMonitor();
      }
    } else if (this.performanceMonitor) {
      // 清理资源
      this.performanceMonitor.dispose();
      this.performanceMonitor = undefined;
    }
  }

  /**
   * 切换错误监控
   * @param enable - 是否启用
   * @private
   */
  private toggleErrorMonitoring(enable: boolean): void {
    if (enable) {
      if (!this.errorMonitor) {
        this.errorMonitor = new ErrorMonitor();
      } else {
        this.errorMonitor.startMonitoring();
      }
    } else if (this.errorMonitor) {
      this.errorMonitor.stopMonitoring();
    }
  }

  /**
   * 切换控制台监控
   * @param enable - 是否启用
   * @private
   */
  private toggleConsoleMonitoring(enable: boolean): void {
    if (enable) {
      this.setupConsoleMonitor();
    } else {
      // 注意：控制台监控一旦启用，目前无法在运行时禁用
      // 需要页面刷新才能完全停止
      console.warn('[Pandeye] Console monitoring cannot be fully disabled without page refresh');
    }
  }

  /**
   * 设置控制台日志监控
   * @private
   */
  private setupConsoleMonitor(): void {
    // 避免重复设置
    if ((window as any).__pandeyeConsoleMonitorInstalled) return;
    (window as any).__pandeyeConsoleMonitorInstalled = true;

    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    };

    // 代理console方法
    type ConsoleMethod = keyof typeof originalConsole;
    Object.keys(originalConsole).forEach(level => {
      const method = level as ConsoleMethod;
      console[method] = (...args: any[]) => {
        // 调用原始方法
        originalConsole[method].apply(console, args);

        // 跳过监控SDK自身的日志
        if (args.some(arg => typeof arg === 'string' && arg.includes('[Pandeye]'))) {
          return;
        }

        // 记录日志
        try {
          // 缓存当前时间和会话ID
          const currentTime = now();
          const sessionId = getSessionId();
          const messages = args.map(arg => {
            try {
              return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
            } catch {
              return String(arg);
            }
          });

          this.reporter.report({
            appId: this.options.appId,
            env: this.options.env,
            timestamp: currentTime,
            type: EVENT_TYPES.REPORT.CONSOLE,
            data: {
              level,
              messages,
            },
            sessionId,
            sdkVersion: VERSION,
            device: this.deviceInfo,
          });
        } catch (error) {
          // 静默处理错误，避免影响正常功能
        }
      };
    });
  }

  /**
   * 设置数据上报机制
   * @private
   */
  private setupReporting(): void {
    // 清除可能存在的旧定时器
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = undefined;
    }

    const reportData = async () => {
      if (!this.isRunning) return;

      try {
        const currentTime = now();
        const batchData: BatchReportData = {
          appId: this.options.appId,
          timestamp: currentTime,
          behavior: this.behaviorMonitor?.getBehaviors() || [],
          performance: this.performanceMonitor?.getMetrics() || null,
          errors: this.errorMonitor?.getErrors() || [],
          customData: this.options.customReport || {},
        };

        await this.reporter.report({
          appId: this.options.appId,
          env: this.options.env,
          timestamp: currentTime,
          type: EVENT_TYPES.REPORT.BATCH,
          data: batchData,
          sdkVersion: VERSION,
          device: this.deviceInfo,
        });

        // 清理已上报的数据
        this.behaviorMonitor?.clearBehaviors();
        this.errorMonitor?.clearErrors();
      } catch (error) {
        console.error('[Pandeye] Error reporting data:', error);
      }
    };

    // 根据配置设置上报时机
    if (typeof this.options.reportTime === 'number') {
      // 定时上报
      this.reportTimer = window.setInterval(reportData, this.options.reportTime);
    } else if (this.options.reportTime === REPORT_TIMING.BEFORE_UNLOAD) {
      // 页面关闭前上报
      window.addEventListener('beforeunload', () => {
        reportData();
      });
    } // 否则是立即上报，不需要特殊处理
  }

  /**
   * 手动触发数据上报
   * @returns 上报操作的Promise
   * @public
   */
  public async flush(): Promise<void> {
    try {
      // 先构建批量数据
      const reportData = async () => {
        const currentTime = now();
        const batchData: BatchReportData = {
          appId: this.options.appId,
          timestamp: currentTime,
          behavior: this.behaviorMonitor?.getBehaviors() || [],
          performance: this.performanceMonitor?.getMetrics() || null,
          errors: this.errorMonitor?.getErrors() || [],
          customData: this.options.customReport || {},
        };

        await this.reporter.report({
          appId: this.options.appId,
          env: this.options.env,
          timestamp: currentTime,
          type: EVENT_TYPES.REPORT.BATCH,
          data: batchData,
          sdkVersion: VERSION,
          device: this.deviceInfo,
        });

        // 清理已上报的数据
        this.behaviorMonitor?.clearBehaviors();
        this.errorMonitor?.clearErrors();
      };

      // 执行上报
      await reportData();

      // 然后刷新剩余队列
      await this.reporter.flush();
    } catch (error) {
      console.error('[Pandeye] Error flushing data:', error);
      throw error;
    }
  }

  /**
   * 停止监控
   * 清理定时器和相关资源
   * @public
   */
  public stop(): void {
    if (!this.isRunning) return;

    // 清理定时上报
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = undefined;
    }

    // 停止各模块监控
    if (this.errorMonitor) {
      this.errorMonitor.stopMonitoring();
    }

    if (this.behaviorMonitor) {
      this.behaviorMonitor.dispose();
    }

    if (this.performanceMonitor) {
      this.performanceMonitor.dispose();
    }

    // 标记状态
    this.isRunning = false;

    // 记录日志
    // 使用允许的 console.warn 替代 console.log
    console.warn('[Pandeye] Monitoring stopped');
  }

  /**
   * 手动记录自定义事件
   * @param eventName - 事件名称
   * @param data - 事件数据
   * @public
   */
  public trackEvent(eventName: string, data: Record<string, unknown>): void {
    if (!this.isRunning) {
      console.warn('[Pandeye] Monitoring is not running, event not tracked');
      return;
    }

    if (!eventName) {
      console.error('[Pandeye] Event name is required');
      return;
    }

    if (this.behaviorMonitor) {
      this.behaviorMonitor.trackCustomEvent(eventName, data);
    }
  }

  /**
   * 记录自定义错误
   * @param type - 错误类型
   * @param error - 错误对象或信息
   * @param extraInfo - 额外错误信息
   * @public
   */
  public reportError(type: ErrorType, error: unknown, extraInfo?: Record<string, unknown>): void {
    if (!this.isRunning) {
      console.warn('[Pandeye] Monitoring is not running, error not reported');
      return;
    }

    if (this.errorMonitor) {
      this.errorMonitor.reportError(type, error, extraInfo);
    }
  }

  /**
   * 主动上报数据
   * 直接通过上报器发送，不经过缓存队列
   * @param data - 要上报的数据
   * @public
   */
  public report(data: ManualReportData): void {
    if (!this.isRunning) {
      console.warn('[Pandeye] Monitoring is not running, data not reported');
      return;
    }

    if (!data.event) {
      console.error('[Pandeye] Event name is required for manual reporting');
      return;
    }

    const currentTime = now();
    const sessionId = getSessionId();

    this.reporter.report({
      appId: this.options.appId,
      env: this.options.env,
      timestamp: currentTime,
      type: EVENT_TYPES.REPORT.MANUAL,
      data,
      sdkVersion: VERSION,
      sessionId,
      device: this.deviceInfo,
    });
  }

  /**
   * 主动批量上报数据
   * @param dataList - 要上报的数据列表
   * @public
   */
  public batchReport(dataList: ManualReportData[]): void {
    if (!this.isRunning) {
      console.warn('[Pandeye] Monitoring is not running, batch data not reported');
      return;
    }

    if (!Array.isArray(dataList) || dataList.length === 0) {
      console.error('[Pandeye] Data list must be a non-empty array');
      return;
    }

    const timestamp = now();
    const sessionId = getSessionId();
    const batchId = generateUniqueId();

    dataList.forEach(data => {
      if (!data.event) {
        console.error('[Pandeye] Event name is required for each item in batch reporting');
        return;
      }

      this.reporter.report({
        appId: this.options.appId,
        env: this.options.env,
        timestamp,
        type: EVENT_TYPES.REPORT.MANUAL,
        data,
        sdkVersion: VERSION,
        sessionId,
        batchId,
        device: this.deviceInfo,
      });
    });
  }

  /**
   * 获取当前收集的监控数据
   * @returns 所有监控数据
   * @public
   */
  public getData(): {
    behavior: BehaviorInfo[];
    performance: any;
    errors: ErrorInfo[];
  } {
    return {
      behavior: this.behaviorMonitor?.getBehaviors() || [],
      performance: this.performanceMonitor?.getMetrics() || null,
      errors: this.errorMonitor?.getErrors() || [],
    };
  }

  /**
   * 获取SDK版本号
   * @returns SDK版本号
   * @public
   */
  public getVersion(): string {
    return VERSION;
  }

  /**
   * 获取当前配置
   * @returns 当前配置选项
   * @public
   */
  public getConfig(): PandeyeOptions {
    return { ...this.options };
  }
}

// 导出类型定义
export * from './types';
