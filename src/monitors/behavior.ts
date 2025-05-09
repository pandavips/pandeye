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

    // 重写 history 方法
    const methods = ['pushState', 'replaceState'];
    methods.forEach(method => {
      const original = window.history[method];
      window.history[method] = function (...args) {
        const result = original.apply(this, args);
        window.dispatchEvent(new Event('popstate'));
        return result;
      };
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
      } else if (current.className) {
        selector += `.${current.className.split(' ').join('.')}`;
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
