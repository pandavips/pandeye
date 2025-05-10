/**
 * 错误分类器
 * 用于对错误信息进行智能分类
 */

import { ErrorInfo } from '../types';

/**
 * 错误分类结果
 */
export interface ClassificationResult {
  // 错误分类
  category: string;

  // 分类置信度
  confidence: number;

  // 错误严重程度
  severity: 'low' | 'medium' | 'high' | 'critical';

  // 其他分类相关信息
  metadata?: Record<string, any>;
}

/**
 * 错误分类器
 * 根据错误内容和模式对错误进行智能分类
 */
export class Classifier {
  // 预定义的错误类别
  private categories: Record<string, RegExp[]> = {
    network: [
      /network error/i,
      /failed to fetch/i,
      /timeout/i,
      /abort/i,
      /offline/i,
      /cors/i,
      /cross-origin/i,
    ],
    authentication: [
      /unauthorized/i,
      /forbidden/i,
      /permission denied/i,
      /not allowed/i,
      /token expired/i,
      /invalid token/i,
      /auth/i,
    ],
    database: [
      /database/i,
      /sql/i,
      /query/i,
      /record not found/i,
      /constraint/i,
      /duplicate entry/i,
    ],
    memory: [/memory/i, /allocation failed/i, /out of memory/i, /heap/i, /stack overflow/i],
    syntax: [
      /syntax error/i,
      /unexpected token/i,
      /parsing/i,
      /cannot read property/i,
      /is not a function/i,
      /undefined is not an object/i,
      /not defined/i,
    ],
    api: [/api/i, /endpoint/i, /status code/i, /400/, /500/, /response/i],
    resource: [/loading/i, /resource/i, /not found/i, /404/, /failed to load/i],
    compatibility: [/browser/i, /unsupported/i, /compatibility/i, /not supported/i, /version/i],
  };

  /**
   * 对错误进行分类
   */
  public classify(error: ErrorInfo): ClassificationResult {
    const message = error.message || '';
    const stack = error.stack || '';
    const content = `${message} ${stack}`.toLowerCase();

    // 匹配最佳类别
    let bestMatch = 'unknown';
    let maxMatches = 0;
    const matchDetails: Record<string, number> = {};

    for (const [category, patterns] of Object.entries(this.categories)) {
      let matches = 0;

      for (const pattern of patterns) {
        if (pattern.test(content)) {
          matches++;
        }
      }

      matchDetails[category] = matches;

      if (matches > maxMatches) {
        maxMatches = matches;
        bestMatch = category;
      }
    }

    // 确定严重程度
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';

    if (bestMatch === 'memory' || bestMatch === 'database') {
      severity = 'high';
    } else if (bestMatch === 'network' || bestMatch === 'api') {
      // 区分暂时性和严重性网络问题
      if (/timeout|503|unavailable/i.test(content)) {
        severity = 'medium';
      } else if (/5[0-9]{2}|internal server error/i.test(content)) {
        severity = 'high';
      } else if (/offline|disconnected/i.test(content)) {
        severity = 'low';
      }
    } else if (bestMatch === 'syntax') {
      severity = 'high';
    } else if (bestMatch === 'authentication') {
      if (/expired|invalid/i.test(content)) {
        severity = 'low';
      } else {
        severity = 'medium';
      }
    }

    // 计算置信度
    const confidence =
      maxMatches > 0
        ? Math.min(maxMatches / 3, 1) // 3次以上匹配视为满置信度
        : 0.3; // 未知错误默认低置信度

    return {
      category: bestMatch,
      confidence,
      severity,
      metadata: {
        matchDetails,
      },
    };
  }
}
