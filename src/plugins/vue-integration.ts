/**
 * Vue集成
 * 支持Vue 2和Vue 3，提供Vue插件、组件和Composition API支持
 */

import {
  App,
  ComponentPublicInstance,
  createApp,
  defineComponent,
  getCurrentInstance,
  h,
  inject,
  Plugin,
  reactive,
} from 'vue';
import { Pandeye } from '../index';
import { PandeyeOptions } from '../types';

// Vue 3与Vue 2兼容性判断
const isVue3 = typeof createApp === 'function';

// Vue 2版本类型
type Vue2 = {
  config: {
    errorHandler: (err: any, vm: any, info: string) => void;
    warnHandler: (msg: string, vm: any, trace: string) => void;
  };
  mixin: (mixin: any) => void;
  prototype: any;
  component: (name: string, component: any) => any;
  directive: (name: string, directive: any) => any;
  version: string;
};

// 定义注入键
const PANDEYE_INJECTION_KEY = Symbol('pandeye');

// 监控状态
interface PandeyeState {
  isEnabled: boolean;
  version: string;
}

/**
 * PandEye Vue插件
 * 支持Vue 2和Vue 3
 */
export const PandeyePlugin: Plugin = {
  install(app: App | Vue2, options: PandeyeOptions) {
    const pandeye = Pandeye.getInstance(options);
    const pandeyeState = reactive<PandeyeState>({
      isEnabled: true,
      version: pandeye.getVersion(),
    });

    // 全局错误处理
    const errorHandler = (err: Error, vm: ComponentPublicInstance | any, info: string) => {
      if (!pandeyeState.isEnabled) return;

      // 收集组件信息
      const componentInfo = getComponentInfo(vm);

      // 报告错误
      pandeye.reportError('js', err, {
        source: 'vue-component',
        errorInfo: info,
        ...componentInfo,
      });

      // 调用原始错误处理器
      if (originalErrorHandler && originalErrorHandler !== errorHandler) {
        originalErrorHandler(err, vm, info);
      } else {
        console.error('[Vue Error]', err);
      }
    };

    // 全局警告处理
    const warnHandler = (msg: string, vm: ComponentPublicInstance | any, trace: string) => {
      if (!pandeyeState.isEnabled) return;

      // 收集组件信息
      const componentInfo = getComponentInfo(vm);

      // 报告警告
      pandeye.reportCustom('vue.warning', {
        message: msg,
        trace,
        ...componentInfo,
      });

      // 调用原始警告处理器
      if (originalWarnHandler && originalWarnHandler !== warnHandler) {
        originalWarnHandler(msg, vm, trace);
      } else {
        console.warn('[Vue Warning]', msg);
      }
    };

    // 保存原始处理器
    let originalErrorHandler: typeof errorHandler | null = null;
    let originalWarnHandler: typeof warnHandler | null = null;

    if (isVue3) {
      // Vue 3 安装
      const vue3App = app as App;

      // 注册错误处理器
      originalErrorHandler = vue3App.config.errorHandler || null;
      vue3App.config.errorHandler = errorHandler;

      // 注册警告处理器
      originalWarnHandler = vue3App.config.warnHandler || null;
      vue3App.config.warnHandler = warnHandler;

      // 提供PandEye实例
      vue3App.provide(PANDEYE_INJECTION_KEY, {
        pandeye,
        state: pandeyeState,
      });

      // 添加工具方法
      vue3App.config.globalProperties.$pandeye = {
        reportError: (error: Error | string, info?: any) => {
          pandeye.reportError('js', error, info);
        },
        reportCustom: (name: string, data: any) => {
          pandeye.reportCustom(name, data);
        },
        enable: () => {
          pandeyeState.isEnabled = true;
        },
        disable: () => {
          pandeyeState.isEnabled = false;
        },
        isEnabled: () => pandeyeState.isEnabled,
      };

      // 注册监控组件
      vue3App.component('PandeyeErrorBoundary', defineErrorBoundaryV3(pandeye));
      vue3App.component('PandeyeTracker', defineTrackerV3(pandeye));
    } else {
      // Vue 2 安装
      const vue2 = app as Vue2;

      // 注册错误处理器
      originalErrorHandler = vue2.config.errorHandler || null;
      vue2.config.errorHandler = errorHandler;

      // 注册警告处理器
      originalWarnHandler = vue2.config.warnHandler || null;
      vue2.config.warnHandler = warnHandler;

      // 注入实例
      vue2.prototype.$pandeye = {
        reportError: (error: Error | string, info?: any) => {
          pandeye.reportError('js', error, info);
        },
        reportCustom: (name: string, data: any) => {
          pandeye.reportCustom(name, data);
        },
        enable: () => {
          pandeyeState.isEnabled = true;
        },
        disable: () => {
          pandeyeState.isEnabled = false;
        },
        isEnabled: () => pandeyeState.isEnabled,
      };

      // 注册全局混入，便于性能监测
      vue2.mixin({
        beforeCreate() {
          this.$pandeyeData = {
            renderStart: performance.now(),
          };
        },
        mounted() {
          if (!pandeyeState.isEnabled) return;

          const componentInfo = getComponentInfo(this);
          const mountTime = performance.now() - this.$pandeyeData.renderStart;

          pandeye.reportCustom('vue.component.mount', {
            ...componentInfo,
            mountTime,
          });

          this.$pandeyeData.mountTime = mountTime;
          this.$pandeyeData.mountedAt = performance.now();
        },
        beforeDestroy() {
          if (!pandeyeState.isEnabled) return;

          const componentInfo = getComponentInfo(this);
          const unmountStartTime = performance.now();

          pandeye.reportCustom('vue.component.unmount', {
            ...componentInfo,
            unmountTime: performance.now() - unmountStartTime,
            totalLifetime: performance.now() - this.$pandeyeData.mountedAt,
          });
        },
      });

      // 注册监控组件
      vue2.component('PandeyeErrorBoundary', defineErrorBoundaryV2(pandeye));
      vue2.component('PandeyeTracker', defineTrackerV2(pandeye));
    }

    // 路由监控 - 兼容Vue Router 3.x和4.x
    monitorVueRouter(pandeye);
  },
};

