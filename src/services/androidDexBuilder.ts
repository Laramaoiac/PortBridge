/**
 * Pure TypeScript Dalvik Executable (classes.dex v035) Compiler
 * Builds a 100% valid, ART-verifiable Android DEX binary containing:
 *   package io.portbridge.runtime;
 *   public class PortActivity extends android.app.Activity
 *
 * Fixes:
 *  1. Calls requestWindowFeature(Window.FEATURE_NO_TITLE) BEFORE super.onCreate(savedInstanceState)
 *     in strict compliance with Android Activity lifecycle contract.
 *  2. Enables setAllowFileAccessFromFileURLs(true) and setAllowUniversalAccessFromFileURLs(true)
 *     so HTML5/WebGL/Cordova games and dynamic ports load local JSON, spritesheets, shaders, and
 *     audio via fetch()/XHR from file:///android_asset/ without net::ERR_ACCESS_DENIED.
 */

function encodeUleb128(value: number): number[] {
  const out: number[] = [];
  let v = value >>> 0;
  do {
    let byte = v & 0x7f;
    v >>>= 7;
    if (v !== 0) byte |= 0x80;
    out.push(byte);
  } while (v !== 0);
  return out;
}

function computeAdler32(data: Uint8Array, startOffset: number): number {
  const MOD_ADLER = 65521;
  let a = 1;
  let b = 0;
  for (let i = startOffset; i < data.length; i++) {
    a = (a + data[i]) % MOD_ADLER;
    b = (b + a) % MOD_ADLER;
  }
  return ((b << 16) | a) >>> 0;
}

class BinaryWriter {
  private buf: number[] = [];

  get length(): number {
    return this.buf.length;
  }

  align4(): void {
    while (this.buf.length % 4 !== 0) {
      this.buf.push(0);
    }
  }

  u8(v: number): void {
    this.buf.push(v & 0xff);
  }

  u16(v: number): void {
    this.buf.push(v & 0xff, (v >>> 8) & 0xff);
  }

  u32(v: number): void {
    this.buf.push(
      v & 0xff,
      (v >>> 8) & 0xff,
      (v >>> 16) & 0xff,
      (v >>> 24) & 0xff
    );
  }

  bytes(arr: number[] | Uint8Array): void {
    for (let i = 0; i < arr.length; i++) {
      this.buf.push(arr[i] & 0xff);
    }
  }

  uleb128(v: number): void {
    this.bytes(encodeUleb128(v));
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.buf);
  }
}

let cachedDexBytes: Uint8Array | null = null;

export async function buildPortActivityClassesDex(): Promise<Uint8Array> {
  if (cachedDexBytes) return cachedDexBytes;
  const RUNTIME_ASSET_URL = 'file:///android_asset/apple_port_runtime/index.html';
  return buildVerifiedDexInternal(RUNTIME_ASSET_URL);
}

