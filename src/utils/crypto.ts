/**
 * 提供 RSA 公钥加密功能的工具类
 */
export class DataCrypto {
  static ALGORITHM = 'RSA-OAEP'; // 加密算法
  static CHUNK_SIZE = 190; // RSA-2048 的最大加密长度约为 214 字节，留出空间确保安全

  private constructor() {}

  /**
   * 将 Uint8Array 转换为 Base64 字符串
   */
  static uint8ArrayToBase64String(uint8Array: Uint8Array): string {
    return btoa(String.fromCharCode(...Array.from(uint8Array)));
  }

  /**
   * 将 Base64 字符串转换为 Uint8Array
   */
  static base64StringToUint8Array(str: string): Uint8Array {
    const binaryStr = atob(str);
    const uint8Array = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      uint8Array[i] = binaryStr.charCodeAt(i);
    }
    return uint8Array;
  }

  /**
   * 导入公钥
   * @param publicKeyBase64 - Base64 编码的公钥
   */
  static async importPublicKey(publicKeyBase64: string): Promise<CryptoKey> {
    const binaryKey = this.base64StringToUint8Array(publicKeyBase64);
    return await crypto.subtle.importKey(
      'spki',
      binaryKey,
      {
        name: this.ALGORITHM,
        hash: 'SHA-256',
      },
      false,
      ['encrypt']
    );
  }

  /**
   * 使用公钥加密数据
   * @param data - 要加密的数据
   * @param publicKey - 公钥
   */
  static async encrypt(data: string, publicKey: CryptoKey): Promise<any> {
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(data);
    const chunks = [];

    // 对数据进行分块加密，因为RSA加密有长度限制
    for (let i = 0; i < encodedData.length; i += this.CHUNK_SIZE) {
      const chunk = encodedData.slice(i, i + this.CHUNK_SIZE);
      const encryptedChunk = await crypto.subtle.encrypt(
        { name: this.ALGORITHM },
        publicKey,
        chunk
      );

      chunks.push(this.uint8ArrayToBase64String(new Uint8Array(encryptedChunk)));
    }

    return chunks;
  }

  /**
   * 加密对象
   * @param obj - 要加密的对象
   * @param publicKey - 公钥
   */
  static async encryptObject(obj: any, publicKey: CryptoKey): Promise<string[]> {
    const jsonString = JSON.stringify(obj);
    return await this.encrypt(jsonString, publicKey);
  }
}
