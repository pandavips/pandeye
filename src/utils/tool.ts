// 获取一个错误对象的堆栈信息
export function getCurrentStackTrace(err: Error): string {
  if (err) {
    // 移除自身函数调用的第一行
    const stack = (err.stack || '').split('\n').slice(1).join('\n');
    return stack;
  } else {
    return '';
  }
}
