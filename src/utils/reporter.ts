/**
 * 数据上报模块
 * 负责将收集到的监控数据安全、高效地发送到服务器
 *
 * 特点：
 * 1. 批量上报 - 减少网络请求次数
 * 2. 智能重试 - 处理网络异常情况
 * 3. 离线缓存 - 支持网络恢复后补发
 * 4. 页面关闭前保存 - 确保数据不丢失
 * 5. 压缩数据 - 减少传输大小
 *
 * @module utils/reporter
 * @version 0.1.0
 */

import { ReportData, BaseReportData, ReportDataType } from '../types';
import { LIMITS, REPORT_TIMING } from '../constants';
import { now, generateUniqueId } from './common';
import { getSessionId } from './session';
import { collectDeviceInfo } from './device';

/**
 * 数据上报类
 * 负责将收集到的监控数据发送到服务器
 */
export class Reporter {
  private readonly url: string;
  private readonly maxRetries: number = LIMITS.DEFAULT_RETRY_COUNT;
  private queue: ReportData[] = [];
  private readonly batchSize: number = LIMITS.DEFAULT_BATCH_SIZE;
  private sending: boolean = false;
  private deviceInfo: any;

  // 离线存储键名
  private static readonly OFFLINE_CACHE_KEY = 'pandeye_offline_data';

  /**
   * 创建数据上报实例
   * @param url 数据上报的目标地址
   */
  constructor(url: string) {
    this.url = url;

    // 初始化设备信息
    this.initDeviceInfo();

    // 设置页面卸载前的处理
    this.setupBeforeUnload();

    // 检查网络状态变化
    this.setupNetworkStatusListener();

    // 检查离线缓存
    this.checkOfflineCache();
  }

  /**
   * 初始化设备信息
   * @private
   */
  private async initDeviceInfo(): Promise<void> {
    try {
      this.deviceInfo = collectDeviceInfo();
    } catch (error) {
      console.error('[Pandeye] Error collecting device info:', error);
      this.deviceInfo = { unknown: true };
    }
  }

  /**
   * 设置页面关闭前的数据处理
   * 使用 Navigator.sendBeacon API 确保数据在页面关闭前发送
   * @private
   */
  private setupBeforeUnload(): void {
    window.addEventListener('beforeunload', () => {
      // 页面关闭前发送所有待发送的数据
      if (this.queue.length > 0) {
        try {
          // 使用更可靠的sendBeacon API
          if (navigator.sendBeacon) {
            const blob = new Blob([JSON.stringify({ events: this.queue })], {
              type: 'application/json',
            });
            const success = navigator.sendBeacon(this.url, blob);

            // 如果sendBeacon失败，尝试保存到本地存储
            if (!success) {
              this.saveToOfflineCache(this.queue);
            }
          } else {
            // 降级处理：同步XHR请求 (不推荐，但作为后备)
            const xhr = new XMLHttpRequest();
            xhr.open('POST', this.url, false); // 同步请求
            xhr.setRequestHeader('Content-Type', 'application/json');
            try {
              xhr.send(JSON.stringify({ events: this.queue }));
            } catch (e) {
              // 如果请求失败，保存到离线缓存
              this.saveToOfflineCache(this.queue);
            }
          }
        } catch (error) {
          // 任何错误都尝试保存到离线缓存
          this.saveToOfflineCache(this.queue);
        } finally {
          this.queue = [];
        }
      }
    });
  }

  /**
   * 监听网络状态变化
   * 在网络恢复时发送缓存的数据
   * @private
   */
  private setupNetworkStatusListener(): void {
    if ('onLine' in navigator) {
      window.addEventListener('online', () => {
        this.checkOfflineCache();
      });
    }
  }

  /**
   * 保存数据到离线缓存
   * @param data - 要缓存的数据
   * @private
   */
  private saveToOfflineCache(data: ReportData[]): void {
    try {
      // 获取现有的缓存数据
      const existingData = this.getOfflineCache();

      // 合并数据并保存
      const mergedData = [...existingData, ...data];

      // 如果数据量太大，可能需要裁剪
      const limitedData = mergedData.slice(-100); // 限制最多100条

      localStorage.setItem(Reporter.OFFLINE_CACHE_KEY, JSON.stringify(limitedData));
    } catch (error) {
      console.error('[Pandeye] Failed to save data to offline cache:', error);
    }
  }

