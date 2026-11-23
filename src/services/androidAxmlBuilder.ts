import { ApkBuildConfig, IpaPackageModel } from '../types/migration';

/**
 * Pure TypeScript Android Binary XML (AXML) & Resource Table (resources.arsc) Compiler
 * Produces spec-compliant binary AndroidManifest.xml, resources.arsc, and PNG launcher icons
 * so generated .apk files install cleanly on real Android devices (Android 7.0 – Android 15).
 */

const JAVA_KEYWORDS = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char',
  'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum',
  'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements',
  'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new', 'null',
  'package', 'private', 'protected', 'public', 'return', 'short', 'static',
  'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws',
  'transient', 'true', 'false', 'try', 'void', 'volatile', 'while',
]);

export function sanitizeAndroidPackageName(rawPkg: string): string {
  const cleaned = rawPkg
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
    .replace(/[^a-z0-9_.]/g, '');

  const parts = cleaned
    .split('.')
    .filter((p) => p.length > 0)
    .map((segment) => {
      let seg = segment;
      if (!/^[a-z]/.test(seg)) {
        seg = `app_${seg}`;
      }
      if (JAVA_KEYWORDS.has(seg)) {
        seg = `${seg}_pkg`;
      }
      return seg;
    });

  if (parts.length === 0) return 'com.portbridge.iosapp';
  if (parts.length === 1) return `com.portbridge.${parts[0]}`;
  return parts.join('.');
}

class LeWriter {
  private bytesArr: number[] = [];

  get length(): number {
    return this.bytesArr.length;
  }

  u8(v: number): void {
    this.bytesArr.push(v & 0xff);
  }

  u16(v: number): void {
    this.bytesArr.push(v & 0xff, (v >>> 8) & 0xff);
  }

  u32(v: number): void {
    this.bytesArr.push(
      v & 0xff,
      (v >>> 8) & 0xff,
      (v >>> 16) & 0xff,
      (v >>> 24) & 0xff
    );
  }

  bytes(data: Uint8Array | number[]): void {
    for (let i = 0; i < data.length; i++) {
      this.bytesArr.push(data[i] & 0xff);
    }
  }

  align4(): void {
    while (this.bytesArr.length % 4 !== 0) {
      this.bytesArr.push(0);
    }
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.bytesArr);
  }
}

/**
 * Builds an Android ResStringPool chunk (UTF-16LE encoded, type 0x0001).
 */
function buildResStringPoolChunk(strings: string[]): Uint8Array {
  const stringOffsets: number[] = [];
  const stringData = new LeWriter();

  for (const str of strings) {
    stringOffsets.push(stringData.length);
    const charLen = str.length;
    if (charLen >= 0x8000) {
      stringData.u16(0x8000 | ((charLen >>> 16) & 0x7fff));
      stringData.u16(charLen & 0xffff);
    } else {
      stringData.u16(charLen);
    }
    for (let i = 0; i < charLen; i++) {
      stringData.u16(str.charCodeAt(i));
    }
    stringData.u16(0); // UTF-16 null terminator
  }
  stringData.align4();

  const headerSize = 28;
  const offsetsSize = strings.length * 4;
  const stringsStart = headerSize + offsetsSize;
  const sBytes = stringData.toUint8Array();
  const totalSize = stringsStart + sBytes.byteLength;

  const out = new LeWriter();
  out.u16(0x0001); // RES_STRING_POOL_TYPE
  out.u16(headerSize);
  out.u32(totalSize);
  out.u32(strings.length); // stringCount
  out.u32(0); // styleCount
  out.u32(0); // flags (0 = UTF-16LE)
  out.u32(stringsStart);
  out.u32(0); // stylesStart

  for (const off of stringOffsets) {
    out.u32(off);
  }
  out.bytes(sBytes);
  return out.toUint8Array();
}

const ANDROID_NS_URI = 'http://schemas.android.com/apk/res/android';

// Attribute definitions sorted strictly in ascending order by Android framework resource ID
const ATTR_RESOURCE_DEFS: { name: string; resId: number }[] = [
  { name: 'theme', resId: 0x01010000 },
  { name: 'label', resId: 0x01010001 },
  { name: 'icon', resId: 0x01010002 },
  { name: 'name', resId: 0x01010003 },
  { name: 'exported', resId: 0x01010010 },
  { name: 'screenOrientation', resId: 0x0101001e },
  { name: 'configChanges', resId: 0x0101001f },
  { name: 'minSdkVersion', resId: 0x0101020c },
  { name: 'versionCode', resId: 0x0101021b },
  { name: 'versionName', resId: 0x0101021c },
  { name: 'targetSdkVersion', resId: 0x01010270 },
  { name: 'allowBackup', resId: 0x01010280 },
  { name: 'hardwareAccelerated', resId: 0x010102d3 },
];

