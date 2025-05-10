/**
 * 高效传输与数据优化工具
 * 提供数据压缩、批处理和智能传输控制
 */

import { compress } from './compression';

// 传输状态
export enum TransportState {
  IDLE = 'idle',
  SENDING = 'sending',
  RETRYING = 'retrying',
  OFFLINE = 'offline',
}

// 传输配置
export interface TransportConfig {
  // 最大重试次数
  maxRetries: number;

  // 重试间隔基数 (ms)
  retryBaseInterval: number;

  // 是否使用压缩
  useCompression: boolean;

  // 数据包大小上限 (bytes)
  maxPacketSize: number;

  // 最大批处理大小
  maxBatchSize: number;

  // 离线存储限制 (items)
  offlineStorageLimit: number;

  // 传输超时 (ms)
  timeout: number;

  // 是否使用sendBeacon进行页面卸载时的上报
  useBeacon: boolean;

  // 传输优先级
  priority: 'high' | 'normal' | 'low';

  // 在弱网络环境下减少上报频率
  throttleOnPoorConnection: boolean;
}

// 队列项
interface QueueItem<T> {
  id: string;
  data: T;
  timestamp: number;
  retries: number;
  priority: number;
}

/**
 * 智能传输控制器
 * 处理数据发送、重试、离线缓存等
 */
export class TransportController<T> {
  private config: TransportConfig;
  private queue: Array<QueueItem<T>> = [];
  private offlineQueue: Array<QueueItem<T>> = [];
  private state: TransportState = TransportState.IDLE;
  private isOnline: boolean = true;
  private retryTimeout?: number;
  private sendPromise?: Promise<any>;

  constructor(config?: Partial<TransportConfig>) {
    // 默认配置
    this.config = {
      maxRetries: 3,
      retryBaseInterval: 1000,
      useCompression: true,
      maxPacketSize: 1024 * 100, // 100KB
      maxBatchSize: 50,
      offlineStorageLimit: 500,
      timeout: 10000,
      useBeacon: true,
      priority: 'normal',
      throttleOnPoorConnection: true,
      ...config,
    };

    // 初始化
    this.initialize();
  }

