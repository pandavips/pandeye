# Pandeye

一个轻量级且功能强大的前端监控SDK，支持行为、性能、错误追踪等多种监控能力。

## 特性

- 🔍 全面的监控能力
  - 用户行为监控（PV、点击、路由变化等）
  - 性能监控（页面加载、资源加载、绘制时间等）
  - 错误监控（JS异常、Promise异常、资源加载错误、API错误）
  - 控制台日志监控

- 💪 强大的扩展性
  - 支持自定义事件上报
  - 灵活的数据上报配置
  - 完整的TypeScript类型支持

- 🚀 高性能
  - 批量数据上报
  - 支持数据压缩
  - 智能队列管理

## 安装

```bash
npm install pandeye
# or
yarn add pandeye
```

## 快速开始

```typescript
import { Pandeye } from 'pandeye';

// 初始化监控实例
const monitor = Pandeye.getInstance({
  appId: 'your-app-id',
  env: 'dev', // 任意环境标识
  reportUrl: 'your-report-url',
  // 可选配置
  reportTime: 'beforeunload', // 'immediately' | 'beforeunload' | number(ms)
  enablePerformance: true,
  enableError: true,
  enableBehavior: true,
  enableConsole: false
});

// 手动上报自定义事件（将作为行为数据记录）
monitor.trackEvent('button_click', {
  buttonId: 'submit-button',
  page: 'home'
});

// 主动上报数据（立即上报，不会被缓存）
monitor.report({
  event: 'purchase',
  category: 'order',
  label: 'product_1',
  value: 99.9,
  extra: {
    orderId: '12345',
    payMethod: 'alipay'
  }
});

// 主动批量上报数据
monitor.batchReport([
  {
    event: 'add_to_cart',
    category: 'shopping',
    label: 'product_1'
  },
  {
    event: 'view_item',
    category: 'product',
    label: 'product_2'
  }
]);

// 手动触发缓存数据上报
monitor.flush();
```

## 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| appId | string | - | 必填，应用唯一标识 |
| env | string | 'dev' | 运行环境标识 |
| reportUrl | string | - | 数据上报地址 |
| reportTime | 'immediately' \| 'beforeunload' \| number | 'beforeunload' | 数据上报时机 |
| autoStart | boolean | true | 是否自动开始监控 |
| enablePerformance | boolean | true | 是否启用性能监控 |
| enableError | boolean | true | 是否启用错误监控 |
| enableBehavior | boolean | true | 是否启用行为监控 |
| enableConsole | boolean | false | 是否启用控制台监控 |
| customReport | object | - | 自定义上报数据 |

## API

### Pandeye.getInstance(options)

获取监控实例，使用单例模式确保只有一个实例。

### monitor.start()

手动开始监控（默认自动开始）。

### monitor.stop()

停止监控。

### monitor.trackEvent(eventName, data)

记录自定义事件（会被作为行为数据缓存，随其他监控数据一起上报）。

### monitor.report(data)

主动上报单条数据（立即上报到服务器）。
参数格式：
```typescript
interface ManualReportData {
  event: string;      // 事件名称
  category?: string;  // 事件类别
  label?: string;     // 事件标签
  value?: number;     // 事件值
  extra?: Record<string, any>; // 额外数据
}
```

### monitor.batchReport(dataList)

主动批量上报多条数据（立即上报到服务器）。
参数为ManualReportData数组。

### monitor.flush()

手动触发数据上报。

### monitor.getData()

获取当前收集的所有监控数据。

## 数据格式

### 行为数据

```typescript
interface BehaviorInfo {
  type: 'pv' | 'click' | 'route' | 'custom';
  data: any;
  timestamp: number;
}
```

### 性能数据

```typescript
interface PerformanceMetrics {
  loadTime: number;
  domReadyTime: number;
  firstPaintTime: number;
  firstMeaningfulPaintTime: number;
  resources: ResourceMetric[];
}
```

### 错误数据

```typescript
interface ErrorInfo {
  type: 'js' | 'promise' | 'resource' | 'api';
  message: string;
  stack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  timestamp: number;
}
```

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 运行测试
npm test

# 代码格式化
npm run format

# 代码检查
npm run lint
```

## License

MIT License
