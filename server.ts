import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

const RUNTIME_SAFETY_SHIM = `<script>
(function(){
  try {
    var t = '__pb_test__';
    window.localStorage.setItem(t, '1');
    window.localStorage.removeItem(t);
  } catch (e) {
    var mem = {};
    var safeStore = {
      getItem: function(k){ return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem: function(k, v){ mem[k] = String(v); },
      removeItem: function(k){ delete mem[k]; },
      clear: function(){ mem = {}; }
    };
    try { Object.defineProperty(window, 'localStorage', { value: safeStore, configurable: true }); } catch (_) {}
  }
  if (typeof CanvasRenderingContext2D !== 'undefined') {
    var origDraw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function(img) {
      if (!img) return;
      if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) {
        if (!img.complete || img.naturalWidth === 0) return;
      }
      try { return origDraw.apply(this, arguments); } catch (_) {}
    };
  }
})();
</script>`;

function injectSafetyShim(html: string): string {
  if (html.includes('__pb_test__')) return html;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (match) => `${match}\n${RUNTIME_SAFETY_SHIM}`);
  }
  return `${RUNTIME_SAFETY_SHIM}\n${html}`;
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface ReconstructRequestBody {
  appName: string;
  bundleId: string;
  version: string;
  category: string;
  orientation: string;
  iconRelativePath?: string | null;
  coverArtRelativePath?: string | null;
  artworkMeta?: { path: string; originalName: string; width: number; height: number }[];
  spriteAtlases?: {
    plistName: string;
    textureName?: string;
    matchedSheetPath?: string;
    frames: { name: string; x: number; y: number; w: number; h: number }[];
  }[];
  audioPaths?: string[];
  configFilesSummary?: { name: string; preview: string }[];
  machOSymbols?: string[];
  saves?: { key: string; value: string }[];
  sampleImagesBase64?: { mimeType: string; data: string; label: string }[];
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '20mb' }));

  app.post('/api/reconstruct-runtime', async (req: Request, res: Response) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY não configurada no painel Settings > Secrets.',
      });
      return;
    }

    try {
      const body = req.body as ReconstructRequestBody;
      const {
        appName,
        bundleId,
        version,
        category,
        orientation,
        iconRelativePath,
        coverArtRelativePath,
        artworkMeta = [],
        spriteAtlases = [],
        audioPaths = [],
        configFilesSummary = [],
        machOSymbols = [],
        saves = [],
        sampleImagesBase64 = [],
      } = body;

      const systemInstruction = [
        'Você é um engenheiro especialista em portabilidade de jogos iOS (.ipa) para Android WebView HTML5/Canvas.',
        'Gere UM ÚNICO arquivo HTML5 autocontido e 100% jogável (com <style> e <script> internos, ZERO bibliotecas externas/CDNs) de aproximadamente 240 a 340 linhas, enxuto, rápido e sem erros.',
        'REGRAS OBRIGATÓRIAS:',
        '1. Use SOMENTE os caminhos relativos reais listados em artworkMeta, coverArtRelativePath, iconRelativePath e audioPaths. Sempre verifique (img.complete && img.naturalWidth > 0) antes de desenhar imagens, com fallback gráfico limpo caso uma imagem ainda esteja carregando.',
        '2. Se spriteAtlases contiver frames (x, y, w, h) e matchedSheetPath, desenhe os recortes reais da spritesheet via ctx.drawImage(sheetImg, f.x, f.y, f.w, f.h, dx, dy, dw, dh).',
        '3. Reconstrua a mecânica REAL do jogo com base no nome/bundleId, nas imagens e em machOSymbols (por exemplo, para Zorbié / com.gameatelier.zorbie: jogo arcade de ação onde o personagem na base da tela se move para a esquerda/direita, arremessa seu machado giratório para o céu para abater pássaros/chefes, desvia do próprio machado quando ele cai pela gravidade e coleta as aves caídas antes que o cronômetro zere; para outros jogos, implemente a mecânica correspondente fielmente).',
        '4. Controles de toque imediatos e fluidos (arrastar na tela + botões de toque responsivos), tela inicial com botão JOGAR usando a capa real, HUD de pontos/tempo/fase, partículas e áudio real (audioPaths com fallback WebAudio).',
        '5. Sempre envolva acessos a localStorage e Audio.play() em blocos try/catch.',
        '6. Retorne APENAS o HTML puro começando com <!DOCTYPE html> e terminando com </html>, sem markdown.',
      ].join('\n');

      const promptText = [
        `Reconstrua o jogo/aplicativo iOS abaixo para rodar perfeitamente em tela cheia no Android:`,
        `- Nome: ${appName} (v${version}) | Bundle ID: ${bundleId} | Categoria: ${category} | Orientação: ${orientation}`,
        `- Capa / Ícone: cover=${coverArtRelativePath || 'nenhum'}, icon=${iconRelativePath || 'nenhum'}`,
        `- Imagens extraídas (${artworkMeta.length}): ${JSON.stringify(artworkMeta.slice(0, 50))}`,
        `- Atlas de Sprites .plist (${spriteAtlases.length}): ${JSON.stringify(
          spriteAtlases.slice(0, 8).map((a) => ({
            plistName: a.plistName,
            matchedSheetPath: a.matchedSheetPath || a.textureName,
            frames: a.frames.slice(0, 40),
          }))
        )}`,
        `- Áudios extraídos (${audioPaths.length}): ${JSON.stringify(audioPaths)}`,
        `- Configurações extras: ${JSON.stringify(configFilesSummary.slice(0, 6))}`,
        `- Símbolos Mach-O extraídos: ${JSON.stringify(machOSymbols.slice(0, 120))}`,
        `- Saves iniciais: ${JSON.stringify(saves.slice(0, 10))}`,
      ].join('\n');

      const parts: Array<
        | { text: string }
        | { inlineData: { mimeType: string; data: string } }
      > = [];

      for (const sample of sampleImagesBase64.slice(0, 3)) {
        if (sample.data && sample.mimeType) {
          parts.push({
            inlineData: {
              mimeType: sample.mimeType,
              data: sample.data,
            },
          });
          parts.push({
            text: `Textura real extraída do .ipa (${sample.label}):`,
          });
        }
      }
      parts.push({ text: promptText });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          systemInstruction,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      const cleaned = rawText
        .replace(/^```html\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const match = cleaned.match(/<!DOCTYPE html[\s\S]*<\/html>/i);
      const extractedHtml = match ? match[0] : cleaned.startsWith('<') ? cleaned : '';

      if (!extractedHtml || extractedHtml.length < 250) {
        res.status(422).json({
          error: 'O compilador dinâmico retornou um HTML incompleto.',
        });
        return;
      }

      res.json({
        html: injectSafetyShim(extractedHtml),
        model: 'gemini-4-hydrogen',
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Falha ao reconstruir runtime via Gemini API.';
      const status =
        message.includes('403') || message.includes('PERMISSION_DENIED')
          ? 403
          : message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
          ? 429
          : 500;
      res.status(status).json({ error: message });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PortBridge server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