  /**
   * 初始化监听器
   */
  private initialize(): void {
    // 监听网络状态变化
    window.addEventListener('online', this.handleNetworkChange.bind(this));
    window.addEventListener('offline', this.handleNetworkChange.bind(this));

    // 监听页面卸载事件
    window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));

    // 检查初始网络状态
    this.isOnline = navigator.onLine !== undefined ? navigator.onLine : true;
  }

  /**
   * 处理网络状态变化
   */
  private handleNetworkChange(): void {
    const wasOnline = this.isOnline;
    this.isOnline = navigator.onLine !== undefined ? navigator.onLine : true;

    if (!wasOnline && this.isOnline) {
      // 网络恢复，尝试发送离线队列
      this.state = TransportState.IDLE;
      this.processOfflineQueue();
    } else if (wasOnline && !this.isOnline) {
      // 网络断开
      this.state = TransportState.OFFLINE;
    }
  }

  /**
   * 处理页面卸载事件
   */
  private handleBeforeUnload(): void {
    if (this.queue.length === 0) return;

    // 如果支持并配置了使用sendBeacon，用它发送最后的数据
    if (this.config.useBeacon && navigator.sendBeacon) {
      try {
        const items = this.queue.slice(0, this.config.maxBatchSize);
        const data = items.map(item => item.data);

        // 准备要发送的数据
        let payload = JSON.stringify(data);

        // 如果配置了压缩且数据量足够大，进行压缩
        if (this.config.useCompression && payload.length > 1024) {
          payload = compress(payload);
        }

        // 使用Beacon API发送
        navigator.sendBeacon('/analytics', payload);

        // 清除已发送的项目
        this.queue = this.queue.slice(this.config.maxBatchSize);

        // 如果剩余项目无法发送，存储到本地
        if (this.queue.length > 0) {
          this.storeOfflineData();
        }
      } catch (err) {
        console.error('[Pandeye] Failed to send data with beacon:', err);
      }
    } else {
      // 否则将数据存储到离线存储
      this.storeOfflineData();
    }
  }

  /**
   * 将当前队列存储到离线存储
   */
  private storeOfflineData(): void {
    try {
      // 限制离线存储大小
      const offlineData = [...this.offlineQueue, ...this.queue].slice(
        -this.config.offlineStorageLimit
      );

      // 存储到localStorage
      localStorage.setItem('pandeye_offline_data', JSON.stringify(offlineData));
    } catch (err) {
      console.error('[Pandeye] Failed to store offline data:', err);
    }
  }

  /**
   * 从本地存储恢复离线数据
   */
  private loadOfflineData(): void {
    try {
      const storedData = localStorage.getItem('pandeye_offline_data');
      if (storedData) {
        this.offlineQueue = JSON.parse(storedData);
        localStorage.removeItem('pandeye_offline_data');
      }
    } catch (err) {
      console.error('[Pandeye] Failed to load offline data:', err);
    }
  }

  /**
   * 处理离线队列
   */
  private processOfflineQueue(): void {
    // 首先加载可能存储在本地的数据
    this.loadOfflineData();

    if (this.offlineQueue.length === 0) return;

    // 将离线队列中的项目移到主队列
    while (this.offlineQueue.length > 0 && this.queue.length < this.config.maxBatchSize) {
      const item = this.offlineQueue.shift();
      if (item) {
        this.queue.push(item);
      }
    }

    // 触发发送
    this.processQueue();
  }

  /**
   * 添加项目到队列
   */
  public enqueue(data: T, priority: number = 0): void {
    const item: QueueItem<T> = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      data,
      timestamp: Date.now(),
      retries: 0,
      priority,
    };

    // 根据优先级插入队列
    const insertIndex = this.queue.findIndex(existing => existing.priority < priority);
    if (insertIndex === -1) {
      this.queue.push(item);
    } else {
      this.queue.splice(insertIndex, 0, item);
    }

    // 触发队列处理
    this.processQueue();
  }

  /**
   * 处理队列
   */
  private processQueue(): void {
    // 如果当前正在发送或离线，则返回
    if (this.state !== TransportState.IDLE || !this.isOnline) {
      return;
    }

    // 如果队列为空，则返回
    if (this.queue.length === 0) {
      return;
    }

    // 如果之前的重试超时还在，清除它
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = undefined;
    }

    // 批量处理
    const batch = this.queue.slice(0, this.config.maxBatchSize);

    // 更新状态
    this.state = TransportState.SENDING;

    // 发送批次
    this.sendBatch(batch);
  }

  /**
   * 发送批次数据
   */
  private async sendBatch(batch: Array<QueueItem<T>>): Promise<void> {
    try {
      // 如果网络连接较差，减少发送大小
      const effectiveBatchSize = this.shouldThrottleSending()
        ? Math.max(1, Math.floor(batch.length / 3))
        : batch.length;

      // 取实际要发送的批次
      const effectiveBatch = batch.slice(0, effectiveBatchSize);

      // 提取数据
      const payloadData = effectiveBatch.map(item => item.data);

      // 发送数据
      const result = await this.sendData(payloadData);

      // 发送成功
      if (result.success) {
        // 从队列中移除已发送的项目
        for (const item of effectiveBatch) {
          const index = this.queue.findIndex(i => i.id === item.id);
          if (index !== -1) {
            this.queue.splice(index, 1);
          }
        }

        // 更新状态
        this.state = TransportState.IDLE;

        // 如果队列还有数据，继续处理
        if (this.queue.length > 0) {
          this.processQueue();
        }
      } else {
        // 发送失败，进入重试状态
        this.handleSendFailure(effectiveBatch);
      }
    } catch (error) {
      console.error('[Pandeye] Error sending batch:', error);
      this.handleSendFailure(batch);
    }
  }

  /**
   * 处理发送失败
   */
  private handleSendFailure(batch: Array<QueueItem<T>>): void {
    // 更新状态
    this.state = TransportState.RETRYING;

    // 为每个失败的项目增加重试计数
    for (const item of batch) {
      item.retries++;

      // 如果超过最大重试次数，从队列中移除
      if (item.retries > this.config.maxRetries) {
        const index = this.queue.findIndex(i => i.id === item.id);
        if (index !== -1) {
          this.queue.splice(index, 1);

          // 添加到离线队列以便将来尝试
          this.offlineQueue.push(item);

          // 确保离线队列不超过限制
          if (this.offlineQueue.length > this.config.offlineStorageLimit) {
            this.offlineQueue.shift();
          }
        }
      }
    }

    // 计算指数退避的重试间隔
    const baseRetryMs = this.config.retryBaseInterval;
    const maxRetryCount = batch.reduce((max, item) => Math.max(max, item.retries), 0);
    const retryDelayMs = baseRetryMs * Math.pow(2, maxRetryCount - 1);
    const jitterMs = Math.random() * baseRetryMs;

    // 设置重试超时
    this.retryTimeout = window.setTimeout(() => {
      this.retryTimeout = undefined;
      this.state = TransportState.IDLE;
      this.processQueue();
    }, retryDelayMs + jitterMs);
  }

  /**
   * 发送数据
   * 实际的网络传输逻辑
   */
  private async sendData(data: T[]): Promise<{ success: boolean; error?: any }> {
    if (!this.isOnline) {
      return { success: false, error: 'Network is offline' };
    }

    // 准备要发送的数据
    let payload = JSON.stringify(data);
    let useCompression = false;

    // 如果配置了压缩且数据量足够大，进行压缩
    if (this.config.useCompression && payload.length > 1024) {
      const compressed = compress(payload);

      // 只有当压缩后确实更小时才使用压缩结果
      if (compressed.length < payload.length) {
        payload = compressed;
        useCompression = true;
      }
    }

    // 构建请求头
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // 添加压缩标志
    if (useCompression) {
      headers['Content-Encoding'] = 'gzip';
    }

    // 添加优先级标志
    headers['X-Priority'] = this.config.priority;

    try {
      // 创建带超时的fetch请求
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      // 发送请求
      const response = await fetch('/analytics', {
        method: 'POST',
        headers,
        body: payload,
        signal: controller.signal,
      });

      // 清除超时
      clearTimeout(timeoutId);

      return { success: response.ok };
    } catch (error) {
      return { success: false, error };
    }
  }

  /**
   * 检查是否应该降低发送频率
   * 在网络连接不佳时减少数据发送
   */
  private shouldThrottleSending(): boolean {
    if (!this.config.throttleOnPoorConnection) {
      return false;
    }

    // 使用网络信息API检测慢速连接
    if ('connection' in navigator) {
      const conn = (navigator as any).connection;

      if (conn) {
        // 2G或慢速连接
        if (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g') {
          return true;
        }

        // 如果已知的下行速度很低
        if (conn.downlink && conn.downlink < 0.5) {
          // 小于0.5Mbps
          return true;
        }

        // 如果已知的RTT很高
        if (conn.rtt && conn.rtt > 500) {
          // 大于500ms
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 获取当前状态
   */
  public getState(): TransportState {
    return this.state;
  }

  /**
   * 获取队列中的项目数
   */
  public getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * 获取离线队列中的项目数
   */
  public getOfflineQueueLength(): number {
    return this.offlineQueue.length;
  }

  /**
   * 清除所有队列
   */
  public clearQueues(): void {
    this.queue = [];
    this.offlineQueue = [];
    localStorage.removeItem('pandeye_offline_data');
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<TransportConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}
