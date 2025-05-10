/**
 * 用户体验监控模块
 * 收集和分析与用户体验相关的指标
 */

import { generateUniqueId } from '../utils/common';

// 用户体验评分分类
export enum UXCategory {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  NEEDS_IMPROVEMENT = 'needs_improvement',
  POOR = 'poor',
}

// 用户体验指标
export interface UXMetrics {
  // 页面响应性指标
  interactionToNextPaint?: number; // 交互到下一次绘制的时间
  userGestureLatency?: number; // 用户操作延迟
  inputLatency?: number; // 输入延迟

  // 页面可用性指标
  timeToInteractive?: number; // 页面可交互时间
  visibilityChanges: number; // 页面可见性变化次数

  // 内容稳定性指标
  layoutShifts: number; // 布局偏移次数
  cumulativeLayoutShift?: number; // 累积布局偏移

  // 用户感知指标
  pageExitTiming?: {
    timeOnPage: number; // 页面停留时间(ms)
    exitType: 'normal' | 'abrupt'; // 离开类型：正常/突然
  };

  // 用户交互指标
  interactions: {
    clickCount: number; // 点击次数
    keyPressCount: number; // 按键次数
    scrollCount: number; // 滚动次数
    scrollDepth: number; // 滚动深度(百分比)
  };

  // 用户旅程指标
  userFlow: {
    pathLength: number; // 路径长度
    pathId: string; // 路径ID
    hesitationPoints: number; // 犹豫点数量(长时间停留但未操作)
  };

  // 整体评分
  overallScore?: number; // 1-100
  overallCategory?: UXCategory;
}

export class UXMonitor {
  private metrics: UXMetrics;
  private sessionStartTime: number;
  private lastUserActivity: number;
  private enabled: boolean = false;
  private observers: PerformanceObserver[] = [];

  // 交互记录
  private interactionEvents: Array<{
    type: string;
    time: number;
    target?: string;
    position?: { x: number; y: number };
    duration?: number;
  }> = [];

  constructor() {
    this.sessionStartTime = performance.now();
    this.lastUserActivity = this.sessionStartTime;

    this.metrics = {
      visibilityChanges: 0,
      layoutShifts: 0,
      interactions: {
        clickCount: 0,
        keyPressCount: 0,
        scrollCount: 0,
        scrollDepth: 0,
      },
      userFlow: {
        pathLength: 0,
        pathId: generateUniqueId(),
        hesitationPoints: 0,
      },
    };
  }

  /**
   * 开始监控用户体验
   */
  public start(): void {
    if (this.enabled) return;
    this.enabled = true;

    // 监听用户交互事件
    this.setupInteractionMonitoring();

    // 监听页面可见性变化
    this.setupVisibilityMonitoring();

    // 监听布局偏移
    this.setupLayoutMonitoring();

    // 监听页面退出
    this.setupExitMonitoring();

    // 监听用户滚动行为
    this.setupScrollMonitoring();

    // 初始化性能观察器（如果浏览器支持）
    this.setupPerformanceObservers();
  }

  /**
   * 设置交互监控
   */
  private setupInteractionMonitoring(): void {
    // 监听点击
    document.addEventListener('click', e => {
      this.metrics.interactions.clickCount++;
      this.lastUserActivity = performance.now();

      const target = e.target as HTMLElement;
      this.interactionEvents.push({
        type: 'click',
        time: performance.now(),
        target: target.tagName + (target.id ? `#${target.id}` : ''),
        position: { x: e.clientX, y: e.clientY },
      });

      // 更新用户流路径长度
      this.metrics.userFlow.pathLength++;
    });

    // 监听键盘事件
    document.addEventListener('keydown', () => {
      this.metrics.interactions.keyPressCount++;
      this.lastUserActivity = performance.now();
    });

    // 定期检查用户是否长时间无活动（犹豫点）
    setInterval(() => {
      const now = performance.now();
      const inactiveTime = now - this.lastUserActivity;

      // 如果用户超过5秒无操作，记为一个犹豫点
      if (inactiveTime > 5000) {
        this.metrics.userFlow.hesitationPoints++;

        // 记录犹豫事件
        this.interactionEvents.push({
          type: 'hesitation',
          time: now,
          duration: inactiveTime,
        });
      }
    }, 5000);
  }

  /**
   * 监控页面可见性变化
   */
  private setupVisibilityMonitoring(): void {
    document.addEventListener('visibilitychange', () => {
      this.metrics.visibilityChanges++;

      if (document.visibilityState === 'visible') {
        // 用户返回页面
        this.interactionEvents.push({
          type: 'visibility_change',
          time: performance.now(),
          target: 'visible',
        });
      } else {
        // 用户离开页面
        this.interactionEvents.push({
          type: 'visibility_change',
          time: performance.now(),
          target: 'hidden',
        });
      }
    });
  }

