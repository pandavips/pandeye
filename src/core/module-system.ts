/**
 * PandEye核心模块系统
 * 提供现代化的模块加载、依赖注入和生命周期管理
 */

type ModuleConstructor<T> = new (...args: any[]) => T;

/**
 * 模块接口
 * 所有PandEye模块必须实现这个接口
 */
export interface Module {
  /**
   * 模块名称，用于标识和依赖注入
   */
  readonly name: string;

  /**
   * 模块版本
   */
  readonly version: string;

  /**
   * 模块初始化
   */
  init?(): Promise<void>;

  /**
   * 启动模块
   */
  start?(): Promise<void>;

  /**
   * 停止模块
   */
  stop?(): Promise<void>;

  /**
   * 销毁模块，释放资源
   */
  destroy?(): Promise<void>;
}

/**
 * 模块定义
 */
export interface ModuleDefinition<T extends Module = Module> {
  /**
   * 模块类型
   */
  moduleType: ModuleConstructor<T>;

  /**
   * 模块依赖
   */
  dependencies?: string[];

  /**
   * 模块配置
   */
  config?: Record<string, any>;

  /**
   * 是否为单例模式
   */
  singleton?: boolean;

  /**
   * 模块优先级（越小越先加载）
   */
  priority?: number;
}

/**
 * 依赖错误
 */
export class DependencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DependencyError';
  }
}

/**
 * 模块容器
 * 负责模块的注册、初始化、依赖管理和生命周期
 */
export class ModuleContainer {
  private moduleDefinitions: Map<string, ModuleDefinition> = new Map();
  private moduleInstances: Map<string, Module> = new Map();
  private initializePromises: Map<string, Promise<void>> = new Map();

  /**
   * 注册模块
   * @param moduleName 模块名称
   * @param definition 模块定义
   */
  public register<T extends Module>(moduleName: string, definition: ModuleDefinition<T>): void {
    if (this.moduleDefinitions.has(moduleName)) {
      throw new Error(`Module ${moduleName} is already registered`);
    }

    this.moduleDefinitions.set(moduleName, {
      ...definition,
      singleton: definition.singleton !== false, // 默认为单例
      priority: definition.priority || 0,
    });
  }

  /**
   * 获取模块实例
   * 如果模块尚未初始化，会自动初始化模块及其依赖
   *
   * @param moduleName 模块名称
   * @param config 可选的配置覆盖
   */
  public async get<T extends Module>(moduleName: string, config?: Record<string, any>): Promise<T> {
    // 检查模块是否已注册
    if (!this.moduleDefinitions.has(moduleName)) {
      throw new Error(`Module ${moduleName} is not registered`);
    }

    // 如果已经有实例并且是单例，直接返回
    if (this.moduleInstances.has(moduleName)) {
      const definition = this.moduleDefinitions.get(moduleName)!;
      if (definition.singleton) {
        return this.moduleInstances.get(moduleName) as T;
      }
    }

    // 如果正在初始化中，等待初始化完成
    if (this.initializePromises.has(moduleName)) {
      await this.initializePromises.get(moduleName);
      return this.moduleInstances.get(moduleName) as T;
    }

    // 初始化模块
    const initPromise = this.initializeModule(moduleName, config);
    this.initializePromises.set(moduleName, initPromise);

    try {
      await initPromise;
    } finally {
      this.initializePromises.delete(moduleName);
    }

    return this.moduleInstances.get(moduleName) as T;
  }

  /**
   * 初始化模块
   * @param moduleName 模块名称
   * @param configOverride 配置覆盖
   * @private
   */
  private async initializeModule(
    moduleName: string,
    configOverride?: Record<string, any>
  ): Promise<void> {
    const definition = this.moduleDefinitions.get(moduleName)!;

    // 先初始化依赖
    if (definition.dependencies && definition.dependencies.length > 0) {
      for (const dependency of definition.dependencies) {
        if (!this.moduleDefinitions.has(dependency)) {
          throw new DependencyError(
            `Module ${moduleName} depends on ${dependency}, but it's not registered`
          );
        }

        if (!this.moduleInstances.has(dependency)) {
          await this.get(dependency);
        }
      }
    }

    // 合并配置
    const config = configOverride ? { ...definition.config, ...configOverride } : definition.config;

    // 创建模块实例
    const dependencies = definition.dependencies?.map(dep => this.moduleInstances.get(dep)) || [];
    const moduleInstance = new definition.moduleType(config, ...dependencies);

    // 保存实例
    this.moduleInstances.set(moduleName, moduleInstance);

    // 初始化模块
    if (typeof moduleInstance.init === 'function') {
      await moduleInstance.init();
    }

    return;
  }

  /**
   * 启动所有模块
   */
  public async startAll(): Promise<void> {
    // 按优先级排序
    const sortedModules = Array.from(this.moduleDefinitions.entries())
      .sort(([, defA], [, defB]) => defA.priority! - defB.priority!)
      .map(([name]) => name);

    // 初始化并启动所有模块
    for (const moduleName of sortedModules) {
      const module = await this.get(moduleName);

      if (typeof module.start === 'function') {
        await module.start();
      }
    }
  }

  /**
   * 停止所有模块
   */
  public async stopAll(): Promise<void> {
    // 按优先级反序停止
    const sortedModules = Array.from(this.moduleDefinitions.entries())
      .sort(([, defA], [, defB]) => defB.priority! - defA.priority!) // 注意这里是反序
      .map(([name]) => name);

    for (const moduleName of sortedModules) {
      if (this.moduleInstances.has(moduleName)) {
        const module = this.moduleInstances.get(moduleName)!;

        if (typeof module.stop === 'function') {
          await module.stop();
        }
      }
    }
  }

  /**
   * 销毁所有模块
   */
  public async destroyAll(): Promise<void> {
    // 按优先级反序销毁
    const sortedModules = Array.from(this.moduleDefinitions.entries())
      .sort(([, defA], [, defB]) => defB.priority! - defA.priority!) // 注意这里是反序
      .map(([name]) => name);

    for (const moduleName of sortedModules) {
      if (this.moduleInstances.has(moduleName)) {
        const module = this.moduleInstances.get(moduleName)!;

        if (typeof module.destroy === 'function') {
          await module.destroy();
        }
      }
    }

    this.moduleInstances.clear();
  }

  /**
   * 检查模块是否已经注册
   */
  public hasModule(moduleName: string): boolean {
    return this.moduleDefinitions.has(moduleName);
  }

  /**
   * 获取模块定义
   */
  public getDefinition(moduleName: string): ModuleDefinition | undefined {
    return this.moduleDefinitions.get(moduleName);
  }
}

/**
 * 全局模块容器实例
 */
export const container = new ModuleContainer();
