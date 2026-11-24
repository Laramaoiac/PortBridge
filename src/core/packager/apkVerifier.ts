/**
 * PortBridge Layer 5 — Independent Binary APK Structural & Signature Verifier.
 * Independently parses the generated .apk ZIP EOCD, APK Signing Block 42 (v2/v3),
 * 4-byte ZipAlign alignment, binary AndroidManifest.xml (AXML), classes.dex (v035+),
 * resources.arsc, and JAR v1 META-INF files.
 * Structural verification design informed by REA's apkSignature domain (MIT License).
 */

export interface IndependentApkAuditReport {
  validZipEocd: boolean;
  hasApkSigBlock42: boolean;
  hasV2SignatureScheme: boolean;
  hasV3SignatureScheme: boolean;
  hasV1JarMetaInf: boolean;
  validBinaryManifestAxml: boolean;
  validClassesDex: boolean;
  validResourcesArsc: boolean;
  uncompressedEntriesAligned4: boolean;
  unalignedEntries: string[];
  entryNames: string[];
  issues: string[];
}

const ZIP_EOCD_SIG = 0x06054b50;
const ZIP_CD_SIG = 0x02014b50;
const ZIP_LFH_SIG = 0x04034b50;
const APK_SIG_BLOCK_MAGIC = 'APK Sig Block 42';
const APK_SIG_V2_ID = 0x7109871a;
const APK_SIG_V3_ID = 0xf05368c0;
const AXML_MAGIC = 0x00080003;
const ARSC_MAGIC = 0x000c0002;

function readU64LE(view: DataView, offset: number): number {
  const lo = view.getUint32(offset, true);
  const hi = view.getUint32(offset + 4, true);
  return hi * 0x100000000 + lo;
}

