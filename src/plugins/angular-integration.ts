/**
 * Angular集成
 * 提供Angular服务、指令和装饰器，便于在Angular应用中使用PandEye
 */

/* 
注意: 此文件假设在Angular环境中使用，
需要用户在其环境中安装Angular依赖并使用Angular编译器。
*/

import {
  ApplicationRef,
  Component,
  ComponentFactoryResolver,
  Directive,
  ErrorHandler,
  EventEmitter,
  HostListener,
  Injectable,
  Injector,
  Input,
  ModuleWithProviders,
  NgModule,
  OnDestroy,
  OnInit,
  Output,
  Type,
} from '@angular/core';

import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

import { Pandeye } from '../index';
import { PandeyeOptions } from '../types';

/**
 * PandEye Angular服务
 */
@Injectable({ providedIn: 'root' })
export class PandeyeService {
  private pandeye: Pandeye;
  private enabled: boolean = true;

  constructor() {
    // 这里不初始化，而是等待PandeyeModule.forRoot调用
  }

  /**
   * 初始化PandEye实例
   */
  initialize(options: PandeyeOptions): void {
    this.pandeye = Pandeye.getInstance(options);
  }

  /**
   * 报告错误
   */
  reportError(error: Error | string, context?: any): void {
    if (!this.enabled || !this.pandeye) return;

    this.pandeye.reportError(error, {
      source: 'angular',
      ...context,
    });
  }

  /**
   * 报告自定义事件
   */
  reportCustom(name: string, data: any): void {
    if (!this.enabled || !this.pandeye) return;

    this.pandeye.reportCustom(name, data);
  }

  /**
   * 启用监控
   */
  enable(): void {
    this.enabled = true;
  }

  /**
   * 禁用监控
   */
  disable(): void {
    this.enabled = false;
  }

  /**
   * 获取启用状态
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 获取PandEye实例
   */
  getInstance(): Pandeye | null {
    return this.pandeye || null;
  }
}

/**
 * PandEye全局错误处理器
 * 自动捕获Angular应用中的所有未处理错误
 */
@Injectable()
export class PandeyeErrorHandler implements ErrorHandler {
  constructor(private pandeyeService: PandeyeService) {}

  handleError(error: any): void {
    // 尝试获取有用的上下文
    const context: any = {};

    try {
      // 如果error是一个Angular错误对象
      if (error.ngDebugContext) {
        const debugContext = error.ngDebugContext;

        if (debugContext.component) {
          context.component = {
            name: debugContext.component.constructor.name,
            selector: debugContext.component['__proto__']?.constructor?.ɵcmp?.selectors?.[0]?.[0],
          };
        }

        if (debugContext.injector) {
          context.providers = Array.from(
            new Set(
              debugContext.injector
                .traverse()
                .map((i: any) => (i && i.records ? Object.keys(i.records) : []))
                .flat()
            )
          ).filter((name: string) => !name.startsWith('__') && !name.includes('.'));
        }
      }

      // 如果错误有组件信息
      if (error.componentStack) {
        context.componentStack = error.componentStack;
      }

      // 如果有源代码位置信息
      if (error.stack) {
        // 提取源码位置，通常在堆栈的第一行
        const sourceLocationMatch = error.stack.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
        if (sourceLocationMatch) {
          context.sourceLocation = {
            function: sourceLocationMatch[1],
            file: sourceLocationMatch[2],
            line: parseInt(sourceLocationMatch[3], 10),
            column: parseInt(sourceLocationMatch[4], 10),
          };
        }
      }
    } catch (e) {
      // 如果提取上下文时出错，忽略它，继续报告原始错误
      context.contextExtractionFailed = true;
    }

    // 向PandEye报告错误
    this.pandeyeService.reportError(error, context);

    // 在开发模式下，也要在控制台打印错误
    console.error('Angular Error:', error);
  }
}

/**
 * PandEye性能监控指令
 * 用于监控组件的性能
 */
@Directive({
  selector: '[pandeyeMonitor]',
})
export class PandeyeMonitorDirective implements OnInit, OnDestroy {
  @Input('pandeyeMonitor') componentName: string = 'unnamed';
  @Input('pandeyeAttributes') attributes: any = {};

  private startTime: number = performance.now();
  private renderCount: number = 0;

  constructor(private pandeyeService: PandeyeService) {}

  ngOnInit(): void {
    const mountTime = performance.now() - this.startTime;
    this.renderCount++;

    this.pandeyeService.reportCustom('angular.component.mount', {
      componentName: this.componentName,
      mountTime,
      renderCount: this.renderCount,
      ...this.attributes,
    });
  }

  ngOnDestroy(): void {
    const unmountTime = performance.now();

    this.pandeyeService.reportCustom('angular.component.unmount', {
      componentName: this.componentName,
      totalLifetime: unmountTime - this.startTime,
      renderCount: this.renderCount,
      ...this.attributes,
    });
  }

  /**
   * 记录点击事件
   */
  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    if (!this.pandeyeService.isEnabled()) return;

