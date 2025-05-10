/**
 * 高级数据采样策略
 * 实现智能采样、优先级划分和资源优化
 */

// 采样策略类型
export enum SamplingStrategyType {
  RANDOM = 'random', // 随机采样
  PRIORITY = 'priority', // 优先级采样
  ADAPTIVE = 'adaptive', // 自适应采样
  RATE_LIMITING = 'rateLimit', // 速率限制采样
  USER_SEGMENT = 'userSegment', // 用户分组采样
}

// 采样配置接口
export interface SamplingConfig {
  // 全局基础采样率 (0-1)
  baseRate: number;

  // 每种事件类型的优先级采样率
  priorityConfig: Record<string, number>;

  // 用户分组采样率
  userSegmentRates?: Record<string, number>;

  // 采样策略类型
  strategy: SamplingStrategyType;

  // 自适应采样配置
  adaptive?: {
    // 高负载时的最低采样率
    minRate: number;

    // 负载阈值, 高于此值开始降低采样率
    loadThreshold: number;

    // 每秒最大事件数
    maxEventsPerSecond: number;
  };

  // 错误优先级配置
  errorPriority?: {
    // 高优先级的错误模式 (正则表达式字符串)
    highPriorityPatterns: string[];

    // 低优先级的错误模式 (正则表达式字符串)
    lowPriorityPatterns: string[];
  };

  // 内存优化采样
  memoryOptimization?: boolean;
}

/**
 * 采样器基类
 */
abstract class BaseSampler<T> {
  protected config: SamplingConfig;

  constructor(config: Partial<SamplingConfig>) {
    // 默认配置
    this.config = {
      baseRate: 1.0,
      priorityConfig: {},
      strategy: SamplingStrategyType.RANDOM,
      ...config,
    };
  }

  /**
   * 采样决策方法
   * 决定是否采集某个事件
   */
  public abstract shouldSample(item: T, type: string): boolean;

