/**
 * 机器学习分析模块
 * 提供异常检测、趋势预测和模式识别的核心功能
 */

interface DataPoint {
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface AnomalyResult {
  isAnomaly: boolean;
  score: number; // 异常程度分数
  threshold: number; // 判定阈值
  confidence: number; // 置信度
}

interface TrendResult {
  direction: 'up' | 'down' | 'stable';
  magnitude: number; // 变化幅度
  forecast: number[]; // 预测值
  confidence: number; // 预测置信度
}

interface PatternResult {
  patternType: string;
  frequency?: number; // 频率(如果是周期性模式)
  strength: number; // 模式强度
  matches: number[]; // 模式匹配点
}

/**
 * 移动平均异常检测
 * 适用于实时检测数据中的异常值
 */
export class MovingAverageAnomalyDetector {
  private windowSize: number;
  private zScoreThreshold: number;
  private history: DataPoint[] = [];

  constructor(windowSize: number = 20, zScoreThreshold: number = 3.0) {
    this.windowSize = windowSize;
    this.zScoreThreshold = zScoreThreshold;
  }

  /**
   * 添加数据点到历史记录
   */
  public addDataPoint(point: DataPoint): void {
    this.history.push(point);

    // 保持历史记录在窗口大小内
    if (this.history.length > this.windowSize * 3) {
      this.history = this.history.slice(-this.windowSize * 2);
    }
  }

  /**
   * 检测数据点是否为异常
   */
  public detect(point: DataPoint): AnomalyResult {
    // 如果历史记录不足，先添加数据点并认为正常
    if (this.history.length < this.windowSize) {
      this.addDataPoint(point);
      return {
        isAnomaly: false,
        score: 0,
        threshold: this.zScoreThreshold,
        confidence: 0,
      };
    }

    // 计算移动窗口的均值和标准差
    const window = this.history.slice(-this.windowSize);
    const values = window.map(p => p.value);

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;

    const variance =
      values.reduce((sum, value) => {
        const diff = value - mean;
        return sum + diff * diff;
      }, 0) / values.length;

    const stdDev = Math.sqrt(variance) || 0.0001; // 避免除零错误

    // 计算Z分数
    const zScore = Math.abs((point.value - mean) / stdDev);

    // 判断是否为异常
    const isAnomaly = zScore > this.zScoreThreshold;

    // 计算置信度 (基于历史数据量和Z分数)
    const dataSizeConfidence = Math.min(this.history.length / (this.windowSize * 2), 1);
    const zScoreConfidence = Math.min(zScore / (this.zScoreThreshold * 2), 1);
    const confidence = isAnomaly
      ? 0.5 * dataSizeConfidence + 0.5 * zScoreConfidence
      : dataSizeConfidence;

    // 添加数据点到历史记录
    this.addDataPoint(point);

    return {
      isAnomaly,
      score: zScore,
      threshold: this.zScoreThreshold,
      confidence,
    };
  }

  /**
   * 批量检测多个数据点
   */
  public batchDetect(points: DataPoint[]): AnomalyResult[] {
    return points.map(point => this.detect(point));
  }
}

/**
 * 趋势分析器
 * 分析数据的趋势方向和预测未来走势
 */
export class TrendAnalyzer {
  private historyLength: number;
  private forecastSteps: number;
  private history: DataPoint[] = [];

  constructor(historyLength: number = 30, forecastSteps: number = 5) {
    this.historyLength = historyLength;
    this.forecastSteps = forecastSteps;
  }

  /**
   * 添加数据点
   */
  public addDataPoint(point: DataPoint): void {
    this.history.push(point);

    // 保持历史记录在指定长度内
    if (this.history.length > this.historyLength * 2) {
      this.history = this.history.slice(-this.historyLength);
    }
  }

