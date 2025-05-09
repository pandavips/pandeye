import { PerformanceMetrics, ResourceMetric } from '../types';

/**
 * 性能监控类
 * 负责收集和统计页面性能相关的指标，包括：
 * - 页面加载时间
 * - DOM准备时间
 * - 首次绘制时间
 * - 最大内容绘制时间
 * - 资源加载性能
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics;

  /**
   * 创建性能监控实例
   * 初始化性能指标数据结构，并开始监控各项性能指标
   */
  constructor() {
    this.metrics = {
      loadTime: 0,
      domReadyTime: 0,
      firstPaintTime: 0,
      firstMeaningfulPaintTime: 0,
      resources: []
    };
    this.init();
  }

  /**
   * 初始化性能监控
   * 开始观察页面加载、绘制和资源加载性能
   * @private
   */
  private init(): void {
    this.observeLoad();
    this.observePaint();
    this.observeResources();
  }

  /**
   * 观察页面加载性能
   * 使用 Navigation Timing API 收集页面加载相关的时间指标
   * 包括：
   * - loadTime: 页面完全加载时间
   * - domReadyTime: DOM 准备就绪时间
   * @private
   */
  private observeLoad(): void {
    // 使用 Navigation Timing API
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const navEntry = entry as PerformanceNavigationTiming;
        this.metrics.loadTime = navEntry.loadEventStart - navEntry.startTime;
        this.metrics.domReadyTime = navEntry.domContentLoadedEventStart - navEntry.startTime;
      }
    });

    observer.observe({ entryTypes: ['navigation'] });
  }

  /**
   * 观察页面绘制性能
   * 使用 Paint Timing API 和 Largest Contentful Paint API 收集绘制相关的性能指标
   * 包括：
   * - firstPaintTime: 首次绘制时间
   * - firstMeaningfulPaintTime: 最大内容绘制时间（替代首次有意义绘制）
   * @private
   */
  private observePaint(): void {
    if (window.PerformanceObserver) {
      // 观察 FP 和 LCP
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-paint') {
            this.metrics.firstPaintTime = entry.startTime;
          } else if (entry.entryType === 'largest-contentful-paint') {
            // 使用 LCP 替代 FMP
            this.metrics.firstMeaningfulPaintTime = entry.startTime;
          }
        }
      });

      observer.observe({ entryTypes: ['paint', 'largest-contentful-paint'] });
    }
  }

  /**
   * 观察资源加载性能
   * 使用 Resource Timing API 收集页面资源（图片、脚本、样式表等）的加载性能数据
   * 包括：
   * - 资源名称
   * - 资源类型
   * - 加载时长
   * - 传输大小
   * - 开始时间
   * @private
   */
  private observeResources(): void {
    if (window.PerformanceObserver) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries() as PerformanceResourceTiming[];
        for (const entry of entries) {
          const resource: ResourceMetric = {
            name: entry.name,
            initiatorType: entry.initiatorType,
            duration: entry.duration,
            transferSize: entry.transferSize,
            startTime: entry.startTime
          };
          this.metrics.resources.push(resource);
        }
      });

      observer.observe({ entryTypes: ['resource'] });
    }
  }

  /**
   * 获取收集到的性能指标数据
   * @public
   * @returns {PerformanceMetrics} 包含所有性能指标的对象
   */
  public getMetrics(): PerformanceMetrics {
    return this.metrics;
  }
}
