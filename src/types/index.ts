// 传输器实现
export interface Transport {
  send(url: string, data: ReporterData): Promise<void>;
  sendBeacon(url: string, data: ReporterData): boolean;
}
// Reporter相关接口
export interface ReporterOptions {
  reportUrl: string;
  maxRetries?: number;
  appId: string;
  batchSize?: number;
  autoFlushInterval?: number;
  flushBeforeUnload?: boolean;
  transport?: Transport;
  environment?: string;
  publicKey: string; // RSA公钥（Base64格式的SPKI格式公钥）
}

// 核心配置接口
export interface PandeyeOptions {
  // 是否自动开始监控,默认true
  autoStart?: boolean;
  // 是否启用性能监控
  enablePerformance?: boolean;
  // 是否启用错误监控
  enableError?: boolean;
  // 是否启用用户行为监控
  enableBehavior?: boolean;
  // 是否启用控制台日志监控
  enableConsole?: boolean;
  // 是否启用网络请求监控
  enableNetwork?: boolean;
  // 是否启用录制
  enableRecord?: boolean;
  // 上报器配置
  reportConfig: ReporterOptions;
}

// 上报基础数据
export interface ReporterBaseData {
  /** 上报类型 */
  type: string;
  /** 上报数据 */
  payload: object | string;
  /** 动作时间戳 */
  timestamp?: number;
}

// 最终传输到服务端数据
export interface ReporterData {
  /** appid */
  appId: string;
  /** 上报类型(大类) */
  type: string;
  payload: string;
  /** 上报时间戳 */
  timestamp: number;
  /** 上报ID */
  reportId: string;
  /** 环境标识 */
  environment: string;
}
