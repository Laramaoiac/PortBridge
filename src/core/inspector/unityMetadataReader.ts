/**
 * Pure TypeScript Unity IL2CPP global-metadata.dat & UnityFS AssetBundle Header Reader.
 * Extracts exact metadata version, string literal pool bounds, and UnityFS version strings.
 */

export interface Il2cppMetadataHeader {
  valid: boolean;
  magicHex: string;
  version: number;
  stringLiteralOffset: number;
  stringLiteralSize: number;
  stringLiteralDataOffset: number;
  stringLiteralDataSize: number;
  stringOffset: number;
  stringSize: number;
  limitations: string[];
}

export interface UnityFsHeaderInfo {
  valid: boolean;
  signature: string;
  formatVersion: number;
  unityVersion: string;
  unityRevision: string;
  totalSize: number;
}

const IL2CPP_SANITY = 0xfab11baf;

export function inspectIl2cppMetadata(bytes: Uint8Array): Il2cppMetadataHeader {
  if (bytes.byteLength < 32) {
    return {
      valid: false,
      magicHex: '',
      version: 0,
      stringLiteralOffset: 0,
      stringLiteralSize: 0,
      stringLiteralDataOffset: 0,
      stringLiteralDataSize: 0,
      stringOffset: 0,
      stringSize: 0,
      limitations: ['Arquivo muito pequeno para cabeçalho IL2CPP global-metadata.dat.'],
    };
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sanity = view.getUint32(0, true);
  const version = view.getUint32(4, true);
  const magicHex = sanity.toString(16).padStart(8, '0');

  if (sanity !== IL2CPP_SANITY) {
    return {
      valid: false,
      magicHex,
      version,
      stringLiteralOffset: 0,
      stringLiteralSize: 0,
      stringLiteralDataOffset: 0,
      stringLiteralDataSize: 0,
      stringOffset: 0,
      stringSize: 0,
      limitations: [`Sanity inválido (0x${magicHex}, esperado 0xfab11baf). Metadados podem estar ofuscados/criptografados.`],
    };
  }

  const stringLiteralOffset = view.getUint32(8, true);
  const stringLiteralSize = view.getUint32(12, true);
  const stringLiteralDataOffset = view.getUint32(16, true);
  const stringLiteralDataSize = view.getUint32(20, true);
  const stringOffset = view.getUint32(24, true);
  const stringSize = view.getUint32(28, true);

  const limitations: string[] = [];
  if (version < 16 || version > 40) {
    limitations.push(`Versão IL2CPP incomum (${version}); tabela de strings pode ter layout diferente.`);
  }
  if (stringLiteralDataOffset + stringLiteralDataSize > bytes.byteLength) {
    limitations.push('Seção stringLiteralData ultrapassa o tamanho do buffer.');
  }

  return {
    valid: true,
    magicHex,
    version,
    stringLiteralOffset,
    stringLiteralSize,
    stringLiteralDataOffset,
    stringLiteralDataSize,
    stringOffset,
    stringSize,
    limitations,
  };
}

function readNullTermAscii(bytes: Uint8Array, start: number): { value: string; nextOffset: number } {
  let end = start;
  while (end < bytes.byteLength && bytes[end] !== 0 && end - start < 128) {
    end++;
  }
  let s = '';
  for (let i = start; i < end; i++) s += String.fromCharCode(bytes[i]);
  return { value: s, nextOffset: Math.min(bytes.byteLength, end + 1) };
}

export function inspectUnityFsHeader(bytes: Uint8Array): UnityFsHeaderInfo {
  if (bytes.byteLength < 24) {
    return {
      valid: false,
      signature: '',
      formatVersion: 0,
      unityVersion: '',
      unityRevision: '',
      totalSize: 0,
    };
  }
  const sig = readNullTermAscii(bytes, 0);
  if (sig.value !== 'UnityFS' && sig.value !== 'UnityRaw' && sig.value !== 'UnityWeb') {
    return {
      valid: false,
      signature: sig.value,
      formatVersion: 0,
      unityVersion: '',
      unityRevision: '',
      totalSize: 0,
    };
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (sig.nextOffset + 4 > bytes.byteLength) {
    return { valid: false, signature: sig.value, formatVersion: 0, unityVersion: '', unityRevision: '', totalSize: 0 };
  }
  const formatVersion = view.getUint32(sig.nextOffset, false);
  const ver = readNullTermAscii(bytes, sig.nextOffset + 4);
  const rev = readNullTermAscii(bytes, ver.nextOffset);

  let totalSize = 0;
  if (rev.nextOffset + 8 <= bytes.byteLength) {
    const hi = view.getUint32(rev.nextOffset, false);
    const lo = view.getUint32(rev.nextOffset + 4, false);
    totalSize = hi * 0x100000000 + lo;
  }

  return {
    valid: true,
    signature: sig.value,
    formatVersion,
    unityVersion: ver.value,
    unityRevision: rev.value,
    totalSize,
  };
}
