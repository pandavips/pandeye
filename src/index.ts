// 优先获取宿主环境原始的一些对象
import {
  BehaviorMonitor,
  ConsoleMonitor,
  ErrorMonitor,
  Monitor,
  NetworkMonitor,
  ViewRecordMonitor,
} from '@/monitors';
import { Original } from '@/utils';
import { Reporter } from '@/utils/reporter';
import { PandeyeOptions } from './types';
class Pandeye {
  private options: PandeyeOptions;

  // 监视器集合
  private monitors: Monitor[] = [];

  // 上报器
  reporter!: Reporter;

  constructor(options: PandeyeOptions) {
    this.options = options;

    try {
      if (!this.options.reportConfig) {
        throw new Error('reportConfig is required');
      }
      this.reporter = new Reporter({
        ...this.options.reportConfig,
      });

      Promise.resolve().then(() => {
        this.init();
      });
    } catch (error) {
      Original.consoleError('Pandeye 初始化失败:', error);
    }
  }

  // 负责初始化各个监控模块
  private init(): void {
    const {
      enablePerformance,
      enableError,
      enableConsole,
      enableBehavior,
      autoStart = true,
      enableNetwork,
      enableRecord,
    } = this.options;

    if (enablePerformance) {
      this.initPerformanceMonitor(this.reporter);
    }
    if (enableError) {
      this.initErrorMonitor(this.reporter);
    }
    if (enableBehavior) {
      this.initBehaviorMonitor(this.reporter);
    }
    if (enableConsole) {
      const consoleMonitor = new ConsoleMonitor(this.reporter);
      this.monitors.push(consoleMonitor);
    }
    if (enableNetwork) {
      this.initNetworkMonitor(this.reporter);
    }
    if (enableRecord) {
      this.initRecordMonitor(this.reporter);
    }

    autoStart && this.start();

    // 初始化完成后立即上报一次配置信息
    this.reporter.report({
      type: 'init',
      payload: this.options,
    });
  }

  private initRecordMonitor(reporter: Reporter) {
    const recordMonitor = new ViewRecordMonitor(reporter);
    this.monitors.push(recordMonitor);
  }

  private initPerformanceMonitor(reporter: Reporter): void {
    // 初始化性能监控
    Original.consoleLog('PerformanceMonitor initialized');
    Original.consoleLog('inject reporter', reporter);
  }

  private initErrorMonitor(reporter: Reporter): void {
    // 初始化错误监控
    const errorMonitor = new ErrorMonitor(reporter);
    this.monitors.push(errorMonitor);
  }

  private initBehaviorMonitor(reporter: Reporter): void {
    // 初始化用户行为监控
    const behaviorMonitor = new BehaviorMonitor(reporter);
    this.monitors.push(behaviorMonitor);
  }

  private initNetworkMonitor(reporter: Reporter): void {
    // 初始化网络监控
    const networkMonitor = new NetworkMonitor(reporter);
    this.monitors.push(networkMonitor);
  }

  start(): void {
    // 启动所有监控器
    this.monitors.forEach(monitor => {
      monitor.start();
    });
  }

  stop(): void {
    // 停止所有监控器
    this.monitors.forEach(monitor => {
      monitor.stop();
    });
  }

  destroy(): void {
    this.stop();
    // 销毁所有监控器
    this.monitors.forEach(monitor => {
      monitor.destroy();
    });
  }
}

export default Pandeye;