    this.pandeyeService.reportCustom('angular.interaction.click', {
      componentName: this.componentName,
      target: (event.target as HTMLElement).tagName,
      x: event.clientX,
      y: event.clientY,
      ...this.attributes,
    });
  }
}

/**
 * PandEye错误边界组件
 * 为Angular提供类似React的错误边界功能
 */
@Component({
  selector: 'pandeye-error-boundary',
  template: `
    <ng-container *ngIf="!hasError">
      <ng-content></ng-content>
    </ng-container>
    <ng-container *ngIf="hasError">
      <div class="pandeye-error-boundary" *ngIf="!fallbackComponent">
        <h2>Something went wrong</h2>
        <p>{{ error?.message || 'An unknown error occurred' }}</p>
        <button (click)="reset()">Try Again</button>
      </div>
      <ng-container
        *ngIf="fallbackComponent"
        [ngComponentOutlet]="fallbackComponent"
        [ngComponentOutletInjector]="fallbackInjector"
      >
      </ng-container>
    </ng-container>
  `,
})
export class PandeyeErrorBoundaryComponent implements OnInit {
  @Input() fallbackComponent?: Type<any>;
  @Output() errorCaught = new EventEmitter<Error>();

  hasError = false;
  error: Error | null = null;
  errorMessage: string = '';
  fallbackInjector?: Injector;

  private originalContent: any;

  constructor(
    private componentFactoryResolver: ComponentFactoryResolver,
    private appRef: ApplicationRef,
    private injector: Injector,
    private pandeyeService: PandeyeService
  ) {}

  ngOnInit() {
    // 保存原始内容
    this.originalContent = this.getContentSnapshot();

    // 创建带有错误数据的注入器
    if (this.fallbackComponent) {
      this.fallbackInjector = Injector.create({
        providers: [
          { provide: 'error', useValue: this.error },
          { provide: 'reset', useValue: this.reset.bind(this) },
        ],
        parent: this.injector,
      });
    }
  }

  /**
   * 捕获来自子组件的错误
   */
  handleError(error: Error): void {
    this.error = error;
    this.errorMessage = error.message || 'An unknown error occurred';
    this.hasError = true;

    // 报告错误
    this.pandeyeService.reportError(error, {
      source: 'angular-error-boundary',
      componentName: this.fallbackComponent ? this.fallbackComponent.name : 'unknown',
    });

    // 通知父组件
    this.errorCaught.emit(error);

    // 更新注入器
    if (this.fallbackComponent) {
      this.fallbackInjector = Injector.create({
        providers: [
          { provide: 'error', useValue: this.error },
          { provide: 'reset', useValue: this.reset.bind(this) },
        ],
        parent: this.injector,
      });
    }
  }

  /**
   * 重置错误状态
   */
  reset(): void {
    this.hasError = false;
    this.error = null;

    // 尝试恢复原始内容
    this.restoreContent();
  }

  /**
   * 获取当前内容的快照
   * 这是一个简化的实现
   */
  private getContentSnapshot(): any {
    // 真实实现需要根据Angular版本和具体需求定制
    return null;
  }

  /**
   * 恢复原始内容
   * 这是一个简化的实现
   */
  private restoreContent(): void {
    // 真实实现需要根据Angular版本和具体需求定制
  }
}

/**
 * Router监控服务
 * 监控Angular路由变化
 */
@Injectable()
export class PandeyeRouterMonitorService {
  constructor(
    private router: Router,
    private pandeyeService: PandeyeService
  ) {
    this.monitorRouteChanges();
  }

  private monitorRouteChanges(): void {
    try {
      this.router.events
        .pipe(filter(event => event instanceof NavigationEnd))
        .subscribe((event: NavigationEnd) => {
          if (!this.pandeyeService.isEnabled()) return;

          // 报告路由变化
          this.pandeyeService.reportCustom('angular.route.change', {
            url: event.url,
            urlAfterRedirects: event.urlAfterRedirects,
            timestamp: performance.now(),
          });

          // 收集性能指标
          setTimeout(() => {
            if (typeof window !== 'undefined' && 'performance' in window) {
              // 基本性能指标
              const navTiming = performance.getEntriesByType(
                'navigation'
              )[0] as PerformanceNavigationTiming;
              if (navTiming) {
                this.pandeyeService.reportCustom('angular.route.performance', {
                  url: event.url,
                  loadTime: navTiming.loadEventEnd - navTiming.startTime,
                  domContentLoaded: navTiming.domContentLoadedEventEnd - navTiming.startTime,
                });
              }

              // 收集与当前页面相关的资源加载指标
              const resourceEntries = performance.getEntriesByType(
                'resource'
              ) as PerformanceResourceTiming[];
              const relevantResources = resourceEntries.filter(entry => {
                const startTime = entry.startTime;
                // 仅包括在导航之后加载的资源
                return startTime > navTiming.startTime;
              });

              // 分析资源加载情况
              if (relevantResources.length > 0) {
                const resourceStats = {
                  count: relevantResources.length,
                  totalSize: 0,
                  longestRequest: 0,
                  types: {} as Record<string, number>,
                };

                relevantResources.forEach(resource => {
                  const duration = resource.responseEnd - resource.startTime;
                  resourceStats.longestRequest = Math.max(resourceStats.longestRequest, duration);

                  // 尝试确定资源类型
                  const url = resource.name;
                  const extension = url.split('.').pop()?.toLowerCase() || 'unknown';

                  // 计算资源类型统计
                  if (!resourceStats.types[extension]) {
                    resourceStats.types[extension] = 0;
                  }
                  resourceStats.types[extension]++;

                  // 估算大小 (如果有)
                  if (resource.transferSize) {
                    resourceStats.totalSize += resource.transferSize;
                  }
                });

                this.pandeyeService.reportCustom('angular.route.resources', {
                  url: event.url,
                  ...resourceStats,
                });
              }
            }
          }, 500);
        });
    } catch (err) {
      console.warn('[PandEye] Failed to monitor Angular Router:', err);
    }
  }
}

