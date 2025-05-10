/**
 * 可视化仪表盘组件
 * 提供前端监控数据的图表展示和分析功能
 */

/**
 * 可视化图表类型
 */
export enum ChartType {
  LINE = 'line',
  BAR = 'bar',
  PIE = 'pie',
  AREA = 'area',
  SCATTER = 'scatter',
  GAUGE = 'gauge',
  HEATMAP = 'heatmap',
  TABLE = 'table',
  NUMBER = 'number',
  FUNNEL = 'funnel',
}

/**
 * 时间粒度
 */
export enum TimeGranularity {
  SECOND = 'second',
  MINUTE = 'minute',
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

/**
 * 图表尺寸
 */
export enum WidgetSize {
  SMALL = 'small', // 1x1
  MEDIUM = 'medium', // 2x1
  LARGE = 'large', // 2x2
  WIDE = 'wide', // 4x1
  FULL = 'full', // 4x2
}

/**
 * 数据过滤条件
 */
export interface DataFilter {
  field: string;
  operator: '==' | '!=' | '>' | '>=' | '<' | '<=' | 'contains' | 'starts_with' | 'ends_with';
  value: any;
}

/**
 * 图表配置接口
 */
export interface ChartConfig {
  id: string;
  title: string;
  description?: string;
  type: ChartType;
  dataSource: string;
  size?: WidgetSize;
  filters?: DataFilter[];
  metrics?: string[];
  dimensions?: string[];
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  limit?: number;
  timeField?: string;
  timeGranularity?: TimeGranularity;
  colorScheme?: string;
  format?: string;
  baseline?: number;
  goal?: number;
  visualization?: any; // 特定图表类型的额外配置
}

/**
 * 仪表盘配置
 */
export interface DashboardConfig {
  id: string;
  title: string;
  description?: string;
  charts: ChartConfig[];
  layout?: any; // 布局信息
  timeRange?: {
    start: Date | number | string;
    end: Date | number | string;
  };
  refreshInterval?: number; // 刷新间隔，单位秒
  filters?: DataFilter[]; // 全局过滤条件
}

/**
 * 可视化组件接口
 * 定义了仪表盘可视化组件需要实现的方法
 */
export interface VisualizationRenderer {
  /**
   * 渲染图表
   * @param container 容器元素
   * @param config 图表配置
   * @param data 数据
   */
  render(container: HTMLElement, config: ChartConfig, data: any[]): void;

  /**
   * 更新图表数据
   * @param container 容器元素
   * @param data 新数据
   */
  update(container: HTMLElement, data: any[]): void;

  /**
   * 销毁图表
   * @param container 容器元素
   */
  destroy(container: HTMLElement): void;
}

/**
 * 数据转换器接口
 * 定义了如何将原始数据转换为可视化组件所需格式
 */
export interface DataTransformer {
  /**
   * 转换数据
   * @param rawData 原始数据
   * @param config 图表配置
   * @returns 转换后的数据
   */
  transform(rawData: any[], config: ChartConfig): any[];
}

/**
 * 仪表盘服务
 * 管理可视化仪表盘的创建、更新和渲染
 */
export class DashboardService {
  private dashboards: Map<string, DashboardConfig> = new Map();
  private renderers: Map<ChartType, VisualizationRenderer> = new Map();
  private transformers: Map<string, DataTransformer> = new Map();
  private dataProviders: Map<string, () => Promise<any[]>> = new Map();
  private refreshTimers: Map<string, number> = new Map();

  /**
   * 注册可视化渲染器
   * @param type 图表类型
   * @param renderer 渲染器实现
   */
  public registerRenderer(type: ChartType, renderer: VisualizationRenderer): void {
    this.renderers.set(type, renderer);
  }

  /**
   * 注册数据转换器
   * @param name 转换器名称
   * @param transformer 转换器实现
   */
  public registerTransformer(name: string, transformer: DataTransformer): void {
    this.transformers.set(name, transformer);
  }

  /**
   * 注册数据提供者
   * @param name 数据源名称
   * @param provider 数据提供函数
   */
  public registerDataProvider(name: string, provider: () => Promise<any[]>): void {
    this.dataProviders.set(name, provider);
  }

