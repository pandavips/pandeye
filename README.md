# Pandeye

一个轻量级且功能强大的前端监控SDK，支持行为、性能、错误追踪等多种监控能力，并提供AI驱动的分析功能。

## 特性

- 🔍 全面的监控能力

  - 用户行为监控（PV、点击、路由变化等）
  - 性能监控（页面加载、资源加载、Web Vitals指标等）
  - 错误监控（JS异常、Promise异常、资源加载错误、API错误）
  - 控制台日志监控
  - 用户旅程追踪与UX分析

- 💪 强大的扩展性

  - 支持自定义事件上报
  - 灵活的数据上报配置
  - 完整的TypeScript类型支持
  - 支持Vue/React/Angular框架集成
  - 插件系统易于扩展

- 🤖 AI驱动分析
  - 错误智能分类与根因分析
  - 异常检测与预警
  - 性能趋势可视化
  - 用户行为模式识别
- 🚀 高性能
  - 批量数据上报
  - 支持数据压缩
  - 智能队列管理
  - 轻量精简版选项

## 安装

```bash
npm install pandeye
# or
yarn add pandeye
```

## 快速开始

### 标准版本

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
  enableConsole: false,
});

// 手动上报自定义事件（将作为行为数据记录）
monitor.trackEvent('button_click', {
  buttonId: 'submit-button',
  page: 'home',
});

// 主动上报数据（立即上报，不会被缓存）
monitor.report({
  event: 'purchase',
  category: 'order',
  label: 'product_1',
  value: 99.9,
  extra: {
    orderId: '12345',
    payMethod: 'alipay',
  },
});

// 主动批量上报数据
monitor.batchReport([
  {
    event: 'add_to_cart',
    category: 'shopping',
    label: 'product_1',
  },
  {
    event: 'view_item',
    category: 'product',
    label: 'product_2',
  },
]);

// 手动触发缓存数据上报
monitor.flush();
```

### 轻量版本

对于资源受限的场景，可以使用更小体积的精简版：

```typescript
import PandeyeSlim from 'pandeye/slim';

// 初始化精简监控实例
const monitor = PandeyeSlim.getInstance({
  appId: 'your-app-id',
  env: 'prod',
  reportUrl: 'your-report-url',
});

// 上报自定义事件
monitor.reportCustom('page_view', {
  page: '/home',
});

// 手动上报错误
try {
  // 业务代码
} catch (error) {
  monitor.reportError(error);
}
```

## 配置选项

| 选项              | 类型                                      | 默认值         | 说明               |
| ----------------- | ----------------------------------------- | -------------- | ------------------ |
| appId             | string                                    | -              | 必填，应用唯一标识 |
| env               | string                                    | 'prod'         | 运行环境标识       |
| reportUrl         | string                                    | -              | 数据上报地址       |
| reportTime        | 'immediately' \| 'beforeunload' \| number | 'beforeunload' | 数据上报时机       |
| autoStart         | boolean                                   | true           | 是否自动开始监控   |
| enablePerformance | boolean                                   | true           | 是否启用性能监控   |
| enableError       | boolean                                   | true           | 是否启用错误监控   |
| enableBehavior    | boolean                                   | true           | 是否启用行为监控   |
| enableConsole     | boolean                                   | false          | 是否启用控制台监控 |
| customReport      | object                                    | -              | 自定义上报数据     |
| plugins           | PandeyePlugin[]                           | []             | 要注册的插件列表   |
| transport         | TransportConfig                           | -              | 数据传输相关配置   |
| privacy           | PrivacyConfig                             | -              | 隐私保护相关配置   |
| sampling          | SamplingConfig                            | -              | 采样率相关配置     |

## API

### 核心API

#### Pandeye.getInstance(options)

获取监控实例，使用单例模式确保只有一个实例。

#### monitor.start()

手动开始监控（默认自动开始）。

#### monitor.stop()

停止监控。

#### monitor.trackEvent(eventName, data)

记录自定义事件（会被作为行为数据缓存，随其他监控数据一起上报）。

#### monitor.report(data)

主动上报单条数据（立即上报到服务器）。
参数格式：

```typescript
interface ManualReportData {
  event: string; // 事件名称
  category?: string; // 事件类别
  label?: string; // 事件标签
  value?: number; // 事件值
  extra?: Record<string, any>; // 额外数据
}
```

#### monitor.batchReport(dataList)

主动批量上报多条数据（立即上报到服务器）。
参数为ManualReportData数组。

#### monitor.flush()

手动触发数据上报。

#### monitor.getData()

获取当前收集的所有监控数据。

#### monitor.getVersion()

获取SDK的版本号。

#### monitor.getConfig()

获取当前的配置选项。

### 框架集成API

#### Vue集成

```typescript
// Vue 3
import { createApp } from 'vue';
import { Pandeye } from 'pandeye';
import { PandeyePlugin } from 'pandeye/plugins/vue';

