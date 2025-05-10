/**
 * 用户旅程追踪系统
 * 跟踪和分析用户在应用中的完整路径和行为模式
 */

import { generateUniqueId } from '../utils/common';

// 定义用户行为事件类型
export enum UserActionType {
  PAGE_VIEW = 'pageView',
  CLICK = 'click',
  INPUT = 'input',
  FORM_SUBMIT = 'formSubmit',
  NAVIGATION = 'navigation',
  API_CALL = 'apiCall',
  RESOURCE_LOAD = 'resourceLoad',
  ERROR = 'error',
  CUSTOM = 'custom',
}

export interface ActionPoint {
  id: string;
  type: UserActionType;
  timestamp: number;
  url: string;
  path?: string;
  duration?: number;
  target?: {
    type: string;
    id?: string;
    className?: string;
    text?: string;
    name?: string;
    value?: string;
    coords?: { x: number; y: number };
  };
  metadata?: Record<string, any>;
  previousActionId?: string;
}

export interface UserJourney {
  id: string;
  startTime: number;
  lastActivityTime: number;
  duration?: number;
  isActive: boolean;
  actions: ActionPoint[];
  sessionId: string;
  userId?: string;
  segments: JourneySegment[];
  metrics: JourneyMetrics;
}

export interface JourneySegment {
  id: string;
  startActionId: string;
  endActionId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  isComplete: boolean;
}

export interface JourneyMetrics {
  totalTime: number;
  averageTimePerAction: number;
  actionCount: number;
  pageViewCount: number;
  formInteractions: number;
  errorCount: number;
  conversionPoints: number;
  // 转化率
  conversionRate?: number;
}

interface JourneyTrackerOptions {
  maxActionsPerJourney: number;
  sessionTimeout: number;
  trackClicks: boolean;
  trackForms: boolean;
  trackNavigations: boolean;
  trackInputs: boolean;
  trackPageViews: boolean;
  // 哪些URL或元素不应该被追踪
  excludePatterns: RegExp[];
  // 哪些元素应该被特别关注（视为转化点）
  conversionElements: string[];
}

/**
 * 用户旅程追踪器
 * 全方位跟踪用户在网站/应用内的活动轨迹
 */
export class JourneyTracker {
  private active: boolean = false;
  private currentJourney?: UserJourney;
  private options: JourneyTrackerOptions;
  private ongoingSegments: Map<string, JourneySegment> = new Map();
  private elementObserver?: IntersectionObserver;
  private activityTimeout?: number;
  private journeyRecords: UserJourney[] = [];

  constructor(options?: Partial<JourneyTrackerOptions>) {
    this.options = {
      maxActionsPerJourney: 500,
      sessionTimeout: 30 * 60 * 1000, // 30分钟
      trackClicks: true,
      trackForms: true,
      trackNavigations: true,
      trackInputs: false, // 默认不记录输入，避免记录敏感信息
      trackPageViews: true,
      excludePatterns: [/password/i, /token/i, /credit/i, /card/i],
      conversionElements: [
        '[data-conversion]',
        'button[type="submit"]',
        'a.cta',
        '.checkout-button',
        '.signup-button',
      ],
    };

    // 合并用户配置
    if (options) {
      this.options = { ...this.options, ...options };
    }
  }

  /**
   * 启动用户旅程跟踪
   */
  public start(userId?: string): void {
    if (this.active) return;
    this.active = true;

    // 创建新的旅程
    this.startNewJourney(userId);

    // 设置各种事件监听
    this.setupEventListeners();

    // 记录初始页面访问
    this.recordAction({
      type: UserActionType.PAGE_VIEW,
      metadata: {
        title: document.title,
        referrer: document.referrer,
      },
    });

    // 设置元素观察器 (转化点)
    this.setupElementObserver();

    // 设置活动超时检查
    this.setupActivityTimeout();
  }

