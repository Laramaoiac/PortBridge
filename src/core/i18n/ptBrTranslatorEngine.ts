/**
 * PortBridge PT-BR Translation Engine (Offline Deterministic + Optional Gemini Batch API).
 *
 * Translates extracted iOS app & game strings (.strings, .xcstrings, Clickteam .cci,
 * GameMaker STRG, RPG Maker JSON, Godot .po/.csv) into Brazilian Portuguese (pt-BR)
 * with strict placeholder preservation, case preservation, optional ASCII folding for
 * legacy bitmap fonts, and zero destructive binary patching.
 */
import {
  buildValidatedTranslationPack,
  type ExtractedI18nEntry,
  type TranslationPack,
  validateTranslatedPlaceholders,
} from './translationPipeline.ts';

const PT_BR_GLOSSARY: Record<string, string> = {
  // Core Game & Menu UI
  play: 'jogar',
  'play now': 'jogar agora',
  'play again': 'jogar novamente',
  start: 'iniciar',
  'start game': 'iniciar jogo',
  'new game': 'novo jogo',
  continue: 'continuar',
  resume: 'retomar',
  pause: 'pausar',
  paused: 'pausado',
  options: 'opções',
  settings: 'configurações',
  preferences: 'preferências',
  controls: 'controles',
  language: 'idioma',
  audio: 'áudio',
  sound: 'som',
  'sound effects': 'efeitos sonoros',
  sfx: 'efeitos',
  music: 'música',
  volume: 'volume',
  mute: 'silenciar',
  on: 'ligado',
  off: 'desligado',
  enabled: 'ativado',
  disabled: 'desativado',
  shop: 'loja',
  store: 'loja',
  upgrades: 'melhorias',
  upgrade: 'melhorar',
  'power ups': 'melhorias',
  'power-ups': 'melhorias',
  missions: 'missões',
  mission: 'missão',
  quests: 'missões',
  quest: 'missão',
  achievements: 'conquistas',
  leaderboard: 'placar',
  leaderboards: 'placares',
  rankings: 'classificação',
  inventory: 'inventário',
  equipment: 'equipamento',
  items: 'itens',
  skills: 'habilidades',
  abilities: 'habilidades',
  stats: 'atributos',
  profile: 'perfil',
  character: 'personagem',
  characters: 'personagens',
  map: 'mapa',
  world: 'mundo',
  worlds: 'mundos',
  stage: 'fase',
  stages: 'fases',
  level: 'nível',
  levels: 'níveis',
  chapter: 'capítulo',
  tutorial: 'tutorial',
  help: 'ajuda',
  about: 'sobre',
  credits: 'créditos',
  quit: 'sair',
  exit: 'sair',
  'main menu': 'menu principal',
  'title screen': 'tela inicial',
  back: 'voltar',
  next: 'próximo',
  previous: 'anterior',
  skip: 'pular',
  close: 'fechar',
  ok: 'ok',
  yes: 'sim',
  no: 'não',
  cancel: 'cancelar',
  confirm: 'confirmar',
  apply: 'aplicar',
  accept: 'aceitar',
  decline: 'recusar',
  retry: 'tentar novamente',
  'try again': 'tentar novamente',
  restart: 'reiniciar',
  reset: 'redefinir',
  'reset progress': 'apagar progresso',
  save: 'salvar',
  'save game': 'salvar jogo',
  load: 'carregar',
  'load game': 'carregar jogo',
  loading: 'carregando',
  'loading...': 'carregando...',
  'please wait': 'aguarde',
  'please wait...': 'aguarde...',

  // HUD & Gameplay
  score: 'pontuação',
  'high score': 'recorde',
  'best score': 'melhor pontuação',
  best: 'melhor',
  points: 'pontos',
  coins: 'moedas',
  coin: 'moeda',
  gold: 'ouro',
  gems: 'gemas',
  diamonds: 'diamantes',
  lives: 'vidas',
  life: 'vida',
  health: 'saúde',
  energy: 'energia',
  stamina: 'vigor',
  mana: 'mana',
  shield: 'escudo',
  defense: 'defesa',
  attack: 'ataque',
  speed: 'velocidade',
  damage: 'dano',
  time: 'tempo',
  timer: 'cronômetro',
  wave: 'onda',
  round: 'rodada',
  boss: 'chefe',
  combo: 'combo',
  bonus: 'bônus',
  reward: 'recompensa',
  rewards: 'recompensas',
  daily: 'diário',
  'daily reward': 'recompensa diária',
  victory: 'vitória',
  defeat: 'derrota',
  'you win': 'você venceu',
  'you win!': 'você venceu!',
  'you lose': 'você perdeu',
  'you lose!': 'você perdeu!',
  'game over': 'fim de jogo',
  'game over!': 'fim de jogo!',
  'stage clear': 'fase concluída',
  'stage clear!': 'fase concluída!',
  'level complete': 'nível concluído',
  'level complete!': 'nível concluído!',
  'mission complete': 'missão concluída',
  'mission complete!': 'missão concluída!',
  'next level': 'próxima fase',
  'next stage': 'próxima fase',
  'tap to play': 'toque para jogar',
  'tap to start': 'toque para iniciar',
  'tap to continue': 'toque para continuar',
  'touch to start': 'toque para começar',
  'press start': 'pressione iniciar',
  'press play to start!': 'pressione jogar para começar!',
  'press any key': 'pressione qualquer tecla',
  ready: 'preparar',
  'ready?': 'pronto?',
  go: 'vai',
  'go!': 'vai!',
  jump: 'pular',
  fire: 'atirar',
  shoot: 'atirar',
  throw: 'arremessar',
  dodge: 'desviar',
  dash: 'avançar',

  // Store & Purchases (StoreKit / iOSStore)
  buy: 'comprar',
  purchase: 'comprar',
  purchased: 'comprado',
  owned: 'adquirido',
  equip: 'equipar',
  equipped: 'equipado',
  unlock: 'desbloquear',
  unlocked: 'desbloqueado',
  locked: 'bloqueado',
  free: 'grátis',
  'restore purchases': 'restaurar compras',
  'restore transactions': 'restaurar compras',
  'full game': 'jogo completo',
  'unlock full game': 'desbloquear jogo completo',
  'remove ads': 'remover anúncios',
  'not enough coins': 'moedas insuficientes',
  'insufficient funds': 'saldo insuficiente',

  // General Productivity / App UI
  home: 'início',
  search: 'buscar',
  'search...': 'buscar...',
  add: 'adicionar',
  create: 'criar',
  edit: 'editar',
  delete: 'excluir',
  remove: 'remover',
  done: 'concluído',
  finish: 'finalizar',
  share: 'compartilhar',
  export: 'exportar',
  import: 'importar',
  sync: 'sincronizar',
  backup: 'backup',
  restore: 'restaurar',
  login: 'entrar',
  'log in': 'entrar',
  'sign in': 'entrar',
  'sign up': 'criar conta',
  'log out': 'sair',
  'sign out': 'sair',
  account: 'conta',
  notifications: 'notificações',
  privacy: 'privacidade',
  'privacy policy': 'política de privacidade',
  'terms of service': 'termos de uso',
  error: 'erro',
  warning: 'aviso',
  success: 'sucesso',
  'no internet connection': 'sem conexão com a internet',
  'connection error': 'erro de conexão',
};