  /**
   * 创建仪表盘
   * @param config 仪表盘配置
   * @returns 仪表盘ID
   */
  public createDashboard(config: DashboardConfig): string {
    if (!config.id) {
      config.id = `dashboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    this.dashboards.set(config.id, config);
    return config.id;
  }

  /**
   * 更新仪表盘配置
   * @param id 仪表盘ID
   * @param config 仪表盘配置
   */
  public updateDashboard(id: string, config: Partial<DashboardConfig>): boolean {
    const dashboard = this.dashboards.get(id);
    if (!dashboard) {
      return false;
    }

    this.dashboards.set(id, { ...dashboard, ...config });
    return true;
  }

  /**
   * 删除仪表盘
   * @param id 仪表盘ID
   */
  public deleteDashboard(id: string): boolean {
    // 停止自动刷新
    this.stopDashboardRefresh(id);
    return this.dashboards.delete(id);
  }

  /**
   * 获取仪表盘配置
   * @param id 仪表盘ID
   */
  public getDashboard(id: string): DashboardConfig | undefined {
    return this.dashboards.get(id);
  }

  /**
   * 获取所有仪表盘
   */
  public getAllDashboards(): DashboardConfig[] {
    return Array.from(this.dashboards.values());
  }

  /**
   * 渲染仪表盘
   * @param containerId 容器元素ID
   * @param dashboardId 仪表盘ID
   */
  public async renderDashboard(containerId: string, dashboardId: string): Promise<boolean> {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container element with ID ${containerId} not found`);
      return false;
    }

    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      console.error(`Dashboard with ID ${dashboardId} not found`);
      return false;
    }

    // 清空容器
    container.innerHTML = '';

    // 创建仪表盘标题
    const titleEl = document.createElement('h2');
    titleEl.className = 'pd-dashboard-title';
    titleEl.textContent = dashboard.title;
    container.appendChild(titleEl);

    if (dashboard.description) {
      const descEl = document.createElement('p');
      descEl.className = 'pd-dashboard-description';
      descEl.textContent = dashboard.description;
      container.appendChild(descEl);
    }

    // 创建图表容器
    const chartsContainer = document.createElement('div');
    chartsContainer.className = 'pd-charts-container';
    container.appendChild(chartsContainer);

    // 渲染每个图表
    for (const chartConfig of dashboard.charts) {
      await this.renderChart(chartsContainer, chartConfig, dashboard.filters || []);
    }

    // 设置自动刷新
    this.setupDashboardRefresh(dashboardId);