  /**
   * 创建新的用户旅程
   */
  private startNewJourney(userId?: string): void {
    // 如果有活跃旅程，先结束它
    if (this.currentJourney && this.currentJourney.isActive) {
      this.endJourney();
    }

    const timestamp = Date.now();

    // 创建新旅程
    this.currentJourney = {
      id: generateUniqueId(),
      startTime: timestamp,
      lastActivityTime: timestamp,
      isActive: true,
      actions: [],
      sessionId: this.getSessionId(),
      userId,
      segments: [],
      metrics: {
        totalTime: 0,
        averageTimePerAction: 0,
        actionCount: 0,
        pageViewCount: 0,
        formInteractions: 0,
        errorCount: 0,
        conversionPoints: 0,
      },
    };
  }

  /**
   * 获取当前会话ID
   */
  private getSessionId(): string {
    // 尝试获取现有会话ID，如果没有则创建新的
    let sessionId = localStorage.getItem('pandeye_session_id');
    if (!sessionId) {
      sessionId = generateUniqueId();
      localStorage.setItem('pandeye_session_id', sessionId);
      localStorage.setItem('pandeye_session_start', Date.now().toString());
    }

    // 检查会话是否超时
    const sessionStart = parseInt(localStorage.getItem('pandeye_session_start') || '0');
    if (Date.now() - sessionStart > this.options.sessionTimeout) {
      // 创建新会话
      sessionId = generateUniqueId();
      localStorage.setItem('pandeye_session_id', sessionId);
      localStorage.setItem('pandeye_session_start', Date.now().toString());
    }

    return sessionId;
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 页面导航
    if (this.options.trackNavigations) {
      window.addEventListener('popstate', () => {
        this.recordAction({
          type: UserActionType.NAVIGATION,
          metadata: {
            type: 'popstate',
            title: document.title,
          },
        });
      });

      // 拦截页面导航
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;

      history.pushState = (...args) => {
        originalPushState.apply(history, args);
        this.recordAction({
          type: UserActionType.NAVIGATION,
          metadata: {
            type: 'pushState',
            data: JSON.stringify(args[0]),
            title: document.title,
            url: args[2],
          },
        });
      };

      history.replaceState = (...args) => {
        originalReplaceState.apply(history, args);
        this.recordAction({
          type: UserActionType.NAVIGATION,
          metadata: {
            type: 'replaceState',
            data: JSON.stringify(args[0]),
            title: document.title,
            url: args[2],
          },
        });
      };
    }

    // 点击事件
    if (this.options.trackClicks) {
      document.addEventListener('click', e => {
        const target = e.target as HTMLElement;

        // 忽略符合排除模式的元素
        if (this.shouldExclude(target)) return;

        this.recordAction({
          type: UserActionType.CLICK,
          target: {
            type: target.tagName.toLowerCase(),
            id: target.id,
            className: target.className,
            text: this.getElementText(target),
            coords: { x: e.clientX, y: e.clientY },
          },
        });

        // 检查是否点击了转化点元素
        if (this.isConversionElement(target)) {
          this.recordConversionPoint(target);
        }
      });
    }

    // 表单提交
    if (this.options.trackForms) {
      document.addEventListener('submit', e => {
        const form = e.target as HTMLFormElement;

        // 忽略符合排除模式的表单
        if (this.shouldExclude(form)) return;

        this.recordAction({
          type: UserActionType.FORM_SUBMIT,
          target: {
            type: 'form',
            id: form.id,
            name: form.getAttribute('name') || undefined,
            className: form.className,
          },
          metadata: {
            action: form.action,
            method: form.method,
            formFields: this.getFormFieldNames(form),
          },
        });

        // 表单提交通常是一个转化点
        this.recordConversionPoint(form);
        this.currentJourney!.metrics.formInteractions++;
      });
    }

    // 输入事件
    if (this.options.trackInputs) {
      document.addEventListener('change', e => {
        const target = e.target as HTMLInputElement;

        // 忽略密码和敏感输入
        if (this.shouldExclude(target) || target.type === 'password') return;

        this.recordAction({
          type: UserActionType.INPUT,
          target: {
            type: target.tagName.toLowerCase(),
            id: target.id,
            name: target.name,
            className: target.className,
          },
          metadata: {
            inputType: target.type,
            // 不记录具体输入值，只记录是否有输入
            hasValue: target.value.length > 0,
          },
        });
      });
    }

    // XHR和Fetch API拦截
    this.interceptAjaxRequests();

    // 错误监听
    window.addEventListener('error', e => {
      this.recordAction({
        type: UserActionType.ERROR,
        metadata: {
          message: e.message,
          filename: e.filename,
          lineno: e.lineno,
          colno: e.colno,
        },
      });
      this.currentJourney!.metrics.errorCount++;
    });

    // Promise错误
    window.addEventListener('unhandledrejection', e => {
      this.recordAction({
        type: UserActionType.ERROR,
        metadata: {
          message: e.reason?.message || 'Unhandled Promise Rejection',
          reason: typeof e.reason === 'string' ? e.reason : JSON.stringify(e.reason),
        },
      });
      this.currentJourney!.metrics.errorCount++;
    });

    // 页面可见性变化
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        // 用户离开页面，记录上次活动时间
        this.updateLastActivity();
      } else {
        // 用户回到页面
        const now = Date.now();
        const inactiveTime = now - this.currentJourney!.lastActivityTime;

        // 如果超过会话超时时间，创建新旅程
        if (inactiveTime > this.options.sessionTimeout) {
          this.startNewJourney(this.currentJourney!.userId);
        }
      }
    });
  }

  /**
   * 记录行为
   */
  private recordAction(options: {
    type: UserActionType;
    target?: any;
    metadata?: Record<string, any>;
    duration?: number;
  }): ActionPoint | void {
    if (!this.active || !this.currentJourney) return;

    // 更新最后活动时间
    this.updateLastActivity();

    // 创建行为点
    const action: ActionPoint = {
      id: generateUniqueId(),
      type: options.type,
      timestamp: Date.now(),
      url: window.location.href,
      path: window.location.pathname,
      target: options.target,
      metadata: options.metadata,
      duration: options.duration,
    };

    // 如果有之前的动作，建立链接
    const lastAction = this.currentJourney.actions[this.currentJourney.actions.length - 1];
    if (lastAction) {
      action.previousActionId = lastAction.id;
    }

    // 添加到当前旅程
    this.currentJourney.actions.push(action);
    this.currentJourney.metrics.actionCount++;

    // 更新特定指标
    if (options.type === UserActionType.PAGE_VIEW) {
      this.currentJourney.metrics.pageViewCount++;
    }

    // 如果动作数量超过最大限制，结束当前旅程并开始新的
    if (this.currentJourney.actions.length >= this.options.maxActionsPerJourney) {
      this.endJourney();
      this.startNewJourney(this.currentJourney.userId);
    }

    return action;
  }

  /**
   * 更新最后活动时间
   */
  private updateLastActivity(): void {
    if (!this.currentJourney) return;

    this.currentJourney.lastActivityTime = Date.now();
    // 重置活动超时
    if (this.activityTimeout) {
      clearTimeout(this.activityTimeout);
      this.setupActivityTimeout();
    }
  }

  /**
   * 判断元素是否应该被排除
   */
  private shouldExclude(element: HTMLElement): boolean {
    // 检查元素本身及其属性是否符合排除模式
    const attributes = Array.from(element.attributes);

    for (const pattern of this.options.excludePatterns) {
      // 检查ID
      if (element.id && pattern.test(element.id)) return true;

      // 检查类名
      if (element.className && pattern.test(element.className)) return true;

      // 检查name属性
      const nameAttr = element.getAttribute('name');
      if (nameAttr && pattern.test(nameAttr)) return true;

      // 检查其他属性
      for (const attr of attributes) {
        if (pattern.test(attr.name) || pattern.test(attr.value)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 获取表单字段名称（不收集值）
   */
  private getFormFieldNames(form: HTMLFormElement): string[] {
    const fields = [];
    const elements = Array.from(form.elements) as HTMLElement[];

    for (const element of elements) {
      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
      ) {
        const name = element.name || element.id;
        if (name && !this.shouldExclude(element)) {
          fields.push(name);
        }
      }
    }

    return fields;
  }

  /**
   * 获取元素的文本内容
   */
  private getElementText(element: HTMLElement): string | undefined {
    // 获取元素文本，截断以避免过长
    const text = element.textContent?.trim();
    if (!text) return undefined;
    return text.length > 50 ? text.substring(0, 50) + '...' : text;
  }

  /**
   * 判断元素是否为转化点
   */
  private isConversionElement(element: HTMLElement): boolean {
    // 检查元素是否匹配任何转化点选择器
    for (const selector of this.options.conversionElements) {
      try {
        if (element.matches(selector)) return true;

        // 检查祖先元素（最多向上3层）
        let parent = element.parentElement;
        let depth = 0;

        while (parent && depth < 3) {
          if (parent.matches(selector)) return true;
          parent = parent.parentElement;
          depth++;
        }
      } catch (e) {
        // 忽略无效的选择器
      }
    }

    return false;
  }

  /**
   * 记录转化点
   */
  private recordConversionPoint(_element: HTMLElement): void {
    if (!this.currentJourney) return;

    this.currentJourney.metrics.conversionPoints++;

    // 如果存在足够的数据，计算转化率
    if (this.currentJourney.metrics.pageViewCount > 0) {
      this.currentJourney.metrics.conversionRate =
        this.currentJourney.metrics.conversionPoints / this.currentJourney.metrics.pageViewCount;
    }
  }

  /**
   * 设置元素观察器
   */
  private setupElementObserver(): void {
    if (!('IntersectionObserver' in window)) return;

    this.elementObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting && this.isConversionElement(entry.target as HTMLElement)) {
            // 转化点元素出现在可视区域
            this.recordConversionPoint(entry.target as HTMLElement);
          }
        });
      },
      {
        threshold: 0.5, // 元素至少有50%可见
      }
    );

    // 观察所有潜在的转化点元素
    for (const selector of this.options.conversionElements) {
      try {
        document.querySelectorAll(selector).forEach(el => {
          this.elementObserver!.observe(el);
        });
      } catch (e) {
        // 忽略无效的选择器
      }
    }
  }

  /**
   * 拦截AJAX请求
   */
  private interceptAjaxRequests(): void {
    // 拦截XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    const self = this;

    XMLHttpRequest.prototype.open = function (...args) {
      const method = args[0];
      const url = args[1];

      // 存储请求信息
      this._pandeyeTracker = {
        method,
        url,
        startTime: Date.now(),
      };

      return originalXHROpen.apply(this, args);
    };

    XMLHttpRequest.prototype.send = function (body) {
      if (this._pandeyeTracker) {
        // 记录请求启动
        self.recordAction({
          type: UserActionType.API_CALL,
          metadata: {
            method: this._pandeyeTracker.method,
            url: this._pandeyeTracker.url,
            requestBody:
              body instanceof FormData
                ? 'FormData'
                : typeof body === 'string'
                  ? body.length > 100
                    ? `${body.substring(0, 100)}...`
                    : body
                  : body
                    ? 'request data'
                    : null,
          },
        });

        // 监听加载完成
        this.addEventListener('load', function () {
          const duration = Date.now() - this._pandeyeTracker.startTime;
          self.recordAction({
            type: UserActionType.API_CALL,
            metadata: {
              method: this._pandeyeTracker.method,
              url: this._pandeyeTracker.url,
              status: this.status,
              duration,
              success: this.status >= 200 && this.status < 300,
            },
            duration,
          });
        });

        // 监听错误
        this.addEventListener('error', function () {
          const duration = Date.now() - this._pandeyeTracker.startTime;
          self.recordAction({
            type: UserActionType.API_CALL,
            metadata: {
              method: this._pandeyeTracker.method,
              url: this._pandeyeTracker.url,
              status: 'error',
              duration,
              success: false,
            },
            duration,
          });
        });
      }

      return originalXHRSend.apply(this, [...arguments]);
    };

    // 拦截Fetch API
    const originalFetch = window.fetch;
    window.fetch = function (input, init) {
      const startTime = Date.now();
      const url =
        typeof input === 'string' ? input : input instanceof Request ? input.url : 'unknown';
      const method = init?.method || (input instanceof Request ? input.method : 'GET');

      self.recordAction({
        type: UserActionType.API_CALL,
        metadata: {
          method,
          url,
          requestBody: init?.body ? 'request data' : null,
        },
      });

      return originalFetch
        .apply(this, [input, init])
        .then(response => {
          const duration = Date.now() - startTime;

          self.recordAction({
            type: UserActionType.API_CALL,
            metadata: {
              method,
              url,
              status: response.status,
              duration,
              success: response.ok,
            },
            duration,
          });

          return response;
        })
        .catch(error => {
          const duration = Date.now() - startTime;

          self.recordAction({
            type: UserActionType.API_CALL,
            metadata: {
              method,
              url,
              status: 'error',
              duration,
              success: false,
              error: error.message,
            },
            duration,
          });

          throw error;
        });
    };
  }

  /**
   * 开始旅程片段
   */
  public startSegment(name: string): string {
    if (!this.active || !this.currentJourney) {
      throw new Error('[Pandeye] Journey tracking is not active');
    }

    // 创建当前动作的ID（如果没有动作，使用旅程开始时间）
    const lastAction = this.currentJourney.actions[this.currentJourney.actions.length - 1];
    const startActionId = lastAction ? lastAction.id : generateUniqueId();

    const segment: JourneySegment = {
      id: generateUniqueId(),
      name,
      startTime: Date.now(),
      startActionId,
      isComplete: false,
    };

    // 添加到当前旅程和活动片段列表
    this.currentJourney.segments.push(segment);
    this.ongoingSegments.set(segment.id, segment);

    return segment.id;
  }

  /**
   * 结束旅程片段
   */
  public endSegment(segmentId: string): void {
    if (!this.active || !this.currentJourney) return;

    const segment = this.ongoingSegments.get(segmentId);
    if (!segment) return;

    // 更新片段信息
    segment.endTime = Date.now();
    segment.isComplete = true;

    // 获取当前最后一个动作的ID
    const lastAction = this.currentJourney.actions[this.currentJourney.actions.length - 1];
    if (lastAction) {
      segment.endActionId = lastAction.id;
    }

    // 从活动片段移除
    this.ongoingSegments.delete(segmentId);
  }

  /**
   * 记录自定义事件
   */
  public trackEvent(name: string, data?: any): void {
    if (!this.active || !this.currentJourney) return;

    this.recordAction({
      type: UserActionType.CUSTOM,
      metadata: {
        eventName: name,
        eventData: data,
      },
    });
  }

  /**
   * 设置活动超时
   */
  private setupActivityTimeout(): void {
    this.activityTimeout = window.setTimeout(() => {
      // 用户长时间不活动，结束当前旅程
      if (this.currentJourney && this.currentJourney.isActive) {
        const now = Date.now();
        const inactiveTime = now - this.currentJourney.lastActivityTime;

        if (inactiveTime > this.options.sessionTimeout) {
          this.endJourney();
        }
      }
    }, this.options.sessionTimeout);
  }

  /**
   * 结束当前旅程
   */
  public endJourney(): UserJourney | undefined {
    if (!this.currentJourney) return;

    // 标记为非活跃
    this.currentJourney.isActive = false;

    // 计算总时长
    this.currentJourney.duration =
      this.currentJourney.lastActivityTime - this.currentJourney.startTime;

    // 计算平均每个动作的时间
    if (this.currentJourney.metrics.actionCount > 0) {
      this.currentJourney.metrics.averageTimePerAction =
        this.currentJourney.duration / this.currentJourney.metrics.actionCount;
    }

    // 结束所有未完成的片段
    this.ongoingSegments.forEach((segment, id) => {
      this.endSegment(id);
    });

    // 更新完整的指标
    this.currentJourney.metrics.totalTime = this.currentJourney.duration;

    // 保存旅程记录
    this.journeyRecords.push({ ...this.currentJourney });

    return this.currentJourney;
  }

  /**
   * 停止追踪
   */
  public stop(): UserJourney | undefined {
    if (!this.active) return;

    this.active = false;
    const journey = this.endJourney();

    // 清理资源
    if (this.elementObserver) {
      this.elementObserver.disconnect();
    }

    if (this.activityTimeout) {
      clearTimeout(this.activityTimeout);
    }

    return journey;
  }

  /**
   * 获取所有已记录的旅程
   */
  public getJourneys(): UserJourney[] {
    return [...this.journeyRecords];
  }

  /**
   * 获取当前活跃旅程
   */
  public getCurrentJourney(): UserJourney | undefined {
    return this.currentJourney;
  }
}
