import { PerformanceMetrics, ResourceMetric } from '../types';

export class PerformanceMonitor {
  private metrics: PerformanceMetrics;

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

  private init(): void {
    this.observeLoad();
    this.observePaint();
    this.observeResources();
  }

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

  public getMetrics(): PerformanceMetrics {
    return this.metrics;
  }
}
