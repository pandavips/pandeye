/**
 * 会话管理工具
 * 用于创建和维护用户会话，便于跟踪用户行为
 */

import { generateUniqueId } from './common';

// 本地存储键名
const SESSION_ID_KEY = 'pandeye_session_id';
const SESSION_START_KEY = 'pandeye_session_start';
const USER_ID_KEY = 'pandeye_user_id';

// 会话超时时间（毫秒）
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30分钟

/**
 * 会话信息接口
 */
interface SessionInfo {
  sessionId: string;
  sessionStart: number;
  userId: string;
  isNewSession: boolean;
}

/**
 * 初始化或恢复会话
 * 检查本地存储中是否存在有效会话，如不存在则创建新会话
 * @returns 会话信息
 */
export function initSession(): SessionInfo {
  // 尝试从存储中获取会话信息
  const existingSessionId = localStorage.getItem(SESSION_ID_KEY);
  const existingSessionStartStr = localStorage.getItem(SESSION_START_KEY);
  const existingSessionStart = existingSessionStartStr ? parseInt(existingSessionStartStr, 10) : 0;

  // 检查会话是否有效（存在且未超时）
  const now = Date.now();
  const isSessionValid =
    existingSessionId && existingSessionStart && now - existingSessionStart < SESSION_TIMEOUT;

  // 获取或创建用户ID（长期标识）
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = generateUniqueId();
    localStorage.setItem(USER_ID_KEY, userId);
  }

  if (isSessionValid) {
    // 更新会话开始时间以延长会话
    updateSessionTimestamp();

    // 返回现有会话信息
    return {
      sessionId: existingSessionId,
      sessionStart: existingSessionStart,
      userId,
      isNewSession: false,
    };
  } else {
    // 创建新会话
    return createNewSession(userId);
  }
}

/**
 * 创建新的会话
 * @param userId - 用户ID
 * @returns 新的会话信息
 */
function createNewSession(userId: string): SessionInfo {
  const sessionId = generateUniqueId();
  const sessionStart = Date.now();

  // 存储会话信息
  localStorage.setItem(SESSION_ID_KEY, sessionId);
  localStorage.setItem(SESSION_START_KEY, sessionStart.toString());

  return {
    sessionId,
    sessionStart,
    userId,
    isNewSession: true,
  };
}

/**
 * 更新会话时间戳，延长会话有效期
 */
export function updateSessionTimestamp(): void {
  const now = Date.now().toString();
  localStorage.setItem(SESSION_START_KEY, now);
}

/**
 * 获取当前会话ID
 * @returns 当前会话ID或空字符串
 */
export function getSessionId(): string {
  return localStorage.getItem(SESSION_ID_KEY) || '';
}

/**
 * 获取用户ID
 * @returns 用户ID或空字符串
 */
export function getUserId(): string {
  return localStorage.getItem(USER_ID_KEY) || '';
}

/**
 * 获取会话持续时间（毫秒）
 * @returns 会话已经持续的时间
 */
export function getSessionDuration(): number {
  const sessionStartStr = localStorage.getItem(SESSION_START_KEY);
  if (!sessionStartStr) return 0;

  const sessionStart = parseInt(sessionStartStr, 10);
  return Date.now() - sessionStart;
}

/**
 * 结束当前会话
 * 清除会话数据，但保留用户ID
 */
export function endSession(): void {
  localStorage.removeItem(SESSION_ID_KEY);
  localStorage.removeItem(SESSION_START_KEY);
}
