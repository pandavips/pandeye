import { ReporterBaseData, ReporterData, ReporterOptions, Transport } from '@/types';
import { Original } from '@/utils';
import { DataCrypto } from '@/utils/crypto';
import { v4 as uuidv4 } from 'uuid';

// const CACHE_KEY = 'pandeye_reporter_wait_queue';

/**
 * 通用数据上报器，支持自定义配置选项
 */
export class Reporter {
  private readonly reportId!: string; // 每次打开刷新页面都会生成一个新的 reportId
  private readonly appId!: string; // 应用标识
  private readonly reportUrl!: string; // 数据上报的目标地址
  private readonly maxRetries!: number; // 发送失败后的最大重试次数
  private readonly batchSize!: number; // 批量发送时的数据条数
  private readonly flushInterval?: number; // 自动上报的时间间隔（以毫秒为单位）
  private intervalId?: number; // 自动上报的定时器标识
  private readonly environment!: string; // 环境标识
  private readonly publicKey!: string; // RSA公钥（Base64格式）
  private cryptoKey?: CryptoKey; // 缓存已导入的公钥
  private queue: ReporterData[] = []; // 待上报的数据队列
  private sending: boolean = false; // 是否正在进行数据上报
  private transport!: Transport; // 数据传输的具体实现
  private reportTimes: number[] = []; // 记录最近的上报时间戳
  private readonly maxReportsPerSecond: number = 200; // 每秒最大上报次数,超过则认为异常
  private readonly timeWindow: number = 1000; // 检测时间窗口(毫秒)
  private isAbnormal: boolean = false; // 是否处于异常状态

  /**
   * 构造函数
   * @param options - 上报器配置选项
   */
  constructor(options: ReporterOptions) {
    try {
      // 检查浏览器是否支持必需的加密功能
      if (!window.crypto || !window.crypto.subtle || !crypto.subtle.encrypt) {
        throw new Error('当前浏览器不支持必需的加密功能');
      }

      // 校验构造器参数
      if (!options.reportUrl) {
        throw new Error('上报器必须提供一个有效的URL');
      }

      try {
        new URL(options.reportUrl);
      } catch (e) {
        throw new Error('提供的URL格式无效');
      }

      if (typeof options.appId !== 'string') {
        throw new Error('上报器必须提供一个有效的appId');
      }

      if (typeof options.publicKey !== 'string') {
        throw new Error('上报器必须提供一个有效的RSA公钥');
      }

      if (!options.environment) {
        Original.consoleWarn('上报器未提供环境标识(environment)，默认使用"none",请根据需要设置!');
      }

      this.appId = options.appId;
      this.reportUrl = options.reportUrl;
      this.reportId = uuidv4();
      this.environment = options.environment || 'none';
      this.maxRetries = options.maxRetries || 5;
      this.batchSize = options.batchSize || 1;
      this.transport = options.transport || new FetchTransport();
      this.publicKey = options.publicKey;

      // this.queue = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]') || [];

      if (options.autoFlushInterval) {
        this.flushInterval = options.autoFlushInterval || 10;
        this.startAutoFlush();
      }

      if (options.flushBeforeUnload !== false) {
        this.setupBeforeUnload();
      }
    } catch (error) {
      Original.consoleError('Reporter 初始化失败:', error);
    }
  }

  private pushData(data: ReporterBaseData) {
    this.queue.push({
      appId: this.appId,
      reportId: this.reportId,
      environment: this.environment,
      timestamp: data.timestamp || Date.now(),
      ...data,
    });
    // localStorage.setItem(CACHE_KEY, JSON.stringify(this.queue));
  }

  private shiftData() {
    const data = this.queue.shift();
    // localStorage.setItem(CACHE_KEY, JSON.stringify(this.queue));
    return data;
  }

