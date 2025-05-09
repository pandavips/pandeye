/**
 * 通用工具函数
 * 提供全局通用的辅助方法
 */

/**
 * 安全地将对象转换为JSON字符串
 * 当转换失败时返回字符串表示
 * @param obj - 需要转换的对象
 * @returns 转换后的JSON字符串或对象的字符串表示
 */
export function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj);
  } catch (err) {
    return String(obj);
  }
}

/**
 * 节流函数
 * 确保函数在指定时间内只执行一次
 * @param fn - 需要节流的函数
 * @param delay - 延迟时间，单位毫秒
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return function (this: any, ...args: Parameters<T>) {
    const now = Date.now();
    if (now - lastCall < delay) return;
    lastCall = now;
    fn.apply(this, args);
  };
}

/**
 * 获取当前时间戳
 * @returns 当前的时间戳（毫秒）
 */
export function now(): number {
  return Date.now();
}

/**
 * 检查浏览器是否支持特定API
 * 用于在使用前检查功能可用性
 * @param apiName - API名称
 * @returns 是否支持该API
 */
export function isSupported(apiName: string): boolean {
  try {
    // 支持点操作符的深层检查
    return (
      apiName
        .split('.')
        .reduce((obj, path) => obj && (obj as Record<string, any>)[path], window as any) !==
      undefined
    );
  } catch (err) {
    return false;
  }
}

/**
 * 生成唯一ID
 * 用于标识单个监控事件或会话
 * @returns 唯一标识符
 */
export function generateUniqueId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 深度合并两个对象
 * 用于合并默认配置与用户配置
 * @param target - 目标对象
 * @param source - 源对象
 * @returns 合并后的对象
 */
export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result: Record<string, any> = { ...target };

  Object.keys(source).forEach(key => {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      targetValue !== null &&
      typeof targetValue === 'object' &&
      !Array.isArray(sourceValue)
    ) {
      result[key] = deepMerge(targetValue, sourceValue);
    } else {
      result[key] = sourceValue !== undefined ? sourceValue : targetValue;
    }
  });

  return result as T;
}

/**
 * 格式化异常对象，确保返回一致的错误信息结构
 * @param error - 错误对象或错误信息
 * @returns 标准化的错误对象
 */
export function formatError(error: unknown): { message: string; stack?: string } {
  if (typeof error === 'string') {
    return { message: error };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
    };
  }

  try {
    return {
      message: JSON.stringify(error),
    };
  } catch {
    return {
      message: String(error),
    };
  }
}
