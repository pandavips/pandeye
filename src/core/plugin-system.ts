/**
 * 插件系统
 * 提供灵活的插件机制，支持第三方扩展
 */

import { PandeyeOptions } from '../types';

export interface PluginContext {
  appId: string;
  version: string;
  env: string;
  options: PandeyeOptions;
  // 允许插件调用的内部API
  api: PluginAPI;
}

export interface PluginAPI {
  reportError: (error: any) => void;
  reportCustom: (eventName: string, data: any) => void;
  getDeviceInfo: () => any;
  getSessionInfo: () => any;
}

export interface PluginLifecycle {
  // 初始化钩子，在SDK初始化时调用
  init?: (context: PluginContext) => void | Promise<void>;

  // 启动钩子，在监控开始时调用
  start?: () => void | Promise<void>;

  // 停止钩子，在监控停止时调用
  stop?: () => void | Promise<void>;

  // 错误收集前钩子，可以修改或丢弃错误
  beforeErrorCapture?: (error: any) => any | false | Promise<any | false>;

  // 错误收集后钩子
  afterErrorCapture?: (error: any) => void | Promise<void>;

  // 性能指标收集后钩子
  afterPerformanceCollect?: (metrics: any) => void | Promise<void>;

  // 数据上报前钩子，可以修改或丢弃上报数据
  beforeDataReport?: (data: any) => any | false | Promise<any | false>;

  // 数据上报后钩子
  afterDataReport?: (data: any, success: boolean) => void | Promise<void>;

  // 销毁钩子，在SDK销毁时调用
  destroy?: () => void | Promise<void>;
}

export interface PandeyePlugin extends PluginLifecycle {
  name: string;
  version: string;
  // 可选的插件依赖
  dependencies?: string[];
}

export class PluginManager {
  private plugins: Map<string, PandeyePlugin> = new Map();
  private context: PluginContext;

  constructor(context: PluginContext) {
    this.context = context;
  }

  /**
   * 注册插件
   * @param plugin 插件对象
   */
  public register(plugin: PandeyePlugin): void {
    // 检查插件是否已注册
    if (this.plugins.has(plugin.name)) {
      console.warn(`[Pandeye] Plugin ${plugin.name} already registered, skipping`);
      return;
    }

    // 检查依赖
    if (plugin.dependencies && plugin.dependencies.length > 0) {
      for (const dep of plugin.dependencies) {
        if (!this.plugins.has(dep)) {
          throw new Error(
            `[Pandeye] Plugin ${plugin.name} depends on ${dep}, but it's not registered`
          );
        }
      }
    }

    // 注册插件
    this.plugins.set(plugin.name, plugin);

    // 执行初始化
    if (plugin.init) {
      try {
        plugin.init(this.context);
      } catch (error) {
        console.error(`[Pandeye] Failed to initialize plugin ${plugin.name}:`, error);
        // 初始化失败的插件将被移除
        this.plugins.delete(plugin.name);
      }
    }
  }

  /**
   * 批量注册插件
   * @param plugins 插件数组
   */
  public registerAll(plugins: PandeyePlugin[]): void {
    // 首先注册没有依赖的插件
    const independent = plugins.filter(p => !p.dependencies || p.dependencies.length === 0);
    independent.forEach(p => this.register(p));

    // 然后尝试注册有依赖的插件，可能需要多次尝试
    let remaining = plugins.filter(p => p.dependencies && p.dependencies.length > 0);
    let lastLength = remaining.length;

    while (remaining.length > 0) {
      // 尝试注册可满足依赖的插件
      remaining = remaining.filter(plugin => {
        if (plugin.dependencies!.every(dep => this.plugins.has(dep))) {
          this.register(plugin);
          return false; // 不保留在剩余列表中
        }
        return true; // 保留在剩余列表中
      });

      // 检测是否陷入死循环（循环依赖）
      if (remaining.length === lastLength) {
        const names = remaining.map(p => p.name).join(', ');
        console.error(
          `[Pandeye] Circular dependencies detected. Failed to register plugins: ${names}`
        );
        break;
      }

      lastLength = remaining.length;
    }
  }

