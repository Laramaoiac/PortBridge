import { ApkBuildConfig, IpaPackageModel, SaveKeyValuePair } from '../types/migration';

export interface ArtworkAssetMeta {
  path: string;
  originalName: string;
  width: number;
  height: number;
}

export interface SpriteFrameRect {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated?: boolean;
}

export interface SpriteAtlasMeta {
  plistName: string;
  textureName?: string;
  matchedSheetPath?: string;
  frames: SpriteFrameRect[];
}

export interface ExtractedAssetManifest {
  iconRelativePath?: string;
  coverArtRelativePath?: string;
  artworkPaths: string[];
  artworkMeta?: ArtworkAssetMeta[];
  spriteAtlases?: SpriteAtlasMeta[];
  audioPaths: string[];
  configFilesSummary?: { name: string; preview: string }[];
  cciFrameNames?: string[];
}

/**
 * Generates a self-contained, crash-safe, genre-adaptive HTML5/Canvas runtime
 * embedded at `assets/apple_port_runtime/index.html` inside the compiled Android .APK.
 */
export function buildEmbeddedApplePortHtml(
  ipa: IpaPackageModel,
  config: ApkBuildConfig,
  saves: SaveKeyValuePair[],
  extractedManifest?: ExtractedAssetManifest,
  machOSymbols?: string[]
): string {
  const initialSavesObj: Record<string, string> = {};
  for (const s of saves) {
    initialSavesObj[s.key] = s.value;
  }

  const serializedMeta = JSON.stringify({
    appName: config.appLabel || ipa.appName,
    bundleId: ipa.bundleId,
    version: config.versionName || ipa.version,
    category: ipa.category,
    accentColor: ipa.iconAccentColor || '#2563EB',
    monogram: ipa.iconMonogram || 'AP',
    highRefresh: config.enableHighRefreshRate,
    isCustomUpload: Boolean(ipa.isCustomUpload),
    initialSaves: initialSavesObj,
    iconPath: extractedManifest?.iconRelativePath || null,
    coverPath: extractedManifest?.coverArtRelativePath || extractedManifest?.iconRelativePath || null,
    artworkPaths: extractedManifest?.artworkPaths || [],
    artworkMeta: extractedManifest?.artworkMeta || [],
    spriteAtlases: extractedManifest?.spriteAtlases || [],
    audioPaths: extractedManifest?.audioPaths || [],
    cciScenes: extractedManifest?.cciFrameNames || [],
    machOSymbols: (machOSymbols || []).slice(0, 120),
  }).replace(/</g, '\\u003c');

  const safeTitle = (config.appLabel || ipa.appName).replace(/[<>&]/g, '');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<title>${safeTitle}</title>
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; user-select: none; margin: 0; padding: 0; }
  html, body {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #090D16;
    color: #F8FAFC;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
  }
  #app {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
    padding-top: env(safe-area-inset-top, 0px);
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  canvas { display: block; width: 100%; height: 100%; touch-action: none; }
  .hud-top {
    position: absolute;
    top: calc(10px + env(safe-area-inset-top, 0px));
    left: 12px;
    right: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    pointer-events: none;
    z-index: 10;
  }
  .hud-card {
    background: rgba(9, 13, 22, 0.80);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.18);
    padding: 6px 11px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 700;
    color: #F8FAFC;
    pointer-events: auto;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .hud-card img { width: 20px; height: 20px; border-radius: 5px; object-fit: cover; }
  .splash-overlay {
    position: absolute;
    inset: 0;
    z-index: 25;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 24px;
    background: radial-gradient(circle at center, rgba(15,23,42,0.74) 0%, rgba(9,13,22,0.95) 100%);
    backdrop-filter: blur(6px);
    text-align: center;
  }
  .splash-cover {
    width: 108px;
    height: 108px;
    border-radius: 24px;
    object-fit: cover;
    box-shadow: 0 16px 38px rgba(0,0,0,0.55);
    border: 2px solid rgba(255,255,255,0.22);
  }
  .splash-btn {
    margin-top: 4px;
    background: #2563EB;
    color: #FFF;
    border: none;
    border-radius: 12px;
    padding: 13px 28px;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.3px;
    box-shadow: 0 8px 24px rgba(37,99,235,0.45);
  }
  .splash-btn:active { transform: scale(0.97); }
  .controls-layer {
    position: absolute;
    bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    left: 16px;
    right: 16px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    pointer-events: none;
    z-index: 10;
  }
  .dpad { display: grid; grid-template-columns: repeat(3, 46px); grid-template-rows: repeat(3, 46px); gap: 4px; pointer-events: auto; }
  .lr-pad { display: flex; gap: 10px; pointer-events: auto; }
  .btn-pad {
    background: rgba(255,255,255,0.16);
    border: 1px solid rgba(255,255,255,0.28);
    color: #fff;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .btn-pad:active { background: rgba(37, 99, 235, 0.82); }
  .ab-cluster { display: flex; gap: 12px; pointer-events: auto; align-items: center; }
  .btn-action {
    min-width: 64px;
    height: 56px;
    padding: 0 14px;
    border-radius: 16px;
    border: 1.5px solid rgba(255,255,255,0.35);
    color: #fff;
    font-weight: 800;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 6px 16px rgba(0,0,0,0.38);
  }
  .btn-a { background: rgba(37, 99, 235, 0.90); }
  .btn-b { background: rgba(217, 119, 6, 0.90); }

  /* Cupertino iOS App Shell */
  .cupertino-root { width: 100%; height: 100%; background: #F2F2F7; color: #000; display: flex; flex-direction: column; }
  .cupertino-nav {
    background: rgba(249,249,249,0.94);
    border-bottom: 0.5px solid rgba(0,0,0,0.16);
    padding: 16px 18px 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .cupertino-brand { display: flex; align-items: center; gap: 12px; }
  .cupertino-icon { width: 40px; height: 40px; border-radius: 10px; object-fit: cover; flex-shrink: 0; }
  .cupertino-title { font-size: 22px; font-weight: 700; letter-spacing: -0.4px; color: #000; }
  .cupertino-sub { font-size: 12px; color: #6E6E73; font-weight: 500; }
  .cupertino-body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 16px; }
  .cupertino-card { background: #FFF; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
  .cupertino-row { display: flex; justify-content: space-between; align-items: center; padding: 13px 16px; border-bottom: 0.5px solid rgba(0,0,0,0.08); font-size: 15px; gap: 12px; }
  .cupertino-row:last-child { border-bottom: none; }
  .cupertino-btn { background: #007AFF; color: #FFF; border: none; border-radius: 10px; padding: 10px 16px; font-size: 14px; font-weight: 600; }
  .cupertino-input { flex: 1; border: 1px solid rgba(0,0,0,0.14); border-radius: 10px; padding: 10px 12px; font-size: 15px; background: #FFF; color: #000; outline: none; }
  .asset-gallery { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 12px; }
  .asset-thumb { width: 100%; aspect-ratio: 1; object-fit: contain; background: #F8FAFC; border-radius: 10px; padding: 6px; border: 0.5px solid rgba(0,0,0,0.08); }

  /* Synth Studio Styles */
  .synth-root { width: 100%; height: 100%; background: #090D16; color: #F8FAFC; display: flex; flex-direction: column; padding: 16px; gap: 14px; }
  .synth-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); }
  .synth-controls { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .synth-box { background: #111827; border: 1px solid #1F2937; border-radius: 12px; padding: 10px 12px; }
  .synth-keys { flex: 1; display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; min-height: 140px; }
  .synth-key { background: linear-gradient(180deg, #1E293B 0%, #0F172A 100%); border: 1px solid #334155; border-radius: 10px; color: #E2E8F0; font-weight: 700; font-size: 14px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 16px; }
  .synth-key.active { background: linear-gradient(180deg, #F59E0B 0%, #D97706 100%); color: #090D16; border-color: #FDE68A; }
</style>
</head>
<body>
<div id="app"></div>
<script>
(function() {
  var META = ${serializedMeta};
  var STORAGE_KEY = 'app_state_' + META.bundleId;
  var saves = Object.assign({}, META.initialSaves);
  try {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      saves = Object.assign(saves, JSON.parse(stored));
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
    }
  } catch (e) {}

  function setSave(k, v) {
    saves[k] = String(v);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saves)); } catch (e) {}
  }

  var audioCtx = null;
  var sfxPool = [];
  var sfxByName = [];
  var bgmAudio = null;
  if (META.audioPaths && META.audioPaths.length > 0) {
    META.audioPaths.forEach(function(p, idx) {
      try {
        var a = new Audio(p);
        var lower = p.toLowerCase();
        if (!bgmAudio && (lower.indexOf('bgm') >= 0 || lower.indexOf('music') >= 0 || lower.indexOf('theme') >= 0 || lower.indexOf('shop') >= 0 || lower.indexOf('loop') >= 0 || (META.audioPaths.length > 2 && idx === 0 && lower.indexOf('.mp3') >= 0))) {
          a.loop = true;
          a.volume = 0.40;
          bgmAudio = a;
        } else {
          a.volume = 0.75;
          sfxPool.push(a);
          sfxByName.push({ key: lower, clip: a });
        }
      } catch (e) {}
    });
  }

  var sfxCursor = 0;
  function playSfx(freq, dur, type) {
    if (sfxPool.length > 0) {
      try {
        var clip = sfxPool[sfxCursor % sfxPool.length];
        sfxCursor++;
        clip.currentTime = 0;
        clip.play().catch(function(){});
        return;
      } catch (e) {}
    }
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var osc = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      osc.type = type || 'triangle';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      g.gain.setValueAtTime(0.11, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (dur || 0.14));
      osc.connect(g);
      g.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + (dur || 0.14));
    } catch (e) {}
  }

  function playNamedSfx(keywords, freq, dur, type) {
    if (sfxByName.length > 0 && keywords && keywords.length > 0) {
      for (var k = 0; k < keywords.length; k++) {
        var kw = keywords[k].toLowerCase();
        for (var i = 0; i < sfxByName.length; i++) {
          if (sfxByName[i].key.indexOf(kw) >= 0) {
            try {
              sfxByName[i].clip.currentTime = 0;
              sfxByName[i].clip.play().catch(function(){});
              return;
            } catch (e) {}
          }
        }
      }
    }
    playSfx(freq, dur, type);
  }

  function startBgmIfAvailable() {
    if (bgmAudio) {
      try { bgmAudio.play().catch(function(){}); } catch (e) {}
    }
  }

  var imagesByPath = {};
  var loadedMetaList = [];
  var rawMeta = (META.artworkMeta && META.artworkMeta.length > 0)
    ? META.artworkMeta
    : (META.artworkPaths || []).map(function(p) {
        return { path: p, originalName: p.split('/').pop() || p, width: 128, height: 128 };
      });

  rawMeta.forEach(function(m) {
    var img = new Image();
    img.onload = function() {
      if (img.naturalWidth > 0) {
        imagesByPath[m.path] = img;
        loadedMetaList.push({ meta: m, img: img, w: img.naturalWidth || m.width, h: img.naturalHeight || m.height });
      }
    };
    img.src = m.path;
  });

  if (META.coverPath && !imagesByPath[META.coverPath]) {
    var covImg = new Image();
    covImg.onload = function() { if (covImg.naturalWidth > 0) imagesByPath[META.coverPath] = covImg; };
    covImg.src = META.coverPath;
  }
  if (META.iconPath && !imagesByPath[META.iconPath]) {
    var icImg = new Image();
    icImg.onload = function() { if (icImg.naturalWidth > 0) imagesByPath[META.iconPath] = icImg; };
    icImg.src = META.iconPath;
  }

  function resolveSpritePools() {
    var playerSprites = [];
    var enemySprites = [];
    var itemSprites = [];
    var bulletSprites = [];
    var bgList = [];
    var bgImage = null;

    var atlasUsedPaths = {};
    if (META.spriteAtlases && META.spriteAtlases.length > 0) {
      META.spriteAtlases.forEach(function(atlas) {
        var sheetPath = atlas.matchedSheetPath || null;
        if (!sheetPath && atlas.textureName) {
          var baseTex = atlas.textureName.toLowerCase().replace(/\.[a-z0-9]+$/, '');
          for (var i = 0; i < rawMeta.length; i++) {
            var cand = rawMeta[i].originalName.toLowerCase().replace(/\.[a-z0-9]+$/, '');
            if (cand === baseTex || cand.indexOf(baseTex) >= 0 || baseTex.indexOf(cand) >= 0) {
              sheetPath = rawMeta[i].path;
              break;
            }
          }
        }
        if (!sheetPath && rawMeta.length > 0) {
          var sorted = rawMeta.slice().sort(function(a, b) { return (b.width * b.height) - (a.width * a.height); });
          sheetPath = sorted[0].path;
        }
        var sheetImg = sheetPath ? imagesByPath[sheetPath] : null;
        if (sheetImg && sheetImg.complete && sheetImg.naturalWidth > 0 && atlas.frames && atlas.frames.length > 0) {
          atlasUsedPaths[sheetPath] = true;
          atlas.frames.forEach(function(f) {
            if (f.w < 8 || f.h < 8) return;
            var lname = f.name.toLowerCase();
            var entry = { img: sheetImg, sx: f.x, sy: f.y, sw: f.w, sh: f.h, name: lname };
            if (/bg|back|sky|ground|map|title|menu|panel|btn|button|font|logo/.test(lname)) {
              if (f.w >= 240 && f.h >= 180) {
                bgList.push(entry);
                if (!bgImage) bgImage = entry;
              }
              return;
            }
            if (/axe|weapon|hammer|bullet|shot|laser|fire|proj|arrow|sword|knife/.test(lname)) bulletSprites.push(entry);
            else if (/meat|food|chicken|drumstick|coin|star|gem|item|bonus|heart|orb|gold|candy|fowl/.test(lname)) itemSprites.push(entry);
            else if (/bird|crow|duck|pigeon|owl|vulture|enemy|mob|monster|boss|wizard|zombie|alien|bat|obs/.test(lname)) enemySprites.push(entry);
            else if (/player|hero|char|zorbie|idle|walk|run|jump|ship|knight|avatar/.test(lname)) playerSprites.push(entry);
            else if (f.w <= 220 && f.h <= 220) {
              if (playerSprites.length < 4) playerSprites.push(entry);
              else if (enemySprites.length < 6) enemySprites.push(entry);
              else itemSprites.push(entry);
            }
          });
        }
      });
    }

    loadedMetaList.forEach(function(item) {
      var p = item.meta.path;
      if (atlasUsedPaths[p] || !item.img.complete || item.img.naturalWidth === 0) return;
      var lname = (item.meta.originalName || p).toLowerCase();
      var w = item.w, h = item.h;
      var fullEntry = { img: item.img, sx: 0, sy: 0, sw: w, sh: h, name: lname };

      // Stage / Scene backgrounds (Clickteam 320x512, 384x568, 384x600 or wide landscapes)
      if (
        (w >= 240 && h >= 220 && (/bg|back|stage|map|sky|scene|world|level|field|floor/.test(lname) || (w >= 300 && h >= 300))) ||
        (!bgImage && w >= 300 && h >= 240 && !/sheet|atlas|font|ui/.test(lname))
      ) {
        bgList.push(fullEntry);
        if (!bgImage) bgImage = fullEntry;
        return;
      }
      if (w >= h * 2.5 && h >= 20 && h <= 200 && /walk|run|idle|anim|strip|sprite|player|enemy|zorbie|bird/.test(lname)) {
        var frameCount = Math.max(2, Math.min(8, Math.round(w / h)));
        var fw = Math.floor(w / frameCount);
        for (var fi = 0; fi < frameCount; fi++) {
          var slice = { img: item.img, sx: fi * fw, sy: 0, sw: fw, sh: h, name: lname + '_' + fi };
          if (/bird|enemy|mob|monster|zombie|boss/.test(lname)) enemySprites.push(slice);
          else playerSprites.push(slice);
        }
        return;
      }
      if (/font|btn|button|logo|title|splash|default|launch|joyback|fire1d/.test(lname)) return;
      if (w <= 300 && h <= 300) {
        if (/axe|weapon|bullet|shot|laser|fire|arrow|proj/.test(lname)) bulletSprites.push(fullEntry);
        else if (/meat|food|coin|star|gem|item|heart|orb|bonus|gold/.test(lname)) itemSprites.push(fullEntry);
        else if (/bird|crow|enemy|mob|monster|boss|zombie|alien|spike|obs/.test(lname)) enemySprites.push(fullEntry);
        else if (/player|hero|char|zorbie|ship|main|avatar/.test(lname)) playerSprites.push(fullEntry);
        else if (w >= 52 && h >= 56 && w <= 136 && h <= 148 && playerSprites.length < 6) playerSprites.push(fullEntry);
        else if (w >= 24 && h >= 24 && w <= 48 && h <= 48 && bulletSprites.length < 4) bulletSprites.push(fullEntry);
        else if (w >= 32 && h >= 32 && w <= 56 && h <= 56 && itemSprites.length < 6) itemSprites.push(fullEntry);
        else if (enemySprites.length < 18) enemySprites.push(fullEntry);
        else itemSprites.push(fullEntry);
      }
    });

    return {
      bg: bgImage,
      bgList: bgList,
      player: playerSprites,
      enemy: enemySprites,
      item: itemSprites,
      bullet: bulletSprites
    };
  }

  function drawSpriteEntry(ctx, sp, cx, cy, targetSize, flipX, angleRad) {
    if (!sp || !sp.img || !sp.img.complete || sp.img.naturalWidth === 0) return false;
    var ratio = sp.sw / Math.max(1, sp.sh);
    var dw = ratio >= 1 ? targetSize : targetSize * ratio;
    var dh = ratio >= 1 ? targetSize / ratio : targetSize;
    ctx.save();
    ctx.translate(cx, cy);
    if (angleRad) ctx.rotate(angleRad);
    if (flipX) ctx.scale(-1, 1);
    ctx.drawImage(sp.img, sp.sx, sp.sy, sp.sw, sp.sh, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
    return true;
  }

  var root = document.getElementById('app');
  var combinedSignals = (META.bundleId + ' ' + META.appName + ' ' + (META.machOSymbols || []).join(' ') + ' ' + (META.cciScenes || []).join(' ')).toLowerCase();
  var isAxeSkyHunter = /zorbie|gameatelier|\baxe\b|birdhunt|skyhunt|gordolex|giant_bird/.test(combinedSignals);

  if (META.category === 'game_2d' && isAxeSkyHunter) {
    // 100% Faithful Zorbié (© 2013 The Game Atelier / Simon & Étienne Périn - Multimedia Fusion 2 iOS)
    var zCoins = parseInt(saves.coins_balance || saves.gold_coins_balance || '33658', 10) || 33658;
    var zScore = 0;
    var zBestScore = parseInt(saves.high_score || '2307', 10) || 2307;
    var upgDefense = parseInt(saves.defense_up_level || '2', 10) || 2;
    var upgGiantCoin = parseInt(saves.giant_coin_level || '3', 10) || 3;
    var upgFrancois = parseInt(saves.francois_freq_level || '2', 10) || 2;

    var STAGES = [
      { id: 'tower', name: 'LIGHTHOUSE TOWER', cci: 'scene 1 - game_hi' },
      { id: 'beach', name: 'TROPICAL BEACH', cci: 'beach' },
      { id: 'rainbow', name: 'RAINBOW FEVER!', cci: 'bonus_rainbow' },
      { id: 'river', name: 'CANYON RIVER RAFT', cci: 'river' },
      { id: 'giant_bird', name: 'BOSS: GIANT BIRD', cci: 'giant_bird' },
      { id: 'gordolex', name: 'BOSS: GORDOLEX', cci: 'gordolex' }
    ];

    var missions = [
      { id: 'chain3', title: 'Chain 3 hits with ze axe', cur: 0, max: 3, color: '#3B82F6' },
      { id: 'francois3', title: 'Kill 3 François', cur: 0, max: 3, color: '#EF4444' },
      { id: 'roberts5', title: 'Eat 5 Roberts', cur: 0, max: 5, color: '#F59E0B' },
      { id: 'powerups3', title: 'Buy 3 Power Ups', cur: 0, max: 3, color: '#DC2626' }
    ];

    root.innerHTML =
      '<style>' +
        '.zb-wrap { position:relative; width:100%; height:100%; background:#07090E; display:flex; justify-content:center; align-items:center; overflow:hidden; font-family:"Arial Black", "Trebuchet MS", -apple-system, sans-serif; }' +
        '.zb-frame { position:relative; width:100%; max-width:430px; height:100%; background:#1E293B; overflow:hidden; box-shadow:0 0 40px rgba(0,0,0,0.85); border-left:3px solid #000; border-right:3px solid #000; }' +
        '.zb-topbar { position:absolute; top:calc(8px + env(safe-area-inset-top, 0px)); left:10px; right:10px; display:flex; justify-content:space-between; align-items:center; z-index:15; pointer-events:none; }' +
        '.zb-pill { pointer-events:auto; background:rgba(0,0,0,0.72); border:2.5px solid #000; border-radius:10px; padding:4px 10px; color:#FFF; font-weight:900; font-size:13px; text-shadow:2px 2px 0 #000; display:inline-flex; align-items:center; gap:6px; box-shadow:0 3px 0 rgba(0,0,0,0.5); cursor:pointer; }' +
        '.zb-score-corner { position:absolute; bottom:calc(62px + env(safe-area-inset-bottom, 0px)); right:12px; z-index:14; pointer-events:none; text-align:right; font-weight:900; color:#FFF; text-shadow:2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000; }' +
        '.zb-dock { position:absolute; bottom:calc(8px + env(safe-area-inset-bottom, 0px)); left:8px; right:8px; display:flex; justify-content:space-between; align-items:center; gap:6px; z-index:16; }' +
        '.zb-btn { background:linear-gradient(180deg, #FACC15 0%, #EA580C 100%); color:#FFF; border:3px solid #000; border-radius:12px; padding:8px 11px; font-weight:900; font-size:12px; text-shadow:1.5px 1.5px 0 #000; box-shadow:0 3px 0 #000; cursor:pointer; }' +
        '.zb-btn:active { transform:translateY(2px); box-shadow:0 1px 0 #000; }' +
        '.zb-btn-green { background:linear-gradient(180deg, #4ADE80 0%, #16A34A 100%); }' +
        '.zb-btn-blue { background:linear-gradient(180deg, #60A5FA 0%, #2563EB 100%); }' +
        '.zb-btn-red { background:linear-gradient(180deg, #F87171 0%, #DC2626 100%); }' +
        '.zb-modal { position:absolute; inset:0; z-index:30; display:none; flex-direction:column; background:repeating-linear-gradient(90deg, #7F1D1D 0px, #7F1D1D 24px, #991B1B 24px, #991B1B 48px); padding:16px; overflow-y:auto; color:#FFF; }' +
        '.zb-shop-title { font-size:26px; font-weight:900; text-align:center; color:#FFF; text-shadow:3px 3px 0 #000, -2px -2px 0 #000; letter-spacing:0.5px; margin-bottom:4px; }' +
        '.zb-coins-banner { display:flex; align-items:center; justify-content:center; gap:8px; font-size:24px; font-weight:900; color:#FDE047; text-shadow:2.5px 2.5px 0 #000; margin-bottom:12px; }' +
        '.zb-upg-card { border:3.5px solid #000; border-radius:14px; padding:10px 12px; margin-bottom:10px; box-shadow:0 5px 0 #000; cursor:pointer; position:relative; }' +
        '.zb-bars { display:grid; grid-template-columns:repeat(6, 1fr); gap:4px; margin-top:8px; background:rgba(0,0,0,0.45); padding:4px; border-radius:6px; border:2px solid #000; }' +
        '.zb-bar-seg { height:12px; border-radius:3px; background:#374151; }' +
        '.zb-bar-seg.on { background:linear-gradient(180deg, #FEF08A 0%, #F59E0B 100%); box-shadow:0 0 6px #FDE047; }' +
      '</style>' +
      '<div class="zb-wrap">' +
        '<div class="zb-frame">' +
          '<div class="zb-topbar">' +
            '<div class="zb-pill" id="zb-stage-pill" title="Trocar Fase / Chefe">STAGE 1: TOWER ↻</div>' +
            '<div class="zb-pill" id="zb-time-pill" style="background:rgba(220,38,38,0.88);">TIME 74</div>' +
            '<div class="zb-pill" id="zb-coins-pill" style="color:#FDE047;">● ' + zCoins + '</div>' +
          '</div>' +
          '<canvas id="stage"></canvas>' +
          '<div class="zb-score-corner">' +
            '<div style="font-size:11px;color:#93C5FD;letter-spacing:0.5px;">SCORE</div>' +
            '<div style="font-size:24px;line-height:1;" id="zb-score-val">0</div>' +
          '</div>' +
          '<div class="zb-dock">' +
            '<div style="display:flex;gap:5px;">' +
              '<button class="zb-btn zb-btn-blue" id="zb-left" style="padding:10px 14px;font-size:15px;">◀</button>' +
              '<button class="zb-btn zb-btn-blue" id="zb-right" style="padding:10px 14px;font-size:15px;">▶</button>' +
            '</div>' +
            '<button class="zb-btn zb-btn-green" id="zb-throw" style="flex:1;padding:10px 8px;font-size:13px;">ZE AXE ▲</button>' +
            '<button class="zb-btn zb-btn-red" id="zb-open-shop">POWER UPS</button>' +
            '<button class="zb-btn" id="zb-open-missions">MISSÕES</button>' +
          '</div>' +
          '<div class="zb-modal" id="zb-shop-modal"></div>' +
          '<div class="zb-modal" id="zb-missions-modal"></div>' +
        '</div>' +
      '</div>';

    var zCanvas = document.getElementById('stage');
    var zCtx = zCanvas.getContext('2d');
    var elStagePill = document.getElementById('zb-stage-pill');
    var elTimePill = document.getElementById('zb-time-pill');
    var elCoinsPill = document.getElementById('zb-coins-pill');
    var elScoreVal = document.getElementById('zb-score-val');
    var elShopModal = document.getElementById('zb-shop-modal');
    var elMissionsModal = document.getElementById('zb-missions-modal');

    function zResize() {
      var frame = zCanvas.parentElement;
      zCanvas.width = frame.clientWidth || 384;
      zCanvas.height = frame.clientHeight || 600;
    }
    window.addEventListener('resize', zResize);
    zResize();

    var stageIdx = 0;
    var zTimeLeft = 74;
    var zTick = 0;
    var introTimer = 115; // Shows the Fairy "BONJOUR!" + Spotlight Axe intro for first ~2 seconds, tap to skip immediately!
    var screenFlash = 0;
    var chestOpenTimer = 0;

    var player = {
      x: zCanvas.width * 0.5,
      y: 0,
      vx: 0,
      dir: 1,
      stun: 0,
      throwAnim: 0,
      hasHelmet: upgDefense > 0,
      megaAxeTimer: 0
    };

    var axes = [];
    var birds = [];
    var drops = []; // roast meats, coins, mega-axe orbs
    var popups = [];
    var feathers = [];
    var boss = {
      x: zCanvas.width * 0.5,
      y: 118,
      vx: 1.6,
      hp: 18,
      maxHp: 18,
      laserCharge: 0,
      laserActive: 0,
      hitFlash: 0
    };
    var moveHeld = { l: false, r: false };

    function currentStage() {
      return STAGES[stageIdx % STAGES.length];
    }

    function spawnStageEntities() {
      birds = [];
      var st = currentStage().id;
      var w = zCanvas.width;
      boss.hp = st === 'gordolex' ? 24 : 18;
      boss.maxHp = boss.hp;
      boss.x = w * 0.5;
      boss.laserCharge = 0;
      boss.laserActive = 0;

      if (st === 'beach') {
        // Diagonal rainbow puff-bird chain (green, yellow, orange, pink, blue) just like 0:20 - 0:23 in the trailer!
        var chainColors = ['#4ADE80', '#FACC15', '#FB923C', '#F472B6', '#38BDF8', '#A3E635'];
        for (var i = 0; i < 6; i++) {
          birds.push({
            x: 60 + i * 38,
            y: 78 + i * 24,
            vx: 2.1,
            vy: 0,
            hp: 1,
            type: 'puff',
            color: chainColors[i % chainColors.length],
            r: 22
          });
        }
      } else if (st === 'river') {
        // Black bomb-birds (François) + orange fish-birds just like 0:30 - 0:34!
        var fCount = 5 + Math.min(3, upgFrancois);
        for (var r = 0; r < fCount; r++) {
          birds.push({
            x: 50 + (r * 58) % Math.max(120, w - 100),
            y: 76 + (r % 3) * 44,
            vx: (r % 2 === 0 ? 1 : -1) * (2.0 + (r % 3) * 0.4),
            vy: 0,
            hp: 1,
            type: r % 3 === 0 ? 'robert' : 'bomb',
            color: r % 3 === 0 ? '#86EFAC' : '#1E293B',
            r: 23
          });
        }
      } else if (st === 'rainbow') {
        // Vertical Rainbow Fever flying mode (0:25 - 0:29): flying Roberts, giant coins & spiked mines!
        for (var rb = 0; rb < 7; rb++) {
          var isMine = rb % 3 === 2;
          birds.push({
            x: 45 + Math.random() * Math.max(80, w - 90),
            y: 60 + rb * 65,
            vx: (rb % 2 === 0 ? 1 : -1) * 1.4,
            vy: 2.2,
            hp: 1,
            type: isMine ? 'mine' : 'robert',
            color: isMine ? '#1E293B' : '#86EFAC',
            r: 22
          });
        }
      } else {
        // Tower / Boss escorts: green Roberts & occasional François bomb-birds
        var count = st === 'giant_bird' || st === 'gordolex' ? 4 : 6;
        for (var k = 0; k < count; k++) {
          var isFrancois = (k === count - 1) && upgFrancois > 0;
          birds.push({
            x: 45 + ((k * 64) % Math.max(120, w - 90)),
            y: (st === 'giant_bird' ? 175 : 80) + (k % 3) * 42,
            vx: (k % 2 === 0 ? 1 : -1) * (1.85 + (k % 3) * 0.35),
            vy: 0,
            hp: 1,
            type: isFrancois ? 'bomb' : 'robert',
            color: isFrancois ? '#1E293B' : '#86EFAC',
            r: 22
          });
        }
      }
      elStagePill.textContent = currentStage().name + ' ↻';
    }

    spawnStageEntities();

    function advanceMission(id, amount) {
      for (var i = 0; i < missions.length; i++) {
        if (missions[i].id === id && missions[i].cur < missions[i].max) {
          missions[i].cur = Math.min(missions[i].max, missions[i].cur + amount);
          if (missions[i].cur === missions[i].max) {
            zCoins += 500;
            setSave('coins_balance', zCoins);
            popups.push({ x: zCanvas.width * 0.5, y: 140, txt: 'MISSION COMPLETE! +500', color: '#FDE047', scale: 1.3, life: 55 });
            playNamedSfx(['stageclear', 'bonus_landing'], 880, 0.2, 'triangle');
          }
        }
      }
    }

    function throwZeAxe(aimX) {
      if (introTimer > 0) {
        introTimer = 0;
        playNamedSfx(['bonjour', 'zorbie_charge'], 640, 0.14, 'triangle');
        startBgmIfAvailable();
        return;
      }
      if (currentStage().id === 'rainbow') return;
      if (player.stun > 0 || axes.length >= 2) return;
      var groundY = zCanvas.height - 108;
      var dx = aimX !== undefined ? Math.max(-3.6, Math.min(3.6, (aimX - player.x) * 0.024)) : player.dir * 0.9;
      axes.push({
        x: player.x,
        y: groundY - 38,
        vx: dx,
        vy: -14.8,
        rot: 0,
        chain: 0,
        falling: false,
        mega: player.megaAxeTimer > 0
      });
      player.throwAnim = 14;
      playNamedSfx(['take_axe', 'zorbie_charge', 'wand_lazer'], 540, 0.12, 'square');
    }

    // --- UI Modals: Power Ups Shop (0:45 - 0:50) & Missions (0:51 - 0:55) ---
    function renderShopModal() {
      var items = [
        {
          key: 'def',
          title: 'Defense Up',
          sub: 'Start games with Dickhead helmet shield',
          lvl: upgDefense,
          cost: 2200,
          bg: 'linear-gradient(180deg, #4ADE80 0%, #15803D 100%)',
          icon: '🛡️'
        },
        {
          key: 'coin',
          title: 'Giant Coin',
          sub: 'Bigger coins & roast meat value',
          lvl: upgGiantCoin,
          cost: 2400,
          bg: 'linear-gradient(180deg, #FACC15 0%, #D97706 100%)',
          icon: '🪙'
        },
        {
          key: 'fran',
          title: 'François Frequency Up',
          sub: 'Clockman & bomb-birds appear more often',
          lvl: upgFrancois,
          cost: 2200,
          bg: 'linear-gradient(180deg, #38BDF8 0%, #1D4ED8 100%)',
          icon: '⏰'
        }
      ];

      var html =
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<span style="font-size:12px;font-weight:900;color:#FCA5A5;">SCENE 2 - SHOP</span>' +
          '<button class="zb-btn" id="zb-close-shop">VOLTAR AO JOGO ✕</button>' +
        '</div>' +
        '<div class="zb-shop-title">Power Ups</div>' +
        '<div class="zb-coins-banner"><span>🪙</span><span id="zb-shop-coins">' + zCoins + '</span></div>';

      items.forEach(function(it) {
        var barsHtml = '';
        for (var b = 1; b <= 6; b++) {
          barsHtml += '<div class="zb-bar-seg ' + (b <= it.lvl ? 'on' : '') + '"></div>';
        }
        html +=
          '<div class="zb-upg-card" data-upg="' + it.key + '" style="background:' + it.bg + ';">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;">' +
              '<div>' +
                '<div style="font-size:18px;font-weight:900;text-shadow:2px 2px 0 #000;">' + it.icon + ' ' + it.title + '</div>' +
                '<div style="font-size:11px;font-weight:700;color:#FEF08A;text-shadow:1px 1px 0 #000;">' + it.sub + '</div>' +
              '</div>' +
              '<div style="background:#FACC15;color:#000;font-weight:900;font-size:12px;padding:4px 8px;border:2.5px solid #000;border-radius:8px;transform:rotate(-5deg);">BUY! ' + it.cost + '</div>' +
            '</div>' +
            '<div class="zb-bars">' + barsHtml + '</div>' +
          '</div>';
      });

      var dlcUnlocked = String(saves.ios_store_dlc_unlocked || '0') === '1';
      html +=
        '<div style="margin-top:8px;padding:10px 12px;border:3px solid #000;border-radius:14px;background:linear-gradient(180deg,#6366F1 0%,#312E81 100%);box-shadow:0 5px 0 #000;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
            '<div>' +
              '<div style="font-size:14px;font-weight:900;text-shadow:2px 2px 0 #000;">iOSStore DLC Pack (PortBridge)</div>' +
              '<div style="font-size:11px;color:#E0E7FF;text-shadow:1px 1px 0 #000;">' +
                (dlcUnlocked ? 'Desbloqueado via StoreKit Mock (Zorbie_Save.ini)' : 'Libera +50.000 moedas, capacete e DLC gratis ($0.00)') +
              '</div>' +
            '</div>' +
            '<span style="background:' + (dlcUnlocked ? '#22C55E' : '#FACC15') + ';color:#000;font-weight:900;font-size:11px;padding:4px 8px;border:2px solid #000;border-radius:8px;">' + (dlcUnlocked ? 'OWNED' : 'FREE') + '</span>' +
          '</div>' +
          '<div style="display:flex;gap:6px;margin-top:8px;">' +
            '<button class="zb-btn zb-btn-green" id="zb-iosstore-buy" style="flex:1;padding:7px 8px;font-size:11px;">' + (dlcUnlocked ? 'DLC ATIVA ✓' : 'COMPRAR DLC (FREE)') + '</button>' +
            '<button class="zb-btn zb-btn-blue" id="zb-iosstore-restore" style="padding:7px 10px;font-size:11px;">RESTORE</button>' +
          '</div>' +
        '</div>';

      elShopModal.innerHTML = html;
      document.getElementById('zb-close-shop').addEventListener('click', function() {
        elShopModal.style.display = 'none';
      });
      var applyStoreKitUnlock = function(mode) {
        setSave('ios_store_dlc_unlocked', '1');
        if (!dlcUnlocked || mode === 'buy') {
          zCoins += 50000;
          setSave('coins_balance', zCoins);
        }
        player.hasHelmet = true;
        upgDefense = Math.max(upgDefense, 6);
        setSave('defense_up_level', upgDefense);
        playNamedSfx(['cash', 'stageclear', 'bonus_landing'], 880, 0.16, 'triangle');
        renderShopModal();
      };
      var buyBtn = document.getElementById('zb-iosstore-buy');
      var restoreBtn = document.getElementById('zb-iosstore-restore');
      if (buyBtn) buyBtn.addEventListener('click', function() { applyStoreKitUnlock('buy'); });
      if (restoreBtn) restoreBtn.addEventListener('click', function() { applyStoreKitUnlock('restore'); });
      elShopModal.querySelectorAll('.zb-upg-card').forEach(function(card) {
        card.addEventListener('click', function() {
          var k = card.getAttribute('data-upg');
          var cost = k === 'coin' ? 2400 : 2200;
          if (zCoins < cost) return;
          if (k === 'def' && upgDefense < 6) { upgDefense++; player.hasHelmet = true; setSave('defense_up_level', upgDefense); }
          else if (k === 'coin' && upgGiantCoin < 6) { upgGiantCoin++; setSave('giant_coin_level', upgGiantCoin); }
          else if (k === 'fran' && upgFrancois < 6) { upgFrancois++; setSave('francois_freq_level', upgFrancois); }
          else return;
          zCoins -= cost;
          setSave('coins_balance', zCoins);
          advanceMission('powerups3', 1);
          playNamedSfx(['cash', 'shop', 'bonus_landing'], 820, 0.14, 'triangle');
          renderShopModal();
        });
      });
    }

    function renderMissionsModal() {
      var html =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
          '<span style="font-size:18px;font-weight:900;text-shadow:2px 2px 0 #000;">MISSIONS (ZORBIÉ)</span>' +
          '<button class="zb-btn" id="zb-close-missions">FECHAR ✕</button>' +
        '</div>';

      missions.forEach(function(m) {
        var pct = Math.min(100, Math.round((m.cur / m.max) * 100));
        html +=
          '<div class="zb-upg-card" style="background:' + m.color + ';cursor:default;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;">' +
              '<span style="font-size:15px;font-weight:900;text-shadow:2px 2px 0 #000;">' + m.title + '</span>' +
              '<span style="font-size:18px;font-weight:900;color:#86EFAC;text-shadow:2px 2px 0 #000;">' + m.cur + '/' + m.max + ' ★</span>' +
            '</div>' +
            '<div style="margin-top:8px;height:14px;background:rgba(0,0,0,0.55);border:2px solid #000;border-radius:7px;overflow:hidden;">' +
              '<div style="width:' + pct + '%;height:100%;background:linear-gradient(90deg,#FDE047,#22C55E);"></div>' +
            '</div>' +
          '</div>';
      });

      if (META.artworkPaths && META.artworkPaths.length > 0) {
        html += '<div style="margin-top:10px;font-size:12px;font-weight:900;text-shadow:1px 1px 0 #000;">SPRITES EXTRAÍDOS DO APPLICATION.CCI (' + META.artworkPaths.length + '):</div>';
        html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:6px;">';
        META.artworkPaths.slice(0, 16).forEach(function(p) {
          html += '<img src="' + p + '" style="width:100%;height:54px;object-fit:contain;background:rgba(0,0,0,0.45);border:2px solid #000;border-radius:8px;padding:3px;" />';
        });
        html += '</div>';
      }

      elMissionsModal.innerHTML = html;
      document.getElementById('zb-close-missions').addEventListener('click', function() {
        elMissionsModal.style.display = 'none';
      });
    }

    elStagePill.addEventListener('click', function() {
      stageIdx = (stageIdx + 1) % STAGES.length;
      introTimer = 0;
      spawnStageEntities();
      popups.push({ x: zCanvas.width * 0.5, y: zCanvas.height * 0.38, txt: currentStage().name, color: '#FDE047', scale: 1.35, life: 45 });
      playNamedSfx(['stageclear', 'bonjour'], 740, 0.16, 'triangle');
    });

    document.getElementById('zb-open-shop').addEventListener('click', function() {
      renderShopModal();
      elShopModal.style.display = 'flex';
      playNamedSfx(['shop', 'cash'], 660, 0.12, 'sine');
    });

    document.getElementById('zb-open-missions').addEventListener('click', function() {
      renderMissionsModal();
      elMissionsModal.style.display = 'flex';
    });

    var btnL = document.getElementById('zb-left');
    var btnR = document.getElementById('zb-right');
    btnL.addEventListener('pointerdown', function(e){ e.preventDefault(); moveHeld.l = true; player.dir = -1; introTimer = 0; });
    btnL.addEventListener('pointerup', function(){ moveHeld.l = false; });
    btnL.addEventListener('pointercancel', function(){ moveHeld.l = false; });
    btnR.addEventListener('pointerdown', function(e){ e.preventDefault(); moveHeld.r = true; player.dir = 1; introTimer = 0; });
    btnR.addEventListener('pointerup', function(){ moveHeld.r = false; });
    btnR.addEventListener('pointercancel', function(){ moveHeld.r = false; });

    document.getElementById('zb-throw').addEventListener('pointerdown', function(e) {
      e.preventDefault();
      throwZeAxe();
    });

    zCanvas.addEventListener('pointerdown', function(e) {
      var rect = zCanvas.getBoundingClientRect();
      var cx = ((e.clientX - rect.left) / rect.width) * zCanvas.width;
      var cy = ((e.clientY - rect.top) / rect.height) * zCanvas.height;
      startBgmIfAvailable();
      if (introTimer > 0) {
        introTimer = 0;
        playNamedSfx(['bonjour'], 680, 0.15, 'triangle');
        return;
      }
      if (currentStage().id === 'rainbow' || cy > zCanvas.height * 0.64) {
        player.dir = cx < player.x ? -1 : 1;
        player.x = Math.max(34, Math.min(zCanvas.width - 34, cx));
      } else {
        player.dir = cx < player.x ? -1 : 1;
        throwZeAxe(cx);
      }
    });

    zCanvas.addEventListener('pointermove', function(e) {
      if (e.buttons === 0) return;
      var rect = zCanvas.getBoundingClientRect();
      var cx = ((e.clientX - rect.left) / rect.width) * zCanvas.width;
      player.dir = cx < player.x ? -1 : 1;
      player.x = Math.max(34, Math.min(zCanvas.width - 34, cx));
    });

    setInterval(function() {
      if (introTimer > 0 || elShopModal.style.display === 'flex' || elMissionsModal.style.display === 'flex') return;
      zTimeLeft = Math.max(0, zTimeLeft - 1);
      if (zTimeLeft === 0) {
        zTimeLeft = 74;
        stageIdx = (stageIdx + 1) % STAGES.length;
        spawnStageEntities();
      }
    }, 1000);

    // --- Authentic Étienne Périn Comic Art Drawing Routines ---
    function drawComicText(ctx, text, x, y, size, fill, stroke) {
      ctx.save();
      ctx.font = '900 ' + size + 'px "Arial Black", Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(4, size * 0.22);
      ctx.strokeStyle = stroke || '#000';
      ctx.strokeText(text, x, y);
      ctx.fillStyle = fill || '#FFF';
      ctx.fillText(text, x, y);
      ctx.restore();
    }

    // Authentic Double-Bladed Battle Axe ("ze axe" from 0:09 - 0:16)
    function drawDoubleBladedAxe(ctx, x, y, rot, isMega) {
      var sc = isMega ? 1.65 : 1.0;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.scale(sc, sc);

      if (isMega) {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000';
      ctx.lineJoin = 'round';

      // Left & Right symmetric curved silver battle blades
      [-1, 1].forEach(function(side) {
        ctx.save();
        ctx.scale(side, 1);
        ctx.fillStyle = '#CBD5E1';
        ctx.beginPath();
        ctx.moveTo(3, -7);
        ctx.quadraticCurveTo(18, -19, 21, -13);
        ctx.quadraticCurveTo(25, 0, 21, 13);
        ctx.quadraticCurveTo(18, 19, 3, 7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Shiny metallic blade edge
        ctx.fillStyle = '#F8FAFC';
        ctx.beginPath();
        ctx.moveTo(15, -13);
        ctx.quadraticCurveTo(22, 0, 15, 13);
        ctx.quadraticCurveTo(20, 0, 15, -13);
        ctx.fill();
        ctx.restore();
      });

      // Central iron shaft & handle
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.roundRect(-4, -18, 8, 36, 3);
      ctx.fill();
      ctx.stroke();

      // Center rivet
      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    // Authentic Zorbié Character (green tunic, long green hair, big green mustache, huge comic nose, optional yellow/blue helmet)
    function drawAuthenticZorbie(ctx, x, y, dir, stunned, holdingAxe, flyingMode) {
      ctx.save();
      ctx.translate(x, y);
      if (dir < 0) ctx.scale(-1, 1);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;

      var walkBob = Math.sin(zTick * 0.35) * (moveHeld.l || moveHeld.r ? 3.5 : 1);

      if (flyingMode) {
        // Rainbow Fever vertical flight pose (0:26 - 0:29): flapping long green sleeves!
        var wingAng = Math.sin(zTick * 0.45) * 0.45;
        [-1, 1].forEach(function(side) {
          ctx.save();
          ctx.scale(side, 1);
          ctx.rotate(wingAng);
          ctx.fillStyle = '#22C55E';
          ctx.beginPath();
          ctx.moveTo(6, -8);
          ctx.quadraticCurveTo(34, -22, 38, 12);
          ctx.quadraticCurveTo(22, 18, 8, 6);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        });
      }

      // Bare comic feet
      ctx.fillStyle = '#FDBA74';
      ctx.beginPath();
      ctx.ellipse(-9, 18 + walkBob * 0.5, 8, 4.5, 0, 0, Math.PI * 2);
      ctx.ellipse(9, 18 - walkBob * 0.5, 8, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Green Tunic Body
      ctx.fillStyle = '#22C55E';
      ctx.beginPath();
      ctx.moveTo(-14, -8 + walkBob);
      ctx.lineTo(14, -8 + walkBob);
      ctx.lineTo(18, 15 + walkBob);
      ctx.lineTo(-18, 15 + walkBob);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Long Flowing Green Hair behind head
      ctx.fillStyle = '#16A34A';
      ctx.beginPath();
      ctx.moveTo(-8, -32 + walkBob);
      ctx.quadraticCurveTo(-24, -18 + walkBob, -22, 6 + walkBob);
      ctx.quadraticCurveTo(-12, 4 + walkBob, -6, -12 + walkBob);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Head / Face
      ctx.fillStyle = '#FDBA74';
      ctx.beginPath();
      ctx.arc(0, -20 + walkBob, 13.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Yellow/Blue Striped Helmet ("Defense Up / Dickhead" helmet from 0:20 - 0:44)
      if (player.hasHelmet) {
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.arc(0, -23 + walkBob, 14.5, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Blue & Red helmet stripe + star
        ctx.fillStyle = '#2563EB';
        ctx.fillRect(-13, -27 + walkBob, 26, 4);
        ctx.strokeRect(-13, -27 + walkBob, 26, 4);
      } else {
        // Green Hair Top
        ctx.fillStyle = '#22C55E';
        ctx.beginPath();
        ctx.arc(-2, -23 + walkBob, 13.5, Math.PI * 0.9, Math.PI * 1.95);
        ctx.fill();
        ctx.stroke();
      }

      // Big White Comic Eyes
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(2, -22 + walkBob, 5, 0, Math.PI * 2);
      ctx.arc(9, -22 + walkBob, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Pupils
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(3.5, -22 + walkBob, 2, 0, Math.PI * 2);
      ctx.arc(10, -22 + walkBob, 2, 0, Math.PI * 2);
      ctx.fill();

      // Iconic Big Protruding Nose (Étienne Périn style!)
      ctx.fillStyle = '#FDBA74';
      ctx.beginPath();
      ctx.moveTo(8, -20 + walkBob);
      ctx.quadraticCurveTo(23, -19 + walkBob, 21, -13 + walkBob);
      ctx.quadraticCurveTo(18, -9 + walkBob, 7, -12 + walkBob);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Big Green Mustache
      ctx.fillStyle = '#16A34A';
      ctx.beginPath();
      ctx.moveTo(4, -12 + walkBob);
      ctx.quadraticCurveTo(15, -12 + walkBob, 19, -4 + walkBob);
      ctx.quadraticCurveTo(10, -5 + walkBob, 3, -9 + walkBob);
      ctx.quadraticCurveTo(-5, -4 + walkBob, -12, -5 + walkBob);
      ctx.quadraticCurveTo(-7, -12 + walkBob, 4, -12 + walkBob);
      ctx.fill();
      ctx.stroke();

      // Holding "ze axe" when ready
      if (holdingAxe && !flyingMode) {
        drawDoubleBladedAxe(ctx, 18, -14 + walkBob, -0.35, player.megaAxeTimer > 0);
      }

      // If stunned by falling axe (1:05 in trailer: axe stuck in head + red '?')
      if (stunned) {
        drawDoubleBladedAxe(ctx, 0, -38 + walkBob, 0.2, false);
        drawComicText(ctx, '?', 4, -56 + walkBob, 24, '#EF4444', '#000');
      }

      ctx.restore();
    }

    // Authentic Chubby Bird ("Robert" / Rainbow Puff-Bird / Black Bomb-Bird "François")
    function drawZorbieBird(ctx, b) {
      ctx.save();
      ctx.translate(b.x, b.y);
      if (b.vx < 0) ctx.scale(-1, 1);
      ctx.lineWidth = 2.8;
      ctx.strokeStyle = '#000';
      ctx.lineJoin = 'round';

      if (b.type === 'mine') {
        // Spiked black mine from Rainbow Fever (0:26)
        ctx.fillStyle = '#1E293B';
        for (var s = 0; s < 8; s++) {
          var a = (s * Math.PI) / 4 + zTick * 0.04;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10);
          ctx.lineTo(Math.cos(a) * 21, Math.sin(a) * 21);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(-4, -4, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }

      // Pink tail feathers
      ctx.fillStyle = b.type === 'bomb' ? '#F97316' : '#F472B6';
      ctx.beginPath();
      ctx.ellipse(-19, 2, 8, 4, -0.3, 0, Math.PI * 2);
      ctx.ellipse(-18, -4, 7, 3.5, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Chubby round body
      ctx.fillStyle = b.color || '#86EFAC';
      ctx.beginPath();
      ctx.ellipse(0, 0, 19, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // If bomb-bird (François 0:31 - 0:34), draw lit fuse spark on top!
      if (b.type === 'bomb') {
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.quadraticCurveTo(6, -25, 11, -22);
        ctx.stroke();
        ctx.fillStyle = zTick % 4 < 2 ? '#FDE047' : '#EF4444';
        ctx.beginPath();
        ctx.arc(12, -22, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Flapping wing
      var wingY = Math.sin((zTick + b.x) * 0.25) * 4;
      ctx.fillStyle = b.type === 'bomb' ? '#334155' : '#4ADE80';
      ctx.beginPath();
      ctx.ellipse(-3, 2 + wingY * 0.4, 8, 5, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Big comic eyes
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(7, -5, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(8.5, -5, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Long Yellow Duck/Bird Beak
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.moveTo(13, -3);
      ctx.quadraticCurveTo(26, -2, 24, 3);
      ctx.quadraticCurveTo(18, 6, 12, 3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    // Authentic Roast Meat Leg with Bone (1:02 in trailer)
    function drawRoastMeat(ctx, x, y) {
      ctx.save();
      ctx.translate(x, y);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#000';
      // White bone sticking out
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(-16, -3, 32, 6);
      ctx.strokeRect(-16, -3, 32, 6);
      ctx.beginPath();
      ctx.arc(-16, -4, 4, 0, Math.PI * 2);
      ctx.arc(-16, 4, 4, 0, Math.PI * 2);
      ctx.arc(16, -4, 4, 0, Math.PI * 2);
      ctx.arc(16, 4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Brown roast meat haunch
      ctx.fillStyle = '#B45309';
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Authentic Golden Treasure Chest on Beach/Stage right (0:20 - 0:24)
    function drawTreasureChest(ctx, x, y, isOpen) {
      ctx.save();
      ctx.translate(x, y);
      ctx.lineWidth = 2.8;
      ctx.strokeStyle = '#000';
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.roundRect(-20, -16, 40, 28, 5);
      ctx.fill();
      ctx.stroke();
      // Lid line & lock
      ctx.beginPath();
      ctx.moveTo(-20, -4);
      ctx.lineTo(20, -4);
      ctx.stroke();
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(-4, -8, 8, 9);
      ctx.strokeRect(-4, -8, 8, 9);
      if (isOpen) {
        drawComicText(ctx, '+100!', 0, -24, 14, '#FDE047', '#000');
      }
      ctx.restore();
    }

    // Authentic Stage Backgrounds matching every scene in the video!
    function drawStageBackground(ctx, stId, w, h, groundY) {
      if (stId === 'tower') {
        // Stage 1 (0:15 - 0:19): Blue sky, white Lighthouse Tower in center, green bushes, rocky ground
        var sky = ctx.createLinearGradient(0, 0, 0, groundY);
        sky.addColorStop(0, '#0284C7');
        sky.addColorStop(1, '#7DD3FC');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h);

        // Stylized clouds
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.beginPath();
        ctx.arc(w * 0.5, 130, 56, 0, Math.PI * 2);
        ctx.arc(w * 0.25, 190, 40, 0, Math.PI * 2);
        ctx.arc(w * 0.78, 175, 44, 0, Math.PI * 2);
        ctx.fill();

        // White Lighthouse Tower in center
        ctx.save();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#0F172A';
        ctx.fillStyle = '#E0F2FE';
        ctx.beginPath();
        ctx.moveTo(w * 0.5 - 32, groundY);
        ctx.lineTo(w * 0.5 - 20, 75);
        ctx.lineTo(w * 0.5 + 20, 75);
        ctx.lineTo(w * 0.5 + 32, groundY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Tower spire
        ctx.beginPath();
        ctx.moveTo(w * 0.5 - 14, 75);
        ctx.lineTo(w * 0.5, 22);
        ctx.lineTo(w * 0.5 + 14, 75);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Green bushes at base
        ctx.fillStyle = '#22C55E';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2.8;
        [35, 85, w - 85, w - 35].forEach(function(bx) {
          ctx.beginPath();
          ctx.arc(bx, groundY - 4, 26, Math.PI, 0);
          ctx.fill();
          ctx.stroke();
        });

        // Jagged tan/brown ground (0:15)
        ctx.fillStyle = '#FDE68A';
        ctx.fillRect(0, groundY, w, 16);
        ctx.fillStyle = '#78350F';
        ctx.fillRect(0, groundY + 14, w, h - groundY);
        ctx.strokeStyle = '#000';
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(w, groundY);
        ctx.stroke();
      } else if (stId === 'beach' || stId === 'gordolex') {
        // Stage 2 (0:20 - 0:24 & 0:41 - 0:44): Tropical Beach with Palm Tree, Ocean Bay, Sailboats & Wavy Sand
        var bSky = ctx.createLinearGradient(0, 0, 0, groundY);
        bSky.addColorStop(0, '#0EA5E9');
        bSky.addColorStop(0.62, '#BAE6FD');
        bSky.addColorStop(0.62, '#0284C7');
        bSky.addColorStop(1, '#38BDF8');
        ctx.fillStyle = bSky;
        ctx.fillRect(0, 0, w, h);

        // Red-sailed boats on the horizon
        [w * 0.45, w * 0.62].forEach(function(sx) {
          ctx.fillStyle = '#EF4444';
          ctx.beginPath();
          ctx.moveTo(sx, groundY - 95);
          ctx.lineTo(sx + 10, groundY - 76);
          ctx.lineTo(sx - 4, groundY - 76);
          ctx.closePath();
          ctx.fill();
        });

        // If Gordolex Boss stage (0:41 - 0:44), draw Gordolex rising behind the beach!
        if (stId === 'gordolex') {
          var gx = boss.x;
          var gy = groundY - 92;
          ctx.save();
          ctx.lineWidth = 3.5;
          ctx.strokeStyle = '#000';
          // Horns
          ctx.fillStyle = '#F97316';
          [-75, 75].forEach(function(hx) {
            ctx.beginPath();
            ctx.moveTo(gx + hx * 0.7, gy - 75);
            ctx.quadraticCurveTo(gx + hx * 1.25, gy - 115, gx + hx * 0.95, gy - 50);
            ctx.fill();
            ctx.stroke();
          });
          // Huge Peach/Orange Body
          ctx.fillStyle = boss.hitFlash > 0 ? '#FEF08A' : '#FDBA74';
          ctx.beginPath();
          ctx.arc(gx, gy, 108, Math.PI, 0);
          ctx.lineTo(gx + 108, groundY);
          ctx.lineTo(gx - 108, groundY);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // 3 Eyes (Left, Center forehead, Right)
          [[-42, -32], [0, -58], [42, -32]].forEach(function(ep) {
            ctx.fillStyle = '#FFF';
            ctx.beginPath();
            ctx.arc(gx + ep[0], gy + ep[1], 16, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#38BDF8';
            ctx.beginPath();
            ctx.arc(gx + ep[0], gy + ep[1], 6, 0, Math.PI * 2);
            ctx.fill();
          });
          // Big Mouth & 2 Giant White Front Teeth (0:42)
          ctx.fillStyle = '#991B1B';
          ctx.beginPath();
          ctx.arc(gx, gy + 18, 44, 0, Math.PI);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#FFF';
          ctx.fillRect(gx - 22, gy + 18, 20, 24);
          ctx.strokeRect(gx - 22, gy + 18, 20, 24);
          ctx.fillRect(gx + 2, gy + 18, 20, 24);
          ctx.strokeRect(gx + 2, gy + 18, 20, 24);
          ctx.restore();
        }

        // Palm Tree on Left
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.fillStyle = '#92400E';
        ctx.beginPath();
        ctx.moveTo(28, groundY);
        ctx.quadraticCurveTo(55, groundY - 120, 74, groundY - 195);
        ctx.lineTo(88, groundY - 195);
        ctx.quadraticCurveTo(70, groundY - 115, 48, groundY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Palm fronds
        ctx.fillStyle = '#22C55E';
        [-45, -15, 20, 50].forEach(function(dx) {
          ctx.beginPath();
          ctx.ellipse(80 + dx, groundY - 198 + Math.abs(dx) * 0.25, 34, 10, dx * 0.015, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });

        // Golden Sand + Pink/Brown Wavy Layers (0:20)
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(0, groundY, w, h - groundY);
        ctx.fillStyle = '#F472B6';
        ctx.fillRect(0, groundY + 24, w, 18);
        ctx.fillStyle = '#B45309';
        ctx.fillRect(0, groundY + 42, w, h - groundY);
        ctx.strokeStyle = '#000';
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(w, groundY);
        ctx.stroke();
      } else if (stId === 'rainbow') {
        // Stage 3 (0:25 - 0:29): Vertical Rainbow Fever Tunnel!
        var rGrad = ctx.createLinearGradient(0, 0, w, 0);
        rGrad.addColorStop(0, '#F472B6');
        rGrad.addColorStop(0.25, '#FDE047');
        rGrad.addColorStop(0.5, '#FFF');
        rGrad.addColorStop(0.75, '#4ADE80');
        rGrad.addColorStop(1, '#60A5FA');
        ctx.fillStyle = rGrad;
        ctx.fillRect(0, 0, w, h);
      } else if (stId === 'river') {
        // Stage 4 (0:30 - 0:34): Canyon River & Wooden Log Raft
        var rvSky = ctx.createLinearGradient(0, 0, 0, groundY);
        rvSky.addColorStop(0, '#38BDF8');
        rvSky.addColorStop(0.55, '#BAE6FD');
        rvSky.addColorStop(0.55, '#0369A1');
        rvSky.addColorStop(1, '#0284C7');
        ctx.fillStyle = rvSky;
        ctx.fillRect(0, 0, w, h);

        // Canyon brown cliffs left & right
        ctx.fillStyle = '#78350F';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, groundY - 40);
        ctx.lineTo(95, groundY - 135);
        ctx.lineTo(135, groundY - 40);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(w, groundY - 40);
        ctx.lineTo(w - 95, groundY - 145);
        ctx.lineTo(w - 140, groundY - 40);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Wooden Log Raft at groundY (0:31)
        ctx.fillStyle = '#FCD34D';
        ctx.fillRect(14, groundY, w - 28, 34);
        ctx.strokeRect(14, groundY, w - 28, 34);
        ctx.fillStyle = '#B45309';
        ctx.fillRect(14, groundY + 14, w - 28, 12);
      } else if (stId === 'giant_bird') {
        // Stage 5 (0:36 - 0:40): Sunset Sky + Giant Green Bird Boss with Yellow Beak Laser!
        var gSky = ctx.createLinearGradient(0, 0, 0, h);
        gSky.addColorStop(0, '#EC4899');
        gSky.addColorStop(0.55, '#F59E0B');
        gSky.addColorStop(1, '#FEF08A');
        ctx.fillStyle = gSky;
        ctx.fillRect(0, 0, w, h);

        // Curved white/blue cloud floor (0:36)
        ctx.fillStyle = '#FFF';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(w * 0.5, groundY + 110, 190, Math.PI * 1.15, Math.PI * 1.85);
        ctx.fill();
        ctx.stroke();

        // Draw Giant Bird Boss at top
        var bx = boss.x;
        var by = boss.y;
        ctx.save();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#000';

        // Laser beam if active (0:37 - 0:38)
        if (boss.laserActive > 0) {
          ctx.fillStyle = 'rgba(254, 240, 138, 0.88)';
          ctx.fillRect(bx - 16, by + 20, 32, groundY - by);
          ctx.fillStyle = '#FFF';
          ctx.fillRect(bx - 7, by + 20, 14, groundY - by);
        }

        // Small orange wings
        ctx.fillStyle = '#FB923C';
        ctx.beginPath();
        ctx.ellipse(bx - 64, by - 12, 18, 9, -0.4, 0, Math.PI * 2);
        ctx.ellipse(bx + 64, by - 12, 18, 9, 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Huge Green Spherical Body
        ctx.fillStyle = boss.hitFlash > 0 ? '#FEF08A' : '#22C55E';
        ctx.beginPath();
        ctx.arc(bx, by, 58, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Eyes
        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(bx - 18, by - 10, 9, 0, Math.PI * 2);
        ctx.arc(bx + 18, by - 10, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(bx - 18, by - 10, 3.5, 0, Math.PI * 2);
        ctx.arc(bx + 18, by - 10, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Long Vertical Yellow Beak
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.roundRect(bx - 10, by + 4, 20, 48, 8);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    // Fairy "BONJOUR!" Curtain Cutscene Overlay (0:05 - 0:09 in trailer)
    function drawBonjourIntro(ctx, w, h) {
      // Red stage curtains
      var cGrad = ctx.createLinearGradient(0, 0, w, 0);
      cGrad.addColorStop(0, '#7F1D1D');
      cGrad.addColorStop(0.25, '#DC2626');
      cGrad.addColorStop(0.5, '#991B1B');
      cGrad.addColorStop(0.75, '#DC2626');
      cGrad.addColorStop(1, '#7F1D1D');
      ctx.fillStyle = cGrad;
      ctx.fillRect(0, 0, w, h);

      // Blonde Mustache Fairy in Pink Dress (0:05)
      var fx = w * 0.30;
      var fy = h * 0.46;
      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000';
      // Blue fairy wings
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.ellipse(fx - 38, fy + 6, 26, 16, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Pink dress
      ctx.fillStyle = '#F472B6';
      ctx.beginPath();
      ctx.moveTo(fx - 22, fy);
      ctx.lineTo(fx + 22, fy);
      ctx.lineTo(fx + 30, fy + 58);
      ctx.lineTo(fx - 30, fy + 58);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Blonde curly hair
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(fx, fy - 26, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Face
      ctx.fillStyle = '#FDBA74';
      ctx.beginPath();
      ctx.arc(fx + 4, fy - 20, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Eyes & Blonde Mustache!
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.arc(fx, fy - 24, 6, 0, Math.PI * 2);
      ctx.arc(fx + 12, fy - 24, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(fx + 1, fy - 24, 2.2, 0, Math.PI * 2);
      ctx.arc(fx + 13, fy - 24, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.ellipse(fx - 4, fy - 12, 12, 4, -0.2, 0, Math.PI * 2);
      ctx.ellipse(fx + 14, fy - 12, 12, 4, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Big White Speech Bubble with Purple "BONJOUR" (0:05)
      ctx.fillStyle = '#FFF';
      ctx.beginPath();
      ctx.ellipse(w * 0.67, h * 0.26, 92, 54, -0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      drawComicText(ctx, 'BONJOUR!', w * 0.67, h * 0.28, 28, '#A855F7', '#000');

      // Authentic ZORBIÉ Logo & Tap Prompt at Bottom
      drawComicText(ctx, 'ZORBIÉ', w * 0.5, h * 0.75, 42, '#4ADE80', '#000');
      drawComicText(ctx, 'TOQUE PARA ARREMESSAR ZE AXE!', w * 0.5, h * 0.83, 14, '#FDE047', '#000');
      ctx.restore();
    }

    function zLoop() {
      zTick++;
      var w = zCanvas.width, h = zCanvas.height;
      var groundY = h - 102;
      var st = currentStage().id;

      if (introTimer > 0) {
        introTimer--;
        drawBonjourIntro(zCtx, w, h);
        requestAnimationFrame(zLoop);
        return;
      }

      if (screenFlash > 0) {
        screenFlash--;
        zCtx.fillStyle = screenFlash % 2 === 0 ? '#FACC15' : '#FB923C';
        zCtx.fillRect(0, 0, w, h);
      } else {
        drawStageBackground(zCtx, st, w, h, groundY);
      }

      // Update player position
      if (player.stun > 0) {
        player.stun--;
      } else {
        var spd = 5.8;
        if (moveHeld.l) { player.x -= spd; player.dir = -1; }
        if (moveHeld.r) { player.x += spd; player.dir = 1; }
        player.x = Math.max(32, Math.min(w - 32, player.x));
      }
      if (player.throwAnim > 0) player.throwAnim--;
      if (player.megaAxeTimer > 0) player.megaAxeTimer--;
      if (boss.hitFlash > 0) boss.hitFlash--;

      // Update Bosses (Giant Bird & Gordolex)
      if (st === 'giant_bird' || st === 'gordolex') {
        boss.x += boss.vx;
        if (boss.x < 85 || boss.x > w - 85) boss.vx *= -1;
        if (st === 'giant_bird') {
          boss.laserCharge++;
          if (boss.laserCharge === 110) {
            boss.laserActive = 35;
            playNamedSfx(['wand_lazer', 'zorbie_charge'], 420, 0.2, 'sawtooth');
          }
          if (boss.laserActive > 0) {
            boss.laserActive--;
            if (boss.laserActive === 0) boss.laserCharge = 0;
            if (Math.abs(player.x - boss.x) < 22 && player.stun === 0) {
              player.stun = 30;
              popups.push({ x: player.x, y: groundY - 40, txt: 'ZAP!', color: '#EF4444', scale: 1.2, life: 28 });
            }
          }
        }
      }

      // Draw Treasure Chest on Beach/Tower
      if (st === 'beach' || st === 'tower') {
        if (chestOpenTimer > 0) chestOpenTimer--;
        drawTreasureChest(zCtx, w - 46, groundY - 12, chestOpenTimer > 0);
      }

      // Update & draw birds (Roberts, Rainbow Puff-Birds, Bomb-Birds François)
      for (var bi = birds.length - 1; bi >= 0; bi--) {
        var bd = birds[bi];
        bd.x += bd.vx;
        bd.y += bd.vy || 0;
        if (bd.x < 28 || bd.x > w - 28) bd.vx *= -1;
        if (st === 'rainbow' && bd.y > groundY - 10) {
          bd.y = 40;
          bd.x = 40 + Math.random() * (w - 80);
        }
        drawZorbieBird(zCtx, bd);

        // In Rainbow Fever mode (0:26 - 0:29), Zorbié flies at groundY - 70 and eats birds directly!
        if (st === 'rainbow' && Math.hypot(bd.x - player.x, bd.y - (groundY - 70)) < 36) {
          if (bd.type === 'mine') {
            zScore = Math.max(0, zScore - 10);
            popups.push({ x: bd.x, y: bd.y, txt: '-10', color: '#EF4444', scale: 1.3, life: 30 });
            playSfx(160, 0.18, 'sawtooth');
          } else {
            zScore += 20;
            zCoins += 15;
            advanceMission('roberts5', 1);
            popups.push({ x: bd.x, y: bd.y, txt: '+20', color: '#FDE047', scale: 1.3, life: 30 });
            playNamedSfx(['cash', 'bonus_landing'], 860, 0.1, 'sine');
          }
          bd.y = 35;
          bd.x = 40 + Math.random() * (w - 80);
        }
      }

      // Update & draw spinning double-bladed axes ("ze axe") with golden vertical beam trail!
      for (var ai = axes.length - 1; ai >= 0; ai--) {
        var ax = axes[ai];
        ax.x += ax.vx;
        ax.y += ax.vy;
        ax.vy += 0.36;
        ax.rot += 0.34;
        if (ax.vy > 1.2) ax.falling = true;
        if (ax.x < 24 || ax.x > w - 24) ax.vx *= -0.85;

        // Vertical yellow/orange energy beam trail when rising (just like 0:10, 0:16, 0:19, 0:30!)
        if (!ax.falling) {
          var trailGrad = zCtx.createLinearGradient(ax.x, ax.y, ax.x, Math.min(groundY, ax.y + 135));
          trailGrad.addColorStop(0, 'rgba(254, 240, 138, 0.90)');
          trailGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.65)');
          trailGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
          zCtx.fillStyle = trailGrad;
          zCtx.fillRect(ax.x - 10, ax.y, 20, Math.min(groundY - ax.y, 135));
        }

        drawDoubleBladedAxe(zCtx, ax.x, ax.y, ax.rot, ax.mega);

        var hitRadius = ax.mega ? 46 : 30;

        // Check Boss Hit (Giant Bird or Gordolex)
        if ((st === 'giant_bird' || st === 'gordolex') && Math.hypot(ax.x - boss.x, ax.y - (st === 'gordolex' ? groundY - 115 : boss.y)) < 62) {
          boss.hp--;
          boss.hitFlash = 6;
          ax.chain++;
          ax.vy = Math.abs(ax.vy) * 0.55 + 2.5;
          ax.falling = true;
          var bossPts = 30 * ax.chain;
          zScore += bossPts;
          popups.push({ x: ax.x, y: ax.y, txt: ax.chain >= 2 ? 'x' + ax.chain : '+30', color: '#FDE047', scale: 1.45, life: 34 });
          playNamedSfx(['zorbie_charge', 'wand_lazer'], 620, 0.1, 'sawtooth');
          if (boss.hp <= 0) {
            screenFlash = 8;
            zScore += 500;
            zCoins += 250;
            setSave('coins_balance', zCoins);
            stageIdx = (stageIdx + 1) % STAGES.length;
            spawnStageEntities();
            popups.push({ x: w * 0.5, y: h * 0.4, txt: 'BOSS DEFEATED! +500', color: '#4ADE80', scale: 1.5, life: 55 });
            playNamedSfx(['stageclear', 'ending'], 840, 0.25, 'triangle');
          }
        }

        // Check Bird Chain Hits (1, 2, 3, +10, +20, +30!)
        for (var hbi = birds.length - 1; hbi >= 0; hbi--) {
          var target = birds[hbi];
          if (Math.hypot(ax.x - target.x, ax.y - target.y) < hitRadius + 10) {
            ax.chain++;
            if (ax.chain >= 3) advanceMission('chain3', 3);
            if (target.type === 'bomb') advanceMission('francois3', 1);

            var pts = 10 * ax.chain;
            zScore += pts;
            if (zScore > zBestScore) { zBestScore = zScore; setSave('high_score', zBestScore); }

            // Spawn comic hit number ("1", "2", "3" + "+10")
            popups.push({
              x: target.x,
              y: target.y,
              txt: ax.chain >= 2 ? String(ax.chain) + ' Combo!' : '+' + pts,
              color: ax.chain >= 2 ? '#FB923C' : '#FFF',
              scale: 1.2 + Math.min(0.6, ax.chain * 0.15),
              life: 32
            });

            // Spawn falling Roast Meat leg or Giant Coin or Mega-Axe powerup
            var dropKind = (Math.random() < 0.22) ? 'mega' : (Math.random() < 0.55 ? 'meat' : 'coin');
            drops.push({ x: target.x, y: target.y, vy: 2.3, kind: dropKind });

            // Comic feather burst
            for (var fi = 0; fi < 5; fi++) {
              feathers.push({
                x: target.x,
                y: target.y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                color: target.color || '#86EFAC',
                life: 18
              });
            }

            playNamedSfx(['zorbie_charge', 'bonus_landing'], 640 + ax.chain * 80, 0.09, 'sawtooth');
            birds.splice(hbi, 1);

            if (birds.length === 0) {
              spawnStageEntities();
            }
            break;
          }
        }

        // Hit Treasure Chest on Beach/Tower
        if ((st === 'beach' || st === 'tower') && Math.hypot(ax.x - (w - 46), ax.y - (groundY - 12)) < 32) {
          chestOpenTimer = 35;
          zCoins += 100 * upgGiantCoin;
          setSave('coins_balance', zCoins);
          popups.push({ x: w - 50, y: groundY - 36, txt: '+' + (100 * upgGiantCoin), color: '#FDE047', scale: 1.25, life: 30 });
          playNamedSfx(['cash'], 920, 0.1, 'sine');
        }

        // Falling Axe vs Zorbié on Ground (0:17 & 1:05 in trailer!)
        if (ax.falling && Math.hypot(ax.x - player.x, ax.y - (groundY - 14)) < 28) {
          if (player.hasHelmet) {
            // Yellow/Blue Dickhead Helmet blocks the hit or catches the axe safely!
            popups.push({ x: player.x, y: groundY - 46, txt: 'CATCH!', color: '#4ADE80', scale: 1.1, life: 22 });
            playNamedSfx(['take_axe'], 720, 0.08, 'triangle');
          } else {
            player.stun = 42;
            popups.push({ x: player.x, y: groundY - 48, txt: 'OUCH!', color: '#EF4444', scale: 1.3, life: 34 });
            playSfx(155, 0.22, 'sawtooth');
          }
          axes.splice(ai, 1);
          continue;
        }

        if (ax.y > groundY + 20) {
          axes.splice(ai, 1);
        }
      }

      // Update & draw falling Roast Meats, Giant Coins & Mega-Axe Orbs
      for (var di = drops.length - 1; di >= 0; di--) {
        var dp = drops[di];
        dp.y = Math.min(groundY - 6, dp.y + dp.vy);
        if (dp.kind === 'meat') {
          drawRoastMeat(zCtx, dp.x, dp.y);
        } else if (dp.kind === 'mega') {
          zCtx.save();
          zCtx.fillStyle = '#FEF08A';
          zCtx.strokeStyle = '#000';
          zCtx.lineWidth = 2.5;
          zCtx.beginPath();
          zCtx.arc(dp.x, dp.y, 13, 0, Math.PI * 2);
          zCtx.fill();
          zCtx.stroke();
          drawComicText(zCtx, '⚡', dp.x, dp.y + 5, 14, '#DC2626', '#000');
          zCtx.restore();
        } else {
          // Giant Gold Coin
          var coinR = 10 + Math.min(6, upgGiantCoin * 1.5);
          zCtx.save();
          zCtx.fillStyle = '#FACC15';
          zCtx.strokeStyle = '#000';
          zCtx.lineWidth = 2.5;
          zCtx.beginPath();
          zCtx.arc(dp.x, dp.y, coinR, 0, Math.PI * 2);
          zCtx.fill();
          zCtx.stroke();
          zCtx.restore();
        }

        if (Math.hypot(dp.x - player.x, dp.y - (groundY - 12)) < 36) {
          if (dp.kind === 'meat') {
            zTimeLeft = Math.min(99, zTimeLeft + 5);
            zScore += 25;
            advanceMission('roberts5', 1);
            popups.push({ x: dp.x, y: dp.y - 16, txt: 'CHOMP! +5s', color: '#4ADE80', scale: 1.15, life: 26 });
          } else if (dp.kind === 'mega') {
            player.megaAxeTimer = 260;
            popups.push({ x: dp.x, y: dp.y - 16, txt: 'MEGA AXE!', color: '#FDE047', scale: 1.35, life: 36 });
          } else {
            var cGain = 25 * upgGiantCoin;
            zCoins += cGain;
            zScore += 15;
            setSave('coins_balance', zCoins);
            popups.push({ x: dp.x, y: dp.y - 16, txt: '+' + cGain, color: '#FDE047', scale: 1.15, life: 26 });
          }
          playNamedSfx(['cash', 'bonus_landing'], 880, 0.1, 'sine');
          drops.splice(di, 1);
        }
      }

      // Draw feathers
      for (var fti = feathers.length - 1; fti >= 0; fti--) {
        var ft = feathers[fti];
        ft.x += ft.vx;
        ft.y += ft.vy;
        ft.life--;
        zCtx.fillStyle = ft.color;
        zCtx.beginPath();
        zCtx.ellipse(ft.x, ft.y, 6, 3, ft.life * 0.2, 0, Math.PI * 2);
        zCtx.fill();
        if (ft.life <= 0) feathers.splice(fti, 1);
      }

      // Draw Zorbié on Ground (or flying in Rainbow Fever)
      var zorbieY = st === 'rainbow' ? groundY - 70 : groundY - 18;
      drawAuthenticZorbie(zCtx, player.x, zorbieY, player.dir, player.stun > 0, axes.length === 0, st === 'rainbow');

      // Draw comic floating popups ("1", "2", "+10", "+20", "+30", "x4")
      for (var pi = popups.length - 1; pi >= 0; pi--) {
        var pp = popups[pi];
        pp.y -= 1.1;
        pp.life--;
        drawComicText(zCtx, pp.txt, pp.x, pp.y, Math.round(16 * (pp.scale || 1)), pp.color || '#FFF', '#000');
        if (pp.life <= 0) popups.splice(pi, 1);
      }

      elTimePill.textContent = 'TIME ' + zTimeLeft;
      elCoinsPill.textContent = '● ' + zCoins;
      elScoreVal.textContent = String(zScore);

      requestAnimationFrame(zLoop);
    }
    zLoop();
  } else if (META.category === 'game_2d') {
    var iconHtml = META.iconPath ? '<img src="' + META.iconPath + '" alt="" />' : '';
    var splashImgSrc = META.coverPath || META.iconPath || (META.artworkPaths && META.artworkPaths[0]) || '';
    var splashCoverHtml = splashImgSrc ? '<img class="splash-cover" src="' + splashImgSrc + '" alt="" />' : '';
    var showSplash = Boolean(META.isCustomUpload && splashImgSrc);

    root.innerHTML =
      '<div class="hud-top">' +
        '<div class="hud-card">' + iconHtml + '<span>' + META.appName + '</span></div>' +
        '<div class="hud-card" id="hud-stats"></div>' +
      '</div>' +
      (showSplash
        ? '<div class="splash-overlay" id="splash-screen">' +
            splashCoverHtml +
            '<div style="font-size:24px;font-weight:800;letter-spacing:-0.4px;">' + META.appName + '</div>' +
            '<div style="font-size:12px;color:#94A3B8;">v' + META.version + ' · Recursos Originais Carregados</div>' +
            '<button class="splash-btn" id="btn-start-game">JOGAR AGORA</button>' +
          '</div>'
        : '') +
      '<canvas id="stage"></canvas>' +
      '<div class="controls-layer">' +
        '<div class="dpad">' +
          '<div></div><button class="btn-pad" data-dir="up">▲</button><div></div>' +
          '<button class="btn-pad" data-dir="left">◀</button><div></div><button class="btn-pad" data-dir="right">▶</button>' +
          '<div></div><button class="btn-pad" data-dir="down">▼</button><div></div>' +
        '</div>' +
        '<div class="ab-cluster">' +
          '<button class="btn-action btn-b" id="btn-dash">FASE</button>' +
          '<button class="btn-action btn-a" id="btn-atk">AÇÃO</button>' +
        '</div>' +
      '</div>';

    var started = !showSplash;
    var splashEl = document.getElementById('splash-screen');
    if (splashEl) {
      document.getElementById('btn-start-game').addEventListener('click', function() {
        started = true;
        splashEl.style.display = 'none';
        playSfx(660, 0.14, 'triangle');
        startBgmIfAvailable();
      });
    }

    var canvas = document.getElementById('stage');
    var ctx = canvas.getContext('2d');
    var hud = document.getElementById('hud-stats');
    var scoreVal = parseInt(saves.gold_coins_balance || saves.high_score || '0', 10) || 0;
    var stageLevel = parseInt(saves.highest_dungeon_floor || saves.current_level || '1', 10) || 1;
    var hero = { x: 180, y: 240, vx: 0, vy: 0, swing: 0, facingLeft: false, hp: 5, invuln: 0 };
    var collectibles = [];
    var movers = [];
    var projectiles = [];
    var particles = [];
    var tickCount = 0;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();
    hero.x = canvas.width * 0.5;
    hero.y = canvas.height * 0.55;

    function spawnWave() {
      collectibles = [];
      for (var i = 0; i < 6; i++) {
        collectibles.push({
          x: 48 + Math.random() * Math.max(80, canvas.width - 96),
          y: 86 + Math.random() * Math.max(80, canvas.height - 220),
          r: 14,
          variant: i
        });
      }
      movers = [];
      var enemyCount = Math.min(7, 2 + stageLevel);
      for (var e = 0; e < enemyCount; e++) {
        var edge = e % 2 === 0 ? 42 : canvas.width - 42;
        movers.push({
          x: edge,
          y: 90 + ((e * 73) % Math.max(90, canvas.height - 230)),
          vx: (e % 2 === 0 ? 1 : -1) * (1.3 + Math.min(2.2, stageLevel * 0.2)),
          vy: (e % 3 === 0 ? 1 : -1) * 1.25,
          hp: 2,
          variant: e
        });
      }
    }
    spawnWave();

    function emitBurst(x, y, color) {
      for (var p = 0; p < 8; p++) {
        var ang = (Math.PI * 2 * p) / 8;
        particles.push({
          x: x,
          y: y,
          vx: Math.cos(ang) * (2 + Math.random() * 2.5),
          vy: Math.sin(ang) * (2 + Math.random() * 2.5),
          life: 20,
          color: color
        });
      }
    }

    function fireProjectile(targetX, targetY) {
      var dx = targetX - hero.x;
      var dy = targetY - hero.y;
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) {
        dx = hero.facingLeft ? -1 : 1;
        dy = 0;
      }
      var len = Math.hypot(dx, dy) || 1;
      projectiles.push({
        x: hero.x,
        y: hero.y,
        vx: (dx / len) * 8.5,
        vy: (dy / len) * 8.5,
        life: 75
      });
      hero.swing = 12;
      playSfx(540, 0.1, 'square');
    }

    var held = {};
    document.querySelectorAll('.btn-pad').forEach(function(b) {
      var d = b.getAttribute('data-dir');
      b.addEventListener('touchstart', function(e) { e.preventDefault(); held[d] = true; startBgmIfAvailable(); });
      b.addEventListener('touchend', function(e) { e.preventDefault(); held[d] = false; });
      b.addEventListener('pointerdown', function() { held[d] = true; startBgmIfAvailable(); });
      b.addEventListener('pointerup', function() { held[d] = false; });
      b.addEventListener('pointercancel', function() { held[d] = false; });
    });

    canvas.addEventListener('pointerdown', function(e) {
      if (!started) return;
      startBgmIfAvailable();
      var dx = e.clientX - hero.x;
      var dy = e.clientY - hero.y;
      var len = Math.hypot(dx, dy) || 1;
      hero.vx = (dx / len) * 5.8;
      hero.vy = (dy / len) * 5.8;
      hero.facingLeft = dx < 0;
      fireProjectile(e.clientX, e.clientY);
    });

    document.getElementById('btn-atk').addEventListener('click', function() {
      if (!started) return;
      startBgmIfAvailable();
      var nearest = movers[0];
      if (nearest) fireProjectile(nearest.x, nearest.y);
      else fireProjectile(hero.x + (hero.facingLeft ? -120 : 120), hero.y);
    });

    document.getElementById('btn-dash').addEventListener('click', function() {
      if (!started) return;
      stageLevel += 1;
      setSave(saves.highest_dungeon_floor !== undefined ? 'highest_dungeon_floor' : 'current_level', stageLevel);
      spawnWave();
      playSfx(740, 0.16, 'triangle');
    });

    function loop2d() {
      tickCount++;
      var pools = resolveSpritePools();

      if (pools.bg && pools.bg.img && pools.bg.img.complete && pools.bg.img.naturalWidth > 0) {
        ctx.drawImage(pools.bg.img, pools.bg.sx, pools.bg.sy, pools.bg.sw, pools.bg.sh, 0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(9, 13, 22, 0.25)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        var grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, '#0B132B');
        grad.addColorStop(1, '#1C2541');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = 'rgba(58, 80, 107, 0.28)';
        ctx.lineWidth = 1;
        for (var gx = 0; gx < canvas.width; gx += 48) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, canvas.height); ctx.stroke(); }
        for (var gy = 0; gy < canvas.height; gy += 48) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(canvas.width, gy); ctx.stroke(); }
      }

      if (started) {
        var speed = 4.6;
        if (held.up) hero.y -= speed;
        if (held.down) hero.y += speed;
        if (held.left) { hero.x -= speed; hero.facingLeft = true; }
        if (held.right) { hero.x += speed; hero.facingLeft = false; }
        hero.x += hero.vx; hero.y += hero.vy;
        hero.vx *= 0.88; hero.vy *= 0.88;
        hero.x = Math.max(30, Math.min(canvas.width - 30, hero.x));
        hero.y = Math.max(76, Math.min(canvas.height - 126, hero.y));
        if (hero.invuln > 0) hero.invuln--;
      }

      var animFrameIdx = Math.floor(tickCount / 8);

      for (var i = collectibles.length - 1; i >= 0; i--) {
        var c = collectibles[i];
        var bobY = c.y + Math.sin((tickCount + i * 12) * 0.08) * 4;
        if (pools.item.length > 0) {
          drawSpriteEntry(ctx, pools.item[c.variant % pools.item.length], c.x, bobY, 34, false, 0);
        } else {
          ctx.fillStyle = '#F59E0B';
          ctx.beginPath(); ctx.arc(c.x, bobY, c.r, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#FEF3C7'; ctx.lineWidth = 2; ctx.stroke();
        }
        if (started && Math.hypot(hero.x - c.x, hero.y - bobY) < 34 + (hero.swing > 0 ? 18 : 0)) {
          emitBurst(c.x, bobY, '#FBBF24');
          collectibles.splice(i, 1);
          scoreVal += 100;
          setSave(saves.gold_coins_balance !== undefined ? 'gold_coins_balance' : 'high_score', scoreVal);
          playSfx(880, 0.1, 'sine');
          if (collectibles.length === 0 && movers.length === 0) {
            stageLevel += 1;
            setSave(saves.highest_dungeon_floor !== undefined ? 'highest_dungeon_floor' : 'current_level', stageLevel);
            spawnWave();
          }
        }
      }

      for (var b = projectiles.length - 1; b >= 0; b--) {
        var pr = projectiles[b];
        pr.x += pr.vx;
        pr.y += pr.vy;
        pr.life--;
        if (pools.bullet.length > 0) {
          drawSpriteEntry(ctx, pools.bullet[0], pr.x, pr.y, 22, pr.vx < 0, 0);
        } else {
          ctx.fillStyle = '#38BDF8';
          ctx.beginPath(); ctx.arc(pr.x, pr.y, 6, 0, Math.PI * 2); ctx.fill();
        }
        if (pr.life <= 0 || pr.x < 0 || pr.x > canvas.width || pr.y < 0 || pr.y > canvas.height) {
          projectiles.splice(b, 1);
        }
      }

      for (var m = movers.length - 1; m >= 0; m--) {
        var o = movers[m];
        if (started) {
          o.x += o.vx; o.y += o.vy;
          if (o.x < 32 || o.x > canvas.width - 32) o.vx *= -1;
          if (o.y < 78 || o.y > canvas.height - 130) o.vy *= -1;
        }
        if (pools.enemy.length > 0) {
          var eSp = pools.enemy[(o.variant + animFrameIdx) % pools.enemy.length];
          drawSpriteEntry(ctx, eSp, o.x, o.y, 48, o.vx < 0, 0);
        } else {
          ctx.fillStyle = META.accentColor || '#EC4899';
          ctx.beginPath(); ctx.arc(o.x, o.y, 16, 0, Math.PI * 2); ctx.fill();
        }

        for (var pb = projectiles.length - 1; pb >= 0; pb--) {
          if (Math.hypot(projectiles[pb].x - o.x, projectiles[pb].y - o.y) < 28) {
            projectiles.splice(pb, 1);
            o.hp--;
            emitBurst(o.x, o.y, '#38BDF8');
            playSfx(420, 0.08, 'sawtooth');
            if (o.hp <= 0) {
              emitBurst(o.x, o.y, '#F43F5E');
              movers.splice(m, 1);
              scoreVal += 250;
              setSave(saves.gold_coins_balance !== undefined ? 'gold_coins_balance' : 'high_score', scoreVal);
              if (movers.length === 0 && collectibles.length === 0) {
                stageLevel += 1;
                setSave(saves.highest_dungeon_floor !== undefined ? 'highest_dungeon_floor' : 'current_level', stageLevel);
                spawnWave();
              }
            }
            break;
          }
        }

        if (started && hero.invuln <= 0 && Math.hypot(hero.x - o.x, hero.y - o.y) < 30) {
          hero.invuln = 45;
          hero.hp = Math.max(1, hero.hp - 1);
          emitBurst(hero.x, hero.y, '#EF4444');
          playSfx(190, 0.18, 'sawtooth');
        }
      }

      for (var pt = particles.length - 1; pt >= 0; pt--) {
        var part = particles[pt];
        part.x += part.vx;
        part.y += part.vy;
        part.life--;
        ctx.fillStyle = part.color;
        ctx.globalAlpha = Math.max(0, part.life / 20);
        ctx.beginPath(); ctx.arc(part.x, part.y, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        if (part.life <= 0) particles.splice(pt, 1);
      }

      if (hero.swing > 0) {
        hero.swing--;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(hero.x, hero.y, 36, 0, Math.PI * 2); ctx.stroke();
      }

      if (hero.invuln % 6 < 4) {
        if (pools.player.length > 0) {
          var pSp = pools.player[animFrameIdx % pools.player.length];
          drawSpriteEntry(ctx, pSp, hero.x, hero.y, 58, hero.facingLeft, 0);
        } else {
          ctx.fillStyle = META.accentColor || '#3B82F6';
          ctx.beginPath(); ctx.arc(hero.x, hero.y, 18, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#BFDBFE'; ctx.lineWidth = 2.5; ctx.stroke();
        }
      }

      hud.textContent = 'Fase ' + stageLevel + ' · Pontos ' + scoreVal;
      requestAnimationFrame(loop2d);
    }
    loop2d();
  } else if (META.category === 'game_3d') {
    var iconHtml3d = META.iconPath ? '<img src="' + META.iconPath + '" alt="" />' : '';
    root.innerHTML =
      '<div class="hud-top">' +
        '<div class="hud-card">' + iconHtml3d + '<span>' + META.appName + '</span></div>' +
        '<div class="hud-card" id="race-hud"></div>' +
      '</div>' +
      '<canvas id="race"></canvas>' +
      '<div class="controls-layer">' +
        '<div style="display:flex;gap:10px;pointer-events:auto;">' +
          '<button class="btn-pad" style="width:68px;height:54px;" id="steer-l">◀</button>' +
          '<button class="btn-pad" style="width:68px;height:54px;" id="steer-r">▶</button>' +
        '</div>' +
        '<button class="btn-action btn-a" style="width:84px;border-radius:16px;background:#0D9488;" id="btn-nitro">TURBO</button>' +
      '</div>';

    var rCanvas = document.getElementById('race');
    var rCtx = rCanvas.getContext('2d');
    var rHud = document.getElementById('race-hud');
    var pts = parseInt(saves.career_championship_points || '0', 10) || 0;
    var lane = 0, steerVel = 0, speed = 290, tick = 0;

    function rResize() { rCanvas.width = window.innerWidth; rCanvas.height = window.innerHeight; }
    window.addEventListener('resize', rResize); rResize();

    window.addEventListener('deviceorientation', function(e) {
      if (e.gamma !== null) { lane = Math.max(-2.2, Math.min(2.2, e.gamma / 18)); }
    });
    document.getElementById('steer-l').addEventListener('pointerdown', function() { steerVel = -0.07; startBgmIfAvailable(); });
    document.getElementById('steer-l').addEventListener('pointerup', function() { steerVel = 0; });
    document.getElementById('steer-r').addEventListener('pointerdown', function() { steerVel = 0.07; startBgmIfAvailable(); });
    document.getElementById('steer-r').addEventListener('pointerup', function() { steerVel = 0; });
    document.getElementById('btn-nitro').addEventListener('click', function() {
      speed = 385; pts += 125; setSave('career_championship_points', pts); playSfx(320, 0.25, 'sawtooth');
    });

    function loop3d() {
      var pools3d = resolveSpritePools();
      lane = Math.max(-2.2, Math.min(2.2, lane + steerVel));
      if (speed > 285) speed -= 0.6;
      tick = (tick + speed / 90) % 100;

      var w = rCanvas.width, h = rCanvas.height, hz = h * 0.38;
      rCtx.fillStyle = '#060913'; rCtx.fillRect(0, 0, w, h);
      if (pools3d.bg && pools3d.bg.img && pools3d.bg.img.complete && pools3d.bg.img.naturalWidth > 0) {
        rCtx.drawImage(pools3d.bg.img, 0, 0, w, hz);
      }
      rCtx.strokeStyle = '#0D9488'; rCtx.lineWidth = 2;
      rCtx.beginPath(); rCtx.moveTo(0, hz); rCtx.lineTo(w, hz); rCtx.stroke();

      var cx = w / 2 - lane * 65;
      for (var i = -5; i <= 5; i++) {
        rCtx.strokeStyle = i === 0 ? '#2DD4BF' : '#1E293B';
        rCtx.beginPath(); rCtx.moveTo(cx + i * 18, hz); rCtx.lineTo(cx + i * 160, h); rCtx.stroke();
      }
      for (var d = 1; d <= 8; d++) {
        var p = ((tick + d * 12.5) % 100) / 100;
        var y = hz + Math.pow(p, 2.2) * (h - hz);
        rCtx.strokeStyle = 'rgba(45, 212, 191, 0.32)';
        rCtx.beginPath(); rCtx.moveTo(0, y); rCtx.lineTo(w, y); rCtx.stroke();
      }

      var shipX = w / 2 + lane * 55, shipY = h - 110;
      if (pools3d.player.length > 0) {
        drawSpriteEntry(rCtx, pools3d.player[0], shipX, shipY, 74, false, 0);
      } else {
        rCtx.fillStyle = '#0F766E';
        rCtx.beginPath(); rCtx.moveTo(shipX, shipY - 26); rCtx.lineTo(shipX + 40, shipY + 18); rCtx.lineTo(shipX - 40, shipY + 18); rCtx.closePath(); rCtx.fill();
        rCtx.strokeStyle = '#5EEAD4'; rCtx.lineWidth = 2.5; rCtx.stroke();
      }

      rHud.textContent = Math.round(speed) + ' KM/H · ' + pts + ' PTS';
      requestAnimationFrame(loop3d);
    }
    loop3d();
  } else if (META.category === 'audio_tool') {
    var bpm = parseInt(saves.sequencer_bpm || '118', 10) || 118;
    var cutoff = parseFloat(saves.filter_cutoff_hz || '2450') || 2450;
    root.innerHTML =
      '<div class="synth-root">' +
        '<div class="synth-header">' +
          '<div><div style="font-size:11px;color:#F59E0B;font-weight:700;">AUDIO DSP</div>' +
          '<div style="font-size:20px;font-weight:700;">' + META.appName + '</div></div>' +
          '<button class="cupertino-btn" style="background:#D97706;" id="seq-toggle">Sequenciador (' + bpm + ' BPM)</button>' +
        '</div>' +
        '<div class="synth-controls">' +
          '<div class="synth-box"><div style="font-size:11px;color:#94A3B8;">Preset</div><div style="font-size:13px;font-weight:600;margin-top:4px;">' + (saves.active_patch_name || 'Analog Lead') + '</div></div>' +
          '<div class="synth-box"><div style="font-size:11px;color:#94A3B8;">Filtro Cutoff (Hz)</div><input type="range" id="cutoff" min="200" max="6000" value="' + cutoff + '" style="width:100%;margin-top:6px;" /></div>' +
          '<div class="synth-box"><div style="font-size:11px;color:#94A3B8;">Onda</div><select id="wave" style="width:100%;margin-top:4px;background:#090D16;color:#fff;border:1px solid #334155;border-radius:6px;padding:4px;"><option value="sawtooth">Sawtooth</option><option value="square">Square</option><option value="triangle">Triangle</option></select></div>' +
        '</div>' +
        '<div class="synth-keys" id="keys"></div>' +
      '</div>';

    var notes = [
      { n: 'C4', f: 261.63 }, { n: 'D4', f: 293.66 }, { n: 'E4', f: 329.63 }, { n: 'F4', f: 349.23 },
      { n: 'G4', f: 392.00 }, { n: 'A4', f: 440.00 }, { n: 'B4', f: 493.88 }, { n: 'C5', f: 523.25 }
    ];
    var keysEl = document.getElementById('keys');
    var waveSel = document.getElementById('wave');
    var cutoffInput = document.getElementById('cutoff');

    function triggerSynth(freq, btnEl) {
      try {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!audioCtx) audioCtx = new Ctx();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        var osc = audioCtx.createOscillator();
        var flt = audioCtx.createBiquadFilter();
        var g = audioCtx.createGain();
        osc.type = waveSel.value;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        flt.type = 'lowpass';
        flt.frequency.setValueAtTime(parseFloat(cutoffInput.value), audioCtx.currentTime);
        g.gain.setValueAtTime(0.16, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45);
        osc.connect(flt); flt.connect(g); g.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.45);
      } catch (e) {}
      if (btnEl) {
        btnEl.classList.add('active');
        setTimeout(function() { btnEl.classList.remove('active'); }, 220);
      }
    }

    notes.forEach(function(item) {
      var k = document.createElement('button');
      k.className = 'synth-key';
      k.textContent = item.n;
      k.addEventListener('pointerdown', function(e) { e.preventDefault(); triggerSynth(item.f, k); });
      keysEl.appendChild(k);
    });

    cutoffInput.addEventListener('change', function() { setSave('filter_cutoff_hz', cutoffInput.value); });

    var seqTimer = null, step = 0;
    document.getElementById('seq-toggle').addEventListener('click', function() {
      if (seqTimer) { clearInterval(seqTimer); seqTimer = null; this.textContent = 'Sequenciador (' + bpm + ' BPM)'; }
      else {
        this.textContent = 'Parar';
        var btns = keysEl.querySelectorAll('.synth-key');
        seqTimer = setInterval(function() {
          var idx = [0, 2, 4, 7, 4, 2][step % 6];
          triggerSynth(notes[idx].f, btns[idx]);
          step++;
        }, (60 / bpm) * 500);
      }
    });
  } else {
    var items = [];
    try {
      items = JSON.parse(localStorage.getItem(STORAGE_KEY + '_notes') || 'null') || [
        { id: 1, text: 'Lista de tarefas e notas de ' + META.appName, done: false }
      ];
    } catch (e) {}

    function renderCupertino() {
      var rowsHtml = items.map(function(it) {
        return '<div class="cupertino-row" data-id="' + it.id + '">' +
          '<span style="' + (it.done ? 'text-decoration:line-through;color:#8E8E93;' : 'font-weight:500;') + '">' + it.text + '</span>' +
          '<span style="color:' + (it.done ? '#007AFF' : '#C7C7CC') + ';font-weight:700;">' + (it.done ? '✓' : '○') + '</span>' +
        '</div>';
      }).join('');

      var saveRowsHtml = Object.keys(saves).map(function(k) {
        return '<div class="cupertino-row"><span style="color:#3C3C43;font-size:13px;">' + k + '</span><span style="color:#007AFF;font-family:monospace;font-size:13px;">' + saves[k] + '</span></div>';
      }).join('');

      var artworkSection = '';
      if (META.artworkPaths && META.artworkPaths.length > 0) {
        artworkSection =
          '<div style="font-size:12px;font-weight:600;color:#6E6E73;text-transform:uppercase;padding-left:6px;">Recursos do Aplicativo</div>' +
          '<div class="cupertino-card"><div class="asset-gallery">' +
            META.artworkPaths.map(function(p) { return '<img class="asset-thumb" src="' + p + '" alt="" />'; }).join('') +
          '</div></div>';
      }

      var iconTag = META.iconPath
        ? '<img class="cupertino-icon" src="' + META.iconPath + '" alt="" />'
        : '<div class="cupertino-icon" style="background:' + META.accentColor + ';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;">' + META.monogram + '</div>';

      root.innerHTML =
        '<div class="cupertino-root">' +
          '<div class="cupertino-nav">' +
            '<div class="cupertino-brand">' +
              iconTag +
              '<div><div class="cupertino-title">' + META.appName + '</div><div class="cupertino-sub">v' + META.version + ' · ' + META.bundleId + '</div></div>' +
            '</div>' +
          '</div>' +
          '<div class="cupertino-body">' +
            '<div style="display:flex;gap:8px;">' +
              '<input class="cupertino-input" id="new-item" placeholder="Nova anotação..." />' +
              '<button class="cupertino-btn" id="add-btn">Adicionar</button>' +
            '</div>' +
            '<div class="cupertino-card" id="notes-list">' + rowsHtml + '</div>' +
            artworkSection +
            (saveRowsHtml ? '<div style="font-size:12px;font-weight:600;color:#6E6E73;text-transform:uppercase;padding-left:6px;">Preferências</div><div class="cupertino-card">' + saveRowsHtml + '</div>' : '') +
          '</div>' +
        '</div>';

      document.querySelectorAll('#notes-list .cupertino-row').forEach(function(r) {
        r.addEventListener('click', function() {
          var id = Number(r.getAttribute('data-id'));
          items = items.map(function(x) { return x.id === id ? { id: x.id, text: x.text, done: !x.done } : x; });
          try { localStorage.setItem(STORAGE_KEY + '_notes', JSON.stringify(items)); } catch (e) {}
          playSfx(660, 0.08, 'sine');
          renderCupertino();
        });
      });

      document.getElementById('add-btn').addEventListener('click', function() {
        var inp = document.getElementById('new-item');
        if (!inp.value.trim()) return;
        items.unshift({ id: Date.now(), text: inp.value.trim(), done: false });
        try { localStorage.setItem(STORAGE_KEY + '_notes', JSON.stringify(items)); } catch (e) {}
        playSfx(820, 0.1, 'sine');
        renderCupertino();
      });
    }
    renderCupertino();
  }
})();
</script>
</body>
</html>`;
}
