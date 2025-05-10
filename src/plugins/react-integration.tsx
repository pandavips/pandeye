/**
 * React集成
 * 提供React组件和hooks，便于在React应用中使用PandEye
 */

import React, {
  Component,
  createContext,
  FC,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { Pandeye } from '../index';
import { PandeyeOptions } from '../types';

// React Context
interface PandeyeContextType {
  pandeye: Pandeye | null;
  reportError: (error: Error | string, componentInfo?: any) => void;
  reportCustom: (name: string, data: any) => void;
}

// 创建Context
const PandeyeContext = createContext<PandeyeContextType>({
  pandeye: null,
  reportError: () => {},
  reportCustom: () => {},
});

// Provider属性
interface PandeyeProviderProps {
  options: PandeyeOptions;
  children: ReactNode;
}

/**
 * PandEye Provider组件
 * 为组件树提供PandEye实例
 */
export const PandeyeProvider: FC<PandeyeProviderProps> = ({ options, children }) => {
  // 创建PandEye实例
  const pandeyeInstance = useMemo(() => {
    return Pandeye.getInstance(options);
  }, []);

  // 报告错误的方法
  const reportError = useCallback(
    (error: Error | string, componentInfo?: any) => {
      if (pandeyeInstance) {
        pandeyeInstance.reportError('js', error, {
          source: 'react-component',
          ...componentInfo,
        });
      }
    },
    [pandeyeInstance]
  );

  // 报告自定义事件的方法
  const reportCustom = useCallback(
    (name: string, data: any) => {
      if (pandeyeInstance) {
        pandeyeInstance.reportCustom(name, data);
      }
    },
    [pandeyeInstance]
  );

  // Context值
  const contextValue = useMemo(
    () => ({
      pandeye: pandeyeInstance,
      reportError,
      reportCustom,
    }),
    [pandeyeInstance, reportError, reportCustom]
  );

  return <PandeyeContext.Provider value={contextValue}>{children}</PandeyeContext.Provider>;
};

/**
 * 错误边界组件
 * 捕获React组件内的错误
 */
interface ErrorBoundaryProps {
  fallback?: ReactNode | ((error: Error, retry: () => void) => ReactNode);
  children: ReactNode;
  onError?: (error: Error, componentStack: string) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class PandeyeErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  static contextType = PandeyeContext;
  declare context: React.ContextType<typeof PandeyeContext>;
  state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.handleRetry = this.handleRetry.bind(this);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    // 报告给PandEye
    this.context.reportError(error, {
      componentStack: errorInfo.componentStack,
      boundary: true,
    });

    // 调用自定义错误处理
    if (this.props.onError) {
      this.props.onError(error, errorInfo.componentStack);
    }
  }

  handleRetry() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback(this.state.error!, this.handleRetry);
        }
        return this.props.fallback;
      }

      return (
        <div className="pandeye-error-boundary">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message || 'Unknown error'}</p>
          <button onClick={this.handleRetry}>Retry</button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * 使用PandEye的Hook
 */
export function usePandeye(): PandeyeContextType {
  const context = useContext(PandeyeContext);

  if (!context.pandeye) {
    console.warn('[PandEye] usePandeye must be used within a PandeyeProvider');
  }

  return context;
}

/**
 * 错误报告Hook
 */
export function useErrorReport() {
  const { reportError } = usePandeye();
  return reportError;
}

/**
 * 自定义事件报告Hook
 */
export function useCustomReport() {
  const { reportCustom } = usePandeye();
  return reportCustom;
}

/**
 * 性能监控Hook
 */
export function usePerformanceMonitor(componentName: string) {
  const { pandeye } = usePandeye();
  const startTime = useRef(performance.now());
  const renderCount = useRef(0);

  useEffect(() => {
    // 组件挂载时记录
    renderCount.current++;

    const mountTime = performance.now() - startTime.current;

    // 报告组件挂载性能
    if (pandeye) {
      pandeye.reportCustom('react.component.mount', {
        componentName,
        mountTime,
        renderCount: renderCount.current,
      });
    }

    return () => {
      // 组件卸载时记录
      const unmountStartTime = performance.now();

      if (pandeye) {
        pandeye.reportCustom('react.component.unmount', {
          componentName,
          unmountTime: performance.now() - unmountStartTime,
          totalLifetime: performance.now() - startTime.current,
          renderCount: renderCount.current,
        });
      }
    };
  }, [componentName, pandeye]);

  // 返回一个方法，用于手动记录重要操作
  const recordOperation = useCallback(
    (operationName: string, data?: any) => {
      if (pandeye) {
        pandeye.reportCustom('react.operation', {
          componentName,
          operationName,
          timestamp: performance.now(),
          ...data,
        });
      }
    },
    [componentName, pandeye]
  );

  return { recordOperation };
}

/**
 * 监控React路由变化的Hook
 * 需要与React Router一起使用
 */
export function useRouteMonitor(router: any) {
  const { pandeye } = usePandeye();

  useEffect(() => {
    if (!pandeye || !router) return undefined;

    const handleRouteChange = (location: any) => {
      pandeye.reportCustom('react.route.change', {
        path: location.pathname,
        search: location.search,
        timestamp: performance.now(),
      });
    };

    // 尝试检测React Router版本并使用适当的监听方式
    if (router.listen) {
      // React Router v6
      const unlisten = router.listen(({ location }: any) => {
        handleRouteChange(location);
      });

      return () => {
        unlisten();
      };
    } else if (router.history && router.history.listen) {
      // React Router v5 或更早
      const unlisten = router.history.listen((location: any) => {
        handleRouteChange(location);
      });

      return () => {
        unlisten();
      };
    }

    // 默认返回undefined以确保所有路径都有返回值
    return undefined;
  }, [pandeye, router]);
}

/**
 * 异步错误捕获高阶组件
 */
export function withPandeyeErrorTracking<P extends object>(
  Component: React.ComponentType<P>,
  componentName = Component.displayName || Component.name
): React.FC<P> {
  const WrappedComponent = (props: P) => {
    const { reportError } = usePandeye();

    return (
      <PandeyeErrorBoundary
        onError={error => {
          reportError(error, { componentName });
        }}
      >
        <Component {...props} />
      </PandeyeErrorBoundary>
    );
  };

  WrappedComponent.displayName = `withPandeyeErrorTracking(${componentName})`;
  return WrappedComponent;
}