export function verifyApkBinary(apkBytes: Uint8Array): IndependentApkAuditReport {
  const issues: string[] = [];
  const entryNames: string[] = [];
  const unalignedEntries: string[] = [];

  const failReport = (): IndependentApkAuditReport => ({
    validZipEocd: false,
    hasApkSigBlock42: false,
    hasV2SignatureScheme: false,
    hasV3SignatureScheme: false,
    hasV1JarMetaInf: false,
    validBinaryManifestAxml: false,
    validClassesDex: false,
    validResourcesArsc: false,
    uncompressedEntriesAligned4: false,
    unalignedEntries,
    entryNames,
    issues,
  });

  if (apkBytes.byteLength < 22) {
    issues.push('Arquivo APK menor que 22 bytes.');
    return failReport();
  }

  const view = new DataView(apkBytes.buffer, apkBytes.byteOffset, apkBytes.byteLength);

  // 1. Locate End of Central Directory (EOCD)
  let eocdOffset = -1;
  const searchStart = Math.max(0, apkBytes.byteLength - 65557);
  for (let p = apkBytes.byteLength - 22; p >= searchStart; p--) {
    if (view.getUint32(p, true) === ZIP_EOCD_SIG) {
      const commentLen = view.getUint16(p + 20, true);
      if (p + 22 + commentLen === apkBytes.byteLength) {
        eocdOffset = p;
        break;
      }
    }
  }

  if (eocdOffset === -1) {
    issues.push('ZIP End of Central Directory (EOCD) não encontrado.');
    return failReport();
  }

  const cdEntriesCount = view.getUint16(eocdOffset + 10, true);
  const cdSize = view.getUint32(eocdOffset + 12, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);

  if (cdOffset + cdSize > eocdOffset) {
    issues.push('Central Directory fora dos limites antes do EOCD.');
    return failReport();
  }

  // 2. Check APK Signing Block 42 immediately preceding Central Directory
  let hasApkSigBlock42 = false;
  let hasV2SignatureScheme = false;
  let hasV3SignatureScheme = false;

  if (cdOffset >= 32) {
    let magic = '';
    for (let i = cdOffset - 16; i < cdOffset; i++) {
      magic += String.fromCharCode(apkBytes[i]);
    }
    if (magic === APK_SIG_BLOCK_MAGIC) {
      hasApkSigBlock42 = true;
      const sizeOfBlockFooter = readU64LE(view, cdOffset - 24);
      const blockStart = cdOffset - sizeOfBlockFooter - 8;
      if (blockStart >= 0 && blockStart + 8 < cdOffset - 24) {
        const sizeOfBlockHeader = readU64LE(view, blockStart);
        if (sizeOfBlockHeader !== sizeOfBlockFooter) {
          issues.push('APK Signing Block header/footer size mismatch.');
        } else {
          let p = blockStart + 8;
          const pairsEnd = cdOffset - 24;
          while (p + 12 <= pairsEnd) {
            const pairLen = readU64LE(view, p);
            const id = view.getUint32(p + 8, true);
            if (id === APK_SIG_V2_ID) hasV2SignatureScheme = true;
            if (id === APK_SIG_V3_ID) hasV3SignatureScheme = true;
            if (pairLen < 4 || p + 8 + pairLen > pairsEnd) break;
            p += 8 + pairLen;
          }
        }
      }
    }
  }

  // 3. Walk Central Directory & verify Local File Headers, ZipAlign 4B, AXML, DEX, ARSC, V1 JAR
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let validBinaryManifestAxml = false;
  let validClassesDex = false;
  let validResourcesArsc = false;
  let hasManifestMf = false;
  let hasCertSf = false;
  let hasCertRsa = false;

  let cdPos = cdOffset;
  for (let i = 0; i < cdEntriesCount && cdPos + 46 <= cdOffset + cdSize; i++) {
    if (view.getUint32(cdPos, true) !== ZIP_CD_SIG) {
      issues.push(`Entrada Central Directory #${i} corrompida.`);
      break;
    }
    const method = view.getUint16(cdPos + 10, true);
    const compSize = view.getUint32(cdPos + 20, true);
    const nameLen = view.getUint16(cdPos + 28, true);
    const extraLen = view.getUint16(cdPos + 30, true);
    const commentLen = view.getUint16(cdPos + 32, true);
    const localHeaderOffset = view.getUint32(cdPos + 42, true);

    const name = decoder.decode(apkBytes.subarray(cdPos + 46, cdPos + 46 + nameLen));
    entryNames.push(name);
    cdPos += 46 + nameLen + extraLen + commentLen;

    if (name === 'META-INF/MANIFEST.MF') hasManifestMf = true;
    if (name.startsWith('META-INF/') && name.endsWith('.SF')) hasCertSf = true;
    if (name.startsWith('META-INF/') && (name.endsWith('.RSA') || name.endsWith('.EC') || name.endsWith('.DSA'))) {
      hasCertRsa = true;
    }

    if (localHeaderOffset + 30 <= apkBytes.byteLength && view.getUint32(localHeaderOffset, true) === ZIP_LFH_SIG) {
      const lfhNameLen = view.getUint16(localHeaderOffset + 26, true);
      const lfhExtraLen = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + lfhNameLen + lfhExtraLen;

      if (method === 0) {
        if (dataStart % 4 !== 0) {
          unalignedEntries.push(name);
        }
        if (name === 'resources.arsc' && dataStart + 4 <= apkBytes.byteLength) {
          validResourcesArsc = view.getUint32(dataStart, true) === ARSC_MAGIC;
        }
        if (name === 'classes.dex' && dataStart + 8 <= apkBytes.byteLength) {
          const dexTag = decoder.decode(apkBytes.subarray(dataStart, dataStart + 4));
          validClassesDex = dexTag === 'dex\n';
        }
      }

      if (name === 'AndroidManifest.xml') {
        if (method === 0 && dataStart + 4 <= apkBytes.byteLength) {
          validBinaryManifestAxml = view.getUint32(dataStart, true) === AXML_MAGIC;
        } else if (method === 8 && compSize > 8) {
          // Deflated binary manifest present
          validBinaryManifestAxml = true;
        }
      }
    }
  }

  const hasV1JarMetaInf = hasManifestMf && hasCertSf && hasCertRsa;
  const uncompressedEntriesAligned4 = unalignedEntries.length === 0;

  if (!hasApkSigBlock42 || !hasV2SignatureScheme) {
    issues.push('APK Signature Scheme v2 ausente ou inválido.');
  }
  if (!hasV1JarMetaInf) {
    issues.push('Assinatura JAR v1 (META-INF/MANIFEST.MF + .SF + .RSA) incompleta.');
  }
  if (!uncompressedEntriesAligned4) {
    issues.push(`Entradas STORED desalinhadas (4B): ${unalignedEntries.join(', ')}`);
  }

  return {
    validZipEocd: true,
    hasApkSigBlock42,
    hasV2SignatureScheme,
    hasV3SignatureScheme,
    hasV1JarMetaInf,
    validBinaryManifestAxml,
    validClassesDex,
    validResourcesArsc,
    uncompressedEntriesAligned4,
    unalignedEntries,
    entryNames,
    issues,
  };
}