  /**
   * 获取离线缓存数据
   * @returns 缓存的数据数组
   * @private
   */
  private getOfflineCache(): ReportData[] {
    try {
      const cachedData = localStorage.getItem(Reporter.OFFLINE_CACHE_KEY);
      return cachedData ? JSON.parse(cachedData) : [];
    } catch (error) {
      console.error('[Pandeye] Failed to get offline cache:', error);
      return [];
    }
  }

  /**
   * 清除离线缓存
   * @private
   */
  private clearOfflineCache(): void {
    try {
      localStorage.removeItem(Reporter.OFFLINE_CACHE_KEY);
    } catch (error) {
      console.error('[Pandeye] Failed to clear offline cache:', error);
    }
  }

  /**
   * 检查并处理离线缓存
   * 当有缓存数据且网络可用时尝试发送
   * @private
   */
  private checkOfflineCache(): void {
    if (navigator.onLine) {
      const cachedData = this.getOfflineCache();

      if (cachedData.length > 0) {
        // 分批次发送缓存数据
        try {
          // 添加到当前队列
          this.queue.unshift(...cachedData);

          // 清除缓存
          this.clearOfflineCache();

          // 触发发送
          this.flush().catch(error => {
            console.error('[Pandeye] Failed to send cached data:', error);
          });
        } catch (error) {
          console.error('[Pandeye] Error processing offline cache:', error);
        }
      }
    }
  }

  /**
   * 将数据添加到上报队列
   * 当队列达到批量上报的阈值时，自动触发上报
   * @param data 需要上报的数据
   * @public
   */
  public async report(data: ReportData): Promise<void> {
    // 添加设备信息
    const enrichedData: ReportData = {
      ...data,
      device: this.deviceInfo,
      sessionId: getSessionId(),
      batchId: generateUniqueId(),
    };

    this.queue.push(enrichedData);

    // 当队列达到批量上报阈值或者是立即上报类型时，触发发送
    if (this.queue.length >= this.batchSize || data.type === REPORT_TIMING.IMMEDIATELY) {
      await this.flush();
    }
  }

  /**
   * 强制上报队列中的所有数据
   * 会尝试发送队列中所有待发送的数据
   * @public
   */
  public async flush(): Promise<void> {
    if (this.sending || this.queue.length === 0) return;

    // 如果没有网络连接，保存到离线缓存并返回
    if (navigator.onLine === false) {
      this.saveToOfflineCache(this.queue);
      this.queue = [];
      return;
    }

    this.sending = true;
    const batch = this.queue.splice(0, this.batchSize);

    try {
      await this.sendWithRetry({ events: batch });
    } catch (error) {
      // 发送失败，将数据保存到离线缓存
      this.saveToOfflineCache(batch);
      console.error('[Pandeye] Failed to send monitoring data:', error);
    } finally {
      this.sending = false;

      // 如果队列中还有数据，继续发送
      if (this.queue.length > 0) {
        // 使用setTimeout避免递归调用导致的调用栈溢出
        setTimeout(() => this.flush(), 0);
      }
    }
  }

  /**
   * 发送数据到服务器
   * 支持失败重试，重试间隔随重试次数增加
   * @param data 要发送的数据
   * @param retries 当前重试次数
   * @private
   * @throws 当重试次数达到上限时抛出错误
   */
  private async sendWithRetry(data: { events: ReportData[] }, retries: number = 0): Promise<void> {
    try {
      const controller = new AbortController();

      // 设置超时
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        signal: controller.signal,
        // 添加请求凭据，如果需要跨域携带cookie
        credentials: 'same-origin',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      // 类型转换处理错误对象
      const err = error as Error;

      if (err.name === 'AbortError') {
        console.warn('[Pandeye] Request timed out, retrying...');
      }

      if (retries < this.maxRetries) {
        // 延迟重试，时间随重试次数增加
        const delay = Math.pow(2, retries) * LIMITS.RETRY_DELAY_BASE;
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.sendWithRetry(data, retries + 1);
      }
      throw error;
    }
  }
}

/**
 * 创建上报数据对象
 * @param type 数据类型
 * @param data 上报的数据
 * @returns 基础上报数据对象
 */
export function createBaseReportData(type: ReportDataType, data: unknown): BaseReportData {
  return {
    type,
    data,
    timestamp: now(),
    sessionId: getSessionId(),
  };
}
