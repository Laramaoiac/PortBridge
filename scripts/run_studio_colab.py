#!/usr/bin/env python3
"""Baixa o PortBridge Studio (zip), instala e sobe o servidor.

Feito para o Google Colab (abre um endereço https para o navegador), mas também
funciona em qualquer Linux x64/arm64 com Python 3.8+.

Uso no Colab (uma célula):

    !wget -q -O run_studio_colab.py <URL deste arquivo>   # ou faça upload dele
    %run run_studio_colab.py https://tmpfiles.org/XXXXXXXX/portbridge-studio-corrigido.zip

Uso em linha de comando:

    python3 run_studio_colab.py <zip: link do tmpfiles.org, outra URL ou caminho local>
        [--dir pasta] [--port 3000] [--dev] [--test] [--no-wait]

Fontes aceitas para o zip:
  - link do tmpfiles.org (página ou /dl/; o arquivo some cerca de 60 min depois do envio);
  - qualquer URL direta de .zip (por exemplo o zip de uma branch do GitHub, se o
    repositório for público: https://github.com/<dono>/<repo>/archive/refs/heads/<branch>.zip);
  - caminho de um arquivo .zip local.

O que o script faz:
  1. baixa e extrai o zip com segurança (sem sair da pasta de destino);
  2. garante Node.js >= 22.12 (baixa o Node 22 oficial do nodejs.org, conferindo o
     SHA-256, se o do sistema for mais velho; o Colab costuma vir com Node 18/20);
  3. npm install, npm run build (e npm test com --test);
  4. sobe o servidor do Studio em modo produção (ou o modo dev do Vite com --dev);
  5. no Colab, mostra o endereço https do proxy do Colab; fora dele, http://localhost:PORT.

GEMINI_API_KEY (opcional, só para as funções de IA do Studio; a aba "Rota web" não usa):
lida do ambiente ou dos Secrets do Colab (ícone de chave na barra lateral).
"""
import argparse
import hashlib
import io
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import tarfile
import time
import urllib.error
import urllib.request
import zipfile

NODE_INDEX = "https://nodejs.org/dist/latest-v22.x/"
MIN_NODE = (22, 12, 0)
UA = {"User-Agent": "portbridge-studio-runner/1"}


def log(msg):
    print(f"[PortBridge] {msg}", flush=True)


def in_colab():
    try:
        import google.colab  # noqa: F401
        return True
    except ImportError:
        return False


# ------------------------------------------------------------------ download

def direct_url(url):
    """Página do tmpfiles.org -> link de download direto (/dl/)."""
    m = re.match(r"^https?://(?:www\.)?tmpfiles\.org/(?!dl/)(.+)$", url)
    if m:
        return "https://tmpfiles.org/dl/" + m.group(1)
    return url.replace("http://tmpfiles.org/", "https://tmpfiles.org/")


def fetch(url, what):
    log(f"baixando {what}: {url}")
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read()
    except urllib.error.HTTPError as e:
        hint = " (os links do tmpfiles.org expiram ~60 min depois do envio; envie o zip de novo)" if "tmpfiles" in url else ""
        sys.exit(f"falha ao baixar {what}: HTTP {e.code}{hint}")
    except urllib.error.URLError as e:
        sys.exit(f"falha ao baixar {what}: {e.reason}")
    return data


def load_zip(source):
    if os.path.isfile(source):
        with open(source, "rb") as f:
            data = f.read()
    else:
        data = fetch(direct_url(source), "o projeto")
    if not data.startswith(b"PK"):
        snippet = data[:200].decode("utf-8", "replace").strip().replace("\n", " ")
        sys.exit("o download não é um .zip (talvez o link expirou ou é a página e não o arquivo). "
                 f"Início do conteúdo: {snippet!r}")
    return data


