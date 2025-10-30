// Minimal Web Crypto helpers for symmetric AES-GCM encryption
export async function generateSymmetricKey() {
  return await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

export async function exportKeyToBase64(key) {
  const raw = await window.crypto.subtle.exportKey('raw', key)
  const b64 = btoa(String.fromCharCode(...new Uint8Array(raw)))
  return b64
}

export async function importKeyFromBase64(b64) {
  const binary = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  return await window.crypto.subtle.importKey('raw', binary.buffer, 'AES-GCM', true, ['encrypt', 'decrypt'])
}

export function encodeUTF8(str) {
  return new TextEncoder().encode(str)
}

export function decodeUTF8(buf) {
  return new TextDecoder().decode(buf)
}

export async function encryptString(key, plaintext) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const encoded = encodeUTF8(plaintext)
  const cipher = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  const cipherB64 = btoa(String.fromCharCode(...new Uint8Array(cipher)))
  const ivB64 = btoa(String.fromCharCode(...new Uint8Array(iv)))
  return { ciphertext: cipherB64, iv: ivB64 }
}

export async function decryptString(key, ciphertextB64, ivB64) {
  try {
    const cipher = Uint8Array.from(atob(ciphertextB64), c => c.charCodeAt(0))
    const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0))
    const plain = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher.buffer)
    return decodeUTF8(new Uint8Array(plain))
  } catch (err) {
    console.warn('Decryption failed', err)
    return null
  }
}
