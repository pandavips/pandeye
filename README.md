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
  environment: "dev",
  // 应用标识
  appId: "app-2",
  // 上报地址
  reportUrl: "http://localhost:3000/pandeye/report",
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
  type: "custom-type",
  payload: {
    message: "Custom report message",
    data: {
      key: "value",
    },
  },
});
```

## 需要自行实现服务端保存数据
服务端可以是任意实现,只是一个保存数据的地方,具体看你实现.

## 审查前端简易实现
以下是一个react-jsx的实现,你可以根据需要修改
```typescript
import type { TableProps } from "antd";
import ReactJson from "react-json-view";
import { type FC, type CSSProperties, useState, useEffect } from "react";
import {
  Button,
  Col,
  Form,
  Input,
  Row,
  theme,
  Space,
  Table,
  Modal,
  Divider,
  message,
} from "antd";

interface DataType {
  id: string;
  type: string;
  createdAt: string;
  appId: string;
  reportId: string;
  payload:
    | {
        chunk: string;
        index: number;
        total: number;
      }[]
    | object;
}

/**
 * 将Base64字符串转换为Uint8Array
 */
function base64ToUint8Array(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 解密数据
 * @param {string[]} encryptedChunks - 加密的数据块数组
 * @param {string} privateKeyBase64 - Base64格式的PKCS8私钥
 * @returns {Promise<string>} 解密后的数据
 */
async function decrypt(encryptedChunks: string[], privateKeyBase64: string) {
  // 导入私钥
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    base64ToUint8Array(privateKeyBase64),
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    false,
    ["decrypt"]
  );

  // 解密所有数据块
  const decoder = new TextDecoder();
  let decryptedData = new Uint8Array();

  for (const chunk of encryptedChunks) {
    const decryptedChunk = await crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      base64ToUint8Array(chunk)
    );

    // 合并解密后的数据块
    const newData = new Uint8Array(
      decryptedData.length + decryptedChunk.byteLength
    );
    newData.set(decryptedData);
    newData.set(new Uint8Array(decryptedChunk), decryptedData.length);
    decryptedData = newData;
  }

  return decoder.decode(decryptedData);
}