def safe_extract(data, dest):
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        root = os.path.realpath(dest)
        for info in z.infolist():
            target = os.path.realpath(os.path.join(dest, info.filename))
            if target != root and not target.startswith(root + os.sep):
                sys.exit(f"zip inválido: caminho fora da pasta ({info.filename})")
        z.extractall(dest)
    # o projeto pode estar na raiz do zip ou numa pasta (zip de branch do GitHub)
    for base, dirs, files in os.walk(dest):
        dirs[:] = [d for d in dirs if d != "node_modules"]
        if "package.json" in files and "server.ts" in files:
            return base
    sys.exit("não achei o PortBridge Studio no zip (package.json + server.ts)")


# ------------------------------------------------------------------ Node.js

def node_version(node):
    try:
        out = subprocess.run([node, "--version"], capture_output=True, text=True, timeout=30).stdout.strip()
    except (OSError, subprocess.TimeoutExpired):
        return None
    m = re.match(r"v(\d+)\.(\d+)\.(\d+)", out)
    return tuple(int(x) for x in m.groups()) if m else None


def ensure_node(workdir):
    system = shutil.which("node")
    v = node_version(system) if system else None
    if v and v >= MIN_NODE:
        log(f"Node.js do sistema serve: v{'.'.join(map(str, v))}")
        return os.path.dirname(system)
    arch = {"x86_64": "x64", "amd64": "x64", "aarch64": "arm64", "arm64": "arm64"}.get(platform.machine().lower())
    if not arch or platform.system() != "Linux":
        sys.exit(f"instale o Node.js >= {'.'.join(map(str, MIN_NODE))} (sistema {platform.system()} {platform.machine()})")
    log(f"Node.js do sistema: {'v' + '.'.join(map(str, v)) if v else 'nenhum'}; baixando o Node 22 oficial")
    sums = fetch(NODE_INDEX + "SHASUMS256.txt", "a lista de checksums do Node").decode()
    m = re.search(rf"^([0-9a-f]{{64}})\s+(node-v22\.\d+\.\d+-linux-{arch}\.tar\.xz)$", sums, re.M)
    if not m:
        sys.exit("não achei o Node 22 para esta máquina no nodejs.org")
    sha, name = m.groups()
    dest = os.path.join(workdir, name[: -len(".tar.xz")])
    if not os.path.isdir(dest):
        blob = fetch(NODE_INDEX + name, name)
        if hashlib.sha256(blob).hexdigest() != sha:
            sys.exit("o download do Node não confere com o SHA-256 oficial")
        with tarfile.open(fileobj=io.BytesIO(blob), mode="r:xz") as t:
            t.extractall(workdir)
    bindir = os.path.join(dest, "bin")
    log(f"usando {bindir}/node ({subprocess.run([os.path.join(bindir, 'node'), '--version'], capture_output=True, text=True).stdout.strip()})")
    return bindir


# ------------------------------------------------------------------ npm e servidor

def run(cmd, cwd, env, what):
    log(what + ": " + " ".join(cmd))
    p = subprocess.run(cmd, cwd=cwd, env=env)
    if p.returncode != 0:
        sys.exit(f"falhou: {what} (código {p.returncode})")


def gemini_key():
    if os.environ.get("GEMINI_API_KEY"):
        return os.environ["GEMINI_API_KEY"]
    if in_colab():
        try:
            from google.colab import userdata
            return userdata.get("GEMINI_API_KEY")
        except Exception:  # segredo não cadastrado ou sem permissão no notebook
            return None
    return None


def wait_http(port, proc, timeout=180):
    url = f"http://127.0.0.1:{port}/"
    start = time.time()
    while time.time() - start < timeout:
        if proc.poll() is not None:
            return False
        try:
            with urllib.request.urlopen(url, timeout=5) as r:
                if r.status == 200:
                    return True
        except (urllib.error.URLError, OSError):
            pass
        time.sleep(1)
    return False


def public_url(port):
    if not in_colab():
        return f"http://localhost:{port}/"
    from google.colab.output import eval_js
    return eval_js(f"google.colab.kernel.proxyPort({port})")


