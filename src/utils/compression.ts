/**
 * 数据压缩工具
 * 提供高效的数据压缩和解压缩功能
 */

// 基于LZ-字符串的简单压缩算法，适用于浏览器环境
export async function compress(input: string): Promise<string> {
  // 如果浏览器支持原生压缩
  if (typeof CompressionStream !== 'undefined') {
    return await nativeCompress(input);
  }

  // 回退到简单LZ压缩
  return simpleLZCompress(input);
}

// 解压缩数据
export async function decompress(compressed: string): Promise<string> {
  // 如果是原生压缩格式
  if (compressed.startsWith('nativegzip:')) {
    return await nativeDecompress(compressed);
  }

  // 简单LZ压缩解压
  return simpleLZDecompress(compressed);
}

/**
 * 使用浏览器原生CompressionStream进行压缩
 * 支持现代浏览器
 */
async function nativeCompress(input: string): Promise<string> {
  try {
    // 创建一个CompressionStream
    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();

    // 将输入字符串编码为UTF-8并写入压缩流
    const encoder = new TextEncoder();
    const inputBytes = encoder.encode(input);
    writer.write(inputBytes);
    writer.close();

    // 读取压缩结果
    const reader = cs.readable.getReader();
    const chunks: Uint8Array[] = [];
    let totalLength = 0;

    // 使用安全的循环
    let readingDone = false;
    while (!readingDone) {
      const { done, value } = await reader.read();
      if (done) {
        readingDone = true;
        continue;
      }

      chunks.push(value);
      totalLength += value.length;
    }

    // 合并块
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    // 转换为Base64
    const base64 = btoa(String.fromCharCode(...result));

    // 添加标记以便解压缩时识别
    return 'nativegzip:' + base64;
  } catch (e) {
    console.warn('[Pandeye] Native compression failed, falling back to simple compression:', e);
    return simpleLZCompress(input);
  }
}

/**
 * 使用浏览器原生DecompressionStream进行解压缩
 * 支持现代浏览器
 */
async function nativeDecompress(compressed: string): Promise<string> {
  try {
    // 移除前缀标记
    const base64 = compressed.substring('nativegzip:'.length);

    // 从Base64解码
    const binaryString = atob(base64);
    const compressedData = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      compressedData[i] = binaryString.charCodeAt(i);
    }

    // 创建一个DecompressionStream
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();

    // 写入压缩数据
    writer.write(compressedData);
    writer.close();

    // 读取解压缩结果
    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    let totalLength = 0;

    // 使用安全的循环
    let readingDone = false;
    while (!readingDone) {
      const { done, value } = await reader.read();
      if (done) {
        readingDone = true;
        continue;
      }

      chunks.push(value);
      totalLength += value.length;
    }

    // 合并块
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    // 解码为字符串
    const decoder = new TextDecoder();
    return decoder.decode(result);
  } catch (e) {
    console.warn('[Pandeye] Native decompression failed:', e);
    throw new Error('Decompression failed');
  }
}

/**
 * 简单的LZ77压缩实现
 * 用于不支持原生压缩API的浏览器
 */
function simpleLZCompress(input: string): string {
  // 检查输入
  if (!input || input.length === 0) return '';

  // 为了能够更好地处理Unicode字符，先转为UTF-16编码
  const dictionary = new Map<string, number>();
  const result: number[] = [];
  let phrase = '';
  let code = 256; // 从256开始，避开ASCII值

  // 单字符初始化字典
  for (let i = 0; i < 256; i++) {
    dictionary.set(String.fromCharCode(i), i);
  }

  for (let i = 0; i < input.length; i++) {
    const currentChar = input.charAt(i);
    const newPhrase = phrase + currentChar;

    // 如果字典中已有该短语，继续添加
    if (dictionary.has(newPhrase)) {
      phrase = newPhrase;
    } else {
      // 输出短语对应的编码
      result.push(dictionary.get(phrase)!);

      // 将新短语添加到字典
      dictionary.set(newPhrase, code++);

      // 重置当前短语
      phrase = currentChar;

      // 避免字典过大
      if (code > 65536) {
        // 输出特殊标记，表示字典需要重置
        result.push(256);
        code = 256;

        // 重置字典，只保留基本ASCII
        dictionary.clear();
        for (let j = 0; j < 256; j++) {
          dictionary.set(String.fromCharCode(j), j);
        }
      }
    }
  }

  // 处理最后一个短语
  if (phrase !== '') {
    result.push(dictionary.get(phrase)!);
  }

  // 使用变长编码压缩数字序列
  return 'lz77:' + encodeVarInt(result);
}

