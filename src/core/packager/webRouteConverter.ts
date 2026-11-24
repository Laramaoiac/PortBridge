/**
 * Rota web do PortBridge no navegador (PortBridge Studio / Google AI Studio):
 * IPA de app web (Cordova/PhoneGap/Ionic, Capacitor, RPG Maker MV/MZ, Construct,
 * HTML5) -> APK assinado, sem Java nem Android SDK.
 *
 * Faz o mesmo que o conversor Java (android/converter: Ipa, WebApp, Converter) para a
 * rota web e usa o mesmo template (android/web -> public/templates/web.apk). A ponte
 * (bridge.js) vem do código do Android, então o APK gerado aqui é igual ao do app
 * conversor. Como o executável do iOS não é usado, funciona para IPAs de 64 bits e
 * com FairPlay.
 */
import JSZip from 'jszip';
import { parseApplePlist, type PlistValue } from '../../services/bplistParser.ts';
import { convertIosPngToStandardPng } from '../../services/cgbiPngDecoder.ts';
import { buildSignedAlignedApk, type RawApkEntry } from '../../services/apkZipAlignSigner.ts';
import { replaceAxmlStrings } from './axmlStringPool.ts';

/** Valores fixos no AndroidManifest.xml dos templates (Converter.java). */
export const PLACEHOLDER_PACKAGE = 'com.portbridge.rtplaceholder';
export const PLACEHOLDER_LABEL = '@@PB_LABEL@@';
export const PLACEHOLDER_VERSION = '@@PB_VERSION@@';

export interface WebIpaInfo {
  appDir: string;
  name: string;
  bundleId: string;
  version: string;
  executable: string;
  orientation: 'portrait' | 'landscape' | 'any';
  /** null se não é app web (use o conversor desktop/Android para as outras rotas). */
  engine: string | null;
  webRoot: string;
  webStart: string;
  archs: string[];
  fairPlay: boolean;
  warnings: string[];
  packageName: string;
}

export interface WebConversionResult {
  info: WebIpaInfo;
  apk: Uint8Array;
  fileName: string;
  files: number;
  signerSha256: string;
}

type Step = (message: string) => void;

// ------------------------------------------------------------------ Mach-O (mínimo)

function u32be(d: Uint8Array, p: number): number {
  return p + 4 > d.length ? 0 : ((d[p] << 24) | (d[p + 1] << 16) | (d[p + 2] << 8) | d[p + 3]) >>> 0;
}
function u32le(d: Uint8Array, p: number): number {
  return p + 4 > d.length ? 0 : (d[p] | (d[p + 1] << 8) | (d[p + 2] << 16) | (d[p + 3] << 24)) >>> 0;
}

function archName(cpu: number, sub: number): string {
  sub &= 0x00ffffff;
  if (cpu === 12) return sub === 11 ? 'armv7s' : sub === 9 ? 'armv7' : sub === 6 ? 'armv6' : 'armv?';
  if (cpu === 0x0100000c) return sub === 2 ? 'arm64e' : 'arm64';
  if (cpu === 7) return 'i386';
  if (cpu === 0x01000007) return 'x86_64';
  return 'cpu' + cpu;
}

function slices(d: Uint8Array): Array<{ off: number; arch: string }> {
  const out: Array<{ off: number; arch: string }> = [];
  if (u32be(d, 0) === 0xcafebabe) {
    const n = u32be(d, 4);
    for (let i = 0; i < n && 8 + i * 20 + 20 <= d.length; i++) {
      out.push({ off: u32be(d, 16 + i * 20), arch: archName(u32be(d, 8 + i * 20), u32be(d, 12 + i * 20)) });
    }
  } else {
    const m = u32le(d, 0);
    if (m === 0xfeedface || m === 0xfeedfacf) out.push({ off: 0, arch: archName(u32le(d, 4), u32le(d, 8)) });
  }
  return out;
}

/** Algum slice com LC_ENCRYPTION_INFO(_64) e cryptid != 0? */
function encrypted(d: Uint8Array): boolean {
  for (const s of slices(d)) {
    const hdr = u32le(d, s.off) === 0xfeedfacf ? 32 : 28;
    const ncmds = u32le(d, s.off + 16);
    let p = s.off + hdr;
    for (let i = 0; i < ncmds && p + 8 <= d.length; i++) {
      const cmd = u32le(d, p);
      const size = u32le(d, p + 4);
      if ((cmd === 0x21 || cmd === 0x2c) && u32le(d, p + 16) !== 0) return true;
      if (size < 8) break;
      p += size;
    }
  }
  return false;
}

