import { DataCrypto } from './crypto';

/**
 * 导出 Base64 编解码工具函数
 */
export const uint8ArrayToBase64String = DataCrypto.uint8ArrayToBase64String;
export const base64StringToUint8Array = DataCrypto.base64StringToUint8Array;

/**
 * 导出 RSA 加密相关函数
 */
export const importPublicKey = DataCrypto.importPublicKey;
export const encrypt = DataCrypto.encrypt;
export const encryptObject = DataCrypto.encryptObject;
