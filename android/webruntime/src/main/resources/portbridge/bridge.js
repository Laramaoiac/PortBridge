/*
 * PortBridge — ponte para apps web de iOS (Cordova/PhoneGap/Ionic, Capacitor,
 * RPG Maker, Construct...) rodando num WebView Android.
 *
 * O app continua com o cordova.js de iOS dele. Esta ponte faz o papel do lado
 * nativo do iOS: o cordova-ios (3.5 a 7.x) envia os comandos para
 * window.webkit.messageHandlers.cordova.postMessage([callbackId, serviço, ação, args])
 * e recebe as respostas por cordova.require('cordova/exec').nativeCallback(...).
 * Os plugins mais comuns são implementados aqui, em JavaScript, com a ajuda do
 * objeto PortBridgeNative (interface Java do APK) para o que só o Android faz:
 * vibrar, diálogos nativos, abrir o navegador, sair do app.
 *
 * Plugin desconhecido recebe erro (como no iOS sem o plugin), uma vez com aviso no
 * console. Se um plugin segurar o "deviceready" esperando uma resposta que não vem,
 * o cão de guarda libera o evento depois de alguns segundos (como o --lenient do
 * runtime de emulação).
 */
(function () {
    'use strict';
    if (window.__portbridge) return;

    var N = window.PortBridgeNative || null;       // Android (null no navegador do computador)
    var config = {};
    try { config = JSON.parse(N ? N.config() : (window.__portbridgeConfig ? JSON.stringify(window.__portbridgeConfig) : '{}')); } catch (e) { config = {}; }
    var device = config.device || {};

    // Status do CDVCommandStatus (iOS)
    var NO_RESULT = 0, OK = 1, CLASS_NOT_FOUND = 2, INVALID_ACTION = 7, ERROR = 9;

    var warned = {};
    function warnOnce(key, msg) {
        if (warned[key]) return;
        warned[key] = true;
        try { console.warn('[PortBridge] ' + msg); } catch (e) {}
        if (N && N.log) try { N.log('warn', msg); } catch (e2) {}
    }

    function exec() {
        try { return window.cordova && window.cordova.require('cordova/exec'); } catch (e) { return null; }
    }

    /** Resposta ao cordova.js (sempre assíncrona, como a do iOS). */
    function respond(callbackId, status, message, keep) {
        if (!callbackId || callbackId === 'INVALID') return;
        setTimeout(function () {
            var x = exec();
            if (x && x.nativeCallback) x.nativeCallback(callbackId, status, message, !!keep);
        }, 0);
    }

    function Ctx(callbackId) { this.id = callbackId; }
    Ctx.prototype.ok = function (v, keep) { respond(this.id, OK, v === undefined ? null : v, keep); };
    Ctx.prototype.none = function (keep) { respond(this.id, NO_RESULT, null, keep); };
    Ctx.prototype.fail = function (v, keep) { respond(this.id, ERROR, v === undefined ? null : v, keep); };

    function resolveUrl(src) {
        try { return new URL(src, document.baseURI).href; } catch (e) { return src; }
    }

    function moduleOrNull(id) {
        try { return window.cordova.require(id); } catch (e) { return null; }
    }

    // ------------------------------------------------------------------ áudio

    /** Áudio com HTMLAudioElement (funciona em qualquer WebView). */
    function makeAudio(src) {
        var a = new Audio();
        a.preload = 'auto';
        a.src = resolveUrl(src);
        return a;
    }

    // cordova-plugin-media (iOS: o nativo chama Media.onStatus diretamente)
    var MEDIA_STATE = 1, MEDIA_DURATION = 2, MEDIA_POSITION = 3, MEDIA_ERROR = 9;
    var MEDIA_STARTING = 1, MEDIA_RUNNING = 2, MEDIA_PAUSED = 3, MEDIA_STOPPED = 4;
    var medias = {};
    function mediaStatus(id, type, value) {
        setTimeout(function () {
            var M = moduleOrNull('cordova-plugin-media.Media') || window.Media;
            if (M && M.onStatus) M.onStatus(id, type, value);
        }, 0);
    }
    function mediaFor(id, src) {
        var m = medias[id];
        if (!m || (src && m.src !== src)) {
            if (m) { try { m.audio.pause(); } catch (e) {} }
            m = medias[id] = { src: src, audio: makeAudio(src), loops: 1 };
            m.audio.addEventListener('ended', function () {
                if (m.loops > 1 || m.loops < 0) {
                    if (m.loops > 0) m.loops--;
                    m.audio.currentTime = 0;
                    m.audio.play();
                } else {
                    mediaStatus(id, MEDIA_STATE, MEDIA_STOPPED);
                }
            });
            m.audio.addEventListener('loadedmetadata', function () {
                mediaStatus(id, MEDIA_DURATION, m.audio.duration);
            });
            m.audio.addEventListener('error', function () {
                mediaStatus(id, MEDIA_ERROR, { code: 1 });
            });
        }
        return m;
    }

    // cordova-plugin-nativeaudio / LowLatencyAudio: sons pré-carregados por id
    var sounds = {};
    function soundPlay(id, loop, ctx) {
        var s = sounds[id];
        if (!s) return ctx.fail('A reference does not exist for the specified audio id.');
        var a = s.voices[s.next];
        s.next = (s.next + 1) % s.voices.length;
        a.loop = !!loop;
        a.volume = s.volume;
        try { a.currentTime = 0; } catch (e) {}
        a.onended = function () {
            if (s.complete) { var c = s.complete; s.complete = null; c.ok(id); }
        };
        var p = a.play();
        if (p && p.catch) p.catch(function () {});
        ctx.ok('OK');
    }

    // ------------------------------------------------------------------ plugins

    var connectionCtx = null;
    function connectionType() {
        if (N && N.networkType) try { return N.networkType(); } catch (e) {}
        return navigator.onLine === false ? 'none' : 'wifi';
    }
    window.addEventListener('online', function () { if (connectionCtx) connectionCtx.ok(connectionType(), true); });
    window.addEventListener('offline', function () { if (connectionCtx) connectionCtx.ok('none', true); });

    var pendingDialogs = {}, dialogSeq = 0;
    function dialog(kind, ctx, message, title, buttons, defaultText) {
        if (N && N.dialog) {
            var id = 'd' + (++dialogSeq);
            pendingDialogs[id] = { kind: kind, ctx: ctx };
            N.dialog(id, kind, String(message), String(title || ''), JSON.stringify(buttons || []), String(defaultText || ''));
            return;
        }
        // Sem Android (computador): diálogos do navegador
        setTimeout(function () {
            if (kind === 'alert') { window.alert(message); ctx.ok(); }
            else if (kind === 'confirm') { ctx.ok(window.confirm(message) ? 1 : 2); }
            else { var t = window.prompt(message, defaultText || ''); ctx.ok({ buttonIndex: t === null ? 2 : 1, input1: t || '' }); }
        }, 0);
    }

    var plugins = {
        Device: {
            getDeviceInfo: function (args, ctx) {
                // platform "iOS": o app foi escrito para iOS e o cordova.js é o de iOS;
                // o aparelho real vai em model/manufacturer.
                ctx.ok({
                    available: true,
                    platform: 'iOS',
                    version: config.iosVersion || '15.0',
                    uuid: device.uuid || 'portbridge',
                    cordova: (window.cordova && window.cordova.version) || '',
                    model: device.model ? 'Android ' + device.model : 'Android',
                    manufacturer: device.manufacturer || 'Android',
                    isVirtual: false,
                    serial: 'unknown',
                    isiOSAppOnMac: false
                });
            }
        },
        StatusBar: {
            _ready: function (args, ctx) { ctx.ok(false); },   // tela cheia: barra escondida
            _default: function (args, ctx) { ctx.ok(); }
        },
        SplashScreen: { _default: function (args, ctx) { ctx.ok(); } },
        CDVLaunchScreen: { _default: function (args, ctx) { ctx.ok(); } },
        NetworkStatus: {
            getConnectionInfo: function (args, ctx) { connectionCtx = ctx; ctx.ok(connectionType(), true); }
        },
        Vibration: {
            vibrate: function (args, ctx) {
                var ms = Number(args[0]) || 0;
                if (N && N.vibrate) N.vibrate(ms); else if (navigator.vibrate) navigator.vibrate(ms);
                ctx.ok();
            },
            vibrateWithPattern: function (args, ctx) {
                var pattern = args[0] || [];
                if (N && N.vibratePattern) N.vibratePattern(JSON.stringify(pattern), Number(args[1]) || -1);
                else if (navigator.vibrate) navigator.vibrate(pattern);
                ctx.ok();
            },
            cancelVibration: function (args, ctx) {
                if (N && N.cancelVibration) N.cancelVibration(); else if (navigator.vibrate) navigator.vibrate(0);
                ctx.ok();
            }
        },
        Notification: {
            alert: function (args, ctx) { dialog('alert', ctx, args[0], args[1], [args[2] || 'OK']); },
            confirm: function (args, ctx) {
                var b = args[2];
                if (typeof b === 'string') b = b.split(',');
                dialog('confirm', ctx, args[0], args[1], b || ['OK', 'Cancel']);
            },
            prompt: function (args, ctx) { dialog('prompt', ctx, args[0], args[1], args[2] || ['OK', 'Cancel'], args[3]); },
            beep: function (args, ctx) {
                if (N && N.beep) N.beep(Number(args[0]) || 1);
                ctx.ok();
            }
        },
        Media: {
            create: function (args, ctx) { mediaFor(args[0], args[1]); ctx.ok(); },
            startPlayingAudio: function (args, ctx) {
                var m = mediaFor(args[0], args[1]);
                var opts = args[2] || {};
                m.loops = opts.numberOfLoops ? Number(opts.numberOfLoops) : 1;
                mediaStatus(args[0], MEDIA_STATE, MEDIA_STARTING);
                var p = m.audio.play();
                var started = function () { mediaStatus(args[0], MEDIA_STATE, MEDIA_RUNNING); };
                if (p && p.then) p.then(started, function () { mediaStatus(args[0], MEDIA_ERROR, { code: 1 }); });
                else started();
                ctx.ok();
            },
            pausePlayingAudio: function (args, ctx) {
                var m = medias[args[0]];
                if (m) { m.audio.pause(); mediaStatus(args[0], MEDIA_STATE, MEDIA_PAUSED); }
                ctx.ok();
            },
            stopPlayingAudio: function (args, ctx) {
                var m = medias[args[0]];
                if (m) {
                    m.audio.pause();
                    try { m.audio.currentTime = 0; } catch (e) {}
                    mediaStatus(args[0], MEDIA_STATE, MEDIA_STOPPED);
                }
                ctx.ok();
            },
            seekToAudio: function (args, ctx) {
                var m = medias[args[0]];
                if (m) try { m.audio.currentTime = Number(args[1]) / 1000; } catch (e) {}
                ctx.ok();
            },
            getCurrentPositionAudio: function (args, ctx) {
                var m = medias[args[0]];
                var pos = m ? m.audio.currentTime : -1;
                mediaStatus(args[0], MEDIA_POSITION, pos);
                ctx.ok(pos);
            },
            setVolume: function (args, ctx) {
                var m = medias[args[0]];
                if (m) m.audio.volume = Math.max(0, Math.min(1, Number(args[1])));
                ctx.ok();
            },
            setRate: function (args, ctx) {
                var m = medias[args[0]];
                if (m) m.audio.playbackRate = Number(args[1]) || 1;
                ctx.ok();
            },
            release: function (args, ctx) {
                var m = medias[args[0]];
                if (m) { m.audio.pause(); m.audio.removeAttribute('src'); delete medias[args[0]]; }
                ctx.ok();
            },
            messageChannel: function (args, ctx) { ctx.none(true); },
            _default: function (args, ctx, action) {
                warnOnce('Media.' + action, 'Media.' + action + ' (gravação) não é suportado');
                mediaStatus(args[0], MEDIA_ERROR, { code: 4 });
                ctx.fail({ code: 4 });
            }
        },
        NativeAudio: {
            preloadSimple: function (args, ctx) {
                sounds[args[0]] = { voices: [makeAudio(args[1])], next: 0, volume: 1 };
                ctx.ok('OK');
            },
            preloadComplex: function (args, ctx) {
                var n = Math.max(1, Number(args[3]) || 1), v = [];
                for (var i = 0; i < n; i++) v.push(makeAudio(args[1]));
                sounds[args[0]] = { voices: v, next: 0, volume: args[2] === undefined ? 1 : Number(args[2]) };
                ctx.ok('OK');
            },
            play: function (args, ctx) { soundPlay(args[0], false, ctx); },
            loop: function (args, ctx) { soundPlay(args[0], true, ctx); },
            stop: function (args, ctx) {
                var s = sounds[args[0]];
                if (s) s.voices.forEach(function (a) { a.pause(); try { a.currentTime = 0; } catch (e) {} });
                ctx.ok('OK');
            },
            unload: function (args, ctx) {
                var s = sounds[args[0]];
                if (s) s.voices.forEach(function (a) { a.pause(); a.removeAttribute('src'); });
                delete sounds[args[0]];
                ctx.ok('OK');
            },
            addCompleteListener: function (args, ctx) {
                var s = sounds[args[0]];
                if (s) s.complete = ctx; else ctx.fail('A reference does not exist for the specified audio id.');
            },
            setVolumeForComplexAsset: function (args, ctx) {
                var s = sounds[args[0]];
                if (s) { s.volume = Number(args[1]); s.voices.forEach(function (a) { a.volume = s.volume; }); }
                ctx.ok('OK');
            }
        },
        InAppBrowser: {
            open: function (args, ctx) {
                var url = resolveUrl(args[0]), target = args[1] || '_blank';
                if (target === '_self' && url.indexOf(location.origin) === 0) { location.href = url; return ctx.ok({ type: 'loadstart', url: url }, true); }
                if (N && N.openExternal) N.openExternal(url); else window.open(url, '_blank');
                ctx.ok({ type: 'exit' });
            },
            close: function (args, ctx) { ctx.ok({ type: 'exit' }); },
            _default: function (args, ctx) { ctx.ok(); }
        },
        Console: {
            // O logger do cordova.js de iOS já escreve no console do navegador (que o
            // Android leva ao logcat); o lado "nativo" só confirma, sem duplicar.
            logLevel: function (args, ctx) { ctx.ok(); }
        },
        Keyboard: { _default: function (args, ctx) { ctx.ok(); } },
        Globalization: {
            getPreferredLanguage: function (args, ctx) { ctx.ok({ value: navigator.language || 'en-US' }); },
            getLocaleName: function (args, ctx) { ctx.ok({ value: navigator.language || 'en-US' }); },
            _default: function (args, ctx, action) { warnOnce('Globalization.' + action, 'Globalization.' + action + ' não implementado'); ctx.fail({ code: 0, message: 'not supported' }); }
        },
        AppVersion: {
            getAppName: function (args, ctx) { ctx.ok(config.name || ''); },
            getPackageName: function (args, ctx) { ctx.ok(config.bundle || ''); },
            getVersionNumber: function (args, ctx) { ctx.ok(config.version || ''); },
            getVersionCode: function (args, ctx) { ctx.ok(config.build || config.version || ''); }
        },
        Insomnia: {
            keepAwake: function (args, ctx) { if (N && N.keepScreenOn) N.keepScreenOn(true); ctx.ok(); },
            allowSleepAgain: function (args, ctx) { if (N && N.keepScreenOn) N.keepScreenOn(false); ctx.ok(); }
        },
        CDVOrientation: {
            screenOrientation: function (args, ctx) {
                if (N && N.setOrientation) N.setOrientation(String(args[1] || 'any'));
                ctx.ok();
            }
        },
        File: {
            // Só o que destrava o "deviceready" (cordova.file.*). Operações em
            // arquivos não são suportadas; os jogos costumam salvar em localStorage.
            requestAllPaths: function (args, ctx) {
                var app = location.origin + '/';
                ctx.ok({
                    applicationDirectory: app, applicationStorageDirectory: app,
                    dataDirectory: 'cdvfile://localhost/persistent/', documentsDirectory: 'cdvfile://localhost/persistent/',
                    cacheDirectory: 'cdvfile://localhost/temporary/', tempDirectory: 'cdvfile://localhost/temporary/',
                    syncedDataDirectory: 'cdvfile://localhost/persistent/'
                });
            },
            requestAllFileSystems: function (args, ctx) { ctx.ok([]); },
            _default: function (args, ctx, action) {
                warnOnce('File.' + action, 'File.' + action + ' não é suportado (sistema de arquivos)');
                ctx.fail(1); // FileError.NOT_FOUND_ERR
            }
        }
    };
    plugins.LowLatencyAudio = plugins.NativeAudio;
    plugins.CDVStatusBar = plugins.StatusBar;

    function dispatch(command) {
        // [callbackId, service, action, args]
        var callbackId = command[0], service = command[1], action = command[2], args = command[3] || [];
        var ctx = new Ctx(callbackId);
        var p = plugins[service];
        if (!p) {
            warnOnce('svc.' + service, 'plugin nativo "' + service + '" não existe no Android; ' + service + '.' + action + ' devolveu erro');
            respond(callbackId, CLASS_NOT_FOUND, 'Class not found');
            // Se esse plugin segurava o deviceready, não espera o prazo inteiro: as
            // respostas da ponte são imediatas, então o que ainda estiver pendente
            // logo depois é de plugin que não existe aqui.
            if (!deviceReadyFired) setTimeout(deviceReadyWatchdog, 600);
            return;
        }
        var f = p[action] || p._default;
        if (!f) {
            warnOnce('act.' + service + '.' + action, service + '.' + action + ' não implementado; devolveu erro');
            respond(callbackId, INVALID_ACTION, 'Invalid action');
            return;
        }
        try {
            f(args, ctx, action);
        } catch (e) {
            warnOnce('exc.' + service + '.' + action, service + '.' + action + ' falhou: ' + e);
            ctx.fail(String(e));
        }
    }

    // O cordova.js de iOS escolhe o modo WKWebView quando encontra este objeto
    // (cordova-ios 3.x e 6.x+).
    window.webkit = window.webkit || {};
    window.webkit.messageHandlers = window.webkit.messageHandlers || {};
    window.webkit.messageHandlers.cordova = { postMessage: function (command) { dispatch(command); } };

    // cordova-ios 4.x e 5.x usam por padrão a ponte do UIWebView (iframe gap://ready e
    // o nativo puxando a fila). Como faz o plugin oficial cordova-plugin-wkwebview-engine,
    // o módulo cordova/exec é trocado por um exec no protocolo do WKWebView; o execProxy
    // desses cordova.js (CB-10106) passa a usá-lo. A troca acontece quando o cordova.js
    // atribui window.cordova, antes de qualquer plugin chamar o nativo.
    function wkExec(success, fail, service, action, args) {
        if (typeof success === 'string') return;   // formato antigo (removido no Cordova 2.x)
        var cordova = window.cordova, callbackId = 'INVALID';
        if (success || fail) {
            callbackId = service + cordova.callbackId++;
            cordova.callbacks[callbackId] = { success: success, fail: fail };
        }
        args = (args || []).map(function (a) {
            if (a instanceof ArrayBuffer || (window.Uint8Array && a instanceof Uint8Array)) {
                var bytes = new Uint8Array(a.buffer || a), bin = '';
                for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
                return { CDVType: 'ArrayBuffer', data: btoa(bin) };
            }
            return a;
        });
        dispatch([callbackId, service, action, JSON.parse(JSON.stringify(args))]);
    }
    function nativeToJs(message) {
        if (message && message.CDVType === 'ArrayBuffer') {
            var bin = atob(message.data), out = new Uint8Array(bin.length);
            for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
            return out.buffer;
        }
        return message;
    }
    wkExec.nativeCallback = function (callbackId, status, message, keepCallback) {
        var args = message && message.CDVType === 'MultiPart' ? message.messages.map(nativeToJs) : [nativeToJs(message)];
        setTimeout(function () {
            window.cordova.callbackFromNative(callbackId, status === 0 || status === 1, status, args, keepCallback);
        }, 0);
    };
    wkExec.nativeFetchMessages = function () { return ''; };
    wkExec.nativeEvalAndFetch = function (f) { try { f(); } catch (e) {} return ''; };

    function onCordovaDefined(c) {
        var v = parseInt(String(c && (c.platformVersion || c.version) || '0'), 10);
        if ((v === 4 || v === 5) && c.define && c.define.remove) {
            try {
                c.define.remove('cordova/exec');
                c.define('cordova/exec', function (require, exports, module) { module.exports = wkExec; });
            } catch (e) {
                warnOnce('exec4', 'não foi possível trocar a ponte do cordova-ios ' + v + ': ' + e);
            }
        }
    }
    try {
        var realCordova;
        Object.defineProperty(window, 'cordova', {
            configurable: true,
            enumerable: true,
            get: function () { return realCordova; },
            set: function (c) { realCordova = c; onCordovaDefined(c); }
        });
    } catch (e) {}

    // ------------------------------------------------------------------ eventos

    var backListeners = 0;
    var addEvt = document.addEventListener;
    document.addEventListener = function (type) {
        if (type === 'backbutton') backListeners++;
        return addEvt.apply(this, arguments);
    };
    var removeEvt = document.removeEventListener;
    document.removeEventListener = function (type) {
        if (type === 'backbutton' && backListeners > 0) backListeners--;
        return removeEvt.apply(this, arguments);
    };

    function fireDocumentEvent(name) {
        if (window.cordova && window.cordova.fireDocumentEvent) {
            try { window.cordova.fireDocumentEvent(name); return; } catch (e) {}
        }
        var ev = document.createEvent('Events');
        ev.initEvent(name, false, false);
        document.dispatchEvent(ev);
    }

    // Cão de guarda do deviceready: libera canais que um plugin não respondeu.
    var deviceReadyFired = false;
    addEvt.call(document, 'deviceready', function () { deviceReadyFired = true; }, false);
    function deviceReadyWatchdog() {
        if (deviceReadyFired || !window.cordova) return;
        var channel = moduleOrNull('cordova/channel');
        if (!channel || !channel.deviceReadyChannelsArray) return;
        channel.deviceReadyChannelsArray.forEach(function (c) {
            if (c && c.state !== 2 && c.type !== 'onDeviceReady') {
                warnOnce('ready.' + c.type, 'liberando "' + c.type + '" (plugin não respondeu); deviceready forçado');
                try { c.fire(); } catch (e) {}
            }
        });
    }
    window.addEventListener('load', function () { setTimeout(deviceReadyWatchdog, Number(config.devicereadyTimeoutMs) || 4000); });

    window.__portbridge = {
        version: 1,
        config: config,
        plugins: plugins,
        /** Resposta de um diálogo nativo (chamado pelo Java). */
        dialogResult: function (id, button, text) {
            var d = pendingDialogs[id];
            delete pendingDialogs[id];
            if (!d) return;
            if (d.kind === 'alert') d.ctx.ok();
            else if (d.kind === 'confirm') d.ctx.ok(button);
            else d.ctx.ok({ buttonIndex: button, input1: text || '' });
        },
        /** Botão voltar do Android: "handled" (o app trata), "back" (histórico) ou "exit". */
        back: function () {
            if (backListeners > 0) { fireDocumentEvent('backbutton'); return 'handled'; }
            if (history.length > 1 && location.href.split('#')[0] !== (location.origin + '/' + (config.startPage || 'index.html'))) {
                history.back();
                return 'back';
            }
            return 'exit';
        },
        pause: function () {
            fireDocumentEvent('pause');
            for (var id in medias) if (medias[id].audio && !medias[id].audio.paused) { medias[id].audio.pause(); medias[id].resume = true; }
        },
        resume: function () {
            for (var id in medias) if (medias[id].resume) { medias[id].resume = false; medias[id].audio.play(); }
            fireDocumentEvent('resume');
        },
        deviceReadyWatchdog: deviceReadyWatchdog
    };
})();
