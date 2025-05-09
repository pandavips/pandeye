// 配置相关类型
/**
 * 上报时机类型
 * - immediately: 立即上报
 * - beforeunload: 页面关闭前上报
 * - number: 定时上报，指定毫秒数
 */
export type ReportTimeType = 'immediately' | 'beforeunload' | number;

/**
 * 环境类型
 */
export type EnvType = 'dev' | 'test' | 'pre' | 'prod' | string;

/**
 * Pandeye 监控配置选项
 * @interface PandeyeOptions
 */
export interface PandeyeOptions {
  /** 应用ID，必填，标识唯一应用 */
  appId: string;

  /** 运行环境，如：dev, test, pre, prod */
  env: EnvType;

  /** 上报接口地址，数据上报的服务端地址 */
  reportUrl?: string;

  /**
   * 上报时机
   * - immediately: 立即上报
   * - beforeunload: 页面关闭前上报
   * - number: 定时上报，指定毫秒数
   */
  reportTime?: ReportTimeType;

  /** 是否自动开始监控，默认为 true */
  autoStart?: boolean;

  /** 是否启用性能监控，默认为 true */
  enablePerformance?: boolean;

  /** 是否启用错误监控，默认为 true */
  enableError?: boolean;

  /** 是否启用用户行为监控，默认为 true */
  enableBehavior?: boolean;

  /** 是否启用控制台日志监控，默认为 false */
  enableConsole?: boolean;

  /** 自定义上报数据，会附加到每次上报的数据中 */
  customReport?: Record<string, unknown>;
}

// 性能监控相关类型
/**
 * 资源类型定义
 */
export type ResourceType =
  | 'script'
  | 'link'
  | 'img'
  | 'css'
  | 'fetch'
  | 'xmlhttprequest'
  | 'iframe'
  | string;

/**
 * 性能监控指标数据结构
 * 包含页面加载、绘制时间和资源加载情况等性能指标
 * @interface PerformanceMetrics
 */
export interface PerformanceMetrics {
  /** 页面加载时间 (ms) */
  loadTime: number;

  /** DOM解析时间 (ms) */
  domReadyTime: number;

  /** 首次内容绘制时间 (ms) */
  firstPaintTime: number;

  /** 首次有意义绘制时间 (ms) */
  firstMeaningfulPaintTime: number;

  /** 最大内容绘制时间 (ms) */
  largestContentfulPaint?: number;

  /** 首次输入延迟 (ms) */
  firstInputDelay?: number;

  /** 累计布局偏移 */
  cumulativeLayoutShift?: number;

  /** 页面资源加载情况 */
  resources: ResourceMetric[];
}

/**
 * 资源加载性能指标
 * 记录单个资源的加载性能数据
 * @interface ResourceMetric
 */
export interface ResourceMetric {
  /** 资源名称 - 通常是URL */
  name: string;

  /** 资源类型 - 如 script, img, css 等 */
  initiatorType: ResourceType;

  /** 加载时长 (ms) */
  duration: number;

  /** 传输大小 (bytes) */
  transferSize: number;

  /** 开始时间 (ms) - 相对于导航开始的时间 */
  startTime: number;

  /** 是否缓存命中 */
  cacheHit?: boolean;

  /** 资源大小 (bytes) */
  decodedBodySize?: number;
}

// 错误监控相关类型
/**
 * 错误类型定义
 * - js: JavaScript 运行时错误
 * - promise: Promise 未捕获异常
 * - resource: 资源加载错误
 * - api: 接口请求错误
 */
export type ErrorType = 'js' | 'promise' | 'resource' | 'api';

/**
 * 错误信息数据结构
 * 记录各类错误的详细信息
 * @interface ErrorInfo
 */
export interface ErrorInfo {
  /** 错误类型 */
  type: ErrorType;

  /** 错误信息 */
  message: string;

  /** 错误堆栈 */
  stack?: string;

  /** 错误文件 */
  filename?: string;

  /** 错误行号 */
  lineno?: number;

  /** 错误列号 */
  colno?: number;

  /** 错误时间戳 */
  timestamp: number;

  /** 错误唯一标识（用于去重） */
  errorId?: string;

  /** 额外的错误信息 */
  extra?: Record<string, unknown>;
}