/**
 * 获取组件信息
 */
function getComponentInfo(vm: any): {
  componentName: string;
  fileName?: string;
  props?: any;
  route?: any;
} {
  if (!vm) return { componentName: 'unknown' };

  // 获取组件名称
  let componentName = 'anonymous';

  if (vm.$options && vm.$options.name) {
    componentName = vm.$options.name;
  } else if (vm.$options && vm.$options.__file) {
    const file = vm.$options.__file.split('/').pop();
    componentName = file ? file.replace(/\.\w+$/, '') : 'anonymous';
  } else if (vm.$vnode && vm.$vnode.tag) {
    componentName = vm.$vnode.tag.split('-').pop() || 'anonymous';
  } else if (typeof vm.type === 'object' && vm.type !== null) {
    // Vue 3 组件
    componentName = vm.type.name || 'anonymous';
  }

  // 收集文件路径
  const fileName = vm.$options && vm.$options.__file;

  // 收集组件props (避免循环引用)
  let props: any = {};
  try {
    if (vm.$props) {
      props = JSON.parse(JSON.stringify(vm.$props));
    } else if (vm.props) {
      props = JSON.parse(JSON.stringify(vm.props));
    }
  } catch (e) {
    props = { error: 'Could not serialize props' };
  }

  // 收集路由信息
  let route = null;
  if (vm.$route) {
    route = {
      path: vm.$route.path,
      name: vm.$route.name,
      query: vm.$route.query,
    };
  }

  return {
    componentName,
    fileName,
    props,
    route,
  };
}

/**
 * Vue 3错误边界组件
 */
function defineErrorBoundaryV3(pandeye: Pandeye) {
  return defineComponent({
    name: 'PandeyeErrorBoundary',
    props: {
      fallback: {
        type: [Object, Function],
        default: null,
      },
    },
    data() {
      return {
        error: null,
        errorInfo: null,
      };
    },
    methods: {
      resetError() {
        this.error = null;
        this.errorInfo = null;
      },
    },
    errorCaptured(err: Error, vm: ComponentPublicInstance, info: string) {
      this.error = err;
      this.errorInfo = info;

      // 报告错误
      pandeye.reportError('js', err, {
        source: 'vue-error-boundary',
        errorInfo: info,
        ...getComponentInfo(vm),
      });

      // 阻止错误继续传播
      return false;
    },
    render() {
      if (this.error) {
        if (this.fallback) {
          if (typeof this.fallback === 'function') {
            return this.fallback({
              error: this.error,
              errorInfo: this.errorInfo,
              resetError: this.resetError,
            });
          }
          return h(this.fallback);
        }

        // 默认错误UI
        return h('div', { class: 'pandeye-error-boundary' }, [
          h('h2', null, 'Something went wrong'),
          h('p', null, this.error.message || 'Unknown error'),
          h(
            'button',
            {
              onClick: this.resetError,
            },
            'Try Again'
          ),
        ]);
      }

      return this.$slots.default ? this.$slots.default() : null;
    },
  });
}

