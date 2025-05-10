/**
 * 高性能事件系统
 * 提供事件派发、监听和管理功能
 * 支持优先级、异步事件和条件过滤
 */

interface EventSubscriber<T = any> {
  callback: (event: T) => void | Promise<void>;
  priority: number;
  once: boolean;
  filter?: (event: T) => boolean;
}

interface EventConfig {
  /**
   * 是否支持异步事件处理
   */
  async?: boolean;

  /**
   * 是否捕获和记录事件处理错误
   */
  catchErrors?: boolean;

  /**
   * 是否保留事件历史
   */
  keepHistory?: boolean;

  /**
   * 历史记录最大长度
   */
  historyLimit?: number;
}

interface EventHistory<T = any> {
  timestamp: number;
  eventName: string;
  data: T;
  processed: boolean;
  processingTime?: number;
  errors?: Error[];
}

/**
 * 事件总线
 * 负责事件的注册、分发和监听
 */
export class EventBus {
  private subscribers: Map<string, EventSubscriber[]> = new Map();
  private eventConfigs: Map<string, EventConfig> = new Map();
  private eventHistory: EventHistory[] = [];
  private defaultConfig: EventConfig = {
    async: false,
    catchErrors: true,
    keepHistory: false,
    historyLimit: 100,
  };

  /**
   * 配置事件
   * @param eventName 事件名称
   * @param config 事件配置
   */
  public configureEvent(eventName: string, config: EventConfig): void {
    this.eventConfigs.set(eventName, {
      ...this.defaultConfig,
      ...config,
    });
  }

  /**
   * 注册事件监听器
   *
   * @param eventName 事件名称
   * @param callback 回调函数
   * @param options 选项
   * @returns 取消订阅的函数
   */
  public on<T = any>(
    eventName: string,
    callback: (event: T) => void | Promise<void>,
    options?: {
      priority?: number;
      once?: boolean;
      filter?: (event: T) => boolean;
    }
  ): () => void {
    const priority = options?.priority ?? 0;
    const once = options?.once ?? false;
    const filter = options?.filter;

    // 确保有订阅者数组
    if (!this.subscribers.has(eventName)) {
      this.subscribers.set(eventName, []);
    }

    // 创建订阅者对象
    const subscriber: EventSubscriber<T> = {
      callback,
      priority,
      once,
      filter,
    };

    // 添加到订阅者列表
    const subscribers = this.subscribers.get(eventName)!;
    subscribers.push(subscriber);

    // 根据优先级排序
    subscribers.sort((a, b) => b.priority - a.priority);

    // 返回取消订阅函数
    return () => {
      const index = subscribers.indexOf(subscriber);
      if (index !== -1) {
        subscribers.splice(index, 1);
      }
    };
  }

  /**
   * 注册一次性事件监听器
   *
   * @param eventName 事件名称
   * @param callback 回调函数
   * @param options 选项
   * @returns 取消订阅的函数
   */
  public once<T = any>(
    eventName: string,
    callback: (event: T) => void | Promise<void>,
    options?: {
      priority?: number;
      filter?: (event: T) => boolean;
    }
  ): () => void {
    return this.on(eventName, callback, {
      ...options,
      once: true,
    });
  }

  /**
   * 派发事件
   *
   * @param eventName 事件名称
   * @param data 事件数据
   * @returns 如果是异步事件，返回Promise
   */
  public emit<T = any>(eventName: string, data: T): void | Promise<void> {
    const subscribers = this.subscribers.get(eventName) || [];
    const config = this.eventConfigs.get(eventName) || this.defaultConfig;
    const startTime = performance.now();

    // 创建历史记录
    let history: EventHistory | undefined;
    if (config.keepHistory) {
      history = {
        timestamp: Date.now(),
        eventName,
        data,
        processed: false,
      };
      this.eventHistory.push(history);

      // 限制历史记录长度
      if (this.eventHistory.length > (config.historyLimit || this.defaultConfig.historyLimit!)) {
        this.eventHistory.shift();
      }
    }

    // 同步处理
    if (!config.async) {
      const removeIndices: number[] = [];

      for (let i = 0; i < subscribers.length; i++) {
        const subscriber = subscribers[i];

        // 检查过滤器
        if (subscriber.filter && !subscriber.filter(data)) {
          continue;
        }

        try {
          subscriber.callback(data);
        } catch (error) {
          if (config.catchErrors) {
            console.error(`[Pandeye] Error in event handler for ${eventName}:`, error);

            // 记录错误
            if (history) {
              history.errors = history.errors || [];
              history.errors.push(error as Error);
            }
          } else {
            throw error;
          }
        }

        // 记录一次性监听器
        if (subscriber.once) {
          removeIndices.unshift(i);
        }
      }

      // 删除一次性监听器
      for (const index of removeIndices) {
        subscribers.splice(index, 1);
      }

      // 更新历史记录
      if (history) {
        history.processed = true;
        history.processingTime = performance.now() - startTime;
      }

      return;
    }

    // 异步处理
    return (async () => {
      const removeIndices: number[] = [];

      for (let i = 0; i < subscribers.length; i++) {
        const subscriber = subscribers[i];

        // 检查过滤器
        if (subscriber.filter && !subscriber.filter(data)) {
          continue;
        }

        try {
          await subscriber.callback(data);
        } catch (error) {
          if (config.catchErrors) {
            console.error(`[Pandeye] Error in event handler for ${eventName}:`, error);

            // 记录错误
            if (history) {
              history.errors = history.errors || [];
              history.errors.push(error as Error);
            }
          } else {
            throw error;
          }
        }

        // 记录一次性监听器
        if (subscriber.once) {
          removeIndices.unshift(i);
        }
      }

      // 删除一次性监听器
      for (const index of removeIndices) {
        subscribers.splice(index, 1);
      }

      // 更新历史记录
      if (history) {
        history.processed = true;
        history.processingTime = performance.now() - startTime;
      }
    })();
  }

  /**
   * 检查是否有指定事件的监听器
   *
   * @param eventName 事件名称
   * @returns 是否有监听器
   */
  public hasListeners(eventName: string): boolean {
    const subscribers = this.subscribers.get(eventName);
    return subscribers !== undefined && subscribers.length > 0;
  }

  /**
   * 获取指定事件的监听器数量
   *
   * @param eventName 事件名称
   * @returns 监听器数量
   */
  public countListeners(eventName: string): number {
    const subscribers = this.subscribers.get(eventName);
    return subscribers ? subscribers.length : 0;
  }

  /**
   * 移除指定事件的所有监听器
   *
   * @param eventName 事件名称
   */
  public removeAllListeners(eventName: string): void {
    this.subscribers.delete(eventName);
  }

  /**
   * 获取事件历史记录
   *
   * @param eventName 可选的事件名称过滤
   * @param limit 可选的限制数量
   * @returns 事件历史记录
   */
  public getHistory(eventName?: string, limit?: number): EventHistory[] {
    let history = this.eventHistory;

    // 按事件名称过滤
    if (eventName) {
      history = history.filter(h => h.eventName === eventName);
    }

    // 限制数量
    if (limit && history.length > limit) {
      history = history.slice(-limit);
    }

    return history;
  }

  /**
   * 清除事件历史记录
   */
  public clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * 设置默认事件配置
   *
   * @param config 默认配置
   */
  public setDefaultConfig(config: Partial<EventConfig>): void {
    this.defaultConfig = {
      ...this.defaultConfig,
      ...config,
    };
  }
}

/**
 * 全局事件总线实例
 */
export const eventBus = new EventBus();
