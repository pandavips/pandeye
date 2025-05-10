/**
 * 隐私与安全模块
 * 提供数据脱敏、合规控制和隐私保护功能
 */

/**
 * 敏感信息类型
 */
export enum SensitiveDataType {
  EMAIL = 'email',
  PHONE = 'phone',
  NAME = 'name',
  ADDRESS = 'address',
  IP_ADDRESS = 'ip_address',
  CREDIT_CARD = 'credit_card',
  PASSWORD = 'password',
  AUTH_TOKEN = 'auth_token',
  SSN = 'ssn', // 社会安全号码
  ID_NUMBER = 'id_number',
  DOB = 'date_of_birth',
  COORDINATES = 'geo_coordinates',
  CUSTOM = 'custom',
}

/**
 * 合规标准
 */
export enum ComplianceStandard {
  GDPR = 'gdpr',
  CCPA = 'ccpa',
  HIPAA = 'hipaa',
  PCI = 'pci',
  COPPA = 'coppa',
  CUSTOM = 'custom',
}

/**
 * 脱敏方法
 */
export enum RedactionMethod {
  /**
   * 完全删除字段
   */
  REMOVE = 'remove',

  /**
   * 用固定字符替换
   */
  MASK = 'mask',

  /**
   * 哈希处理
   */
  HASH = 'hash',

  /**
   * 截断处理（保留部分）
   */
  TRUNCATE = 'truncate',

  /**
   * 随机化处理
   */
  RANDOMIZE = 'randomize',

  /**
   * 范围取整(用于数值)
   */
  ROUND = 'round',

  /**
   * 自定义处理函数
   */
  CUSTOM = 'custom',
}

/**
 * 脱敏规则
 */
export interface RedactionRule {
  /**
   * 数据类型或字段路径
   */
  target: SensitiveDataType | string;

  /**
   * 脱敏方法
   */
  method: RedactionMethod;

  /**
   * 额外参数
   */
  options?: {
    /**
     * 替换字符 (用于MASK方法)
     */
    maskChar?: string;

    /**
     * 保留开始字符数 (用于TRUNCATE方法)
     */
    keepStart?: number;

    /**
     * 保留结束字符数 (用于TRUNCATE方法)
     */
    keepEnd?: number;

    /**
     * 哈希算法 (用于HASH方法)
     */
    hashAlgorithm?: string;

    /**
     * 自定义处理函数 (用于CUSTOM方法)
     */
    customFn?: (value: any) => any;

    /**
     * 优先级 (数字越小，优先级越高)
     */
    priority?: number;
  };
}

/**
 * 隐私配置
 */
export interface PrivacyConfig {
  /**
   * 是否启用隐私控制
   */
  enabled: boolean;

  /**
   * 是否强制检查所有数据
   */
  enforceAllData: boolean;

  /**
   * 目标合规标准
   */
  complianceStandards: ComplianceStandard[];

  /**
   * 脱敏规则
   */
  redactionRules: RedactionRule[];

  /**
   * 禁止收集的字段
   */
  blockedFields: string[];

  /**
   * 用户可选择拒绝的数据类型
   */
  optOutTypes: string[];

  /**
   * 是否在控制台显示警告
   */
  showWarnings: boolean;
}

/**
 * 数据脱敏管理器
 */
export class PrivacyManager {
  private config: PrivacyConfig;
  private optOutPreferences: Set<string> = new Set();
  private userConsentGranted: boolean = false;

