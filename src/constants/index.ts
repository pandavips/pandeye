/**
 * 常量配置文件
 * 集中管理所有项目常量，方便统一修改和维护
 *
 * @module constants
 * @author Pandeye Team
 * @version 0.1.0
 */

/**
 * 默认配置常量
 */
export const DEFAULT_CONFIG = {
  /**
   * 默认环境
   */
  ENV: 'prod',

  /**
   * 默认上报URL
   */
  REPORT_URL: 'https://monitor-api.example.com/report',

  /**
   * 默认上报时机 - 页面关闭前上报
   */
  REPORT_TIME: 'beforeunload',

  /**
   * 默认自动开始监控
   */
  AUTO_START: true,

  /**
   * 默认开启性能监控
   */
  ENABLE_PERFORMANCE: true,

  /**
   * 默认开启错误监控
   */
  ENABLE_ERROR: true,

  /**
   * 默认开启行为监控
   */
  ENABLE_BEHAVIOR: true,

  /**
   * 默认关闭控制台监控
   */
  ENABLE_CONSOLE: false,
};

/**
 * 上报时机
 */
export const REPORT_TIMING = {
  /**
   * 立即上报
   */
  IMMEDIATELY: 'immediately',

  /**
   * 页面关闭前上报
   */
  BEFORE_UNLOAD: 'beforeunload',

  /**
   * 默认定时上报间隔 (ms)
   */
  DEFAULT_INTERVAL: 10000,
};

/**
 * 事件类型常量
 */
export const EVENT_TYPES = {
  /**
   * 错误类型
   */
  ERROR: {
    /**
     * JavaScript运行时错误
     */
    JS: 'js_error',

    /**
     * Promise 未捕获异常
     */
    PROMISE: 'promise_error',

    /**
     * 资源加载错误
     */
    RESOURCE: 'resource_error',

    /**
     * API请求错误
     */
    API: 'api_error',

    /**
     * Vue框架错误
     */
    VUE: 'vue_error',

    /**
     * React框架错误
     */
    REACT: 'react_error',

    /**
     * 自定义错误
     */
    CUSTOM: 'custom_error',
  },

  /**
   * 上报类型
   */
  REPORT: {
    /**
     * 批量上报
     */
    BATCH: 'batch',

    /**
     * 手动上报
     */
    MANUAL: 'manual',

    /**
     * 控制台日志上报
     */
    CONSOLE: 'console',
  },

  /**
   * 用户行为类型
   */
  BEHAVIOR: {
    /**
     * 页面访问
     */
    PV: 'pv',

    /**
     * 点击行为
     */
    CLICK: 'click',

    /**
     * 路由变化
     */
    ROUTE: 'route',

    /**
     * 自定义事件
     */
    CUSTOM: 'custom',
  },

  /**
   * 性能指标类型
   */
  PERFORMANCE: {
    /**
     * 首次内容绘制
     */
    FP: 'first_paint',

    /**
     * 首次有意义绘制
     */
    FMP: 'first_meaningful_paint',

    /**
     * 首次交互时间
     */
    FID: 'first_input_delay',

    /**
     * 最大内容绘制
     */
    LCP: 'largest_contentful_paint',

    /**
     * 累计布局偏移
     */
    CLS: 'cumulative_layout_shift',
  },
};

/**
 * 限制阈值常量
 */
export const LIMITS = {
  /**
   * 默认批量上报大小
   */
  DEFAULT_BATCH_SIZE: 10,

  /**
   * 默认重试次数
   */
  DEFAULT_RETRY_COUNT: 3,

  /**
   * 重试延迟基础值(ms)
   */
  RETRY_DELAY_BASE: 1000,

  /**
   * 最大重试延迟(ms)
   */
  MAX_RETRY_DELAY: 30000,

  /**
   * 最大记录行为数
   */
  MAX_BEHAVIOR_RECORDS: 100,

  /**
   * 最大记录错误数
   */
  MAX_ERROR_RECORDS: 50,

  /**
   * 最大存储天数
   */
  MAX_STORAGE_DAYS: 7,

  /**
   * 日志设置
   */
  LOGGING: {
    /**
     * 最大日志长度
     */
    MAX_LENGTH: 1000,

    /**
     * 最大报错消息长度
     */
    MAX_ERROR_MSG_LENGTH: 500,
  },

  /**
   * 安全检查阈值
   */
  SAFETY: {
    /**
     * 最大循环检测阈值
     */
    MAX_LOOP_DETECT: 1000,

    /**
     * 最大错误率阈值 (超过该值将暂停上报)
     */
    MAX_ERROR_RATE: 0.5,
  },

  /**
   * 节流设置
   */
  THROTTLE: {
    /**
     * 默认节流时间 (ms)
     */
    DEFAULT: 300,

    /**
     * 滚动事件节流时间 (ms)
     */
    SCROLL: 200,

    /**
     * 调整大小事件节流时间 (ms)
     */
    RESIZE: 200,
  },

  /**
   * 存储限制
   */
  STORAGE: {
    /**
     * 本地存储最大容量 (bytes)
     */
    MAX_SIZE: 1024 * 1024 * 5, // 5MB
  },
};

/**
 * 存储键名常量
 */
export const STORAGE_KEYS = {
  /**
   * 会话ID存储键
   */
  SESSION_ID: 'pandeye_session_id',

  /**
   * 设备ID存储键
   */
  DEVICE_ID: 'pandeye_device_id',

  /**
   * 首次访问时间存储键
   */
  FIRST_VISIT_TIME: 'pandeye_first_visit',

  /**
   * 离线数据缓存键
   */
  OFFLINE_CACHE: 'pandeye_offline_data',

  /**
   * 用户标识存储键
   */
  USER_ID: 'pandeye_user_id',
};

/**
 * 错误级别常量
 */
export const ERROR_LEVEL = {
  /**
   * 错误
   */
  ERROR: 'error',

  /**
   * 警告
   */
  WARN: 'warn',

  /**
   * 提示信息
   */
  INFO: 'info',
};

/**
 * HTTP状态码分类
 */
export const HTTP_STATUS = {
  /**
   * 成功状态码
   */
  SUCCESS: [200, 201, 202, 203, 204, 205, 206],

  /**
   * 重定向状态码
   */
  REDIRECT: [300, 301, 302, 303, 304, 305, 306, 307, 308],

  /**
   * 客户端错误状态码
   */
  CLIENT_ERROR: [
    400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414, 415, 416, 417, 418,
    421, 422, 423, 424, 425, 426, 428, 429, 431, 451,
  ],

  /**
   * 服务器错误状态码
   */
  SERVER_ERROR: [500, 501, 502, 503, 504, 505, 506, 507, 508, 510, 511],
};

/**
 * 调试模式配置
 */
export const DEBUG_MODE = {
  /**
   * 是否为开发环境
   */
  IS_DEV: process.env.NODE_ENV === 'development',

  /**
   * 是否开启调试日志
   */
  ENABLE_LOG: process.env.NODE_ENV === 'development',
};

/**
 * 会话常量
 */
export const SESSION = {
  /**
   * 会话超时时间 (ms)
   */
  TIMEOUT: 30 * 60 * 1000, // 30分钟

  /**
   * 心跳间隔 (ms)
   */
  HEARTBEAT_INTERVAL: 5 * 60 * 1000, // 5分钟
};

/**
 * SDK版本
 */
export const SDK_VERSION = '0.1.0';

/**
 * 自定义事件常量
 */
export const CUSTOM_EVENTS = {
  /**
   * 路由变更事件
   */
  ROUTE_CHANGE: 'pandeye_route_change',
};