async function buildVerifiedDexInternal(runtimeUrl: string): Promise<Uint8Array> {
  const rawStrings = [
    '<init>',
    'I',
    'L',
    'Landroid/app/Activity;',
    'Landroid/content/Context;',
    'Landroid/os/Bundle;',
    'Landroid/view/View;',
    'Landroid/webkit/WebSettings;',
    'Landroid/webkit/WebView;',
    'Landroid/webkit/WebViewClient;',
    'Lio/portbridge/runtime/PortActivity;',
    'Ljava/lang/String;',
    'PortActivity.java',
    'V',
    'VL',
    'VZ',
    'Z',
    'ZI',
    'canGoBack',
    runtimeUrl,
    'getSettings',
    'goBack',
    'loadUrl',
    'onBackPressed',
    'onCreate',
    'requestWindowFeature',
    'setAllowFileAccess',
    'setAllowFileAccessFromFileURLs',
    'setAllowUniversalAccessFromFileURLs',
    'setContentView',
    'setDomStorageEnabled',
    'setJavaScriptEnabled',
    'setMediaPlaybackRequiresUserGesture',
    'setWebViewClient',
    'webView',
  ];

  const strings = [...rawStrings].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const sIdx = (s: string): number => {
    const idx = strings.indexOf(s);
    if (idx === -1) throw new Error(`DEX string missing: ${s}`);
    return idx;
  };

  const types = [
    'I',
    'Landroid/app/Activity;',
    'Landroid/content/Context;',
    'Landroid/os/Bundle;',
    'Landroid/view/View;',
    'Landroid/webkit/WebSettings;',
    'Landroid/webkit/WebView;',
    'Landroid/webkit/WebViewClient;',
    'Lio/portbridge/runtime/PortActivity;',
    'Ljava/lang/String;',
    'V',
    'Z',
  ].sort((a, b) => sIdx(a) - sIdx(b));

  const tIdx = (t: string): number => {
    const idx = types.indexOf(t);
    if (idx === -1) throw new Error(`DEX type missing: ${t}`);
    return idx;
  };

  interface ProtoDef {
    key: string;
    shorty: string;
    ret: string;
    params: string[];
  }

  const protos: ProtoDef[] = [
    { key: '()V', shorty: 'V', ret: 'V', params: [] },
    { key: '()Z', shorty: 'Z', ret: 'Z', params: [] },
    { key: '()WebSettings', shorty: 'L', ret: 'Landroid/webkit/WebSettings;', params: [] },
    { key: '(I)Z', shorty: 'ZI', ret: 'Z', params: ['I'] },
    { key: '(Context)V', shorty: 'VL', ret: 'V', params: ['Landroid/content/Context;'] },
    { key: '(Bundle)V', shorty: 'VL', ret: 'V', params: ['Landroid/os/Bundle;'] },
    { key: '(View)V', shorty: 'VL', ret: 'V', params: ['Landroid/view/View;'] },
    { key: '(WebViewClient)V', shorty: 'VL', ret: 'V', params: ['Landroid/webkit/WebViewClient;'] },
    { key: '(String)V', shorty: 'VL', ret: 'V', params: ['Ljava/lang/String;'] },
    { key: '(Z)V', shorty: 'VZ', ret: 'V', params: ['Z'] },
  ].sort((a, b) => {
    const rDiff = tIdx(a.ret) - tIdx(b.ret);
    if (rDiff !== 0) return rDiff;
    const len = Math.min(a.params.length, b.params.length);
    for (let i = 0; i < len; i++) {
      const pDiff = tIdx(a.params[i]) - tIdx(b.params[i]);
      if (pDiff !== 0) return pDiff;
    }
    return a.params.length - b.params.length;
  });

  const pIdx = (key: string): number => {
    const idx = protos.findIndex((p) => p.key === key);
    if (idx === -1) throw new Error(`DEX proto missing: ${key}`);
    return idx;
  };

  const fields = [
    {
      cls: 'Lio/portbridge/runtime/PortActivity;',
      type: 'Landroid/webkit/WebView;',
      name: 'webView',
    },
  ];

  interface MethodDef {
    key: string;
    cls: string;
    name: string;
    proto: string;
  }

  const methods: MethodDef[] = [
    { key: 'Activity.<init>', cls: 'Landroid/app/Activity;', name: '<init>', proto: '()V' },
    { key: 'Activity.onBackPressed', cls: 'Landroid/app/Activity;', name: 'onBackPressed', proto: '()V' },
    { key: 'Activity.onCreate', cls: 'Landroid/app/Activity;', name: 'onCreate', proto: '(Bundle)V' },
    { key: 'Activity.requestWindowFeature', cls: 'Landroid/app/Activity;', name: 'requestWindowFeature', proto: '(I)Z' },
    { key: 'Activity.setContentView', cls: 'Landroid/app/Activity;', name: 'setContentView', proto: '(View)V' },
    { key: 'WebSettings.setAllowFileAccess', cls: 'Landroid/webkit/WebSettings;', name: 'setAllowFileAccess', proto: '(Z)V' },
    { key: 'WebSettings.setAllowFileAccessFromFileURLs', cls: 'Landroid/webkit/WebSettings;', name: 'setAllowFileAccessFromFileURLs', proto: '(Z)V' },
    { key: 'WebSettings.setAllowUniversalAccessFromFileURLs', cls: 'Landroid/webkit/WebSettings;', name: 'setAllowUniversalAccessFromFileURLs', proto: '(Z)V' },
    { key: 'WebSettings.setDomStorageEnabled', cls: 'Landroid/webkit/WebSettings;', name: 'setDomStorageEnabled', proto: '(Z)V' },
    { key: 'WebSettings.setJavaScriptEnabled', cls: 'Landroid/webkit/WebSettings;', name: 'setJavaScriptEnabled', proto: '(Z)V' },
    { key: 'WebSettings.setMediaPlaybackRequiresUserGesture', cls: 'Landroid/webkit/WebSettings;', name: 'setMediaPlaybackRequiresUserGesture', proto: '(Z)V' },
    { key: 'WebView.<init>', cls: 'Landroid/webkit/WebView;', name: '<init>', proto: '(Context)V' },
    { key: 'WebView.canGoBack', cls: 'Landroid/webkit/WebView;', name: 'canGoBack', proto: '()Z' },
    { key: 'WebView.getSettings', cls: 'Landroid/webkit/WebView;', name: 'getSettings', proto: '()WebSettings' },
    { key: 'WebView.goBack', cls: 'Landroid/webkit/WebView;', name: 'goBack', proto: '()V' },
    { key: 'WebView.loadUrl', cls: 'Landroid/webkit/WebView;', name: 'loadUrl', proto: '(String)V' },
    { key: 'WebView.setWebViewClient', cls: 'Landroid/webkit/WebView;', name: 'setWebViewClient', proto: '(WebViewClient)V' },
    { key: 'WebViewClient.<init>', cls: 'Landroid/webkit/WebViewClient;', name: '<init>', proto: '()V' },
    { key: 'PortActivity.<init>', cls: 'Lio/portbridge/runtime/PortActivity;', name: '<init>', proto: '()V' },
    { key: 'PortActivity.onBackPressed', cls: 'Lio/portbridge/runtime/PortActivity;', name: 'onBackPressed', proto: '()V' },
    { key: 'PortActivity.onCreate', cls: 'Lio/portbridge/runtime/PortActivity;', name: 'onCreate', proto: '(Bundle)V' },
  ].sort((a, b) => {
    const cDiff = tIdx(a.cls) - tIdx(b.cls);
    if (cDiff !== 0) return cDiff;
    const nDiff = sIdx(a.name) - sIdx(b.name);
    if (nDiff !== 0) return nDiff;
    return pIdx(a.proto) - pIdx(b.proto);
  });

  const mIdx = (key: string): number => {
    const idx = methods.findIndex((m) => m.key === key);
    if (idx === -1) throw new Error(`DEX method missing: ${key}`);
    return idx;
  };

  const headerOff = 0;
  const stringIdsOff = 0x70;
  const typeIdsOff = stringIdsOff + strings.length * 4;
  const protoIdsOff = typeIdsOff + types.length * 4;
  const fieldIdsOff = protoIdsOff + protos.length * 12;
  const methodIdsOff = fieldIdsOff + fields.length * 8;
  const classDefsOff = methodIdsOff + methods.length * 8;
  const dataOff = classDefsOff + 32;

  const dataWriter = new BinaryWriter();

  // --- DATA SECTION PART 1: type_list items ---
  const protoParamOffsets = new Map<string, number>();
  for (const p of protos) {
    if (p.params.length === 0) {
      protoParamOffsets.set(p.key, 0);
    } else {
      dataWriter.align4();
      protoParamOffsets.set(p.key, dataOff + dataWriter.length);
      dataWriter.u32(p.params.length);
      for (const paramType of p.params) {
        dataWriter.u16(tIdx(paramType));
      }
    }
  }

  // --- DATA SECTION PART 2: code_item blocks ---
  // Code Item 1: PortActivity.<init>()V
  dataWriter.align4();
  const codeInitOff = dataOff + dataWriter.length;
  {
    const mSuperInit = mIdx('Activity.<init>');
    dataWriter.u16(1);
    dataWriter.u16(1);
    dataWriter.u16(1);
    dataWriter.u16(0);
    dataWriter.u32(0);
    dataWriter.u32(4);
    dataWriter.u8(0x70);
    dataWriter.u8(0x10);
    dataWriter.u16(mSuperInit);
    dataWriter.u8(0x00);
    dataWriter.u8(0x00);
    dataWriter.u8(0x0e);
    dataWriter.u8(0x00);
  }

  // Code Item 2: PortActivity.onBackPressed()V
  dataWriter.align4();
  const codeBackOff = dataOff + dataWriter.length;
  {
    const mCanGoBack = mIdx('WebView.canGoBack');
    const mGoBack = mIdx('WebView.goBack');
    const mSuperBack = mIdx('Activity.onBackPressed');
    dataWriter.u16(2);
    dataWriter.u16(1);
    dataWriter.u16(1);
    dataWriter.u16(0);
    dataWriter.u32(0);
    dataWriter.u32(20);
    dataWriter.u8(0x54);
    dataWriter.u8(0x10);
    dataWriter.u16(0);
    dataWriter.u8(0x38);
    dataWriter.u8(0x00);
    dataWriter.u16(0x000e);
    dataWriter.u8(0x6e);
    dataWriter.u8(0x10);
    dataWriter.u16(mCanGoBack);
    dataWriter.u8(0x00);
    dataWriter.u8(0x00);
    dataWriter.u8(0x0a);
    dataWriter.u8(0x00);
    dataWriter.u8(0x38);
    dataWriter.u8(0x00);
    dataWriter.u16(0x0008);
    dataWriter.u8(0x54);
    dataWriter.u8(0x10);
    dataWriter.u16(0);
    dataWriter.u8(0x6e);
    dataWriter.u8(0x10);
    dataWriter.u16(mGoBack);
    dataWriter.u8(0x00);
    dataWriter.u8(0x00);
    dataWriter.u8(0x0e);
    dataWriter.u8(0x00);
    dataWriter.u8(0x6f);
    dataWriter.u8(0x10);
    dataWriter.u16(mSuperBack);
    dataWriter.u8(0x01);
    dataWriter.u8(0x00);
    dataWriter.u8(0x0e);
    dataWriter.u8(0x00);
  }

  // Code Item 3: PortActivity.onCreate(Landroid/os/Bundle;)V
  dataWriter.align4();
  const codeOnCreateOff = dataOff + dataWriter.length;
  {
    const insns = new BinaryWriter();

    // 1. const/4 v2, #int 1 (Window.FEATURE_NO_TITLE) [1 unit]
    insns.u8(0x12);
    insns.u8(0x12);

    // 2. invoke-virtual {v3, v2}, Activity.requestWindowFeature(I)Z — BEFORE super.onCreate! [3 units]
    insns.u8(0x6e);
    insns.u8(0x20);
    insns.u16(mIdx('Activity.requestWindowFeature'));
    insns.u8(0x23);
    insns.u8(0x00);

    // 3. invoke-super {v3, v4}, Activity.onCreate(Bundle)V [3 units]
    insns.u8(0x6f);
    insns.u8(0x20);
    insns.u16(mIdx('Activity.onCreate'));
    insns.u8(0x43);
    insns.u8(0x00);

    // 4. new-instance v0, WebView [2 units]
    insns.u8(0x22);
    insns.u8(0x00);
    insns.u16(tIdx('Landroid/webkit/WebView;'));

    // 5. invoke-direct {v0, v3}, WebView.<init>(Context)V [3 units]
    insns.u8(0x70);
    insns.u8(0x20);
    insns.u16(mIdx('WebView.<init>'));
    insns.u8(0x30);
    insns.u8(0x00);

    // 6. iput-object v0, v3, field@0 [2 units]
    insns.u8(0x5b);
    insns.u8(0x30);
    insns.u16(0);

    // 7. invoke-virtual {v0}, WebView.getSettings()WebSettings [3 units]
    insns.u8(0x6e);
    insns.u8(0x10);
    insns.u16(mIdx('WebView.getSettings'));
    insns.u8(0x00);
    insns.u8(0x00);

    // 8. move-result-object v1 [1 unit]
    insns.u8(0x0c);
    insns.u8(0x01);

    // 9. WebSettings.setJavaScriptEnabled(true) [3 units]
    insns.u8(0x6e);
    insns.u8(0x20);
    insns.u16(mIdx('WebSettings.setJavaScriptEnabled'));
    insns.u8(0x21);
    insns.u8(0x00);

    // 10. WebSettings.setDomStorageEnabled(true) [3 units]
    insns.u8(0x6e);
    insns.u8(0x20);
    insns.u16(mIdx('WebSettings.setDomStorageEnabled'));
    insns.u8(0x21);
    insns.u8(0x00);

    // 11. WebSettings.setAllowFileAccess(true) [3 units]
    insns.u8(0x6e);
    insns.u8(0x20);
    insns.u16(mIdx('WebSettings.setAllowFileAccess'));
    insns.u8(0x21);
    insns.u8(0x00);

    // 12. WebSettings.setAllowFileAccessFromFileURLs(true) — Fixes Bug 2 CORS/file fetch! [3 units]
    insns.u8(0x6e);
    insns.u8(0x20);
    insns.u16(mIdx('WebSettings.setAllowFileAccessFromFileURLs'));
    insns.u8(0x21);
    insns.u8(0x00);

    // 13. WebSettings.setAllowUniversalAccessFromFileURLs(true) — Fixes Bug 2 XHR/WebGL! [3 units]
    insns.u8(0x6e);
    insns.u8(0x20);
    insns.u16(mIdx('WebSettings.setAllowUniversalAccessFromFileURLs'));
    insns.u8(0x21);
    insns.u8(0x00);

    // 14. const/4 v2, #int 0 [1 unit]
    insns.u8(0x12);
    insns.u8(0x02);

    // 15. WebSettings.setMediaPlaybackRequiresUserGesture(false) [3 units]
    insns.u8(0x6e);
    insns.u8(0x20);
    insns.u16(mIdx('WebSettings.setMediaPlaybackRequiresUserGesture'));
    insns.u8(0x21);
    insns.u8(0x00);

    // 16. new-instance v1, WebViewClient [2 units]
    insns.u8(0x22);
    insns.u8(0x01);
    insns.u16(tIdx('Landroid/webkit/WebViewClient;'));

    // 17. invoke-direct {v1}, WebViewClient.<init>()V [3 units]
    insns.u8(0x70);
    insns.u8(0x10);
    insns.u16(mIdx('WebViewClient.<init>'));
    insns.u8(0x01);
    insns.u8(0x00);

    // 18. invoke-virtual {v0, v1}, WebView.setWebViewClient(WebViewClient)V [3 units]
    insns.u8(0x6e);
    insns.u8(0x20);
    insns.u16(mIdx('WebView.setWebViewClient'));
    insns.u8(0x10);
    insns.u8(0x00);

    // 19. invoke-virtual {v3, v0}, Activity.setContentView(View)V [3 units]
    insns.u8(0x6e);
    insns.u8(0x20);
    insns.u16(mIdx('Activity.setContentView'));
    insns.u8(0x03);
    insns.u8(0x00);

    // 20. const-string v1, runtimeUrl [2 units]
    insns.u8(0x1a);
    insns.u8(0x01);
    insns.u16(sIdx(runtimeUrl));

    // 21. invoke-virtual {v0, v1}, WebView.loadUrl(String)V [3 units]
    insns.u8(0x6e);
    insns.u8(0x20);
    insns.u16(mIdx('WebView.loadUrl'));
    insns.u8(0x10);
    insns.u8(0x00);

    // 22. return-void [1 unit]
    insns.u8(0x0e);
    insns.u8(0x00);

    const insnsBytes = insns.toUint8Array();
    dataWriter.u16(5); // registers_size = 5 (v0..v4; v3=this, v4=savedInstanceState)
    dataWriter.u16(2); // ins_size = 2
    dataWriter.u16(2); // outs_size = 2
    dataWriter.u16(0); // tries_size = 0
    dataWriter.u32(0); // debug_info_off = 0
    dataWriter.u32(insnsBytes.byteLength / 2); // exact 16-bit code units (54 units)
    dataWriter.bytes(insnsBytes);
  }

  // --- DATA SECTION PART 3: string_data_item entries ---
  const stringDataOffsets: number[] = [];
  const utf8Encoder = new TextEncoder();
  for (const s of strings) {
    stringDataOffsets.push(dataOff + dataWriter.length);
    const encoded = utf8Encoder.encode(s);
    dataWriter.uleb128(s.length);
    dataWriter.bytes(encoded);
    dataWriter.u8(0);
  }

  // --- DATA SECTION PART 4: class_data_item ---
  const classDataOff = dataOff + dataWriter.length;
  {
    dataWriter.uleb128(0);
    dataWriter.uleb128(1);
    dataWriter.uleb128(1);
    dataWriter.uleb128(2);

    dataWriter.uleb128(0);
    dataWriter.uleb128(0x0002);

    const initIdx = mIdx('PortActivity.<init>');
    dataWriter.uleb128(initIdx);
    dataWriter.uleb128(0x10001);
    dataWriter.uleb128(codeInitOff);

    const backIdx = mIdx('PortActivity.onBackPressed');
    const createIdx = mIdx('PortActivity.onCreate');
    dataWriter.uleb128(backIdx);
    dataWriter.uleb128(0x0001);
    dataWriter.uleb128(codeBackOff);

    dataWriter.uleb128(createIdx - backIdx);
    dataWriter.uleb128(0x0004);
    dataWriter.uleb128(codeOnCreateOff);
  }

  // --- DATA SECTION PART 5: map_list ---
  dataWriter.align4();
  const mapOff = dataOff + dataWriter.length;
  const numTypeLists = Array.from(protoParamOffsets.values()).filter((v) => v > 0).length;
  const firstTypeListOff = Array.from(protoParamOffsets.values()).find((v) => v > 0) || 0;

  interface MapItem {
    type: number;
    size: number;
    offset: number;
  }

  const mapItems: MapItem[] = [
    { type: 0x0000, size: 1, offset: headerOff },
    { type: 0x0001, size: strings.length, offset: stringIdsOff },
    { type: 0x0002, size: types.length, offset: typeIdsOff },
    { type: 0x0003, size: protos.length, offset: protoIdsOff },
    { type: 0x0004, size: fields.length, offset: fieldIdsOff },
    { type: 0x0005, size: methods.length, offset: methodIdsOff },
    { type: 0x0006, size: 1, offset: classDefsOff },
    { type: 0x1001, size: numTypeLists, offset: firstTypeListOff },
    { type: 0x2001, size: 3, offset: codeInitOff },
    { type: 0x2002, size: strings.length, offset: stringDataOffsets[0] },
    { type: 0x2000, size: 1, offset: classDataOff },
    { type: 0x1000, size: 1, offset: mapOff },
  ];

  dataWriter.u32(mapItems.length);
  for (const item of mapItems) {
    dataWriter.u16(item.type);
    dataWriter.u16(0);
    dataWriter.u32(item.size);
    dataWriter.u32(item.offset);
  }
  dataWriter.align4();

  const dataBytes = dataWriter.toUint8Array();
  const totalFileSize = dataOff + dataBytes.byteLength;
  const dataSize = dataBytes.byteLength;

  const dex = new BinaryWriter();

  // 1. Header (112 bytes)
  dex.bytes([0x64, 0x65, 0x78, 0x0a, 0x30, 0x33, 0x35, 0x00]); // "dex\n035\0"
  dex.u32(0);
  for (let i = 0; i < 20; i++) dex.u8(0);
  dex.u32(totalFileSize);
  dex.u32(0x70);
  dex.u32(0x12345678);
  dex.u32(0);
  dex.u32(0);
  dex.u32(mapOff);
  dex.u32(strings.length);
  dex.u32(stringIdsOff);
  dex.u32(types.length);
  dex.u32(typeIdsOff);
  dex.u32(protos.length);
  dex.u32(protoIdsOff);
  dex.u32(fields.length);
  dex.u32(fieldIdsOff);
  dex.u32(methods.length);
  dex.u32(methodIdsOff);
  dex.u32(1);
  dex.u32(classDefsOff);
  dex.u32(dataSize);
  dex.u32(dataOff);

  for (let i = 0; i < strings.length; i++) {
    dex.u32(stringDataOffsets[i]);
  }
  for (const t of types) {
    dex.u32(sIdx(t));
  }
  for (const p of protos) {
    dex.u32(sIdx(p.shorty));
    dex.u32(tIdx(p.ret));
    dex.u32(protoParamOffsets.get(p.key) || 0);
  }
  for (const f of fields) {
    dex.u16(tIdx(f.cls));
    dex.u16(tIdx(f.type));
    dex.u32(sIdx(f.name));
  }
  for (const m of methods) {
    dex.u16(tIdx(m.cls));
    dex.u16(pIdx(m.proto));
    dex.u32(sIdx(m.name));
  }

  dex.u32(tIdx('Lio/portbridge/runtime/PortActivity;'));
  dex.u32(0x0001);
  dex.u32(tIdx('Landroid/app/Activity;'));
  dex.u32(0);
  dex.u32(sIdx('PortActivity.java'));
  dex.u32(0);
  dex.u32(classDataOff);
  dex.u32(0);

  dex.bytes(dataBytes);

  const finalBytes = dex.toUint8Array();

  const sha1Input = finalBytes.buffer.slice(
    finalBytes.byteOffset + 32,
    finalBytes.byteOffset + finalBytes.byteLength
  ) as ArrayBuffer;
  const sha1Buf = await crypto.subtle.digest('SHA-1', sha1Input);
  finalBytes.set(new Uint8Array(sha1Buf), 12);

  const adler = computeAdler32(finalBytes, 12);
  finalBytes[8] = adler & 0xff;
  finalBytes[9] = (adler >>> 8) & 0xff;
  finalBytes[10] = (adler >>> 16) & 0xff;
  finalBytes[11] = (adler >>> 24) & 0xff;

  cachedDexBytes = finalBytes;
  return finalBytes;
}