  /**
   * 分析趋势
   */
  public analyze(): TrendResult {
    if (this.history.length < Math.max(3, this.historyLength / 2)) {
      return {
        direction: 'stable',
        magnitude: 0,
        forecast: [],
        confidence: 0,
      };
    }

    // 使用线性回归进行趋势分析
    const points = this.history.slice(-this.historyLength);
    const values = points.map(p => p.value);
    const timestamps = points.map((_p, i) => i); // 使用索引作为时间序列

    // 计算线性回归
    const { slope, intercept } = this.linearRegression(timestamps, values);

    // 确定趋势方向
    let direction: 'up' | 'down' | 'stable';
    if (slope > 0.01) {
      direction = 'up';
    } else if (slope < -0.01) {
      direction = 'down';
    } else {
      direction = 'stable';
    }

    // 计算趋势幅度 (斜率的绝对值占平均值的百分比)
    const avgValue = values.reduce((a, b) => a + b, 0) / values.length;
    const magnitude = (Math.abs(slope) / (avgValue || 1)) * 100;

    // 预测未来值
    const forecast = [];
    const lastIndex = timestamps[timestamps.length - 1];

    for (let i = 1; i <= this.forecastSteps; i++) {
      forecast.push(intercept + slope * (lastIndex + i));
    }

    // 计算置信度
    const confidence =
      Math.min(this.history.length / this.historyLength, 1) *
      (1 - this.calculateRegressionError(timestamps, values, slope, intercept));

    return {
      direction,
      magnitude,
      forecast,
      confidence,
    };
  }

  /**
   * 线性回归计算
   */
  private linearRegression(x: number[], y: number[]): { slope: number; intercept: number } {
    const n = x.length;

    // 计算平均值
    const avgX = x.reduce((a, b) => a + b, 0) / n;
    const avgY = y.reduce((a, b) => a + b, 0) / n;

    // 计算斜率 (covariance / variance)
    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (x[i] - avgX) * (y[i] - avgY);
      denominator += Math.pow(x[i] - avgX, 2);
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = avgY - slope * avgX;

    return { slope, intercept };
  }

  /**
   * 计算回归误差
   */
  private calculateRegressionError(
    x: number[],
    y: number[],
    slope: number,
    intercept: number
  ): number {
    let totalError = 0;
    const n = x.length;

    // 计算平均绝对误差百分比
    for (let i = 0; i < n; i++) {
      const predicted = intercept + slope * x[i];
      const actual = y[i];

      if (actual !== 0) {
        totalError += Math.abs(predicted - actual) / Math.abs(actual);
      }
    }

    return totalError / n;
  }
}

/**
 * 模式识别器
 * 检测数据中的重复模式和周期性
 */
export class PatternRecognizer {
  private minPatternLength: number;
  private maxPatternLength: number;
  private history: DataPoint[] = [];

  constructor(minPatternLength: number = 3, maxPatternLength: number = 20) {
    this.minPatternLength = minPatternLength;
    this.maxPatternLength = maxPatternLength;
  }

  /**
   * 添加数据点
   */
  public addDataPoint(point: DataPoint): void {
    this.history.push(point);
  }

  /**
   * 检测模式
   */
  public detectPatterns(): PatternResult[] {
    if (this.history.length < this.minPatternLength * 3) {
      return [];
    }

    const values = this.history.map(p => p.value);
    const patterns: PatternResult[] = [];

    // 检测周期性模式
    const periodicPattern = this.detectPeriodicPattern(values);
    if (periodicPattern) {
      patterns.push(periodicPattern);
    }

    // 检测重复序列
    const repeatPattern = this.detectRepeatedSequence(values);
    if (repeatPattern) {
      patterns.push(repeatPattern);
    }

    return patterns;
  }

