export interface PandeyeOptions {
  appId: string;
  // 上报接口地址
  reportUrl?: string;
  // 上报时机
  reportTime?: 'immediately' | 'beforeunload' | number;
  // 是否自动开始监控
  autoStart?: boolean;
  // 是否启用性能监控
  enablePerformance?: boolean;
  // 是否启用错误监控
  enableError?: boolean;
  // 是否启用用户行为监控
  enableBehavior?: boolean;
  // 是否启用控制台日志监控
  enableConsole?: boolean;
  // 自定义上报数据
  customReport?: {
    [key: string]: any;
  };
}

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

export interface ResourceMetric {
  name: string;
  initiatorType: string;
  duration: number;
  transferSize: number;
  startTime: number;
}

export interface ErrorInfo {
  type: 'js' | 'promise' | 'resource' | 'api';
  message: string;
  stack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  timestamp: number;
}

export interface BehaviorInfo {
  type: 'pv' | 'click' | 'route' | 'custom';
  data: any;
  timestamp: number;
}