function containsAscii(d: Uint8Array, s: string, nulTerminated = false): boolean {
  const n = new TextEncoder().encode(s);
  outer: for (let i = 0; i + n.length <= d.length; i++) {
    if (d[i] !== n[0]) continue;
    for (let j = 1; j < n.length; j++) if (d[i + j] !== n[j]) continue outer;
    if (!nulTerminated || d[i + n.length] === 0) return true;
  }
  return false;
}

function importsOpenGles(exe: Uint8Array): boolean {
  return ['_glCreateShader', '_glUseProgram', '_glMatrixMode', '_glVertexPointer', '_glLoadIdentity', '_glTexEnvf', '_glTexEnvi']
    .some((s) => containsAscii(exe, s, true));
}

// ------------------------------------------------------------------ detecção (WebApp.java)

function str(v: PlistValue | undefined): string {
  return typeof v === 'string' ? v.trim() : '';
}

function first(...v: string[]): string {
  return v.find((s) => s && s.trim()) ?? '';
}

export function suggestedPackage(bundleId: string): string {
  const parts = bundleId.toLowerCase().replace(/[^a-z0-9.]/g, '_').split('.').filter(Boolean);
  return ['com.portbridge.port', ...parts.map((p) => (/^[a-z]/.test(p) ? p : 'p' + p))].join('.');
}

export function safeFileName(name: string): string {
  const s = name.normalize('NFD').replace(/\p{M}+/gu, '').replace(/[^A-Za-z0-9 ._-]+/g, '').replace(/\s+/g, ' ').trim();
  return s || 'app';
}

async function startPage(rels: Set<string>, read: (p: string) => Promise<string>, root: string): Promise<string | null> {
  const p = root ? root + '/' : '';
  if (rels.has('config.xml') && root === 'www') {
    const m = /<content\s+[^>]*src\s*=\s*"([^"]+)"/.exec(await read('config.xml'));
    if (m) {
      const src = m[1].trim();
      const file = src.split('?')[0];
      if (!src.includes('://') && rels.has(p + file)) return src.replace(/^\//, '');
    }
  }
  return rels.has(p + 'index.html') ? 'index.html' : null;
}

/** {engine, root, start} ou null (mesmas regras de WebApp.java). */
export async function detectWebApp(
  rels: Set<string>,
  exe: Uint8Array,
  read: (relPath: string) => Promise<string>
): Promise<{ engine: string; root: string; start: string } | null> {
  if (rels.has('public/index.html') && (rels.has('capacitor.config.json') || rels.has('public/capacitor.config.json'))) {
    return { engine: rels.has('public/js/rmmz_core.js') ? 'RPG Maker MZ (Capacitor)' : 'Capacitor', root: 'public', start: 'index.html' };
  }
  for (const root of ['www', 'public', '']) {
    const p = root ? root + '/' : '';
    const start = await startPage(rels, read, root);
    if (!start) continue;
    if (rels.has(p + 'js/rpg_core.js')) return { engine: 'RPG Maker MV', root, start };
    if (rels.has(p + 'js/rmmz_core.js')) return { engine: 'RPG Maker MZ', root, start };
    if (rels.has(p + 'c2runtime.js')) return { engine: 'Construct 2', root, start };
    if (rels.has(p + 'scripts/c3runtime.js') || rels.has(p + 'c3runtime.js') || rels.has(p + 'scripts/c3main.js')) {
      return { engine: 'Construct 3', root, start };
    }
    if (rels.has(p + 'cordova.js') || rels.has(p + 'cordova_plugins.js') || rels.has(p + 'phonegap.js')) {
      const cfg = rels.has('config.xml') ? (await read('config.xml')).toLowerCase() : '';
      const file = start.split('?')[0];
      const html = rels.has(p + file) ? (await read(p + file)).toLowerCase() : '';
      const engine = html.includes('ionic') || cfg.includes('ionic') ? 'Ionic (Cordova)'
        : cfg.includes('phonegap') || rels.has(p + 'phonegap.js') ? 'PhoneGap' : 'Cordova';
      return { engine, root, start };
    }
  }
  const webView = containsAscii(exe, '_OBJC_CLASS_$_WKWebView') || containsAscii(exe, '_OBJC_CLASS_$_UIWebView');
  if (webView && !importsOpenGles(exe)) {
    for (const root of ['www', 'html', 'web', 'game', 'assets', '']) {
      if (rels.has((root ? root + '/' : '') + 'index.html')) return { engine: 'HTML5 (WebView)', root, start: 'index.html' };
    }
  }
  return null;
}