  /**
   * 更新采样配置
   */
  public updateConfig(config: Partial<SamplingConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

/**
 * 随机采样器
 * 最简单的采样策略，按照固定概率随机采样
 */
export class RandomSampler<T> extends BaseSampler<T> {
  public shouldSample(_item: T, type: string): boolean {
    // 获取此类型的采样率，如果没有配置则使用基础采样率
    const rate = Number(this.config.priorityConfig[type] || this.config.baseRate);

    // 生成随机数并与采样率比较
    return Math.random() < rate;
  }
}

/**
 * 优先级采样器
 * 根据事件类型设置不同的采样优先级
 */
export class PrioritySampler<T extends { type: string }> extends BaseSampler<T> {
  public shouldSample(item: T, _type: string): boolean {
    // 使用项目自身的类型
    const type = item.type;

    // 获取此类型的采样率，如果没有配置则使用基础采样率
    const rate = Number(this.config.priorityConfig[type] || this.config.baseRate);

    return Math.random() < rate;
  }
}

/**
 * 自适应采样器
 * 根据系统负载动态调整采样率
 */
export class AdaptiveSampler<T> extends BaseSampler<T> {
  private eventCounts: Record<string, number> = {};
  private lastResetTime: number = Date.now();
  private resetInterval: number = 1000; // 1秒重置一次计数

  public shouldSample(_item: T, type: string): boolean {
    const now = Date.now();

    // 如果超过重置间隔，重置计数
    if (now - this.lastResetTime > this.resetInterval) {
      this.eventCounts = {};
      this.lastResetTime = now;
    }

    // 初始化或增加此类型的计数
    this.eventCounts[type] = (this.eventCounts[type] || 0) + 1;

    // 计算当前负载比例
    const totalEvents = Object.values(this.eventCounts).reduce((a, b) => a + b, 0);
    const maxEvents = this.config.adaptive?.maxEventsPerSecond || 100;
    const loadRatio = Math.min(totalEvents / maxEvents, 1);

    // 获取基础采样率
    let baseRate = this.config.priorityConfig[type] || this.config.baseRate;

    // 如果负载超过阈值，动态降低采样率
    if (loadRatio > (this.config.adaptive?.loadThreshold || 0.5)) {
      const minRate = this.config.adaptive?.minRate || 0.1;
      const loadThreshold = this.config.adaptive?.loadThreshold || 0.5;
      const adjustmentFactor = 1 - (loadRatio - loadThreshold) / (1 - loadThreshold);

      baseRate = Math.max(minRate, baseRate * adjustmentFactor);
    }

    return Math.random() < baseRate;
  }
}

/**
 * 用户分组采样器
 * 根据用户ID或用户分组应用不同的采样策略
 */
export class UserSegmentSampler<
  T extends { userId?: string; userType?: string },
> extends BaseSampler<T> {
  public shouldSample(item: T, type: string): boolean {
    // 获取用户分组
    const userType = item.userType || this.getUserSegment(item.userId);

    // 根据用户分组获取采样率，如果没有特定分组的配置，则使用默认采样率
    const userSegmentRate = userType && this.config.userSegmentRates?.[userType];

    // 如果有用户分组特定的采样率，使用它；否则使用事件类型采样率或基础采样率
    const rate =
      userSegmentRate !== undefined
        ? userSegmentRate
        : this.config.priorityConfig[type] || this.config.baseRate;

    return Math.random() < rate;
  }

  /**
   * 根据用户ID确定用户分组
   * 这可以根据实际业务逻辑进行定制
   */
  private getUserSegment(userId?: string): string | undefined {
    if (!userId) return undefined;

    // 示例：根据用户ID的哈希值分组
    const hash = this.simpleHash(userId);

    if (hash % 10 === 0) {
      return 'vip'; // 10%用户为VIP
    } else if (hash % 3 === 0) {
      return 'active'; // 30%用户为活跃用户
    } else {
      return 'regular'; // 60%用户为普通用户
    }
  }

  /**
   * 简单字符串哈希函数
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}

/**
 * 错误采样器
 * 专门针对错误信息的采样策略
 */
export class ErrorSampler<
  T extends { message: string; type: string; stack?: string },
> extends BaseSampler<T> {
  private highPriorityPatterns: RegExp[] = [];
  private lowPriorityPatterns: RegExp[] = [];

  constructor(config: Partial<SamplingConfig>) {
    super(config);

    // 编译正则表达式
    if (config.errorPriority?.highPriorityPatterns) {
      this.highPriorityPatterns = config.errorPriority.highPriorityPatterns.map(
        pattern => new RegExp(pattern, 'i')
      );
    }

    if (config.errorPriority?.lowPriorityPatterns) {
      this.lowPriorityPatterns = config.errorPriority.lowPriorityPatterns.map(
        pattern => new RegExp(pattern, 'i')
      );
    }
  }

  public shouldSample(item: T, _type: string): boolean {
    // 使用项目自身的类型
    const type = item.type;

    // 获取基础采样率
    let rate = this.config.priorityConfig[type] || this.config.baseRate;

    // 检查错误消息是否匹配高优先级模式
    for (const pattern of this.highPriorityPatterns) {
      if (pattern.test(item.message) || (item.stack && pattern.test(item.stack))) {
        // 高优先级错误总是采样 (或提高采样率)
        return true;
      }
    }

    // 检查错误消息是否匹配低优先级模式
    for (const pattern of this.lowPriorityPatterns) {
      if (pattern.test(item.message) || (item.stack && pattern.test(item.stack))) {
        // 低优先级错误降低采样率
        rate = rate * 0.1;
        break;
      }
    }

    return Math.random() < rate;
  }
}

/**
 * 工厂方法：创建采样器
 */
export function createSampler<T>(config: Partial<SamplingConfig>): BaseSampler<T> {
  const strategy = config.strategy || SamplingStrategyType.RANDOM;

  switch (strategy) {
    case SamplingStrategyType.PRIORITY:
      return new PrioritySampler<any>(config);

    case SamplingStrategyType.ADAPTIVE:
      return new AdaptiveSampler<T>(config);

    case SamplingStrategyType.USER_SEGMENT:
      return new UserSegmentSampler<any>(config);

    case SamplingStrategyType.RANDOM:
    default:
      return new RandomSampler<T>(config);
  }
}
