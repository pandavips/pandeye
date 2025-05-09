/**
 * 性能监控模块
 * 负责收集和统计页面性能相关的指标，包括：
 * - 页面加载时间
 * - DOM准备时间
 * - 首次绘制时间
 * - 最大内容绘制时间
 * - 首次输入延迟
 * - 累计布局偏移
 * - 资源加载性能
 */

import { PerformanceMetrics, ResourceMetric, ResourceType } from '../types';
import { isSupported } from '../utils/common';

/**
 * 性能监控类
 * 收集各种Web性能指标，支持标准Performance API和Web Vitals
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetrics;
  private observers: PerformanceObserver[] = [];
  private resourcesMap: Map<string, ResourceMetric> = new Map();
  private maxResources: number = 100; // 默认最多记录100个资源
  private initialized: boolean = false;

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
      largestContentfulPaint: undefined,
      firstInputDelay: undefined,
      cumulativeLayoutShift: undefined,
      resources: [],
    };

    this.init();
  }

  /**
   * 初始化性能监控
   * 开始观察各种性能指标
   * @private
   */
  private init(): void {
    // 防止重复初始化
    if (this.initialized) return;
    this.initialized = true;

    try {
      // 先获取基本的导航计时数据
      this.collectNavigationTiming();

      // 如果支持PerformanceObserver API，则使用它来收集更多指标
      if (isSupported('PerformanceObserver')) {
        this.setupPerformanceObservers();
      }

      // 监听页面完全加载事件，收集所有已加载的资源
      window.addEventListener('load', () => {
        // 使用setTimeout确保在所有资源加载后执行
        setTimeout(() => {
          this.collectLoadedResources();
        }, 0);
      });
    } catch (error) {
      console.error('[Pandeye] Failed to initialize performance monitoring:', error);
    }
  }

  /**
   * 设置性能观察器
   * 为不同类型的性能指标创建观察器
   * @private
   */
  private setupPerformanceObservers(): void {
    try {
      // 监控导航计时
      this.createObserver('navigation', entries => {
        const navEntry = entries[0] as PerformanceNavigationTiming;
        this.metrics.loadTime = navEntry.loadEventStart - navEntry.startTime;
        this.metrics.domReadyTime = navEntry.domContentLoadedEventStart - navEntry.startTime;
      });

      // 监控绘制时间
      this.createObserver('paint', entries => {
        entries.forEach(entry => {
          if (entry.name === 'first-paint') {
            this.metrics.firstPaintTime = entry.startTime;
          } else if (entry.name === 'first-contentful-paint') {
            // 首次内容绘制，可能比FMP更准确
            if (!this.metrics.firstMeaningfulPaintTime) {
              this.metrics.firstMeaningfulPaintTime = entry.startTime;
            }
          }
        });
      });

      // 监控最大内容绘制
      if (
        isSupported('PerformanceObserver.supportedEntryTypes') &&
        PerformanceObserver.supportedEntryTypes.includes('largest-contentful-paint')
      ) {
        this.createObserver('largest-contentful-paint', entries => {
          // 由于LCP可能会随着页面加载而多次更新，我们只取最新的值
          const lcp = entries[entries.length - 1];
          this.metrics.largestContentfulPaint = lcp.startTime;
          this.metrics.firstMeaningfulPaintTime =
            this.metrics.firstMeaningfulPaintTime || lcp.startTime;
        });
      }

      // 监控首次输入延迟
      if (
        isSupported('PerformanceObserver.supportedEntryTypes') &&
        PerformanceObserver.supportedEntryTypes.includes('first-input')
      ) {
        this.createObserver('first-input', entries => {
          const firstInput = entries[0];
          // 确保使用类型断言避免TypeScript错误
          const processingStart = (firstInput as any).processingStart || firstInput.startTime;
          this.metrics.firstInputDelay = processingStart - firstInput.startTime;
        });
      }

      // 监控布局偏移
      if (
        isSupported('PerformanceObserver.supportedEntryTypes') &&
        PerformanceObserver.supportedEntryTypes.includes('layout-shift')
      ) {
        this.createObserver('layout-shift', entries => {
          let cumulativeLayoutShift = this.metrics.cumulativeLayoutShift || 0;

          entries.forEach(entry => {
            // 只有不涉及用户输入的布局偏移才计入CLS
            if (!(entry as any).hadRecentInput) {
              cumulativeLayoutShift += (entry as any).value;
            }
          });

          this.metrics.cumulativeLayoutShift = parseFloat(cumulativeLayoutShift.toFixed(4));
        });
      }

      // 监控资源加载
      this.createObserver('resource', entries => {
        entries.forEach(entry => {
          this.processResourceEntry(entry as PerformanceResourceTiming);
        });
      });
    } catch (error) {
      console.error('[Pandeye] Error setting up performance observers:', error);
    }
  }

  /**
   * 创建单个性能观察器
   * @param entryType - 性能条目类型
   * @param callback - 处理条目的回调函数
   * @private
   */
  private createObserver(entryType: string, callback: (entries: PerformanceEntry[]) => void): void {
    try {
      const observer = new PerformanceObserver(list => {
        callback(list.getEntries());
      });

      // 尝试使用新的API格式
      try {
        observer.observe({ type: entryType, buffered: true } as any);
      } catch (err) {
        // 回退到旧格式
        observer.observe({ entryTypes: [entryType] });
      }

      this.observers.push(observer);
    } catch (error) {
      console.error(`[Pandeye] Error creating observer for ${entryType}:`, error);
    }
  }

  /**
   * 收集导航计时信息
   * 使用Performance API直接获取
   * @private
   */
  private collectNavigationTiming(): void {
    try {
      const navEntries = performance.getEntriesByType('navigation');

      if (navEntries && navEntries.length > 0) {
        const navEntry = navEntries[0] as PerformanceNavigationTiming;

        this.metrics.loadTime = navEntry.loadEventStart - navEntry.startTime;
        this.metrics.domReadyTime = navEntry.domContentLoadedEventStart - navEntry.startTime;
      }
      // 兼容旧版浏览器
      else if (performance.timing) {
        const timing = performance.timing;
        this.metrics.loadTime = timing.loadEventEnd - timing.navigationStart;
        this.metrics.domReadyTime = timing.domContentLoadedEventEnd - timing.navigationStart;
      }
    } catch (error) {
      console.error('[Pandeye] Error collecting navigation timing:', error);
    }
  }

  /**
   * 收集已加载的资源信息
   * 直接从Performance API获取所有资源条目
   * @private
   */
  private collectLoadedResources(): void {
    try {
      const resourceEntries = performance.getEntriesByType(
        'resource'
      ) as PerformanceResourceTiming[];

      resourceEntries.forEach(entry => {
        this.processResourceEntry(entry);
      });

      // 更新指标中的资源列表
      this.updateResourcesList();
    } catch (error) {
      console.error('[Pandeye] Error collecting resource entries:', error);
    }
  }

  /**
   * 处理单个资源条目
   * 提取重要的资源计时信息
   * @param entry - 资源条目
   * @private
   */
  private processResourceEntry(entry: PerformanceResourceTiming): void {
    // 如果资源数量超过上限，则跳过
    if (this.resourcesMap.size >= this.maxResources) return;

    // 避免重复添加资源
    if (this.resourcesMap.has(entry.name)) return;

    // 检测是否是缓存命中
    const cacheHit = entry.transferSize === 0 && entry.decodedBodySize > 0;

    const resource: ResourceMetric = {
      name: entry.name,
      initiatorType: entry.initiatorType as ResourceType,
      duration: Math.round(entry.duration),
      transferSize: entry.transferSize,
      startTime: Math.round(entry.startTime),
      cacheHit,
      decodedBodySize: entry.decodedBodySize,
    };

    this.resourcesMap.set(entry.name, resource);
  }

  /**
   * 更新性能指标中的资源列表
   * @private
   */
  private updateResourcesList(): void {
    this.metrics.resources = Array.from(this.resourcesMap.values())
      // 按加载开始时间排序
      .sort((a, b) => a.startTime - b.startTime);
  }

  /**
   * 获取收集到的性能指标数据
   * @returns {PerformanceMetrics} 包含所有性能指标的对象
   * @public
   */
  public getMetrics(): PerformanceMetrics {
    // 确保返回最新的资源列表
    this.updateResourcesList();
    return this.metrics;
  }

  /**
   * 销毁监控实例
   * 断开所有观察器连接，释放资源
   * @public
   */
  public dispose(): void {
    // 断开所有观察器
    this.observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (error) {
        console.error('[Pandeye] Error disconnecting observer:', error);
      }
    });

    this.observers = [];
    this.resourcesMap.clear();
    this.initialized = false;
  }
}