  /**
   * 加密上报数据
   * @param data - 待上报的数据
   */
  public async report(data: ReporterBaseData): Promise<void> {
    if (this.isAbnormal) {
      return; // 如果处于异常状态，停止上报
    }

    if (this.checkReportFrequency()) {
      return; // 如果检测到频率异常，停止上报
    }

    if (typeof data !== 'object' || data === null) {
      Original.consoleError('上报数据格式错误:', data);
      return;
    }

    if (typeof data.type !== 'string') {
      Original.consoleError('上报数据的type属性必须是一个字符串');
      return;
    }

    if (!data.payload) {
      Original.consoleError('上报数据的payload属性必须存在');
      return;
    }

    const timestamp = data.timestamp || Date.now();

    // 懒加载方式导入公钥
    if (!this.cryptoKey) {
      this.cryptoKey = await DataCrypto.importPublicKey(this.publicKey);
    }

    // 加密payload数据
    const encryptedChunks = await DataCrypto.encryptObject(data.payload, this.cryptoKey);

    const chunkArray = encryptedChunks.map((chunk, index) => ({
      chunk,
      index,
      total: encryptedChunks.length,
    }));

    this.pushData({
      type: data.type,
      payload: chunkArray,
      timestamp,
    });

    if (this.queue.length >= this.batchSize) {
      await this.flush();
    }
  }

  /**
   * 设置页面卸载前的数据上报
   */
  private setupBeforeUnload(): void {
    window.addEventListener('beforeunload', () => {
      if (this.queue.length > 0) {
        const dataToReport = { events: this.queue };
        this.transport.sendBeacon(this.reportUrl, dataToReport);
        this.queue = [];
      }
    });
  }

  /**
   * 启动定时上报
   */
  private startAutoFlush(): void {
    if (this.flushInterval) {
      this.intervalId = window.setInterval(() => {
        if (this.queue.length > 0) {
          this.flush();
        }
      }, this.flushInterval);
    }
  }

  /**
   * 立即上报队列中的所有数据
   */
  public async flush(): Promise<void> {
    if (this.sending || this.queue.length === 0) return;
    this.sending = true;

    const batch = this.shiftData();
    try {
      await this.sendWithRetry(batch);
    } catch (error) {
      // this.queue.unshift(batch);
      Original.consoleError('上报数据失败:', error);
    } finally {
      this.sending = false;
      if (this.queue.length > 0) {
        await this.flush();
      }
    }
  }

  /**
   * 检测上报频率是否异常
   * @returns 如果频率异常返回true，否则返回false
   */
  private checkReportFrequency(): boolean {
    const now = Date.now();

    // 移除超出时间窗口的记录
    this.reportTimes = this.reportTimes.filter(time => now - time <= this.timeWindow);

    // 添加新的上报时间
    this.reportTimes.push(now);

    // 检查在时间窗口内的上报次数是否超过阈值
    if (this.reportTimes.length > this.maxReportsPerSecond) {
      this.isAbnormal = true;
      Original.consoleWarn('检测到异常的上报频率，已暂停上报');
      this.destroy(); // 清理资源
      return true;
    }

    return false;
  }

  private async sendWithRetry(data: any, retries: number = 0): Promise<void> {
    if (this.isAbnormal) {
      Original.consoleWarn('当前处于异常状态，停止上报');
      return;
    }
    try {
      // Original.consoleLog('上报数据:', data);
      await this.transport.send(this.reportUrl, data);
    } catch (error) {
      if (retries < this.maxRetries) {
        const delay = Math.pow(2, retries) * 1000;
        new Promise(resolve => setTimeout(resolve, delay)).then(() => {
          Original.consoleWarn('重试上报数据:', data, '重试次数:', retries + 1);
          this.sendWithRetry(data, retries + 1);
        });
      }
      throw error;
    }
  }

  /**
   * 销毁上报器实例
   */
  public destroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}

/**
 * 基于Fetch API的数据传输实现
 */
class FetchTransport implements Transport {
  async send(url: string, data: any): Promise<void> {
    const response = await Original.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`HTTP错误! 状态码: ${response.status}, 消息: ${await response.text()}`);
    }
  }

  sendBeacon(url: string, data: any): boolean {
    try {
      return navigator.sendBeacon(url, JSON.stringify(data));
    } catch (e) {
      Original.consoleError('使用 sendBeacon 发送数据时出错: ', e);
      return false;
    }
  }
}
