import crypto from 'crypto';
import fs from 'fs';

// 生成RSA密钥对
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048, // 密钥长度
  publicKeyEncoding: {
    type: 'spki', // SubjectPublicKeyInfo
    format: 'pem', // Privacy Enhanced Mail
  },
  privateKeyEncoding: {
    type: 'pkcs8', // PKCS#8
    format: 'pem',
  },
});

// 将密钥保存到文件
fs.writeFileSync('public_key.pem', publicKey);
fs.writeFileSync('private_key.pem', privateKey);

// 转换为Base64格式（移除PEM格式的头尾和换行）
const publicKeyBase64 = publicKey
  .toString()
  .replace('-----BEGIN PUBLIC KEY-----\n', '')
  .replace('\n-----END PUBLIC KEY-----\n', '')
  .replace(/\n/g, '');

const privateKeyBase64 = privateKey
  .toString()
  .replace('-----BEGIN PRIVATE KEY-----\n', '')
  .replace('\n-----END PRIVATE KEY-----\n', '')
  .replace(/\n/g, '');

// 输出Base64格式的密钥
console.log('Public Key (Base64):\n', publicKeyBase64);
console.log('\nPrivate Key (Base64):\n', privateKeyBase64);

// 同时保存Base64格式的密钥到文件
fs.writeFileSync('public_key.txt', publicKeyBase64);
fs.writeFileSync('private_key.txt', privateKeyBase64);
