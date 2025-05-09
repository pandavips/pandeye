/**
 * 错误采样器
 * 用于控制错误收集的采样率，避免在高频错误场景下收集过多数据
 */

export interface SamplingConfig {
  /**
   * 基础采样率 (0-1)
   */
  baseSamplingRate: number;

  /**
   * 错误优先级配置
   * 高优先级错误可以提高采样率
   */
  priorityConfig: {
    [key: string]: number; // 错误类型对应的权重
  };

  /**
   * 时间窗口大小(ms)
   * 用于计算错误频率
   */
  timeWindow: number;

  /**
   * 自适应采样的阈值
   * 当错误频率超过此阈值时，开始降低采样率
   */
  adaptiveThreshold: number;
}

interface ErrorFrequency {
  count: number;
  timestamp: number;
}

export class ErrorSampler {
  private config: SamplingConfig;
  private errorFrequencies: Map<string, ErrorFrequency> = new Map();
  private readonly defaultConfig: SamplingConfig = {
    baseSamplingRate: 1.0,
    priorityConfig: {},
    timeWindow: 60000, // 1分钟
    adaptiveThreshold: 100, // 每分钟100个错误
  };

  constructor(config: Partial<SamplingConfig> = {}) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * 判断是否应该采样特定错误
   * @param errorType - 错误类型
   * @param errorId - 错误ID
   * @returns 是否应该采样此错误
   */
  public shouldSample(errorType: string, errorId: string): boolean {
    // 清理过期的频率数据
    this.cleanStaleData();

    // 获取当前错误类型的频率
    const frequency = this.getErrorFrequency(errorType);

    // 计算当前错误的采样率
    const samplingRate = this.calculateSamplingRate(errorType, frequency);

    // 使用错误ID作为随机性的来源
    const randomValue = this.hashToFloat(errorId);

    // 判断是否采样
    return randomValue <= samplingRate;
  }

  /**
   * 记录错误发生
   * @param errorType - 错误类型
   */
  public recordError(errorType: string): void {
    const now = Date.now();
    const current = this.errorFrequencies.get(errorType) || { count: 0, timestamp: now };

    // 如果是新的时间窗口，重置计数
    if (now - current.timestamp > this.config.timeWindow) {
      current.count = 1;
      current.timestamp = now;
    } else {
      current.count++;
    }

    this.errorFrequencies.set(errorType, current);
  }

  /**
   * 计算实际采样率
   * @param errorType - 错误类型
   * @param frequency - 错误频率信息
   * @returns 计算后的采样率
   * @private
   */
  private calculateSamplingRate(errorType: string, frequency: ErrorFrequency): number {
    // 基础采样率
    let rate = this.config.baseSamplingRate;

    // 应用优先级权重
    const priority = this.config.priorityConfig[errorType] || 1;
    rate *= priority;

    // 计算每分钟的错误数
    const errorsPerMinute = (frequency.count / this.config.timeWindow) * 60000;

    // 如果错误频率超过阈值，使用自适应采样
    if (errorsPerMinute > this.config.adaptiveThreshold) {
      // 使用对数函数降低采样率，但保持最小采样率
      const reduction = Math.log10(errorsPerMinute / this.config.adaptiveThreshold);
      rate = Math.max(0.01, rate / (1 + reduction));
    }

    return Math.min(1, rate);
  }

  /**
   * 清理过期的频率数据
   * @private
   */
  private cleanStaleData(): void {
    const now = Date.now();
    for (const [type, data] of this.errorFrequencies) {
      if (now - data.timestamp > this.config.timeWindow) {
        this.errorFrequencies.delete(type);
      }
    }
  }

  /**
   * 获取错误频率信息
   * @param errorType - 错误类型
   * @returns 错误频率信息
   * @private
   */
  private getErrorFrequency(errorType: string): ErrorFrequency {
    const frequency = this.errorFrequencies.get(errorType);
    return frequency || { count: 0, timestamp: Date.now() };
  }

  /**
   * 将字符串哈希转换为0-1之间的浮点数
   * @param str - 输入字符串
   * @returns 0-1之间的浮点数
   * @private
   */
  private hashToFloat(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash = hash & hash;
    }
    // 使用无符号右移确保得到正数，然后进行归一化
    // 使用 >>> 0 将有符号整数转换为无符号整数
    return (hash >>> 0) / 0xffffffff;
  }

  /**
   * 更新采样配置
   * @param config - 新的采样配置
   */
  public updateConfig(config: Partial<SamplingConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * 重置采样器状态
   */
  public reset(): void {
    this.errorFrequencies.clear();
  }

  /**
   * 获取当前错误频率统计
   * @returns 错误频率统计信息
   */
  public getErrorStats(): { [key: string]: { frequency: number; samplingRate: number } } {
    const stats: { [key: string]: { frequency: number; samplingRate: number } } = {};
    const now = Date.now();

    for (const [type, data] of this.errorFrequencies) {
      if (now - data.timestamp <= this.config.timeWindow) {
        const frequency = (data.count / this.config.timeWindow) * 60000; // 每分钟错误数
        const samplingRate = this.calculateSamplingRate(type, data);
        stats[type] = { frequency, samplingRate };
      }
    }

    return stats;
  }
}
