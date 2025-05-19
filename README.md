# Pandeye

🐼(熊猫之眼) 一个轻量级、高性能的前端监控 SDK

[![npm version](https://img.shields.io/badge/npm-v0.1.0-blue)](https://www.npmjs.com/package/pandeye)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/pandavips/pandeye/pulls)

## 简介

Pandeye(熊猫之眼) 是一个为现代 Web 应用设计的监控 SDK。它提供了全面的前端监控能力，包括性能监控、错误捕获、用户行为分析等功能，帮助开发者全方位了解应用的运行状态。

## 核心功能

### 错误监控 (error.ts)

- JS 运行时错误捕获
- Promise 未处理异常监控
- 资源加载失败监控

### (TODO...)性能监控 (performance.ts)

- 页面加载性能指标采集
  - FP、FCP、LCP 等核心指标
  - 资源加载耗时
- 页面性能分析
- 性能数据统计

### 网络监控 (network.ts)

- Ajax/Fetch 请求监控
- 请求错误追踪

### (TODO...)用户行为监控 (behavior.ts)

- 用户点击行为追踪
- 页面访问路径记录
- 行为数据分析

### 控制台监控 (console.ts)

- 控制台日志采集
- 错误日志监控
- 日志分类统计

### (TODO...)用户行为录制 (record.ts)

- 用户操作录制
- 问题复现支持
- 操作回放分析

## 安装

```bash
# 使用 npm
ni pandeye

# 使用 pnpm
pnpm add pandeye

# 使用 yarn
yarn add pandeye
```

## 快速开始

```typescript
import Pandeye from 'pandeye';

const monitor = new Pandeye({
  reportConfig: {
    // 环境标识
    environment: 'dev',
    // 应用标识
    appId: 'app-2',
    // 上报地址
    reportUrl: 'http://localhost:3000/pandeye/report',
    // 加密公钥(需要自己生成一对公钥私钥,你可以使用根目录generateKey.mjs生成一对)
    // 这里使用的是一个示例公钥，请替换为你自己的公钥
    publicKey: `MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkt13cQFG908N8cp7MJQJ
IRiTgu9CJgNJE4e+cw8gwz+4g933STQjOCzEmvuHCTp5dYDTuzITPxrADP40kUmA
asUBbX4wv/6gEaXDyit6JtFlsByivSN1TfMLkst4HzyEb+Fb+D8Mov/0D4Xzx65/
CTQwfQIfQ/GTwEO86hdSKc9rZ1Tr2oDdQMyFW2bZjmILF1ftJJlUs0IXs3OEqrZm
47zF1XXhzIHARHukD5+F+L7zrc22EneTF45Xjaqm5qPRgqvD7abqQzK8Bsn/hnAf
UAZmMQm6su0Mekk8B62WMdTB5Hh6OHyGO1JLPJ3kLiBVAn/Ab0pBXLfAWtgQRU/E
MwIDAQAB`,
    // 上报失败重试次数(指数退避)
    maxRetries: 3,
    // 批量发送时的数据满足条数
    batchSize: 10,
    // 开启自动刷新上报(即使满足条数也会定时上报)
    autoFlushInterval: 1000,
    // 页面卸载时上报
    flushBeforeUnload: true,
    // 数据传输具体实现
    transport: Transport,
  },
  // 自动开始
  autoStart: true,
  // 开启性能监控
  enablePerformance: true,
  // 开启错误监控
  enableError: true,
  // 开启行为监控
  enableBehavior: true,
  // 开启控制台监控
  enableConsole: true,
  // 开启网络监控
  enableNetwork: true,
  // 开启用户行为录制
  enableRecord: true,
});

// 启动监控
monitor.start();
```

## 自定义埋点上报

```typescript
monitor.reporter.report({
  type: 'custom-type',
  payload: {
    message: 'Custom report message',
    data: {
      key: 'value',
    },
  },
});
```

## 需要自行实现服务端保存数据

需要一个服务来接受上报的数据,这里并不限制你怎么去实现,总之只是一个保存数据的地方.

## 审查前端简易实现

这个仓库是一个审查端的简易实现,你可以参考:
[pandeye-view](https://github.com/pandavips/pandeye-view)

## License

[MIT](LICENSE)