/**
 * Vue 2错误边界组件
 */
function defineErrorBoundaryV2(pandeye: Pandeye) {
  return {
    name: 'PandeyeErrorBoundary',
    props: {
      fallback: {
        type: [Object, Function],
        default: null,
      },
    },
    data() {
      return {
        error: null,
        errorInfo: null,
      };
    },
    methods: {
      resetError() {
        this.error = null;
        this.errorInfo = null;
      },
    },
    errorCaptured(err: Error, vm: any, info: string) {
      this.error = err;
      this.errorInfo = info;

      // 报告错误
      pandeye.reportError('js', err, {
        source: 'vue-error-boundary',
        errorInfo: info,
        ...getComponentInfo(vm),
      });

      // 阻止错误继续传播
      return false;
    },
    render(h: any) {
      if (this.error) {
        if (this.fallback) {
          if (typeof this.fallback === 'function') {
            return this.fallback({
              error: this.error,
              errorInfo: this.errorInfo,
              resetError: this.resetError,
            });
          }
          return h(this.fallback);
        }

        // 默认错误UI
        return h('div', { class: 'pandeye-error-boundary' }, [
          h('h2', null, 'Something went wrong'),
          h('p', null, this.error.message || 'Unknown error'),
          h(
            'button',
            {
              on: { click: this.resetError },
            },
            'Try Again'
          ),
        ]);
      }

      return this.$slots.default;
    },
  };
}

/**
 * Vue 3性能跟踪组件
 */
function defineTrackerV3(pandeye: Pandeye) {
  return defineComponent({
    name: 'PandeyeTracker',
    props: {
      name: {
        type: String,
        required: true,
      },
      attributes: {
        type: Object,
        default: () => ({}),
      },
    },
    setup(props, { slots }) {
      const startTime = performance.now();
      const instance = getCurrentInstance();

      // 挂载完成后记录
      onMounted(() => {
        const mountTime = performance.now() - startTime;

        pandeye.reportCustom('vue.tracker.mount', {
          name: props.name,
          mountTime,
          ...props.attributes,
        });
      });

      // 更新时记录
      onUpdated(() => {
        pandeye.reportCustom('vue.tracker.update', {
          name: props.name,
          updateTime: performance.now(),
          ...props.attributes,
        });
      });

      // 卸载时记录
      onUnmounted(() => {
        const totalLifetime = performance.now() - startTime;

        pandeye.reportCustom('vue.tracker.unmount', {
          name: props.name,
          totalLifetime,
          ...props.attributes,
        });
      });

      return () => (slots.default ? slots.default() : null);
    },
  });
}

/**
 * Vue 2性能跟踪组件
 */
function defineTrackerV2(pandeye: Pandeye) {
  return {
    name: 'PandeyeTracker',
    props: {
      name: {
        type: String,
        required: true,
      },
      attributes: {
        type: Object,
        default: () => ({}),
      },
    },
    data() {
      return {
        startTime: performance.now(),
      };
    },
    mounted() {
      const mountTime = performance.now() - this.startTime;

      pandeye.reportCustom('vue.tracker.mount', {
        name: this.name,
        mountTime,
        ...this.attributes,
      });
    },
    updated() {
      pandeye.reportCustom('vue.tracker.update', {
        name: this.name,
        updateTime: performance.now(),
        ...this.attributes,
      });
    },
    beforeDestroy() {
      const totalLifetime = performance.now() - this.startTime;

      pandeye.reportCustom('vue.tracker.unmount', {
        name: this.name,
        totalLifetime,
        ...this.attributes,
      });
    },
    render() {
      return this.$slots.default;
    },
  };
}

/**
 * 监控Vue Router
 */