interface PatternRule {
  regex: RegExp;
  replace: (match: RegExpMatchArray) => string;
}

const PATTERN_RULES: PatternRule[] = [
  { regex: /^score\s*:\s*(.+)$/i, replace: (m) => `Pontuação: ${m[1]}` },
  { regex: /^high\s*score\s*:\s*(.+)$/i, replace: (m) => `Recorde: ${m[1]}` },
  { regex: /^best\s*:\s*(.+)$/i, replace: (m) => `Melhor: ${m[1]}` },
  { regex: /^coins?\s*(?:collected)?\s*:\s*(.+)$/i, replace: (m) => `Moedas: ${m[1]}` },
  { regex: /^gold\s*:\s*(.+)$/i, replace: (m) => `Ouro: ${m[1]}` },
  { regex: /^lives?\s*:\s*(.+)$/i, replace: (m) => `Vidas: ${m[1]}` },
  { regex: /^time\s*:\s*(.+)$/i, replace: (m) => `Tempo: ${m[1]}` },
  { regex: /^level\s+(\d+|%[0-9$.]*[diu@s]|\{\d+\})$/i, replace: (m) => `Nível ${m[1]}` },
  { regex: /^stage\s+(\d+|%[0-9$.]*[diu@s]|\{\d+\})$/i, replace: (m) => `Fase ${m[1]}` },
  { regex: /^world\s+(\d+|%[0-9$.]*[diu@s]|\{\d+\})$/i, replace: (m) => `Mundo ${m[1]}` },
  { regex: /^wave\s+(\d+|%[0-9$.]*[diu@s]|\{\d+\})$/i, replace: (m) => `Onda ${m[1]}` },
  { regex: /^chapter\s+(\d+|%[0-9$.]*[diu@s]|\{\d+\})$/i, replace: (m) => `Capítulo ${m[1]}` },
  { regex: /^hp\s*:\s*(.+)$/i, replace: (m) => `PV: ${m[1]}` },
  { regex: /^buy\s+for\s+(.+)$/i, replace: (m) => `Comprar por ${m[1]}` },
  { regex: /^unlock\s+for\s+(.+)$/i, replace: (m) => `Desbloquear por ${m[1]}` },
  { regex: /^welcome,?\s+(.+)$/i, replace: (m) => `Bem-vindo, ${m[1]}` },
  { regex: /^hello\s+(.+)$/i, replace: (m) => `Olá ${m[1]}` },
  { regex: /^version\s+(.+)$/i, replace: (m) => `Versão ${m[1]}` },
  { regex: /^(.+)\s+boss\s+stage$/i, replace: (m) => `Fase do Chefe ${m[1]}` },
  { regex: /^(.+)\s+complete(!?)$/i, replace: (m) => `${m[1]} concluído${m[2]}` },
];

