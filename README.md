<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/e8e44d66-1c5f-4f83-8d7c-3657a952031f

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## PortBridge Studio — conversor IPA para APK

- **Rota web** (aba "Rota web"): IPA de app web (Cordova, PhoneGap, Ionic, Capacitor,
  RPG Maker MV/MZ, Construct, HTML5) → APK assinado, inteiro no navegador. Não precisa
  de `GEMINI_API_KEY` nem de Java; funciona também para IPAs de 64 bits e com FairPlay.
  Usa `public/templates/web.apk` (não apague) e o código em `src/core/packager/`.
- **Jogos nativos de 32 bits** (emulação touchHLE) e **Clickteam Fusion**: use o app
  conversor Android ou `java -jar portbridge-converter.jar Jogo.ipa` (veja `android/`).
- Testes: `npm test` · checagem de tipos: `npm run lint` · build: `npm run build`.

Detalhes da rota web: [`android/web/README.md`](android/web/README.md).
