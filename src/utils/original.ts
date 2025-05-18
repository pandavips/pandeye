// 保留原始对象
export const Original = {
  // console
  consoleLog: console.log,
  consoleError: console.error,
  consoleWarn: console.warn,
  consoleInfo: console.info,
  consoleDebug: console.debug,
  consoleTable: console.table,
  consoleDir: console.dir,
  consoleDirxml: console.dirxml,
  consoleTrace: console.trace,
  consoleGroup: console.group,
  consoleGroupCollapsed: console.groupCollapsed,
  consoleGroupEnd: console.groupEnd,
  consoleClear: console.clear,
  consoleCount: console.count,
  consoleCountReset: console.countReset,
  consoleAssert: console.assert,
  consoleTime: console.time,
  consoleTimeLog: console.timeLog,
  consoleTimeEnd: console.timeEnd,
  consoleTimeStamp: console.timeStamp,
  // network
  fetch: window.fetch.bind(window),
  XMLHttpRequest: window.XMLHttpRequest,
};
