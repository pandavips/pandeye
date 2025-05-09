import { BehaviorInfo } from '../types';

/**
 * 用户行为监控类
 * 负责收集和记录用户在页面上的各种行为，包括：
 * 1. 页面访问（PV）
 * 2. 点击行为
 * 3. 路由变化
 * 4. 自定义事件
 */
export class BehaviorMonitor {
  private behaviors: BehaviorInfo[] = [];
  private maxBehaviors: number = 100;

  constructor() {
    this.init();
  }

  /**
   * 初始化行为监控
   * 开始监听各类用户行为
   * @private
   */
  private init(): void {
    this.trackPageView();
    this.trackClicks();
    this.trackRouteChange();
  }

  /**
   * 记录页面访问（PV）
   * 收集当前页面的URL、标题和来源页面信息
   * @private
   */
  private trackPageView(): void {
    // 记录页面访问
    this.addBehavior({
      type: 'pv',
      data: {
        url: window.location.href,
        title: document.title,
        referrer: document.referrer
      },
      timestamp: Date.now()
    });
  }

  /**
   * 监听点击行为
   * 收集用户点击元素的相关信息：
   * - 标签名
   * - 类名
   * - ID
   * - 文本内容
   * - 元素路径
   * @private
   */
  private trackClicks(): void {
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (!target) return;

      // 获取点击元素的相关信息
      const clickInfo = {
        tagName: target.tagName.toLowerCase(),
        className: target.className,
        id: target.id,
        text: target.textContent?.slice(0, 50),
        path: this.getElementPath(target)
      };

      this.addBehavior({
        type: 'click',
        data: clickInfo,
        timestamp: Date.now()
      });
    }, true);
  }

  /**
   * 监听路由变化
   * 适配 history 模式的前端路由
   * 使用自定义事件避免与其他库冲突
   * @private
   */
  private trackRouteChange(): void {
    // 监听 history 模式路由变化
    window.addEventListener('popstate', () => {
      this.recordRouteChange();
    });

    // 重写 history 方法，使用代理模式
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function(...args) {
      const result = originalPushState.apply(this, args);
      window.dispatchEvent(new CustomEvent('pandeye_route_change'));
      return result;
    };

    window.history.replaceState = function(...args) {
      const result = originalReplaceState.apply(this, args);
      window.dispatchEvent(new CustomEvent('pandeye_route_change'));
      return result;
    };

    // 监听自定义路由事件
    window.addEventListener('pandeye_route_change', () => {
      this.recordRouteChange();
    });
  }

  /**
   * 记录路由变化信息
   * 包含路由变化的来源和目标页面
   * @private
   */
  private recordRouteChange(): void {
    this.addBehavior({
      type: 'route',
      data: {
        from: document.referrer,
        to: window.location.href
      },
      timestamp: Date.now()
    });
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

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      if (current.id) {
      selector += `#${current.id}`;
    } else if (current.className && typeof current.className === 'string' && current.className.trim()) {
      // 处理多个类名，过滤空类名
      const classes = current.className
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .join('.');
      if (classes) {
        selector += `.${classes}`;
      }
    }
      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
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
    return this.behaviors;
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
  public trackCustomEvent(eventName: string, data: any): void {
    this.addBehavior({
      type: 'custom',
      data: {
        eventName,
        ...data
      },
      timestamp: Date.now()
    });
  }
}