/** Lê o IPA e decide se é app web. */
export async function inspectWebIpa(ipaBytes: Uint8Array | ArrayBuffer): Promise<{ info: WebIpaInfo; zip: JSZip }> {
  const zip = await JSZip.loadAsync(ipaBytes);
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
  const plistPath = names.find((n) => /^Payload\/[^/]+\/Info\.plist$/.test(n));
  if (!plistPath) throw new Error('o arquivo não é um IPA (não há Payload/*.app/Info.plist)');
  const appDir = plistPath.slice(0, plistPath.length - 'Info.plist'.length);
  const plist = parseApplePlist(await zip.file(plistPath)!.async('uint8array'));
  const folder = appDir.slice(8, -1).replace(/\.app$/, '');
  const name = first(str(plist.CFBundleDisplayName), str(plist.CFBundleName), folder).normalize('NFC');
  const bundleId = first(str(plist.CFBundleIdentifier), folder);
  const version = first(str(plist.CFBundleShortVersionString), str(plist.CFBundleVersion), '1.0');
  const executable = first(str(plist.CFBundleExecutable), folder);
  let orient: string[] = Array.isArray(plist.UISupportedInterfaceOrientations)
    ? (plist.UISupportedInterfaceOrientations as PlistValue[]).filter((o): o is string => typeof o === 'string')
    : [];
  if (!orient.length && typeof plist.UIInterfaceOrientation === 'string') orient = [plist.UIInterfaceOrientation];
  const anyP = orient.some((o) => o.includes('Portrait'));
  const anyL = orient.some((o) => o.includes('Landscape'));
  const orientation = anyP && !anyL ? 'portrait' : anyL && !anyP ? 'landscape' : 'any';

  const exeEntry = zip.file(appDir + executable);
  const exe = exeEntry ? await exeEntry.async('uint8array') : new Uint8Array(0);
  const rels = new Set(names.filter((n) => n.startsWith(appDir)).map((n) => n.slice(appDir.length)));
  const read = async (rel: string) => (zip.file(appDir + rel) ? await zip.file(appDir + rel)!.async('string') : '');
  const web = await detectWebApp(rels, exe, read);
  const fairPlay = encrypted(exe);
  const warnings: string[] = [];
  if (web && fairPlay) {
    warnings.push('o executável está com FairPlay, mas o conteúdo web não é criptografado: a conversão funciona; '
      + 'só plugins nativos específicos do app ficam sem efeito');
  }
  if (!web) {
    const clickteam = [...rels].some((r) => r.toLowerCase().endsWith('.cci') || r.toLowerCase() === 'application.ccn');
    warnings.push(clickteam
      ? 'jogo Clickteam Fusion: use o conversor Android/desktop (runtime Clickteam do PortBridge)'
      : 'não é um app web; jogos nativos de 32 bits usam o conversor Android/desktop (emulação touchHLE)');
  }
  return {
    zip,
    info: {
      appDir, name, bundleId, version, executable, orientation,
      engine: web?.engine ?? null, webRoot: web?.root ?? '', webStart: web?.start ?? 'index.html',
      archs: slices(exe).map((s) => s.arch), fairPlay, warnings, packageName: suggestedPackage(bundleId),
    },
  };
}

// ------------------------------------------------------------------ conversão (Converter.java)

const STORED_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'mp3', 'ogg', 'oga', 'opus', 'm4a', 'aac', 'mp4', 'm4v',
  'webm', 'ogv', 'woff', 'woff2', 'zip', 'gz', 'br']);

function isCgBI(p: Uint8Array): boolean {
  return p.length > 16 && p[12] === 0x43 && p[13] === 0x67 && p[14] === 0x42 && p[15] === 0x49;
}

function json(s: string): string {
  return JSON.stringify(s);
}

/** assets/portbridge.json (mesmo formato do Converter.metadata). */
export function webMetadata(info: WebIpaInfo): string {
  return '{"name":' + json(info.name) + ',"bundle":' + json(info.bundleId) + ',"version":' + json(info.version)
    + ',"runtime":"web","engine":' + json(info.engine ?? '') + ',"package":' + json(info.packageName)
    + ',"portrait":' + (info.orientation !== 'landscape') + ',"orientation":' + json(info.orientation)
    + ',"web":{"root":' + json(info.webRoot) + ',"start":' + json(info.webStart) + ',"orientation":' + json(info.orientation) + '}'
    + ',"warnings":' + JSON.stringify(info.warnings) + ',"converter":"studio"}';
}