interface AxmlAttr {
  nsIdx: number; // -1 (0xFFFFFFFF) if no namespace
  nameIdx: number;
  rawValueIdx: number; // string index if TYPE_STRING, else -1 (0xFFFFFFFF)
  valueType: number; // 0x03=STRING, 0x10=INT_DEC, 0x11=INT_HEX, 0x12=BOOLEAN, 0x01=REFERENCE
  data: number;
  resIdSortKey: number;
}

/**
 * Compiles a valid Binary AndroidManifest.xml (AXML) buffer for Android PackageInstaller.
 */
export function compileBinaryAndroidManifest(
  ipa: IpaPackageModel,
  config: ApkBuildConfig
): Uint8Array {
  const pkgName = sanitizeAndroidPackageName(config.androidPackageName);
  const appLabel = config.appLabel.trim() || ipa.appName || 'PortBridge App';
  const versionName = config.versionName.trim() || '1.0.0';
  const versionCode = Math.max(1, config.versionCode || 100);
  const minSdk = Math.min(35, Math.max(21, config.minSdkVersion || 26));
  const targetSdk = Math.max(minSdk, config.targetSdkVersion || 34);

  const activePerms = Array.from(
    new Set([
      'android.permission.INTERNET',
      'android.permission.VIBRATE',
      ...ipa.permissionsIos
        .filter((p) => p.enabled && p.mappedAndroidPermission.startsWith('android.permission.'))
        .map((p) => p.mappedAndroidPermission),
    ])
  );

  // Build String Pool: FIRST come the resource-mapped attribute names in exact order!
  const poolStrings: string[] = ATTR_RESOURCE_DEFS.map((d) => d.name);

  const ensureStr = (s: string): number => {
    const existing = poolStrings.indexOf(s);
    if (existing !== -1) return existing;
    poolStrings.push(s);
    return poolStrings.length - 1;
  };

  const idxAndroidPrefix = ensureStr('android');
  const idxAndroidUri = ensureStr(ANDROID_NS_URI);
  const idxPackageAttr = ensureStr('package');

  // Tag names
  const idxManifest = ensureStr('manifest');
  const idxUsesSdk = ensureStr('uses-sdk');
  const idxUsesPermission = ensureStr('uses-permission');
  const idxApplication = ensureStr('application');
  const idxActivity = ensureStr('activity');
  const idxIntentFilter = ensureStr('intent-filter');
  const idxAction = ensureStr('action');
  const idxCategory = ensureStr('category');

  // Values
  const idxPkgValue = ensureStr(pkgName);
  const idxVersionNameVal = ensureStr(versionName);
  const idxAppLabelVal = ensureStr(appLabel);
  const idxActivityClassVal = ensureStr('io.portbridge.runtime.PortActivity');
  const idxActionMainVal = ensureStr('android.intent.action.MAIN');
  const idxCatLauncherVal = ensureStr('android.intent.category.LAUNCHER');
  const permValIndices = activePerms.map((p) => ensureStr(p));

  const attrNameIdx = (name: string): { idx: number; resId: number } => {
    const i = ATTR_RESOURCE_DEFS.findIndex((a) => a.name === name);
    if (i === -1) throw new Error(`Unknown Android attr: ${name}`);
    return { idx: i, resId: ATTR_RESOURCE_DEFS[i].resId };
  };

  const strAttr = (name: string, valIdx: number): AxmlAttr => {
    const { idx, resId } = attrNameIdx(name);
    return {
      nsIdx: idxAndroidUri,
      nameIdx: idx,
      rawValueIdx: valIdx,
      valueType: 0x03, // TYPE_STRING
      data: valIdx,
      resIdSortKey: resId,
    };
  };

  const intAttr = (name: string, val: number, hex = false): AxmlAttr => {
    const { idx, resId } = attrNameIdx(name);
    return {
      nsIdx: idxAndroidUri,
      nameIdx: idx,
      rawValueIdx: 0xffffffff,
      valueType: hex ? 0x11 : 0x10, // TYPE_INT_HEX or TYPE_INT_DEC
      data: val >>> 0,
      resIdSortKey: resId,
    };
  };

  const boolAttr = (name: string, val: boolean): AxmlAttr => {
    const { idx, resId } = attrNameIdx(name);
    return {
      nsIdx: idxAndroidUri,
      nameIdx: idx,
      rawValueIdx: 0xffffffff,
      valueType: 0x12, // TYPE_INT_BOOLEAN
      data: val ? 0xffffffff : 0x00000000,
      resIdSortKey: resId,
    };
  };

  const refAttr = (name: string, resRef: number): AxmlAttr => {
    const { idx, resId } = attrNameIdx(name);
    return {
      nsIdx: idxAndroidUri,
      nameIdx: idx,
      rawValueIdx: 0xffffffff,
      valueType: 0x01, // TYPE_REFERENCE
      data: resRef >>> 0,
      resIdSortKey: resId,
    };
  };

  const xmlChunks: Uint8Array[] = [];

  // String Pool Chunk
  xmlChunks.push(buildResStringPoolChunk(poolStrings));

  // Resource Map Chunk (type 0x0180)
  {
    const rm = new LeWriter();
    const rmSize = 8 + ATTR_RESOURCE_DEFS.length * 4;
    rm.u16(0x0180); // RES_XML_RESOURCE_MAP_TYPE
    rm.u16(8);
    rm.u32(rmSize);
    for (const def of ATTR_RESOURCE_DEFS) {
      rm.u32(def.resId);
    }
    xmlChunks.push(rm.toUint8Array());
  }

  let lineNo = 1;

  const emitStartNamespace = (prefixIdx: number, uriIdx: number) => {
    const w = new LeWriter();
    w.u16(0x0100); // RES_XML_START_NAMESPACE_TYPE
    w.u16(16);
    w.u32(24);
    w.u32(lineNo++);
    w.u32(0xffffffff); // comment
    w.u32(prefixIdx);
    w.u32(uriIdx);
    xmlChunks.push(w.toUint8Array());
  };

  const emitEndNamespace = (prefixIdx: number, uriIdx: number) => {
    const w = new LeWriter();
    w.u16(0x0101); // RES_XML_END_NAMESPACE_TYPE
    w.u16(16);
    w.u32(24);
    w.u32(lineNo++);
    w.u32(0xffffffff);
    w.u32(prefixIdx);
    w.u32(uriIdx);
    xmlChunks.push(w.toUint8Array());
  };

  const emitStartElement = (tagNameIdx: number, attrs: AxmlAttr[]) => {
    // Sort attributes: resource-mapped attributes ascending by resId first, then non-namespaced attributes
    const sorted = [...attrs].sort((a, b) => a.resIdSortKey - b.resIdSortKey);
    const w = new LeWriter();
    const totalSize = 36 + sorted.length * 20;
    w.u16(0x0102); // RES_XML_START_ELEMENT_TYPE
    w.u16(16); // headerSize
    w.u32(totalSize);
    w.u32(lineNo++);
    w.u32(0xffffffff); // comment
    w.u32(0xffffffff); // ns
    w.u32(tagNameIdx);
    w.u16(20); // attributeStart (offset from start of ResXMLTree_attrExt)
    w.u16(20); // attributeSize (20 bytes each)
    w.u16(sorted.length); // attributeCount
    w.u16(0); // idIndex
    w.u16(0); // classIndex
    w.u16(0); // styleIndex

    for (const attr of sorted) {
      w.u32(attr.nsIdx >>> 0);
      w.u32(attr.nameIdx >>> 0);
      w.u32(attr.rawValueIdx >>> 0);
      w.u16(8); // Res_value.size = 8
      w.u8(0); // Res_value.res0 = 0
      w.u8(attr.valueType);
      w.u32(attr.data >>> 0);
    }
    xmlChunks.push(w.toUint8Array());
  };

  const emitEndElement = (tagNameIdx: number) => {
    const w = new LeWriter();
    w.u16(0x0103); // RES_XML_END_ELEMENT_TYPE
    w.u16(16);
    w.u32(24);
    w.u32(lineNo++);
    w.u32(0xffffffff);
    w.u32(0xffffffff);
    w.u32(tagNameIdx);
    xmlChunks.push(w.toUint8Array());
  };

  // Build XML Hierarchy
  emitStartNamespace(idxAndroidPrefix, idxAndroidUri);

  // <manifest android:versionCode="..." android:versionName="..." package="...">
  emitStartElement(idxManifest, [
    intAttr('versionCode', versionCode),
    strAttr('versionName', idxVersionNameVal),
    {
      nsIdx: 0xffffffff,
      nameIdx: idxPackageAttr,
      rawValueIdx: idxPkgValue,
      valueType: 0x03,
      data: idxPkgValue,
      resIdSortKey: 0x7fffffff,
    },
  ]);

  // <uses-sdk android:minSdkVersion="..." android:targetSdkVersion="..." />
  emitStartElement(idxUsesSdk, [
    intAttr('minSdkVersion', minSdk),
    intAttr('targetSdkVersion', targetSdk),
  ]);
  emitEndElement(idxUsesSdk);

  // <uses-permission android:name="..." />
  for (const pValIdx of permValIndices) {
    emitStartElement(idxUsesPermission, [strAttr('name', pValIdx)]);
    emitEndElement(idxUsesPermission);
  }

  // Orientation: 1 = portrait, 6 = sensorLandscape, -1 = unspecified (auto-rotate)
  const orientationVal =
    ipa.preferredOrientation === 'portrait'
      ? 1
      : ipa.preferredOrientation === 'landscape'
      ? 6
      : ipa.preferredOrientation === 'unspecified'
      ? 0xffffffff
      : ipa.category === 'game_3d'
      ? 6
      : 0xffffffff;

  // <application android:theme="@android:style/Theme.Black.NoTitleBar.Fullscreen"
  //              android:label="..." android:icon="@drawable/icon"
  //              android:allowBackup="true" android:hardwareAccelerated="true">
  emitStartElement(idxApplication, [
    refAttr('theme', 0x01030007), // Theme.Black.NoTitleBar.Fullscreen
    strAttr('label', idxAppLabelVal),
    refAttr('icon', 0x7f010000), // @drawable/icon in resources.arsc
    boolAttr('allowBackup', true),
    boolAttr('hardwareAccelerated', true),
  ]);

  // <activity android:name="io.portbridge.runtime.PortActivity" android:label="..."
  //           android:exported="true" android:screenOrientation="..." android:configChanges="0x04a0">
  emitStartElement(idxActivity, [
    strAttr('label', idxAppLabelVal),
    strAttr('name', idxActivityClassVal),
    boolAttr('exported', true),
    intAttr('screenOrientation', orientationVal),
    intAttr('configChanges', 0x000004a0, true), // keyboardHidden|orientation|screenSize
  ]);

  // <intent-filter>
  emitStartElement(idxIntentFilter, []);
  emitStartElement(idxAction, [strAttr('name', idxActionMainVal)]);
  emitEndElement(idxAction);
  emitStartElement(idxCategory, [strAttr('name', idxCatLauncherVal)]);
  emitEndElement(idxCategory);
  emitEndElement(idxIntentFilter);

  emitEndElement(idxActivity);
  emitEndElement(idxApplication);
  emitEndElement(idxManifest);
  emitEndNamespace(idxAndroidPrefix, idxAndroidUri);

  // Wrap in outer RES_XML_TYPE (0x0003) header
  const bodySize = xmlChunks.reduce((sum, c) => sum + c.byteLength, 0);
  const finalWriter = new LeWriter();
  finalWriter.u16(0x0003); // RES_XML_TYPE
  finalWriter.u16(8);
  finalWriter.u32(8 + bodySize);
  for (const chunk of xmlChunks) {
    finalWriter.bytes(chunk);
  }
  return finalWriter.toUint8Array();
}

