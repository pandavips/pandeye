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
    window.addEventListener('load', () => {
      const timing = performance.timing;
      
      this.metrics.loadTime = timing.loadEventEnd - timing.navigationStart;
      this.metrics.domReadyTime = timing.domContentLoadedEventEnd - timing.navigationStart;
    });
  }

  private observePaint(): void {
    if (window.PerformanceObserver) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-paint') {
            this.metrics.firstPaintTime = entry.startTime;
          } else if (entry.name === 'first-meaningful-paint') {
            this.metrics.firstMeaningfulPaintTime = entry.startTime;
          }
        }
      });

      observer.observe({ entryTypes: ['paint'] });
    }
  }

  private observeResources(): void {
    if (window.PerformanceObserver) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          const resource: ResourceMetric = {
            name: entry.name,
            initiatorType: entry.initiatorType,
            duration: entry.duration,
            transferSize: (entry as PerformanceResourceTiming).transferSize,
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