  // 正则表达式缓存
  private patterns: Record<SensitiveDataType, RegExp> = {
    [SensitiveDataType.EMAIL]: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    [SensitiveDataType.PHONE]: /(\+\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}/g,
    [SensitiveDataType.CREDIT_CARD]: /\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}/g,
    [SensitiveDataType.IP_ADDRESS]: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    [SensitiveDataType.SSN]: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
    [SensitiveDataType.DOB]: /\b\d{2}[.-]\d{2}[.-]\d{4}\b/g,
    [SensitiveDataType.COORDINATES]: /\b-?\d{1,3}\.\d+,\s*-?\d{1,3}\.\d+\b/g,
    [SensitiveDataType.NAME]: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g,
    [SensitiveDataType.PASSWORD]: /\b(password|pwd|passwd|secret)\b/gi,
    [SensitiveDataType.AUTH_TOKEN]: /\b(bearer\s+|token[:=]\s*)[a-zA-Z0-9._~+=]{8,}\b/gi,
    [SensitiveDataType.ID_NUMBER]: /\b[A-Z]{2}\d{6}[A-Z0-9]{1}\b/g,
    [SensitiveDataType.ADDRESS]: /\b\d+\s+[A-Za-z\s]+,\s+[A-Za-z\s]+,\s+[A-Z]{2}\s+\d{5}\b/g,
    [SensitiveDataType.CUSTOM]: /.*/g, // 占位符，将根据配置更新
  };

  /**
   * 创建隐私管理器实例
   * @param config 隐私配置
   */
  constructor(config?: Partial<PrivacyConfig>) {
    // 默认配置
    const defaultConfig: PrivacyConfig = {
      enabled: true,
      enforceAllData: false,
      complianceStandards: [ComplianceStandard.GDPR],
      redactionRules: [
        {
          target: SensitiveDataType.EMAIL,
          method: RedactionMethod.TRUNCATE,
          options: {
            keepStart: 3,
            keepEnd: 5,
          },
        },
        {
          target: SensitiveDataType.PHONE,
          method: RedactionMethod.MASK,
          options: {
            maskChar: '*',
            keepEnd: 4,
          },
        },
        {
          target: SensitiveDataType.CREDIT_CARD,
          method: RedactionMethod.TRUNCATE,
          options: {
            keepEnd: 4,
          },
        },
        {
          target: SensitiveDataType.PASSWORD,
          method: RedactionMethod.REMOVE,
        },
        {
          target: SensitiveDataType.AUTH_TOKEN,
          method: RedactionMethod.MASK,
        },
        {
          target: 'user.id',
          method: RedactionMethod.HASH,
        },
      ],
      blockedFields: ['password', 'creditCard', 'ssn', 'accessToken', 'refreshToken'],
      optOutTypes: ['analytics', 'performance', 'behavior'],
      showWarnings: true,
    };

    this.config = {
      ...defaultConfig,
      ...config,
      redactionRules: [...(defaultConfig.redactionRules || []), ...(config?.redactionRules || [])],
    };

    // 加载已保存的用户选择
    this.loadUserPreferences();
  }

  /**
   * 设置用户同意状态
   * @param granted 是否授予同意
   */
  public setUserConsent(granted: boolean): void {
    this.userConsentGranted = granted;

    // 保存到本地存储
    try {
      localStorage.setItem('pd_privacy_consent', String(granted));
    } catch (e) {
      // 存储可能被禁用
    }
  }

  /**
   * 设置用户退出偏好
   * @param dataType 数据类型
   * @param optOut 是否退出
   */
  public setOptOutPreference(dataType: string, optOut: boolean): void {
    if (optOut) {
      this.optOutPreferences.add(dataType);
    } else {
      this.optOutPreferences.delete(dataType);
    }

    // 保存到本地存储
    this.saveUserPreferences();
  }

  /**
   * 批量设置用户退出偏好
   * @param preferences 偏好设置对象
   */
  public setOptOutPreferences(preferences: Record<string, boolean>): void {
    for (const [dataType, optOut] of Object.entries(preferences)) {
      this.setOptOutPreference(dataType, optOut);
    }
  }

  /**
   * 检查用户是否退出特定数据收集
   * @param dataType 数据类型
   */
  public hasOptedOut(dataType: string): boolean {
    return this.optOutPreferences.has(dataType);
  }

  /**
   * 检查数据收集是否被允许（考虑同意和退出）
   * @param dataType 数据类型
   */
  public isDataCollectionAllowed(dataType: string): boolean {
    if (!this.config.enabled) {
      return true;
    }

    // 检查用户同意状态
    if (
      this.config.complianceStandards.includes(ComplianceStandard.GDPR) ||
      this.config.complianceStandards.includes(ComplianceStandard.CCPA)
    ) {
      if (!this.userConsentGranted) {
        return false;
      }
    }

    // 检查退出偏好
    return !this.hasOptedOut(dataType);
  }

  /**
   * 添加自定义脱敏规则
   * @param rule 规则定义
   */
  public addRedactionRule(rule: RedactionRule): void {
    this.config.redactionRules.push(rule);

    // 根据优先级排序规则
    this.config.redactionRules.sort((a, b) => {
      const priorityA = a.options?.priority || 100;
      const priorityB = b.options?.priority || 100;
      return priorityA - priorityB;
    });
  }

  /**
   * 处理数据，执行脱敏
   * @param data 要处理的数据
   * @param dataType 数据类型（可选）
   * @returns 脱敏后的数据
   */
  public processData(data: any, dataType?: string): any {
    // 如果功能被禁用，直接返回原始数据
    if (!this.config.enabled) {
      return data;
    }

    // 检查用户退出偏好
    if (dataType && this.hasOptedOut(dataType)) {
      return null; // 用户退出了此类数据的收集
    }

    // 根据数据类型处理
    if (typeof data === 'string') {
      return this.redactString(data);
    } else if (typeof data === 'object' && data !== null) {
      return this.redactObject(data);
    }

    return data;
  }

  /**
   * 对字符串应用脱敏
   * @param text 原始字符串
   * @returns 脱敏后的字符串
   */
  private redactString(text: string): string {
    let result = text;

    // 应用所有类型的敏感数据检测
    for (const [type, pattern] of Object.entries(this.patterns)) {
      // 查找匹配该类型的规则
      const rule = this.findRuleForType(type as SensitiveDataType);

      if (rule) {
        // 应用脱敏规则
        result = result.replace(pattern, match => {
          return this.applyRedactionMethod(match, rule.method, rule.options);
        });
      }
    }

    return result;
  }

  /**
   * 对对象应用脱敏规则
   * @param obj 原始对象
   * @returns 脱敏后的对象
   */
  private redactObject(obj: any): any {
    // 处理数组
    if (Array.isArray(obj)) {
      return obj.map(item => this.processData(item));
    }

    const result: Record<string, any> = {};

    // 使用路径对应的规则处理每个字段
    for (const [key, value] of Object.entries(obj)) {
      // 检查是否在阻止列表
      if (this.config.blockedFields.includes(key)) {
        continue;
      }

      // 查找针对特定路径的规则
      const rule = this.findRuleForPath(key);

      if (rule) {
        // 应用规则
        result[key] = this.applyRedactionMethod(value, rule.method, rule.options);
      } else if (typeof value === 'object' && value !== null) {
        // 递归处理嵌套对象
        result[key] = this.processData(value);
      } else if (typeof value === 'string') {
        // 检查字符串中的敏感数据
        result[key] = this.redactString(value);
      } else {
        // 其他类型直接保留
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * 查找适用于特定数据类型的规则
   * @param type 数据类型
   */
  private findRuleForType(type: SensitiveDataType): RedactionRule | undefined {
    return this.config.redactionRules.find(rule => rule.target === type);
  }

  /**
   * 查找适用于特定路径的规则
   * @param path 数据路径
   */
  private findRuleForPath(path: string): RedactionRule | undefined {
    return this.config.redactionRules.find(
      rule =>
        typeof rule.target === 'string' &&
        (rule.target === path || path.endsWith(`.${rule.target}`))
    );
  }

  /**
   * 应用脱敏方法
   * @param value 原始值
   * @param method 脱敏方法
   * @param options 选项
   */
  private applyRedactionMethod(
    value: any,
    method: RedactionMethod,
    options?: RedactionRule['options']
  ): any {
    switch (method) {
      case RedactionMethod.REMOVE:
        return undefined;

      case RedactionMethod.MASK:
        return this.applyMasking(value, options);

      case RedactionMethod.HASH:
        return this.applyHashing(value, options);

      case RedactionMethod.TRUNCATE:
        return this.applyTruncation(value, options);

      case RedactionMethod.RANDOMIZE:
        return this.applyRandomization(value);

      case RedactionMethod.ROUND:
        return this.applyRounding(value);

      case RedactionMethod.CUSTOM:
        return options?.customFn ? options.customFn(value) : value;

      default:
        return value;
    }
  }

  /**
   * 应用掩码方法
   * @param value 原始值
   * @param options 选项
   */
  private applyMasking(value: any, options?: RedactionRule['options']): string {
    if (value === undefined || value === null) {
      return value;
    }

    const str = String(value);
    const maskChar = options?.maskChar || '*';
    const keepStart = options?.keepStart || 0;
    const keepEnd = options?.keepEnd || 0;

    if (str.length <= keepStart + keepEnd) {
      return str;
    }

    const maskedPart = maskChar.repeat(str.length - keepStart - keepEnd);
    return str.substring(0, keepStart) + maskedPart + str.substring(str.length - keepEnd);
  }

  /**
   * 应用哈希方法
   * @param value 原始值
   */
  private applyHashing(value: any): string {
    if (value === undefined || value === null) {
      return value;
    }

    const str = String(value);

    // 简单哈希实现
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // 转换为32位整数
    }

    return `hash_${Math.abs(hash).toString(36)}`;
  }

  /**
   * 应用截断方法
   * @param value 原始值
   * @param options 选项
   */
  private applyTruncation(value: any, options?: RedactionRule['options']): string {
    if (value === undefined || value === null) {
      return value;
    }

    const str = String(value);
    const keepStart = options?.keepStart || 0;
    const keepEnd = options?.keepEnd || 0;

    if (str.length <= keepStart + keepEnd) {
      return str;
    }

    return str.substring(0, keepStart) + '...' + str.substring(str.length - keepEnd);
  }

  /**
   * 应用随机化方法
   * @param value 原始值
   */
  private applyRandomization(value: any): any {
    if (value === undefined || value === null) {
      return value;
    }

    if (typeof value === 'number') {
      // 保持数量级大致相同的随机数
      const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(value))));
      return Math.floor(Math.random() * 9 * magnitude) + magnitude;
    }

    if (typeof value === 'string') {
      // 生成相同长度的随机字符串
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';
      for (let i = 0; i < value.length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    }

    return value;
  }

  /**
   * 应用取整方法
   * @param value 原始值
   */
  private applyRounding(value: any): number {
    if (typeof value !== 'number') {
      return value;
    }

    // 根据数量级决定取整精度
    const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(value))) - 1);
    return Math.round(value / magnitude) * magnitude;
  }

  /**
   * 加载用户隐私偏好
   */
  private loadUserPreferences(): void {
    try {
      // 加载同意状态
      const consent = localStorage.getItem('pd_privacy_consent');
      if (consent !== null) {
        this.userConsentGranted = consent === 'true';
      }

      // 加载退出偏好
      const optOutPrefs = localStorage.getItem('pd_privacy_opt_out');
      if (optOutPrefs) {
        const prefs = JSON.parse(optOutPrefs);
        this.optOutPreferences = new Set(prefs);
      }
    } catch (e) {
      // 存储可能被禁用
      if (this.config.showWarnings) {
        console.warn('[Pandeye] Failed to load privacy preferences:', e);
      }
    }
  }

  /**
   * 保存用户退出偏好
   */
  private saveUserPreferences(): void {
    try {
      localStorage.setItem('pd_privacy_opt_out', JSON.stringify([...this.optOutPreferences]));
    } catch (e) {
      // 存储可能被禁用
      if (this.config.showWarnings) {
        console.warn('[Pandeye] Failed to save privacy preferences:', e);
      }
    }
  }

  /**
   * 检测对象中的敏感信息
   * 返回找到的敏感数据类型和位置
   * @param data 要检查的数据
   */
  public detectSensitiveData(
    data: any
  ): { type: SensitiveDataType; path: string; value: string }[] {
    const results: { type: SensitiveDataType; path: string; value: string }[] = [];

    // 遍历对象寻找敏感信息
    const traverse = (obj: any, path: string = '') => {
      if (obj === null || obj === undefined) {
        return;
      }

      if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          traverse(item, `${path}[${index}]`);
        });
        return;
      }

      if (typeof obj === 'object') {
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key;
          traverse(value, currentPath);
        }
        return;
      }

      // 检查字符串值是否包含敏感信息
      if (typeof obj === 'string') {
        for (const [typeStr, pattern] of Object.entries(this.patterns)) {
          const type = typeStr as SensitiveDataType;
          if (type === SensitiveDataType.CUSTOM) continue;

          pattern.lastIndex = 0; // 重置正则表达式状态
          if (pattern.test(obj)) {
            results.push({
              type,
              path,
              value: obj,
            });
          }
        }
      }
    };

    traverse(data);
    return results;
  }

  /**
   * 更新配置
   * @param config 新配置
   */
  public updateConfig(config: Partial<PrivacyConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      redactionRules: [
        ...(config.redactionRules || []),
        ...this.config.redactionRules.filter(
          rule =>
            !config.redactionRules?.some(
              newRule => newRule.target === rule.target && newRule.method === rule.method
            )
        ),
      ],
    };
  }

  /**
   * 获取当前隐私配置
   */
  public getConfig(): PrivacyConfig {
    return { ...this.config };
  }

  /**
   * 获取用户退出偏好
   */
  public getOptOutPreferences(): string[] {
    return [...this.optOutPreferences];
  }

  /**
   * 获取用户同意状态
   */
  public getUserConsent(): boolean {
    return this.userConsentGranted;
  }

  /**
   * 生成隐私政策HTML
   * 根据当前配置生成适合的隐私政策
   */
  public generatePrivacyPolicyHtml(): string {
    // 示例隐私政策，实际使用时需要根据项目需求定制
    const complianceText = this.config.complianceStandards
      .map(standard => {
        switch (standard) {
          case ComplianceStandard.GDPR:
            return 'GDPR (欧盟通用数据保护条例)';
          case ComplianceStandard.CCPA:
            return 'CCPA (加州消费者隐私法案)';
          case ComplianceStandard.HIPAA:
            return 'HIPAA (美国健康保险隐私及责任法案)';
          case ComplianceStandard.PCI:
            return 'PCI DSS (支付卡行业数据安全标准)';
          case ComplianceStandard.COPPA:
            return 'COPPA (儿童在线隐私保护法)';
          default:
            return standard;
        }
      })
      .join('、');

    const optOutItems = this.config.optOutTypes
      .map(type => {
        let description = '';
        switch (type) {
          case 'analytics':
            description = '使用分析数据，用于改进我们的服务';
            break;
          case 'performance':
            description = '性能监测数据，用于监控系统表现';
            break;
          case 'behavior':
            description = '行为数据，用于了解用户如何使用我们的服务';
            break;
          default:
            description = type;
        }

        return `<li><label><input type="checkbox" data-opt-out="${type}" /> ${description}</label></li>`;
      })
      .join('');

    return `
      <div class="pd-privacy-policy">
        <h2>隐私政策</h2>
        
        <p>我们重视您的隐私。本应用使用 Pandeye 监控服务来收集使用数据，以改进用户体验和应用性能。</p>
        
        <h3>我们收集的数据</h3>
        <ul>
          <li>应用性能数据（加载时间、资源使用等）</li>
          <li>错误报告（应用崩溃和异常）</li>
          <li>使用模式（功能使用频率、导航流程）</li>
        </ul>
        
        <h3>数据保护</h3>
        <p>我们依照 ${complianceText} 的要求处理您的数据。以下数据将被自动脱敏：</p>
        <ul>
          <li>电子邮件地址</li>
          <li>电话号码</li>
          <li>支付信息</li>
          <li>认证令牌</li>
        </ul>
        
        <h3>数据使用选择</h3>
        <p>您可以选择退出以下类型的数据收集：</p>
        <ul class="pd-opt-out-options">
          ${optOutItems}
        </ul>
        
        <div class="pd-consent-actions">
          <button class="pd-accept-button">接受</button>
          <button class="pd-reject-button">拒绝</button>
        </div>
      </div>
    `;
  }
}
