/**
 * 智能告警系统
 * 基于异常检测、趋势分析和用户影响提供实时监控告警
 */

import { EventBus } from '../core/event-system';

/**
 * 告警优先级
 */
export enum AlertPriority {
  CRITICAL = 'critical', // 紧急问题，需要立即处理
  HIGH = 'high', // 重要问题，需要尽快处理
  MEDIUM = 'medium', // 中等问题，需要关注
  LOW = 'low', // 低优先级问题，可以稍后处理
  INFO = 'info', // 仅供参考的信息
}

/**
 * 告警状态
 */
export enum AlertStatus {
  ACTIVE = 'active', // 告警激活中
  ACKNOWLEDGED = 'acknowledged', // 已确认
  RESOLVED = 'resolved', // 已解决
  MUTED = 'muted', // 已静音
}

/**
 * 告警类型
 */
export enum AlertType {
  ERROR_SPIKE = 'error_spike', // 错误数量突增
  ERROR_RATE = 'error_rate', // 错误率超阈值
  PERFORMANCE_DEGRADATION = 'perf_degradation', // 性能下降
  API_LATENCY = 'api_latency', // API响应时间异常
  RESOURCE_LOADING = 'resource_loading', // 资源加载问题
  USER_EXPERIENCE = 'user_experience', // 用户体验指标异常
  CUSTOM_THRESHOLD = 'custom_threshold', // 自定义指标阈值
  ANOMALY_DETECTION = 'anomaly', // 异常检测
  BEHAVIOR_CHANGE = 'behavior_change', // 用户行为异常变化
  SECURITY = 'security', // 安全相关告警
}

/**
 * 告警条件类型
 */
export enum ConditionType {
  THRESHOLD = 'threshold', // 固定阈值
  ANOMALY = 'anomaly', // 异常检测
  TREND = 'trend', // 趋势变化
  COMPOUND = 'compound', // 复合条件
}

/**
 * 告警条件
 */
export interface AlertCondition {
  type: ConditionType;
  metric: string;
  operator?: '>' | '>=' | '<' | '<=' | '==' | '!=';
  threshold?: number;
  timeWindow?: number; // 窗口时间(毫秒)
  minSampleSize?: number; // 最小样本量
  sensitivity?: number; // 灵敏度(0-1)
}

/**
 * 告警定义
 */
export interface AlertDefinition {
  id: string;
  name: string;
  description: string;
  type: AlertType;
  priority: AlertPriority;
  conditions: AlertCondition[];
  notifications?: NotificationChannel[];
  groupBy?: string[]; // 分组维度
  cooldownPeriod?: number; // 冷却期(毫秒)
  autoResolve?: boolean; // 是否自动解决
  autoResolveTimeout?: number; // 自动解决超时(毫秒)
}

/**
 * 告警触发事件
 */
export interface AlertEvent {
  alertId: string;
  timestamp: number;
  metricValue?: number;
  threshold?: number;
  context?: Record<string, any>;
  affectedUsers?: number | string[];
  affectedSessions?: number | string[];
}

/**
 * 告警实例
 */
export interface Alert {
  id: string;
  definitionId: string;
  name: string;
  type: AlertType;
  priority: AlertPriority;
  status: AlertStatus;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
  events: AlertEvent[];
  notificationsSent: NotificationStatus[];
  affectedUsers?: number;
  affectedSessions?: number;
  notes?: string[];
  context?: Record<string, any>;
}

/**
 * 通知渠道类型
 */
export enum NotificationChannelType {
  EMAIL = 'email',
  SMS = 'sms',
  SLACK = 'slack',
  WEBHOOK = 'webhook',
  CONSOLE = 'console',
  CUSTOM = 'custom',
}

/**
 * 通知渠道
 */
export interface NotificationChannel {
  type: NotificationChannelType;
  target: string; // 邮箱、电话、URL等
  template?: string; // 通知模板
  throttle?: number; // 节流时间(毫秒)
}