/**
 * Strips Portuguese diacritics for legacy ASCII-only Bitmap Fonts when requested by the user.
 */
export function foldPortugueseToAscii(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function matchCasing(source: string, translated: string): string {
  const letters = source.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '');
  if (letters.length >= 2 && letters === letters.toUpperCase()) {
    return translated.toUpperCase();
  }
  if (/^[A-ZÀ-Ö]/.test(source) && /^[a-zà-ö]/.test(translated)) {
    return translated[0].toUpperCase() + translated.slice(1);
  }
  return translated;
}

/**
 * Translates a single UI/game string to Brazilian Portuguese offline.
 * Returns null if no high-confidence deterministic translation exists.
 */
export function translateSingleStringOfflinePtBr(
  original: string,
  options?: { asciiFold?: boolean }
): string | null {
  const trimmed = original.trim();
  if (!trimmed) return null;

  let candidate: string | null = null;
  const lower = trimmed.toLowerCase();

  // 1. Exact glossary match
  if (Object.prototype.hasOwnProperty.call(PT_BR_GLOSSARY, lower)) {
    candidate = matchCasing(trimmed, PT_BR_GLOSSARY[lower]);
  }

  // 2. Match stripping trailing punctuation (!, ?, :, ...)
  if (!candidate) {
    const punctMatch = trimmed.match(/^(.*?)([!?:.…]+)$/);
    if (punctMatch) {
      const stemLower = punctMatch[1].trim().toLowerCase();
      if (Object.prototype.hasOwnProperty.call(PT_BR_GLOSSARY, stemLower)) {
        candidate = matchCasing(punctMatch[1], PT_BR_GLOSSARY[stemLower]) + punctMatch[2];
      }
    }
  }

  // 3. Parameterized template rules
  if (!candidate) {
    for (const rule of PATTERN_RULES) {
      const m = trimmed.match(rule.regex);
      if (m) {
        const rawOut = rule.replace(m);
        candidate = matchCasing(trimmed, rawOut);
        break;
      }
    }
  }

  if (!candidate) return null;

  // Validate placeholders strictly before accepting
  const check = validateTranslatedPlaceholders(trimmed, candidate);
  if (!check.accepted) return null;

  return options?.asciiFold ? foldPortugueseToAscii(candidate) : candidate;
}

export interface OfflinePtBrTranslationResult {
  pack: TranslationPack;
  translatedCount: number;
  untranslatedEntries: ExtractedI18nEntry[];
}

