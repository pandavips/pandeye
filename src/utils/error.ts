/**
 * 错误处理工具函数
 * 提供错误标准化和错误去重功能
 */

import { ErrorInfo, ErrorType } from '../types';
import { formatError } from './common';

/**
 * 创建标准化的错误信息对象
 * @param type - 错误类型
 * @param error - 原始错误对象
 * @param extraInfo - 附加信息
 * @returns 标准化的错误信息对象
 */
export function createErrorInfo(
  type: ErrorType,
  error: unknown,
  extraInfo?: Partial<Omit<ErrorInfo, 'type' | 'message' | 'stack' | 'timestamp'>>
): ErrorInfo {
  const formattedError = formatError(error);

  // 生成错误唯一ID用于去重
  const errorId = generateErrorId(type, formattedError.message, extraInfo?.filename);

  return {
    type,
    message: formattedError.message,
    stack: formattedError.stack,
    timestamp: Date.now(),
    errorId,
    ...extraInfo,
  };
}

/**
 * 生成错误唯一ID，用于去重
 * 将错误类型、错误消息和文件名组合生成一个唯一标识
 * @param type - 错误类型
 * @param message - 错误消息
 * @param filename - 错误文件名
 * @returns 错误唯一ID
 */
function generateErrorId(type: ErrorType, message: string, filename?: string): string {
  // 提取消息的关键部分，避免时间戳等动态内容影响唯一性
  const normalizedMessage = normalizeErrorMessage(message);

  // 组合关键信息
  const idSource = `${type}:${normalizedMessage}${filename ? `:${filename}` : ''}`;

  // 使用简单哈希函数创建ID
  return simpleHash(idSource);
}

/**
 * 规范化错误消息，移除动态部分
 * @param message - 原始错误消息
 * @returns 规范化后的错误消息
 */
function normalizeErrorMessage(message: string): string {
  // 移除可能包含的时间戳和随机ID等
  return (
    message
      .replace(/\d{13,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '*')
      // 保留消息的前100个字符，足够进行错误区分
      .substring(0, 100)
  );
}

/**
 * 简单的字符串哈希函数
 * 实现简单的哈希算法，将字符串转换为固定长度的标识符
 * @param str - 输入字符串
 * @returns 哈希字符串
 */
function simpleHash(str: string): string {
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // 转换为32位整数
  }

  // 转换为16进制字符串并确保始终为8位
  const hashHex = (hash >>> 0).toString(16);
  return hashHex.padStart(8, '0');
}

/**
 * 分析错误堆栈，提取关键信息
 * @param stack - 错误堆栈字符串
 * @returns 解析后的堆栈信息
 */
export function parseErrorStack(stack?: string): {
  filename?: string;
  lineno?: number;
  colno?: number;
} {
  if (!stack) return {};

  // 匹配类似 "at http://example.com/file.js:10:15" 的堆栈信息
  const stackLineRegex = /at\s+(?:.*?\s+\()?(?:(.+)):(\d+):(\d+)/i;
  const match = stackLineRegex.exec(stack);

  if (!match) return {};

  return {
    filename: match[1],
    lineno: parseInt(match[2], 10),
    colno: parseInt(match[3], 10),
  };
}

/**
 * 检查错误是否已存在于错误列表中
 * 通过比较错误ID判断
 * @param error - 待检查的错误
 * @param existingErrors - 现有的错误列表
 * @returns 是否已存在
 */
export function isErrorDuplicate(error: ErrorInfo, existingErrors: ErrorInfo[]): boolean {
  return existingErrors.some(existing => existing.errorId === error.errorId);
}
