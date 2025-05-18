// 控制台日志信息接口
export interface ConsoleInfo {
  type: string;
  data: {
    args: string;
    result?: any;
  };
  timestamp: number;
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

export interface ReportData {
  appId: string;
  type: string;
  data: any;
}

// 通用事件接口
export interface Event {
  type: string;
  payload: any;
  timestamp: number;
}

// 错误信息接口
export interface ErrorInfo {
  type: 'js' | 'promise' | 'resource' | 'api';
  message: string;
  stack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  timestamp: number;
}

// 性能指标接口
export interface PerformanceMetrics {
  // 页面加载时间
  loadTime: number;
  // DOM解析时间
  domReadyTime: number;
  // 首次内容绘制时间
  firstPaintTime: number;
  // 首次有意义绘制时间
  firstMeaningfulPaintTime: number;
  // 页面资源加载情况
  resources: ResourceMetric[];
}

// 资源加载信息接口
export interface ResourceMetric {
  name: string;
  initiatorType: string;
  duration: number;
  transferSize: number;
  startTime: number;
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

// 传输器实现
export interface Transport {
  send(url: string, data: any): Promise<void>;
  sendBeacon(url: string, data: any): boolean;
}

// 上报基础数据
export interface ReporterBaseData {
  /** 上报类型 */
  type: string;
  /** 上报数据 */
  payload: any;
  /** 动作时间戳 */
  timestamp?: number;
}

// 上报加密数据
export interface ReporterEncryptedData extends ReporterBaseData {
  /** 分片组ID */
  groupId: string;
  /** 分片索引 */
  index: number;
  /** 总分片数 */
  total: number;
}

// 最终上报数据
export interface ReporterData {
  /** appid */
  appId: string;
  /** 上报类型(大类) */
  type: string;
  payload: ReporterEncryptedData;
  /** 上报时间戳 */
  timestamp: number;
  /** 上报ID */
  reportId: string;
  /** 环境标识 */
  environment: string;
}
