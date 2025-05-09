import { BehaviorInfo } from '../types';

export class BehaviorMonitor {
  private behaviors: BehaviorInfo[] = [];
  private maxBehaviors: number = 100;

  constructor() {
    this.init();
  }

  private init(): void {
    this.trackPageView();
    this.trackClicks();
    this.trackRouteChange();
  }

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

  private addBehavior(behavior: BehaviorInfo): void {
    if (this.behaviors.length >= this.maxBehaviors) {
      this.behaviors.shift();
    }
    this.behaviors.push(behavior);
  }

  public getBehaviors(): BehaviorInfo[] {
    return this.behaviors;
  }

  public clearBehaviors(): void {
    this.behaviors = [];
  }

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
