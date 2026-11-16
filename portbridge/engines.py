"""Detecção da engine/framework usada pelo app iOS.

A engine define a estratégia de port inteira:

* ``runtime_swap`` — a lógica do jogo está em DADOS independentes de CPU
  (bytecode, cenas, scripts). Descarta-se o executável iOS e usa-se um runtime
  Android da mesma engine. Arquitetura 32/64 bits do binário iOS é irrelevante.
* ``script_port`` — a lógica está em scripts (Lua/JS) portáveis, mas há código
  nativo de cola que precisa ser refeito.
* ``native`` — a lógica está compilada em ARM dentro do executável. Só há três
  saídas: código-fonte e recompilar, emular a CPU (JIT ARM32→ARM64) com uma
  camada de compatibilidade iOS, ou reescrever.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class EngineMatch:
    key: str
    name: str
    strategy: str
    difficulty: str
    evidence: list[str] = field(default_factory=list)
    notes: str = ""

    def to_dict(self) -> dict:
        return self.__dict__.copy()


# (key, nome, estratégia, dificuldade, arquivos-sinal, classes-sinal, notas)
SIGNATURES = [
    ("clickteam", "Clickteam Fusion / Multimedia Fusion 2", "runtime_swap", "média",
     ["Application.cci", "Application.ccn"], ["CRunApp", "CRunFrame", "CEventProgram"],
     "Jogo inteiro (frames, objetos, eventos, imagens, sons) está no .cci. "
     "O executável é só o player genérico da Clickteam para iOS."),
    ("unity", "Unity", "native", "alta",
     ["Data/globalgamemanagers", "Data/mainData", "Data/data.unity3d",
      "Frameworks/UnityFramework.framework/UnityFramework"],
     ["UnityAppController", "UnityView"],
     "No iOS o C# é compilado AOT (IL2CPP/Mono AOT) para ARM: assets são "
     "portáveis, mas a lógica está no binário nativo."),
    ("godot", "Godot", "runtime_swap", "baixa", [".pck"], ["GodotApp", "AppDelegate+Godot"],
     "O .pck é portável; basta o template de exportação Android da mesma versão."),
    ("defold", "Defold", "runtime_swap", "baixa", ["game.projectc", "game.arcd"], [],
     "Arquivos do jogo portáveis; usar o engine Android do Defold da mesma versão."),
    ("gamemaker", "GameMaker", "runtime_swap", "média", ["game.ios"], ["RunnerAppDelegate"],
     "game.ios é o equivalente ao data.win; exige runner Android compatível "
     "(ou foi compilado com YYC, aí vira nativo)."),
    ("corona", "Corona / Solar2D", "runtime_swap", "média", ["resource.car"], ["CoronaView"],
     "resource.car contém Lua compilado (bytecode portável)."),
    ("cocos2dx_lua_js", "Cocos2d-x (Lua/JS)", "script_port", "média",
     ["src/main.lua", "main.js", "src/main.luac", "jsb_prepare.js"], [],
     "Scripts portáveis; refazer a casca nativa com o cocos2d-x Android."),
    ("cocos2d", "Cocos2d (Objective-C)", "native", "alta", [], ["CCDirector", "CCSprite", "CCNode"],
     "Lógica em Objective-C compilada; assets portáveis."),
    ("air", "Adobe AIR", "runtime_swap", "média", ["META-INF/AIR/application.xml"],
     ["AIRAppController"], "SWF/ABC portáveis; AIR para Android (HARMAN) roda o mesmo SWF."),
    ("cordova", "Cordova / PhoneGap (web)", "runtime_swap", "baixa",
     ["www/index.html", "www/cordova.js"], ["CDVViewController"],
     "App web em WebView; reaproveitar a pasta www/."),
    ("react_native", "React Native", "script_port", "média", ["main.jsbundle"], ["RCTBridge"],
     "Bundle JS portável; módulos nativos precisam de equivalente Android."),
    ("flutter", "Flutter", "native", "alta", ["Frameworks/App.framework/App",
                                             "Frameworks/Flutter.framework/Flutter"], [],
     "Dart compilado AOT para ARM; precisa do código-fonte."),
    ("xamarin", "Xamarin / .NET", "native", "alta", [".dll"], ["Xamarin_iOS"],
     "Assemblies .NET às vezes portáveis, mas no iOS são AOT."),
]


def detect(app_files: list[str], objc_classes: list[str]) -> list[EngineMatch]:
    """``app_files``: caminhos relativos ao .app. Retorna correspondências por força."""
    classes = set(objc_classes)
    lower = [f.lower() for f in app_files]
    found: list[tuple[int, EngineMatch]] = []
    for key, name, strategy, diff, files, cls, notes in SIGNATURES:
        ev = []
        for sig in files:
            s = sig.lower()
            if s.startswith("."):
                hits = [f for f, lf in zip(app_files, lower) if lf.endswith(s)]
            else:
                hits = [f for f, lf in zip(app_files, lower) if lf == s or lf.endswith("/" + s)]
            ev += [f"arquivo: {h}" for h in hits[:3]]
        ev += [f"classe ObjC: {c}" for c in cls if c in classes]
        if ev:
            found.append((len(ev), EngineMatch(key, name, strategy, diff, ev, notes)))
    found.sort(key=lambda t: -t[0])
    matches = [m for _, m in found]
    if not matches:
        swift = any("libswift" in f.lower() for f in app_files)
        matches.append(EngineMatch(
            "native", "Nativo (UIKit, " + ("Swift" if swift else "Objective-C/C/C++") + ")",
            "native", "muito alta", ["nenhuma engine conhecida encontrada"],
            "Sem engine: a lógica inteira está no executável ARM."))
    return matches