    return true;
  }

  /**
   * 渲染单个图表
   * @param container 容器元素
   * @param config 图表配置
   * @param filters 全局过滤条件
   */
  private async renderChart(
    container: HTMLElement,
    config: ChartConfig,
    globalFilters: DataFilter[]
  ): Promise<void> {
    // 创建图表容器
    const chartContainer = document.createElement('div');
    chartContainer.className = `pd-chart-container pd-chart-${config.size || 'medium'}`;
    chartContainer.id = `pd-chart-${config.id}`;
    container.appendChild(chartContainer);

    // 创建图表标题
    const titleEl = document.createElement('h3');
    titleEl.className = 'pd-chart-title';
    titleEl.textContent = config.title;
    chartContainer.appendChild(titleEl);

    // 创建图表元素
    const chartEl = document.createElement('div');
    chartEl.className = 'pd-chart';
    chartContainer.appendChild(chartEl);

    try {
      // 获取数据
      const data = await this.fetchChartData(config, globalFilters);

      // 获取渲染器
      const renderer = this.renderers.get(config.type);
      if (!renderer) {
        throw new Error(`No renderer registered for chart type: ${config.type}`);
      }

      // 渲染图表
      renderer.render(chartEl, config, data);
    } catch (error) {
      console.error(`Failed to render chart ${config.id}:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      chartEl.innerHTML = `<div class="pd-chart-error">Failed to load chart: ${errorMessage}</div>`;
    }
  }

  /**
   * 获取图表数据
   * @param config 图表配置
   * @param globalFilters 全局过滤条件
   */
  private async fetchChartData(config: ChartConfig, globalFilters: DataFilter[]): Promise<any[]> {
    const provider = this.dataProviders.get(config.dataSource);
    if (!provider) {
      throw new Error(`Data provider not found for source: ${config.dataSource}`);
    }

    // 获取原始数据
    let rawData = await provider();

    // 应用全局过滤条件
    rawData = this.applyFilters(rawData, globalFilters);

    // 应用图表自身的过滤条件
    if (config.filters && config.filters.length > 0) {
      rawData = this.applyFilters(rawData, config.filters);
    }

    // 应用数据变换
    const transformerName = config.dataSource;
    if (this.transformers.has(transformerName)) {
      rawData = this.transformers.get(transformerName)!.transform(rawData, config);
    }

    // 应用排序
    if (config.sortBy) {
      rawData = this.sortData(rawData, config.sortBy, config.sortDirection || 'desc');
    }

    // 应用限制
    if (config.limit && config.limit > 0) {
      rawData = rawData.slice(0, config.limit);
    }

    return rawData;
  }

  /**
   * 应用过滤条件
   * @param data 原始数据
   * @param filters 过滤条件
   */
  private applyFilters(data: any[], filters: DataFilter[]): any[] {
    if (!filters || filters.length === 0) {
      return data;
    }

    return data.filter(item => {
      return filters.every(filter => {
        const value = this.getNestedProperty(item, filter.field);

        switch (filter.operator) {
          case '==':
            return value === filter.value;
          case '!=':
            return value !== filter.value;
          case '>':
            return value > filter.value;
          case '>=':
            return value >= filter.value;
          case '<':
            return value < filter.value;
          case '<=':
            return value <= filter.value;
          case 'contains':
            return String(value).includes(String(filter.value));
          case 'starts_with':
            return String(value).startsWith(String(filter.value));
          case 'ends_with':
            return String(value).endsWith(String(filter.value));
          default:
            return true;
        }
      });
    });
  }

  /**
   * 获取嵌套属性值
   * @param obj 对象
   * @param path 属性路径，如 "user.profile.name"
   */
  private getNestedProperty(obj: any, path: string): any {
    const parts = path.split('.');
    return parts.reduce((o, key) => (o && o[key] !== undefined ? o[key] : undefined), obj);
  }

  /**
   * 对数据排序
   * @param data 数据
   * @param field 排序字段
   * @param direction 排序方向
   */
  private sortData(data: any[], field: string, direction: 'asc' | 'desc'): any[] {
    return [...data].sort((a, b) => {
      const valueA = this.getNestedProperty(a, field);
      const valueB = this.getNestedProperty(b, field);

      if (valueA === undefined || valueB === undefined) {
        return 0;
      }

      const comparison = valueA > valueB ? 1 : valueA < valueB ? -1 : 0;
      return direction === 'asc' ? comparison : -comparison;
    });
  }

  /**
   * 设置仪表盘自动刷新
   * @param dashboardId 仪表盘ID
   */
  private setupDashboardRefresh(dashboardId: string): void {
    // 先清除已有的定时器
    this.stopDashboardRefresh(dashboardId);

    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard || !dashboard.refreshInterval || dashboard.refreshInterval <= 0) {
      return;
    }

    // 设置新定时器
    const timerId = window.setInterval(
      () => this.refreshDashboard(dashboardId),
      dashboard.refreshInterval * 1000
    );

    this.refreshTimers.set(dashboardId, timerId);
  }

  /**
   * 停止仪表盘自动刷新
   * @param dashboardId 仪表盘ID
   */
  private stopDashboardRefresh(dashboardId: string): void {
    const timerId = this.refreshTimers.get(dashboardId);
    if (timerId) {
      clearInterval(timerId);
      this.refreshTimers.delete(dashboardId);
    }
  }

  /**
   * 刷新仪表盘
   * @param dashboardId 仪表盘ID
   */
  public async refreshDashboard(dashboardId: string): Promise<boolean> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      return false;
    }

    // 更新每个图表
    for (const chartConfig of dashboard.charts) {
      await this.refreshChart(chartConfig, dashboard.filters || []);
    }

    return true;
  }

  /**
   * 刷新单个图表
   * @param config 图表配置
   * @param globalFilters 全局过滤条件
   */
  private async refreshChart(config: ChartConfig, globalFilters: DataFilter[]): Promise<void> {
    const chartEl = document.querySelector(`#pd-chart-${config.id} .pd-chart`) as HTMLElement;
    if (!chartEl) {
      return;
    }

    try {
      // 获取新数据
      const data = await this.fetchChartData(config, globalFilters);

      // 获取渲染器
      const renderer = this.renderers.get(config.type);
      if (!renderer) {
        throw new Error(`No renderer registered for chart type: ${config.type}`);
      }

      // 更新图表
      renderer.update(chartEl, data);
    } catch (error) {
      console.error(`Failed to refresh chart ${config.id}:`, error);
    }
  }

  /**
   * 导出仪表盘配置
   * @param dashboardId 仪表盘ID
   */
  public exportDashboard(dashboardId: string): string | null {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      return null;
    }

    return JSON.stringify(dashboard, null, 2);
  }

  /**
   * 从配置导入仪表盘
   * @param configJson 仪表盘配置JSON字符串
   * @returns 仪表盘ID
   */
  public importDashboard(configJson: string): string | null {
    try {
      const config = JSON.parse(configJson) as DashboardConfig;
      return this.createDashboard(config);
    } catch (error) {
      console.error('Failed to import dashboard:', error);
      return null;
    }
  }
}