// 行为监控相关类型
/**
 * 行为类型定义
 * - pv: 页面访问
 * - click: 点击行为
 * - route: 路由变化
 * - custom: 自定义事件
 */
export type BehaviorType = 'pv' | 'click' | 'route' | 'custom';

/**
 * 页面访问数据结构
 * @interface PageViewData
 */
export interface PageViewData {
  /** 页面URL */
  url: string;

  /** 页面标题 */
  title: string;

  /** 来源页面 */
  referrer: string;

  /** 停留时间(ms) */
  stayTime?: number;
}

/**
 * 点击行为数据结构
 * @interface ClickData
 */
export interface ClickData {
  /** 标签名 */
  tagName: string;

  /** 类名 */
  className?: string;

  /** 元素ID */
  id?: string;

  /** 元素文本 */
  text?: string;

  /** 元素路径 */
  path: string;

  /** 点击位置 X 坐标 */
  x?: number;

  /** 点击位置 Y 坐标 */
  y?: number;
}

/**
 * 路由变化数据结构
 * @interface RouteChangeData
 */
export interface RouteChangeData {
  /** 来源路径 */
  from: string;

  /** 目标路径 */
  to: string;

  /** 路由参数 */
  params?: Record<string, unknown>;
}

/**
 * 自定义事件数据结构
 * @interface CustomEventData
 */
export interface CustomEventData {
  /** 事件名称 */
  eventName: string;

  /** 其他自定义属性 */
  [key: string]: unknown;
}

/**
 * 用户行为信息数据结构
 * 记录用户交互行为的详细信息
 * @interface BehaviorInfo
 */
export interface BehaviorInfo {
  /** 行为类型 */
  type: BehaviorType;

  /**
   * 行为数据
   * 根据不同的行为类型，data 的结构会有所不同
   */
  data: PageViewData | ClickData | RouteChangeData | CustomEventData;

  /** 行为时间戳 */
  timestamp: number;

  /** 行为ID，用于唯一标识 */
  id?: string;
}

// 数据上报相关类型
/**
 * 上报数据类型定义
 */
export type ReportDataType = 'batch' | 'manual' | 'console' | string;

/**
 * 上报基础数据结构
 * @interface BaseReportData
 */
export interface BaseReportData {
  /**
   * 数据类型
   * - batch: 批量数据
   * - manual: 手动上报
   * - console: 控制台日志
   */
  type: ReportDataType;

  /** 数据内容 */
  data: unknown;

  /** 时间戳 */
  timestamp: number;

  /** 会话ID - 标识单次访问 */
  sessionId?: string;
}

/**
 * 上报完整数据结构
 * @interface ReportData
 * @extends BaseReportData
 */
export interface ReportData extends BaseReportData {
  /** 应用ID */
  appId: string;

  /** 运行环境 */
  env: EnvType;

  /** 数据批次ID - 用于后端去重 */
  batchId?: string;

  /** SDK版本号 */
  sdkVersion?: string;

  /** 设备信息 */
  device?: DeviceInfo;
}

/**
 * 设备信息数据结构
 * @interface DeviceInfo
 */
export interface DeviceInfo {
  /** 浏览器名称 */
  browser: string;

  /** 浏览器版本 */
  browserVersion: string;

  /** 操作系统 */
  os: string;

  /** 操作系统版本 */
  osVersion: string;

  /** 设备类型 */
  deviceType: 'mobile' | 'tablet' | 'desktop' | string;

  /** 网络类型 */
  networkType?: string;

  /** 屏幕分辨率 */
  screenResolution?: string;
}

/**
 * 批量上报数据结构
 * @interface BatchReportData
 */
export interface BatchReportData {
  /** 行为数据 */
  behavior: BehaviorInfo[];

  /** 性能数据 */
  performance: PerformanceMetrics | null;

  /** 错误数据 */
  errors: ErrorInfo[];

  /** 自定义数据 */
  customData: Record<string, unknown>;

  /** 应用ID */
  appId: string;

  /** 时间戳 */
  timestamp: number;
}

/**
 * 主动上报的数据结构
 * @interface ManualReportData
 */
export interface ManualReportData {
  /** 事件名称 */
  event: string;

  /** 事件类别 */
  category?: string;

  /** 事件标签 */
  label?: string;

  /** 事件值 */
  value?: number;

  /** 额外数据 */
  extra?: Record<string, unknown>;
}