async function pickIcon(zip: JSZip, info: WebIpaInfo): Promise<Uint8Array | null> {
  const art = zip.file('iTunesArtwork');
  if (art) {
    const a = await art.async('uint8array');
    if (a.length > 4 && (a[0] === 0xff || a[1] === 0x50)) return a;
  }
  let best: string | null = null;
  let bestSize = -1;
  for (const n of Object.keys(zip.files)) {
    if (!n.startsWith(info.appDir)) continue;
    const rel = n.slice(info.appDir.length);
    if (rel.includes('/') || !/\.png$/i.test(rel) || !/(icon|artwork)/i.test(rel)) continue;
    // tamanho descomprimido (não é API pública do JSZip, mas existe em todas as versões 3.x)
    const size = (zip.files[n] as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    if (size > bestSize) { bestSize = size; best = n; }
  }
  if (!best) return null;
  const png = await zip.file(best)!.async('uint8array');
  return isCgBI(png) ? await convertIosPngToStandardPng(png) : png;
}

function patchString(s: string, info: WebIpaInfo): string {
  if (s === PLACEHOLDER_PACKAGE) return info.packageName;
  if (s.startsWith(PLACEHOLDER_PACKAGE + '.')) return info.packageName + s.slice(PLACEHOLDER_PACKAGE.length);
  if (s === PLACEHOLDER_LABEL) return info.name;
  if (s === PLACEHOLDER_VERSION) return info.version;
  return s;
}

/**
 * Converte um IPA web em APK assinado.
 * @param template bytes de templates/web.apk (módulo android/web; já traz a ponte)
 * @param bridgeJs outra versão da ponte (opcional; por padrão fica a do template,
 *                 que o CI mantém igual a android/webruntime/.../portbridge/bridge.js)
 */
export async function convertWebIpa(
  ipaBytes: Uint8Array | ArrayBuffer,
  template: Uint8Array | ArrayBuffer,
  bridgeJs?: string | null,
  onStep: Step = () => {}
): Promise<WebConversionResult> {
  onStep('Lendo o IPA');
  const { info, zip } = await inspectWebIpa(ipaBytes);
  if (!info.engine) throw new Error('Este IPA não é um app web: ' + info.warnings.join('; '));
  onStep(`App web detectado: ${info.engine} (conteúdo em ${info.webRoot || 'raiz do .app'}/, página ${info.webStart})`);
  info.warnings.forEach((w) => onStep('Aviso: ' + w));

  const entries: RawApkEntry[] = [];
  const tpl = await JSZip.loadAsync(template);
  if (!tpl.file('portbridge/bridge.js') && !bridgeJs) throw new Error('template web.apk sem a ponte do PortBridge');
  const icon = await pickIcon(zip, info);
  onStep('Montando o APK a partir do template web');
  for (const name of Object.keys(tpl.files)) {
    const f = tpl.files[name];
    if (f.dir || name.startsWith('META-INF/')) continue;
    let data = await f.async('uint8array');
    if (name === 'AndroidManifest.xml') data = replaceAxmlStrings(data, (s) => patchString(s, info));
    else if (name === 'portbridge/bridge.js' && bridgeJs) data = new TextEncoder().encode(bridgeJs);
    else if (icon && /^res\/mipmap-[a-z]+(-v\d+)?\/ic_launcher\.png$/.test(name)) data = icon;
    entries.push({ name, data, storeUncompressed: name === 'resources.arsc' || name.endsWith('.png') });
  }
  entries.push({ name: 'assets/portbridge.json', data: new TextEncoder().encode(webMetadata(info)) });

  onStep(`Copiando o conteúdo web (${info.engine})`);
  const prefix = info.appDir + (info.webRoot ? info.webRoot + '/' : '');
  let files = 0;
  for (const n of Object.keys(zip.files)) {
    const f = zip.files[n];
    if (f.dir || !n.startsWith(prefix)) continue;
    const rel = n.slice(prefix.length);
    if (!rel || rel.includes('..') || rel.startsWith('_CodeSignature/') || rel.endsWith('.DS_Store')) continue;
    if (!info.webRoot && (rel === info.executable || rel === 'Info.plist' || rel === 'embedded.mobileprovision'
      || rel.startsWith('Frameworks/') || rel.startsWith('PlugIns/') || rel === 'PkgInfo')) continue;
    let data = await f.async('uint8array');
    const ext = rel.includes('.') ? rel.slice(rel.lastIndexOf('.') + 1).toLowerCase() : '';
    if (ext === 'png' && isCgBI(data)) data = (await convertIosPngToStandardPng(data)) ?? data;
    entries.push({ name: 'assets/web/' + rel, data, storeUncompressed: STORED_EXT.has(ext) });
    files++;
  }
  onStep(`${files} arquivos em assets/web`);

  onStep('Assinando (APK Signature Scheme v1 + v2)');
  const { apkBytes, verification } = await buildSignedAlignedApk(entries);
  if (!verification.validV2ApkSigBlock || !verification.validZipAlign4) throw new Error('falha ao assinar o APK');
  const fileName = safeFileName(info.name) + '.apk';
  onStep('Pronto: ' + fileName);
  return { info, apk: apkBytes, fileName, files, signerSha256: verification.signerCertFingerprintSha256 };
}
