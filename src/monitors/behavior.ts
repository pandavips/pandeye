/* eslint-disable @typescript-eslint/no-empty-function */
import { Monitor } from '@/monitors';
import { ReporterBaseData } from '@/types';
import { Reporter } from '@/utils/reporter';

/**
 * 行为监控器类
 * 用于跟踪和记录用户在页面上的交互行为
 */
export class BehaviorMonitor extends Monitor {
  constructor(reporter: Reporter) {
    super(reporter);
    this.init();
  }

  init(): void {}

  start(): void {}

  stop(): void {}

  destroy(): void {}

  report(data: ReporterBaseData): void {
    this.reporter.report({
      type: 'behavior',
      payload: data,
    });
  }
}