/**
 * 通知状态
 */
export interface NotificationStatus {
  channel: NotificationChannelType;
  target: string;
  timestamp: number;
  success: boolean;
  error?: string;
}

/**
 * 告警管理器配置
 */
export interface AlertManagerConfig {
  enabled: boolean;
  maxActiveAlerts: number;
  defaultCooldownPeriod: number;
  defaultAutoResolveTimeout: number;
  storageLimit: number; // 最大存储告警数量
  evaluationInterval: number; // 评估间隔(毫秒)
}

/**
 * 智能告警管理器
 */
export class AlertManager {
  private definitions: Map<string, AlertDefinition> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private resolvedAlerts: Alert[] = [];
  private cooldowns: Map<string, number> = new Map();
  private config: AlertManagerConfig;
  private eventBus: EventBus;
  private metrics: Map<string, any[]> = new Map();
  private lastEvaluation: number = 0;
  private evaluationTimer?: number;

  /**
   * 创建告警管理器
   */
  constructor(config: Partial<AlertManagerConfig> = {}, eventBus?: EventBus) {
    this.config = {
      enabled: config.enabled !== false,
      maxActiveAlerts: config.maxActiveAlerts || 100,
      defaultCooldownPeriod: config.defaultCooldownPeriod || 30 * 60 * 1000, // 默认冷却30分钟
      defaultAutoResolveTimeout: config.defaultAutoResolveTimeout || 4 * 60 * 60 * 1000, // 默认4小时后自动解决
      storageLimit: config.storageLimit || 1000,
      evaluationInterval: config.evaluationInterval || 60 * 1000, // 默认每分钟评估
    };

    this.eventBus = eventBus || new EventBus();

    if (this.config.enabled) {
      this.start();
    }
  }

  /**
   * 开始告警监控
   */
  public start(): void {
    if (this.evaluationTimer) {
      return;
    }

    this.evaluationTimer = window.setInterval(() => {
      this.evaluateAlerts();
    }, this.config.evaluationInterval);

    // 立即进行一次评估
    this.evaluateAlerts();
  }

