/* eslint-disable @typescript-eslint/no-empty-function */
import { Monitor } from '@/monitors';
import { Reporter } from '@/utils/reporter';

// todo: 需要实现性能监控的具体逻辑
export class PerformanceMonitor extends Monitor {
  constructor(reporter: Reporter) {
    super(reporter);
    this.isTracking = false;
    this.init();
  }

  init(): void {}
  destroy(): void {}
  start(): void {}
  stop(): void {}
  report(): void {}
}