  /**
   * 监控布局偏移
   */
  private setupLayoutMonitoring(): void {
    // 使用Intersection Observer API检测元素位置变化
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          // 如果元素位置发生显著变化
          if (Math.abs(entry.intersectionRatio - 0.5) > 0.2) {
            this.metrics.layoutShifts++;
          }
        });
      });

      // 观察所有主要内容元素
      document.querySelectorAll('main, section, article, .content').forEach(el => {
        observer.observe(el);
      });
    }
  }

  /**
   * 监控页面退出
   */
  private setupExitMonitoring(): void {
    window.addEventListener('beforeunload', () => {
      const timeOnPage = performance.now() - this.sessionStartTime;

      this.metrics.pageExitTiming = {
        timeOnPage,
        // 如果页面停留时间少于5秒，视为突然离开
        exitType: timeOnPage < 5000 ? 'abrupt' : 'normal',
      };
    });
  }

  /**
   * 监控页面滚动
   */
  private setupScrollMonitoring(): void {
    let maxScrollY = 0;
    let docHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight
    );

    document.addEventListener('scroll', () => {
      this.metrics.interactions.scrollCount++;
      this.lastUserActivity = performance.now();

      // 更新最大滚动深度
      const scrollY = window.scrollY + window.innerHeight;
      if (scrollY > maxScrollY) {
        maxScrollY = scrollY;

        // 计算滚动百分比
        const scrollPercentage = Math.min((scrollY / docHeight) * 100, 100);
        this.metrics.interactions.scrollDepth = scrollPercentage;
      }
    });

    // 定期检查文档高度是否变化（动态内容）
    setInterval(() => {
      const newDocHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight
      );

      if (newDocHeight !== docHeight) {
        docHeight = newDocHeight;
      }
    }, 2000);
  }

  /**
   * 设置性能观察器
   */
  private setupPerformanceObservers(): void {
    if (!('PerformanceObserver' in window)) return;

    try {
      // 监测布局偏移
      const layoutObserver = new PerformanceObserver(entryList => {
        const entries = entryList.getEntries() as PerformanceEntry[];
        entries.forEach(entry => {
          if (entry.entryType === 'layout-shift') {
            const lsEntry = entry as any; // Layout Shift API

            // 累加CLS值
            if (!this.metrics.cumulativeLayoutShift) {
              this.metrics.cumulativeLayoutShift = 0;
            }
            this.metrics.cumulativeLayoutShift += lsEntry.value || 0;
          }
        });
      });
      layoutObserver.observe({ type: 'layout-shift', buffered: true });
      this.observers.push(layoutObserver);

      // 监测交互到下一次绘制的时间（INP - Interaction to Next Paint）
      const interactionObserver = new PerformanceObserver(entryList => {
        const entries = entryList.getEntries();
        if (entries.length > 0) {
          // 取最近的交互延迟
          const entry = entries[entries.length - 1] as any;
          this.metrics.interactionToNextPaint = entry.duration;
        }
      });
      interactionObserver.observe({ type: 'event', buffered: true });
      this.observers.push(interactionObserver);
    } catch (error) {
      console.error('[Pandeye] Failed to setup performance observers:', error);
    }
  }

  /**
   * 停止监控
   */
  public stop(): void {
    if (!this.enabled) return;
    this.enabled = false;

    // 停止所有性能观察器
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];

    // 计算整体用户体验评分
    this.calculateOverallScore();
  }

  /**
   * 计算整体用户体验评分
   */
  private calculateOverallScore(): void {
    let score = 100; // 满分起步

    // 累积布局偏移扣分 (CLS 越高越差)
    if (this.metrics.cumulativeLayoutShift) {
      if (this.metrics.cumulativeLayoutShift > 0.25) {
        score -= 25; // 严重的布局偏移
      } else if (this.metrics.cumulativeLayoutShift > 0.1) {
        score -= 10; // 较明显的布局偏移
      }
    }

    // 交互响应性扣分
    if (this.metrics.interactionToNextPaint) {
      if (this.metrics.interactionToNextPaint > 500) {
        score -= 30; // 严重延迟
      } else if (this.metrics.interactionToNextPaint > 200) {
        score -= 15; // 明显延迟
      }
    }

    // 页面可交互时间扣分
    if (this.metrics.timeToInteractive) {
      if (this.metrics.timeToInteractive > 5000) {
        score -= 20; // 非常慢
      } else if (this.metrics.timeToInteractive > 3000) {
        score -= 10; // 较慢
      }
    }

    // 用户犹豫点扣分
    score -= Math.min(this.metrics.userFlow.hesitationPoints * 2, 15);

    // 确保分数在0-100之间
    score = Math.max(0, Math.min(score, 100));
    this.metrics.overallScore = score;

    // 设置分类
    if (score >= 85) {
      this.metrics.overallCategory = UXCategory.EXCELLENT;
    } else if (score >= 70) {
      this.metrics.overallCategory = UXCategory.GOOD;
    } else if (score >= 50) {
      this.metrics.overallCategory = UXCategory.NEEDS_IMPROVEMENT;
    } else {
      this.metrics.overallCategory = UXCategory.POOR;
    }
  }

  /**
   * 获取用户体验指标
   */
  public getMetrics(): UXMetrics {
    // 确保返回前计算了最终分数
    if (this.metrics.overallScore === undefined) {
      this.calculateOverallScore();
    }
    return { ...this.metrics };
  }

  /**
   * 获取详细的用户交互事件记录
   */
  public getInteractionEvents() {
    return [...this.interactionEvents];
  }
}
