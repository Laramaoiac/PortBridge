# Template web — apps web de iOS (Cordova, Capacitor, RPG Maker, Construct)

Este módulo gera `web-release-unsigned.apk` (≈27 KB, sem código nativo), o template
que o conversor usa quando o IPA é um app web. Como o executável do iOS não é usado,
a rota funciona também para **IPAs de 64 bits** e para **IPAs com FairPlay** (a
criptografia da App Store cobre só o executável, não o conteúdo web).

## O que o conversor detecta

| Motor | Sinal no `.app` | Conteúdo |
|---|---|---|
| Cordova / PhoneGap / Ionic 1–3 | `www/cordova.js`, `www/cordova_plugins.js` ou `www/phonegap.js` | `www/` (página inicial do `config.xml`) |
| Capacitor / Ionic 4+ | `capacitor.config.json` + `public/index.html` | `public/` |
| RPG Maker MV / MZ | `js/rpg_core.js` / `js/rmmz_core.js` | `www/` ou `public/` |
| Construct 2 / 3 | `c2runtime.js` / `scripts/c3runtime.js` | `www/` |
| HTML5 genérico | `index.html` e um executável que só usa `UIWebView`/`WKWebView` (sem OpenGL ES) | a pasta do `index.html` |

O conversor copia o conteúdo para `assets/web/` (PNG no formato CgBI da Apple vira PNG
comum; mídia já comprimida vai sem compressão) e grava a página inicial e a orientação
em `assets/portbridge.json`.

## Como o APK gerado roda o app

- `WebGameActivity` abre um WebView em tela cheia em `https://localhost/<página>`; o
  `WebRouter` (módulo `:webruntime`) entrega os arquivos de `assets/web`, responde a
  pedidos com Range (áudio/vídeo) e injeta `/__portbridge/bridge.js` como primeiro
  script de todo HTML. A origem fixa mantém o `localStorage`/IndexedDB (saves) e deixa
  `fetch`/XHR de arquivos locais funcionarem.
- O app continua com o **`cordova.js` de iOS dele**. A ponte faz o papel do lado
  nativo do iOS: o cordova-ios 3.x, 6.x e 7.x mandam os comandos para
  `window.webkit.messageHandlers.cordova`; no 4.x e 5.x (UIWebView) a ponte troca o
  módulo `cordova/exec`, como o plugin oficial `cordova-plugin-wkwebview-engine`.
- Plugins implementados: Device, StatusBar, SplashScreen/CDVLaunchScreen,
  NetworkStatus, Vibration, Notification (diálogos nativos), Media,
  NativeAudio/LowLatencyAudio, InAppBrowser (abre o navegador), Console, Keyboard,
  Globalization, AppVersion, Insomnia, ScreenOrientation e File (só os caminhos
  `cordova.file.*`; os jogos costumam salvar em `localStorage`).
- Plugin que só existe no iOS (loja, Game Center, anúncios...) recebe erro, com aviso
  no logcat. Se ele segurar o `deviceready`, o cão de guarda libera o evento (≈1 s
  depois do erro, ou 4 s depois do `load` no pior caso).
- Capacitor roda no modo web do `@capacitor/core` (as implementações web dos plugins
  oficiais: Preferences, Device, Filesystem/IndexedDB, Share...).
- `navigator.vibrate` vai direto ao vibrador (o Chromium bloqueia antes do primeiro
  toque; no iOS não há essa restrição). Pausa/retomada viram os eventos `pause`/
  `resume` do Cordova; o botão voltar dispara `backbutton` se o app escuta, senão volta
  no histórico ou fecha.

Para ver o log: `adb logcat -s PortBridge`.

## No navegador (PortBridge Studio / Google AI Studio)

A aba **Rota web** do PortBridge Studio faz a mesma conversão sem Java nem Android SDK,
inteira no navegador (o IPA não sai do aparelho), por isso funciona no Google AI Studio:

- `src/core/packager/webRouteConverter.ts`: detecção (mesmas regras de `WebApp.java`),
  troca de strings do manifesto binário (`axmlStringPool.ts`, porte de `Axml.java`),
  conteúdo em `assets/web` (CgBI → PNG) e assinatura v1 + v2 com
  `src/services/apkZipAlignSigner.ts` (WebCrypto);
- usa `public/templates/web.apk`, cópia deste template. O build é reproduzível e o CI
  confere a cópia; depois de mudar este módulo, rode `gradle :web:syncStudioTemplate`;
- a ponte vai dentro do template (`portbridge/bridge.js`), então o Studio não depende
  da pasta `android/` e o APK gerado no navegador é igual ao do app conversor;
- a chave de assinatura fica no `localStorage` do navegador: converta as atualizações de
  um app no mesmo navegador para o Android aceitar instalar por cima.

Testes: `node --test tests/unit/web_route_converter.test.ts`.

## Testar no computador

O `DevServer` serve a pasta `assets/web` de um APK gerado com o mesmo roteador e a
mesma ponte, num navegador comum (o WebView do Android é Chromium):

```bash
unzip Jogo.apk 'assets/*' -d jogo
java -cp android/webruntime/build/libs/webruntime.jar com.portbridge.webruntime.DevServer jogo/assets/web 8080
```

Sem o Android, os diálogos usam `alert/confirm/prompt` do navegador e a vibração usa
`navigator.vibrate`.

## Limites

- Plugins nativos específicos do app (compras, anúncios, Game Center, câmera nativa,
  sistema de arquivos completo) não existem no Android: viram erro e o app segue.
- `device.platform` continua `"iOS"` (o app e o `cordova.js` são os de iOS; o aparelho
  real aparece em `device.model`).
- CocoonJS/Ejecta (canvas nativo) e React Native ainda não são cobertos por esta rota.
