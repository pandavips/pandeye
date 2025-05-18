import { Reporter } from '@/utils/reporter';
/**
 * 基类
 */
export abstract class Monitor {
  // 是否正在监控
  protected isTracking: boolean = false;
  // 上报器
  protected reporter: Reporter;

  // 构造函数
  constructor(reporter: Reporter) {
    this.reporter = reporter;
    this.isTracking = false;
  }
  // 初始化监控器
  abstract init(): void;
  // 开始监控
  abstract start(): void;
  // 停止监控
  abstract stop(): void;
  // 销毁监控器
  abstract destroy(): void;
  // 上报数据
  abstract report(data: any): void;
}
