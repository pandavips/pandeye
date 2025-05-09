/**
 * 用户行为监控模块
 * 负责收集和记录用户在页面上的各种行为，包括：
 * 1. 页面访问（PV）
 * 2. 点击行为
 * 3. 路由变化
 * 4. 自定义事件
 *
 * 特性：
 * - 行为数据标准化
 * - 自动收集用户交互
 * - 支持SPA路由监听
 * - 支持自定义事件追踪
 *
 * @module monitors/behavior
 * @author Pandeye Team
 * @version 0.1.0
 */

import { BehaviorType, BehaviorInfo, CustomEventData } from '../types';
import { generateUniqueId, now, throttle } from '../utils/common';
import { LIMITS, EVENT_TYPES, CUSTOM_EVENTS } from '../constants';

/**
 * 用户行为监控类
 * 负责收集和记录用户在页面上的各种行为
 */
export class BehaviorMonitor {
  private behaviors: BehaviorInfo[] = [];
  private maxBehaviors: number = LIMITS.MAX_BEHAVIORS;
  private isMonitoring: boolean = false;
  private pageViewStartTime: number = now();

  // 页面性能指标收集状态
  private hasCollectedPV: boolean = false;

  /**
   * 创建行为监控实例
   * @param maxBehaviors - 最大缓存行为数量
   */
  constructor(maxBehaviors?: number) {
    if (maxBehaviors) {
      this.maxBehaviors = maxBehaviors;
    }

    this.init();
  }

  /**
   * 初始化行为监控
   * 开始监听各类用户行为
   * @private
   */
  private init(): void {
    if (this.isMonitoring) return;

    try {
      this.isMonitoring = true;

      // 记录页面访问
      this.trackPageView();

      // 节流后的点击监听，避免频繁触发
      const throttledClickHandler = throttle(this.handleClick.bind(this), 300);
      document.addEventListener('click', throttledClickHandler, true);

      // 监听路由变化
      this.trackRouteChange();

      // 监听页面离开，记录停留时间
      window.addEventListener('beforeunload', this.handlePageLeave.bind(this));

      // 记录页面可见性变化
      if (document.visibilityState !== undefined) {
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
      }
    } catch (error) {
      console.error('[Pandeye] Error initializing behavior monitor:', error);
    }
  }

  /**
   * 记录页面访问（PV）
   * 收集当前页面的URL、标题和来源页面信息
   * @private
   */
  private trackPageView(): void {
    // 避免重复记录
    if (this.hasCollectedPV) return;

    this.hasCollectedPV = true;
    this.pageViewStartTime = now();

    // 记录页面访问
    this.addBehavior({
      type: EVENT_TYPES.BEHAVIOR.PV as BehaviorType,
      data: {
        url: window.location.href,
        title: document.title,
        referrer: document.referrer,
      },
      timestamp: now(),
      id: generateUniqueId(),
    });
  }

