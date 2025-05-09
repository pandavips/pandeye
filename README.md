# Pandeye

🐼 一个轻量级且功能强大的 Web 监控 SDK

## 简介

Pandeye 是一个专注于 Web 应用监控的 JavaScript SDK，它就像一只警觉的熊猫眼睛，时刻守护着你的 Web 应用。

## 功能特性

- 🔄 性能监控
  - 页面加载性能
  - 资源加载性能
  - API 请求性能

- 🐞 错误监控
  - JavaScript 异常
  - Promise 异常
  - 资源加载错误
  - API 请求错误

- 👀 用户行为监控
  - PV/UV 统计
  - 用户点击行为
  - 路由变化
  - 用户停留时间

- 💡 其他特性
  - 自动收集
  - 轻量级
  - 可配置
  - 可扩展

## 安装

```bash
npm install pandeye
# 或
yarn add pandeye
# 或
pnpm add pandeye
```

## 使用

```javascript
import Pandeye from 'pandeye';

// 初始化
const monitor = new Pandeye({
  appId: 'your-app-id',
  // 其他配置项
});

// 开始监控
monitor.start();
```

## License

MIT