function monitorVueRouter(pandeye: Pandeye) {
  // 延迟执行，等待Vue Router安装
  setTimeout(() => {
    try {
      // 获取全局路由对象
      const router = window.$router || window.router;

      if (!router) return;

      // Vue Router的afterEach钩子在导航完成后触发
      if (typeof router.afterEach === 'function') {
        router.afterEach((to: any, from: any) => {
          pandeye.reportCustom('vue.route.change', {
            from: {
              path: from.path,
              name: from.name,
            },
            to: {
              path: to.path,
              name: to.name,
            },
            timestamp: performance.now(),
          });

          // 记录页面性能指标
          if (typeof window !== 'undefined' && 'performance' in window) {
            setTimeout(() => {
              // 如果有Web Vitals API可用，使用它
              if ('web-vitals' in window) {
                const webVitals = (window as any)['web-vitals'];
                if (webVitals) {
                  // 收集核心Web Vitals指标
                  webVitals.getCLS((metric: any) => {
                    pandeye.reportCustom('vue.route.vitals.cls', {
                      value: metric.value,
                      path: to.path,
                    });
                  });
                  webVitals.getFID((metric: any) => {
                    pandeye.reportCustom('vue.route.vitals.fid', {
                      value: metric.value,
                      path: to.path,
                    });
                  });
                  webVitals.getLCP((metric: any) => {
                    pandeye.reportCustom('vue.route.vitals.lcp', {
                      value: metric.value,
                      path: to.path,
                    });
                  });
                }
              } else {
                // 回退到基本性能指标
                const navTiming = performance.getEntriesByType(
                  'navigation'
                )[0] as PerformanceNavigationTiming;
                if (navTiming) {
                  pandeye.reportCustom('vue.route.performance', {
                    path: to.path,
                    loadTime: navTiming.loadEventEnd - navTiming.startTime,
                    domContentLoaded: navTiming.domContentLoadedEventEnd - navTiming.startTime,
                  });
                }
              }
            }, 500);
          }
        });
      }
    } catch (err) {
      console.warn('[PandEye] Failed to monitor Vue Router:', err);
    }
  }, 1000);
}

// Vue 3 Composition API支持
let onMounted: any;
let onUnmounted: any;
let onUpdated: any;

try {
  // 动态导入Vue Composition API
  if (isVue3) {
    const vueModule = require('vue');
    onMounted = vueModule.onMounted;
    onUnmounted = vueModule.onUnmounted;
    onUpdated = vueModule.onUpdated;
  } else {
    // Vue 2 + @vue/composition-api
    const compositionApi = require('@vue/composition-api');
    onMounted = compositionApi.onMounted;
    onUnmounted = compositionApi.onUnmounted;
    onUpdated = compositionApi.onUpdated;
  }
} catch (e) {
  // 定义空函数，防止报错
  onMounted = (fn: () => void) => {};
  onUnmounted = (fn: () => void) => {};
  onUpdated = (fn: () => void) => {};
}

/**
 * Vue 3 Composition API支持
 */
export function usePandeye() {
  const pandeyeContext = inject<{ pandeye: Pandeye; state: PandeyeState }>(PANDEYE_INJECTION_KEY);

  if (!pandeyeContext) {
    console.warn('[PandEye] usePandeye() must be used within a component using PandEye plugin');
    return {
      pandeye: null,
      reportError: () => {},
      reportCustom: () => {},
      enable: () => {},
      disable: () => {},
      isEnabled: () => false,
    };
  }

  const { pandeye, state } = pandeyeContext;

  return {
    pandeye,
    reportError: (error: Error | string, info?: any) => {
      if (state.isEnabled) {
        pandeye.reportError('js', error, info);
      }
    },
    reportCustom: (name: string, data: any) => {
      if (state.isEnabled) {
        pandeye.reportCustom(name, data);
      }
    },
    enable: () => {
      state.isEnabled = true;
    },
    disable: () => {
      state.isEnabled = false;
    },
    isEnabled: () => state.isEnabled,
  };
}

/**
 * 性能监控Hook
 */
export function usePerformanceMonitor(name: string, attributes: any = {}) {
  const { pandeye } = usePandeye();
  if (!pandeye) return { trackEvent: () => {} };

  const startTime = performance.now();

  onMounted(() => {
    const mountTime = performance.now() - startTime;

    pandeye.reportCustom('vue.composition.mount', {
      name,
      mountTime,
      ...attributes,
    });
  });

  onUpdated(() => {
    pandeye.reportCustom('vue.composition.update', {
      name,
      updateTime: performance.now() - startTime,
      ...attributes,
    });
  });

  onUnmounted(() => {
    const lifetime = performance.now() - startTime;

    pandeye.reportCustom('vue.composition.unmount', {
      name,
      lifetime,
      ...attributes,
    });
  });

  const trackEvent = (eventName: string, eventData: any = {}) => {
    pandeye.reportCustom(`vue.event.${eventName}`, {
      name,
      ...attributes,
      ...eventData,
      timestamp: performance.now(),
    });
  };

  return { trackEvent };
}
