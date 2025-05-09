/**
 * 上报数据的接口定义
 */
export interface BaseReportData {
  type: string;
  data: any;
  timestamp: number;
}
export interface ReportData extends BaseReportData {
  appId: string;
  env: string;
}

/**
 * 数据上报类
 * 负责将收集到的监控数据发送到服务器
 *
 * 特点：
 * 1. 支持批量上报
 * 2. 支持失败重试
 * 3. 支持页面关闭前保存数据
 * 4. 队列管理防止数据丢失
 */
export class Reporter {
  private readonly url: string;
  private readonly maxRetries: number = 3;
  private queue: ReportData[] = [];
  private readonly batchSize: number = 10;
  private sending: boolean = false;

  /**
   * 创建数据上报实例
   * @param url 数据上报的目标地址
   */
  constructor(url: string) {
    this.url = url;
    this.setupBeforeUnload();
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
        const blob = new Blob([JSON.stringify({ events: this.queue })], {
          type: 'application/json',
        });
        navigator.sendBeacon(this.url, blob);
        this.queue = [];
      }
    });
  }

  /**
   * 将数据添加到上报队列
   * 当队列达到批量上报的阈值时，自动触发上报
   * @param data 需要上报的数据
   * @public
   */
  public async report(data: ReportData): Promise<void> {
    this.queue.push(data);

    if (this.queue.length >= this.batchSize) {
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

    this.sending = true;
    const batch = this.queue.splice(0, this.batchSize);

    try {
      await this.sendWithRetry({ events: batch });
    } catch (error) {
      // 发送失败，将数据放回队列
      this.queue.unshift(...batch);
      console.error('Failed to send monitoring data:', error);
    } finally {
      this.sending = false;

      // 如果队列中还有数据，继续发送
      if (this.queue.length > 0) {
        await this.flush();
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
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      if (retries < this.maxRetries) {
        // 延迟重试，时间随重试次数增加
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
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
 * @private
 */
export function createBaseReportData(type: string, data: any): any {
  return {
    type,
    data,
    timestamp: Date.now(),
  };
}