const app = createApp(App);
const monitor = Pandeye.getInstance({
  appId: 'your-app-id',
  env: 'dev',
});

// 作为插件安装
app.use(PandeyePlugin, monitor);

// 在组件中使用
export default {
  setup() {
    const { trackEvent } = usePandeye();

    // 在合适的时机记录事件
    trackEvent('component_loaded', { component: 'Home' });
  },
};
```

#### React集成

```typescript
// 在应用入口点初始化
import { Pandeye } from 'pandeye';
import { PandeyeProvider, ErrorBoundary } from 'pandeye/plugins/react';

const monitor = Pandeye.getInstance({
  appId: 'your-app-id',
  env: 'dev'
});

// 包裹应用根组件
const App = () => (
  <PandeyeProvider monitor={monitor}>
    <ErrorBoundary fallback={<ErrorPage />}>
      <YourApp />
    </ErrorBoundary>
  </PandeyeProvider>
);

// 在组件中使用
import { usePandeye } from 'pandeye/plugins/react';

function UserProfile() {
  const { trackEvent } = usePandeye();

  useEffect(() => {
    trackEvent('profile_viewed');

    // 性能监控
    return () => trackEvent('profile_unloaded');
  }, []);
}
```

#### Angular集成

```typescript
// 在模块中导入
import { NgModule } from '@angular/core';
import { Pandeye } from 'pandeye';
import { PandeyeModule } from 'pandeye/plugins/angular';

const monitor = Pandeye.getInstance({
  appId: 'your-app-id',
  env: 'dev',
});

@NgModule({
  imports: [PandeyeModule.forRoot(monitor)],
})
export class AppModule {}

// 在组件中使用
import { Component } from '@angular/core';
import { PandeyeService } from 'pandeye/plugins/angular';

@Component({
  selector: 'app-root',
  template: '...',
})
export class AppComponent {
  constructor(private pandeye: PandeyeService) {
    this.pandeye.trackEvent('app_initialized');
  }
}
```

### 高级API

#### AI分析API

```typescript
import { Pandeye } from 'pandeye';
import { ErrorInsightEngine } from 'pandeye/analytics';

const monitor = Pandeye.getInstance({
  appId: 'your-app-id',
});

// 获取错误分析结果
monitor
  .getAnalytics()
  .analyze(errorData)
  .then(insights => {
    console.log('根本原因:', insights.rootCause);
    console.log('建议解决方案:', insights.potentialSolutions);
  });

// 设置异常检测回调
monitor.getAnalytics().onAnomaly(anomaly => {
  console.log('检测到异常:', anomaly);
});
```

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
  // Core Web Vitals
  largestContentfulPaint?: number; // LCP
  firstInputDelay?: number; // FID
  cumulativeLayoutShift?: number; // CLS
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

## 最佳实践

### 性能监控

推荐根据不同的应用类型设置性能监控的阈值：

```typescript
const monitor = Pandeye.getInstance({
  appId: 'your-app-id',
  env: 'prod',
  performanceConfig: {
    // 针对SPA设置性能监控阈值
    thresholds: {
      fcp: 1800, // 首次内容绘制（毫秒）
      lcp: 2500, // 最大内容绘制（毫秒）
      fid: 100, // 首次输入延迟（毫秒）
      cls: 0.1, // 累计布局偏移
      ttfb: 800, // 首字节时间（毫秒）
    },
    // 需要监控的资源类型
    resources: ['script', 'img', 'css', 'fetch', 'xmlhttprequest'],
  },
});
```

### 错误监控

自定义错误处理和过滤：

```typescript
import { Pandeye } from 'pandeye';

