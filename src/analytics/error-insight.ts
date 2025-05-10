/**
 * 智能异常分析系统
 * 使用机器学习算法分析错误趋势、检测异常、识别根因
 */

import { ErrorInfo } from '../types';
import { Classifier } from './classifier';

/**
 * 错误分析结果接口
 */
interface ErrorAnalysisResult {
  rootCause: string;
  similarErrors: ErrorInfo[];
  priority: number; // 严重程度评分 1-10
  potentialSolutions: string[];
  userImpact: {
    percentage: number;
    demographicBreakdown?: Record<string, number>;
  };
}

export class ErrorInsightEngine {
  private classifier: Classifier;
  private errorDatabase: ErrorInfo[] = [];
  private patternDetector: RegExp[] = [];

  constructor() {
    this.classifier = new Classifier();
    // 预设常见错误模式
    this.initPatternDetector();
  }

  /**
   * 初始化错误模式检测器
   */
  private initPatternDetector(): void {
    // 内存泄漏相关
    this.patternDetector.push(/out of memory/i);
    // 未定义/空引用相关
    this.patternDetector.push(/cannot read property .* of (undefined|null)/i);
    // 网络相关
    this.patternDetector.push(/failed to fetch|networkerror/i);
    // 跨域相关
    this.patternDetector.push(/cross-origin|cors/i);
    // 超时相关
    this.patternDetector.push(/timeout|timed out/i);
  }

  /**
   * 分析错误，寻找根本原因和可能的解决方案
   */
  public analyzeError(error: ErrorInfo): ErrorAnalysisResult {
    // 记录错误到数据库
    this.errorDatabase.push(error);

    // 使用分类器对错误进行分类
    const classification = this.classifier.classify(error);

    // 查找相似错误
    const similarErrors = this.findSimilarErrors(error);

    // 分析用户影响
    const userImpact = this.calculateUserImpact(error, similarErrors);

    // 生成可能的解决方案建议
    const solutions = this.generateSolutions(error, classification);

    return {
      rootCause: classification.category,
      similarErrors: similarErrors.slice(0, 5), // 最相关的5个
      priority: this.calculatePriority(error, userImpact, similarErrors.length),
      potentialSolutions: solutions,
      userImpact,
    };
  }

  /**
   * 计算错误优先级
   */
  private calculatePriority(error: ErrorInfo, impact: any, frequency: number): number {
    let score = 5; // 默认中等优先级

    // 影响用户比例高，提高优先级
    if (impact.percentage > 10) score += 2;
    else if (impact.percentage > 5) score += 1;

    // 频繁出现的错误，提高优先级
    if (frequency > 100) score += 3;
    else if (frequency > 10) score += 1;

    // 关键路径错误，提高优先级 (例如支付、登录、核心功能)
    if (
      error.context?.includes('checkout') ||
      error.context?.includes('payment') ||
      error.context?.includes('login')
    ) {
      score += 2;
    }

    // 确保在1-10范围内
    return Math.min(Math.max(score, 1), 10);
  }

  /**
   * 查找相似错误
   */
  private findSimilarErrors(error: ErrorInfo): ErrorInfo[] {
    return this.errorDatabase.filter(
      e =>
        e.type === error.type &&
        (e.message === error.message || this.calculateSimilarity(e.message, error.message) > 0.7)
    );
  }

  /**
   * 计算两个错误消息的相似度 (简化版)
   */
  private calculateSimilarity(a: string, b: string): number {
    // 实际实现会使用更复杂的算法，如Levenshtein距离或余弦相似度
    // 这里简化处理
    const setA = new Set(a.toLowerCase().split(/\W+/));
    const setB = new Set(b.toLowerCase().split(/\W+/));

    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);

    return intersection.size / union.size;
  }

  /**
   * 计算错误影响的用户百分比
   */
  private calculateUserImpact(error: ErrorInfo, similarErrors: ErrorInfo[]): any {
    // 实际实现会根据用户会话数据计算受影响的用户比例
    const uniqueUserIds = new Set(
      [error, ...similarErrors].filter(e => e.userId).map(e => e.userId)
    );

    // 假设总用户数为10000 (实际应从配置或API获取)
    const totalUsers = 10000;

    return {
      percentage: (uniqueUserIds.size / totalUsers) * 100,
      // 可以添加更多细分维度，如浏览器类型、地域等
    };
  }

  /**
   * 生成可能的解决方案
   */
  private generateSolutions(_error: ErrorInfo, classification: any): string[] {
    const solutions: string[] = [];

    switch (classification.category) {
      case 'MEMORY_LEAK':
        solutions.push('检查大型对象的创建和销毁');
        solutions.push('检查事件监听器是否正确移除');
        break;
      case 'API_ERROR':
        solutions.push('验证API端点是否正确响应');
        solutions.push('检查网络连接和CORS配置');
        break;
      case 'NULL_REFERENCE':
        solutions.push('添加空值检查逻辑');
        solutions.push('使用可选链操作符 (?.)');
        break;
      case 'SYNTAX_ERROR':
        solutions.push('检查代码语法，可能存在拼写错误');
        break;
      default:
        solutions.push('进行更多错误日志分析以确定根本原因');
    }

    return solutions;
  }

  /**
   * 批量分析错误集合，寻找共同模式
   */
  public batchAnalyze(errors: ErrorInfo[]): Record<string, number> {
    const patterns: Record<string, number> = {};

    errors.forEach(error => {
      // 查找错误模式
      this.patternDetector.forEach((pattern, index) => {
        if (pattern.test(error.message)) {
          const patternName = `pattern_${index}`;
          patterns[patternName] = (patterns[patternName] || 0) + 1;
        }
      });
    });

    return patterns;
  }
}