  /**
   * 停止告警监控
   */
  public stop(): void {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = undefined;
    }
  }

  /**
   * 注册告警定义
   */
  public registerAlert(definition: AlertDefinition): void {
    // 验证告警定义
    if (
      !definition.id ||
      !definition.name ||
      !definition.conditions ||
      definition.conditions.length === 0
    ) {
      throw new Error('Invalid alert definition');
    }

    this.definitions.set(definition.id, {
      ...definition,
      cooldownPeriod: definition.cooldownPeriod || this.config.defaultCooldownPeriod,
      autoResolveTimeout: definition.autoResolveTimeout || this.config.defaultAutoResolveTimeout,
      autoResolve: definition.autoResolve !== false,
    });
  }

  /**
   * 批量注册告警定义
   */
  public registerAlerts(definitions: AlertDefinition[]): void {
    for (const definition of definitions) {
      this.registerAlert(definition);
    }
  }

  /**
   * 移除告警定义
   */
  public removeAlert(id: string): boolean {
    return this.definitions.delete(id);
  }

  /**
   * 更新指标数据
   */
  public updateMetric(name: string, value: any, context: Record<string, any> = {}): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricData = {
      value,
      timestamp: Date.now(),
      context,
    };

    const metricArray = this.metrics.get(name)!;
    metricArray.push(metricData);

    // 限制存储大小
    if (metricArray.length > 1000) {
      metricArray.shift();
    }

    // 如果超过评估间隔，触发评估
    const now = Date.now();
    if (now - this.lastEvaluation > this.config.evaluationInterval) {
      this.lastEvaluation = now;
      this.evaluateAlerts();
    }
  }

  /**
   * 评估所有告警条件
   */
  private evaluateAlerts(): void {
    const now = Date.now();
    this.lastEvaluation = now;

    // 检查是否有告警应该自动解决
    this.checkAutoResolve(now);

    // 评估每个告警定义
    for (const [id, definition] of this.definitions.entries()) {
      // 检查冷却期
      if (this.cooldowns.has(id) && now < this.cooldowns.get(id)!) {
        continue;
      }

      // 获取相关指标数据
      const metricsToEvaluate = new Map<string, any[]>();
      for (const condition of definition.conditions) {
        if (this.metrics.has(condition.metric)) {
          metricsToEvaluate.set(condition.metric, this.metrics.get(condition.metric)!);
        }
      }

      // 如果没有足够的指标数据，跳过
      if (metricsToEvaluate.size < definition.conditions.length) {
        continue;
      }

      // 评估告警条件
      const result = this.evaluateConditions(definition.conditions, metricsToEvaluate);

      // 如果条件满足，触发告警
      if (result.triggered) {
        this.triggerAlert(definition, result.values, result.context);

        // 设置冷却期
        this.cooldowns.set(
          id,
          now + (definition.cooldownPeriod || this.config.defaultCooldownPeriod)
        );
      }
    }

    // 清理过期的指标数据
    this.cleanupMetrics(now);
  }

  /**
   * 评估告警条件
   */
  private evaluateConditions(
    conditions: AlertCondition[],
    metrics: Map<string, any[]>
  ): { triggered: boolean; values: Record<string, number>; context: Record<string, any> } {
    const result = {
      triggered: true,
      values: {} as Record<string, number>,
      context: {} as Record<string, any>,
    };

    // 每个条件都必须满足
    for (const condition of conditions) {
      const metricData = metrics.get(condition.metric);
      if (!metricData || metricData.length === 0) {
        result.triggered = false;
        break;
      }

      // 根据条件类型评估
      switch (condition.type) {
        case ConditionType.THRESHOLD: {
          const isTriggered = this.evaluateThresholdCondition(condition, metricData);
          if (!isTriggered) {
            result.triggered = false;
          }
          break;
        }

        case ConditionType.ANOMALY: {
          const anomalyResult = this.evaluateAnomalyCondition(condition, metricData);
          if (!anomalyResult.triggered) {
            result.triggered = false;
          }

          // 保存异常信息到上下文
          if (anomalyResult.details) {
            result.context[`anomaly_${condition.metric}`] = anomalyResult.details;
          }
          break;
        }

        case ConditionType.TREND: {
          const trendResult = this.evaluateTrendCondition(condition, metricData);
          if (!trendResult.triggered) {
            result.triggered = false;
          }

          // 保存趋势信息到上下文
          if (trendResult.details) {
            result.context[`trend_${condition.metric}`] = trendResult.details;
          }
          break;
        }

        default:
          // 不支持的条件类型
          result.triggered = false;
      }

      // 如果有一个条件未满足，提前退出
      if (!result.triggered) {
        break;
      }

      // 记录最新值
      const latestValue = metricData[metricData.length - 1].value;
      result.values[condition.metric] = latestValue;

      // 记录上下文
      result.context[`last_${condition.metric}`] = latestValue;
      result.context[`timestamp_${condition.metric}`] = metricData[metricData.length - 1].timestamp;

      // 添加最近的上下文信息
      if (metricData[metricData.length - 1].context) {
        result.context[`context_${condition.metric}`] = metricData[metricData.length - 1].context;
      }
    }

    return result;
  }

  /**
   * 评估阈值条件
   */
  private evaluateThresholdCondition(condition: AlertCondition, metricData: any[]): boolean {
    if (!condition.operator || condition.threshold === undefined) {
      return false;
    }

    const latestValue = metricData[metricData.length - 1].value;
    const threshold = condition.threshold;

    switch (condition.operator) {
      case '>':
        return latestValue > threshold;
      case '>=':
        return latestValue >= threshold;
      case '<':
        return latestValue < threshold;
      case '<=':
        return latestValue <= threshold;
      case '==':
        return latestValue === threshold;
      case '!=':
        return latestValue !== threshold;
      default:
        return false;
    }
  }

  /**
   * 评估异常检测条件
   */
  private evaluateAnomalyCondition(
    condition: AlertCondition,
    metricData: any[]
  ): { triggered: boolean; details?: any } {
    const minSamples = condition.minSampleSize || 10;

    // 需要足够的样本量
    if (metricData.length < minSamples) {
      return { triggered: false };
    }

    // 获取时间窗口内的数据
    const timeWindow = condition.timeWindow || 30 * 60 * 1000; // 默认30分钟
    const now = Date.now();
    const windowData = metricData.filter(d => now - d.timestamp <= timeWindow);

    if (windowData.length < minSamples) {
      return { triggered: false };
    }

    // 提取值
    const values = windowData.map(d => d.value);

    // 计算均值和标准差
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // 获取最新值
    const latestValue = values[values.length - 1];

    // 计算Z得分（与均值的标准差倍数）
    const zScore = stdDev === 0 ? 0 : Math.abs(latestValue - mean) / stdDev;

    // 灵敏度阈值（默认2.5个标准差）
    const sensitivityThreshold = condition.sensitivity ? 3 - 2 * condition.sensitivity : 2.5;

    // 如果Z得分超过阈值，则认为是异常
    const isAnomaly = zScore > sensitivityThreshold;

    return {
      triggered: isAnomaly,
      details: {
        mean,
        stdDev,
        latestValue,
        zScore,
        threshold: sensitivityThreshold,
        sampleSize: values.length,
      },
    };
  }

  /**
   * 评估趋势条件
   */
  private evaluateTrendCondition(
    condition: AlertCondition,
    metricData: any[]
  ): { triggered: boolean; details?: any } {
    const minSamples = condition.minSampleSize || 10;

    // 需要足够的样本量
    if (metricData.length < minSamples) {
      return { triggered: false };
    }

    // 获取时间窗口内的数据
    const timeWindow = condition.timeWindow || 30 * 60 * 1000; // 默认30分钟
    const now = Date.now();
    const windowData = metricData.filter(d => now - d.timestamp <= timeWindow);

    if (windowData.length < minSamples) {
      return { triggered: false };
    }

    // 对数据点进行索引标记，用于线性回归
    const indexedData = windowData.map((d, i) => ({
      x: i,
      y: d.value,
      timestamp: d.timestamp,
    }));

    // 计算线性回归
    const n = indexedData.length;
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumX2 = 0;

    for (const point of indexedData) {
      sumX += point.x;
      sumY += point.y;
      sumXY += point.x * point.y;
      sumX2 += point.x * point.x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // 计算预测值和实际值的差异
    const predictions = indexedData.map(point => intercept + slope * point.x);
    const lastPrediction = predictions[predictions.length - 1];
    const lastActual = indexedData[indexedData.length - 1].y;

    // 计算相对变化率
    const firstValue = indexedData[0].y;
    const lastValue = lastActual;
    const relativeChange = firstValue !== 0 ? (lastValue - firstValue) / Math.abs(firstValue) : 0;

    // 如果斜率表明显著变化，且超过阈值，则触发
    const significantChange = Math.abs(relativeChange) >= (condition.threshold || 0.2); // 默认20%变化

    // 确定趋势方向
    let direction = 'stable';
    if (slope > 0.01) {
      direction = 'increasing';
    } else if (slope < -0.01) {
      direction = 'decreasing';
    }

    // 判断是否触发
    let triggered = false;
    if (condition.operator === '>' && relativeChange > (condition.threshold || 0)) {
      triggered = true;
    } else if (condition.operator === '<' && relativeChange < (condition.threshold || 0)) {
      triggered = true;
    } else if (!condition.operator && significantChange) {
      triggered = true;
    }

    return {
      triggered,
      details: {
        slope,
        intercept,
        direction,
        relativeChange,
        firstValue,
        lastValue,
        lastPrediction,
        sampleSize: indexedData.length,
        windowStart: indexedData[0].timestamp,
        windowEnd: indexedData[indexedData.length - 1].timestamp,
      },
    };
  }

  /**
   * 触发告警
   */
  private triggerAlert(
    definition: AlertDefinition,
    metricValues: Record<string, number>,
    context: Record<string, any>
  ): void {
    const now = Date.now();

    // 检查是否已有相同定义的活跃告警
    let existingAlert: Alert | undefined;
    for (const alert of this.activeAlerts.values()) {
      if (alert.definitionId === definition.id && alert.status !== AlertStatus.RESOLVED) {
        existingAlert = alert;
        break;
      }
    }

    const alertEvent: AlertEvent = {
      alertId: existingAlert?.id || `alert_${now}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: now,
      metricValue: Object.values(metricValues)[0],
      context: { ...context },
    };

    // 如果已存在告警，更新它
    if (existingAlert) {
      existingAlert.events.push(alertEvent);
      existingAlert.updatedAt = now;

      // 发送更新事件
      this.eventBus.emit('alert:updated', existingAlert);
    } else {
      // 创建新告警
      const newAlert: Alert = {
        id: alertEvent.alertId,
        definitionId: definition.id,
        name: definition.name,
        type: definition.type,
        priority: definition.priority,
        status: AlertStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
        events: [alertEvent],
        notificationsSent: [],
        context: { ...context },
      };

      // 添加到活跃告警
      this.activeAlerts.set(newAlert.id, newAlert);

      // 确保不超过最大活跃告警数
      if (this.activeAlerts.size > this.config.maxActiveAlerts) {
        // 移除最旧的低优先级告警
        let oldestLowPriorityAlert: Alert | null = null;
        let oldestTime = Infinity;

        for (const alert of this.activeAlerts.values()) {
          if (alert.priority === AlertPriority.LOW && alert.createdAt < oldestTime) {
            oldestLowPriorityAlert = alert;
            oldestTime = alert.createdAt;
          }
        }

        if (oldestLowPriorityAlert) {
          this.activeAlerts.delete(oldestLowPriorityAlert.id);
          this.archiveAlert(oldestLowPriorityAlert);
        }
      }

      // 发送新告警事件
      this.eventBus.emit('alert:created', newAlert);
    }

    // 发送通知
    this.sendNotifications(existingAlert || this.activeAlerts.get(alertEvent.alertId)!);
  }

  /**
   * 发送通知
   */
  private sendNotifications(alert: Alert): void {
    const definition = this.definitions.get(alert.definitionId);
    if (!definition || !definition.notifications || definition.notifications.length === 0) {
      return;
    }

    const now = Date.now();

    for (const channel of definition.notifications) {
      // 检查是否需要节流通知
      const lastNotification = alert.notificationsSent.find(
        n => n.channel === channel.type && n.target === channel.target
      );

      // 如果在节流期内，跳过
      if (
        lastNotification &&
        channel.throttle &&
        now - lastNotification.timestamp < channel.throttle
      ) {
        continue;
      }

      // 发送通知
      this.sendNotification(alert, channel).then(success => {
        alert.notificationsSent.push({
          channel: channel.type,
          target: channel.target,
          timestamp: now,
          success,
          error: success ? undefined : 'Failed to send notification',
        });
      });
    }
  }

  /**
   * 发送单个通知
   */
  private async sendNotification(alert: Alert, channel: NotificationChannel): Promise<boolean> {
    try {
      // 根据渠道类型处理通知
      switch (channel.type) {
        case NotificationChannelType.CONSOLE:
          // 控制台日志
          console.warn(
            `[Pandeye Alert] ${alert.name} (${alert.priority})`,
            alert.events[alert.events.length - 1]
          );
          return true;

        case NotificationChannelType.WEBHOOK:
          // 发送Webhook
          if (!channel.target) return false;

          const response = await fetch(channel.target, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              alert: {
                id: alert.id,
                name: alert.name,
                type: alert.type,
                priority: alert.priority,
                status: alert.status,
                createdAt: alert.createdAt,
                updatedAt: alert.updatedAt,
              },
              event: alert.events[alert.events.length - 1],
            }),
          });

          return response.ok;

        // 其他渠道需要后端支持或第三方服务
        case NotificationChannelType.EMAIL:
        case NotificationChannelType.SMS:
        case NotificationChannelType.SLACK:
          // 这些通常需要通过API发送
          this.eventBus.emit('alert:notification-request', {
            alertId: alert.id,
            channel: channel.type,
            target: channel.target,
            alert: alert,
          });
          return true;

        case NotificationChannelType.CUSTOM:
          // 触发自定义通知事件，让外部处理
          this.eventBus.emit('alert:custom-notification', {
            alert,
            channel,
          });
          return true;

        default:
          return false;
      }
    } catch (error) {
      console.error(`[Pandeye] Failed to send ${channel.type} notification:`, error);
      return false;
    }
  }

  /**
   * 确认告警
   */
  public acknowledgeAlert(alertId: string, acknowledgedBy?: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.acknowledgedAt = Date.now();
    alert.acknowledgedBy = acknowledgedBy;

    // 发送事件
    this.eventBus.emit('alert:acknowledged', alert);

    return true;
  }

  /**
   * 解决告警
   */
  public resolveAlert(alertId: string, note?: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.status = AlertStatus.RESOLVED;
    alert.resolvedAt = Date.now();

    if (note) {
      if (!alert.notes) {
        alert.notes = [];
      }
      alert.notes.push(note);
    }

    // 移到已解决列表
    this.archiveAlert(alert);

    // 发送事件
    this.eventBus.emit('alert:resolved', alert);

    return true;
  }

  /**
   * 归档告警
   */
  private archiveAlert(alert: Alert): void {
    this.activeAlerts.delete(alert.id);
    this.resolvedAlerts.push(alert);

    // 限制已解决告警的存储数量
    if (this.resolvedAlerts.length > this.config.storageLimit) {
      this.resolvedAlerts.shift();
    }
  }

  /**
   * 添加告警注释
   */
  public addAlertNote(alertId: string, note: string): boolean {
    const alert = this.activeAlerts.get(alertId) || this.resolvedAlerts.find(a => a.id === alertId);

    if (!alert) {
      return false;
    }

    if (!alert.notes) {
      alert.notes = [];
    }

    alert.notes.push(note);
    alert.updatedAt = Date.now();

    return true;
  }

  /**
   * 检查自动解决告警
   */
  private checkAutoResolve(now: number): void {
    for (const alert of this.activeAlerts.values()) {
      const definition = this.definitions.get(alert.definitionId);
      if (!definition || !definition.autoResolve) {
        continue;
      }

      const timeout = definition.autoResolveTimeout || this.config.defaultAutoResolveTimeout;
      const lastEventTime = Math.max(...alert.events.map(e => e.timestamp));

      if (now - lastEventTime > timeout) {
        // 自动解决超时告警
        this.resolveAlert(alert.id, 'Auto-resolved due to timeout');
      }
    }
  }

  /**
   * 清理过期指标数据
   */
  private cleanupMetrics(now: number): void {
    // 保留最近24小时的数据
    const retentionTime = 24 * 60 * 60 * 1000;

    for (const [metric, data] of this.metrics.entries()) {
      const filteredData = data.filter(point => now - point.timestamp <= retentionTime);
      this.metrics.set(metric, filteredData);
    }
  }

  /**
   * 获取活跃告警
   */
  public getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * 获取已解决告警
   */
  public getResolvedAlerts(limit: number = 100): Alert[] {
    return this.resolvedAlerts.slice(-limit);
  }

  /**
   * 获取所有告警定义
   */
  public getAlertDefinitions(): AlertDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * 获取特定告警
   */
  public getAlert(alertId: string): Alert | undefined {
    return this.activeAlerts.get(alertId) || this.resolvedAlerts.find(a => a.id === alertId);
  }
}