def main():
    ap = argparse.ArgumentParser(description="Baixa, instala e sobe o PortBridge Studio")
    ap.add_argument("source", help="link do tmpfiles.org, URL de .zip ou caminho local")
    ap.add_argument("--dir", default=os.path.abspath("portbridge-studio"), help="pasta de trabalho")
    ap.add_argument("--port", type=int, default=3000)
    ap.add_argument("--dev", action="store_true", help="modo dev (Vite com recarga) em vez de produção")
    ap.add_argument("--test", action="store_true", help="roda npm test e npm run lint antes de subir")
    ap.add_argument("--no-wait", action="store_true", help="não fica esperando (o servidor segue em segundo plano)")
    args = ap.parse_args()

    os.makedirs(args.dir, exist_ok=True)
    app_dir = os.path.join(args.dir, "app")
    if os.path.isdir(app_dir):
        shutil.rmtree(app_dir)
    os.makedirs(app_dir)
    project = safe_extract(load_zip(args.source), app_dir)
    log(f"projeto em {project}")
    if not os.path.isfile(os.path.join(project, "public", "templates", "web.apk")):
        log("aviso: public/templates/web.apk não está no zip; a aba 'Rota web' não vai converter")

    bindir = ensure_node(args.dir)
    env = dict(os.environ)
    env["PATH"] = bindir + os.pathsep + env.get("PATH", "")
    npm = os.path.join(bindir, "npm") if os.path.exists(os.path.join(bindir, "npm")) else "npm"
    npx = os.path.join(bindir, "npx") if os.path.exists(os.path.join(bindir, "npx")) else "npx"

    run([npm, "install", "--no-audit", "--no-fund"], project, env, "instalando dependências")
    if args.test:
        run([npm, "run", "lint"], project, env, "checagem de tipos")
        run([npm, "test"], project, env, "testes")
    if not args.dev:
        run([npm, "run", "build"], project, env, "build do Studio")

    key = gemini_key()
    if key:
        env["GEMINI_API_KEY"] = key
        log("GEMINI_API_KEY encontrada (funções de IA ligadas)")
    else:
        log("sem GEMINI_API_KEY: funções de IA desligadas (a aba 'Rota web' funciona sem ela)")
    env["PORT"] = str(args.port)
    if not args.dev:
        env["NODE_ENV"] = "production"
    server_log = os.path.join(args.dir, "server.log")
    log(f"subindo o servidor na porta {args.port} (log: {server_log})")
    with open(server_log, "w") as out:
        proc = subprocess.Popen([npx, "tsx", "server.ts"], cwd=project, env=env, stdout=out, stderr=subprocess.STDOUT,
                                start_new_session=True)
    if not wait_http(args.port, proc):
        with open(server_log) as f:
            tail = f.read()[-3000:]
        proc.terminate()
        sys.exit("o servidor não respondeu. Fim do log:\n" + tail)

    url = public_url(args.port)
    log(f"PortBridge Studio no ar: {url}")
    log("abra o endereço e use a aba 'Rota web' para converter IPA de app web em APK")
    if in_colab():
        try:
            from IPython.display import HTML, display
            display(HTML(f'<p><a href="{url}" target="_blank" style="font-size:16px">Abrir o PortBridge Studio</a></p>'))
        except ImportError:
            pass
    if args.no_wait or in_colab():
        log(f"o servidor continua rodando (pid {proc.pid}) enquanto este ambiente estiver ativo")
        return
    log("Ctrl+C para parar")
    try:
        proc.wait()
    except KeyboardInterrupt:
        proc.terminate()


if __name__ == "__main__":
    assert direct_url("https://tmpfiles.org/wsA6adffgDsM/x.zip") == "https://tmpfiles.org/dl/wsA6adffgDsM/x.zip"
    assert direct_url("https://tmpfiles.org/dl/wsA6adffgDsM/x.zip") == "https://tmpfiles.org/dl/wsA6adffgDsM/x.zip"
    assert direct_url("http://tmpfiles.org/abc/y.zip") == "https://tmpfiles.org/dl/abc/y.zip"
    main()