/**
 * PandEye Angular模块
 */
@NgModule({
  declarations: [PandeyeMonitorDirective, PandeyeErrorBoundaryComponent],
  exports: [PandeyeMonitorDirective, PandeyeErrorBoundaryComponent],
  providers: [],
})
export class PandeyeModule {
  /**
   * 配置PandEye模块
   */
  static forRoot(options: PandeyeOptions): ModuleWithProviders<PandeyeModule> {
    return {
      ngModule: PandeyeModule,
      providers: [
        {
          provide: ErrorHandler,
          useClass: PandeyeErrorHandler,
        },
        PandeyeRouterMonitorService,
        {
          provide: PandeyeService,
          useFactory: () => {
            const service = new PandeyeService();
            service.initialize(options);
            return service;
          },
        },
      ],
    };
  }
}

/**
 * 性能追踪装饰器
 * 用于跟踪方法执行时间
 */
export function TrackPerformance(category: string = 'method') {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const service = getInjectedService(this, PandeyeService);

      if (!service || !service.isEnabled()) {
        return originalMethod.apply(this, args);
      }

      const start = performance.now();
      let result;

      try {
        result = originalMethod.apply(this, args);

        // 如果结果是Promise，添加计时和错误处理
        if (result instanceof Promise) {
          return result
            .then(value => {
              const duration = performance.now() - start;
              service.reportCustom('angular.method.performance', {
                category,
                method: propertyKey,
                duration,
                async: true,
                successful: true,
                component: target.constructor.name,
              });
              return value;
            })
            .catch(error => {
              const duration = performance.now() - start;
              service.reportCustom('angular.method.performance', {
                category,
                method: propertyKey,
                duration,
                async: true,
                successful: false,
                error: error.message,
                component: target.constructor.name,
              });
              throw error;
            });
        }

        // 同步方法
        const duration = performance.now() - start;
        service.reportCustom('angular.method.performance', {
          category,
          method: propertyKey,
          duration,
          async: false,
          successful: true,
          component: target.constructor.name,
        });

        return result;
      } catch (error) {
        const duration = performance.now() - start;
        service.reportCustom('angular.method.performance', {
          category,
          method: propertyKey,
          duration,
          async: false,
          successful: false,
          error: error.message,
          component: target.constructor.name,
        });

        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * 错误跟踪装饰器
 * 捕获并报告方法执行期间的错误
 */
export function TrackErrors(category: string = 'method') {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      const service = getInjectedService(this, PandeyeService);

      if (!service || !service.isEnabled()) {
        return originalMethod.apply(this, args);
      }

      try {
        const result = originalMethod.apply(this, args);

        // 如果结果是Promise，添加错误处理
        if (result instanceof Promise) {
          return result.catch(error => {
            service.reportError(error, {
              method: propertyKey,
              category,
              component: target.constructor.name,
              args: sanitizeArgs(args),
            });
            throw error;
          });
        }

        return result;
      } catch (error) {
        service.reportError(error, {
          method: propertyKey,
          category,
          component: target.constructor.name,
          args: sanitizeArgs(args),
        });
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * 辅助函数：过滤参数中的敏感信息
 */
function sanitizeArgs(args: any[]): any[] {
  return args.map(arg => {
    if (arg === null || arg === undefined) {
      return arg;
    }

    if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
      return arg;
    }

    if (Array.isArray(arg)) {
      return '[Array]';
    }

    if (typeof arg === 'object') {
      if (arg instanceof Date) {
        return arg.toISOString();
      }
      return '[Object]';
    }

    if (typeof arg === 'function') {
      return '[Function]';
    }

    return '[Unknown]';
  });
}

/**
 * 辅助函数：尝试从上下文中获取服务
 */
function getInjectedService<T>(context: any, serviceType: any): T | null {
  if (!context) return null;

  // 如果上下文自身就是服务
  if (context instanceof serviceType) {
    return context as T;
  }

  // 尝试从Angular DI系统获取
  try {
    if (context.injector) {
      return context.injector.get(serviceType);
    }

    // 递归查找父组件
    if (context.parent) {
      return getInjectedService(context.parent, serviceType);
    }
  } catch (e) {
    // 忽略错误，返回null
  }

  return null;
}