/**
 * 简单的LZ77解压缩实现
 */
function simpleLZDecompress(compressed: string): string {
  // 移除前缀
  if (compressed.startsWith('lz77:')) {
    compressed = compressed.substring(5);
  } else {
    throw new Error('Invalid compression format');
  }

  // 解码变长整数序列
  const codes = decodeVarInt(compressed);

  // 检查输入
  if (!codes || codes.length === 0) return '';

  // 使用Map代替数组来避免常量赋值问题
  const dictionary = new Map<number, string>();
  let result = '';
  let phrase = '';
  let code = 256; // 从256开始，避开ASCII值

  // 单字符初始化字典
  for (let i = 0; i < 256; i++) {
    dictionary.set(i, String.fromCharCode(i));
  }

  let oldPhrase: string | null = null;
  let currCode: number;

  for (let i = 0; i < codes.length; i++) {
    currCode = codes[i];

    // 检查是否是字典重置标记
    if (currCode === 256) {
      // 重置字典
      code = 256;
      // 清除之前添加的条目（保留ASCII）
      for (let j = 256; j < 65536; j++) {
        dictionary.delete(j);
      }
      continue;
    }

    // 处理当前编码
    if (currCode < 256) {
      // 单字符
      phrase = String.fromCharCode(currCode);
    } else if (dictionary.has(currCode)) {
      // 已知编码
      phrase = dictionary.get(currCode)!;
    } else if (currCode === code && oldPhrase !== null) {
      // 特殊情况：当前编码正好是下一个要分配的编码
      phrase = oldPhrase + oldPhrase.charAt(0);
    } else {
      throw new Error('Invalid compressed data');
    }

    // 添加到结果
    result += phrase;

    // 更新字典
    if (oldPhrase !== null) {
      dictionary.set(code++, oldPhrase + phrase.charAt(0));
    }

    oldPhrase = phrase;

    // 避免字典过大 - 应该与压缩时保持一致
    if (code > 65536) {
      // 下一个编码会是重置标记，所以不需要在这里手动重置
      oldPhrase = null;
    }
  }

  return result;
}

/**
 * 变长整数编码
 * 将整数数组编码为更短的字符串
 */
function encodeVarInt(numbers: number[]): string {
  let result = '';

  for (const num of numbers) {
    let value = num;

    // 7位一组编码，最高位表示是否有更多字节
    let hasMoreBytes = true;
    while (hasMoreBytes) {
      const byte = value & 0x7f; // 取低7位
      value >>= 7; // 右移7位

      if (value === 0) {
        // 最后一个字节，最高位为0
        result += String.fromCharCode(byte);
        hasMoreBytes = false;
      } else {
        // 还有更多字节，最高位设为1
        result += String.fromCharCode(byte | 0x80);
      }
    }
  }

  return result;
}

/**
 * 解码变长整数编码的字符串
 */
function decodeVarInt(encoded: string): number[] {
  const result: number[] = [];
  let i = 0;

  while (i < encoded.length) {
    let value = 0;
    let shift = 0;
    let byte;

    // 读取一个可变长度的整数
    do {
      byte = encoded.charCodeAt(i++);
      value |= (byte & 0x7f) << shift;
      shift += 7;
    } while ((byte & 0x80) !== 0 && i < encoded.length);

    result.push(value);
  }

  return result;
}

/**
 * 检测浏览器是否支持原生压缩API
 */
export function isNativeCompressionSupported(): boolean {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
}