  /**
   * 处理点击事件
   * @param event - 点击事件对象
   * @private
   */
  private handleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target) return;

    try {
      // 获取点击位置坐标
      const x = event.clientX;
      const y = event.clientY;

      // 获取点击元素的相关信息
      const clickInfo = {
        tagName: target.tagName.toLowerCase(),
        className: typeof target.className === 'string' ? target.className : '',
        id: target.id,
        text: target.textContent?.slice(0, 50),
        path: this.getElementPath(target),
        x,
        y,
      };

      this.addBehavior({
        type: EVENT_TYPES.BEHAVIOR.CLICK as BehaviorType,
        data: clickInfo,
        timestamp: now(),
        id: generateUniqueId(),
      });
    } catch (error) {
      console.error('[Pandeye] Error tracking click:', error);
    }
  }

  /**
   * 监听路由变化
   * 适配 history 模式的前端路由
   * 使用自定义事件避免与其他库冲突
   * @private
   */
  private trackRouteChange(): void {
    try {
      // 监听 history 模式路由变化
      window.addEventListener('popstate', () => {
        this.recordRouteChange();
      });

      // 重写 history 方法，使用代理模式
      const originalPushState = window.history.pushState;
      const originalReplaceState = window.history.replaceState;

      window.history.pushState = function (...args) {
        const result = originalPushState.apply(this, args);
        window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.ROUTE_CHANGE));
        return result;
      };

      window.history.replaceState = function (...args) {
        const result = originalReplaceState.apply(this, args);
        window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.ROUTE_CHANGE));
        return result;
      };

      // 监听自定义路由事件
      window.addEventListener(CUSTOM_EVENTS.ROUTE_CHANGE, () => {
        this.recordRouteChange();
      });
    } catch (error) {
      console.error('[Pandeye] Error setting up route change tracking:', error);
    }
  }

  /**
   * 处理页面离开事件
   * 记录页面停留时间
   * @private
   */
  private handlePageLeave(): void {
    // 记录停留时间
    const stayTime = now() - this.pageViewStartTime;

    // 将停留时间添加到最近的PV记录中
    const pvRecords = this.behaviors.filter(b => b.type === EVENT_TYPES.BEHAVIOR.PV);
    if (pvRecords.length > 0) {
      const lastPV = pvRecords[pvRecords.length - 1];
      (lastPV.data as any).stayTime = stayTime;
    }
  }

  /**
   * 处理页面可见性变化
   * 用于准确计算用户真实停留时间
   * @private
   */
  private handleVisibilityChange(): void {
    if (document.visibilityState === 'hidden') {
      // 用户离开页面，记录当前的停留时间
      this.handlePageLeave();
    } else if (document.visibilityState === 'visible') {
      // 用户回到页面，重置开始时间
      this.pageViewStartTime = now();
    }
  }

  /**
   * 记录路由变化信息
   * 包含路由变化的来源和目标页面
   * @private
   */
  private recordRouteChange(): void {
    // 先记录当前页面的停留时间
    this.handlePageLeave();

    // 然后记录新的路由信息
    const currentUrl = window.location.href;

    // 获取最近的PV或路由事件作为来源
    let fromUrl = document.referrer;
    const lastNavEvents = this.behaviors.filter(
      b => b.type === EVENT_TYPES.BEHAVIOR.PV || b.type === EVENT_TYPES.BEHAVIOR.ROUTE
    );

    if (lastNavEvents.length > 0) {
      const lastEvent = lastNavEvents[lastNavEvents.length - 1];
      if (lastEvent.type === EVENT_TYPES.BEHAVIOR.PV) {
        fromUrl = (lastEvent.data as any).url || fromUrl;
      } else if (lastEvent.type === EVENT_TYPES.BEHAVIOR.ROUTE) {
        fromUrl = (lastEvent.data as any).to || fromUrl;
      }
    }

    // 提取路由参数
    let params = {};
    try {
      const url = new URL(currentUrl);
      params = Object.fromEntries(url.searchParams.entries());
    } catch (error) {
      // URL解析失败，忽略参数
    }

    this.addBehavior({
      type: EVENT_TYPES.BEHAVIOR.ROUTE as BehaviorType,
      data: {
        from: fromUrl,
        to: currentUrl,
        params,
      },
      timestamp: now(),
      id: generateUniqueId(),
    });

    // 重置页面访问时间
    this.pageViewStartTime = now();

    // 检查页面标题是否变化
    setTimeout(() => {
      if (document.title) {
        this.trackPageView();
      }
    }, 100);
  }

  /**
   * 获取DOM元素的选择器路径
   * 从当前元素向上遍历到body，生成唯一的选择器路径
   * @param element 目标DOM元素
   * @returns 元素的选择器路径
   * @private
   */
  private getElementPath(element: HTMLElement): string {
    const path: string[] = [];
    let current: HTMLElement | null = element;

    try {
      while (current && current !== document.body) {
        let selector = current.tagName.toLowerCase();

        if (current.id) {
          selector += `#${current.id}`;
        } else if (
          current.className &&
          typeof current.className === 'string' &&
          current.className.trim()
        ) {
          // 处理多个类名，过滤空类名
          const classes = current.className.trim().split(/\s+/).filter(Boolean).join('.');

          if (classes) {
            selector += `.${classes}`;
          }
        }

        // 限制选择器深度，避免路径过长
        if (path.length >= 5) {
          path.unshift('...');
          break;
        }

        path.unshift(selector);
        current = current.parentElement;
      }

      return path.join(' > ');
    } catch (error) {
      return element.tagName.toLowerCase();
    }
  }

  /**
   * 添加行为记录到队列
   * 当队列达到上限时，移除最早的记录
   * @param behavior 要添加的行为记录
   * @private
   */
  private addBehavior(behavior: BehaviorInfo): void {
    if (this.behaviors.length >= this.maxBehaviors) {
      this.behaviors.shift();
    }
    this.behaviors.push(behavior);
  }

  /**
   * 获取所有已收集的行为数据
   * @returns 行为数据数组
   * @public
   */
  public getBehaviors(): BehaviorInfo[] {
    return [...this.behaviors];
  }

  /**
   * 清空行为数据队列
   * 通常在数据上报后调用
   * @public
   */
  public clearBehaviors(): void {
    this.behaviors = [];
  }

  /**
   * 记录自定义事件
   * 允许业务代码记录特定的用户行为
   * @param eventName 事件名称
   * @param data 事件相关数据
   * @public
   */
  public trackCustomEvent(eventName: string, data: Record<string, unknown>): void {
    if (!eventName) {
      console.error('[Pandeye] Event name is required for custom events');
      return;
    }

    const customData: CustomEventData = {
      eventName,
      ...data,
    };

    this.addBehavior({
      type: EVENT_TYPES.BEHAVIOR.CUSTOM as BehaviorType,
      data: customData,
      timestamp: now(),
      id: generateUniqueId(),
    });
  }

  /**
   * 停止监控
   * 清理事件监听器
   * @public
   */
  public dispose(): void {
    // 记录最终的停留时间
    this.handlePageLeave();

    this.isMonitoring = false;
    // 注意：为了完全清理，需要移除所有事件监听器，但这需要保存监听器引用
  }
}