  /**
   * 卸载插件
   * @param name 插件名称
   */
  public unregister(name: string): void {
    const plugin = this.plugins.get(name);
    if (!plugin) return;

    // 检查是否有其他插件依赖此插件
    for (const [pluginName, p] of this.plugins.entries()) {
      if (p.dependencies?.includes(name)) {
        throw new Error(
          `[Pandeye] Cannot unregister plugin ${name}, it's required by ${pluginName}`
        );
      }
    }

    // 执行销毁钩子
    if (plugin.destroy) {
      try {
        plugin.destroy();
      } catch (error) {
        console.error(`[Pandeye] Error while destroying plugin ${name}:`, error);
      }
    }

    // 移除插件
    this.plugins.delete(name);
  }

  /**
   * 获取插件
   * @param name 插件名称
   */
  public getPlugin(name: string): PandeyePlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * 获取所有已注册的插件
   */
  public getPlugins(): PandeyePlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * 检查插件是否已注册
   * @param name 插件名称
   */
  public hasPlugin(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * 执行生命周期钩子
   * @param hookName 钩子名称
   * @param args 钩子参数
   */
  public async executeHook<T>(hookName: keyof PluginLifecycle, args?: any): Promise<T | undefined> {
    let result = args;

    // 按注册顺序执行钩子
    for (const plugin of this.plugins.values()) {
      const hook = plugin[hookName];
      if (typeof hook === 'function') {
        try {
          // 根据钩子类型调用函数
          let hookResult;

          // 一些类型断言以帮助TypeScript理解我们的代码
          type AnyFunction = (...args: any[]) => any;
          const typedHook = hook as AnyFunction;

          // 处理不同钩子的参数要求
          switch (hookName) {
            case 'init':
              // init钩子需要一个PluginContext参数
              hookResult = await typedHook(result as PluginContext);
              break;
            case 'afterDataReport':
              // afterDataReport钩子需要两个参数：data 和 success
              if (Array.isArray(result) && result.length >= 2) {
                hookResult = await typedHook(result[0], result[1]);
              } else {
                hookResult = await typedHook(result, true);
              }
              break;
            case 'start':
            case 'stop':
            case 'destroy':
              // 这些钩子不需要参数
              hookResult = await typedHook();
              break;
            case 'beforeErrorCapture':
            case 'afterErrorCapture':
            case 'afterPerformanceCollect':
            case 'beforeDataReport':
            default:
              // 这些钩子都需要一个参数
              hookResult = await typedHook(result);
          }

          // 特殊处理可以拦截流程的钩子
          if (hookName === 'beforeErrorCapture' || hookName === 'beforeDataReport') {
            if (hookResult === false) {
              return undefined; // 中断流程
            }
            result = hookResult || result; // 更新结果
          }
        } catch (error) {
          console.error(`[Pandeye] Error executing ${hookName} in plugin ${plugin.name}:`, error);
        }
      }
    }

    return result as T;
  }

  /**
   * 启动所有插件
   */
  public async startAll(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.start) {
        try {
          await plugin.start();
        } catch (error) {
          console.error(`[Pandeye] Failed to start plugin ${plugin.name}:`, error);
        }
      }
    }
  }

  /**
   * 停止所有插件
   */
  public async stopAll(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.stop) {
        try {
          await plugin.stop();
        } catch (error) {
          console.error(`[Pandeye] Failed to stop plugin ${plugin.name}:`, error);
        }
      }
    }
  }

  /**
   * 销毁所有插件
   */
  public async destroyAll(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.destroy) {
        try {
          await plugin.destroy();
        } catch (error) {
          console.error(`[Pandeye] Failed to destroy plugin ${plugin.name}:`, error);
        }
      }
    }

    this.plugins.clear();
  }
}
