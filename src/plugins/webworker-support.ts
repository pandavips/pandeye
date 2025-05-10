/**
 * Web Worker支持
 * 将监控逻辑移至后台线程，减少主线程负担
 */

import { BehaviorInfo, ErrorInfo, PerformanceMetrics } from '../types';

// Web Worker消息类型
export enum WorkerMessageType {
  INIT = 'init',
  ERROR = 'error',
  PERFORMANCE = 'performance',
  BEHAVIOR = 'behavior',
  REPORT = 'report',
  CUSTOM = 'custom',
  LOG = 'log',
}

// Worker消息接口
export interface WorkerMessage<T = any> {
  type: WorkerMessageType;
  payload: T;
  id?: string;
}

/**
 * PandEye Worker创建工厂
 * 负责创建和管理Worker线程
 */
export class WorkerFactory {
  private static workerBlob: Blob;
  private static workerURL: string;

  /**
   * 创建Worker的内联代码
   * 使用Blob避免额外的网络请求
   */
  private static createWorkerBlob(): Blob {
    const workerScript = `
      // PandEye分析Worker
      
      // 消息类型枚举
      const WorkerMessageType = {
        INIT: 'init',
        ERROR: 'error',
        PERFORMANCE: 'performance',
        BEHAVIOR: 'behavior',
        REPORT: 'report',
        CUSTOM: 'custom',
        LOG: 'log'
      };
      
      // 错误缓存
      let errors = [];
      
      // 行为缓存
      let behaviors = [];
      
      // 性能指标
      let performanceMetrics = {};
      
      // 配置
      let config = {
        appId: '',
        env: 'production',
        reportUrl: '',
        batchSize: 10,
        maxCacheSize: 100
      };
      
      // 设备信息
      let deviceInfo = {};
      
      // 会话ID
      let sessionId = '';
      
      // 上报队列
      const reportQueue = [];
      
      // 处理主线程消息
      self.addEventListener('message', (event) => {
        const message = event.data;
        
        switch (message.type) {
          case WorkerMessageType.INIT:
            handleInit(message.payload);
            break;
          
          case WorkerMessageType.ERROR:
            handleError(message.payload);
            break;
            
          case WorkerMessageType.PERFORMANCE:
            handlePerformance(message.payload);
            break;
            
          case WorkerMessageType.BEHAVIOR:
            handleBehavior(message.payload);
            break;
            
          case WorkerMessageType.REPORT:
            handleReport(message.payload);
            break;
            
          case WorkerMessageType.CUSTOM:
            handleCustom(message.payload);
            break;
        }
      });
      
      // 初始化Worker
      function handleInit(payload) {
        config = { ...config, ...payload.config };
        deviceInfo = payload.deviceInfo;
        sessionId = payload.sessionId;
        
        // 设置定时上报
        if (config.reportUrl) {
          setInterval(() => {
            flushReportQueue();
          }, config.reportInterval || 30000);
        }
        
        log('Worker initialized with appId: ' + config.appId);
      }
      
      // 处理错误信息
      function handleError(errorInfo) {
        // 添加到错误缓存
        errors.push(errorInfo);
        
        // 超出最大缓存，移除最早的
        if (errors.length > config.maxCacheSize) {
          errors.shift();
        }
        
        // 如果达到批处理大小，自动上报
        if (errors.length >= config.batchSize) {
          report();
        }
      }
      
      // 处理性能数据
      function handlePerformance(metrics) {
        performanceMetrics = { ...performanceMetrics, ...metrics };
      }
      
      // 处理行为数据
      function handleBehavior(behavior) {
        // 添加到行为缓存
        behaviors.push(behavior);
        
        // 超出最大缓存，移除最早的
        if (behaviors.length > config.maxCacheSize) {
          behaviors.shift();
        }
      }
      
      // 执行上报
      function handleReport() {
        report();
      }
      
      // 处理自定义数据
      function handleCustom(customData) {
        reportQueue.push({
          type: 'custom',
          data: customData,
          timestamp: Date.now()
        });
        
        // 如果队列过长，自动上报
        if (reportQueue.length >= config.batchSize) {
          flushReportQueue();
        }
      }
      
      // 上报数据
      function report() {
        const reportData = {
          appId: config.appId,
          env: config.env,
          time: Date.now(),
          sessionId,
          device: deviceInfo,
          data: {}
        };
        
        // 添加错误数据
        if (errors.length > 0) {
          reportData.data.errors = [...errors];
          errors = [];
        }
        
        // 添加性能数据
        if (Object.keys(performanceMetrics).length > 0) {
          reportData.data.performance = { ...performanceMetrics };
        }
        
        // 添加行为数据
        if (behaviors.length > 0) {
          reportData.data.behavior = [...behaviors];
          behaviors = [];
        }
        
        // 将报告添加到队列
        reportQueue.push({
          type: 'report',
          data: reportData,
          timestamp: Date.now()
        });
        
        // 尝试发送队列
        flushReportQueue();
      }
      
      // 发送上报队列
      function flushReportQueue() {
        if (reportQueue.length === 0 || !config.reportUrl) return;
        
        // 从队列中获取要上报的数据
        const items = [...reportQueue];
        reportQueue.length = 0;
        
        // 发送数据
        fetch(config.reportUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Pandeye-App': config.appId,
            'X-Pandeye-Env': config.env
          },
          body: JSON.stringify(items),
          keepalive: true
        })
        .then(response => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          return response.json();
        })
        .then(data => {
          log('Data reported successfully');
        })
        .catch(error => {
          log('Error reporting data: ' + error.message);
          
          // 将失败的请求重新加入队列
          reportQueue.push(...items);
          
          // 限制队列长度
          if (reportQueue.length > config.maxCacheSize) {
            reportQueue.splice(0, reportQueue.length - config.maxCacheSize);
          }
        });
      }
      
      // 发送日志回到主线程
      function log(message) {
        self.postMessage({
          type: WorkerMessageType.LOG,
          payload: { message, timestamp: Date.now() }
        });
      }
      
      // 通知主线程Worker已就绪
      self.postMessage({
        type: WorkerMessageType.INIT,
        payload: { status: 'ready', timestamp: Date.now() }
      });
    `;

    return new Blob([workerScript], { type: 'application/javascript' });
  }