/**
 * Translates an array of extracted i18n entries to PT-BR 100% offline.
 */
export function translateEntriesToPtBrOffline(
  bundleId: string,
  entries: ExtractedI18nEntry[],
  options?: {
    manualOverrides?: Record<string, string>;
    fallbackFontMode?: TranslationPack['fallbackFontMode'];
    autoShrinkMinScale?: number;
  }
): OfflinePtBrTranslationResult {
  const asciiFold = options?.fallbackFontMode === 'ascii_fold';
  const translations: Record<string, string> = {};
  const untranslatedEntries: ExtractedI18nEntry[] = [];

  for (const entry of entries) {
    const manual =
      options?.manualOverrides?.[entry.key] ??
      options?.manualOverrides?.[entry.original];
    if (manual && manual.trim()) {
      translations[entry.key] = asciiFold ? foldPortugueseToAscii(manual.trim()) : manual.trim();
      continue;
    }

    const offline = translateSingleStringOfflinePtBr(entry.original, { asciiFold });
    if (offline) {
      translations[entry.key] = offline;
    } else {
      untranslatedEntries.push(entry);
    }
  }

  const pack = buildValidatedTranslationPack(bundleId, 'pt-BR', entries, translations, {
    fallbackFontMode: options?.fallbackFontMode ?? 'stb_truetype_utf8',
    autoShrinkMinScale: options?.autoShrinkMinScale ?? 0.78,
  });

  return {
    pack,
    translatedCount: Object.keys(pack.entries).length,
    untranslatedEntries,
  };
}

/**
 * Calls the local PortBridge backend (/api/translate-ptbr) powered by Gemini to translate
 * remaining complex narrative/dialogue strings, falling back seamlessly to offline glossary.
 */
export async function translateEntriesToPtBrHybrid(
  bundleId: string,
  appName: string,
  entries: ExtractedI18nEntry[],
  options?: {
    manualOverrides?: Record<string, string>;
    fallbackFontMode?: TranslationPack['fallbackFontMode'];
    autoShrinkMinScale?: number;
    useAiForRemaining?: boolean;
  }
): Promise<OfflinePtBrTranslationResult & { aiTranslatedCount: number; usedAi: boolean }> {
  const offlineRes = translateEntriesToPtBrOffline(bundleId, entries, options);
  if (
    !options?.useAiForRemaining ||
    offlineRes.untranslatedEntries.length === 0 ||
    typeof fetch === 'undefined'
  ) {
    return { ...offlineRes, aiTranslatedCount: 0, usedAi: false };
  }

  const asciiFold = options.fallbackFontMode === 'ascii_fold';
  const mergedOverrides: Record<string, string> = { ...(options.manualOverrides || {}) };
  for (const item of Object.values(offlineRes.pack.entries)) {
    mergedOverrides[item.original] = item.translated;
  }

  let aiTranslatedCount = 0;
  let usedAi = false;

  try {
    const batch = offlineRes.untranslatedEntries.slice(0, 120).map((e) => ({
      key: e.key,
      context: e.context,
      original: e.original,
      placeholders: e.placeholders,
    }));

    const resp = await fetch('/api/translate-ptbr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appName, bundleId, entries: batch }),
    });

    if (resp.ok) {
      const data = (await resp.json()) as { translations?: Record<string, string> };
      if (data.translations && typeof data.translations === 'object') {
        usedAi = true;
        for (const e of offlineRes.untranslatedEntries) {
          const t = data.translations[e.key] ?? data.translations[e.original];
          if (typeof t === 'string' && t.trim()) {
            const cleaned = asciiFold ? foldPortugueseToAscii(t.trim()) : t.trim();
            if (validateTranslatedPlaceholders(e.original, cleaned).accepted) {
              mergedOverrides[e.key] = cleaned;
              aiTranslatedCount++;
            }
          }
        }
      }
    }
  } catch {
    // Offline fallback silently preserved
  }

  const finalRes = translateEntriesToPtBrOffline(bundleId, entries, {
    ...options,
    manualOverrides: mergedOverrides,
  });

  return {
    ...finalRes,
    aiTranslatedCount,
    usedAi,
  };
}
