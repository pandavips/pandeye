/**
 * 错误重试队列
 * 处理需要重试的错误，支持延迟重试和退避策略
 */

import { LIMITS } from '../constants';

interface RetryItem<T> {
  id: string;
  data: T;
  retryCount: number;
  lastRetry: number;
  processFn: (data: T) => Promise<boolean>;
}

export class RetryQueue<T> {
  private queue: Map<string, RetryItem<T>> = new Map();
  private processing: boolean = false;
  private readonly maxRetries: number;
  private readonly baseDelay: number;
  private readonly maxDelay: number;

  constructor(
    maxRetries: number = LIMITS.DEFAULT_RETRY_COUNT,
    baseDelay: number = LIMITS.RETRY_DELAY_BASE,
    maxDelay: number = LIMITS.MAX_RETRY_DELAY
  ) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
  }

  /**
   * 添加重试项到队列
   * @param id - 重试项唯一标识
   * @param data - 需要重试的数据
   * @param processFn - 处理函数，返回是否处理成功
   */
  public add(id: string, data: T, processFn: (data: T) => Promise<boolean>): void {
    if (!this.queue.has(id)) {
      this.queue.set(id, {
        id,
        data,
        retryCount: 0,
        lastRetry: 0,
        processFn,
      });

      // 如果队列未在处理中，开始处理
      if (!this.processing) {
        this.processQueue();
      }
    }
  }

  /**
   * 处理重试队列
   * @private
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.size === 0) return;

    this.processing = true;

    for (const [id, item] of this.queue) {
      // 检查是否需要等待
      const now = Date.now();
      const nextRetryTime = this.calculateNextRetryTime(item);

      if (now < nextRetryTime) {
        continue;
      }

      try {
        const success = await item.processFn(item.data);

        if (success) {
          // 处理成功，从队列中移除
          this.queue.delete(id);
          continue;
        }

        // 处理失败，增加重试次数
        item.retryCount++;
        item.lastRetry = now;

        // 检查是否超过最大重试次数
        if (item.retryCount >= this.maxRetries) {
          console.warn(`Retry item ${id} exceeded max retries, removing from queue`);
          this.queue.delete(id);
        }
      } catch (error) {
        console.error(`Error processing retry item ${id}:`, error);
        // 错误时也计数重试次数
        item.retryCount++;
        item.lastRetry = now;

        // 检查是否超过最大重试次数
        if (item.retryCount >= this.maxRetries) {
          console.warn(`Retry item ${id} exceeded max retries due to error, removing from queue`);
          this.queue.delete(id);
        }
      }
    }

    this.processing = false;

    // 如果队列不为空，安排下一次处理
    if (this.queue.size > 0) {
      const nextRetry = Math.min(
        ...Array.from(this.queue.values()).map(item => this.calculateNextRetryTime(item))
      );

      const delay = Math.max(0, nextRetry - Date.now());
      setTimeout(() => this.processQueue(), delay);
    }
  }

  /**
   * 计算下一次重试时间，使用指数退避策略
   * @param item - 重试项
   * @returns 下一次重试的时间戳
   * @private
   */
  private calculateNextRetryTime(item: RetryItem<T>): number {
    if (item.retryCount === 0) return 0;

    // 使用指数退避策略计算延迟
    const delay = Math.min(this.baseDelay * Math.pow(2, item.retryCount - 1), this.maxDelay);

    return item.lastRetry + delay;
  }

  /**
   * 获取当前队列大小
   */
  public get size(): number {
    return this.queue.size;
  }

  /**
   * 清空重试队列
   */
  public clear(): void {
    this.queue.clear();
    this.processing = false;
  }
}