const monitor = Pandeye.getInstance({
  appId: 'your-app-id',
  env: 'prod',
  errorConfig: {
    // 自定义错误过滤器
    errorFilter: error => {
      // 忽略特定类型的错误
      if (error.message.includes('Script error')) {
        return false;
      }
      // 忽略第三方脚本错误
      if (error.filename && error.filename.includes('third-party.com')) {
        return false;
      }
      return true;
    },
    // 处理未捕获的Promise错误
    enableUnhandledRejection: true,
    // 处理控制台错误
    consoleErrorLevel: ['error', 'warn'],
  },
});
```

### 高流量应用采样

大流量应用建议使用数据采样减少上报量：

```typescript
const monitor = Pandeye.getInstance({
  appId: 'your-app-id',
  env: 'prod',
  sampling: {
    // 10%的行为数据采样
    behavior: 0.1,
    // 100%的错误数据采样
    error: 1,
    // 5%的性能数据采样
    performance: 0.05,
    // 根据用户ID进行一致性采样
    consistentSampling: true,
  },
});
```

### 隐私合规

针对GDPR、CCPA等隐私法规的合规设置：

```typescript
const monitor = Pandeye.getInstance({
  appId: 'your-app-id',
  env: 'prod',
  privacy: {
    // 自动脱敏敏感数据
    maskSensitiveData: true,
    // 需要脱敏的字段
    sensitiveFields: ['password', 'credit_card', 'phone', 'email'],
    // 用户同意后才开始监控
    requireUserConsent: true,
    // 不收集IP地址
    disableIpTracking: true,
    // 匿名化用户ID
    anonymizeUserId: true,
  },
});
```

## 典型使用场景

### SPA应用监控

```typescript
// React SPA入口
import { Pandeye } from 'pandeye';
import { BrowserRouter } from 'react-router-dom';
import { PandeyeProvider } from 'pandeye/plugins/react';

const monitor = Pandeye.getInstance({
  appId: 'your-spa-app',
  enableSPA: true,  // 启用SPA路由监控
  autoTrackHash: true,  // 对hash路由自动跟踪
  autoTrackPageview: true  // 自动记录页面浏览
});

ReactDOM.render(
  <PandeyeProvider monitor={monitor}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </PandeyeProvider>,
  document.getElementById('root')
);
```

### 电子商务转化漏斗分析

```typescript
// 购物车转化漏斗跟踪
import { Pandeye } from 'pandeye';

const monitor = Pandeye.getInstance({
  appId: 'your-ecommerce',
});

// 在不同购买阶段调用
function viewProduct(product) {
  // 业务逻辑...
  monitor.trackEvent('product_view', { productId: product.id });
}

function addToCart(product) {
  // 业务逻辑...
  monitor.trackEvent('add_to_cart', {
    productId: product.id,
    price: product.price,
    currency: 'CNY',
  });
}

function startCheckout(cart) {
  // 业务逻辑...
  monitor.trackEvent('begin_checkout', {
    items: cart.items.length,
    value: cart.totalValue,
  });
}

function completePayment(orderId, value) {
  // 业务逻辑...
  monitor.trackEvent('purchase_complete', {
    orderId,
    value,
    couponUsed: !!cart.coupon,
  });
}
```

### 微前端架构监控

```typescript
// 主应用
import { Pandeye } from 'pandeye';

// 创建全局监控实例
const monitor = Pandeye.getInstance({
  appId: 'micro-frontend-main',
  env: 'prod',
  // 启用子应用监控
  microFrontend: {
    enable: true,
    // 自动为子应用创建隔离上下文
    isolateSubApps: true,
  },
});