/**
 * 创建标准监控仪表盘
 * 预设常用监控指标的仪表盘
 */
export function createStandardMonitoringDashboard(): DashboardConfig {
  return {
    id: `standard_monitoring_${Date.now()}`,
    title: '应用程序监控仪表盘',
    description: '实时展示关键性能和错误指标',
    refreshInterval: 60, // 每分钟刷新一次
    charts: [
      // 错误概览
      {
        id: 'error_overview',
        title: '错误概览',
        type: ChartType.NUMBER,
        dataSource: 'errors',
        size: WidgetSize.SMALL,
        metrics: ['count'],
        timeField: 'timestamp',
        timeGranularity: TimeGranularity.DAY,
      },

      // 错误趋势
      {
        id: 'error_trend',
        title: '错误趋势',
        type: ChartType.LINE,
        dataSource: 'errors',
        size: WidgetSize.MEDIUM,
        metrics: ['count'],
        dimensions: ['time'],
        timeField: 'timestamp',
        timeGranularity: TimeGranularity.HOUR,
      },

      // 页面加载性能
      {
        id: 'page_load',
        title: '页面加载时间',
        type: ChartType.AREA,
        dataSource: 'performance',
        size: WidgetSize.MEDIUM,
        metrics: ['loadTime', 'domContentLoaded'],
        dimensions: ['time'],
        timeField: 'timestamp',
        timeGranularity: TimeGranularity.HOUR,
      },

      // 错误类型分布
      {
        id: 'error_types',
        title: '错误类型分布',
        type: ChartType.PIE,
        dataSource: 'errors',
        size: WidgetSize.MEDIUM,
        dimensions: ['type'],
        metrics: ['count'],
      },

      // API响应时间
      {
        id: 'api_latency',
        title: 'API响应时间',
        type: ChartType.BAR,
        dataSource: 'api',
        size: WidgetSize.LARGE,
        dimensions: ['endpoint'],
        metrics: ['responseTime'],
        sortBy: 'responseTime',
        sortDirection: 'desc',
        limit: 10,
      },

      // 用户体验得分
      {
        id: 'user_experience',
        title: '用户体验得分',
        type: ChartType.GAUGE,
        dataSource: 'ux',
        size: WidgetSize.MEDIUM,
        metrics: ['score'],
        baseline: 50,
        goal: 90,
      },

      // 用户行为漏斗
      {
        id: 'user_funnel',
        title: '用户转化漏斗',
        type: ChartType.FUNNEL,
        dataSource: 'behavior',
        size: WidgetSize.LARGE,
        dimensions: ['step'],
        metrics: ['users'],
      },

      // 资源加载性能
      {
        id: 'resource_performance',
        title: '资源加载性能',
        type: ChartType.SCATTER,
        dataSource: 'resources',
        size: WidgetSize.LARGE,
        dimensions: ['url'],
        metrics: ['size', 'loadTime'],
      },
    ],
  };
}

// 默认导出可视化服务
export default DashboardService;