const App: FC = () => {
  const { token } = theme.useToken();
  const [form] = Form.useForm();

  const formStyle: CSSProperties = {
    maxWidth: "none",
    background: token.colorFillAlter,
    borderRadius: token.borderRadiusLG,
    padding: 24,
  };

  const getFields = () => {
    return [
      <Col key="appId" span={6}>
        <Form.Item name="appId" label="AppId">
          <Input placeholder="请输入应用标识" />
        </Form.Item>
      </Col>,
      <Col key="type" span={6}>
        <Form.Item name="type" label="Log Type">
          <Input placeholder="请输入日志类型" />
        </Form.Item>
      </Col>,
      <Col key="environment" span={6}>
        <Form.Item name="environment" label="environment">
          <Input placeholder="请输入环境标识" />
        </Form.Item>
      </Col>,
      <Col key="reportId" span={6}>
        <Form.Item name="reportId" label="ReportId">
          <Input placeholder="请输入报告标识" />
        </Form.Item>
      </Col>,
    ];
  };

  const onFinish = () => {
    fetchData();
  };

  const [selectedData, setSelectedData] = useState<DataType | null>(null);
  const columns: TableProps<DataType>["columns"] = [
    {
      title: "RowHead",
      dataIndex: "key",
      rowScope: "row",
    },
    {
      title: "AppId",
      dataIndex: "appId",
      key: "appId",
    },
    {
      title: "CreatedAt",
      dataIndex: "createdAt",
      key: "createdAt",
    },
    {
      title: "ReportId",
      dataIndex: "reportId",
      key: "reportId",
    },
    {
      title: "LogType",
      dataIndex: "type",
      key: "type",
    },
    {
      title: "environment",
      dataIndex: "environment",
      key: "environment",
    },
    {
      fixed: "right",
      title: "Payload",
      dataIndex: "payload",
      key: "payload",
      render: (_: string, record: DataType) => (
        <>
          <Button
            type="link"
            onClick={() => {
              setSelectedData({
                ...record,
              });
              setOpenResponsive(true);
            }}
          >
            查看
          </Button>
        </>
      ),
    },
  ];
  const [data, setData] = useState<DataType[]>([]);
  const onChange = (page: number, pageSize: number) => {
    setPagination({
      ...pagination,
      current: page,
      pageSize,
    });
  };
  const onShowSizeChange = (current: number, size: number) => {
    setPagination({
      ...pagination,
      current,
      pageSize: size,
    });
  };
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 100,
    total: 0,
    onChange,
    onShowSizeChange,
  });
  const [loading, setLoading] = useState(false);
  const fetchData = () => {
    setLoading(true);
    fetch("http://localhost:3000/pandeye/listByPage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        page: pagination.current,
        limit: pagination.pageSize,
        appId: form.getFieldValue("appId"),
        type: form.getFieldValue("type"),
        reportId: form.getFieldValue("reportId"),
      }),
    })
      .then((res) => res.json())
      .then((res) => {
        setPagination({
          ...pagination,
          total: res.totalCount,
        });
        setData(
          res.list.map((r: DataType) => ({
            ...r,
            key: r.id,
          }))
        );
      })
      .finally(() => {
        setLoading(false);
      });
  };
  useEffect(() => {
    fetchData();
  }, [pagination.pageSize, pagination.current]);

  const [openResponsive, setOpenResponsive] = useState(false);

  const [privateKey, setPrivateKey] = useState<string>(
    sessionStorage.getItem("privateKey") || ""
  );
  useEffect(() => {
    sessionStorage.setItem("privateKey", privateKey);
  }, [privateKey]);

  const okHandle = () => {
    if (!privateKey) {
      return message.error({
        content: "私钥不能为空",
      });
    }
    decryptText();
  };
  // 解密
  const decryptText = async () => {
    const { payload } = selectedData || {};
    if (!payload) {
      return message.error({
        content: "没有数据",
      });
    }
    if (typeof payload !== "string") {
      return message.error({
        content: "数据格式错误或已经解密",
      });
    }

    const chunks = JSON.parse(payload).map(
      (c: { chunk: string; index: number; total: number }) => c.chunk
    );

    const decryptedText = await decrypt(chunks, privateKey);
    if (selectedData) {
      setSelectedData({
        ...selectedData,
        payload: JSON.parse(decryptedText),
      });
    }
  };

  return (
    <div>
      <Form
        form={form}
        name="advanced_search"
        style={formStyle}
        onFinish={onFinish}
      >
        <Row gutter={24}>{getFields()}</Row>
        <div style={{ textAlign: "right" }}>
          <Space size="small">
            <Button loading={loading} type="primary" htmlType="submit">
              Search
            </Button>
            <Button
              onClick={() => {
                form.resetFields();
              }}
            >
              Clear
            </Button>
          </Space>
        </div>
      </Form>
      <Table<DataType>
        loading={loading}
        key="table"
        columns={columns}
        dataSource={data}
        pagination={pagination}
      />

      <Modal
        title="审查数据"
        centered
        open={openResponsive}
        cancelText="取消"
        onCancel={() => setOpenResponsive(false)}
        okText="解密"
        onOk={() => {
          okHandle();
        }}
        style={{
          wordBreak: "break-all",
        }}
        width={{
          xs: "90%",
          sm: "80%",
          md: "70%",
          lg: "60%",
          xl: "50%",
          xxl: "40%",
        }}
      >
        <ReactJson src={selectedData!} />
        <Divider />
        <Input
          placeholder="请输入私钥"
          value={privateKey}
          onChange={(e) => setPrivateKey(e.target.value)}
        />
      </Modal>
    </div>
  );
};
export default App;
```
## License

[MIT](LICENSE)