/**
 * Builds a valid Android Binary Resource Table (resources.arsc) mapping
 * resource ID 0x7f010000 (@drawable/icon) -> "res/drawable/icon.png".
 */
export function compileResourcesArsc(rawPackageName: string): Uint8Array {
  const pkgName = sanitizeAndroidPackageName(rawPackageName);
  const globalStringPool = buildResStringPoolChunk(['res/drawable/icon.png']);
  const typeStringPool = buildResStringPoolChunk(['drawable']);
  const keyStringPool = buildResStringPoolChunk(['icon']);

  // ResTable_typeSpec (type 0x0202)
  const typeSpec = new LeWriter();
  typeSpec.u16(0x0202);
  typeSpec.u16(16);
  typeSpec.u32(20);
  typeSpec.u8(1); // type id = 1 ("drawable")
  typeSpec.u8(0);
  typeSpec.u16(0);
  typeSpec.u32(1); // entryCount = 1
  typeSpec.u32(0); // flags[0] = 0
  const typeSpecBytes = typeSpec.toUint8Array();

  // ResTable_type (type 0x0201)
  const resType = new LeWriter();
  const typeHeaderSize = 20 + 28; // 20 bytes fixed + 28 bytes minimal ResTable_config = 48
  const entriesStart = typeHeaderSize + 4; // + 1 uint32 offset = 52
  const typeTotalSize = entriesStart + 16; // + 8 byte ResTable_entry + 8 byte Res_value = 68
  resType.u16(0x0201);
  resType.u16(typeHeaderSize);
  resType.u32(typeTotalSize);
  resType.u8(1); // id = 1 ("drawable")
  resType.u8(0);
  resType.u16(0);
  resType.u32(1); // entryCount = 1
  resType.u32(entriesStart);
  // ResTable_config (28 bytes)
  resType.u32(28);
  for (let i = 0; i < 6; i++) resType.u32(0);
  // entryOffsets[0] = 0
  resType.u32(0);
  // ResTable_entry (8 bytes)
  resType.u16(8); // size
  resType.u16(0); // flags
  resType.u32(0); // key index 0 ("icon")
  // Res_value (8 bytes)
  resType.u16(8); // size
  resType.u8(0); // res0
  resType.u8(0x03); // TYPE_STRING
  resType.u32(0); // index 0 in globalStringPool ("res/drawable/icon.png")
  const resTypeBytes = resType.toUint8Array();

  // ResTable_package (type 0x0200, headerSize = 288)
  const pkgHeaderSize = 288;
  const typeStringsOffset = pkgHeaderSize;
  const keyStringsOffset = pkgHeaderSize + typeStringPool.byteLength;
  const pkgTotalSize =
    pkgHeaderSize +
    typeStringPool.byteLength +
    keyStringPool.byteLength +
    typeSpecBytes.byteLength +
    resTypeBytes.byteLength;

  const pkg = new LeWriter();
  pkg.u16(0x0200); // RES_TABLE_PACKAGE_TYPE
  pkg.u16(pkgHeaderSize);
  pkg.u32(pkgTotalSize);
  pkg.u32(0x7f); // User package ID 0x7f
  // char16_t name[128] (256 bytes)
  for (let i = 0; i < 128; i++) {
    pkg.u16(i < pkgName.length ? pkgName.charCodeAt(i) : 0);
  }
  pkg.u32(typeStringsOffset);
  pkg.u32(1); // lastPublicType
  pkg.u32(keyStringsOffset);
  pkg.u32(1); // lastPublicKey
  pkg.u32(0); // typeIdOffset

  pkg.bytes(typeStringPool);
  pkg.bytes(keyStringPool);
  pkg.bytes(typeSpecBytes);
  pkg.bytes(resTypeBytes);
  const pkgBytes = pkg.toUint8Array();

  // Outer ResTable_header (type 0x0002, headerSize = 12)
  const tableTotalSize = 12 + globalStringPool.byteLength + pkgBytes.byteLength;
  const table = new LeWriter();
  table.u16(0x0002); // RES_TABLE_TYPE
  table.u16(12);
  table.u32(tableTotalSize);
  table.u32(1); // packageCount = 1
  table.bytes(globalStringPool);
  table.bytes(pkgBytes);

  return table.toUint8Array();
}