  /**
   * 创建Worker实例
   */
  public static createWorker(): Worker {
    // 如果是第一次，创建Worker Blob和URL
    if (!WorkerFactory.workerBlob) {
      WorkerFactory.workerBlob = WorkerFactory.createWorkerBlob();
      WorkerFactory.workerURL = URL.createObjectURL(WorkerFactory.workerBlob);
    }

    return new Worker(WorkerFactory.workerURL);
  }

  /**
   * 清理资源
   */
  public static dispose(): void {
    if (WorkerFactory.workerURL) {
      URL.revokeObjectURL(WorkerFactory.workerURL);
      WorkerFactory.workerURL = '';
    }
  }
}

/**
 * PandEye Worker代理
 * 负责Main Thread和Worker Thread之间的通信
 */
export class WorkerManager {
  private worker: Worker;
  private messageHandlers: Map<WorkerMessageType, Array<(data: any) => void>> = new Map();
  private responseHandlers: Map<string, (data: any) => void> = new Map();
  private initialized: boolean = false;
  private workerReady: boolean = false;
  private initResolver?: (value: void | PromiseLike<void>) => void;
  private initPromise: Promise<void>;

  constructor() {
    // 创建初始化Promise
    this.initPromise = new Promise<void>(resolve => {
      this.initResolver = resolve;
    });

    // 创建Worker
    this.worker = WorkerFactory.createWorker();

    // 设置消息处理
    this.worker.addEventListener('message', this.handleWorkerMessage.bind(this));

    // 设置错误处理
    this.worker.addEventListener('error', this.handleWorkerError.bind(this));
  }

  /**
   * 处理来自Worker的消息
   */
  private handleWorkerMessage(event: MessageEvent): void {
    const message = event.data as WorkerMessage;

    // 如果是Worker就绪消息
    if (message.type === WorkerMessageType.INIT && !this.workerReady) {
      this.workerReady = true;

      // 如果已初始化完成，解析初始化Promise
      if (this.initialized && this.initResolver) {
        this.initResolver();
        this.initResolver = undefined;
      }

      return;
    }

    // 处理有ID的响应
    if (message.id && this.responseHandlers.has(message.id)) {
      const handler = this.responseHandlers.get(message.id)!;
      handler(message.payload);
      this.responseHandlers.delete(message.id);
      return;
    }

    // 处理已注册的消息处理程序
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message.payload);
        } catch (error) {
          console.error('[PandEye] Error in worker message handler:', error);
        }
      });
    }
  }

  /**
   * 处理Worker错误
   */
  private handleWorkerError(error: ErrorEvent): void {
    console.error('[PandEye] Worker error:', error.message);
  }

  /**
   * 发送消息到Worker
   */
  public sendMessage<T = any>(type: WorkerMessageType, payload: any): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // 创建消息ID
      const messageId = Date.now().toString() + Math.random().toString(36).substring(2);

      // 注册响应处理程序
      this.responseHandlers.set(messageId, resolve);

      // 发送消息
      this.worker.postMessage({
        type,
        payload,
        id: messageId,
      });

      // 设置超时
      setTimeout(() => {
        if (this.responseHandlers.has(messageId)) {
          this.responseHandlers.delete(messageId);
          reject(new Error('[PandEye] Worker message response timeout'));
        }
      }, 10000);
    });
  }

  /**
   * 注册消息处理程序
   */
  public on(type: WorkerMessageType, handler: (data: any) => void): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }

    this.messageHandlers.get(type)!.push(handler);

    // 返回取消注册的函数
    return () => {
      const handlers = this.messageHandlers.get(type);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index !== -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * 初始化Worker
   */
  public async initialize(config: any): Promise<void> {
    // 发送初始化消息
    await this.sendMessage(WorkerMessageType.INIT, config);

    this.initialized = true;

    // 如果Worker已就绪，解析初始化Promise
    if (this.workerReady && this.initResolver) {
      this.initResolver();
      this.initResolver = undefined;
    }

    // 等待初始化完成
    return this.initPromise;
  }

  /**
   * 报告错误
   */
  public reportError(error: ErrorInfo): Promise<void> {
    return this.sendMessage(WorkerMessageType.ERROR, error);
  }

  /**
   * 报告性能指标
   */
  public reportPerformance(metrics: PerformanceMetrics): Promise<void> {
    return this.sendMessage(WorkerMessageType.PERFORMANCE, metrics);
  }

  /**
   * 报告用户行为
   */
  public reportBehavior(behavior: BehaviorInfo): Promise<void> {
    return this.sendMessage(WorkerMessageType.BEHAVIOR, behavior);
  }

  /**
   * 发送自定义数据
   */
  public reportCustom(name: string, data: any): Promise<void> {
    return this.sendMessage(WorkerMessageType.CUSTOM, { name, data });
  }

  /**
   * 触发上报
   */
  public triggerReport(): Promise<void> {
    return this.sendMessage(WorkerMessageType.REPORT, {});
  }

  /**
   * 终止Worker
   */
  public terminate(): void {
    this.worker.terminate();
  }
}

/**
 * 判断是否支持Web Worker
 */
export function isWorkerSupported(): boolean {
  return typeof Worker !== 'undefined';
}
