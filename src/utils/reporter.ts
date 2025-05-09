export interface ReportData {
  appId: string;
  timestamp: number;
  type: string;
  data: any;
}

export class Reporter {
  private readonly url: string;
  private readonly maxRetries: number = 3;
  private queue: ReportData[] = [];
  private readonly batchSize: number = 10;
  private sending: boolean = false;

  constructor(url: string) {
    this.url = url;
    this.setupBeforeUnload();
  }

  private setupBeforeUnload(): void {
    window.addEventListener('beforeunload', () => {
      // 页面关闭前发送所有待发送的数据
      if (this.queue.length > 0) {
        const blob = new Blob(
          [JSON.stringify({ events: this.queue })],
          { type: 'application/json' }
        );
        navigator.sendBeacon(this.url, blob);
        this.queue = [];
      }
    });
  }

  public async report(data: ReportData): Promise<void> {
    this.queue.push(data);

    if (this.queue.length >= this.batchSize) {
      await this.flush();
    }
  }

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