/**
 * Generates a crisp 192x192 PNG launcher icon matching the iOS app's monogram and color
 * using HTML5 Canvas so Android's launcher displays the exact ported app icon.
 */
export async function generateLauncherIconPng(
  monogram: string,
  accentColor: string
): Promise<Uint8Array> {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 192;
    canvas.height = 192;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Apple iOS squircle-inspired icon with vibrant finish
      ctx.fillStyle = accentColor || '#2563EB';
      ctx.beginPath();
      ctx.roundRect(8, 8, 176, 176, 40);
      ctx.fill();

      // Subtle inner highlight
      const grad = ctx.createLinearGradient(0, 8, 0, 184);
      grad.addColorStop(0, 'rgba(255,255,255,0.22)');
      grad.addColorStop(1, 'rgba(0,0,0,0.18)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(8, 8, 176, 176, 40);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 76px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((monogram || 'AP').slice(0, 2).toUpperCase(), 96, 100);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png')
      );
      if (blob) {
        return new Uint8Array(await blob.arrayBuffer());
      }
    }
  }

  // Minimal valid 1x1 blue PNG fallback for headless environments
  return new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1,
    0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84,
    120, 156, 99, 100, 144, 216, 255, 31, 0, 5, 18, 2, 125, 193, 216, 146, 51,
    0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
  ]);
}