// 导出监控实例，供子应用使用
window.globalMonitor = monitor;

// 子应用内
function initSubApp() {
  // 获取主应用的监控实例
  const mainMonitor = window.globalMonitor;

  // 创建子应用监控上下文
  const subMonitor = mainMonitor.createSubAppContext({
    subAppId: 'user-center',
    version: '1.2.0',
  });

  // 在子应用中使用
  subMonitor.trackEvent('sub_app_loaded');
}
```

## 自定义插件开发

你可以开发自定义插件来扩展Pandeye的功能：

```typescript
import { Pandeye } from 'pandeye';

// 创建自定义插件
const myCustomPlugin = {
  // 插件元数据
  name: 'my-custom-plugin',
  version: '1.0.0',
  // 可选依赖
  dependencies: [],

  // 初始化钩子
  init: context => {
    console.log('插件初始化', context);
  },

  // 启动钩子
  start: () => {
    // 在这里添加事件监听器等
    document.addEventListener('custom-event', handleCustomEvent);
  },

  // 停止钩子
  stop: () => {
    // 在这里移除事件监听器等
    document.removeEventListener('custom-event', handleCustomEvent);
  },

  // 销毁钩子
  destroy: () => {
    // 清理资源
  },
};

// 初始化监控实例并注册插件
const monitor = Pandeye.getInstance({
  appId: 'your-app',
  plugins: [myCustomPlugin],
});

// 或者稍后注册插件
monitor.registerPlugin(myCustomPlugin);
```

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 构建精简版
npm run build:slim

# 构建带分析报告的版本
npm run build:analyze

# 运行测试
npm test

# 代码格式化
npm run format

# 代码检查
npm run lint
```

## 浏览器兼容性

Pandeye 支持所有现代浏览器，包括：

- Chrome 60+
- Firefox 60+
- Safari 11+
- Edge 79+
- Opera 47+
- iOS Safari 11+
- Android Browser 76+

对于旧版浏览器（如IE 11），我们提供了兼容性版本（需单独引入compat版本）：

```html
<script src="path/to/pandeye.compat.js"></script>
```

## 常见问题

### 如何解决跨域资源监控问题？

对于跨域脚本错误，需要在资源标签上添加 `crossorigin` 属性并确保服务器返回正确的 CORS 头：

```html
<script src="https://other-domain.com/script.js" crossorigin="anonymous"></script>
<link href="https://other-domain.com/style.css" rel="stylesheet" crossorigin="anonymous" />
<img src="https://other-domain.com/image.png" crossorigin="anonymous" />
```

### 如何避免上报自身的请求？

默认情况下，Pandeye 会自动忽略对上报 URL 的请求监控，但如果你需要手动排除某些请求：

```typescript
const monitor = Pandeye.getInstance({
  appId: 'your-app-id',
  errorConfig: {
    // 忽略特定URL的请求监控
    ignoreUrls: [/analytics\.com/i, /logging\.com/i],
  },
});
```

### 使用 Web Workers 时如何进行监控？

Pandeye 提供了 Web Worker 支持插件：

```typescript
import { Pandeye } from 'pandeye';
import { WorkerPlugin } from 'pandeye/plugins/worker';

const monitor = Pandeye.getInstance({
  appId: 'your-app-id',
  plugins: [WorkerPlugin],
});

// 在 Worker 内部
self.addEventListener('message', e => {
  if (e.data.type === 'pandeye_init') {
    // Worker 会自动初始化监控
  }
});
```

## 贡献指南

我们非常欢迎你的贡献！请参考以下步骤：

1. Fork 项目仓库
2. 创建你的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交你的更改 (`git commit -m 'feat: add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建一个 Pull Request

## 路线图

- [ ] 支持 PWA 和离线应用场景
- [ ] 提供可视化数据分析面板
- [ ] 扩展 React Native 支持
- [ ] 增强 AI 异常根因分析能力
- [ ] 支持服务端渲染应用监控

## 联系方式

有问题或建议？请访问我们的 [GitHub Issues](https://github.com/pandavips/pandeye/issues)。

## License

MIT License
