/**
 * 设备信息收集工具
 * 用于识别和获取用户设备、浏览器、操作系统等信息
 */

import { DeviceInfo } from '../types';

// 为 navigator.connection 定义类型
interface NetworkInformation {
  effectiveType?: string;
  type?: string;
}

interface BrowserInfo {
  browser: string;
  version: string;
}

interface OSInfo {
  os: string;
  version: string;
}

/**
 * 收集设备、浏览器和操作系统信息
 * @returns 设备信息对象
 */
export function collectDeviceInfo(): DeviceInfo {
  const ua = navigator.userAgent;
  const platform = navigator.platform;

  // 解析浏览器信息
  const browserInfo = getBrowserInfo(ua);

  // 解析操作系统信息
  const osInfo = getOSInfo(ua, platform);

  // 解析设备类型
  const deviceType = getDeviceType(ua);

  // 解析网络信息
  const networkType = getNetworkType();

  // 获取屏幕分辨率
  const screenResolution = `${window.screen.width}x${window.screen.height}`;

  return {
    browser: browserInfo.browser,
    browserVersion: browserInfo.version,
    os: osInfo.os,
    osVersion: osInfo.version,
    deviceType,
    networkType,
    screenResolution,
  };
}

/**
 * 获取浏览器名称和版本
 * @param ua - UserAgent 字符串
 * @returns 浏览器名称和版本
 */
function getBrowserInfo(ua: string): BrowserInfo {
  let browser = 'Unknown';
  let version = 'Unknown';

  // 检测常见浏览器
  if (/Edge\/|Edg\//.test(ua)) {
    browser = 'Edge';
    version = extractVersion(ua, /(Edge|Edg)\/([0-9._]+)/);
  } else if (/Chrome\//.test(ua)) {
    browser = 'Chrome';
    version = extractVersion(ua, /Chrome\/([0-9.]+)/);
  } else if (/Firefox\//.test(ua)) {
    browser = 'Firefox';
    version = extractVersion(ua, /Firefox\/([0-9.]+)/);
  } else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) {
    browser = 'Safari';
    version = extractVersion(ua, /Version\/([0-9.]+)/);
  } else if (/MSIE/.test(ua) || /Trident\//.test(ua)) {
    browser = 'Internet Explorer';
    version = /MSIE\s([0-9.]+);/.exec(ua)?.[1] || extractVersion(ua, /rv:([0-9.]+)/);
  } else if (/Opera/.test(ua) || /OPR\//.test(ua)) {
    browser = 'Opera';
    version = /OPR\/([0-9.]+)/.exec(ua)?.[1] || extractVersion(ua, /Version\/([0-9.]+)/);
  }

  return { browser, version };
}

/**
 * 获取操作系统名称和版本
 * @param ua - UserAgent 字符串
 * @param platform - 平台信息
 * @returns 操作系统名称和版本
 */
function getOSInfo(ua: string, _platform: string): OSInfo {
  let os = 'Unknown';
  let version = 'Unknown';

  // 检测常见操作系统
  if (/Windows/.test(ua)) {
    os = 'Windows';
    if (/Windows NT 10.0/.test(ua)) {
      version = '10';
    } else if (/Windows NT 6.3/.test(ua)) {
      version = '8.1';
    } else if (/Windows NT 6.2/.test(ua)) {
      version = '8';
    } else if (/Windows NT 6.1/.test(ua)) {
      version = '7';
    } else if (/Windows NT 6.0/.test(ua)) {
      version = 'Vista';
    } else if (/Windows NT 5.1/.test(ua) || /Windows XP/.test(ua)) {
      version = 'XP';
    }
  } else if (/Macintosh|Mac OS X/.test(ua)) {
    os = 'macOS';
    version = extractVersion(ua, /Mac OS X ([0-9._]+)/);
    version = version.replace(/_/g, '.');
  } else if (/Android/.test(ua)) {
    os = 'Android';
    version = extractVersion(ua, /Android ([0-9.]+)/);
  } else if (/iPhone|iPad|iPod/.test(ua)) {
    os = 'iOS';
    version = extractVersion(ua, /OS ([0-9_]+)/);
    version = version.replace(/_/g, '.');
  } else if (/Linux/.test(ua)) {
    os = 'Linux';
    version = extractVersion(ua, /Linux ([a-z0-9.-]+)/);
  }

  return { os, version };
}

/**
 * 从UA字符串中提取版本号
 * @param ua - UserAgent 字符串
 * @param regex - 匹配版本的正则表达式
 * @returns 提取的版本号或"Unknown"
 */
function extractVersion(ua: string, regex: RegExp): string {
  const match = regex.exec(ua);
  return match?.[1] || 'Unknown';
}

/**
 * 获取设备类型
 * @param ua - UserAgent 字符串
 * @returns 设备类型
 */
function getDeviceType(ua: string): DeviceInfo['deviceType'] {
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobile))/i.test(ua)) {
    return 'tablet';
  } else if (/Mobile|Android|iPhone|iPod|IEMobile|BlackBerry|Opera Mini/i.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

/**
 * 获取网络连接类型
 * 如果浏览器支持 Navigator.connection，则返回具体类型
 * @returns 网络连接类型
 */
function getNetworkType(): string {
  const connection =
    (
      navigator as Navigator & {
        connection?: NetworkInformation;
        mozConnection?: NetworkInformation;
        webkitConnection?: NetworkInformation;
      }
    ).connection ||
    (navigator as Navigator & { mozConnection?: NetworkInformation }).mozConnection ||
    (navigator as Navigator & { webkitConnection?: NetworkInformation }).webkitConnection;

  if (connection) {
    return connection.effectiveType || connection.type || 'Unknown';
  }

  return 'Unknown';
}