  /**
   * 检测周期性模式
   */
  private detectPeriodicPattern(values: number[]): PatternResult | null {
    // 使用自相关分析检测周期
    const correlations: number[] = [];

    // 计算不同滞后期的自相关系数
    for (
      let lag = 1;
      lag <= Math.min(this.maxPatternLength, Math.floor(values.length / 3));
      lag++
    ) {
      let correlation = 0;
      let validPairs = 0;

      for (let i = 0; i < values.length - lag; i++) {
        correlation += values[i] * values[i + lag];
        validPairs++;
      }

      if (validPairs > 0) {
        correlations.push(correlation / validPairs);
      } else {
        correlations.push(0);
      }
    }

    // 找到自相关峰值
    let maxCorrelation = -Infinity;
    let period = 0;

    for (let i = this.minPatternLength; i < correlations.length; i++) {
      if (
        correlations[i] > maxCorrelation &&
        correlations[i] > correlations[i - 1] &&
        correlations[i] > correlations[i + 1]
      ) {
        maxCorrelation = correlations[i];
        period = i + 1;
      }
    }

    // 检查是否找到有效的周期
    if (period >= this.minPatternLength && maxCorrelation > 0.5) {
      // 找出符合这个周期的匹配点
      const matches = [];
      for (let i = 0; i < values.length - period; i++) {
        if (Math.abs(values[i] - values[i + period]) < 0.1 * Math.abs(values[i])) {
          matches.push(i);
        }
      }

      return {
        patternType: 'periodic',
        frequency: period,
        strength: maxCorrelation,
        matches,
      };
    }

    return null;
  }

  /**
   * 检测重复序列
   */
  private detectRepeatedSequence(values: number[]): PatternResult | null {
    for (let length = this.minPatternLength; length <= this.maxPatternLength; length++) {
      // 检查末尾的序列是否在之前出现过
      const pattern = values.slice(-length);
      let found = false;
      let foundAt = -1;

      // 在历史数据中寻找相同序列
      for (let i = 0; i <= values.length - length * 2; i++) {
        const segment = values.slice(i, i + length);
        let matches = true;

        for (let j = 0; j < length; j++) {
          // 序列比较允许一定的误差
          if (Math.abs(pattern[j] - segment[j]) > 0.1 * Math.abs(segment[j])) {
            matches = false;
            break;
          }
        }

        if (matches) {
          found = true;
          foundAt = i;
          break;
        }
      }

      if (found) {
        return {
          patternType: 'repeated_sequence',
          strength: 0.8, // 重复序列的置信度
          matches: [foundAt, values.length - length],
        };
      }
    }

    return null;
  }
}

/**
 * 机器学习分析引擎
 * 整合多种分析算法，提供综合性分析结果
 */
export class MLAnalyticsEngine {
  private anomalyDetector: MovingAverageAnomalyDetector;
  private trendAnalyzer: TrendAnalyzer;
  private patternRecognizer: PatternRecognizer;

  constructor() {
    this.anomalyDetector = new MovingAverageAnomalyDetector();
    this.trendAnalyzer = new TrendAnalyzer();
    this.patternRecognizer = new PatternRecognizer();
  }

  /**
   * 处理新的数据点
   */
  public processDataPoint(point: DataPoint): {
    anomaly: AnomalyResult;
    trend?: TrendResult;
  } {
    // 异常检测
    const anomaly = this.anomalyDetector.detect(point);

    // 更新趋势分析器
    this.trendAnalyzer.addDataPoint(point);

    // 更新模式识别器
    this.patternRecognizer.addDataPoint(point);

    // 只有在积累了足够的数据点后才返回趋势分析
    let trend;
    if (anomaly.isAnomaly) {
      // 如果检测到异常，执行趋势分析以了解是否是趋势变化引起的
      trend = this.trendAnalyzer.analyze();
    }

    return { anomaly, trend };
  }

  /**
   * 执行完整分析
   * 适用于定期全面分析
   */
  public fullAnalysis(): {
    trend: TrendResult;
    patterns: PatternResult[];
  } {
    const trend = this.trendAnalyzer.analyze();
    const patterns = this.patternRecognizer.detectPatterns();

    return { trend, patterns };
  }
}
