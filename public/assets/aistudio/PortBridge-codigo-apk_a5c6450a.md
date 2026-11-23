# PortBridge: código-fonte do APK

Código do PortBridge usado para gerar os APKs (commit `e88d5b1` do branch `ccr-c82da4aa-fcqosd`).
Ficam de fora as bibliotecas de terceiros (SDL2, miniz, dr_libs, stb_truetype, fonte Liberation Sans) e o próprio touchHLE, que são baixados ou ficam em `third_party/`.

O APK do Zorbié usa o player C++ (compilado como `libmain.so`) e o app Android; o patch do touchHLE só entra nos APKs de apps nativos, como o Ninja Striker.

## Arquivos

**Player C++ (runtime dos jogos Clickteam)**

- [`player/CMakeLists.txt`](#playercmakeliststxt)
- [`player/cmake/embed.cmake`](#playercmakeembedcmake)
- [`player/src/core/bytes.cpp`](#playersrccorebytescpp)
- [`player/src/core/bytes.hpp`](#playersrccorebyteshpp)
- [`player/src/core/game.cpp`](#playersrccoregamecpp)
- [`player/src/core/game.hpp`](#playersrccoregamehpp)
- [`player/src/core/names.cpp`](#playersrccorenamescpp)
- [`player/src/core/names.hpp`](#playersrccorenameshpp)
- [`player/src/core/package.cpp`](#playersrccorepackagecpp)
- [`player/src/core/package.hpp`](#playersrccorepackagehpp)
- [`player/src/main.cpp`](#playersrcmaincpp)
- [`player/src/runtime/audio.cpp`](#playersrcruntimeaudiocpp)
- [`player/src/runtime/audio.hpp`](#playersrcruntimeaudiohpp)
- [`player/src/runtime/devcheck.cpp`](#playersrcruntimedevcheckcpp)
- [`player/src/runtime/devcheck.hpp`](#playersrcruntimedevcheckhpp)
- [`player/src/runtime/diag.cpp`](#playersrcruntimediagcpp)
- [`player/src/runtime/diag.hpp`](#playersrcruntimediaghpp)
- [`player/src/runtime/events.cpp`](#playersrcruntimeeventscpp)
- [`player/src/runtime/expressions.cpp`](#playersrcruntimeexpressionscpp)
- [`player/src/runtime/extensions.cpp`](#playersrcruntimeextensionscpp)
- [`player/src/runtime/movements.cpp`](#playersrcruntimemovementscpp)
- [`player/src/runtime/render.cpp`](#playersrcruntimerendercpp)
- [`player/src/runtime/runtime.cpp`](#playersrcruntimeruntimecpp)
- [`player/src/runtime/runtime.hpp`](#playersrcruntimeruntimehpp)
- [`player/src/runtime/screen.cpp`](#playersrcruntimescreencpp)
- [`player/src/runtime/screen.hpp`](#playersrcruntimescreenhpp)
- [`player/src/runtime/text.cpp`](#playersrcruntimetextcpp)
- [`player/src/runtime/text.hpp`](#playersrcruntimetexthpp)
- [`player/src/runtime/tweaks.cpp`](#playersrcruntimetweakscpp)
- [`player/src/runtime/tweaks.hpp`](#playersrcruntimetweakshpp)
- [`player/src/runtime/value.hpp`](#playersrcruntimevaluehpp)
- [`player/src/tools/pbinfo.cpp`](#playersrctoolspbinfocpp)

**App Android, conversor e templates**

- [`android/.gitignore`](#androidgitignore)
- [`android/app/build.gradle`](#androidappbuildgradle)
- [`android/app/src/main/AndroidManifest.xml`](#androidappsrcmainandroidmanifestxml)
- [`android/app/src/main/java/com/portbridge/app/ApkProvider.java`](#androidappsrcmainjavacomportbridgeappapkproviderjava)
- [`android/app/src/main/java/com/portbridge/app/ConverterActivity.java`](#androidappsrcmainjavacomportbridgeappconverteractivityjava)
- [`android/app/src/main/res/values/strings.xml`](#androidappsrcmainresvaluesstringsxml)
- [`android/app/src/main/res/values/styles.xml`](#androidappsrcmainresvaluesstylesxml)
- [`android/build.gradle`](#androidbuildgradle)
- [`android/converter/build.gradle`](#androidconverterbuildgradle)
- [`android/converter/src/main/java/com/portbridge/converter/Axml.java`](#androidconvertersrcmainjavacomportbridgeconverteraxmljava)
- [`android/converter/src/main/java/com/portbridge/converter/Cli.java`](#androidconvertersrcmainjavacomportbridgeconverterclijava)
- [`android/converter/src/main/java/com/portbridge/converter/Converter.java`](#androidconvertersrcmainjavacomportbridgeconverterconverterjava)
- [`android/converter/src/main/java/com/portbridge/converter/Ipa.java`](#androidconvertersrcmainjavacomportbridgeconverteripajava)
- [`android/converter/src/main/java/com/portbridge/converter/Plist.java`](#androidconvertersrcmainjavacomportbridgeconverterplistjava)
- [`android/converter/src/main/java/com/portbridge/converter/Png.java`](#androidconvertersrcmainjavacomportbridgeconverterpngjava)
- [`android/converter/src/main/java/com/portbridge/converter/SigningKey.java`](#androidconvertersrcmainjavacomportbridgeconvertersigningkeyjava)
- [`android/gradle.properties`](#androidgradleproperties)
- [`android/gradle/wrapper/gradle-wrapper.properties`](#androidgradlewrappergradle-wrapperproperties)
- [`android/hle/README.md`](#androidhlereadmemd)
- [`android/hle/build.gradle`](#androidhlebuildgradle)
- [`android/hle/src/main/AndroidManifest.xml`](#androidhlesrcmainandroidmanifestxml)
- [`android/hle/src/main/java/com/portbridge/hle/HleActivity.java`](#androidhlesrcmainjavacomportbridgehlehleactivityjava)
- [`android/hle/src/main/java/com/portbridge/hle/Report.java`](#androidhlesrcmainjavacomportbridgehlereportjava)
- [`android/hle/src/main/java/com/portbridge/hle/ReportActivity.java`](#androidhlesrcmainjavacomportbridgehlereportactivityjava)
- [`android/runtime/build.gradle`](#androidruntimebuildgradle)
- [`android/runtime/src/main/AndroidManifest.xml`](#androidruntimesrcmainandroidmanifestxml)
- [`android/runtime/src/main/java/com/portbridge/runtime/GameActivity.java`](#androidruntimesrcmainjavacomportbridgeruntimegameactivityjava)
- [`android/settings.gradle`](#androidsettingsgradle)

**Patch do touchHLE (runtime de apps nativos; não entra no APK do Zorbié)**

- [`third_party/patches/touchHLE/android_looper_compat.h`](#thirdpartypatchestouchhleandroidloopercompath)
- [`third_party/patches/touchHLE/portbridge.patch`](#thirdpartypatchestouchhleportbridgepatch)

---

# Player C++ (runtime dos jogos Clickteam)

## player/CMakeLists.txt

```cmake
cmake_minimum_required(VERSION 3.16)
project(PortBridgePlayer C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
    set(CMAKE_BUILD_TYPE Release)
endif()

option(PB_BUILD_PLAYER "Compila o player (precisa do SDL2)" ON)
option(PB_BUILD_TOOLS "Compila as ferramentas de linha de comando" ON)
set(PB_SDL_DIR "${CMAKE_CURRENT_SOURCE_DIR}/third_party/SDL" CACHE PATH "Código-fonte do SDL2")

# ---- miniz (MIT): zip + zlib
add_library(pb_miniz STATIC
    third_party/miniz/miniz.c third_party/miniz/miniz_tdef.c
    third_party/miniz/miniz_tinfl.c third_party/miniz/miniz_zip.c)
target_include_directories(pb_miniz PUBLIC third_party/miniz)
set_target_properties(pb_miniz PROPERTIES POSITION_INDEPENDENT_CODE ON)

# ---- núcleo: leitura de IPA e do jogo Clickteam (sem SDL)
add_library(pb_core STATIC
    src/core/bytes.cpp src/core/game.cpp src/core/package.cpp src/core/names.cpp)
target_include_directories(pb_core PUBLIC src)
target_link_libraries(pb_core PUBLIC pb_miniz)
set_target_properties(pb_core PROPERTIES POSITION_INDEPENDENT_CODE ON)

if(PB_BUILD_TOOLS AND NOT ANDROID)
    add_executable(pbinfo src/tools/pbinfo.cpp)
    target_link_libraries(pbinfo PRIVATE pb_core)
endif()

if(PB_BUILD_PLAYER)
    if(NOT TARGET SDL2::SDL2)
        if(EXISTS "${PB_SDL_DIR}/CMakeLists.txt")
            set(SDL_SHARED ON CACHE BOOL "" FORCE)
            set(SDL_STATIC OFF CACHE BOOL "" FORCE)
            set(SDL_TEST OFF CACHE BOOL "" FORCE)
            add_subdirectory("${PB_SDL_DIR}" "${CMAKE_BINARY_DIR}/SDL" EXCLUDE_FROM_ALL)
        else()
            find_package(SDL2 REQUIRED)
        endif()
    endif()

    # Fontes embutidas (Liberation Sans, OFL; mesmas métricas do Arial dos jogos)
    set(PB_FONT_SOURCES)
    foreach(f regular:LiberationSans-Regular bold:LiberationSans-Bold)
        string(REPLACE ":" ";" parts "${f}")
        list(GET parts 0 sym)
        list(GET parts 1 file)
        set(in "${CMAKE_CURRENT_SOURCE_DIR}/third_party/fonts/${file}.ttf")
        set(out "${CMAKE_BINARY_DIR}/pb_font_${sym}.cpp")
        add_custom_command(OUTPUT "${out}"
            COMMAND ${CMAKE_COMMAND} -DIN=${in} -DOUT=${out} -DSYM=pb_font_${sym}
                    -P "${CMAKE_CURRENT_SOURCE_DIR}/cmake/embed.cmake"
            DEPENDS "${in}" "${CMAKE_CURRENT_SOURCE_DIR}/cmake/embed.cmake")
        list(APPEND PB_FONT_SOURCES "${out}")
    endforeach()

    set(PB_RUNTIME_SOURCES
        src/runtime/audio.cpp src/runtime/runtime.cpp src/runtime/events.cpp
        src/runtime/expressions.cpp src/runtime/movements.cpp src/runtime/render.cpp
        src/runtime/screen.cpp src/runtime/text.cpp ${PB_FONT_SOURCES}
        src/runtime/tweaks.cpp
        src/runtime/devcheck.cpp
        src/runtime/extensions.cpp src/runtime/diag.cpp src/main.cpp)

    if(ANDROID)
        # O SDLActivity carrega libmain.so
        add_library(main SHARED ${PB_RUNTIME_SOURCES})
        set(PB_PLAYER_TARGET main)
        target_link_libraries(main PRIVATE android log)
        # páginas de 16 KB (Android 15+): explícito, além do padrão do NDK r28
        target_link_options(main PRIVATE "-Wl,-z,max-page-size=16384")
    else()
        add_executable(portbridge-player ${PB_RUNTIME_SOURCES})
        set(PB_PLAYER_TARGET portbridge-player)
    endif()
    target_include_directories(${PB_PLAYER_TARGET} PRIVATE src third_party/dr_libs third_party/stb)
    target_link_libraries(${PB_PLAYER_TARGET} PRIVATE pb_core SDL2::SDL2)
    if(TARGET SDL2::SDL2main AND NOT ANDROID)
        target_link_libraries(${PB_PLAYER_TARGET} PRIVATE SDL2::SDL2main)
    endif()
endif()
```

## player/cmake/embed.cmake

```cmake
# Gera um .cpp com o conteúdo de um arquivo binário como array C.
#   cmake -DIN=fonte.ttf -DOUT=saida.cpp -DSYM=nome -P embed.cmake
file(READ "${IN}" hex HEX)
string(LENGTH "${hex}" n)
math(EXPR bytes "${n} / 2")
string(REGEX REPLACE "([0-9a-f][0-9a-f])" "0x\\1," body "${hex}")
file(WRITE "${OUT}" "// Gerado de ${IN} (não editar)\n#include <cstddef>\nextern const unsigned char ${SYM}[] = {${body}};\nextern const size_t ${SYM}_size = ${bytes};\n")
```

## player/src/core/bytes.cpp

```cpp
#include "bytes.hpp"

namespace pb {

static void put_utf8(std::string& out, uint32_t c) {
    if (c < 0x80) {
        out += char(c);
    } else if (c < 0x800) {
        out += char(0xC0 | (c >> 6));
        out += char(0x80 | (c & 0x3F));
    } else if (c < 0x10000) {
        out += char(0xE0 | (c >> 12));
        out += char(0x80 | ((c >> 6) & 0x3F));
        out += char(0x80 | (c & 0x3F));
    } else {
        out += char(0xF0 | (c >> 18));
        out += char(0x80 | ((c >> 12) & 0x3F));
        out += char(0x80 | ((c >> 6) & 0x3F));
        out += char(0x80 | (c & 0x3F));
    }
}

std::string cp1252_to_utf8(const uint8_t* s, size_t n) {
    static const uint16_t hi[32] = {
        0x20AC, 0xFFFD, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021, 0x02C6, 0x2030, 0x0160,
        0x2039, 0x0152, 0xFFFD, 0x017D, 0xFFFD, 0xFFFD, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022,
        0x2013, 0x2014, 0x02DC, 0x2122, 0x0161, 0x203A, 0x0153, 0xFFFD, 0x017E, 0x0178};
    std::string out;
    out.reserve(n);
    for (size_t i = 0; i < n; ++i) {
        uint8_t c = s[i];
        put_utf8(out, (c >= 0x80 && c < 0xA0) ? hi[c - 0x80] : c);
    }
    return out;
}

std::string utf16_to_utf8(const uint16_t* s, size_t n) {
    std::string out;
    for (size_t i = 0; i < n; ++i) {
        uint32_t c = s[i];
        if (c >= 0xD800 && c < 0xDC00 && i + 1 < n) {
            c = 0x10000 + ((c - 0xD800) << 10) + (s[++i] - 0xDC00);
        }
        put_utf8(out, c);
    }
    return out;
}

std::string Reader::cstr(bool unicode) {
    if (unicode) {
        size_t q = p_;
        while (q + 1 < n_ && (d_[q] | d_[q + 1])) q += 2;
        if (q + 1 >= n_) throw ParseError("string UTF-16 sem terminador");
        std::vector<uint16_t> tmp((q - p_) / 2);
        std::memcpy(tmp.data(), d_ + p_, q - p_);
        p_ = q + 2;
        return utf16_to_utf8(tmp.data(), tmp.size());
    }
    size_t q = p_;
    while (q < n_ && d_[q]) ++q;
    if (q >= n_) throw ParseError("string sem terminador");
    std::string s = cp1252_to_utf8(d_ + p_, q - p_);
    p_ = q + 1;
    return s;
}

}  // namespace pb
```

## player/src/core/bytes.hpp

```cpp
// Leitor little-endian sobre um bloco de memória, com checagem de limites.
#pragma once
#include <cstdint>
#include <cstring>
#include <stdexcept>
#include <string>
#include <vector>

namespace pb {

struct ParseError : std::runtime_error {
    using std::runtime_error::runtime_error;
};

class Reader {
public:
    Reader() = default;
    Reader(const uint8_t* data, size_t size, size_t pos = 0) : d_(data), n_(size), p_(pos) {}
    explicit Reader(const std::vector<uint8_t>& v, size_t pos = 0) : d_(v.data()), n_(v.size()), p_(pos) {}

    size_t pos() const { return p_; }
    size_t size() const { return n_; }
    size_t remaining() const { return p_ <= n_ ? n_ - p_ : 0; }
    const uint8_t* data() const { return d_; }
    const uint8_t* here() const { return d_ + p_; }
    void seek(size_t p) {
        if (p > n_) throw ParseError("seek fora dos limites");
        p_ = p;
    }
    void skip(size_t k) { seek(p_ + k); }

    template <class T> T get() {
        need(sizeof(T));
        T v;
        std::memcpy(&v, d_ + p_, sizeof(T));  // host little-endian (ARM/x86)
        p_ += sizeof(T);
        return v;
    }
    uint8_t u8() { return get<uint8_t>(); }
    int8_t i8() { return get<int8_t>(); }
    uint16_t u16() { return get<uint16_t>(); }
    int16_t i16() { return get<int16_t>(); }
    uint32_t u32() { return get<uint32_t>(); }
    int32_t i32() { return get<int32_t>(); }
    float f32() { return get<float>(); }
    double f64() { return get<double>(); }

    std::vector<uint8_t> bytes(size_t k) {
        need(k);
        std::vector<uint8_t> v(d_ + p_, d_ + p_ + k);
        p_ += k;
        return v;
    }
    // String terminada em zero: cp1252 (PAME) ou UTF-16 (PAMU), devolvida em UTF-8.
    std::string cstr(bool unicode = false);

private:
    void need(size_t k) const {
        if (p_ + k > n_) throw ParseError("leitura além do fim do bloco");
    }
    const uint8_t* d_ = nullptr;
    size_t n_ = 0, p_ = 0;
};

std::string cp1252_to_utf8(const uint8_t* s, size_t n);
std::string utf16_to_utf8(const uint16_t* s, size_t n);

}  // namespace pb
```

## player/src/core/game.cpp

```cpp
#include "game.hpp"

#include <algorithm>

#include "miniz.h"

namespace pb {
namespace {

constexpr uint16_t CH_APPHEADER = 0x2223, CH_EXTLIST = 0x2234, CH_FRAMEITEMS = 0x2229,
                   CH_FRAMEHANDLES = 0x222B, CH_GLOBALVALUES = 0x2232,
                   CH_GLOBALSTRINGS = 0x2233, CH_OTHEREXT = 0x2231, CH_FRAME = 0x3333,
                   CH_FRAMEHEADER = 0x3334, CH_FRAMENAME = 0x3335, CH_VIRTUALRECT = 0x3342,
                   CH_LAYERS = 0x3341, CH_INSTANCES = 0x3338, CH_EVENTS = 0x333D,
                   CH_IMAGES = 0x6666, CH_FONTS = 0x6667, CH_SOUNDS = 0x6668,
                   CH_OBJHEADER = 0x4444, CH_OBJNAME = 0x4445, CH_OBJPROPS = 0x4446,
                   CH_LAST = 0x7F7F;

struct Chunk {
    uint16_t id = 0, flags = 0;
    size_t data_off = 0, size = 0;   // posição/tamanho no buffer de origem
    std::vector<uint8_t> unpacked;   // só para chunks comprimidos
};

// Itera chunks a partir de p até o 0x7F7F. Chunks comprimidos são expandidos.
std::vector<Chunk> read_chunks(const uint8_t* d, size_t n, size_t p) {
    std::vector<Chunk> out;
    while (p + 8 <= n) {
        Chunk c;
        std::memcpy(&c.id, d + p, 2);
        std::memcpy(&c.flags, d + p + 2, 2);
        uint32_t sz;
        std::memcpy(&sz, d + p + 4, 4);
        if (p + 8 + sz > n) throw ParseError("chunk ultrapassa o fim do arquivo");
        c.data_off = p + 8;
        c.size = sz;
        if (c.flags & 2) throw ParseError("chunk criptografado não suportado");
        if ((c.flags & 1) && sz >= 8) {
            uint32_t usize, csize;
            std::memcpy(&usize, d + c.data_off, 4);
            std::memcpy(&csize, d + c.data_off + 4, 4);
            c.unpacked.resize(usize);
            mz_ulong out_len = usize;
            if (mz_uncompress(c.unpacked.data(), &out_len, d + c.data_off + 8, csize) != MZ_OK)
                throw ParseError("falha ao descomprimir chunk");
        }
        out.push_back(std::move(c));
        p += 8 + sz;
        if (out.back().id == CH_LAST) break;
    }
    return out;
}

Reader chunk_reader(const uint8_t* d, const Chunk& c) {
    if (!c.unpacked.empty()) return Reader(c.unpacked.data(), c.unpacked.size());
    return Reader(d + c.data_off, c.size);
}

// --------------------------------------------------------------- eventos
void read_expressions(Reader& r, size_t end, std::vector<Expr>& out) {
    while (r.pos() + 4 <= end) {
        size_t start = r.pos();
        Expr e;
        e.type = r.i16();
        e.num = r.i16();
        if (e.type == 0 && e.num == 0) break;
        uint16_t size = r.u16();
        if (size < 6) throw ParseError("token de expressão inválido");
        if (e.type == OBJ_SYSTEM) {
            switch (e.num) {
                case 0: e.ival = r.i32(); break;                 // Long
                case 3: e.sval = r.cstr(); break;                // String
                case 23: e.dval = r.f64(); break;                // Double
                case 24: case 50: r.skip(4); e.index = r.i16(); break;  // global
                default: break;
            }
        } else if (e.type >= 2 || e.type == OBJ_PLAYER) {
            e.oi = r.u16();
            e.oilist = r.i16();
            if (e.num == 16 || e.num == 19) e.index = r.i16();  // alterável
        }
        out.push_back(std::move(e));
        r.seek(start + size);
    }
}

void read_position(Reader& r, PositionParam& p) {
    p.oi_parent = r.u16();
    p.flags = r.u16();
    p.x = r.i16();
    p.y = r.i16();
    p.slope = r.i16();
    p.angle = r.i16();
    p.direction = r.i32();
    p.type_parent = r.i16();
    p.oilist_parent = r.i16();
    p.layer = r.i16();
}

bool is_expression_param(int code) {
    switch (code) {
        case 15: case 22: case 23: case 27: case 28: case 45: case 46: case 52: case 53:
        case 54: case 59: case 62: return true;
        default: return false;
    }
}

Param read_param(Reader& r, bool unicode) {
    size_t start = r.pos();
    uint16_t size = r.u16();
    Param p;
    p.file_pos = uint32_t(start);
    p.code = r.i16();
    size_t end = start + size;
    switch (p.code) {
        case P_OBJECT: p.oilist = r.i16(); p.oi = r.u16(); p.objtype = r.i16(); break;
        case P_TIME: p.i0 = r.i32(); p.i1 = r.i32(); break;
        case P_EVERY: p.i0 = r.i32(); p.i1 = r.i32(); break;
        case P_CMPTIME: p.i0 = r.i32(); p.i1 = r.i32(); p.comparison = r.i16(); break;
        case P_SAMPLE: case P_MUSIC: case P_CNDSAMPLE: case P_CNDMUSIC:
            p.i0 = r.i16(); p.i1 = r.u16(); p.str = r.cstr(unicode); break;
        case P_POSITION: case P_NEWPOSITION: read_position(r, p.pos); break;
        case P_CREATE: case P_SYSCREATE:
            read_position(r, p.pos); r.u16(); p.oi = r.u16(); r.skip(4); break;
        case P_SHOOT:
            read_position(r, p.pos); r.u16(); p.oi = r.u16(); r.skip(4); p.i0 = r.i16(); break;
        case P_ZONE: p.i0 = r.i16(); p.i1 = r.i16(); p.i2 = r.i16(); p.comparison = r.i16(); break;
        case P_CLICK: p.i0 = r.u8(); p.i1 = r.u8(); break;
        case P_COLOUR: p.i0 = int32_t(r.u32()); break;
        case P_GROUPTITLE: p.i0 = r.u16(); p.i1 = r.u16(); p.str = r.cstr(unicode); break;
        case P_GROUPPOINTER: p.i0 = r.i32(); p.i1 = r.i16(); break;
        case P_FILENAME: case P_STRING: case P_FILENAME2: case 64: p.str = r.cstr(unicode); break;
        case 47: case 51: p.i0 = r.i16(); p.i1 = r.i16(); break;  // dois shorts
        case P_EXTENSION: {
            int16_t esz = r.i16();
            p.i0 = r.i16();
            p.i1 = r.i16();
            if (esz > 6) p.raw = r.bytes(std::min<size_t>(esz - 6, end - r.pos()));
            break;
        }
        case P_INT: case P_BUFFER: case P_NEWDIRECTION: case 34: case 48: case 56:
            p.i0 = r.i32(); break;
        case P_REMARK: case P_PROGRAM: case 65: case 66: break;
        default:
            if (is_expression_param(p.code)) {
                p.comparison = r.i16();
                read_expressions(r, end, p.expr);
            } else if (end - r.pos() >= 2) {
                p.i0 = r.i16();  // parâmetros "short"
            }
    }
    r.seek(end);
    return p;
}

EventItem read_item(Reader& r, bool condition, bool unicode) {
    size_t start = r.pos();
    uint16_t size = r.u16();
    EventItem it;
    it.type = r.i16();
    it.num = r.i16();
    it.oi = r.u16();
    it.oilist = r.i16();
    it.flags = r.u8();
    it.flags2 = r.u8();
    uint8_t nparams = r.u8();
    it.def_type = r.u8();
    if (condition) it.identifier = r.u16();
    for (int i = 0; i < nparams; ++i) it.params.push_back(read_param(r, unicode));
    r.seek(start + size);
    return it;
}

void read_events(Reader r, FrameEvents& ev, bool unicode) {
    while (r.remaining() >= 4) {
        auto tag = r.bytes(4);
        std::string t(tag.begin(), tag.end());
        if (t == "ER>>") {
            r.i16(); r.i16(); r.i16();
            r.skip(17 * 2);
            int n = r.i16();
            for (int i = 0; i < n; ++i) {
                uint16_t oi = r.u16();
                int16_t type = r.i16();
                ev.qualifiers.emplace_back(oi, type);
            }
        } else if (t == "ERes") {
            r.i32();
        } else if (t == "ERev") {
            size_t end = r.pos() + r.i32();
            size_t base = r.pos();
            while (r.pos() < end) {
                size_t gstart = r.pos();
                int size = -r.i16();
                if (size <= 0) throw ParseError("grupo de eventos inválido");
                EventGroup g;
                g.offset = uint32_t(gstart);
                int nc = r.u8(), na = r.u8();
                g.flags = r.u16();
                r.skip(8);
                for (int i = 0; i < nc; ++i) g.conditions.push_back(read_item(r, true, unicode));
                for (int i = 0; i < na; ++i) g.actions.push_back(read_item(r, false, unicode));
                r.seek(gstart + size);
                ev.groups.push_back(std::move(g));
            }
        } else if (t == "ERop") {
            r.skip(r.i32());
        } else if (t == "<<ER") {
            return;
        } else {
            throw ParseError("marcador de eventos desconhecido: " + t);
        }
    }
}

// --------------------------------------------------------------- objetos
std::vector<MovementDef> read_movements(const uint8_t* b, size_t n, size_t base, bool unicode) {
    Reader r(b, n, base);
    uint32_t count = r.u32();
    if (count > 64) throw ParseError("bloco de movimentos inválido");
    std::vector<MovementDef> out;
    for (uint32_t i = 0; i < count; ++i) {
        Reader t(b, n, base + 4 + i * 16);
        int32_t name_off = t.i32(), id = t.i32(), data_off = t.i32(), data_size = t.i32();
        (void)id;
        size_t start = base + data_off;
        if (data_size < 12 || start + data_size > n) throw ParseError("movimento fora dos limites");
        Reader m(b, start + data_size, start);
        MovementDef mv;
        mv.player = m.u16();
        mv.type = m.u16();
        mv.move_at_start = m.u8() != 0;
        m.skip(3);
        mv.dirs_at_start = m.u32();
        switch (mv.type) {
            case MV_MOUSE: for (int k = 0; k < 5; ++k) mv.v.push_back(m.i16()); break;
            case MV_RACE: for (int k = 0; k < 7; ++k) mv.v.push_back(m.i16()); break;
            case MV_EIGHTDIR:
                for (int k = 0; k < 4; ++k) mv.v.push_back(m.i16());
                mv.v.push_back(int32_t(m.u32()));
                break;
            case MV_BALL: for (int k = 0; k < 5; ++k) mv.v.push_back(m.i16()); break;
            case MV_PLATFORM: for (int k = 0; k < 6; ++k) mv.v.push_back(m.i16()); break;
            case MV_PATH: {
                int steps = m.i16();
                mv.v.push_back(m.i16());  // vel. mínima
                mv.v.push_back(m.i16());  // vel. máxima
                mv.loop = m.u8();
                mv.reposition = m.u8();
                mv.reverse = m.u8();
                m.skip(1);
                for (int k = 0; k < steps; ++k) {
                    size_t s = m.pos();
                    m.skip(1);
                    uint8_t sz = m.u8();
                    PathStep st;
                    st.speed = m.u8();
                    st.direction = m.u8();
                    st.dx = m.i16();
                    st.dy = m.i16();
                    m.skip(4);  // cos, sen
                    st.length = m.i16();
                    st.pause = m.i16();
                    if (m.pos() < s + sz) st.name = m.cstr(unicode);
                    mv.steps.push_back(st);
                    if (sz < 2) throw ParseError("passo de trajetória inválido");
                    m.seek(s + sz);
                }
                break;
            }
            case MV_EXTENSION: {
                if (name_off) {
                    Reader nr(b, n, base + name_off);
                    mv.module = nr.cstr(unicode);
                    if (mv.module.size() > 4 && mv.module.substr(mv.module.size() - 4) == ".mvx")
                        mv.module.resize(mv.module.size() - 4);
                }
                m.skip(14 + 1);  // reservados + byte que os runtimes pulam
                while (m.remaining() >= 4) mv.v.push_back(m.i32());
                break;
            }
            default: break;
        }
        out.push_back(std::move(mv));
    }
    return out;
}

void read_animations(const uint8_t* b, size_t n, size_t base, std::vector<Animation>& out) {
    Reader r(b, n, base);
    r.u16();
    int count = r.u16();
    std::vector<uint16_t> offs(count);
    for (auto& o : offs) o = r.u16();
    out.resize(count);
    for (int a = 0; a < count; ++a) {
        if (!offs[a]) continue;
        size_t astart = base + offs[a];
        Reader ar(b, n, astart);
        std::array<uint16_t, 32> doffs;
        for (auto& o : doffs) o = ar.u16();
        out[a].present = true;
        for (int d = 0; d < 32; ++d) {
            if (!doffs[d]) continue;
            Reader dr(b, n, astart + doffs[d]);
            AnimDir& ad = out[a].dirs[d];
            ad.present = true;
            ad.min_speed = dr.u8();
            ad.max_speed = dr.u8();
            ad.repeat = dr.u16();
            ad.back_to = dr.u16();
            int nf = dr.u16();
            if (nf > 4096) throw ParseError("animação com quadros demais");
            ad.frames.resize(nf);
            for (auto& f : ad.frames) f = dr.u16();
        }
    }
}

void read_common(ObjectDef& o, const uint8_t* b, size_t n, bool unicode) {
    Reader r(b, n);
    r.i32();
    uint16_t o_mov = r.u16(), o_anim = r.u16();
    r.u16();
    uint16_t o_counter = r.u16(), o_data = r.u16();
    r.u16();
    o.oe_flags = r.u32();
    for (auto& q : o.qualifiers) q = r.i16();
    r.u16();  // extensão
    uint16_t o_values = r.u16(), o_strings = r.u16();
    o.flags2 = r.u16();
    o.prefs = r.u16();
    if (n >= 0x32) o.identifier.assign(reinterpret_cast<const char*>(b + 0x2E), 4);
    o.identifier.erase(std::find(o.identifier.begin(), o.identifier.end(), '\0'), o.identifier.end());

    if (o_anim) read_animations(b, n, o_anim, o.anims);
    if (o_mov) {
        try {
            o.movements = read_movements(b, n, o_mov, unicode);
        } catch (const ParseError& e) {
            o.parse_warning = std::string("movimentos: ") + e.what();
        }
    }
    if (o_values) {
        Reader v(b, n, o_values);
        int cnt = v.u16();
        for (int i = 0; i < cnt; ++i) o.values.push_back(v.i32());
    }
    if (o_strings) {
        Reader s(b, n, o_strings);
        int cnt = s.u16();
        for (int i = 0; i < cnt; ++i) o.strings.push_back(s.cstr(unicode));
    }
    if (o_counter) {
        Reader c(b, n, o_counter);
        c.u16();
        o.counter_init = c.i32();
        o.counter_min = c.i32();
        o.counter_max = c.i32();
    }
    if (o_data && (o.type == OBJ_COUNTER || o.type == OBJ_SCORE || o.type == OBJ_LIVES)) {
        Reader c(b, n, o_data);
        c.i32();
        o.counter_w = c.i32();
        o.counter_h = c.i32();
        c.i16();
        o.counter_display = c.i16();
        o.counter_flags = c.u16();
        o.counter_font = c.i16();
        if (o.counter_display == 1 || o.counter_display == 4) {
            int nf = c.i16();
            for (int i = 0; i < nf; ++i) o.counter_frames.push_back(c.u16());
        } else if (o.counter_display == 2 || o.counter_display == 3 || o.counter_display == 5) {
            // forma: borda (tamanho, cor), tipo de forma, preenchimento, cores
            c.u16();
            c.u32();
            int shape = c.u16();
            o.counter_fill = c.i16();
            if (shape == 1) {  // linha
                c.u16();
            } else if (o.counter_fill == 2) {
                o.counter_color1 = c.u32();
                o.counter_color2 = c.u32();
                o.counter_vgradient = (c.u32() & 1) != 0;
            } else if (o.counter_fill == 1) {
                o.counter_color1 = c.u32();
            }
        }
    }
    if (o_data && o.type == OBJ_TEXT) {
        Reader t(b, n, o_data);
        t.i32();
        o.text_w = t.i32();
        o.text_h = t.i32();
        int count = t.i32();
        std::vector<int32_t> offs(count);
        for (auto& x : offs) x = t.i32();
        for (int32_t off : offs) {
            Reader pr(b, n, o_data + off);
            TextParagraph p;
            p.font = pr.u16();
            p.flags = pr.u16();
            p.color = pr.u32();
            p.text = pr.cstr(unicode);
            o.paragraphs.push_back(std::move(p));
        }
    }
}

void read_objects(Game& g, Reader r) {
    uint32_t count = r.u32();
    const uint8_t* d = r.data();
    size_t p = r.pos();
    for (uint32_t i = 0; i < count; ++i) {
        auto parts = read_chunks(d, r.size(), p);
        if (parts.empty()) throw ParseError("objeto vazio");
        p = parts.back().data_off + parts.back().size;
        ObjectDef o;
        bool has_header = false;
        for (auto& c : parts) {
            Reader cr = chunk_reader(d, c);
            if (c.id == CH_OBJHEADER) {
                o.handle = cr.i16();
                o.type = cr.i16();
                o.flags = cr.u16();
                cr.u16();
                o.ink_effect = cr.u32();
                o.ink_param = cr.u32();
                has_header = true;
            } else if (c.id == CH_OBJNAME) {
                o.name = cr.cstr(g.unicode);
            } else if (c.id == CH_OBJPROPS && c.size) {
                // o tipo vem no cabeçalho, que precede as propriedades
                try {
                    read_common(o, cr.data(), cr.size(), g.unicode);
                } catch (const ParseError& e) {
                    o.parse_warning = e.what();
                }
            }
        }
        if (!has_header) throw ParseError("objeto sem cabeçalho");
        if (!o.parse_warning.empty()) g.warnings.push_back(o.name + ": " + o.parse_warning);
        g.objects[o.handle] = std::move(o);
    }
}

// --------------------------------------------------------------- frames
FrameDef read_frame(Game& g, const uint8_t* d, const Chunk& fc) {
    FrameDef f;
    Reader fr = chunk_reader(d, fc);
    auto subs = read_chunks(fr.data(), fr.size(), 0);
    for (auto& c : subs) {
        Reader r = chunk_reader(fr.data(), c);
        switch (c.id) {
            case CH_FRAMEHEADER:
                f.width = r.i32(); f.height = r.i32(); f.background = r.u32(); f.flags = r.u32();
                break;
            case CH_FRAMENAME: f.name = r.cstr(g.unicode); break;
            case CH_VIRTUALRECT: f.vx1 = r.i32(); f.vy1 = r.i32(); f.vx2 = r.i32(); f.vy2 = r.i32(); break;
            case CH_LAYERS: {
                uint32_t n = r.u32();
                for (uint32_t i = 0; i < n; ++i) {
                    Layer l;
                    l.flags = r.u32();
                    // O export iOS grava os coeficientes em ponto fixo 16.16; o do Windows, em float.
                    auto coef = [](uint32_t raw) {
                        if (raw != 0 && (raw & 0x7F800000u) == 0) return float(raw / 65536.0);
                        float f;
                        std::memcpy(&f, &raw, 4);
                        return f;
                    };
                    l.x_coef = coef(r.u32());
                    l.y_coef = coef(r.u32());
                    r.skip(8);
                    l.name = r.cstr(g.unicode);
                    f.layers.push_back(l);
                }
                break;
            }
            case CH_INSTANCES: {
                uint32_t n = r.u32();
                for (uint32_t i = 0; i < n; ++i) {
                    Instance in;
                    in.handle = r.u16(); in.oi = r.u16();
                    in.x = r.i32(); in.y = r.i32();
                    in.parent_type = r.i16(); in.parent_handle = r.i16(); in.layer = r.i16();
                    r.i16();
                    f.instances.push_back(in);
                }
                break;
            }
            case CH_EVENTS:
                try {
                    read_events(r, f.events, g.unicode);
                } catch (const ParseError& e) {
                    f.events_error = e.what();
                }
                break;
            default: break;
        }
    }
    if (f.layers.empty()) f.layers.push_back(Layer{"Layer 1"});
    return f;
}

// --------------------------------------------------------------- mídia
void read_images(Game& g, const Chunk& c) {
    Reader r(g.buf.data(), c.data_off + c.size, c.data_off);
    r.u16();
    int count = r.u16();
    for (int i = 0; i < count; ++i) {
        ImageInfo im;
        im.handle = r.u16(); im.format = r.u16(); im.flags = r.u16();
        im.width = r.u16(); im.height = r.u16();
        im.hot_x = r.i16(); im.hot_y = r.i16(); im.act_x = r.i16(); im.act_y = r.i16();
        im.csize = r.u32();
        im.offset = r.pos();
        if (im.format > 4) throw ParseError("banco de imagens fora do layout iOS");
        r.skip(im.csize);
        g.images[im.handle] = im;
    }
}

void read_sounds(Game& g, const Chunk& c) {
    Reader r(g.buf.data(), c.data_off + c.size, c.data_off);
    r.u16();
    int count = r.u16();
    for (int i = 0; i < count; ++i) {
        SoundInfo s;
        s.handle = r.u16();
        int len = r.u16();
        if (g.unicode) {
            std::vector<uint16_t> tmp(len);
            for (auto& ch : tmp) ch = r.u16();
            s.name = utf16_to_utf8(tmp.data(), tmp.size());
        } else {
            auto raw = r.bytes(len);
            s.name = cp1252_to_utf8(raw.data(), raw.size());
        }
        s.duration_ms = r.u32();
        s.size = r.u32();
        s.offset = r.pos();
        r.skip(s.size);
        g.sounds[s.handle] = s;
    }
}

void read_fonts(Game& g, Reader r) {
    uint32_t count = r.u32();
    for (uint32_t i = 0; i < count; ++i) {
        size_t s = r.pos();
        FontInfo f;
        f.handle = r.i32();
        r.skip(12);
        f.height = r.i32();
        r.skip(12);
        f.weight = r.i32();
        f.italic = r.u8() != 0;
        r.skip(7);
        auto face = r.bytes(32);
        size_t len = std::find(face.begin(), face.end(), 0) - face.begin();
        f.face = cp1252_to_utf8(face.data(), len);
        r.seek(s + 76);
        g.fonts.push_back(f);
    }
}

}  // namespace

std::string Game::extension_name(int obj_type) const {
    for (auto& e : extensions)
        if (e.handle + OBJ_EXTENSION_BASE == obj_type) return e.name;
    return {};
}

int Game::frame_index_from_handle(int handle) const {
    if (handle >= 0 && handle < int(frame_handles.size())) return frame_handles[handle];
    return handle;
}

bool Game::decode_image(const ImageInfo& im, std::vector<uint8_t>& rgba) const {
    static const int bpp_of[5] = {4, 2, 2, 3, 2};
    if (im.format > 4) return false;
    int bpp = bpp_of[im.format];
    size_t stride = (size_t(im.width) * bpp + 3) & ~size_t(3);
    std::vector<uint8_t> raw(stride * im.height);
    mz_ulong len = raw.size();
    if (mz_uncompress(raw.data(), &len, buf.data() + im.offset, im.csize) != MZ_OK) return false;
    rgba.resize(size_t(im.width) * im.height * 4);
    for (int y = 0; y < im.height; ++y) {
        const uint8_t* s = raw.data() + y * stride;
        uint8_t* o = rgba.data() + size_t(y) * im.width * 4;
        for (int x = 0; x < im.width; ++x, o += 4) {
            uint8_t R, G, B, A = 255;
            if (im.format == 0) {
                R = s[x * 4]; G = s[x * 4 + 1]; B = s[x * 4 + 2]; A = s[x * 4 + 3];
            } else if (im.format == 3) {
                R = s[x * 3]; G = s[x * 3 + 1]; B = s[x * 3 + 2];
            } else {
                uint16_t v = uint16_t(s[x * 2] | (s[x * 2 + 1] << 8));
                if (im.format == 1) {
                    R = ((v >> 12) & 15) * 17; G = ((v >> 8) & 15) * 17;
                    B = ((v >> 4) & 15) * 17; A = (v & 15) * 17;
                } else if (im.format == 2) {
                    R = ((v >> 11) & 31) * 255 / 31; G = ((v >> 6) & 31) * 255 / 31;
                    B = ((v >> 1) & 31) * 255 / 31; A = (v & 1) ? 255 : 0;
                } else {
                    R = ((v >> 11) & 31) * 255 / 31; G = ((v >> 5) & 63) * 255 / 63;
                    B = (v & 31) * 255 / 31;
                }
            }
            o[0] = R; o[1] = G; o[2] = B; o[3] = A;
        }
    }
    return true;
}

std::unique_ptr<Game> load_game(std::vector<uint8_t> data) {
    auto g = std::make_unique<Game>();
    g->buf = std::move(data);
    const uint8_t* d = g->buf.data();
    size_t n = g->buf.size();
    if (n < 16) throw ParseError("arquivo pequeno demais");
    if (std::memcmp(d, "PAMU", 4) == 0) g->unicode = true;
    else if (std::memcmp(d, "PAME", 4) != 0) throw ParseError("não é um jogo Clickteam (PAME/PAMU)");
    std::memcpy(&g->runtime_version, d + 4, 2);
    std::memcpy(&g->product_build, d + 12, 4);

    for (auto& c : read_chunks(d, n, 16)) {
        Reader r = chunk_reader(d, c);
        try {
            switch (c.id) {
                case CH_APPHEADER: {
                    r.i32(); r.skip(8);
                    g->width = r.u16(); g->height = r.u16();
                    g->initial_score = ~r.i32(); g->initial_lives = ~r.i32();
                    r.skip(8 + 64); r.u32();
                    g->frame_count = r.i32(); g->frame_rate = r.i32();
                    if (g->frame_rate <= 0) g->frame_rate = 60;
                    break;
                }
                case CH_EXTLIST: {
                    int count = r.u16(); r.u16();
                    for (int i = 0; i < count; ++i) {
                        size_t s = r.pos();
                        int size = std::abs(r.i16());
                        Extension e;
                        e.handle = r.i16();
                        r.skip(12);
                        e.name = r.cstr(g->unicode);
                        if (e.name.size() > 4) e.name.resize(e.name.size() - 4);  // ".mfx"
                        g->extensions.push_back(e);
                        r.seek(s + size);
                    }
                    break;
                }
                case CH_OTHEREXT: {
                    int count = r.u16();
                    for (int i = 0; i < count; ++i) g->movement_extensions.push_back(r.cstr(g->unicode));
                    break;
                }
                case CH_GLOBALVALUES: {
                    int count = r.u16();
                    std::vector<int32_t> vals(count);
                    for (auto& v : vals) v = r.i32();
                    g->global_values = vals;
                    break;
                }
                case CH_GLOBALSTRINGS: {
                    uint32_t count = r.u32();
                    for (uint32_t i = 0; i < count; ++i) g->global_strings.push_back(r.cstr(g->unicode));
                    break;
                }
                case CH_FRAMEHANDLES:
                    while (r.remaining() >= 2) g->frame_handles.push_back(r.u16());
                    break;
                case CH_FRAMEITEMS: read_objects(*g, r); break;
                case CH_FRAME: g->frames.push_back(read_frame(*g, d, c)); break;
                case CH_IMAGES: read_images(*g, c); break;
                case CH_SOUNDS: read_sounds(*g, c); break;
                case CH_FONTS: read_fonts(*g, r); break;
                default: break;
            }
        } catch (const ParseError& e) {
            g->warnings.push_back("chunk " + std::to_string(c.id) + ": " + e.what());
        }
    }
    if (g->frames.empty()) throw ParseError("jogo sem frames");
    return g;
}

}  // namespace pb
```

## player/src/core/game.hpp

```cpp
// Modelo de dados de um jogo Clickteam (MMF2 / Fusion) lido do .cci/.ccn.
// Formato documentado em docs/FORMATO_CLICKTEAM_IOS.md.
#pragma once
#include <array>
#include <cstdint>
#include <map>
#include <memory>
#include <string>
#include <vector>

#include "bytes.hpp"

namespace pb {

// ---------------------------------------------------------------- eventos
struct Expr {
    int16_t type = 0, num = 0;
    uint16_t oi = 0;
    int16_t oilist = -1;
    int32_t ival = 0;
    double dval = 0;
    std::string sval;
    int16_t index = 0;  // índice de valor global / alterável
};

struct PositionParam {
    uint16_t oi_parent = 0, flags = 0;
    int16_t x = 0, y = 0, slope = 0, angle = 0;
    int32_t direction = 0;
    int16_t type_parent = 0, oilist_parent = -1, layer = 0;
};

enum ParamCode : int16_t {
    P_OBJECT = 1, P_TIME = 2, P_BORDER = 3, P_DIRECTION = 4, P_INT = 5, P_SAMPLE = 6,
    P_MUSIC = 7, P_POSITION = 8, P_CREATE = 9, P_ANIMATION = 10, P_NOP = 11, P_PLAYER = 12,
    P_EVERY = 13, P_KEY = 14, P_SPEED = 15, P_NEWPOSITION = 16, P_JOYDIRECTION = 17,
    P_SHOOT = 18, P_ZONE = 19, P_SYSCREATE = 21, P_EXPRESSION = 22, P_COMPARISON = 23,
    P_COLOUR = 24, P_BUFFER = 25, P_FRAME = 26, P_SAMLOOP = 27, P_MUSLOOP = 28,
    P_NEWDIRECTION = 29, P_TEXTNUMBER = 31, P_CLICK = 32, P_PROGRAM = 33, P_CNDSAMPLE = 35,
    P_CNDMUSIC = 36, P_REMARK = 37, P_GROUPTITLE = 38, P_GROUPPOINTER = 39, P_FILENAME = 40,
    P_STRING = 41, P_CMPTIME = 42, P_PASTE = 43, P_VMKEY = 44, P_EXPSTRING = 45,
    P_CMPSTRING = 46, P_INKEFFECT = 47, P_MENU = 48, P_VARGLO = 49, P_ALTVALUE = 50,
    P_FLAG = 51, P_VARGLO_EXP = 52, P_ALTVALUE_EXP = 53, P_FLAG_EXP = 54, P_EXTENSION = 55,
    P_8DIRECTIONS = 56, P_MVT = 57, P_STRINGGLO = 58, P_STRINGGLO_EXP = 59,
    P_PROGRAM2 = 60, P_ALTSTRING = 61, P_ALTSTRING_EXP = 62, P_FILENAME2 = 63,
};

struct Param {
    int16_t code = 0;
    int32_t i0 = 0, i1 = 0, i2 = 0;  // short/int/tempo/every/zona/clique/grupo...
    int16_t comparison = 0;
    std::vector<Expr> expr;
    PositionParam pos;
    uint16_t oi = 0;  // objeto / criar / atirar
    int16_t oilist = -1, objtype = 0;
    std::string str;
    std::vector<uint8_t> raw;  // extensão
    uint32_t file_pos = 0;     // posição absoluta do parâmetro no arquivo (group pointers)
};

struct EventItem {
    int16_t type = 0, num = 0;
    uint16_t oi = 0;
    int16_t oilist = -1;
    uint8_t flags = 0, flags2 = 0, def_type = 0;
    uint16_t identifier = 0;
    std::vector<Param> params;
    bool negated() const { return flags2 & 1; }
};

enum GroupFlags : uint16_t {
    EVG_ONCE = 1, EVG_NOTALWAYS = 2, EVG_REPEAT = 4, EVG_NOMORE = 8, EVG_ORINGROUP = 1024,
    EVG_ORLOGICAL = 4096, EVG_INACTIVE = 16384,
};

struct EventGroup {
    uint16_t flags = 0;
    uint32_t offset = 0;   // posição em bytes dentro do bloco ERev (alvo dos "group pointers")
    std::vector<EventItem> conditions, actions;
};

struct FrameEvents {
    std::vector<std::pair<uint16_t, int16_t>> qualifiers;  // (oi do qualificador, tipo)
    std::vector<EventGroup> groups;
};

// ---------------------------------------------------------------- objetos
struct AnimDir {
    bool present = false;
    uint8_t min_speed = 0, max_speed = 0;
    uint16_t repeat = 0, back_to = 0;
    std::vector<uint16_t> frames;
};

struct Animation {
    bool present = false;
    std::array<AnimDir, 32> dirs;
};

enum MovementType : uint16_t {
    MV_STATIC = 0, MV_MOUSE = 1, MV_RACE = 2, MV_EIGHTDIR = 3, MV_BALL = 4, MV_PATH = 5,
    MV_PLATFORM = 9, MV_EXTENSION = 14,
};

struct PathStep {
    uint8_t speed = 0, direction = 0;
    int16_t dx = 0, dy = 0, length = 0, pause = 0;
    std::string name;
};

struct MovementDef {
    uint16_t type = 0, player = 0;
    bool move_at_start = false;
    uint32_t dirs_at_start = 0;  // máscara de 32 direções
    std::string module;          // extensão, sem ".mvx"
    std::vector<int32_t> v;      // parâmetros do tipo, na ordem do formato
    bool loop = false, reposition = false, reverse = false;  // trajetória
    std::vector<PathStep> steps;
};

enum ObjType : int16_t {
    OBJ_PLAYER = -7, OBJ_KEYBOARD = -6, OBJ_CREATE = -5, OBJ_TIMER = -4, OBJ_GAME = -3,
    OBJ_SOUND = -2, OBJ_SYSTEM = -1, OBJ_QBACKDROP = 0, OBJ_BACKDROP = 1, OBJ_ACTIVE = 2,
    OBJ_TEXT = 3, OBJ_QUESTION = 4, OBJ_SCORE = 5, OBJ_LIVES = 6, OBJ_COUNTER = 7,
    OBJ_RTF = 8, OBJ_SUBAPP = 9, OBJ_EXTENSION_BASE = 32,
};

struct TextParagraph {
    uint16_t font = 0, flags = 0;
    uint32_t color = 0;
    std::string text;
};

struct ObjectDef {
    int16_t handle = 0, type = 0;
    std::string name, identifier;
    uint16_t flags = 0;
    uint32_t ink_effect = 0, ink_param = 0;
    std::array<int16_t, 8> qualifiers{};
    uint32_t oe_flags = 0;
    uint16_t flags2 = 0, prefs = 0;
    std::vector<Animation> anims;
    std::vector<MovementDef> movements;
    std::vector<int32_t> values;       // valores alteráveis iniciais
    std::vector<std::string> strings;  // strings alteráveis iniciais
    // contador / score / vidas
    int32_t counter_init = 0, counter_min = 0, counter_max = 0;
    int32_t counter_w = 0, counter_h = 0;
    int16_t counter_display = 0, counter_font = 0;
    uint16_t counter_flags = 0;         // barra: 0x100 = cresce ao contrário
    std::vector<uint16_t> counter_frames;
    // barra / texto: forma (cores no formato Windows 0x00BBGGRR)
    int16_t counter_fill = 0;           // 0 nenhum, 1 sólido, 2 degradê
    uint32_t counter_color1 = 0, counter_color2 = 0;
    bool counter_vgradient = false;
    // texto
    int32_t text_w = 0, text_h = 0;
    std::vector<TextParagraph> paragraphs;
    std::string parse_warning;

    bool visible_at_start() const { return flags2 & 0x0008; }
    bool fill_is_gradient() const { return counter_fill == 2; }
    bool create_at_start() const { return !(oe_flags & 0x20000); }
    bool is_extension() const { return type >= OBJ_EXTENSION_BASE; }
};

// ---------------------------------------------------------------- frames
struct Layer {
    std::string name;
    uint32_t flags = 0;
    float x_coef = 1, y_coef = 1;
};

struct Instance {
    uint16_t handle = 0, oi = 0;
    int32_t x = 0, y = 0;
    int16_t parent_type = 0, parent_handle = 0, layer = 0;
};

struct FrameDef {
    std::string name;
    int32_t width = 0, height = 0;
    uint32_t background = 0, flags = 0;
    int32_t vx1 = 0, vy1 = 0, vx2 = 0, vy2 = 0;
    std::vector<Layer> layers;
    std::vector<Instance> instances;
    FrameEvents events;
    std::string events_error;
};

// ---------------------------------------------------------------- mídia
struct ImageInfo {
    uint16_t handle = 0, format = 0, flags = 0, width = 0, height = 0;
    int16_t hot_x = 0, hot_y = 0, act_x = 0, act_y = 0;
    size_t offset = 0, csize = 0;
};

struct SoundInfo {
    uint16_t handle = 0;
    std::string name;
    uint32_t duration_ms = 0;
    size_t offset = 0, size = 0;
};

struct FontInfo {
    int32_t handle = 0, height = 0, weight = 0;
    bool italic = false;
    std::string face;
};

struct Extension {
    int16_t handle = 0;
    std::string name;  // sem ".mfx"
};

// ---------------------------------------------------------------- jogo
struct Game {
    std::vector<uint8_t> buf;  // arquivo inteiro (imagens/sons são lidos sob demanda)
    bool unicode = false;
    uint16_t runtime_version = 0;
    uint32_t product_build = 0;

    int32_t width = 320, height = 240, frame_rate = 60, frame_count = 0;
    int32_t initial_score = 0, initial_lives = 3;
    std::vector<Extension> extensions;
    std::vector<std::string> movement_extensions;
    std::vector<int32_t> global_values;
    std::vector<std::string> global_strings;
    std::vector<uint16_t> frame_handles;
    std::map<int, ObjectDef> objects;  // por handle
    std::vector<FrameDef> frames;
    std::map<int, ImageInfo> images;   // por handle
    std::map<int, SoundInfo> sounds;   // por handle
    std::vector<FontInfo> fonts;
    std::vector<std::string> warnings;

    std::string extension_name(int obj_type) const;
    const ObjectDef* object(int handle) const {
        auto it = objects.find(handle);
        return it == objects.end() ? nullptr : &it->second;
    }
    int frame_index_from_handle(int handle) const;
    // Imagem decodificada em RGBA8888 (linhas contínuas, sem padding).
    bool decode_image(const ImageInfo& img, std::vector<uint8_t>& rgba) const;
};

// Lê um .cci/.ccn completo. Lança ParseError se o arquivo não for Clickteam.
std::unique_ptr<Game> load_game(std::vector<uint8_t> data);

}  // namespace pb
```

## player/src/core/names.cpp

```cpp
#include "names.hpp"

#include <map>
#include <utility>

namespace pb {
namespace {

using Key = std::pair<int, int>;
// Tipos: -7 Player, -6 Keyboard/Mouse, -5 Create, -4 Timer, -3 Game, -2 Sound, -1 Special,
// 0 operadores (expressões), 2 Active, 3 Text, 7 Counter. "Common" (tipo 2 = qualquer objeto)
// cobre os números < 80, que valem para todos os objetos.
const std::map<Key, const char*> kConditions = {
    {{-1, -1}, "Always"}, {{-1, -2}, "Never"}, {{-1, -3}, "Compare"}, {{-1, -4}, "Restrict"},
    {{-1, -5}, "Repeat"}, {{-1, -6}, "Once"}, {{-1, -7}, "NotAlways"},
    {{-1, -8}, "CompareGlobalValue"}, {{-1, -9}, "Remark"}, {{-1, -10}, "NewGroup"},
    {{-1, -11}, "GroupEnd"}, {{-1, -12}, "GroupActivated"}, {{-1, -16}, "OnLoop"},
    {{-1, -20}, "CompareGlobalString"}, {{-1, -24}, "OrFiltered"}, {{-1, -25}, "OrLogical"},
    {{-1, -26}, "Chance"},
    {{-2, -1}, "SampleNotPlaying"}, {{-2, -3}, "NoSamplePlaying"}, {{-2, -8}, "ChannelNotPlaying"},
    {{-3, -1}, "StartOfFrame"}, {{-3, -2}, "EndOfFrame"}, {{-3, -8}, "ApplicationResumed"},
    {{-4, -1}, "TimerGreater"}, {{-4, -2}, "TimerLess"}, {{-4, -3}, "TimerEquals"},
    {{-4, -4}, "Every"}, {{-4, -8}, "Every2"},
    {{-6, -1}, "KeyPressed"}, {{-6, -2}, "KeyDown"}, {{-6, -3}, "MouseInZone"},
    {{-6, -4}, "MouseOnObject"}, {{-6, -5}, "MouseClicked"}, {{-6, -6}, "MouseClickedInZone"},
    {{-6, -7}, "ObjectClicked"}, {{-6, -8}, "WhileMousePressed"},
    {{2, -1}, "AnimationFrame"}, {{2, -2}, "AnimationFinished"}, {{2, -3}, "AnimationPlaying"},
    {{2, -4}, "IsOverlapping"}, {{2, -7}, "MovementStopped"}, {{2, -8}, "FacingInDirection"},
    {{2, -14}, "OnCollision"}, {{2, -15}, "CompareSpeed"}, {{2, -16}, "CompareY"},
    {{2, -17}, "CompareX"}, {{2, -21}, "PathFinished"}, {{2, -22}, "NearBorders"},
    {{2, -23}, "OverlappingBackground"}, {{2, -24}, "FlagOff"}, {{2, -25}, "FlagOn"},
    {{2, -27}, "CompareAlterableValue"}, {{2, -28}, "ObjectInvisible"},
    {{2, -29}, "ObjectVisible"}, {{2, -30}, "ObjectsInZone"}, {{2, -31}, "NoObjectsInZone"},
    {{2, -32}, "NumberOfObjects"}, {{2, -33}, "AllDestroyed"}, {{2, -34}, "PickRandom"},
    {{7, -81}, "CompareCounter"},
};
const std::map<Key, const char*> kActions = {
    {{-1, 0}, "Skip"}, {{-1, 3}, "SetGlobalValue"}, {{-1, 4}, "SubtractGlobalValue"},
    {{-1, 5}, "AddGlobalValue"}, {{-1, 6}, "ActivateGroup"}, {{-1, 7}, "DeactivateGroup"},
    {{-1, 14}, "StartLoop"}, {{-1, 15}, "StopLoop"}, {{-1, 19}, "SetGlobalString"},
    {{-2, 0}, "PlaySample"}, {{-2, 1}, "StopAllSamples"}, {{-2, 6}, "StopSample"},
    {{-2, 11}, "PlayChannelSample"}, {{-2, 12}, "PlayLoopingChannelSample"},
    {{-2, 13}, "PauseChannel"}, {{-2, 14}, "ResumeChannel"}, {{-2, 15}, "StopChannel"},
    {{-2, 17}, "SetChannelVolume"}, {{-2, 32}, "SetChannelFrequency"},
    {{-3, 0}, "NextFrame"}, {{-3, 1}, "PreviousFrame"}, {{-3, 2}, "JumpToFrame"},
    {{-3, 4}, "EndApplication"}, {{-3, 7}, "CenterDisplay"}, {{-3, 8}, "CenterDisplayX"},
    {{-3, 9}, "CenterDisplayY"}, {{-3, 16}, "SetFrameRate"}, {{-3, 18}, "PauseApplication"},
    {{-3, 23}, "SetFrameBackgroundColor"}, {{-3, 27}, "SetFrameHeight"},
    {{-4, 0}, "SetTimer"}, {{-5, 0}, "CreateObject"},
    {{2, 1}, "SetPosition"}, {{2, 2}, "SetX"}, {{2, 3}, "SetY"}, {{2, 4}, "Stop"},
    {{2, 5}, "Start"}, {{2, 6}, "SetSpeed"}, {{2, 9}, "Bounce"}, {{2, 11}, "NextMovement"},
    {{2, 13}, "SelectMovement"}, {{2, 14}, "LookAt"}, {{2, 15}, "StopAnimation"},
    {{2, 16}, "StartAnimation"}, {{2, 17}, "ForceAnimation"}, {{2, 18}, "ForceDirection"},
    {{2, 19}, "ForceSpeed"}, {{2, 20}, "RestoreAnimation"}, {{2, 21}, "RestoreDirection"},
    {{2, 23}, "SetDirection"}, {{2, 24}, "Destroy"}, {{2, 26}, "Hide"}, {{2, 27}, "Show"},
    {{2, 28}, "FlashDuring"}, {{2, 29}, "Shoot"}, {{2, 30}, "ShootToward"},
    {{2, 31}, "SetAlterableValue"}, {{2, 32}, "AddToAlterable"},
    {{2, 33}, "SubtractFromAlterable"}, {{2, 34}, "SpreadValue"}, {{2, 40}, "ForceFrame"},
    {{2, 41}, "RestoreFrame"}, {{2, 43}, "SetDeceleration"}, {{2, 57}, "BringToFront"},
    {{2, 58}, "BringToBack"}, {{2, 59}, "MoveBehind"}, {{2, 60}, "MoveInFront"},
    {{2, 61}, "MoveToLayer"}, {{2, 65}, "SetAlphaCoefficient"}, {{2, 66}, "SetRGBCoefficient"},
    {{2, 85}, "SetScale"}, {{2, 86}, "SetXScale"}, {{2, 87}, "SetYScale"}, {{2, 88}, "SetAngle"},
    {{3, 88}, "SetString"},
    {{7, 80}, "SetCounterValue"}, {{7, 81}, "AddCounterValue"}, {{7, 82}, "SubtractCounterValue"},
    {{7, 83}, "SetMinimumValue"}, {{7, 84}, "SetMaximumValue"}, {{7, 85}, "SetCounterColor1"},
    {{7, 86}, "SetCounterColor2"},
};
const std::map<Key, const char*> kExpressions = {
    {{-1, -3}, "Comma"}, {{-1, -2}, "EndParenthesis"}, {{-1, -1}, "Parenthesis"},
    {{-1, 0}, "Long"}, {{-1, 1}, "Random"}, {{-1, 2}, "GlobalValueExpression"},
    {{-1, 3}, "String"}, {{-1, 4}, "ToString"}, {{-1, 5}, "ToNumber"}, {{-1, 10}, "Sin"},
    {{-1, 11}, "Cos"}, {{-1, 23}, "Double"}, {{-1, 24}, "GlobalValue"},
    {{-1, 50}, "GlobalString"},
    {{0, 2}, "Plus"}, {{0, 4}, "Minus"}, {{0, 6}, "Multiply"}, {{0, 8}, "Divide"},
    {{0, 10}, "Modulus"}, {{0, 12}, "Power"}, {{0, 14}, "And"}, {{0, 16}, "Or"}, {{0, 18}, "Xor"},
    {{-3, 3}, "XRightFrame"}, {{-3, 5}, "YBottomFrame"}, {{-3, 6}, "FrameWidth"},
    {{-3, 7}, "FrameHeight"}, {{-3, 10}, "FrameRate"},
    {{-5, 0}, "TotalObjectCount"}, {{-6, 0}, "XMouse"}, {{-6, 1}, "YMouse"},
    {{2, 1}, "YPosition"}, {{2, 2}, "AnimationFrame"}, {{2, 3}, "Speed"}, {{2, 6}, "GetDirection"},
    {{2, 7}, "ObjectLeft"}, {{2, 8}, "ObjectRight"}, {{2, 9}, "ObjectTop"},
    {{2, 10}, "ObjectBottom"}, {{2, 11}, "XPosition"}, {{2, 14}, "AnimationNumber"},
    {{2, 15}, "ObjectCount"}, {{2, 16}, "AlterableValue"}, {{2, 25}, "ActionX"},
    {{2, 26}, "ActionY"}, {{2, 27}, "AlphaCoefficient"}, {{2, 28}, "RGBCoefficient"},
    {{2, 81}, "GetXScale"}, {{2, 82}, "GetYScale"}, {{2, 83}, "GetAngle"},
    {{7, 80}, "CounterValue"}, {{7, 81}, "CounterMinimumValue"}, {{7, 82}, "CounterMaximumValue"},
};

const char* lookup(const std::map<Key, const char*>& m, int t, int n) {
    auto it = m.find({t, n});
    if (it != m.end()) return it->second;
    if (t >= 2) {  // comuns a todos os objetos
        bool common = n > -80 && n < 80;
        if (common) {
            it = m.find({2, n});
            if (it != m.end()) return it->second;
        }
    }
    return nullptr;
}

}  // namespace

const char* object_type_name(int t) {
    switch (t) {
        case -7: return "Player"; case -6: return "Keyboard/Mouse"; case -5: return "Create";
        case -4: return "Timer"; case -3: return "Game"; case -2: return "Sound";
        case -1: return "Special"; case 0: return "Operator"; case 1: return "Backdrop";
        case 2: return "Active"; case 3: return "Text"; case 4: return "Question";
        case 5: return "Score"; case 6: return "Lives"; case 7: return "Counter";
        case 8: return "RTF"; case 9: return "SubApplication";
        default: return t >= 32 ? "Extension" : "Unknown";
    }
}

std::string item_name(ItemKind kind, int t, int n) {
    const auto& m = kind == ItemKind::Condition ? kConditions
                    : kind == ItemKind::Action  ? kActions
                                                : kExpressions;
    std::string base = object_type_name(t);
    if (t >= 32) {
        int idx = kind == ItemKind::Condition ? -n - 81 : n - 80;
        if (idx >= 0) return base + "#" + std::to_string(idx);
    }
    if (const char* s = lookup(m, t, n)) return base + "." + s;
    return base + "(" + std::to_string(n) + ")";
}

}  // namespace pb
```

## player/src/core/names.hpp

```cpp
// Nomes legíveis de condições, ações e expressões (para logs e ferramentas).
#pragma once
#include <string>

namespace pb {

enum class ItemKind { Condition, Action, Expression };

// "Active.SetX", "Special.CompareGlobalValue", "Extension#3" ...
std::string item_name(ItemKind kind, int obj_type, int num);
const char* object_type_name(int obj_type);

}  // namespace pb
```

## player/src/core/package.cpp

```cpp
#include "package.hpp"

#include <algorithm>
#include <cctype>
#include <cstring>
#include <fstream>
#include <stdexcept>

#include "bytes.hpp"
#include "miniz.h"

namespace pb {
namespace {

std::vector<uint8_t> read_file(const std::string& path) {
    std::ifstream f(path, std::ios::binary);
    if (!f) throw std::runtime_error("não foi possível abrir " + path);
    return std::vector<uint8_t>((std::istreambuf_iterator<char>(f)), std::istreambuf_iterator<char>());
}

bool ends_with(const std::string& s, const std::string& suf) {
    if (s.size() < suf.size()) return false;
    return std::equal(suf.rbegin(), suf.rend(), s.rbegin(),
                      [](char a, char b) { return std::tolower(a) == std::tolower(b); });
}

uint64_t be(const uint8_t* p, int n) {
    uint64_t v = 0;
    for (int i = 0; i < n; ++i) v = (v << 8) | p[i];
    return v;
}

}  // namespace

bool read_bplist_strings(const std::vector<uint8_t>& d,
                         std::vector<std::pair<std::string, std::string>>& out) {
    if (d.size() < 40 || std::memcmp(d.data(), "bplist00", 8) != 0) return false;
    const uint8_t* t = d.data() + d.size() - 32;
    int off_size = t[6], ref_size = t[7];
    uint64_t nobj = be(t + 8, 8), top = be(t + 16, 8), table = be(t + 24, 8);
    if (table + nobj * off_size > d.size() || top >= nobj) return false;
    auto obj_off = [&](uint64_t i) -> size_t { return size_t(be(d.data() + table + i * off_size, off_size)); };
    auto length = [&](size_t& p) -> uint64_t {
        uint64_t len = d[p] & 0x0F;
        ++p;
        if (len == 0x0F) {
            int bytes = 1 << (d[p] & 0x0F);
            len = be(d.data() + p + 1, bytes);
            p += 1 + bytes;
        }
        return len;
    };
    auto string_at = [&](uint64_t idx, std::string& s) -> bool {
        size_t p = obj_off(idx);
        if (p >= d.size()) return false;
        int type = d[p] >> 4;
        uint64_t len = length(p);
        if (type == 0x5) {
            if (p + len > d.size()) return false;
            s.assign(reinterpret_cast<const char*>(d.data() + p), len);
            return true;
        }
        if (type == 0x6) {
            if (p + len * 2 > d.size()) return false;
            std::vector<uint16_t> u(len);
            for (uint64_t i = 0; i < len; ++i) u[i] = uint16_t(be(d.data() + p + i * 2, 2));
            s = utf16_to_utf8(u.data(), u.size());
            return true;
        }
        return false;
    };
    size_t p = obj_off(top);
    if (p >= d.size() || (d[p] >> 4) != 0xD) return false;
    uint64_t n = length(p);
    for (uint64_t i = 0; i < n; ++i) {
        uint64_t k = be(d.data() + p + i * ref_size, ref_size);
        uint64_t v = be(d.data() + p + (n + i) * ref_size, ref_size);
        std::string ks, vs;
        if (string_at(k, ks) && string_at(v, vs)) out.emplace_back(ks, vs);
    }
    return true;
}

PackageInfo open_package(const std::string& path) {
    return open_package_data(read_file(path), path);
}

PackageInfo open_package_data(std::vector<uint8_t> file, const std::string& path) {
    PackageInfo info;
    if (file.size() >= 4 && (std::memcmp(file.data(), "PAME", 4) == 0 ||
                             std::memcmp(file.data(), "PAMU", 4) == 0)) {
        info.kind = "cci";
        info.display_name = path.substr(path.find_last_of("/\\") + 1);
        info.game_data = std::move(file);
        return info;
    }

    mz_zip_archive zip{};
    if (!mz_zip_reader_init_mem(&zip, file.data(), file.size(), 0))
        throw std::runtime_error("o arquivo não é um IPA (zip) nem um .cci");
    struct Closer { mz_zip_archive* z; ~Closer() { mz_zip_reader_end(z); } } closer{&zip};

    int data_idx = -1, plist_idx = -1, artwork_idx = -1;
    size_t icon_size = 0;
    int icon_idx = -1;
    std::string app_dir;
    unsigned n = mz_zip_reader_get_num_files(&zip);
    // PNGs dentro do .app costumam estar em CgBI (formato da Apple que o Android não lê):
    // só aceitamos PNG cujo primeiro chunk é IHDR.
    auto plain_png = [&](unsigned idx) {
        uint8_t head[16] = {0};
        if (!mz_zip_reader_extract_to_mem(&zip, idx, head, sizeof head, 0)) {
            size_t sz = 0;
            void* p = mz_zip_reader_extract_to_heap(&zip, idx, &sz, 0);
            if (!p) return false;
            std::memcpy(head, p, std::min<size_t>(sz, 16));
            mz_free(p);
        }
        return std::memcmp(head + 12, "IHDR", 4) == 0;
    };
    for (unsigned i = 0; i < n; ++i) {
        mz_zip_archive_file_stat st;
        if (!mz_zip_reader_file_stat(&zip, i, &st) || st.m_is_directory) continue;
        std::string name = st.m_filename;
        if (name == "iTunesArtwork") { artwork_idx = int(i); continue; }
        if (name.rfind("Payload/", 0) != 0) continue;
        size_t slash = name.find('/', 8);
        if (slash == std::string::npos) continue;
        std::string dir = name.substr(0, slash + 1);
        std::string rel = name.substr(slash + 1);
        if (rel.find('/') != std::string::npos) continue;  // só a raiz do .app
        if (ends_with(rel, ".cci") || ends_with(rel, "application.ccn")) {
            data_idx = int(i);
            app_dir = dir;
            info.data_entry = name;
        } else if (rel == "Info.plist") {
            plist_idx = int(i);
        } else if (ends_with(rel, ".png") &&
                   (rel.find("Icon") != std::string::npos || rel.find("Artwork") != std::string::npos)) {
            if (st.m_uncomp_size > icon_size && plain_png(i)) {
                icon_size = size_t(st.m_uncomp_size);
                icon_idx = int(i);
            }
        }
    }
    if (data_idx < 0)
        throw std::runtime_error("nenhum jogo Clickteam (Application.cci) encontrado no IPA");

    auto extract = [&](int idx) {
        size_t sz = 0;
        void* p = mz_zip_reader_extract_to_heap(&zip, unsigned(idx), &sz, 0);
        if (!p) throw std::runtime_error("falha ao extrair arquivo do IPA");
        std::vector<uint8_t> v(static_cast<uint8_t*>(p), static_cast<uint8_t*>(p) + sz);
        mz_free(p);
        return v;
    };
    info.kind = "ipa";
    info.game_data = extract(data_idx);
    if (artwork_idx >= 0) {
        info.icon = extract(artwork_idx);
        info.icon_ext = info.icon.size() > 3 && info.icon[0] == 0xFF && info.icon[1] == 0xD8 ? "jpg" : "png";
    } else if (icon_idx >= 0) {
        info.icon = extract(icon_idx);
        info.icon_ext = "png";
    }
    std::string folder = app_dir.substr(8, app_dir.size() - 9);
    if (ends_with(folder, ".app")) folder.resize(folder.size() - 4);
    info.display_name = folder;
    if (plist_idx >= 0) {
        std::vector<std::pair<std::string, std::string>> kv;
        if (read_bplist_strings(extract(plist_idx), kv)) {
            for (auto& [k, v] : kv) {
                if (k == "CFBundleDisplayName" && !v.empty()) info.display_name = v;
                else if (k == "CFBundleIdentifier") info.bundle_id = v;
                else if (k == "CFBundleShortVersionString") info.version = v;
            }
        }
    }
    return info;
}

}  // namespace pb
```

## player/src/core/package.hpp

```cpp
// Abre o pacote de entrada (IPA, APK de Clickteam ou .cci/.ccn solto) e devolve
// os dados do jogo e metadados para a biblioteca do app.
#pragma once
#include <cstdint>
#include <string>
#include <vector>

namespace pb {

struct PackageInfo {
    std::string kind;          // "ipa", "cci"
    std::string display_name;  // CFBundleDisplayName / nome da pasta .app
    std::string bundle_id, version;
    std::string data_entry;    // caminho do .cci dentro do pacote
    std::vector<uint8_t> game_data;
    std::vector<uint8_t> icon;      // iTunesArtwork (JPEG) ou maior PNG comum (não CgBI)
    std::string icon_ext;           // "jpg" ou "png"
};

// Lança std::runtime_error com mensagem em português se não achar um jogo suportado.
PackageInfo open_package(const std::string& path);
// Mesmo que open_package, a partir do conteúdo do arquivo (ex.: lido dos assets do APK).
PackageInfo open_package_data(std::vector<uint8_t> file, const std::string& name);

// Dicionário de nível superior de um plist binário (só valores string).
bool read_bplist_strings(const std::vector<uint8_t>& data,
                         std::vector<std::pair<std::string, std::string>>& out);

}  // namespace pb
```

## player/src/main.cpp

```cpp
// PortBridge Player: roda jogos Clickteam de IPAs de iOS em Android, Linux, Windows e macOS.
//
//   portbridge-player jogo.ipa [--scale N] [--mute]
//   portbridge-player jogo.ipa --headless --frames 600 --click 160,240@120 --screenshot out.png
//
// No Android o caminho do jogo chega como argumento pelo PlayerActivity (SDLActivity).
#include <SDL.h>

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <memory>
#include <string>
#include <vector>

#include "core/game.hpp"
#include "core/package.hpp"
#include "miniz.h"
#include "runtime/audio.hpp"
#include "runtime/diag.hpp"
#include "runtime/runtime.hpp"
#include "runtime/screen.hpp"
#include "runtime/tweaks.hpp"
#include "runtime/text.hpp"

namespace {

struct Options {
    std::string path, screenshot, save_dir, log, device;
    bool headless = false, mute = false, no_tweaks = false, dev = false;
    int frames = 0, scale = 2;
    std::vector<std::pair<int, std::pair<int, int>>> clicks;  // (frame, (x, y))
    std::vector<std::pair<std::pair<int, int>, std::pair<int, int>>> holds;  // ((de, até), (x, y))
    std::vector<int> shots;                                    // frames extras para capturar
    std::vector<int> dumps;                                    // frames para listar o estado
    std::vector<int> resumes;                                  // simula a volta do segundo plano
    std::vector<std::pair<int, std::pair<int, double>>> sets;  // (loop, (global, valor)): --set-global
    int screen_w = 0, screen_h = 0;                            // --screen: simula uma tela (pixels)
    int monkey = -1;                                           // a partir deste loop: toques aleatórios
    bool monkey_all = false;                                   // toques na tela inteira (menus, loja)
    unsigned seed = 12345u;
    int start_frame = -1;                                      // começa direto neste frame (testes)
    std::string audit;                                         // relatório de auditoria (arquivo)
    std::string text_test;                                     // desenha textos de exemplo neste PNG e sai
    int shot_every = 0;                                        // captura a cada N loops
};

bool parse_args(int argc, char** argv, Options& o) {
    for (int i = 1; i < argc; ++i) {
        std::string a = argv[i];
        auto next = [&]() -> std::string { return i + 1 < argc ? argv[++i] : ""; };
        if (a == "--headless") o.headless = true;
        else if (a == "--mute") o.mute = true;
        else if (a == "--no-tweaks") o.no_tweaks = true;  // jogo exatamente como o original
        else if (a == "--dev") o.dev = true;  // modo desenvolvedor: confere falhas a cada passo
        else if (a == "--monkey-all") o.monkey_all = true;
        else if (a == "--seed") o.seed = unsigned(std::strtoul(next().c_str(), nullptr, 10));
        else if (a == "--start-frame") o.start_frame = std::atoi(next().c_str());
        else if (a == "--audit") o.audit = next();
        else if (a == "--text-test") o.text_test = next();
        else if (a == "--frames") o.frames = std::atoi(next().c_str());
        else if (a == "--scale") o.scale = std::max(1, std::atoi(next().c_str()));
        else if (a == "--screenshot") o.screenshot = next();
        else if (a == "--save-dir") o.save_dir = next();
        else if (a == "--log") o.log = next();
        else if (a == "--device") o.device = next();
        else if (a == "--shot-at") o.shots.push_back(std::atoi(next().c_str()));
        else if (a == "--dump-at") o.dumps.push_back(std::atoi(next().c_str()));
        else if (a == "--resume-at") o.resumes.push_back(std::atoi(next().c_str()));
        else if (a == "--set-global") {  // G=V@loop: muda um valor global (testes; ex.: 12=5@900 = letras do bônus)
            int g = 0, f = 0;
            double v = 0;
            if (std::sscanf(next().c_str(), "%d=%lf@%d", &g, &v, &f) == 3) o.sets.push_back({f, {g, v}});
        }
        else if (a == "--monkey") o.monkey = std::atoi(next().c_str());
        else if (a == "--screen") std::sscanf(next().c_str(), "%dx%d", &o.screen_w, &o.screen_h);
        else if (a == "--hold") {
            int x = 0, y = 0, f = 0, g = 0;
            if (std::sscanf(next().c_str(), "%d,%d@%d-%d", &x, &y, &f, &g) == 4) o.holds.push_back({{f, g}, {x, y}});
        }
        else if (a == "--shot-every") o.shot_every = std::atoi(next().c_str());
        else if (a == "--click") {
            int x = 0, y = 0, f = 0;
            if (std::sscanf(next().c_str(), "%d,%d@%d", &x, &y, &f) == 3) o.clicks.push_back({f, {x, y}});
        } else if (!a.empty() && a[0] != '-' && o.path.empty()) o.path = a;
    }
    return !o.path.empty();
}

bool save_png(SDL_Renderer* r, int w, int h, const std::string& path) {
    std::vector<uint8_t> px(size_t(w) * h * 4);
    if (SDL_RenderReadPixels(r, nullptr, SDL_PIXELFORMAT_RGBA32, px.data(), w * 4) != 0) return false;
    size_t len = 0;
    void* png = tdefl_write_image_to_png_file_in_memory(px.data(), w, h, 4, &len);
    if (!png) return false;
    FILE* f = std::fopen(path.c_str(), "wb");
    if (f) {
        std::fwrite(png, 1, len, f);
        std::fclose(f);
    }
    mz_free(png);
    return f != nullptr;
}

// Estado do jogo num loop (modo de teste): globais e objetos visíveis.
void dump_state(pb::App& app, int loop) {
    pb::Frame* f = app.frame();
    if (!f) return;
    std::printf("=== loop %d  frame %d '%s'  scroll %.0f,%.0f  tamanho %dx%d  tempo %ums\n", loop, f->index,
                f->def.name.c_str(), f->scroll_x, f->scroll_y, f->width, f->height, f->timer_ms);
    std::printf("globais:");
    for (size_t i = 0; i < app.global_values.size() && i < 80; ++i) {
        const pb::Value& v = app.global_values[i];
        if (!v.is_num()) std::printf(" g%zu=\"%s\"", i, v.str().c_str());
        else if (v.num() != 0) std::printf(" g%zu=%g", i, v.num());
    }
    std::printf("\n");
    for (auto& o : f->objects) {
        if (o->destroyed && !o->dying) continue;
        std::printf("  %-22s oi=%-4d (%6.1f,%6.1f) camada %d %s anim %d dir %d fr %d img %d esc %.2f",
                    o->def ? o->def->name.c_str() : "?", o->oi, o->x, o->y, o->layer,
                    o->visible ? "vis" : "oculto", o->anim, o->dir, o->frame, o->image, o->scale_x);
        for (size_t i = 0; i < o->values.size() && i < 26; ++i)
            if (o->values[i].num() != 0) std::printf(" v%zu=%g", i, o->values[i].num());
        std::printf("\n");
    }
}

}  // namespace

int main(int argc, char** argv) {
    Options opt;
    if (!parse_args(argc, argv, opt)) {
        std::fprintf(stderr, "uso: portbridge-player <jogo.ipa | Application.cci> [--headless --frames N --screenshot out.png]\n");
        return 2;
    }
    if (opt.shot_every > 0) opt.shots.push_back(-1);
    if (opt.headless) {
        SDL_SetHint(SDL_HINT_VIDEODRIVER, "offscreen");
        SDL_setenv("SDL_AUDIODRIVER", "dummy", 1);
    }
    SDL_SetHint(SDL_HINT_RENDER_SCALE_QUALITY, "1");
    if (SDL_Init(SDL_INIT_VIDEO | SDL_INIT_EVENTS | SDL_INIT_TIMER) != 0) {
        std::fprintf(stderr, "SDL_Init: %s\n", SDL_GetError());
        return 1;
    }

    pb::diag_open(opt.log, opt.device);
    pb::g_diag.stage = "carregando o jogo";
    pb::PackageInfo pkg;
    std::unique_ptr<pb::Game> game;
    try {
        if (opt.path.rfind("asset:", 0) == 0) {
            // APK gerado pelo PortBridge: o jogo está em assets/ (o SDL lê direto do APK)
            std::string name = opt.path.substr(6);
            SDL_RWops* rw = SDL_RWFromFile(name.c_str(), "rb");
            if (!rw) throw std::runtime_error("jogo não encontrado no APK: " + name + " (" + SDL_GetError() + ")");
            Sint64 size = SDL_RWsize(rw);
            std::vector<uint8_t> data(size > 0 ? size_t(size) : 0);
            size_t got = data.empty() ? 0 : SDL_RWread(rw, data.data(), 1, data.size());
            SDL_RWclose(rw);
            if (got != data.size()) throw std::runtime_error("falha ao ler " + name + " do APK");
            SDL_Log("jogo embutido: %s (%zu bytes)", name.c_str(), data.size());
            pkg = pb::open_package_data(std::move(data), name);
        } else {
            pkg = pb::open_package(opt.path);
        }
        game = pb::load_game(std::move(pkg.game_data));
        SDL_Log("jogo: %s %s (%s) %dx%d %d fps, %zu frames, %zu objetos, %zu avisos",
                pkg.display_name.c_str(), pkg.version.c_str(), pkg.bundle_id.c_str(), game->width,
                game->height, game->frame_rate, game->frames.size(), game->objects.size(),
                game->warnings.size());
        for (size_t i = 0; i < game->warnings.size() && i < 20; ++i) SDL_Log("aviso: %s", game->warnings[i].c_str());
        if (!opt.no_tweaks)
            for (const std::string& t : pb::apply_game_tweaks(*game, pkg.bundle_id)) SDL_Log("ajuste: %s", t.c_str());
    } catch (const std::exception& e) {
        pb::diag_fatal(std::string("Não foi possível abrir o jogo: ") + e.what());
        std::fprintf(stderr, "erro: %s\n", e.what());
        return 1;
    }
    int gw = game->width, gh = game->height;
    // Orientação pelo formato do jogo (o Zorbié é retrato 320x480).
    SDL_SetHint(SDL_HINT_ORIENTATIONS, gw <= gh ? "Portrait PortraitUpsideDown" : "LandscapeLeft LandscapeRight");
    // Área visível: no desktop, o tamanho do jogo (ou a tela simulada com --screen);
    // no Android, recalculada abaixo pelo tamanho real da tela.
    int vw = gw, vh = gh;
    if (opt.screen_w > 0 && opt.screen_h > 0) pb::choose_view(*game, opt.screen_w, opt.screen_h, vw, vh);
    std::string title = pkg.display_name.empty() ? "PortBridge" : pkg.display_name;

    Uint32 wflags = SDL_WINDOW_RESIZABLE | SDL_WINDOW_ALLOW_HIGHDPI;
#ifdef __ANDROID__
    wflags |= SDL_WINDOW_FULLSCREEN;
#endif
    if (opt.headless) wflags = SDL_WINDOW_HIDDEN;
    int scale = opt.headless ? 1 : opt.scale;
    int win_w = vw * scale, win_h = vh * scale;
    if (opt.headless && opt.screen_w > 0 && opt.screen_h > 0) {
        // testes: a janela invisível tem o formato da tela simulada (reduzida),
        // para as capturas mostrarem a composição completa (faixas incluídas)
        int f = std::max(1, (opt.screen_h + 1199) / 1200);
        win_w = opt.screen_w / f;
        win_h = opt.screen_h / f;
    }
    SDL_Window* win = SDL_CreateWindow(title.c_str(), SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED,
                                       win_w, win_h, wflags);
    if (!win) {
        pb::diag_fatal(std::string("Falha ao criar a janela: ") + SDL_GetError());
        return 1;
    }
    Uint32 rflags = opt.headless ? SDL_RENDERER_SOFTWARE : (SDL_RENDERER_ACCELERATED | SDL_RENDERER_PRESENTVSYNC);
    SDL_Renderer* ren = SDL_CreateRenderer(win, -1, rflags);
    if (!ren) ren = SDL_CreateRenderer(win, -1, SDL_RENDERER_SOFTWARE);
    if (!ren) {
        pb::diag_fatal(std::string("Falha ao iniciar os gráficos: ") + SDL_GetError());
        return 1;
    }
#ifdef __ANDROID__
    {
        int ow = 0, oh = 0;
        SDL_GetRendererOutputSize(ren, &ow, &oh);
        pb::choose_view(*game, ow, oh, vw, vh);
    }
#endif
    pb::Screen screen(ren);
    if (!opt.text_test.empty()) {
        // Teste do texto: frases do Zorbié no estilo do objeto "String" (Arial 13 negrito, branco).
        screen.configure(vw, vh);
        screen.begin();
        SDL_SetRenderDrawColor(ren, 40, 60, 120, 255);
        SDL_RenderClear(ren);
        const pb::FontInfo* bold = nullptr;
        for (const auto& f : game->fonts) if (f.weight >= 600) bold = &f;
        const char* lines[] = {"Zorbiéééé!!!", "I've been in prizon 12 times.", "Gordolex is hiding something...",
                               "You're an arcade game löver.", "No, it's not the end, pleaze wait for futures updates. ;)"};
        std::vector<std::shared_ptr<void>> caches(5);
        for (int i = 0; i < 5; ++i) {
            pb::TextStyle st;
            st.font = bold;
            SDL_FRect box{20, 40.0f + 60.0f * i, 216, 32};
            SDL_SetRenderDrawColor(ren, 255, 255, 255, 60);
            SDL_SetRenderDrawBlendMode(ren, SDL_BLENDMODE_BLEND);
            SDL_RenderDrawRectF(ren, &box);
            pb::draw_text(ren, caches[size_t(i)], lines[i], st, box);
        }
        screen.end();
        int ow = 0, oh = 0;
        SDL_GetRendererOutputSize(ren, &ow, &oh);
        save_png(ren, ow, oh, opt.text_test);
        return 0;
    }
    screen.configure(vw, vh);
    {
        SDL_RendererInfo ri{};
        SDL_GetRendererInfo(ren, &ri);
        int ow = 0, oh = 0;
        SDL_GetRendererOutputSize(ren, &ow, &oh);
        SDL_Log("vídeo: %s, renderizador %s, saída %dx%d, jogo %dx%d, área visível %dx%d em %dx%d+%d+%d",
                SDL_GetCurrentVideoDriver(), ri.name ? ri.name : "?", ow, oh, gw, gh, vw, vh,
                screen.game_rect.w, screen.game_rect.h, screen.game_rect.x, screen.game_rect.y);
    }

    std::string save = opt.save_dir;
    if (save.empty()) {
        std::string id = pkg.bundle_id.empty() ? title : pkg.bundle_id;
        if (char* p = SDL_GetPrefPath("PortBridge", id.c_str())) {
            save = p;
            SDL_free(p);
            if (!save.empty() && (save.back() == '/' || save.back() == '\\')) save.pop_back();
        } else {
            save = ".";
        }
    }

    pb::Audio audio(*game);
    audio.set_muted(opt.mute || opt.headless);
    pb::App app(std::move(game), ren, &audio, save);
    app.view_w = vw;
    app.view_h = vh;
    app.dev.on = opt.dev || std::getenv("PB_DEV") != nullptr;
    app.audit.on = !opt.audit.empty() || app.dev.on;  // o modo desenvolvedor usa a contagem de disparos
    if (opt.start_frame >= 0) app.request_frame(opt.start_frame);

    auto render = [&]() {
        screen.begin();
        app.draw();
        screen.end();
    };
    auto output_size = [&](int& w, int& h) { SDL_GetRendererOutputSize(ren, &w, &h); };

    auto step = [&]() -> bool {
        try {
            app.step();
            return true;
        } catch (const std::exception& e) {
            pb::diag_fatal(std::string("Erro ao executar o jogo: ") + e.what());
            return false;
        }
    };
    // O jogo pode mudar a taxa (Zorbié: 40 ou 45 quadros/s na qualidade baixa).
    double tick_ms = 1000.0 / std::max(1, app.frame_rate);
    double acc = 0;
    Uint64 last = SDL_GetPerformanceCounter();
    int loops = 0;
    bool running = true;
    // Só redesenha quando o jogo avançou: numa tela de 120 Hz o vsync pediria
    // 120 quadros por segundo para um jogo de 60, o dobro de trabalho da GPU
    // (e de calor) para mostrar a mesma imagem duas vezes.
    bool redraw = true;
    // Toque curto entre dois passos do jogo: o "apertado" vale por pelo menos um passo.
    bool press_seen[3] = {true, true, true}, release_pending[3] = {false, false, false};
    // Folga no ritmo: com a tela a 60 Hz, cada v-sync chega ~16,7 ms depois do
    // anterior, praticamente igual ao passo do jogo. Exigir o passo inteiro fazia
    // um v-sync "adiantado" por décimos de ms ficar sem passo, e o quadro seguinte
    // esperava mais uma volta da tela (tremida, menos de 60 quadros/s).
    double slack = tick_ms * 0.25;
    Uint64 stat_t0 = last;
    int stat_frames = 0, stat_steps = 0;
    while (running && !app.finished()) {
        SDL_Event ev;
        while (SDL_PollEvent(&ev)) {
            switch (ev.type) {
                case SDL_QUIT: running = false; break;
                // toques/mouse em pixels da janela -> unidades do jogo (também nas faixas)
                case SDL_MOUSEMOTION:
                    screen.to_game(ev.motion.x, ev.motion.y, win, app.input.mouse_x, app.input.mouse_y);
                    break;
                case SDL_MOUSEBUTTONDOWN:
                case SDL_MOUSEBUTTONUP: {
                    int b = ev.button.button == SDL_BUTTON_RIGHT ? 2 : ev.button.button == SDL_BUTTON_MIDDLE ? 1 : 0;
                    screen.to_game(ev.button.x, ev.button.y, win, app.input.mouse_x, app.input.mouse_y);
                    bool down = ev.type == SDL_MOUSEBUTTONDOWN;
                    if (down) {
                        app.input.clicked[b] = true;
                        app.input.dbl[b] = ev.button.clicks >= 2;
                        app.input.down[b] = true;
                        press_seen[b] = false;
                        release_pending[b] = false;
                    } else if (!press_seen[b]) {
                        // toque rápido: soltou antes de o jogo ver o dedo apertado.
                        // Segura o "apertado" até o próximo passo, senão o toque se perde.
                        release_pending[b] = true;
                    } else {
                        app.input.down[b] = false;
                    }
                    break;
                }
                case SDL_KEYDOWN:
                    if (ev.key.keysym.sym == SDLK_AC_BACK || ev.key.keysym.sym == SDLK_ESCAPE) running = false;
                    break;
                case SDL_APP_WILLENTERBACKGROUND: audio.pause_all(true); pb::flush_ini_files(); break;
                case SDL_APP_DIDENTERFOREGROUND:
                    audio.pause_all(false);
                    app.interrupted_flag = true;
                    app.resume_pending = true;
                    break;
                case SDL_WINDOWEVENT:
                    if (ev.window.event == SDL_WINDOWEVENT_SIZE_CHANGED) {
                        int ow = 0, oh = 0;
                        output_size(ow, oh);
#ifdef __ANDROID__
                        // ex.: o aparelho estava deitado e girou para retrato
                        pb::choose_view(app.game(), ow, oh, app.view_w, app.view_h);
#endif
                        screen.configure(app.view_w, app.view_h);
                        SDL_Log("tela %dx%d: área visível %dx%d", ow, oh, app.view_w, app.view_h);
                    }
                    redraw = true;
                    break;
                case SDL_RENDER_DEVICE_RESET:
                case SDL_RENDER_TARGETS_RESET:
                    SDL_Log("contexto gráfico recriado: recarregando texturas");
                    app.reset_textures();
                    if (ev.type == SDL_RENDER_DEVICE_RESET) screen.release();
                    screen.configure(app.view_w, app.view_h);
                    redraw = true;
                    break;
                default: break;
            }
        }
        if (opt.headless) {
            // "Jogador automático" para testes longos: segura e arrasta na metade
            // de baixo da tela (zona de controle do Zorbié), com pausas.
            static uint32_t seed = opt.seed;
            static int hold = 0, rest = 0;
            static double tx = 160, ty = 400;
            auto rnd = [&](int n) { seed = seed * 1103515245u + 12345u; return int((seed >> 16) % uint32_t(n)); };
            if (opt.monkey >= 0 && loops >= opt.monkey) {
                if (hold > 0) {
                    app.input.mouse_x += int((tx - app.input.mouse_x) * 0.2);
                    app.input.mouse_y += int((ty - app.input.mouse_y) * 0.2);
                    if (--hold == 0) app.input.down[0] = false;
                } else if (rest > 0) {
                    --rest;
                } else {
                    int VW = app.view_w, VH = app.view_h;
                    app.input.mouse_x = rnd(VW);
                    app.input.mouse_y = opt.monkey_all ? rnd(VH) : VH / 2 + 40 + rnd(VH / 2 - 40);
                    tx = rnd(VW);
                    ty = opt.monkey_all ? rnd(VH) : VH / 2 + 40 + rnd(VH / 2 - 40);
                    app.input.clicked[0] = true;
                    app.input.down[0] = true;
                    hold = 5 + rnd(60);
                    rest = rnd(30);
                }
            }
            for (auto& [fg, xy] : opt.holds) {
                if (loops == fg.first) { app.input.clicked[0] = true; app.input.down[0] = true; }
                if (loops >= fg.first && loops <= fg.second) {
                    app.input.mouse_x = xy.first;
                    app.input.mouse_y = xy.second;
                }
                if (loops == fg.second + 1) app.input.down[0] = false;
            }
            for (auto& [f, xy] : opt.clicks) {
                if (f == loops) {
                    app.input.mouse_x = xy.first;
                    app.input.mouse_y = xy.second;
                    app.input.clicked[0] = true;
                    app.input.down[0] = true;
                } else if (f + 3 == loops) {
                    app.input.down[0] = false;
                }
            }
            for (auto& [f, gv] : opt.sets)
                if (f == loops && gv.first >= 0) {  // mesmo número de "gN" no --dump-at e de "GVn" nos eventos
                    auto& G = app.global_values;
                    if (G.size() <= size_t(gv.first)) G.resize(size_t(gv.first) + 1);
                    G[size_t(gv.first)] = pb::Value(gv.second);
                }
            for (int r : opt.resumes)
                if (r == loops) {
                    app.interrupted_flag = true;
                    app.resume_pending = true;
                }
            if (!step()) { running = false; break; }
            ++loops;
            for (int d : opt.dumps)
                if (d == loops) dump_state(app, loops);
            for (int s : opt.shots) {
                if (s == loops || (opt.shot_every > 0 && s == -1 && loops % opt.shot_every == 0)) {
                    render();
                    std::string name = opt.screenshot.empty() ? "shot.png" : opt.screenshot;
                    auto dot = name.rfind('.');
                    std::string path = name.substr(0, dot) + "_" + std::to_string(loops) + name.substr(dot);
                    int ow = 0, oh = 0;
                    output_size(ow, oh);
                    save_png(ren, ow, oh, path);
                }
            }
            for (int b = 0; b < 3; ++b) app.input.clicked[b] = app.input.dbl[b] = false;
            if (opt.frames && loops >= opt.frames) break;
            continue;
        }
        Uint64 now = SDL_GetPerformanceCounter();
        acc += double(now - last) * 1000.0 / double(SDL_GetPerformanceFrequency());
        last = now;
        if (acc > 250) acc = 250;
        int steps = 0;
        tick_ms = 1000.0 / std::max(1, app.frame_rate);
        slack = tick_ms * 0.25;
        while (acc >= tick_ms - slack && steps < 4) {
            if (!step()) { running = false; break; }
            for (int b = 0; b < 3; ++b) {
                app.input.clicked[b] = app.input.dbl[b] = false;
                if (app.input.down[b]) press_seen[b] = true;
                if (release_pending[b]) {
                    app.input.down[b] = false;
                    release_pending[b] = false;
                }
            }
            acc -= tick_ms;
            ++steps;
        }
        if (steps == 0 && !redraw) {
            // nada novo para mostrar: dorme até perto do próximo passo do jogo
            double wait = tick_ms - slack - acc;
            SDL_Delay(wait > 2.0 ? Uint32(wait - 1.0) : 1);
            continue;
        }
        redraw = false;
        render();
        SDL_RenderPresent(ren);
        app.prefetch(3.0);  // depois de mostrar o quadro: usa a folga até o próximo
        stat_steps += steps;
        ++stat_frames;
        if (double(now - stat_t0) >= 30.0 * double(SDL_GetPerformanceFrequency())) {
            double secs = double(now - stat_t0) / double(SDL_GetPerformanceFrequency());
            SDL_Log("desempenho: %.1f quadros/s, %.1f passos do jogo/s", stat_frames / secs, stat_steps / secs);
            stat_t0 = now;
            stat_frames = stat_steps = 0;
        }
        if (opt.frames && ++loops >= opt.frames) break;
    }

    if (opt.headless) {
        render();
        int ow = 0, oh = 0;
        output_size(ow, oh);
        if (!opt.screenshot.empty() && !save_png(ren, ow, oh, opt.screenshot))
            std::fprintf(stderr, "falha ao salvar %s\n", opt.screenshot.c_str());
        pb::Frame* fr = app.frame();
        std::printf("loops %d  frame %d '%s'  objetos %zu  tempo %ums\n", loops, fr ? fr->index : -1,
                    fr ? fr->def.name.c_str() : "", fr ? fr->objects.size() : 0, fr ? fr->timer_ms : 0);
        std::printf("não implementados (%zu):\n", app.unimplemented.size());
        for (auto& [k, v] : app.unimplemented) std::printf("  %-40s %d\n", k.c_str(), v);
        if (app.dev.on) {
            for (int h : audio.failed) app.dev.report(app, "som que não decodifica", "som " + std::to_string(h));
            app.dev.write(app, stdout);
        }
        if (!opt.audit.empty()) {
            if (FILE* af = std::fopen(opt.audit.c_str(), "w")) {
                auto& A = app.audit;
                std::fprintf(af, "decodificacoes %d, total %.1f ms, pior %.1f ms (imagem %d)\n", A.decodes,
                             A.decode_ms, A.worst_decode_ms, A.worst_decode);
                std::fprintf(af, "sons decodificados no passo do jogo %d, total %.1f ms, pior %.1f ms (som %d)\n",
                             audio.decodes, audio.decode_ms, audio.worst_decode_ms, audio.worst_decode);
                std::fprintf(af, "sons decodificados em segundo plano %d, total %.1f ms, pior %.1f ms (som %d)\n",
                             audio.bg_decodes, audio.bg_decode_ms, audio.bg_worst_ms, audio.bg_worst);
                for (auto& [fi, n] : A.loops)
                    std::fprintf(af, "frame %d: %llu passos, pico de %zu objetos\n", fi, (unsigned long long)n,
                                 A.max_objects[fi]);
                for (auto& s : A.slow) std::fprintf(af, "lento: %s\n", s.c_str());
                for (auto& [fi, v] : A.fired) {
                    std::fprintf(af, "disparos frame %d:", fi);
                    for (size_t g = 0; g < v.size(); ++g)
                        if (v[g]) std::fprintf(af, " %zu:%u", g, v[g]);
                    std::fprintf(af, "\n");
                }
                for (auto& [k, v] : app.unimplemented) std::fprintf(af, "nao implementado: %s %d\n", k.c_str(), v);
                if (app.dev.on) app.dev.write(app, af);
                if (pb::Frame* fr = app.frame()) {
                    std::map<std::string, int> count;
                    for (auto& o : fr->objects) count[o->def ? o->def->name : "?"]++;
                    std::vector<std::pair<int, std::string>> top;
                    for (auto& [n, k] : count) top.push_back({k, n});
                    std::sort(top.rbegin(), top.rend());
                    for (size_t i = 0; i < top.size() && i < 12; ++i)
                        std::fprintf(af, "objetos no fim: %s %d\n", top[i].second.c_str(), top[i].first);
                }
                std::fclose(af);
            }
        }
    }
    pb::flush_ini_files();
    pb::diag_close();
    screen.release();
    SDL_DestroyRenderer(ren);
    SDL_DestroyWindow(win);
    SDL_Quit();
    return 0;
}
```

## player/src/runtime/audio.cpp

```cpp
#define DR_WAV_IMPLEMENTATION
#define DR_MP3_IMPLEMENTATION
#include "runtime/audio.hpp"

#include <algorithm>
#include <cstdlib>
#include <cstring>

#include "dr_mp3.h"
#include "dr_wav.h"

namespace pb {

Audio::Audio(const Game& game) : game_(game) {
    if (SDL_InitSubSystem(SDL_INIT_AUDIO) != 0) {
        SDL_Log("PortBridge: sem áudio (%s)", SDL_GetError());
        return;
    }
    SDL_AudioSpec want{}, have{};
    want.freq = 44100;
    want.format = AUDIO_S16SYS;
    want.channels = 2;
    want.samples = 1024;
    want.callback = &Audio::callback;
    want.userdata = this;
    dev_ = SDL_OpenAudioDevice(nullptr, 0, &want, &have, 0);
    if (!dev_) {
        SDL_Log("PortBridge: falha ao abrir áudio (%s)", SDL_GetError());
        return;
    }
    rate_ = have.freq;
    SDL_PauseAudioDevice(dev_, 0);
    thread_ = std::thread([this] { worker(); });
}

Audio::~Audio() {
    {
        std::lock_guard<std::mutex> lk(qm_);
        quit_ = true;
    }
    qcv_.notify_all();
    if (thread_.joinable()) thread_.join();
    if (dev_) SDL_CloseAudioDevice(dev_);
}

// Acima disso o som é decodificado em segundo plano (MP3 de ~6 s ou mais).
static constexpr size_t kAsyncBytes = 96 * 1024;
// Sons longos decodificados que ficam na memória sem tocar (os mais antigos saem).
static constexpr size_t kKeepLong = 3;

void Audio::worker() {
    for (;;) {
        int handle;
        {
            std::unique_lock<std::mutex> lk(qm_);
            qcv_.wait(lk, [this] { return quit_ || !queue_.empty(); });
            if (quit_) return;
            handle = queue_.front();
            queue_.pop_front();
        }
        if (cached(handle)) continue;
        auto c = clip(handle, true);
        if (c) store(handle, c);
    }
}

std::shared_ptr<Audio::Clip> Audio::cached(int handle) {
    std::lock_guard<std::mutex> lk(m_);
    auto it = cache_.find(handle);
    return it == cache_.end() ? nullptr : it->second;
}

void Audio::store(int handle, std::shared_ptr<Clip> c) {
    std::lock_guard<std::mutex> lk(m_);
    cache_[handle] = c;
    // Limita a memória: só os kKeepLong sons longos mais recentes ficam
    // guardados quando não estão tocando (uma música pode ter dezenas de MB).
    if (c->pcm.size() * 2 < kAsyncBytes * 8) return;
    std::vector<int> idle;
    for (auto& [h, cl] : cache_)
        if (h != handle && cl->pcm.size() * 2 >= kAsyncBytes * 8 && cl.use_count() == 1) idle.push_back(h);
    while (idle.size() >= kKeepLong) {
        cache_.erase(idle.front());
        idle.erase(idle.begin());
    }
}

std::shared_ptr<Audio::Clip> Audio::clip(int handle, bool background) {
    auto si = game_.sounds.find(handle);
    if (si == game_.sounds.end()) return nullptr;
    Uint64 t0 = SDL_GetPerformanceCounter();
    const uint8_t* data = game_.buf.data() + si->second.offset;
    size_t size = si->second.size;
    auto c = std::make_shared<Clip>();
    unsigned channels = 0, rate = 0;
    if (size >= 12 && std::memcmp(data, "RIFF", 4) == 0) {
        drwav_uint64 frames = 0;
        drwav_int16* pcm = drwav_open_memory_and_read_pcm_frames_s16(data, size, &channels, &rate, &frames, nullptr);
        if (pcm) {
            c->pcm.resize(size_t(frames) * 2);
            for (drwav_uint64 i = 0; i < frames; ++i) {
                c->pcm[i * 2] = pcm[i * channels];
                c->pcm[i * 2 + 1] = pcm[i * channels + (channels > 1 ? 1 : 0)];
            }
            drwav_free(pcm, nullptr);
        }
    } else {
        drmp3_config cfg{};
        drmp3_uint64 frames = 0;
        drmp3_int16* pcm = drmp3_open_memory_and_read_pcm_frames_s16(data, size, &cfg, &frames, nullptr);
        if (pcm) {
            channels = cfg.channels;
            rate = cfg.sampleRate;
            c->pcm.resize(size_t(frames) * 2);
            for (drmp3_uint64 i = 0; i < frames; ++i) {
                c->pcm[i * 2] = pcm[i * channels];
                c->pcm[i * 2 + 1] = pcm[i * channels + (channels > 1 ? 1 : 0)];
            }
            drmp3_free(pcm, nullptr);
        }
    }
    c->rate = rate ? int(rate) : 44100;
    double ms = double(SDL_GetPerformanceCounter() - t0) * 1000.0 / double(SDL_GetPerformanceFrequency());
    std::lock_guard<std::mutex> lk(qm_);  // a thread de decodificação também passa aqui
    if (c->pcm.empty() && std::find(failed.begin(), failed.end(), handle) == failed.end()) failed.push_back(handle);
    if (background) {
        bg_decode_ms += ms;
        ++bg_decodes;
        if (ms > bg_worst_ms) { bg_worst_ms = ms; bg_worst = handle; }
    } else {
        decode_ms += ms;
        ++decodes;
        if (ms > worst_decode_ms) { worst_decode_ms = ms; worst_decode = handle; }
    }
    return c;
}

void Audio::play(int handle, int channel, int loops) {
    if (!dev_) return;
    auto c = cached(handle);
    bool wait = false;
    if (!c) {
        auto si = game_.sounds.find(handle);
        if (si == game_.sounds.end()) return;
        if (si->second.size <= kAsyncBytes) {
            c = clip(handle);  // efeito curto: decodifica na hora (rápido)
            if (c) store(handle, c);
        } else {
            wait = true;  // música: decodifica em segundo plano e começa quando estiver pronta
            {
                std::lock_guard<std::mutex> lk(qm_);
                queue_.push_back(handle);
            }
            qcv_.notify_one();
        }
    }
    if (!wait && (!c || c->pcm.empty())) return;
    std::lock_guard<std::mutex> lk(m_);
    int idx = channel - 1;
    if (channel <= 0 || channel > kChannels) {
        idx = -1;
        for (int i = kChannels - 1; i >= 0; --i)  // canais altos para "qualquer"
            if (!ch_[i].active) { idx = i; break; }
        if (idx < 0) idx = kChannels - 1;
    }
    Chan& ch = ch_[idx];
    ch.clip = c;
    ch.handle = handle;
    ch.pos = 0;
    ch.loops_left = loops;
    ch.paused = false;
    ch.active = true;
    ch.waiting = wait;
}

void Audio::stop_channel(int c) {
    std::lock_guard<std::mutex> lk(m_);
    if (c >= 1 && c <= kChannels) { ch_[c - 1].active = false; ch_[c - 1].clip.reset(); }
}
void Audio::stop_sound(int h) {
    std::lock_guard<std::mutex> lk(m_);
    for (auto& ch : ch_)
        if (ch.handle == h) { ch.active = false; ch.clip.reset(); }
}
void Audio::stop_all() {
    std::lock_guard<std::mutex> lk(m_);
    for (auto& ch : ch_) { ch.active = false; ch.clip.reset(); }
}
void Audio::pause_channel(int c, bool p) {
    std::lock_guard<std::mutex> lk(m_);
    if (c >= 1 && c <= kChannels) ch_[c - 1].paused = p;
}
void Audio::pause_all(bool p) {
    std::lock_guard<std::mutex> lk(m_);
    for (auto& ch : ch_) ch.paused = p;
}
void Audio::set_channel_volume(int c, int v) {
    std::lock_guard<std::mutex> lk(m_);
    if (c >= 1 && c <= kChannels) ch_[c - 1].volume = std::clamp(v, 0, 100);
}
void Audio::set_channel_frequency(int c, int hz) {
    std::lock_guard<std::mutex> lk(m_);
    if (c >= 1 && c <= kChannels) ch_[c - 1].freq = std::max(0, hz);
}
bool Audio::sound_playing(int h) {
    std::lock_guard<std::mutex> lk(m_);
    for (auto& ch : ch_)
        if (ch.active && ch.handle == h) return true;
    return false;
}
bool Audio::channel_playing(int c) {
    std::lock_guard<std::mutex> lk(m_);
    return c >= 1 && c <= kChannels && ch_[c - 1].active;
}
bool Audio::channel_paused(int c) {
    std::lock_guard<std::mutex> lk(m_);
    return c >= 1 && c <= kChannels && ch_[c - 1].active && ch_[c - 1].paused;
}
bool Audio::any_playing() {
    std::lock_guard<std::mutex> lk(m_);
    for (auto& ch : ch_)
        if (ch.active) return true;
    return false;
}

void Audio::callback(void* self, Uint8* stream, int len) {
    static_cast<Audio*>(self)->mix(reinterpret_cast<int16_t*>(stream), len / 4);
}

void Audio::mix(int16_t* out, int frames) {
    std::vector<int32_t> acc(size_t(frames) * 2, 0);
    {
        std::lock_guard<std::mutex> lk(m_);
        for (auto& ch : ch_) {
            if (ch.active && ch.waiting) {  // decodificação terminou?
                auto it = cache_.find(ch.handle);
                if (it != cache_.end()) {
                    ch.clip = it->second;
                    ch.waiting = false;
                    if (ch.clip->pcm.empty()) ch.active = false;
                }
            }
            if (!ch.active || ch.paused || !ch.clip) continue;
            const auto& pcm = ch.clip->pcm;
            size_t n = pcm.size() / 2;
            double step = double(ch.freq > 0 ? ch.freq : ch.clip->rate) / rate_;
            int vol = ch.volume;
            for (int i = 0; i < frames; ++i) {
                size_t k = size_t(ch.pos);
                if (k >= n) {
                    if (ch.loops_left == 1) { ch.active = false; ch.clip.reset(); break; }
                    if (ch.loops_left > 1) --ch.loops_left;
                    ch.pos -= double(n);
                    k = size_t(ch.pos);
                    if (k >= n) { ch.pos = 0; k = 0; }
                }
                acc[size_t(i) * 2] += pcm[k * 2] * vol / 100;
                acc[size_t(i) * 2 + 1] += pcm[k * 2 + 1] * vol / 100;
                ch.pos += step;
            }
        }
    }
    for (size_t i = 0; i < acc.size(); ++i)
        out[i] = muted_ ? 0 : int16_t(std::clamp<int32_t>(acc[i], -32768, 32767));
}

}  // namespace pb
```

## player/src/runtime/audio.hpp

```cpp
// Mixer de áudio com canais no estilo Clickteam (canais 1..N, volume, frequência, loop).
#pragma once
#include <SDL.h>

#include <condition_variable>
#include <deque>
#include <memory>
#include <mutex>
#include <thread>
#include <unordered_map>
#include <vector>

#include "core/game.hpp"

namespace pb {

class Audio {
public:
    // Custo de decodificar sons (relatório de auditoria).
    // no passo do jogo (efeitos curtos) e na thread de fundo (músicas)
    double decode_ms = 0, worst_decode_ms = 0, bg_decode_ms = 0, bg_worst_ms = 0;
    int decodes = 0, worst_decode = -1, bg_decodes = 0, bg_worst = -1;
    std::vector<int> failed;  // sons que não decodificaram (modo desenvolvedor)
    explicit Audio(const Game& game);
    ~Audio();
    bool ok() const { return dev_ != 0; }

    // canal: 1..kChannels, ou -1 para "qualquer livre". loops: 0 = infinito.
    void play(int sound_handle, int channel, int loops);
    void stop_channel(int ch);
    void stop_sound(int sound_handle);
    void stop_all();
    void pause_channel(int ch, bool pause);
    void pause_all(bool pause);
    void set_channel_volume(int ch, int volume);
    void set_channel_frequency(int ch, int hz);
    bool sound_playing(int sound_handle);
    bool channel_playing(int ch);
    bool channel_paused(int ch);
    bool any_playing();
    void set_muted(bool m) { muted_ = m; }

    static constexpr int kChannels = 48;

private:
    struct Clip {
        std::vector<int16_t> pcm;  // estéreo intercalado
        int rate = 44100;
    };
    struct Chan {
        std::shared_ptr<Clip> clip;
        int handle = -1;
        double pos = 0;
        int loops_left = 1;  // 0 = infinito
        bool paused = false, active = false;
        bool waiting = false;  // som longo sendo decodificado em segundo plano
        int volume = 100, freq = 0;
    };
    std::shared_ptr<Clip> clip(int handle, bool background = false);  // decodifica (sem trava do mixer)
    std::shared_ptr<Clip> cached(int handle);  // só o que já está pronto
    void worker();
    void store(int handle, std::shared_ptr<Clip> c);
    static void callback(void* self, Uint8* stream, int len);
    void mix(int16_t* out, int frames);

    const Game& game_;
    SDL_AudioDeviceID dev_ = 0;
    int rate_ = 44100;
    std::mutex m_;
    Chan ch_[kChannels];
    std::unordered_map<int, std::shared_ptr<Clip>> cache_;
    bool muted_ = false;
    // Sons longos (músicas) são decodificados numa thread: decodificar um MP3
    // inteiro no passo do jogo travava a tela (68 ms no PC, bem mais no celular).
    std::mutex qm_;
    std::condition_variable qcv_;
    std::deque<int> queue_;
    bool quit_ = false;
    std::thread thread_;
};

}  // namespace pb
```

## player/src/runtime/devcheck.cpp

```cpp
#include "runtime/devcheck.hpp"

#include <algorithm>
#include <cmath>

#include "runtime/runtime.hpp"

namespace pb {

void DevCheck::report(App& app, const char* category, const std::string& detail) {
    if (!on) return;
    std::string key = std::string(category) + "|" + detail;
    DevIssue& d = issues_[key];
    if (d.count++ == 0) {
        d.category = category;
        d.detail = detail;
        if (Frame* f = app.frame()) {
            d.frame = f->index;
            d.loop = f->loop;
        }
        SDL_Log("dev: %s: %s", category, detail.c_str());
    }
}

namespace {
std::string obj_name(const Obj& o) { return o.def ? o.def->name : "oi " + std::to_string(o.oi); }
}  // namespace

void DevCheck::after_step(App& app) {
    if (!on) return;
    Frame* f = app.frame();
    if (!f) return;
    ++steps_;
    const double fw = f->width, fh = f->height;
    for (auto& up : f->objects) {
        Obj& o = *up;
        if (o.destroyed) continue;
        const std::string name = obj_name(o);
        if (!std::isfinite(o.x) || !std::isfinite(o.y) || !std::isfinite(o.scale_x) || !std::isfinite(o.scale_y) ||
            !std::isfinite(o.angle))
            report(app, "posição ou escala inválida (NaN/inf)", name);
        if (o.type == OBJ_ACTIVE && o.def && o.visible && !o.def->anims.empty()) {
            if (o.image < 0) report(app, "objeto visível sem imagem", name + " anim " + std::to_string(o.anim));
            else if (!app.image(o.image)) report(app, "imagem inexistente", name + " imagem " + std::to_string(o.image));
            const uint32_t ink = o.def->ink_effect & 0xFFF;  // 0x1000 = filtro RGBA, não é um efeito
            if (ink != 0 && ink != 1 && ink != 9)
                report(app, "efeito de tinta não suportado (desenhado como normal)", name + " efeito " + std::to_string(ink));
            if (std::fabs(o.scale_x) > 60 || std::fabs(o.scale_y) > 60)
                report(app, "escala exagerada", name);
        }
        if (o.type == OBJ_COUNTER && !std::isfinite(o.counter)) report(app, "contador inválido (NaN/inf)", name);
        // Longe do frame (mais de 2 telas além da borda) por mais de 10 s: o objeto
        // se perdeu (todos os objetos do Zorbié têm "não destruir longe").
        const bool far = o.x < -2 * fw || o.x > 3 * fw || o.y < -2 * fh || o.y > 3 * fh;
        if (far) {
            auto [it, fresh] = far_since_.try_emplace(&o, f->loop);
            if (!fresh && f->loop - it->second == 600)
                report(app, "objeto perdido longe do frame (mais de 10 s)", name);
        } else {
            far_since_.erase(&o);
        }
    }
    if (steps_ % 600 == 0) {  // a cada 10 s de jogo
        std::map<std::string, int> n;
        for (auto& up : f->objects)
            if (!up->destroyed) ++n[obj_name(*up)];
        auto& per = counts_[f->index];
        for (auto& [k, v] : per) v.push_back(n.count(k) ? n[k] : 0);
        for (auto& [k, c] : n)
            if (!per.count(k)) per[k] = std::vector<int>{c};
        // ponteiros de objetos destruídos não valem mais
        for (auto it = far_since_.begin(); it != far_since_.end();) {
            bool alive = false;
            for (auto& up : f->objects) if (up.get() == it->first) { alive = true; break; }
            it = alive ? std::next(it) : far_since_.erase(it);
        }
    }
}

void DevCheck::write(App& app, FILE* out) const {
    std::vector<const DevIssue*> list;
    for (auto& [k, d] : issues_) list.push_back(&d);
    std::sort(list.begin(), list.end(), [](const DevIssue* a, const DevIssue* b) {
        return a->category != b->category ? a->category < b->category : a->count > b->count;
    });
    // Avisos: comportamentos que o runtime original também tem (o jogo depende
    // deles) e que só valem atenção se algo parecer errado na tela.
    auto is_warning = [](const std::string& cat) {
        return cat.find("objeto sem instância") != std::string::npos || cat.find("por zero") != std::string::npos ||
               cat == "movimento inexistente" || cat == "grupo achado só pelo id";
    };
    int fails = 0;
    for (const DevIssue* d : list) fails += !is_warning(d->category);
    std::fprintf(out, "modo desenvolvedor: %d falhas e %zu avisos distintos\n", fails, list.size() - size_t(fails));
    for (int pass = 0; pass < 2; ++pass)
        for (const DevIssue* d : list)
            if (is_warning(d->category) == (pass == 1))
                std::fprintf(out, "  %s [%s] %s  (x%lld, primeira: frame %d passo %lld)\n", pass ? "aviso" : "FALHA",
                             d->category.c_str(), d->detail.c_str(), d->count, d->frame, d->loop);
    // Objetos que só crescem: a contagem subiu em quase todas as amostras.
    for (auto& [fi, per] : counts_) {
        for (auto& [name, v] : per) {
            if (v.size() < 6) continue;
            int ups = 0;
            for (size_t i = 1; i < v.size(); ++i) ups += v[i] > v[i - 1];
            if (ups * 10 >= int(v.size() - 1) * 8 && v.back() >= 40)
                std::fprintf(out, "  FALHA [objetos que se acumulam] frame %d %s: %d -> %d\n", fi, name.c_str(), v.front(),
                             v.back());
        }
    }
    // Cobertura: grupos com ações que nunca dispararam (mecanismos que o teste não alcançou).
    for (auto& [fi, fired] : app.audit.fired) {
        if (fi < 0 || fi >= int(app.game().frames.size())) continue;
        const auto& groups = app.game().frames[size_t(fi)].events.groups;
        int with_actions = 0, ran = 0;
        for (size_t gi = 0; gi < groups.size(); ++gi) {
            if (groups[gi].actions.empty()) continue;
            bool marker = !groups[gi].conditions.empty() && groups[gi].conditions[0].type == -1 &&
                          (groups[gi].conditions[0].num == -10 || groups[gi].conditions[0].num == -11);
            if (marker) continue;
            ++with_actions;
            if (gi < fired.size() && fired[gi] > 0) ++ran;
        }
        std::fprintf(out, "  info [cobertura] frame %d: %d de %d eventos com ações rodaram (%.0f%%)\n", fi, ran, with_actions,
                     with_actions ? 100.0 * ran / with_actions : 0.0);
    }
}

}  // namespace pb
```

## player/src/runtime/devcheck.hpp

```cpp
// Modo desenvolvedor (--dev / PB_DEV=1): confere o jogo a cada passo e anota
// falhas visíveis (objeto sem imagem, animação ou quadro inexistente, posição
// inválida, imagem ou som que não decodifica) e invisíveis (expressão sobre
// objeto que não existe, divisão por zero, valor alterável fora do limite,
// movimento ou frame inválido, ponteiro de grupo sem alvo, objetos que se
// acumulam ou se perdem longe do frame, grupos que nunca rodaram).
#pragma once

#include <cstdio>
#include <map>
#include <string>
#include <vector>

namespace pb {

class App;
struct Obj;

struct DevIssue {
    std::string category, detail;
    int frame = -1;
    long long loop = -1;
    long long count = 0;
};

class DevCheck {
public:
    bool on = false;

    // Anota uma ocorrência (agrupa por categoria + detalhe; guarda a primeira).
    void report(App& app, const char* category, const std::string& detail);
    // Conferências por passo (chamado depois de cada passo do frame).
    void after_step(App& app);
    // Relatório final.
    void write(App& app, FILE* out) const;

private:
    std::map<std::string, DevIssue> issues_;
    // contagem de instâncias por objeto, amostrada a cada 10 s de jogo
    std::map<int, std::map<std::string, std::vector<int>>> counts_;
    std::map<const Obj*, long long> far_since_;  // objetos longe do frame desde o passo N
    long long steps_ = 0;
};

}  // namespace pb
```

## player/src/runtime/diag.cpp

```cpp
#include "runtime/diag.hpp"

#include <SDL.h>

#include <csignal>
#include <cstdio>
#include <cstring>
#include <ctime>

#if !defined(_WIN32)
#include <fcntl.h>
#include <unistd.h>
#endif

namespace pb {

DiagContext g_diag;

namespace {

FILE* g_log = nullptr;
int g_fd = -1;
SDL_LogOutputFunction g_prev_out = nullptr;
void* g_prev_data = nullptr;

void log_out(void* userdata, int category, SDL_LogPriority prio, const char* msg) {
    if (g_log) {
        std::fprintf(g_log, "[%6u] %s\n", unsigned(SDL_GetTicks()), msg);
        std::fflush(g_log);
    }
    if (g_prev_out) g_prev_out(g_prev_data, category, prio, msg);
    (void)userdata;
}

#if !defined(_WIN32)
struct sigaction g_old[32];

void put(const char* s) {
    if (g_fd >= 0) {
        ssize_t r = write(g_fd, s, std::strlen(s));
        (void)r;
    }
}

void put_int(long v) {
    char b[24];
    int i = 23;
    b[i] = 0;
    bool neg = v < 0;
    unsigned long u = neg ? 0UL - (unsigned long)v : (unsigned long)v;
    do { b[--i] = char('0' + u % 10); u /= 10; } while (u && i > 1);
    if (neg) b[--i] = '-';
    put(b + i);
}

void on_signal(int sig, siginfo_t* info, void* ctx) {
    const char* name = sig == SIGSEGV ? "SIGSEGV" : sig == SIGBUS ? "SIGBUS" : sig == SIGFPE ? "SIGFPE"
                       : sig == SIGILL ? "SIGILL" : sig == SIGABRT ? "SIGABRT" : "sinal";
    put("TRAVAMENTO: ");
    put(name);
    put(" durante '");
    put(g_diag.stage);
    put("' frame=");
    put_int(g_diag.frame);
    put(" loop=");
    put_int(g_diag.loop);
    put(" grupo=");
    put_int(g_diag.group);
    put("\n");
    // devolve ao tratador anterior (no Android, o debuggerd gera o tombstone)
    struct sigaction& old = g_old[sig];
    sigaction(sig, &old, nullptr);
    if (old.sa_flags & SA_SIGINFO) {
        if (old.sa_sigaction) old.sa_sigaction(sig, info, ctx);
    } else if (old.sa_handler != SIG_DFL && old.sa_handler != SIG_IGN && old.sa_handler) {
        old.sa_handler(sig);
    } else {
        raise(sig);
    }
}
#endif

}  // namespace

void diag_open(const std::string& path, const std::string& device) {
    if (!path.empty()) {
        g_log = std::fopen(path.c_str(), "w");
#if !defined(_WIN32)
        if (g_log) g_fd = fileno(g_log);
#endif
    }
    SDL_LogGetOutputFunction(&g_prev_out, &g_prev_data);
    SDL_LogSetOutputFunction(log_out, nullptr);
    SDL_version v;
    SDL_GetVersion(&v);
    std::time_t t = std::time(nullptr);
    char when[64];
    std::strftime(when, sizeof when, "%Y-%m-%d %H:%M:%S", std::localtime(&t));
    SDL_Log("PortBridge runtime 0.2 | SDL %d.%d.%d | %s | %s", v.major, v.minor, v.patch,
            SDL_GetPlatform(), when);
    if (!device.empty()) SDL_Log("aparelho: %s", device.c_str());
#if !defined(_WIN32)
    for (int sig : {SIGSEGV, SIGBUS, SIGFPE, SIGILL, SIGABRT}) {
        struct sigaction sa {};
        sa.sa_sigaction = on_signal;
        sa.sa_flags = SA_SIGINFO | SA_ONSTACK;
        sigemptyset(&sa.sa_mask);
        sigaction(sig, &sa, &g_old[sig]);
    }
#endif
}

void diag_fatal(const std::string& msg) {
    SDL_Log("ERRO: %s", msg.c_str());
    SDL_ShowSimpleMessageBox(SDL_MESSAGEBOX_ERROR, "PortBridge", msg.c_str(), nullptr);
}

void diag_close() {
    SDL_Log("SAIDA NORMAL");
    if (g_log) {
        std::fclose(g_log);
        g_log = nullptr;
        g_fd = -1;
    }
}

}  // namespace pb
```

## player/src/runtime/diag.hpp

```cpp
// Diagnóstico: log em arquivo e registro de travamentos (para depurar em aparelhos reais).
#pragma once
#include <string>

namespace pb {

// Onde o runtime estava (atualizado a cada loop; lido pelo tratador de sinais).
struct DiagContext {
    volatile int frame = -1;
    volatile long loop = 0;
    volatile int group = -1;
    const char* volatile stage = "início";
};
extern DiagContext g_diag;

// Abre o log (sobrescreve) e instala os tratadores de travamento.
void diag_open(const std::string& path, const std::string& device);
// Registra um erro fatal ("ERRO: ...") e mostra uma mensagem na tela.
void diag_fatal(const std::string& msg);
void diag_close();

}  // namespace pb
```

## player/src/runtime/events.cpp

```cpp
// Interpretador de eventos Clickteam.
//
// A cada loop os grupos de eventos são avaliados em ordem. Condições sobre objetos
// filtram a "seleção" de instâncias; as ações seguintes valem só para as instâncias
// selecionadas (ou para todas, se o objeto não apareceu nas condições).
#include <algorithm>
#include <cmath>
#include <cstdlib>

#include "core/names.hpp"
#include "runtime/audio.hpp"
#include "runtime/diag.hpp"
#include "runtime/runtime.hpp"

namespace pb {
namespace {

constexpr double kPi = 3.14159265358979323846;

int param_int(EvalContext& c, const Param& p) {
    if (!p.expr.empty()) return eval_expr(c, p.expr).as_int();
    return p.i0;
}

Value param_value(EvalContext& c, const Param& p) {
    if (!p.expr.empty()) return eval_expr(c, p.expr);
    if (!p.str.empty()) return Value(p.str);
    return Value(p.i0);
}

bool cmp_param(EvalContext& c, const Param& p, const Value& lhs) {
    return compare(lhs, p.comparison, eval_expr(c, p.expr));
}

uint32_t colorref_to_rgb(uint32_t c) {
    return ((c & 0xFF) << 16) | (c & 0xFF00) | ((c >> 16) & 0xFF);
}

const Param* P(const EventItem& it, size_t i) { return i < it.params.size() ? &it.params[i] : nullptr; }

bool in_zone(double x, double y, const Param& z) {
    return x >= z.i0 && x < z.i2 && y >= z.i1 && y < z.comparison;
}

// Filtra as instâncias de `it.oi` com um predicado (respeitando "NOT").
// Com "NOT" e nenhuma instância (o objeto não existe), a condição é verdadeira,
// como no Clickteam: nenhum objeto satisfaz a condição positiva. Ex.: na loja do
// Zorbié, "NOT descrição sobrepondo o botão" com a descrição ainda inexistente
// precisa ser verdadeiro para o item poder ser escolhido (senão a loja trava).
template <class Pred>
bool filter(EvalContext& c, const EventItem& it, Pred pred) {
    bool any = false;
    for (int oi : c.f.expand_oi(it.oi)) {
        std::vector<Obj*> cand;
        if (c.s.touched.count(oi)) cand = c.s.sel[oi];
        else cand = c.f.instances(oi);
        std::vector<Obj*> kept;
        bool live = false;
        for (Obj* o : cand) {
            if (o->destroyed) continue;
            live = true;
            c.current = o;
            c.current_oi = oi;
            bool r = pred(o);
            if (it.negated()) r = !r;
            if (r) kept.push_back(o);
        }
        any |= !kept.empty() || (it.negated() && !live);
        c.s.sel[oi] = std::move(kept);
        c.s.touched.insert(oi);
    }
    c.current = nullptr;
    c.current_oi = -1;
    return any;
}

// Condições de colisão: seleciona os dois lados.
bool collision(EvalContext& c, const EventItem& it, int gi, bool edge) {
    const Param* p = P(it, 0);
    if (!p) return false;
    App& app = c.f.app;
    auto others = targets(c, p->oi);
    std::vector<Obj*> other_kept;
    auto& st = c.f.event_state[size_t(gi)];
    (void)st;
    bool any = false;
    for (int oi : c.f.expand_oi(it.oi)) {
        std::vector<Obj*> cand = c.s.touched.count(oi) ? c.s.sel[oi] : c.f.instances(oi);
        std::vector<Obj*> kept;
        bool live = false;
        for (Obj* a : cand) {
            if (a->destroyed) continue;
            live = true;
            bool hit = false;
            for (Obj* b : others) {
                if (b == a || b->destroyed) continue;
                if (!overlap(app, *a, *b)) continue;
                if (edge) {
                    bool moved = a->x != a->prev_x || a->y != a->prev_y || b->x != b->prev_x ||
                                 b->y != b->prev_y;
                    if (!moved) continue;
                }
                hit = true;
                if (!it.negated() &&
                    std::find(other_kept.begin(), other_kept.end(), b) == other_kept.end())
                    other_kept.push_back(b);
            }
            if (it.negated()) hit = !hit;
            if (hit) kept.push_back(a);
        }
        any |= !kept.empty() || (it.negated() && !live);  // NOT sem instâncias: verdadeiro
        c.s.sel[oi] = std::move(kept);
        c.s.touched.insert(oi);
    }
    if (any && !it.negated()) {
        for (int oi : c.f.expand_oi(p->oi)) {
            std::vector<Obj*> v;
            for (Obj* b : other_kept)
                if (b->oi == oi) v.push_back(b);
            c.s.sel[oi] = v;
            c.s.touched.insert(oi);
        }
    }
    return any;
}

bool mouse_over(App& app, Obj* o) {
    Frame* f = app.frame();
    double ox = 0, oy = 0;
    f->layer_offset(o->layer, ox, oy);   // mesma posição em que o objeto é desenhado
    double mx = app.input.mouse_x + ox, my = app.input.mouse_y + oy;
    if (!o->visible) return false;
    Rect r = obj_rect(app, *o);
    return mx >= r.x1 && mx < r.x2 && my >= r.y1 && my < r.y2;
}

// "Mouse sobre X" / "X clicado": verdadeiro se o ponteiro está sobre alguma instância.
// Com NOT, verdadeiro se não está sobre nenhuma (mesmo quando X não existe).
bool mouse_objects(EvalContext& c, const EventItem& it, int oi, bool gate) {
    std::vector<Obj*> hit;
    if (gate)
        for (Obj* o : targets(c, oi))
            if (mouse_over(c.f.app, o)) hit.push_back(o);
    if (it.negated()) return hit.empty();
    if (hit.empty()) return false;
    for (int m : c.f.expand_oi(oi)) {
        std::vector<Obj*> v;
        for (Obj* o : hit) if (o->oi == m) v.push_back(o);
        c.s.sel[m] = v;
        c.s.touched.insert(m);
    }
    return true;
}

int click_button(int b) { return b == 1 ? 2 : b == 2 ? 1 : 0; }  // 0 esq., 1 meio, 2 dir. -> SDL

bool condition(EvalContext& c, const EventItem& it, int gi) {
    Frame& f = c.f;
    App& app = f.app;
    EventState& st = f.event_state[size_t(gi)];
    auto neg = [&](bool v) { return it.negated() ? !v : v; };
    const Param* p0 = P(it, 0);
    const Param* p1 = P(it, 1);

    switch (it.type) {
        case OBJ_SYSTEM:
            switch (it.num) {
                case -1: return neg(true);
                case -2: return neg(false);
                case -3: return p0 && p1 && neg(cmp_param(c, *p1, param_value(c, *p0)));
                case -4: {  // restringir ações por X
                    uint32_t t = p0 ? uint32_t(param_int(c, *p0)) : 0;
                    if (f.timer_ms - st.restrict_last >= t || st.restrict_last == 0) {
                        st.restrict_last = f.timer_ms;
                        return true;
                    }
                    return false;
                }
                case -5: {  // repetir N vezes
                    int n = p0 ? param_int(c, *p0) : 1;
                    if (st.repeat_count < n) { ++st.repeat_count; return true; }
                    return false;
                }
                case -6:
                    if (!st.once_done) { st.once_done = true; return true; }
                    return false;
                case -7: {
                    bool r = st.not_always_stamp != f.loop - 1;
                    st.not_always_stamp = f.loop;
                    return r;
                }
                case -8: {
                    if (!p0 || !p1) return false;
                    size_t idx = size_t(param_int(c, *p0));
                    Value v = idx < app.global_values.size() ? app.global_values[idx] : Value(0);
                    return neg(cmp_param(c, *p1, v));
                }
                case -9: case -10: case -11: case -24: case -25: return true;
                case -20: {
                    if (!p0 || !p1) return false;
                    size_t idx = size_t(param_int(c, *p0));
                    std::string v = idx < app.global_strings.size() ? app.global_strings[idx] : "";
                    return neg(cmp_param(c, *p1, Value(v)));
                }
                case -26: {
                    int pct = p0 ? param_int(c, *p0) : 50;
                    return neg(int(app.rng()() % 100) < pct);
                }
                default: break;
            }
            break;
        case OBJ_SOUND: {
            Audio* au = app.audio();
            switch (it.num) {
                case -1: return neg(!(au && p0 && au->sound_playing(p0->i0)));
                case -3: return neg(!(au && au->any_playing()));
                case -8: return neg(!(au && p0 && au->channel_playing(param_int(c, *p0))));
                case -9: return neg(au && p0 && au->channel_paused(param_int(c, *p0)));
                default: break;
            }
            break;
        }
        case OBJ_GAME:
            switch (it.num) {
                case -1: return neg(f.loop == 1);
                case -2: return neg(false);
                case -8: return neg(app.resumed_flag);
                default: break;
            }
            break;
        case OBJ_TIMER: {
            uint32_t t = p0 ? uint32_t(param_int(c, *p0)) : 0;
            switch (it.num) {
                case -1: return neg(f.timer_ms > t);
                case -2: return neg(f.timer_ms < t);
                case -3:
                    if (!st.timer_equals_done && f.timer_ms >= t) { st.timer_equals_done = true; return true; }
                    return false;
                case -4: case -8:
                    if (t == 0) return true;
                    if (f.timer_ms - st.every_last >= t) {
                        st.every_last += t * ((f.timer_ms - st.every_last) / t);
                        return true;
                    }
                    return false;
                default: break;
            }
            break;
        }
        case OBJ_KEYBOARD: {
            auto& in = app.input;
            switch (it.num) {
                case -1: case -2: return neg(false);  // teclado: não há no celular
                case -3: {
                    double mx = in.mouse_x + f.scroll_x, my = in.mouse_y + f.scroll_y;
                    return p0 && neg(in_zone(mx, my, *p0));
                }
                case -4: return p0 && mouse_objects(c, it, p0->oi, true);
                case -5: {
                    int b = p0 ? click_button(p0->i0) : 0;
                    bool dbl = p0 && p0->i1;
                    return neg(in.clicked[b] && (!dbl || in.dbl[b]));
                }
                case -6: {
                    int b = p0 ? click_button(p0->i0) : 0;
                    double mx = in.mouse_x + f.scroll_x, my = in.mouse_y + f.scroll_y;
                    return p1 && neg(in.clicked[b] && in_zone(mx, my, *p1));
                }
                case -7: {
                    int b = p0 ? click_button(p0->i0) : 0;
                    return p1 && mouse_objects(c, it, p1->oi, in.clicked[b]);
                }
                case -8: {
                    int key = p0 ? p0->i0 : 1;
                    bool down = key == 2 ? in.down[2] : key == 4 ? in.down[1] : in.down[0];
                    return neg(down);
                }
                default: break;
            }
            break;
        }
        default: break;
    }

    if (it.type >= OBJ_EXTENSION_BASE && it.num <= -80) {
        bool handled = false;
        bool any = false, called = false;
        for (int oi : f.expand_oi(it.oi)) {
            for (Obj* o : f.instances(oi)) {
                called = true;
                any |= ext_condition(c, it, o, handled);
            }
        }
        if (!called) any = ext_condition(c, it, nullptr, handled);
        if (!handled) app.note_unimplemented(item_name(ItemKind::Condition, it.type, it.num));
        return neg(any);
    }

    if (it.type >= 0) {
        switch (it.num) {
            case -1: return p0 && filter(c, it, [&](Obj* o) { return cmp_param(c, *p0, Value(o->frame)); });
            case -2: {
                int a = p0 ? param_int(c, *p0) : 0;
                return filter(c, it, [&](Obj* o) { return o->anim_finished == a; });
            }
            case -3: {
                int a = p0 ? param_int(c, *p0) : 0;
                // Uma animação com repetições finitas deixa de "tocar" quando termina.
                return filter(c, it, [&](Obj* o) { return o->anim == a && !o->anim_stopped && !o->anim_done; });
            }
            case -4: return collision(c, it, gi, false);
            case -14: return collision(c, it, gi, true);
            case -7: return filter(c, it, [&](Obj* o) { return o->speed() == 0; });
            case -8: {
                uint32_t mask = p0 ? uint32_t(p0->expr.empty() ? p0->i0 : (1u << (param_int(c, *p0) & 31))) : 0;
                return filter(c, it, [&](Obj* o) { return (mask >> (o->dir & 31)) & 1; });
            }
            case -15: return p0 && filter(c, it, [&](Obj* o) { return cmp_param(c, *p0, Value(o->speed())); });
            case -16: return p0 && filter(c, it, [&](Obj* o) { return cmp_param(c, *p0, Value(int64_t(std::floor(o->y)))); });
            case -17: return p0 && filter(c, it, [&](Obj* o) { return cmp_param(c, *p0, Value(int64_t(std::floor(o->x)))); });
            case -21: return filter(c, it, [&](Obj* o) { return o->mv() && o->mv()->finished(); });
            case -24: case -25: {
                int bit = p0 ? param_int(c, *p0) : 0;
                bool want = it.num == -25;
                return filter(c, it, [&](Obj* o) { return bool((o->flags >> (bit & 31)) & 1) == want; });
            }
            case -27: {
                if (!p0 || !p1) return false;
                size_t idx = size_t(param_int(c, *p0));
                return filter(c, it, [&](Obj* o) {
                    Value v = idx < o->values.size() ? o->values[idx] : Value(0);
                    return cmp_param(c, *p1, v);
                });
            }
            case -28: return filter(c, it, [&](Obj* o) { return !o->visible; });
            case -29: return filter(c, it, [&](Obj* o) { return o->visible; });
            case -30: case -31: {
                if (!p0) return false;
                std::vector<Obj*> inside;
                for (Obj* o : targets(c, it.oi))
                    if (in_zone(o->x, o->y, *p0)) inside.push_back(o);
                if (it.num == -31) return neg(inside.empty());
                bool ok = p1 ? cmp_param(c, *p1, Value(int64_t(inside.size()))) : !inside.empty();
                if (!neg(ok)) return false;
                for (int oi : f.expand_oi(it.oi)) {
                    std::vector<Obj*> v;
                    for (Obj* o : inside) if (o->oi == oi) v.push_back(o);
                    c.s.sel[oi] = v;
                    c.s.touched.insert(oi);
                }
                return true;
            }
            case -32: {
                if (!p0) return false;
                int64_t n = 0;
                for (int oi : f.expand_oi(it.oi)) n += int64_t(f.instances(oi).size());
                return neg(cmp_param(c, *p0, Value(n)));
            }
            case -34: {
                auto t = targets(c, it.oi);
                if (t.empty()) return false;
                Obj* pick = t[app.rng()() % t.size()];
                for (int oi : f.expand_oi(it.oi)) {
                    c.s.sel[oi] = pick->oi == oi ? std::vector<Obj*>{pick} : std::vector<Obj*>{};
                    c.s.touched.insert(oi);
                }
                return true;
            }
            case -81:
                if (it.type == OBJ_COUNTER || it.type == OBJ_SCORE || it.type == OBJ_LIVES ||
                    (it.oi & 0x8000))
                    return p0 && filter(c, it, [&](Obj* o) {
                        double v = o->counter;
                        return cmp_param(c, *p0, std::floor(v) == v ? Value(int64_t(v)) : Value(v));
                    });
                break;
            default: break;
        }
    }
    app.note_unimplemented(item_name(ItemKind::Condition, it.type, it.num));
    return false;
}

// ---------------------------------------------------------------- posições
struct Pos { double x, y; int layer; int dir; Obj* parent; };

std::vector<Pos> resolve_position(EvalContext& c, const PositionParam& p) {
    std::vector<Pos> out;
    int layer = p.layer;
    if (p.type_parent == 0 || p.oi_parent == 0xFFFF) {
        out.push_back({double(p.x), double(p.y), layer < 0 ? 0 : layer, p.direction & 31, nullptr});
        return out;
    }
    for (Obj* par : targets(c, p.oi_parent)) {
        double dx = p.x, dy = p.y;
        if (p.flags & 1) {  // relativo à direção do pai
            double a = par->dir * kPi / 16.0;
            double rx = dx * std::cos(a) + dy * std::sin(a);
            double ry = -dx * std::sin(a) + dy * std::cos(a);
            dx = rx;
            dy = ry;
        }
        double bx = par->x, by = par->y;
        if (p.flags & 2) {  // ponto de ação do pai
            if (const ImageInfo* im = par->image >= 0 ? c.f.app.image(par->image) : nullptr) {
                bx += (im->act_x - im->hot_x) * par->scale_x;
                by += (im->act_y - im->hot_y) * par->scale_y;
            }
        }
        int dir = (p.flags & 4) ? par->dir : (p.direction & 31);
        // relativo a um objeto: nasce na camada do objeto-pai (o valor de camada
        // gravado no parâmetro vale só para posições relativas ao frame)
        out.push_back({bx + dx, by + dy, par->layer, dir, par});
    }
    return out;
}

int direction_param(EvalContext& c, const Param& p) {
    if (!p.expr.empty()) return param_int(c, p) & 31;
    return dir_from_mask(c.f.app, uint32_t(p.i0));
}

void set_alterable(Obj* o, size_t idx, const Value& v, int mode) {
    if (idx >= o->values.size()) o->values.resize(idx + 1);
    Value& cur = o->values[idx];
    if (mode == 0) cur = v;
    else if (mode == 1) cur = (cur.kind == Value::INT && v.kind == Value::INT) ? Value(cur.i + v.i) : Value(cur.num() + v.num());
    else cur = (cur.kind == Value::INT && v.kind == Value::INT) ? Value(cur.i - v.i) : Value(cur.num() - v.num());
}

void set_global(App& app, size_t idx, const Value& v, int mode) {
    if (idx >= app.global_values.size()) app.global_values.resize(idx + 1);
    Value& cur = app.global_values[idx];
    if (mode == 0) cur = v;
    else if (mode == 1) cur = (cur.kind == Value::INT && v.kind == Value::INT) ? Value(cur.i + v.i) : Value(cur.num() + v.num());
    else cur = (cur.kind == Value::INT && v.kind == Value::INT) ? Value(cur.i - v.i) : Value(cur.num() - v.num());
}

void set_counter(Obj* o, double v) {
    if (o->counter_max > o->counter_min) v = std::clamp(v, o->counter_min, o->counter_max);
    o->counter = v;
}

void set_group(Frame& f, const Param& p, bool active) {
    // PB_GROUPS=1: registra cada mudança de grupo com o nome (depuração).
    static const bool log_groups = std::getenv("PB_GROUPS") != nullptr;
    auto apply = [&](int index) {
        GroupInfo& g = f.groups[size_t(index)];
        if (log_groups && g.active != active) {
            const auto& c0 = f.def.events.groups[size_t(index)].conditions;
            SDL_Log("grupo %s frame %d passo %lld: #%d '%s'", active ? "ligado" : "desligado", f.index,
                    (long long)f.loop, index, c0.empty() || c0[0].params.empty() ? "" : c0[0].params[0].str.c_str());
        }
        if (active && !g.active) g.just_activated = true;
        g.active = active;
    };
    // O alvo real é a posição apontada (posição do parâmetro + ponteiro). O id
    // não basta: os eventos de behaviors reaproveitam ids (0, 1, 2...) que
    // também existem nos grupos do frame.
    auto at = f.group_by_offset.find(uint32_t(int64_t(p.file_pos) + p.i0));
    if (at != f.group_by_offset.end()) {
        apply(at->second);
        return;
    }
    auto range = f.group_by_id.equal_range(p.i1);
    if (f.app.dev.on)
        f.app.dev.report(f.app, range.first == range.second ? "ponteiro de grupo sem alvo" : "grupo achado só pelo id",
                         "id " + std::to_string(p.i1) + " ponteiro " + std::to_string(p.i0));
    for (auto it = range.first; it != range.second; ++it) apply(it->second);
}

std::vector<Obj*> create_objects(EvalContext& c, const Param& p) {
    std::vector<Obj*> made;
    for (const Pos& pos : resolve_position(c, p.pos)) {
        Obj* o = c.f.create(p.oi, pos.x, pos.y, pos.layer);
        if (!o) continue;
        if (pos.parent && (p.pos.flags & 4)) o->dir = pos.parent->dir;
        made.push_back(o);
    }
    if (!made.empty()) {
        c.s.sel[p.oi] = made;
        c.s.touched.insert(p.oi);
    }
    return made;
}

void shoot(EvalContext& c, Obj* shooter, const Param& sp, const Param* toward) {
    EvalContext sc{c.f, c.s, shooter, shooter->oi};
    PositionParam pp = sp.pos;
    std::vector<Obj*> par{shooter};
    double bx = shooter->x + pp.x, by = shooter->y + pp.y;
    if (pp.flags & 2) {
        if (const ImageInfo* im = shooter->image >= 0 ? c.f.app.image(shooter->image) : nullptr) {
            bx += (im->act_x - im->hot_x) * shooter->scale_x;
            by += (im->act_y - im->hot_y) * shooter->scale_y;
        }
    }
    Obj* b = c.f.create(sp.oi, bx, by, pp.layer < 0 ? shooter->layer : pp.layer);
    if (!b) return;
    double angle = shooter->dir * 11.25;
    if (toward) {
        auto tp = resolve_position(sc, toward->pos);
        if (!tp.empty()) angle = std::atan2(-(tp[0].y - by), tp[0].x - bx) * 180.0 / kPi;
    }
    b->movements.clear();
    MovementDef def;
    def.type = 13;  // bala
    def.v = {int32_t(sp.i0), int32_t(std::lround(angle * 1000))};
    b->movements.push_back(make_movement(b, def));
    b->mv_index = 0;
    b->dir = int(std::lround(((angle < 0 ? angle + 360 : angle)) / 11.25)) & 31;
    c.s.sel[sp.oi] = {b};
    c.s.touched.insert(sp.oi);
}

void object_action(EvalContext& c, const EventItem& it, Obj* o) {
    Frame& f = c.f;
    App& app = f.app;
    const Param* p0 = P(it, 0);
    const Param* p1 = P(it, 1);
    Movement* mv = o->mv();
    switch (it.num) {
        case 1:
            if (p0) {
                auto pos = resolve_position(c, p0->pos);
                if (!pos.empty()) {
                    const Pos& q = pos[size_t(std::max(0, c.loop_index)) % pos.size()];
                    o->x = q.x;
                    o->y = q.y;
                }
            }
            return;
        case 2: if (p0) o->x = eval_expr(c, p0->expr).num(); return;
        case 3: if (p0) o->y = eval_expr(c, p0->expr).num(); return;
        case 4: if (mv) mv->stop(); return;
        case 5: if (mv) mv->start(); return;
        case 6: if (mv && p0) mv->set_speed(param_int(c, *p0)); return;
        case 9: if (mv) mv->bounce(); return;
        case 11: case 12: case 13: {
            if (o->movements.empty()) return;
            int n = int(o->movements.size());
            int idx = it.num == 11 ? o->mv_index + 1 : it.num == 12 ? o->mv_index - 1 : (p0 ? param_int(c, *p0) : 0);
            if (app.dev.on && it.num == 13 && (idx < 0 || idx >= n))
                app.dev.report(app, "movimento inexistente", (o->def ? o->def->name : std::string("?")) + " movimento " +
                               std::to_string(idx) + " (evento #" + std::to_string(c.event_index) + ")");
            idx = std::clamp(idx, 0, n - 1);
            if (idx != o->mv_index) {
                o->mv_index = idx;
                if (o->def->movements[size_t(idx)].move_at_start) o->mv()->start();
            }
            return;
        }
        case 14:
            if (p0) {
                auto pos = resolve_position(c, p0->pos);
                if (!pos.empty()) {
                    const Pos& q = pos[size_t(std::max(0, c.loop_index)) % pos.size()];
                    double a = std::atan2(-(q.y - o->y), q.x - o->x) * 180.0 / kPi;
                    if (a < 0) a += 360;
                    int d = int(std::lround(a / 11.25)) & 31;
                    o->dir = d;
                    if (mv) mv->set_direction(d);
                }
            }
            return;
        case 15: o->anim_stopped = true; return;
        case 16: o->anim_stopped = false; return;
        case 17:
            if (p0) {
                int a = param_int(c, *p0);
                // forçar de novo uma animação que já terminou recomeça do início
                if (o->anim_done && (o->forced_anim == a || o->anim == a)) {
                    o->frame = 0;
                    o->anim_counter = 0;
                    o->anim_loops = 0;
                    o->anim_done = false;
                }
                if (app.dev.on && o->def &&
                    (a < 0 || a >= int(o->def->anims.size()) || !o->def->anims[size_t(a)].present))
                    app.dev.report(app, "animação forçada inexistente",
                                   o->def->name + " anim " + std::to_string(a) + " (evento #" + std::to_string(c.event_index) + ")");
                o->forced_anim = a;
                o->anim_stopped = false;
            }
            return;
        case 18: if (p0) o->forced_dir = direction_param(c, *p0); return;
        case 19: if (p0) o->forced_speed = std::clamp(param_int(c, *p0), 0, 100); return;
        case 20: o->forced_anim = -1; return;
        case 21: o->forced_dir = -1; return;
        case 22: o->forced_speed = -1; return;
        case 23:
            if (p0) {
                int d = direction_param(c, *p0);
                o->dir = d;
                if (mv) mv->set_direction(d);
            }
            return;
        case 24: f.destroy(o); return;
        case 26: o->visible = false; o->flash_period = 0; return;
        case 27: o->visible = true; o->flash_period = 0; return;
        case 28: if (p0) { o->flash_period = std::max(1, param_int(c, *p0)); o->flash_timer = 0; } return;
        case 29: if (p0) shoot(c, o, *p0, nullptr); return;
        case 30: if (p0) shoot(c, o, *p0, p1); return;
        case 31: case 32: case 33:
            if (p0 && p1) {
                const int idx = param_int(c, *p0);
                if (app.dev.on && (idx < 0 || idx > 25))
                    app.dev.report(app, "valor alterável fora de A..Z", (o->def ? o->def->name : std::string("?")) +
                                   " índice " + std::to_string(idx) + " (evento #" + std::to_string(c.event_index) + ")");
                if (idx >= 0) set_alterable(o, size_t(idx), eval_expr(c, p1->expr), it.num - 31);
            }
            return;
        case 35: case 36: case 37: {
            int bit = p0 ? param_int(c, *p0) & 31 : 0;
            if (it.num == 35) o->flags |= 1u << bit;
            else if (it.num == 36) o->flags &= ~(1u << bit);
            else o->flags ^= 1u << bit;
            return;
        }
        case 40: if (p0) o->forced_frame = std::max(0, param_int(c, *p0)); return;
        case 41: o->forced_frame = -1; return;
        case 43: if (mv && p0) mv->set_deceleration(param_int(c, *p0)); return;
        case 57: o->z = f.next_z++; return;
        case 58: {
            int mn = 0;
            for (auto& x : f.objects) mn = std::min(mn, x->z);
            o->z = mn - 1;
            return;
        }
        case 59: case 60:
            if (p0) {
                Obj* other = first_target(c, p0->oi);
                if (other && other != o) {
                    o->layer = other->layer;
                    o->z = it.num == 59 ? other->z - 1 : other->z + 1;
                    // evita empate com o vizinho
                    for (auto& x : f.objects)
                        if (x.get() != o && x->layer == o->layer && x->z == o->z) x->z += (it.num == 59 ? 1 : -1);
                }
            }
            return;
        case 61:
            if (p0) o->layer = std::clamp(param_int(c, *p0) - 1, 0, int(f.def.layers.size()) - 1);
            return;
        case 65: if (p0) o->alpha = std::clamp(param_int(c, *p0), 0, 255); return;
        case 66: if (p0) o->rgb = colorref_to_rgb(uint32_t(p0->expr.empty() ? p0->i0 : param_int(c, *p0))); return;
        default: break;
    }
    if (o->type == OBJ_ACTIVE) {
        switch (it.num) {
            // Escala negativa vira 0 no Clickteam (o objeto some). O "carregar laser"
            // dos chefes do Zorbié faz escala = A e tira 0,4 de A a cada passo, para
            // sempre: aqui a escala crescia de novo no negativo e desenhava um sprite
            // gigante girando.
            case 85: if (p0) o->scale_x = o->scale_y = std::max(0.0f, float(eval_expr(c, p0->expr).num())); return;
            case 86: if (p0) o->scale_x = std::max(0.0f, float(eval_expr(c, p0->expr).num())); return;
            case 87: if (p0) o->scale_y = std::max(0.0f, float(eval_expr(c, p0->expr).num())); return;
            case 88: {
                if (!p0) return;
                double a = std::fmod(eval_expr(c, p0->expr).num(), 360.0);
                o->angle = float(a < 0 ? a + 360 : a);
                return;
            }
            default: break;
        }
    } else if (o->type == OBJ_COUNTER || o->type == OBJ_SCORE || o->type == OBJ_LIVES) {
        switch (it.num) {
            case 80: if (p0) set_counter(o, eval_expr(c, p0->expr).num()); return;
            case 81: if (p0) set_counter(o, o->counter + eval_expr(c, p0->expr).num()); return;
            case 82: if (p0) set_counter(o, o->counter - eval_expr(c, p0->expr).num()); return;
            case 83: if (p0) { o->counter_min = eval_expr(c, p0->expr).num(); set_counter(o, o->counter); } return;
            case 84: if (p0) { o->counter_max = eval_expr(c, p0->expr).num(); set_counter(o, o->counter); } return;
            case 85: if (p0) o->bar_color1 = colorref_to_rgb(uint32_t(p0->expr.empty() ? p0->i0 : param_int(c, *p0))); return;
            case 86: if (p0) o->bar_color2 = colorref_to_rgb(uint32_t(p0->expr.empty() ? p0->i0 : param_int(c, *p0))); return;
            default: break;
        }
    } else if (o->type == OBJ_TEXT) {
        switch (it.num) {
            case 88: if (p0) o->text = param_value(c, *p0).str(); return;
            case 80: o->text.clear(); return;
            default: break;
        }
    }
    app.note_unimplemented(item_name(ItemKind::Action, it.type, it.num));
}

void action(EvalContext& c, const EventItem& it) {
    Frame& f = c.f;
    App& app = f.app;
    const Param* p0 = P(it, 0);
    const Param* p1 = P(it, 1);
    const Param* p2 = P(it, 2);
    Audio* au = app.audio();
    switch (it.type) {
        case OBJ_SYSTEM:
            switch (it.num) {
                case 0: return;
                case 3: case 4: case 5:
                    if (p0 && p1) {
                        int mode = it.num == 3 ? 0 : it.num == 5 ? 1 : 2;
                        set_global(app, size_t(param_int(c, *p0)), eval_expr(c, p1->expr), mode);
                    }
                    return;
                case 6: case 7: if (p0) set_group(f, *p0, it.num == 6); return;
                case 19:
                    if (p0 && p1) {
                        size_t idx = size_t(param_int(c, *p0));
                        if (idx >= app.global_strings.size()) app.global_strings.resize(idx + 1);
                        app.global_strings[idx] = eval_expr(c, p1->expr).str();
                    }
                    return;
                default: break;
            }
            break;
        case OBJ_SOUND:
            if (!au) return;
            switch (it.num) {
                case 0: if (p0) au->play(p0->i0, -1, 1); return;
                case 1: au->stop_all(); return;
                case 6: if (p0) au->stop_sound(p0->i0); return;
                case 11: if (p0 && p1) au->play(p0->i0, param_int(c, *p1), 1); return;
                case 12: if (p0 && p1) au->play(p0->i0, param_int(c, *p1), p2 ? param_int(c, *p2) : 0); return;
                case 13: if (p0) au->pause_channel(param_int(c, *p0), true); return;
                case 14: if (p0) au->pause_channel(param_int(c, *p0), false); return;
                case 15: if (p0) au->stop_channel(param_int(c, *p0)); return;
                case 17: if (p0 && p1) au->set_channel_volume(param_int(c, *p0), param_int(c, *p1)); return;
                case 32: if (p0 && p1) au->set_channel_frequency(param_int(c, *p0), param_int(c, *p1)); return;
                case 24: au->pause_all(true); return;
                case 25: au->pause_all(false); return;
                default: break;
            }
            break;
        case OBJ_GAME:
            switch (it.num) {
                case 0: app.request_frame(f.index + 1); return;
                case 1: app.request_frame(std::max(0, f.index - 1)); return;
                case 2:
                    if (p0) {
                        int idx = p0->expr.empty() ? app.game().frame_index_from_handle(p0->i0)
                                                   : param_int(c, *p0) - 1;
                        app.request_frame(idx);
                    }
                    return;
                case 3: app.request_frame(f.index); return;
                case 4: app.quit(); return;
                case 7:
                    if (p0) {
                        auto pos = resolve_position(c, p0->pos);
                        if (!pos.empty()) { f.center_display_x(pos[0].x); f.center_display_y(pos[0].y); }
                    }
                    return;
                case 8: if (p0) f.center_display_x(eval_expr(c, p0->expr).num()); return;
                case 9: if (p0) f.center_display_y(eval_expr(c, p0->expr).num()); return;
                case 16: if (p0) app.frame_rate = std::clamp(param_int(c, *p0), 1, 240); return;
                case 18: app.paused = true; return;
                case 23:
                    if (p0) f.background = colorref_to_rgb(uint32_t(p0->expr.empty() ? p0->i0 : param_int(c, *p0)));
                    return;
                case 26: if (p0) f.width = std::max(1, param_int(c, *p0)); return;
                case 27: if (p0) f.height = std::max(1, param_int(c, *p0)); return;
                default: break;
            }
            break;
        case OBJ_TIMER:
            if (it.num == 0 && p0) {
                // "Mudar o cronômetro": o acumulador também, senão o passo seguinte
                // desfaz a mudança (o bônus do Zorbié zera o cronômetro para contar
                // a decolagem e a descida do chão; sem isso tudo disparava junto).
                f.timer_ms = uint32_t(std::max(0, param_int(c, *p0)));
                f.timer_acc = double(f.timer_ms);
                for (auto& s : f.event_state) {
                    s.every_last = f.timer_ms;
                    s.timer_equals_done = false;
                }
                return;
            }
            break;
        case OBJ_CREATE:
            if (it.num == 0 && p0) { create_objects(c, *p0); return; }
            break;
        case OBJ_PLAYER:
            switch (it.num) {
                case 0: if (p0) app.score = param_int(c, *p0); return;
                case 1: if (p0) app.lives = param_int(c, *p0); return;
                case 4: if (p0) app.score += param_int(c, *p0); return;
                case 5: if (p0) app.lives += param_int(c, *p0); return;
                case 6: if (p0) app.score -= param_int(c, *p0); return;
                case 7: if (p0) app.lives -= param_int(c, *p0); return;
                default: return;
            }
        default: break;
    }

    if (it.type >= 0) {
        // "Espalhar valor": incrementa a cada instância.
        if (it.num == 34 && p0 && p1) {
            Value v = eval_expr(c, p1->expr);
            size_t idx = size_t(param_int(c, *p0));
            for (Obj* o : targets(c, it.oi)) {
                set_alterable(o, idx, v, 0);
                v = Value(v.int_() + 1);
            }
            return;
        }
        std::vector<Obj*> tg = targets(c, it.oi);
        int k = 0;
        for (Obj* o : tg) {
            if (o->destroyed && it.num != 24) continue;
            c.current = o;
            c.current_oi = o->oi;
            c.loop_index = k++;
            if (it.type >= OBJ_EXTENSION_BASE && it.num >= 80) ext_action(c, it, o);
            else object_action(c, it, o);
        }
        c.current = nullptr;
        c.current_oi = -1;
        c.loop_index = -1;
        return;
    }
    app.note_unimplemented(item_name(ItemKind::Action, it.type, it.num));
}

bool is_marker(const EventItem& it, int num) { return it.type == OBJ_SYSTEM && it.num == num; }

// PB_TRACE="594,595" imprime o resultado de cada condição desses grupos (depuração).
bool traced(int gi) {
    static std::vector<int> list = [] {
        std::vector<int> v;
        if (const char* t = std::getenv("PB_TRACE")) {
            for (const char* p = t; *p;) {
                v.push_back(std::atoi(p));
                while (*p && *p != ',') ++p;
                if (*p) ++p;
            }
        }
        return v;
    }();
    return std::find(list.begin(), list.end(), gi) != list.end();
}

void eval_group(Frame& f, int gi) {
    const EventGroup& g = f.def.events.groups[size_t(gi)];
    const bool trace = traced(gi);
    g_diag.group = gi;
    // Blocos separados por "OU" (lógico ou filtrado).
    std::vector<std::pair<size_t, size_t>> blocks;
    size_t start = 0;
    for (size_t i = 0; i < g.conditions.size(); ++i) {
        if (is_marker(g.conditions[i], -25) || is_marker(g.conditions[i], -24)) {
            blocks.push_back({start, i});
            start = i + 1;
        }
    }
    blocks.push_back({start, g.conditions.size()});

    Selection sel;
    bool any = false;
    for (auto [b, e] : blocks) {
        Selection bs;
        EvalContext bc{f, bs};
        bc.event_index = gi;
        bool ok = true;
        for (size_t i = b; i < e; ++i) {
            bool r = condition(bc, g.conditions[i], gi);
            if (trace)
                SDL_Log("trace #%d loop %lld cond %zu %s -> %d (mouse %d,%d scroll %.0f,%.0f)", gi,
                        (long long)f.loop, i,
                        item_name(ItemKind::Condition, g.conditions[i].type, g.conditions[i].num).c_str(),
                        r, f.app.input.mouse_x, f.app.input.mouse_y, f.scroll_x, f.scroll_y);
            if (!r) { ok = false; break; }
        }
        if (!ok) continue;
        if (!any) sel = std::move(bs);
        else {
            for (auto& [oi, v] : bs.sel) {
                auto& dst = sel.sel[oi];
                for (Obj* o : v)
                    if (std::find(dst.begin(), dst.end(), o) == dst.end()) dst.push_back(o);
                sel.touched.insert(oi);
            }
        }
        any = true;
    }
    if (!any) return;
    if (f.app.audit.on) {
        auto& v = f.app.audit.fired[f.index];
        if (v.size() < f.def.events.groups.size()) v.resize(f.def.events.groups.size());
        ++v[size_t(gi)];
    }
    EvalContext c{f, sel};
    c.event_index = gi;
    for (const EventItem& a : g.actions) {
        action(c, a);
        if (f.app.frame() != &f) return;
    }
}

}  // namespace

std::vector<Obj*> targets(EvalContext& c, int oi) {
    std::vector<Obj*> out;
    for (int m : c.f.expand_oi(oi)) {
        if (c.s.touched.count(m)) {
            for (Obj* o : c.s.sel[m])
                if (!o->destroyed) out.push_back(o);
        } else {
            const auto& all = c.f.instances(m);
            out.insert(out.end(), all.begin(), all.end());
        }
    }
    return out;
}

// Pareamento do Clickteam: numa ação que roda em várias instâncias de A, uma
// referência a outro objeto B (posição relativa, X/Y/ângulo de B...) usa a
// k-ésima instância de B para a k-ésima de A, voltando ao começo se B tiver
// menos instâncias. Na loja do Zorbié, as 3 barras ("Set position relativa a
// shop_gauge_shape") iam todas para a primeira linha.
Obj* paired_target(EvalContext& c, int oi) {
    if (c.loop_index <= 0) return first_target(c, oi);
    std::vector<Obj*> list = targets(c, oi);
    list.erase(std::remove_if(list.begin(), list.end(), [](Obj* o) { return o->destroyed; }), list.end());
    if (list.empty()) return nullptr;
    return list[size_t(c.loop_index) % list.size()];
}

Obj* first_target(EvalContext& c, int oi) {
    for (int m : c.f.expand_oi(oi)) {
        if (c.s.touched.count(m)) {
            for (Obj* o : c.s.sel[m])
                if (!o->destroyed) return o;
        } else {
            const auto& all = c.f.instances(m);
            if (!all.empty()) return all.front();
        }
    }
    return nullptr;
}

void run_events(Frame& f) {
    const auto& groups = f.def.events.groups;
    for (int i = 0; i < int(groups.size()); ++i) {
        const EventGroup& g = groups[size_t(i)];
        if (g.conditions.empty()) continue;
        const EventItem& c0 = g.conditions[0];
        if (is_marker(c0, -10)) {
            const GroupInfo& gi = f.groups[size_t(i)];
            if (!gi.active && gi.end > i) i = gi.end;
            continue;
        }
        if (is_marker(c0, -11) || is_marker(c0, -16)) continue;
        eval_group(f, i);
        if (f.app.frame() != &f || f.app.finished()) return;
    }
    for (auto& g : f.groups) g.just_activated = false;
}

}  // namespace pb
```

## player/src/runtime/expressions.cpp

```cpp
// Avaliador de expressões Clickteam.
//
// O formato é uma lista de tokens em ordem infixa. Funções (Random, Sin, Min...) e
// expressões de extensão com parâmetros não têm token de "(": os argumentos vêm logo
// depois, separados por "," (-1,-3) e terminados por ")" (-1,-2).
#include <algorithm>
#include <cmath>

#include "core/names.hpp"
#include "runtime/runtime.hpp"

namespace pb {
namespace {

constexpr double kPi = 3.14159265358979323846;
inline double rad(double d) { return d * kPi / 180.0; }
inline double deg(double r) { return r * 180.0 / kPi; }

bool is_system_function(int num) {
    switch (num) {
        case 1: case 2: case 4: case 5: case 10: case 11: case 12: case 13: case 14: case 15:
        case 16: case 17: case 18: case 19: case 20: case 21: case 22: case 28: case 29:
        case 30: case 31: case 32: case 33: case 34: case 35: case 40: case 41: case 42:
        case 43: case 44: case 45: case 46: case 48: case 49: case 51: case 52: case 53:
        case 54: case 58: case 59: case 62: case 63: case 64: case 65: case 68:
            return true;
        default: return false;
    }
}

int precedence(int op) {
    switch (op) {
        case 16: case 18: return 1;   // or, xor
        case 14: return 2;            // and
        case 2: case 4: return 3;     // + -
        case 6: case 8: case 10: return 4;  // * / mod
        case 12: return 5;            // potência
        default: return 0;
    }
}

Value arith(int op, const Value& a, const Value& b) {
    if (op == 2 && (a.is_str() || b.is_str())) return Value(a.str() + b.str());
    bool ints = a.kind == Value::INT && b.kind == Value::INT;
    switch (op) {
        case 2: return ints ? Value(a.i + b.i) : Value(a.num() + b.num());
        case 4: return ints ? Value(a.i - b.i) : Value(a.num() - b.num());
        case 6: return ints ? Value(a.i * b.i) : Value(a.num() * b.num());
        case 8:
            if (ints) return b.i == 0 ? Value(0) : Value(a.i / b.i);
            return b.num() == 0 ? Value(0) : Value(a.num() / b.num());
        case 10:
            if (ints) return b.i == 0 ? Value(0) : Value(a.i % b.i);
            return b.num() == 0 ? Value(0) : Value(std::fmod(a.num(), b.num()));
        case 12: return Value(std::pow(a.num(), b.num()));
        case 14: return Value(a.int_() & b.int_());
        case 16: return Value(a.int_() | b.int_());
        case 18: return Value(a.int_() ^ b.int_());
        default: return a;
    }
}

struct Parser {
    EvalContext& c;
    const std::vector<Expr>& t;
    size_t p = 0;

    const Expr* peek() const { return p < t.size() ? &t[p] : nullptr; }
    bool at(int type, int num) const {
        const Expr* e = peek();
        return e && e->type == type && e->num == num;
    }

    Value parse(int min_prec) {
        Value lhs = unary();
        while (const Expr* e = peek()) {
            if (e->type != 0) break;
            int prec = precedence(e->num);
            if (prec == 0 || prec < min_prec) break;
            ++p;
            Value rhs = parse(prec + 1);
            if ((e->num == 8 || e->num == 10) && c.f.app.dev.on && rhs.num() == 0)
                c.f.app.dev.report(c.f.app, e->num == 8 ? "divisão por zero (vira 0)" : "resto por zero (vira 0)",
                                   "evento #" + std::to_string(c.event_index));
            lhs = arith(e->num, lhs, rhs);
        }
        return lhs;
    }

    Value unary() {
        if (at(0, 4)) {  // "-" em posição de operando
            ++p;
            Value v = unary();
            return v.kind == Value::INT ? Value(-v.i) : Value(-v.num());
        }
        return operand();
    }

    std::vector<Value> args() {
        std::vector<Value> a;
        while (peek()) {
            if (at(-1, -2)) { ++p; break; }
            a.push_back(parse(0));
            if (at(-1, -3)) ++p;
        }
        return a;
    }

    Value operand() {
        const Expr* e = peek();
        if (!e) return Value(0);
        ++p;
        if (e->type == -1) {
            switch (e->num) {
                case -1: { Value v = parse(0); if (at(-1, -2)) ++p; return v; }
                case 0: return Value(int64_t(e->ival));
                case 3: return Value(e->sval);
                case 23: return Value(e->dval);
                case 24: {
                    auto& gv = c.f.app.global_values;
                    return size_t(e->index) < gv.size() ? gv[size_t(e->index)] : Value(0);
                }
                case 50: {
                    auto& gs = c.f.app.global_strings;
                    return Value(size_t(e->index) < gs.size() ? gs[size_t(e->index)] : std::string());
                }
                default:
                    if (is_system_function(e->num)) return system_function(e->num, args());
                    c.f.app.note_unimplemented(item_name(ItemKind::Expression, e->type, e->num));
                    return Value(0);
            }
        }
        if (e->type >= OBJ_EXTENSION_BASE && e->num >= 80) {
            std::vector<Value> a;
            if (ext_expression_arity(c.f.app.game(), *e) > 0) a = args();
            bool handled = false;
            Value v = ext_expression(c, *e, a, handled);
            if (!handled) c.f.app.note_unimplemented(item_name(ItemKind::Expression, e->type, e->num));
            return v;
        }
        if (e->type >= 2 || e->type == OBJ_PLAYER) return object_expression(*e);
        return special_expression(*e);
    }

    Value system_function(int num, const std::vector<Value>& a) {
        auto A = [&](size_t i) { return i < a.size() ? a[i] : Value(0); };
        App& app = c.f.app;
        switch (num) {
            case 1: {
                int64_t n = A(0).int_();
                if (n <= 0) return Value(0);
                return Value(int64_t(std::uniform_int_distribution<int64_t>(0, n - 1)(app.rng())));
            }
            case 2: {
                size_t i = size_t(A(0).int_());
                return i < app.global_values.size() ? app.global_values[i] : Value(0);
            }
            case 4: return Value(A(0).str());
            case 5: {
                std::string s = A(0).str();
                if (s.find('.') != std::string::npos) return Value(std::atof(s.c_str()));
                return Value(int64_t(std::atoll(s.c_str())));
            }
            case 10: return Value(std::sin(rad(A(0).num())));
            case 11: return Value(std::cos(rad(A(0).num())));
            case 12: return Value(std::tan(rad(A(0).num())));
            case 13: return Value(std::sqrt(A(0).num()));
            case 14: return Value(std::log10(A(0).num()));
            case 15: return Value(std::log(A(0).num()));
            case 18: return Value(std::exp(A(0).num()));
            case 19: { auto s = A(0).str(); return Value(s.substr(0, size_t(std::max<int64_t>(0, A(1).int_())))); }
            case 20: {
                auto s = A(0).str();
                size_t n = size_t(std::max<int64_t>(0, A(1).int_()));
                return Value(n >= s.size() ? s : s.substr(s.size() - n));
            }
            case 21: {
                auto s = A(0).str();
                size_t st = size_t(std::max<int64_t>(0, A(1).int_()));
                return Value(st >= s.size() ? std::string() : s.substr(st, size_t(std::max<int64_t>(0, A(2).int_()))));
            }
            case 22: return Value(int64_t(A(0).str().size()));
            case 28: return Value(A(0).int_());
            case 29: return A(0).kind == Value::INT ? Value(std::llabs(A(0).i)) : Value(std::fabs(A(0).num()));
            case 30: return Value(std::ceil(A(0).num()));
            case 31: return Value(std::floor(A(0).num()));
            case 32: return Value(deg(std::acos(A(0).num())));
            case 33: return Value(deg(std::asin(A(0).num())));
            case 34: return Value(deg(std::atan(A(0).num())));
            case 35: return Value(~A(0).int_());
            case 40: return compare(A(0), 3, A(1)) ? A(0) : A(1);
            case 41: return compare(A(0), 5, A(1)) ? A(0) : A(1);
            case 42: return Value(A(0).int_() | (A(1).int_() << 8) | (A(2).int_() << 16));
            case 43: return Value(A(0).int_() & 0xFF);
            case 44: return Value((A(0).int_() >> 8) & 0xFF);
            case 45: return Value((A(0).int_() >> 16) & 0xFF);
            case 48: return Value(int64_t(std::llround(A(0).num())));
            case 49: {
                size_t i = size_t(A(0).int_());
                auto& gs = app.global_strings;
                return Value(i < gs.size() ? gs[i] : std::string());
            }
            case 51: { auto s = A(0).str(); for (auto& ch : s) ch = char(std::tolower(ch)); return Value(s); }
            case 52: { auto s = A(0).str(); for (auto& ch : s) ch = char(std::toupper(ch)); return Value(s); }
            case 53: { auto s = A(0).str(); auto r = s.find(A(1).str(), size_t(std::max<int64_t>(0, A(2).int_()))); return Value(r == std::string::npos ? int64_t(-1) : int64_t(r)); }
            case 59: return Value(deg(std::atan2(A(0).num(), A(1).num())));
            case 62: return Value(std::hypot(A(2).num() - A(0).num(), A(3).num() - A(1).num()));
            case 63: {
                double a = deg(std::atan2(-(A(3).num() - A(1).num()), A(2).num() - A(0).num()));
                return Value(a < 0 ? a + 360 : a);
            }
            case 64: return Value(std::clamp(A(0).num(), A(1).num(), A(2).num()));
            case 65: {
                int64_t lo = A(0).int_(), hi = A(1).int_();
                if (hi < lo) std::swap(lo, hi);
                return Value(int64_t(std::uniform_int_distribution<int64_t>(lo, hi)(app.rng())));
            }
            default:
                app.note_unimplemented(item_name(ItemKind::Expression, -1, num));
                return Value(0);
        }
    }

    Value special_expression(const Expr& e) {
        Frame& f = c.f;
        App& app = f.app;
        int ww = app.view_w, wh = app.view_h;
        switch (e.type) {
            case OBJ_GAME:
                switch (e.num) {
                    case 0: case 8: return Value(f.index + 1);
                    case 2: return Value(int64_t(f.scroll_x));
                    case 3: return Value(int64_t(f.scroll_x + ww));
                    case 4: return Value(int64_t(f.scroll_y));
                    case 5: return Value(int64_t(f.scroll_y + wh));
                    case 6: case 11: return Value(f.width);
                    case 7: case 12: return Value(f.height);
                    case 10: return Value(app.frame_rate);
                    case 13: return Value(int64_t(f.background));
                    default: break;
                }
                break;
            case OBJ_TIMER:
                switch (e.num) {
                    case 0: return Value(int64_t(f.timer_ms));
                    case 1: return Value(int64_t((f.timer_ms / 10) % 100));
                    case 2: return Value(int64_t((f.timer_ms / 1000) % 60));
                    case 3: return Value(int64_t(f.timer_ms / 3600000));
                    case 4: return Value(int64_t((f.timer_ms / 60000) % 60));
                    default: break;
                }
                break;
            case OBJ_CREATE:
                if (e.num == 0) {
                    int64_t n = 0;
                    for (auto& o : f.objects) n += !o->destroyed;
                    return Value(n);
                }
                break;
            case OBJ_KEYBOARD:
                if (e.num == 0) return Value(int64_t(app.input.mouse_x + f.scroll_x));
                if (e.num == 1) return Value(int64_t(app.input.mouse_y + f.scroll_y));
                break;
            case OBJ_SOUND:
                return Value(0);
            default: break;
        }
        app.note_unimplemented(item_name(ItemKind::Expression, e.type, e.num));
        return Value(0);
    }

    Obj* resolve(int oi) {
        if (c.current && (c.current_oi == oi || c.current->oi == oi)) return c.current;
        if (c.current && (oi & 0x8000)) {
            for (int m : c.f.expand_oi(oi))
                if (m == c.current->oi) return c.current;
        }
        return paired_target(c, oi);
    }

    Value object_expression(const Expr& e) {
        App& app = c.f.app;
        if (e.type == OBJ_PLAYER) {
            if (e.num == 0) return Value(app.score);
            if (e.num == 1) return Value(app.lives);
            return Value(0);
        }
        if (e.num == 15) {  // número de instâncias
            int64_t n = 0;
            for (int oi : c.f.expand_oi(e.oi)) n += int64_t(c.f.instances(oi).size());
            return Value(n);
        }
        Obj* o = resolve(e.oi);
        if (!o) {
            if (app.dev.on) {
                const ObjectDef* od = app.game().object(e.oi);
                app.dev.report(app, "expressão sobre objeto sem instância (vira 0)",
                               (od ? od->name : "oi " + std::to_string(e.oi)) + " (evento #" + std::to_string(c.event_index) + ")");
            }
            return Value(0);
        }
        const ImageInfo* im = o->image >= 0 ? app.image(o->image) : nullptr;
        switch (e.num) {
            case 1: return Value(int64_t(std::floor(o->y)));
            case 11: return Value(int64_t(std::floor(o->x)));
            case 2: return Value(o->frame);
            case 3: return Value(o->speed());
            case 6: return Value(o->dir);
            case 7: case 8: case 9: case 10: {
                Rect r = obj_rect(app, *o);
                double v = e.num == 7 ? r.x1 : e.num == 8 ? r.x2 : e.num == 9 ? r.y1 : r.y2;
                return Value(int64_t(std::floor(v)));
            }
            case 12: return Value(o->uid);
            case 13: return Value(int64_t((o->flags >> (e.index & 31)) & 1));
            case 14: return Value(o->anim);
            case 16:
                if (app.dev.on && (e.index < 0 || e.index > 25))
                    app.dev.report(app, "valor alterável fora de A..Z", o->def->name + " índice " + std::to_string(e.index));
                return size_t(e.index) < o->values.size() ? o->values[size_t(e.index)] : Value(0);
            case 19: return Value(size_t(e.index) < o->strings.size() ? o->strings[size_t(e.index)] : std::string());
            case 25: return Value(int64_t(o->x + (im ? (im->act_x - im->hot_x) * o->scale_x : 0)));
            case 26: return Value(int64_t(o->y + (im ? (im->act_y - im->hot_y) * o->scale_y : 0)));
            case 27: return Value(o->alpha);
            case 28: {  // devolve no formato COLORREF (0x00BBGGRR)
                uint32_t v = o->rgb;
                return Value(int64_t(((v >> 16) & 0xFF) | (v & 0xFF00) | ((v & 0xFF) << 16)));
            }
            case 40: { Rect r = obj_rect(app, *o); return Value(int64_t(r.x2 - r.x1)); }
            case 41: { Rect r = obj_rect(app, *o); return Value(int64_t(r.y2 - r.y1)); }
            default: break;
        }
        if (o->type == OBJ_ACTIVE) {
            switch (e.num) {
                case 81: return Value(double(o->scale_x));
                case 82: return Value(double(o->scale_y));
                case 83: return Value(double(o->angle));
                default: break;
            }
        } else if (o->type == OBJ_COUNTER || o->type == OBJ_SCORE || o->type == OBJ_LIVES) {
            auto num = [](double v) { return std::floor(v) == v ? Value(int64_t(v)) : Value(v); };
            switch (e.num) {
                case 80: return num(o->counter);
                case 81: return num(o->counter_min);
                case 82: return num(o->counter_max);
                default: break;
            }
        } else if (o->type == OBJ_TEXT) {
            if (e.num == 81 || e.num == 82) return Value(o->text);
        }
        app.note_unimplemented(item_name(ItemKind::Expression, e.type, e.num));
        return Value(0);
    }
};

}  // namespace

Value eval_expr(EvalContext& c, const std::vector<Expr>& ex) {
    if (ex.empty()) return Value(0);
    Parser p{c, ex};
    return p.parse(0);
}

}  // namespace pb
```

## player/src/runtime/extensions.cpp

```cpp
// Extensões Clickteam usadas por jogos iOS:
//   kcini (INI)     — implementada, grava em save_dir
//   AdvDir          — matemática de direção/distância
//   iOS*, GameCenter*, RateMe — substitutos: condições falsas, ações sem efeito.
//     (Ex.: com o iOSGetDevice falso, o Zorbié escolhe a qualidade gráfica máxima.)
#include <cmath>
#include <fstream>
#include <map>
#include <set>
#include <sstream>

#include "runtime/runtime.hpp"

namespace pb {
namespace {

struct Ini;
// INIs com alterações ainda não gravadas (ver flush_ini_files).
std::set<Ini*>& dirty_inis() {
    static std::set<Ini*> s;
    return s;
}

// Gravação adiada: o Zorbié grava dezenas de chaves no mesmo passo (ex.: 8 a
// cada compra na loja, muito mais ao fim da partida). Regravar o arquivo
// inteiro a cada chave travava o jogo por dezenas de ms (bem mais no celular).
// Agora as chaves mudam na memória e o arquivo é gravado uma vez no fim do
// passo, ao trocar de frame, ao pausar e ao sair.
struct Ini {
    std::string path, group, item;
    std::map<std::string, std::map<std::string, std::string>> data;
    bool loaded = false, dirty = false;

    ~Ini() { flush(); }
    void flush() {
        if (!dirty) return;
        dirty = false;
        dirty_inis().erase(this);
        save();
    }
    void mark() {
        dirty = true;
        dirty_inis().insert(this);
    }

    void load(const std::string& p) {
        flush();  // não perde o que ainda não foi gravado
        path = p;
        data.clear();
        loaded = true;
        std::ifstream f(path);
        std::string line, cur;
        while (std::getline(f, line)) {
            if (!line.empty() && line.back() == '\r') line.pop_back();
            if (line.size() >= 2 && line.front() == '[' && line.back() == ']') {
                cur = line.substr(1, line.size() - 2);
                data[cur];
            } else if (auto eq = line.find('='); eq != std::string::npos) {
                data[cur][line.substr(0, eq)] = line.substr(eq + 1);
            }
        }
    }
    void save() const {
        if (path.empty()) return;
        std::ofstream f(path, std::ios::trunc);
        for (auto& [g, items] : data) {
            f << '[' << g << "]\n";
            for (auto& [k, v] : items) f << k << '=' << v << '\n';
        }
    }
    std::string get(const std::string& g, const std::string& k) const {
        auto gi = data.find(g);
        if (gi == data.end()) return {};
        auto ki = gi->second.find(k);
        return ki == gi->second.end() ? std::string() : ki->second;
    }
    void set(const std::string& g, const std::string& k, const std::string& v) {
        auto& slot = data[g][k];
        if (slot == v && !path.empty()) return;  // mesmo valor: nada a gravar
        slot = v;
        mark();
    }
};

std::string ext_name(EvalContext& c, int type) { return c.f.app.game().extension_name(type); }

Ini& ini_of(EvalContext& c, Obj* o) {
    if (!o->ext) o->ext = std::make_shared<Ini>();
    Ini& ini = *static_cast<Ini*>(o->ext.get());
    if (!ini.loaded) ini.load(c.f.app.save_dir + "/" + (o->def ? o->def->name : "default.ini"));
    return ini;
}

std::string clean_filename(std::string f) {
    while (f.rfind("./", 0) == 0) f = f.substr(2);
    for (auto& ch : f)
        if (ch == '/' || ch == '\\' || ch == ':') ch = '_';
    return f.empty() ? "default.ini" : f;
}

Value ini_value(const std::string& s) {
    if (s.empty()) return Value(0);
    if (s.find('.') != std::string::npos) return Value(std::atof(s.c_str()));
    return Value(int64_t(std::atoll(s.c_str())));
}

Value arg(EvalContext& c, const EventItem& it, size_t i) {
    if (i >= it.params.size()) return Value(0);
    const Param& p = it.params[i];
    if (!p.expr.empty()) return eval_expr(c, p.expr);
    if (!p.str.empty()) return Value(p.str);
    return Value(p.i0);
}

bool is_ios_stub(const std::string& n) {
    return n.rfind("iOS", 0) == 0 || n.rfind("GameCenter", 0) == 0 || n == "RateMe" ||
           n == "iOSStore" || n == "iOSTwitter";
}

}  // namespace

void flush_ini_files() {
    std::vector<Ini*> list(dirty_inis().begin(), dirty_inis().end());
    for (Ini* ini : list) ini->flush();
}

bool ext_condition(EvalContext& c, const EventItem& it, Obj* o, bool& handled) {
    std::string n = ext_name(c, it.type);
    if (n == "iOS") {
        // Condições 1 e 2 do objeto iOS: o app foi interrompido (ligação, outro
        // app). O Zorbié abre a pausa com elas; aqui valem no passo em que o app
        // volta do segundo plano.
        handled = true;
        const int idx = -it.num - 81;
        return (idx == 1 || idx == 2) && c.f.app.interrupted_flag;
    }
    if (n == "iOSStore") {
        // Loja da Apple (compras dentro do app). Não existe no Android: o pedido
        // de compra é respondido com a condição 3, "compra falhou", para o mesmo
        // produto (o jogo mostra a mensagem de falha e devolve o botão de voltar,
        // em vez de ficar em "Please wait"). Nada é desbloqueado.
        handled = true;
        const int idx = -it.num - 81;
        return idx == 3 && !c.f.app.store_failed.empty() && arg(c, it, 0).str() == c.f.app.store_failed;
    }
    if (is_ios_stub(n)) { handled = true; return false; }
    if (n == "AdvDir") { handled = true; return false; }
    (void)o;
    return false;
}

void ext_action(EvalContext& c, const EventItem& it, Obj* o) {
    std::string n = ext_name(c, it.type);
    int idx = it.num - 80;
    if (n == "iOSStore") {
        if (idx == 0) c.f.app.store_pending = arg(c, it, 0).str();  // pedido de compra: falha no próximo passo
        return;
    }
    if (is_ios_stub(n) || n == "AdvDir") return;
    if (n == "kcini") {
        Ini& ini = ini_of(c, o);
        switch (idx) {
            case 0: ini.group = arg(c, it, 0).str(); return;
            case 1: ini.item = arg(c, it, 0).str(); return;
            case 2: ini.set(ini.group, ini.item, arg(c, it, 0).str()); return;
            case 5: ini.set(ini.group, ini.item, arg(c, it, 0).str()); return;
            case 6: ini.load(c.f.app.save_dir + "/" + clean_filename(arg(c, it, 0).str())); return;
            case 7: case 9: ini.set(ini.group, arg(c, it, 0).str(), arg(c, it, 1).str()); return;
            case 8: case 10: ini.set(arg(c, it, 0).str(), arg(c, it, 1).str(), arg(c, it, 2).str()); return;
            case 11: ini.data[ini.group].erase(arg(c, it, 0).str()); ini.mark(); return;
            case 12: ini.data[arg(c, it, 0).str()].erase(arg(c, it, 1).str()); ini.mark(); return;
            case 13: ini.data.erase(arg(c, it, 0).str()); ini.mark(); return;
            default: break;
        }
    }
    c.f.app.note_unimplemented(n + "#" + std::to_string(idx));
}

int ext_expression_arity(const Game& g, const Expr& e) {
    std::string n = g.extension_name(e.type);
    int idx = e.num - 80;
    if (n == "kcini") {
        static const int ar[] = {0, 0, 1, 2, 1, 2};
        return idx >= 0 && idx < 6 ? ar[idx] : 0;
    }
    if (n == "AdvDir") {
        switch (idx) {
            case 1: case 2: case 3: case 4: return 4;
            case 6: return 2;
            default: return 0;
        }
    }
    return 0;
}

Value ext_expression(EvalContext& c, const Expr& e, const std::vector<Value>& a, bool& handled) {
    std::string n = ext_name(c, e.type);
    int idx = e.num - 80;
    auto A = [&](size_t i) { return i < a.size() ? a[i].num() : 0.0; };
    if (n == "kcini") {
        Obj* o = first_target(c, e.oi);
        if (!o) { handled = true; return Value(0); }
        Ini& ini = ini_of(c, o);
        handled = true;
        switch (idx) {
            case 0: return ini_value(ini.get(ini.group, ini.item));
            case 1: return Value(ini.get(ini.group, ini.item));
            case 2: return ini_value(ini.get(ini.group, a.size() > 0 ? a[0].str() : ""));
            case 3: return ini_value(ini.get(a.size() > 0 ? a[0].str() : "", a.size() > 1 ? a[1].str() : ""));
            case 4: return Value(ini.get(ini.group, a.size() > 0 ? a[0].str() : ""));
            case 5: return Value(ini.get(a.size() > 0 ? a[0].str() : "", a.size() > 1 ? a[1].str() : ""));
            default: handled = false; return Value(0);
        }
    }
    if (n == "AdvDir") {
        handled = true;
        double dx = A(2) - A(0), dy = A(3) - A(1);
        switch (idx) {
            case 1: case 3: {
                double ang = std::atan2(-dy, dx) * 180.0 / 3.14159265358979323846;
                if (ang < 0) ang += 360;
                return idx == 3 ? Value(int64_t(ang)) : Value(ang);
            }
            case 2: return Value(std::hypot(dx, dy));
            case 4: return Value(int64_t(std::hypot(dx, dy)));
            case 6: {
                double d = std::fmod(std::fabs(A(0) - A(1)), 360.0);
                return Value(d > 180 ? 360 - d : d);
            }
            default: handled = false; return Value(0);
        }
    }
    if (is_ios_stub(n)) { handled = true; return Value(0); }
    return Value(0);
}

}  // namespace pb
```

## player/src/runtime/movements.cpp

```cpp
// Movimentos: estático, bola, trajetória, bala (tiro) e as extensões
// clickteam-vector, pinball e clickteam-simple_ellipse.
// Velocidades seguem a escala Clickteam: movimentos nativos andam speed/8 px por loop.
#include <cmath>

#include "runtime/runtime.hpp"

namespace pb {
namespace {

constexpr double kPi = 3.14159265358979323846;
inline double dir_rad(int d) { return d * kPi / 16.0; }
inline int angle_to_dir(double deg) {
    double a = std::fmod(deg, 360.0);
    if (a < 0) a += 360;
    return int(std::lround(a / 11.25)) & 31;
}

struct Static : Movement {
    using Movement::Movement;
};

struct Ball : Movement {
    int randomizer = 0, decel = 0;
    double dec_acc = 0;
    Ball(Obj* o, const MovementDef& d) : Movement(o) {
        speed = d.v.size() > 0 ? d.v[0] : 0;
        randomizer = d.v.size() > 1 ? d.v[1] : 0;
        decel = d.v.size() > 4 ? d.v[4] : 0;
    }
    void update() override {
        if (stopped || speed <= 0) return;
        double m = speed / 8.0;
        obj->x += std::cos(dir_rad(obj->dir)) * m;
        obj->y -= std::sin(dir_rad(obj->dir)) * m;
        if (decel > 0) {
            dec_acc += decel / 100.0;
            while (dec_acc >= 1 && speed > 0) { --speed; dec_acc -= 1; }
        }
    }
    void bounce() override {
        int d = (obj->dir + 16) & 31;
        if (randomizer > 0) d = (d + int(obj->uid * 7 % 5) - 2) & 31;
        obj->dir = d;
    }
};

struct Bullet : Movement {
    double angle;
    Bullet(Obj* o, const MovementDef& d) : Movement(o) {
        speed = d.v.size() > 0 ? d.v[0] : 50;
        angle = d.v.size() > 1 ? d.v[1] / 1000.0 : o->dir * 11.25;
    }
    void update() override {
        if (stopped) return;
        double m = speed / 8.0;
        obj->x += std::cos(angle * kPi / 180) * m;
        obj->y -= std::sin(angle * kPi / 180) * m;
    }
    void set_direction(int d) override {
        Movement::set_direction(d);
        angle = d * 11.25;
    }
};

struct Path : Movement {
    const MovementDef& def;
    int node = -1;  // -1 não iniciado, -2 terminado
    int step_dir = 1;
    double left = 0;
    bool just_finished = false;
    double sx = 0, sy = 0;  // erro acumulado (para fechar cada passo exatamente)
    Path(Obj* o, const MovementDef& d) : Movement(o), def(d) {}
    void set_node(int i) {
        node = i;
        const PathStep& s = def.steps[size_t(i)];
        left = s.length;
        speed = s.speed;
        int d = step_dir > 0 ? s.direction : (s.direction + 16) & 31;
        obj->dir = d & 31;
        sx = sy = 0;
    }
    void start() override {
        Movement::start();
        if (def.steps.empty()) return;
        if (node == -1) set_node(0);
    }
    bool finished() const override { return just_finished; }
    void update() override {
        just_finished = false;
        if (stopped || node < 0 || def.steps.empty()) return;
        const PathStep& s = def.steps[size_t(node)];
        if (s.length <= 0) { advance(); return; }
        double m = std::min(speed / 8.0, left);
        double ux = double(s.dx) / s.length, uy = double(s.dy) / s.length;
        obj->x += ux * m * step_dir;
        obj->y += uy * m * step_dir;
        sx += ux * m * step_dir;
        sy += uy * m * step_dir;
        left -= m;
        if (left <= 0) {
            // corrige para o destino exato do passo
            obj->x += s.dx * step_dir - sx;
            obj->y += s.dy * step_dir - sy;
            advance();
        }
    }
    void advance() {
        int next = node + step_dir;
        int n = int(def.steps.size());
        if (next >= 0 && next < n) { set_node(next); return; }
        if (def.reverse && step_dir == 1) { step_dir = -1; set_node(node); return; }
        if (!def.loop) { node = -2; speed = 0; just_finished = true; return; }
        if (def.reverse) { step_dir = 1; set_node(0); return; }
        if (def.reposition) {
            // volta ao início
            double tx = 0, ty = 0;
            for (auto& st : def.steps) { tx += st.dx; ty += st.dy; }
            obj->x -= tx;
            obj->y -= ty;
        }
        set_node(0);
    }
    void bounce() override {
        step_dir = -step_dir;
        if (node >= 0) {
            left = def.steps[size_t(node)].length - left;
            obj->dir = (obj->dir + 16) & 31;
        }
    }
};

struct Vector : Movement {
    double vx = 0, vy = 0;  // em unidades de velocidade (x0,01 px por loop)
    double gx = 0, gy = 0;
    bool handle_dir = false;
    Vector(Obj* o, const MovementDef& d) : Movement(o) {
        uint32_t flags = d.v.size() > 0 ? uint32_t(d.v[0]) : 0;
        handle_dir = flags & 2;
        int sp = d.v.size() > 1 ? d.v[1] : 0;
        double ang = d.v.size() > 2 ? d.v[2] : 0;
        double g = d.v.size() > 3 ? d.v[3] : 0;
        double ga = d.v.size() > 4 ? d.v[4] : 270;
        vx = sp * std::cos(ang * kPi / 180);
        vy = -sp * std::sin(ang * kPi / 180);
        gx = g * std::cos(ga * kPi / 180);
        gy = -g * std::sin(ga * kPi / 180);
        speed = sp;
        stopped = !(flags & 1);
    }
    void update() override {
        if (stopped) return;
        vx += gx * 0.01;
        vy += gy * 0.01;
        obj->x += vx * 0.01;
        obj->y += vy * 0.01;
        speed = int(std::hypot(vx, vy));
        if (handle_dir && (vx != 0 || vy != 0))
            obj->dir = angle_to_dir(std::atan2(-vy, vx) * 180 / kPi);
    }
    void set_speed(int s) override {
        double len = std::hypot(vx, vy);
        double a = len > 0 ? std::atan2(vy, vx) : -dir_rad(obj->dir);
        vx = s * std::cos(a);
        vy = s * std::sin(a);
        speed = s;
    }
    int get_speed() const override { return stopped ? 0 : int(std::hypot(vx, vy)); }
    void set_direction(int d) override {
        Movement::set_direction(d);
        double len = std::hypot(vx, vy);
        vx = len * std::cos(dir_rad(d));
        vy = -len * std::sin(dir_rad(d));
    }
    void bounce() override { vx = -vx; vy = -vy; }
};

struct Pinball : Movement {
    double xs = 0, ys = 0, gravity = 0, decel = 0;
    int start_speed = 0;
    Pinball(Obj* o, const MovementDef& d) : Movement(o) {
        start_speed = speed = d.v.size() > 0 ? d.v[0] : 0;
        decel = d.v.size() > 1 ? d.v[1] : 0;
        gravity = d.v.size() > 2 ? d.v[2] : 0;
        stopped = true;
    }
    void start() override {
        if (!stopped) return;
        stopped = false;
        xs = std::cos(dir_rad(obj->dir)) * speed;
        ys = -std::sin(dir_rad(obj->dir)) * speed;
    }
    void update() override {
        if (stopped) return;
        ys += gravity / 10.0;
        double ang = std::atan2(-ys, xs);
        double dist = std::hypot(xs, ys) - decel / 50.0;
        if (dist < 0) dist = 0;
        xs = dist * std::cos(ang);
        ys = -dist * std::sin(ang);
        speed = std::min(int(dist), 100);
        obj->dir = angle_to_dir(ang * 180 / kPi);
        obj->x += xs / 10.0;
        obj->y += ys / 10.0;
    }
    void set_direction(int d) override {
        Movement::set_direction(d);
        double dist = std::hypot(xs, ys);
        xs = std::cos(dir_rad(d)) * dist;
        ys = -std::sin(dir_rad(d)) * dist;
    }
    void set_speed(int s) override {
        double ang = std::atan2(-ys, xs);
        if (xs == 0 && ys == 0) ang = dir_rad(obj->dir);
        xs = s * std::cos(ang);
        ys = -s * std::sin(ang);
        speed = s;
    }
    void bounce() override { xs = -xs; ys = -ys; }
};

struct Ellipse : Movement {
    // campos (ver docs/FORMATO_CLICKTEAM_IOS.md): centro, raios, ângulo inicial?, ?, velocidade, ?
    double cx, cy, rx, ry, theta, deg_per_s;
    Ellipse(Obj* o, const MovementDef& d) : Movement(o) {
        auto V = [&](size_t i) { return i < d.v.size() ? double(d.v[i]) : 0.0; };
        cx = V(0); cy = V(1); rx = V(2); ry = V(3); theta = V(4);
        deg_per_s = V(6);  // calibração provisória: velocidade = graus por segundo
        speed = int(V(6));
        place();
    }
    void place() {
        obj->x = cx + rx * std::cos(theta * kPi / 180);
        obj->y = cy - ry * std::sin(theta * kPi / 180);
    }
    void update() override {
        if (stopped) return;
        int fps = 60;
        theta = std::fmod(theta + deg_per_s / fps, 360.0);
        place();
    }
};

}  // namespace

void Movement::set_direction(int dir) { obj->dir = dir & 31; }

std::unique_ptr<Movement> make_movement(Obj* o, const MovementDef& d) {
    switch (d.type) {
        case MV_BALL: return std::make_unique<Ball>(o, d);
        case MV_PATH: return std::make_unique<Path>(o, d);
        case 13: return std::make_unique<Bullet>(o, d);
        case MV_EXTENSION:
            if (d.module == "clickteam-vector") return std::make_unique<Vector>(o, d);
            if (d.module == "pinball") return std::make_unique<Pinball>(o, d);
            if (d.module == "clickteam-simple_ellipse") return std::make_unique<Ellipse>(o, d);
            break;
        default: break;
    }
    return std::make_unique<Static>(o);
}

}  // namespace pb
```

## player/src/runtime/render.cpp

```cpp
// Desenho de um frame com SDL_Renderer (OpenGL ES no Android, Metal/D3D/GL no desktop).
#include <algorithm>
#include <cmath>
#include <string>
#include <vector>
#include <cstdlib>

#include "runtime/runtime.hpp"
#include "runtime/text.hpp"

namespace pb {
namespace {

void draw_image(App& app, SDL_Renderer* r, int handle, double x, double y, float sx, float sy,
                float angle, int alpha, uint32_t rgb, uint32_t ink) {
    SDL_Texture* tex = app.texture(handle);
    const ImageInfo* im = app.image(handle);
    if (!tex || !im) return;
    float ax = std::fabs(sx), ay = std::fabs(sy);
    SDL_FRect dst{float(x - im->hot_x * ax), float(y - im->hot_y * ay), im->width * ax, im->height * ay};
    // Renderizador por software (testes sem tela): uma imagem ampliada centenas de
    // vezes (efeitos do Zorbié) com rotação faz o SDL alocar uma superfície do
    // tamanho do destino (GBs). Na GPU isso é só recortado; aqui é pulado.
    static int software = -1;
    if (software < 0) {
        SDL_RendererInfo info{};
        software = SDL_GetRendererInfo(r, &info) == 0 && (info.flags & SDL_RENDERER_SOFTWARE) ? 1 : 0;
    }
    if (software && double(dst.w) * dst.h > 4.0e7) return;
    SDL_FPoint center{im->hot_x * ax, im->hot_y * ay};
    int flip = (sx < 0 ? SDL_FLIP_HORIZONTAL : 0) | (sy < 0 ? SDL_FLIP_VERTICAL : 0);
    SDL_SetTextureAlphaMod(tex, Uint8(255 - std::clamp(alpha, 0, 255)));
    SDL_SetTextureColorMod(tex, Uint8(rgb >> 16), Uint8(rgb >> 8), Uint8(rgb));
    SDL_SetTextureBlendMode(tex, (ink & 0xFFF) == 9 ? SDL_BLENDMODE_ADD : SDL_BLENDMODE_BLEND);  // 0x1000: filtro RGBA
    SDL_RenderCopyExF(r, tex, nullptr, &dst, -double(angle), &center, SDL_RendererFlip(flip));
}

// PB_HIDE="116,554": não desenha esses objetos (depuração de camadas/sobreposição).
bool hidden_for_debug(int oi) {
    static const std::vector<int> list = [] {
        std::vector<int> v;
        if (const char* t = std::getenv("PB_HIDE"))
            for (const char* p = t; *p;) {
                v.push_back(std::atoi(p));
                while (*p && *p != ',') ++p;
                if (*p) ++p;
            }
        return v;
    }();
    return !list.empty() && std::find(list.begin(), list.end(), oi) != list.end();
}

const FontInfo* font_by_handle(App& app, int handle) {
    for (const FontInfo& f : app.game().fonts)
        if (f.handle == handle) return &f;
    return app.game().fonts.empty() ? nullptr : &app.game().fonts.front();
}

std::string counter_text(double v) {
    if (std::floor(v) == v) return std::to_string(int64_t(v));
    char buf[64];
    std::snprintf(buf, sizeof buf, "%g", v);
    return buf;
}

// Barra vertical (cresce de baixo para cima) ou horizontal (da esquerda), na cor
// 1 ou em degradê da cor 1 para a 2. Flag 0x100: cresce ao contrário. Ex.: a
// barra de super do Zorbié (5x100, 0..100).
void draw_bar(SDL_Renderer* r, const Obj& o, double ox, double oy) {
    const ObjectDef& d = *o.def;
    double range = o.counter_max - o.counter_min;
    double frac = range > 0 ? std::clamp((o.counter - o.counter_min) / range, 0.0, 1.0) : 0.0;
    float x = float(o.x - ox), y = float(o.y - oy), w = float(d.counter_w), h = float(d.counter_h);
    bool inverse = (d.counter_flags & 0x100) != 0;
    SDL_FRect bar = d.counter_display == 2
        ? SDL_FRect{x, inverse ? y : y + h * float(1 - frac), w, h * float(frac)}
        : SDL_FRect{inverse ? x + w * float(1 - frac) : x, y, w * float(frac), h};
    if (bar.w <= 0 || bar.h <= 0) return;
    Uint8 a = Uint8(255 - std::clamp(o.alpha, 0, 255));
    auto col = [&](uint32_t rgb) { return SDL_Color{Uint8(rgb >> 16), Uint8(rgb >> 8), Uint8(rgb), a}; };
    SDL_SetRenderDrawBlendMode(r, SDL_BLENDMODE_BLEND);
    if (!d.fill_is_gradient() || o.bar_color1 == o.bar_color2) {
        SDL_Color c = col(o.bar_color1);
        SDL_SetRenderDrawColor(r, c.r, c.g, c.b, c.a);
        SDL_RenderFillRectF(r, &bar);
        return;
    }
    // degradê: 1 -> 2 na horizontal ou na vertical
    SDL_Color c1 = col(o.bar_color1), c2 = col(o.bar_color2);
    bool vert = d.counter_vgradient;
    SDL_Vertex v[4] = {
        {{bar.x, bar.y}, c1, {0, 0}},
        {{bar.x + bar.w, bar.y}, vert ? c1 : c2, {0, 0}},
        {{bar.x + bar.w, bar.y + bar.h}, c2, {0, 0}},
        {{bar.x, bar.y + bar.h}, vert ? c2 : c1, {0, 0}},
    };
    const int idx[6] = {0, 1, 2, 0, 2, 3};
    SDL_RenderGeometry(r, nullptr, v, 4, idx, 6);
}

void draw_counter(App& app, SDL_Renderer* r, Obj& o, double ox, double oy) {
    if (o.def->counter_display == 2 || o.def->counter_display == 3) {
        draw_bar(r, o, ox, oy);
        return;
    }
    if (o.def->counter_display == 5) {  // número escrito com fonte, alinhado à direita no retângulo
        TextStyle st;
        st.font = font_by_handle(app, o.def->counter_font);
        st.rgb = o.bar_color1;
        st.flags = 2;
        st.alpha = o.alpha;
        SDL_FRect box{float(o.x - ox), float(o.y - oy), float(o.def->counter_w), float(o.def->counter_h)};
        draw_text(r, o.text_cache, counter_text(o.counter), st, box);
        return;
    }
    const auto& frames = o.def->counter_frames;
    if (frames.empty()) return;
    double v = o.counter;
    std::string s;
    if (std::floor(v) == v) s = std::to_string(int64_t(v));
    else {
        char buf[64];
        std::snprintf(buf, sizeof buf, "%g", v);
        s = buf;
    }
    double cx = o.x - ox;  // âncora no canto inferior direito
    for (auto it = s.rbegin(); it != s.rend(); ++it) {
        char ch = *it;
        int idx = ch >= '0' && ch <= '9' ? ch - '0' : ch == '-' ? 10 : ch == '+' ? 11 : ch == '.' ? 12 : ch == 'e' ? 13 : -1;
        if (idx < 0 || size_t(idx) >= frames.size() || frames[size_t(idx)] == 0xFFFF) continue;
        const ImageInfo* im = app.image(frames[size_t(idx)]);
        if (!im) continue;
        cx -= im->width;
        // desenha a partir do canto superior esquerdo (ignora o hotspot do dígito)
        draw_image(app, r, frames[size_t(idx)], cx + im->hot_x, o.y - oy - im->height + im->hot_y, 1, 1, 0,
                   o.alpha, o.rgb, o.def->ink_effect);
    }
}

}  // namespace

void Frame::draw(SDL_Renderer* r) {
    // fora do frame (e nas faixas do letterbox): preto; dentro: cor de fundo do frame
    SDL_SetRenderDrawColor(r, 0, 0, 0, 255);
    SDL_RenderClear(r);
    SDL_SetRenderDrawColor(r, Uint8(background >> 16), Uint8(background >> 8), Uint8(background), 255);
    SDL_FRect area{float(-scroll_x), float(-scroll_y), float(width), float(height)};
    SDL_RenderFillRectF(r, &area);
    std::vector<Obj*> list;
    for (int layer = 0; layer < int(def.layers.size()); ++layer) {
        const Layer& L = def.layers[size_t(layer)];
        if (!(L.flags & 0x10)) continue;  // camada oculta
        double ox = 0, oy = 0;
        layer_offset(layer, ox, oy);
        (void)L;
        list.clear();
        for (auto& o : objects) {
            if (o->layer != layer || !o->visible) continue;
            if (hidden_for_debug(o->oi)) continue;
            if (o->destroyed && !o->dying) continue;
            list.push_back(o.get());
        }
        std::stable_sort(list.begin(), list.end(), [](Obj* a, Obj* b) { return a->z < b->z; });
        for (Obj* o : list) {
            // Objeto inteiro fora da área do frame não aparece: no aparelho
            // original a tela nunca passa da borda do frame, e os jogos estacionam
            // ali contadores de controle (o "unlock" do Zorbié fica em y = -16 na
            // introdução, que tem 568 px de altura; na área visível de 600 px ele
            // aparecia como um "0" vermelho no canto).
            const Rect rr = obj_rect(app, *o);
            if (rr.x2 - ox <= area.x || rr.x1 - ox >= area.x + area.w || rr.y2 - oy <= area.y ||
                rr.y1 - oy >= area.y + area.h)
                continue;
            if (o->type == OBJ_ACTIVE) {
                if (o->image >= 0)
                    draw_image(app, r, o->image, o->x - ox, o->y - oy, o->scale_x, o->scale_y, o->angle,
                               o->alpha, o->rgb, o->def->ink_effect);
            } else if (o->type == OBJ_COUNTER || o->type == OBJ_SCORE || o->type == OBJ_LIVES) {
                draw_counter(app, r, *o, ox, oy);
            } else if (o->type == OBJ_TEXT && o->def) {
                // Fala do Zorbié ("String"): fonte, cor e alinhamento do parágrafo,
                // quebrando linha na largura do retângulo do objeto.
                TextStyle st;
                const auto& paras = o->def->paragraphs;
                st.font = font_by_handle(app, paras.empty() ? 0 : paras[0].font);
                st.flags = paras.empty() ? 0 : paras[0].flags;
                st.rgb = o->text_color;
                st.alpha = o->alpha;
                SDL_FRect box{float(o->x - ox), float(o->y - oy), float(o->def->text_w), float(o->def->text_h)};
                draw_text(r, o->text_cache, o->text, st, box);
            }
        }
    }
}

}  // namespace pb
```

## player/src/runtime/runtime.cpp

```cpp
#include "runtime/runtime.hpp"
#include "runtime/diag.hpp"

#include <algorithm>
#include <cmath>

namespace pb {
namespace {

constexpr double kPi = 3.14159265358979323846;
int g_uid = 0;

uint32_t colorref_to_rgb(uint32_t c) {
    return ((c & 0xFF) << 16) | (c & 0xFF00) | ((c >> 16) & 0xFF);
}

const std::vector<Obj*> kEmpty;

}  // namespace

// ================================================================== App
App::App(std::unique_ptr<Game> game, SDL_Renderer* renderer, Audio* audio, std::string save)
    : save_dir(std::move(save)), game_(std::move(game)), renderer_(renderer), audio_(audio) {
    for (int32_t v : game_->global_values) global_values.emplace_back(int64_t(v));
    global_strings = game_->global_strings;
    score = game_->initial_score;
    lives = game_->initial_lives;
    frame_rate = game_->frame_rate;
    view_w = game_->width;
    view_h = game_->height;
}

void choose_view(const Game& g, int screen_w, int screen_h, int& view_w, int& view_h) {
    view_w = g.width;
    view_h = g.height;
    if (screen_w <= 0 || screen_h <= 0 || g.width <= 0 || g.height <= 0) return;
    int max_w = g.width, max_h = g.height;
    for (const FrameDef& f : g.frames) {
        max_w = std::max(max_w, int(f.width));
        max_h = std::max(max_h, int(f.height));
    }
    double screen = double(screen_h) / screen_w, game = double(g.height) / g.width;
    if (screen > game) {   // tela mais alta que o jogo: mostra mais em cima/embaixo
        view_h = std::clamp(int(std::lround(g.width * screen)), g.height, max_h);
    } else {               // tela mais larga: mostra mais dos lados
        view_w = std::clamp(int(std::lround(g.height / screen)), g.width, max_w);
    }
}

App::~App() {
    frame_.reset();
    for (auto& [h, t] : textures_)
        if (t) SDL_DestroyTexture(t);
}

void App::queue_prefetch(const FrameDef& fd) {
    prefetch_.clear();
    std::unordered_set<int> seen;
    for (const Instance& in : fd.instances) {
        const ObjectDef* od = game_->object(in.oi);
        if (!od) continue;
        for (const Animation& a : od->anims)
            for (const AnimDir& d : a.dirs)
                for (uint16_t h : d.frames)
                    if (seen.insert(h).second && !textures_.count(h)) prefetch_.push_back(h);
        for (uint16_t h : od->counter_frames)
            if (h != 0xFFFF && seen.insert(h).second && !textures_.count(h)) prefetch_.push_back(h);
    }
    std::reverse(prefetch_.begin(), prefetch_.end());  // consumida do fim
}

void App::prefetch(double budget_ms) {
    if (prefetch_.empty() || !renderer_) return;
    Uint64 t0 = SDL_GetPerformanceCounter();
    const double freq = double(SDL_GetPerformanceFrequency());
    while (!prefetch_.empty()) {
        int h = prefetch_.back();
        prefetch_.pop_back();
        if (!textures_.count(h)) texture(h);
        if (double(SDL_GetPerformanceCounter() - t0) * 1000.0 / freq >= budget_ms) break;
    }
}

void App::reset_textures() {
    for (auto& [h, t] : textures_)
        if (t) SDL_DestroyTexture(t);
    textures_.clear();
    if (frame_) queue_prefetch(frame_->def);  // contexto gráfico recriado: recarrega aos poucos
}

const ImageInfo* App::image(int handle) const {
    auto it = game_->images.find(handle);
    return it == game_->images.end() ? nullptr : &it->second;
}

SDL_Texture* App::texture(int handle) {
    auto it = textures_.find(handle);
    if (it != textures_.end()) return it->second;
    SDL_Texture* tex = nullptr;
    if (const ImageInfo* im = image(handle); im && renderer_) {
        std::vector<uint8_t> rgba;
        Uint64 t0 = SDL_GetPerformanceCounter();
        bool ok = game_->decode_image(*im, rgba);
        if (!ok) dev.report(*this, "imagem que não decodifica", "imagem " + std::to_string(handle));
        if (audit.on) {
            double ms = double(SDL_GetPerformanceCounter() - t0) * 1000.0 / double(SDL_GetPerformanceFrequency());
            audit.decode_ms += ms;
            ++audit.decodes;
            if (ms > audit.worst_decode_ms) { audit.worst_decode_ms = ms; audit.worst_decode = handle; }
        }
        if (ok && im->width && im->height) {
            tex = SDL_CreateTexture(renderer_, SDL_PIXELFORMAT_RGBA32, SDL_TEXTUREACCESS_STATIC,
                                    im->width, im->height);
            if (tex) {
                SDL_UpdateTexture(tex, nullptr, rgba.data(), im->width * 4);
                SDL_SetTextureBlendMode(tex, SDL_BLENDMODE_BLEND);
            }
        }
    }
    textures_[handle] = tex;
    return tex;
}

const std::vector<uint8_t>* App::mask(int handle) {
    auto it = masks_.find(handle);
    if (it != masks_.end()) return &it->second;
    std::vector<uint8_t> m;
    if (const ImageInfo* im = image(handle)) {
        std::vector<uint8_t> rgba;
        if (game_->decode_image(*im, rgba)) {
            m.resize(size_t(im->width) * im->height);
            for (size_t i = 0; i < m.size(); ++i) m[i] = rgba[i * 4 + 3] > 0;
        }
    }
    return &(masks_[handle] = std::move(m));
}

void App::step() {
    if (!frame_ || next_frame_ >= 0) {
        int idx = next_frame_ >= 0 ? next_frame_ : 0;
        next_frame_ = -1;
        if (idx < 0 || idx >= int(game_->frames.size())) {
            dev.report(*this, "salto para frame inexistente (o jogo fecha)", "frame " + std::to_string(idx));
            quit_ = true;
            return;
        }
        frame_.reset();
        g_diag.stage = "iniciando frame";
        g_diag.frame = idx;
        frame_ = std::make_unique<Frame>(*this, idx);
        frame_->start();
        queue_prefetch(game_->frames[size_t(idx)]);
        SDL_Log("PortBridge: frame %d '%s'", idx, game_->frames[size_t(idx)].name.c_str());
    }
    if (paused) {
        // "Pausar aplicação" espera um toque. O passo que sai da pausa vê
        // "Aplicação retomada" (o Zorbié tira ali o painel de pausa e trata o
        // botão de voltar ao título); o toque que tira da pausa não vale como
        // clique no jogo.
        interrupted_flag = false;
        if (!input.clicked[0]) return;
        paused = false;
        resumed_flag = true;
        resume_pending = false;
        input.clicked[0] = false;
        input.dbl[0] = false;
    } else if (resume_pending && !interrupted_flag) {
        // Volta do segundo plano: no 1º passo o jogo vê só "interrompido" (o
        // Zorbié abre a pausa); "retomado" vem no passo seguinte ou, se o jogo
        // pausou, depois do toque. Juntos, o Zorbié abria e fechava o painel
        // de pausa no mesmo passo.
        resumed_flag = true;
        resume_pending = false;
    }
    store_failed = std::move(store_pending);  // resposta da loja: chega no passo seguinte ao pedido
    store_pending.clear();
    if (audit.on) {
        Uint64 t0 = SDL_GetPerformanceCounter();
        frame_->step();
        double ms = double(SDL_GetPerformanceCounter() - t0) * 1000.0 / double(SDL_GetPerformanceFrequency());
        if (frame_) {
            ++audit.loops[frame_->index];
            size_t& mo = audit.max_objects[frame_->index];
            mo = std::max(mo, frame_->objects.size());
            if (ms > 8.0 && audit.slow.size() < 200) {
                char buf[128];
                std::snprintf(buf, sizeof buf, "frame %d passo %lld: %.1f ms (%zu objetos)", frame_->index,
                              (long long)frame_->loop, ms, frame_->objects.size());
                audit.slow.push_back(buf);
            }
        }
    } else {
        frame_->step();
    }
    dev.after_step(*this);
    resumed_flag = false;
    interrupted_flag = false;
    store_failed.clear();
    flush_ini_files();
}

void App::draw() {
    if (frame_) frame_->draw(renderer_);
}

// ================================================================== Frame
Frame::Frame(App& a, int idx)
    : app(a), index(idx), def(a.game().frames[size_t(idx)]), width(def.width), height(def.height),
      background(colorref_to_rgb(def.background)) {}

void Frame::build_group_tree() {
    const auto& gs = def.events.groups;
    groups.assign(gs.size(), GroupInfo{});
    event_state.assign(gs.size(), EventState{});
    std::vector<int> stack;
    for (int i = 0; i < int(gs.size()); ++i) {
        if (gs[size_t(i)].conditions.empty()) continue;
        const EventItem& c0 = gs[size_t(i)].conditions[0];
        if (c0.type != OBJ_SYSTEM) continue;
        if (c0.num == -10) {
            GroupInfo& g = groups[size_t(i)];
            if (!c0.params.empty()) {
                g.id = c0.params[0].i1;
                g.active = !(c0.params[0].i0 & 1);  // "inativo no início"
            }
            g.parent = stack.empty() ? -1 : stack.back();
            g.end = int(gs.size()) - 1;
            group_by_id.emplace(g.id, i);
            group_by_offset.emplace(gs[size_t(i)].offset, i);
            stack.push_back(i);
        } else if (c0.num == -11 && !stack.empty()) {
            groups[size_t(stack.back())].end = i;
            stack.pop_back();
        }
    }
}

// Frame menor que a área visível fica centralizado (rolagem negativa).
static double clamp_scroll(double want, int frame, int view) {
    if (frame <= view) return (frame - view) / 2.0;
    return std::clamp(want, 0.0, double(frame - view));
}

void Frame::start() {
    build_group_tree();
    scroll_x = clamp_scroll(0, width, app.view_w);
    scroll_y = clamp_scroll(0, height, app.view_h);
    for (auto& [h, o] : app.game().objects) {
        for (int16_t q : o.qualifiers)
            if (q >= 0) qualifier_members[q].push_back(h);
    }
    for (const Instance& in : def.instances) {
        // tipo_pai != 0: modelo guardado pelo editor para "Criar objeto", não nasce no início.
        if (in.parent_type != 0) continue;
        const ObjectDef* od = app.game().object(in.oi);
        if (!od || !od->create_at_start()) continue;
        create(in.oi, in.x, in.y, in.layer);
    }
}

const std::vector<Obj*>& Frame::instances(int oi) {
    auto it = by_oi.find(oi);
    return it == by_oi.end() ? kEmpty : it->second;
}

std::vector<int> Frame::expand_oi(int oi) {
    if (oi & 0x8000) {
        auto it = qualifier_members.find(oi & 0x7FFF);
        return it == qualifier_members.end() ? std::vector<int>{} : it->second;
    }
    return {oi};
}

int dir_from_mask(App& app, uint32_t mask) {
    if (!mask) return 0;
    int bits[32], n = 0;
    for (int i = 0; i < 32; ++i)
        if (mask >> i & 1) bits[n++] = i;
    return n == 1 ? bits[0] : bits[app.rng()() % uint32_t(n)];
}

Obj* Frame::create(int oi, double x, double y, int layer) {
    const ObjectDef* od = app.game().object(oi);
    if (!od) return nullptr;
    auto o = std::make_unique<Obj>();
    o->uid = ++g_uid;
    o->oi = oi;
    o->def = od;
    o->type = od->type;
    o->x = x;
    o->y = y;
    o->layer = std::clamp(layer, 0, std::max(0, int(def.layers.size()) - 1));
    o->visible = od->is_extension() ? false : od->visible_at_start();
    o->values.assign(26, Value(0));
    for (size_t i = 0; i < od->values.size() && i < 26; ++i) o->values[i] = Value(int64_t(od->values[i]));
    o->strings.assign(10, std::string());
    for (size_t i = 0; i < od->strings.size() && i < 10; ++i) o->strings[i] = od->strings[i];
    if ((od->ink_effect & 0xFFFF) == 1) o->alpha = std::clamp(int(od->ink_param) * 2, 0, 255);
    o->counter = od->counter_init;
    o->counter_min = od->counter_min;
    o->counter_max = od->counter_max;
    o->bar_color1 = colorref_to_rgb(od->counter_color1);
    o->bar_color2 = colorref_to_rgb(od->fill_is_gradient() ? od->counter_color2 : od->counter_color1);
    if (!od->paragraphs.empty()) {
        o->text = od->paragraphs[0].text;
        o->text_color = colorref_to_rgb(od->paragraphs[0].color);
    }
    if (!od->movements.empty()) o->dir = dir_from_mask(app, od->movements[0].dirs_at_start);
    Obj* raw = o.get();
    for (const MovementDef& md : od->movements) o->movements.push_back(make_movement(raw, md));
    if (!od->movements.empty() && od->movements[0].move_at_start) o->movements[0]->start();
    o->appearing = od->anims.size() > ANIM_APPEARING && od->anims[ANIM_APPEARING].present;
    o->z = next_z++;
    o->prev_x = x;
    o->prev_y = y;
    set_obj_image(app, *o);
    by_oi[oi].push_back(raw);
    objects.push_back(std::move(o));
    return raw;
}

void Frame::destroy(Obj* o) {
    if (o->destroyed) return;
    o->destroyed = true;
    auto& v = by_oi[o->oi];
    v.erase(std::remove(v.begin(), v.end(), o), v.end());
    const ObjectDef* od = o->def;
    if (o->type == OBJ_ACTIVE && o->visible && od && od->anims.size() > ANIM_DISAPPEARING &&
        od->anims[ANIM_DISAPPEARING].present) {
        o->dying = true;
        o->movements.clear();
    }
}

void Frame::layer_offset(int layer, double& ox, double& oy) const {
    ox = scroll_x;
    oy = scroll_y;
    if (layer < 0 || size_t(layer) >= def.layers.size()) return;
    const Layer& L = def.layers[size_t(layer)];
    double bx = base_set ? base_x : scroll_x, by = base_set ? base_y : scroll_y;
    ox = bx + (scroll_x - bx) * L.x_coef;
    oy = by + (scroll_y - by) * L.y_coef;
}

void Frame::center_display_x(double x) {
    scroll_x = clamp_scroll(x - app.view_w / 2.0, width, app.view_w);
}

void Frame::center_display_y(double y) {
    scroll_y = clamp_scroll(y - app.view_h / 2.0, height, app.view_h);
}

void Frame::update_objects() {
    int dt = 1000 / std::max(1, app.frame_rate);
    for (size_t i = 0; i < objects.size(); ++i) {
        Obj* o = objects[i].get();
        if (o->destroyed && !o->dying) continue;
        o->prev_x = o->x;
        o->prev_y = o->y;
        if (Movement* m = o->mv()) m->update();
        if (o->flash_period > 0) {
            o->flash_timer += dt;
            if (o->flash_timer >= o->flash_period) {
                o->flash_timer -= o->flash_period;
                o->visible = !o->visible;
            }
        }
        update_animation(app, *o);
    }
}

void Frame::cleanup() {
    objects.erase(std::remove_if(objects.begin(), objects.end(),
                                 [](const std::unique_ptr<Obj>& o) { return o->destroyed && !o->dying; }),
                  objects.end());
}

void Frame::step() {
    timer_acc += 1000.0 / std::max(1, app.frame_rate);
    timer_ms = uint32_t(timer_acc);
    ++loop;
    g_diag.loop = long(loop);
    g_diag.stage = "movimentos e animações";
    update_objects();
    g_diag.stage = "eventos";
    run_events(*this);
    if (!base_set) {
        base_x = scroll_x;
        base_y = scroll_y;
        base_set = true;
    }
    g_diag.stage = "limpeza";
    cleanup();
    g_diag.stage = "desenho";
}

// ================================================================== animação
static const AnimDir* pick_dir(const Animation& a, int want) {
    for (int k = 0; k <= 16; ++k) {
        const AnimDir& d1 = a.dirs[size_t((want + k) & 31)];
        if (d1.present && !d1.frames.empty()) return &d1;
        const AnimDir& d2 = a.dirs[size_t((want - k) & 31)];
        if (d2.present && !d2.frames.empty()) return &d2;
    }
    return nullptr;
}

static int pick_anim(const ObjectDef& od, int want) {
    auto has = [&](int i) { return i >= 0 && i < int(od.anims.size()) && od.anims[size_t(i)].present; };
    if (has(want)) return want;
    // equivalências do Clickteam: correndo -> andando -> parado
    if (want == ANIM_RUNNING && has(ANIM_WALKING)) return ANIM_WALKING;
    if (has(ANIM_STOPPED)) return ANIM_STOPPED;
    for (int i = 0; i < int(od.anims.size()); ++i)
        if (has(i)) return i;
    return -1;
}

void set_obj_image(App& app, Obj& o) {
    (void)app;
    if (o.type != OBJ_ACTIVE || !o.def) return;
    int a = pick_anim(*o.def, o.anim);
    if (a < 0) return;
    const AnimDir* d = pick_dir(o.def->anims[size_t(a)], o.forced_dir >= 0 ? o.forced_dir : o.dir);
    if (!d) return;
    int f = std::clamp(o.forced_frame >= 0 ? o.forced_frame : o.frame, 0, int(d->frames.size()) - 1);
    o.image = d->frames[size_t(f)];
}

void update_animation(App& app, Obj& o) {
    o.anim_finished = -1;
    if (o.type != OBJ_ACTIVE || !o.def || o.def->anims.empty()) return;
    const ObjectDef& od = *o.def;
    int want;
    if (o.dying) want = ANIM_DISAPPEARING;
    else if (o.forced_anim >= 0) want = o.forced_anim;
    else if (o.appearing) want = ANIM_APPEARING;
    else if (o.mv() && o.speed() > 0) want = ANIM_WALKING;
    else want = ANIM_STOPPED;
    int a = pick_anim(od, want);
    if (a < 0) return;
    if (a != o.anim) {
        o.anim = a;
        o.frame = 0;
        o.anim_counter = 0;
        o.anim_loops = 0;
        o.anim_done = false;
    }
    const AnimDir* d = pick_dir(od.anims[size_t(a)], o.forced_dir >= 0 ? o.forced_dir : o.dir);
    if (!d) return;
    int n = int(d->frames.size());
    if (o.forced_frame >= 0) {
        if (o.forced_frame >= n)
            app.dev.report(app, "quadro forçado inexistente", od.name + " anim " + std::to_string(a) + " quadro " +
                           std::to_string(o.forced_frame) + " de " + std::to_string(n));
        o.frame = std::min(o.forced_frame, n - 1);
    } else if (!o.anim_stopped && !o.anim_done) {
        int sp = d->max_speed;
        if (o.forced_speed >= 0) sp = o.forced_speed;
        else if (a == ANIM_WALKING || a == ANIM_RUNNING) {
            int mvs = std::clamp(o.speed(), 0, 100);
            sp = d->min_speed + (d->max_speed - d->min_speed) * mvs / 100;
        }
        o.anim_counter += sp;
        while (o.anim_counter >= 100) {
            o.anim_counter -= 100;
            if (++o.frame >= n) {
                if (d->repeat == 0) {
                    o.frame = d->back_to < n ? d->back_to : 0;
                } else if (++o.anim_loops >= d->repeat) {
                    o.frame = n - 1;
                    o.anim_done = true;
                    o.anim_finished = a;
                    break;
                } else {
                    o.frame = d->back_to < n ? d->back_to : 0;
                }
            }
        }
    }
    if (o.frame >= n) o.frame = n - 1;
    o.image = d->frames[size_t(o.frame)];
    if (o.anim_finished == ANIM_APPEARING) o.appearing = false;
    if (o.dying && o.anim_finished == ANIM_DISAPPEARING) o.dying = false;  // removido no cleanup
    (void)app;
}

// ================================================================== geometria
Rect obj_rect(App& app, const Obj& o) {
    if (o.type == OBJ_ACTIVE && o.image >= 0) {
        if (const ImageInfo* im = app.image(o.image)) {
            double sx = std::fabs(o.scale_x), sy = std::fabs(o.scale_y);
            double x1 = -im->hot_x * sx, y1 = -im->hot_y * sy;
            double x2 = x1 + im->width * sx, y2 = y1 + im->height * sy;
            if (o.angle != 0) {
                double a = -o.angle * kPi / 180.0, ca = std::cos(a), sa = std::sin(a);
                double xs[4] = {x1, x2, x2, x1}, ys[4] = {y1, y1, y2, y2};
                double mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
                for (int i = 0; i < 4; ++i) {
                    double rx = xs[i] * ca - ys[i] * sa, ry = xs[i] * sa + ys[i] * ca;
                    mnx = std::min(mnx, rx); mxx = std::max(mxx, rx);
                    mny = std::min(mny, ry); mxy = std::max(mxy, ry);
                }
                return {o.x + mnx, o.y + mny, o.x + mxx, o.y + mxy};
            }
            return {o.x + x1, o.y + y1, o.x + x2, o.y + y2};
        }
    }
    if ((o.type == OBJ_COUNTER || o.type == OBJ_SCORE || o.type == OBJ_LIVES) && o.def) {
        double w = o.def->counter_w, h = o.def->counter_h;
        // números/animação: ponto quente no canto inferior direito; barra e texto:
        // no canto superior esquerdo (a barra de super do Zorbié fica dentro da
        // moldura só assim).
        if (o.def->counter_display == 2 || o.def->counter_display == 3 || o.def->counter_display == 5)
            return {o.x, o.y, o.x + w, o.y + h};
        return {o.x - w, o.y - h, o.x, o.y};
    }
    if (o.type == OBJ_TEXT && o.def) return {o.x, o.y, o.x + o.def->text_w, o.y + o.def->text_h};
    return {o.x, o.y, o.x + 1, o.y + 1};
}

bool overlap(App& app, const Obj& a, const Obj& b) {
    Rect ra = obj_rect(app, a), rb = obj_rect(app, b);
    double x1 = std::max(ra.x1, rb.x1), y1 = std::max(ra.y1, rb.y1);
    double x2 = std::min(ra.x2, rb.x2), y2 = std::min(ra.y2, rb.y2);
    if (x1 >= x2 || y1 >= y2) return false;
    // Teste por pixel quando os dois estão sem rotação/escala.
    bool simple = a.type == OBJ_ACTIVE && b.type == OBJ_ACTIVE && a.angle == 0 && b.angle == 0 &&
                  a.scale_x == 1 && a.scale_y == 1 && b.scale_x == 1 && b.scale_y == 1 &&
                  a.image >= 0 && b.image >= 0;
    if (!simple) return true;
    const ImageInfo* ia = app.image(a.image);
    const ImageInfo* ib = app.image(b.image);
    const auto* ma = app.mask(a.image);
    const auto* mb = app.mask(b.image);
    if (!ia || !ib || ma->empty() || mb->empty()) return true;
    for (int y = int(std::floor(y1)); y < int(std::ceil(y2)); ++y) {
        int ay = y - int(std::floor(ra.y1)), by = y - int(std::floor(rb.y1));
        if (ay < 0 || by < 0 || ay >= ia->height || by >= ib->height) continue;
        for (int x = int(std::floor(x1)); x < int(std::ceil(x2)); ++x) {
            int ax = x - int(std::floor(ra.x1)), bx = x - int(std::floor(rb.x1));
            if (ax < 0 || bx < 0 || ax >= ia->width || bx >= ib->width) continue;
            if ((*ma)[size_t(ay) * ia->width + size_t(ax)] && (*mb)[size_t(by) * ib->width + size_t(bx)])
                return true;
        }
    }
    return false;
}

}  // namespace pb
```

## player/src/runtime/runtime.hpp

```cpp
// Runtime que interpreta jogos Clickteam diretamente a partir dos dados (.cci/.ccn).
// Roda igual em Android, Linux, Windows e macOS: toda a parte de plataforma fica no SDL.
#pragma once
#include <SDL.h>

#include <functional>
#include <map>
#include <memory>
#include <random>
#include <set>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

#include "core/game.hpp"
#include "runtime/devcheck.hpp"
#include "runtime/value.hpp"

namespace pb {

class App;
struct Obj;
class Audio;

// ---------------------------------------------------------------- movimentos
struct Movement {
    explicit Movement(Obj* o) : obj(o) {}
    virtual ~Movement() = default;
    virtual void update() {}
    virtual void start() { stopped = false; }
    virtual void stop() { stopped = true; }
    virtual void bounce() {}
    virtual void set_speed(int s) { speed = s; }
    virtual int get_speed() const { return stopped ? 0 : speed; }
    virtual void set_direction(int dir);
    virtual bool finished() const { return false; }
    virtual void set_deceleration(int) {}
    Obj* obj;
    int speed = 0;
    bool stopped = false;
};

std::unique_ptr<Movement> make_movement(Obj* o, const MovementDef& def);

// ---------------------------------------------------------------- objetos
enum AnimId { ANIM_STOPPED = 0, ANIM_WALKING = 1, ANIM_RUNNING = 2, ANIM_APPEARING = 3,
              ANIM_DISAPPEARING = 4 };

struct Obj {
    int uid = 0;
    int oi = 0;
    const ObjectDef* def = nullptr;
    int type = 0;
    double x = 0, y = 0;
    int layer = 0;
    bool visible = true;
    bool destroyed = false;   // remover no fim do loop
    bool dying = false;       // tocando a animação "Disappearing"
    int z = 0;                // ordem de desenho dentro da camada

    // animação
    int anim = 0, dir = 0, frame = 0;
    int anim_counter = 0, anim_loops = 0;
    bool anim_stopped = false;
    bool anim_done = false;    // animação sem repetição chegou ao fim
    bool appearing = false;    // tocando "Appearing" logo após a criação
    int anim_finished = -1;    // animação que terminou neste loop
    int forced_anim = -1, forced_frame = -1, forced_speed = -1, forced_dir = -1;
    int image = -1;

    // aparência
    float scale_x = 1, scale_y = 1, angle = 0;
    int alpha = 0;              // coeficiente alfa Clickteam: 0 = opaco, 255 = invisível
    uint32_t rgb = 0xFFFFFF;    // coeficiente RGB (0xRRGGBB)
    int flash_period = 0, flash_timer = 0;

    // dados
    std::vector<Value> values;
    std::vector<std::string> strings;
    uint32_t flags = 0;

    // movimento
    std::vector<std::unique_ptr<Movement>> movements;
    int mv_index = 0;
    Movement* mv() const { return movements.empty() ? nullptr : movements[size_t(mv_index)].get(); }
    double prev_x = 0, prev_y = 0;

    // contador
    double counter = 0, counter_min = 0, counter_max = 0;
    uint32_t bar_color1 = 0, bar_color2 = 0;  // barra/texto (0xRRGGBB); mudam por ação
    // texto
    std::string text;
    uint32_t text_color = 0;
    std::shared_ptr<void> text_cache;   // textura do texto já rasterizado (render.cpp)

    // estado por extensão (INI etc.)
    std::shared_ptr<void> ext;

    int speed() const { return mv() ? mv()->get_speed() : 0; }
    bool is_active() const { return type == OBJ_ACTIVE; }
};

// ---------------------------------------------------------------- frame
struct GroupInfo {
    int id = -1;
    int end = -1;          // índice do GroupEnd correspondente
    int parent = -1;       // índice do NewGroup pai
    bool active = true;
    bool just_activated = false;
};

struct EventState {
    int64_t not_always_stamp = -10;
    int64_t once_stamp = -10;
    bool once_done = false;
    int repeat_count = 0;
    uint32_t every_last = 0;
    bool timer_equals_done = false;
    uint32_t restrict_last = 0;
};

class Frame {
public:
    Frame(App& app, int index);
    void start();
    void step();                    // um loop de jogo
    void draw(SDL_Renderer* r);

    App& app;
    int index;
    const FrameDef& def;
    int width, height;
    uint32_t background;            // 0xRRGGBB
    double scroll_x = 0, scroll_y = 0;
    // Rolagem logo depois do início do frame (eventos "início do frame" já
    // rodaram). Camadas com coeficiente de paralaxe se movem a partir daqui:
    // deslocamento = base + (rolagem - base) * coeficiente. Assim uma camada
    // com coeficiente 0 fica onde estava quando o frame apareceu (no Zorbié, a
    // introdução e o fundo ficam centralizados depois do CenterDisplayX).
    double base_x = 0, base_y = 0;
    bool base_set = false;
    void layer_offset(int layer, double& ox, double& oy) const;
    uint32_t timer_ms = 0;          // tempo desde o início do frame
    double timer_acc = 0;
    int64_t loop = 0;

    std::vector<std::unique_ptr<Obj>> objects;
    std::unordered_map<int, std::vector<Obj*>> by_oi;
    std::vector<GroupInfo> groups;          // por índice de grupo de evento (só marcadores)
    std::multimap<int, int> group_by_id;    // id -> índice do NewGroup
    // posição no arquivo -> índice do NewGroup. Os "group pointers" das ações
    // apontam por posição (param + ponteiro): ids podem se repetir (behaviors).
    std::unordered_map<uint32_t, int> group_by_offset;
    std::vector<EventState> event_state;
    std::map<int, std::vector<int>> qualifier_members;  // qualificador -> lista de oi

    Obj* create(int oi, double x, double y, int layer);
    void destroy(Obj* o);
    const std::vector<Obj*>& instances(int oi);
    std::vector<int> expand_oi(int oi_or_qualifier);
    void center_display_x(double x);
    void center_display_y(double y);
    int next_z = 0;

private:
    void build_group_tree();
    void update_objects();
    void cleanup();
};

// ---------------------------------------------------------------- app
struct InputState {
    int mouse_x = 0, mouse_y = 0;   // coordenadas lógicas da janela
    bool down[3] = {false, false, false};
    bool clicked[3] = {false, false, false};    // clique neste loop
    bool dbl[3] = {false, false, false};
    bool back_pressed = false;
};

class App {
public:
    App(std::unique_ptr<Game> game, SDL_Renderer* renderer, Audio* audio, std::string save_dir);
    ~App();
    void step();
    void draw();
    bool finished() const { return quit_; }

    Game& game() { return *game_; }
    const Game& game() const { return *game_; }
    Frame* frame() { return frame_.get(); }
    SDL_Renderer* renderer() { return renderer_; }
    Audio* audio() { return audio_; }
    SDL_Texture* texture(int image_handle);
    const ImageInfo* image(int handle) const;
    const std::vector<uint8_t>* mask(int image_handle);  // alfa > 0, 1 byte por pixel

    void request_frame(int index) { next_frame_ = index; }
    void quit() { quit_ = true; }
    std::mt19937& rng() { return rng_; }

    std::vector<Value> global_values;
    std::vector<std::string> global_strings;
    int score = 0, lives = 3;
    InputState input;
    std::string save_dir;
    bool paused = false;
    bool resumed_flag = false;
    bool interrupted_flag = false;  // voltou do segundo plano (condições 1 e 2 do objeto "iOS")
    bool resume_pending = false;    // "aplicação retomada" a entregar depois do passo da interrupção
    std::string store_pending, store_failed;  // compra pedida à loja da Apple / falha entregue neste passo
    int frame_rate = 60;
    // Área visível ("janela" do Clickteam) em unidades do jogo. Começa no tamanho
    // declarado pelo jogo (ex.: 320x480) e pode crescer até o tamanho dos frames
    // para acompanhar o formato da tela (ver choose_view).
    int view_w = 0, view_h = 0;
    std::map<std::string, int> unimplemented;   // "Active.Foo" -> vezes (para relatório)
    void note_unimplemented(const std::string& what) {
        if (++unimplemented[what] == 1) SDL_Log("não implementado: %s", what.c_str());
    }
    void reset_textures();
    // Pré-carregamento: as imagens dos objetos do frame atual viram textura aos
    // poucos (até `budget_ms` por chamada), para um objeto que aparece pela
    // primeira vez no meio do jogo não travar a tela criando a sua.
    void queue_prefetch(const FrameDef& fd);
    void prefetch(double budget_ms);

    // Auditoria (--audit, só para testes): quantas vezes cada grupo de eventos
    // disparou em cada frame, passos lentos e custo de decodificar imagens.
    struct Audit {
        bool on = false;
        std::map<int, std::vector<uint32_t>> fired;   // frame -> disparos por grupo
        std::map<int, uint64_t> loops;                // frame -> passos jogados
        std::map<int, size_t> max_objects;            // frame -> pico de objetos
        std::vector<std::string> slow;                // passos acima de 8 ms
        double decode_ms = 0, worst_decode_ms = 0;
        int decodes = 0, worst_decode = -1;
    } audit;
    DevCheck dev;  // modo desenvolvedor (--dev)

private:
    std::unique_ptr<Game> game_;
    SDL_Renderer* renderer_;
    Audio* audio_;
    std::unique_ptr<Frame> frame_;
    int next_frame_ = -1;
    bool quit_ = false;
    std::unordered_map<int, SDL_Texture*> textures_;
    std::vector<int> prefetch_;
    std::unordered_map<int, std::vector<uint8_t>> masks_;
    std::mt19937 rng_{1234567u};
};

// Escolhe a área visível para uma tela de screen_w x screen_h pixels: mantém a
// largura (jogo em retrato) ou a altura (paisagem) do jogo e estende o outro
// lado até o maior frame, como o runtime do iOS faz no iPhone 5 e no iPad.
void choose_view(const Game& g, int screen_w, int screen_h, int& view_w, int& view_h);

// ---------------------------------------------------------------- eventos
void run_events(Frame& f);

// Seleção de instâncias durante a avaliação de um grupo de eventos.
struct Selection {
    std::unordered_map<int, std::vector<Obj*>> sel;  // por oi real
    std::unordered_set<int> touched;
};

struct EvalContext {
    Frame& f;
    Selection& s;
    Obj* current = nullptr;   // instância em foco (ação/condição por instância)
    int current_oi = -1;
    int loop_index = -1;      // nº da instância na ação em andamento (pareamento)
    int event_index = -1;     // grupo de eventos em avaliação (modo desenvolvedor)
};

Value eval_expr(EvalContext& c, const std::vector<Expr>& ex);
std::vector<Obj*> targets(EvalContext& c, int oi);           // seleção ou todas
Obj* first_target(EvalContext& c, int oi);
Obj* paired_target(EvalContext& c, int oi);

// Extensões (INI, AdvDir, stubs do iOS).
bool ext_condition(EvalContext& c, const EventItem& it, Obj* o, bool& handled);
void ext_action(EvalContext& c, const EventItem& it, Obj* o);
Value ext_expression(EvalContext& c, const Expr& e, const std::vector<Value>& args, bool& handled);
int ext_expression_arity(const Game& g, const Expr& e);
// Grava os INIs alterados (fim do passo, troca de frame, pausa, saída).
void flush_ini_files();

// Geometria / colisão
struct Rect { double x1, y1, x2, y2; };
Rect obj_rect(App& app, const Obj& o);
bool overlap(App& app, const Obj& a, const Obj& b);
void update_animation(App& app, Obj& o);
void set_obj_image(App& app, Obj& o);
int dir_from_mask(App& app, uint32_t mask);

}  // namespace pb
```

## player/src/runtime/screen.cpp

```cpp
#include "runtime/screen.hpp"

#include <algorithm>
#include <cmath>

namespace pb {

namespace {

SDL_Texture* make_target(SDL_Renderer* r, int w, int h) {
    SDL_Texture* t = SDL_CreateTexture(r, SDL_PIXELFORMAT_RGBA8888, SDL_TEXTUREACCESS_TARGET, w, h);
    if (t) {
        SDL_SetTextureScaleMode(t, SDL_ScaleModeLinear);
        SDL_SetTextureBlendMode(t, SDL_BLENDMODE_NONE);
    }
    return t;
}

}  // namespace

void Screen::free_chain(Chain& c) {
    for (SDL_Texture* t : c.tex)
        if (t) SDL_DestroyTexture(t);
    c.tex.clear();
    c.size.clear();
}

void Screen::release() {
    if (game_) SDL_DestroyTexture(game_);
    game_ = nullptr;
    tex_w_ = tex_h_ = 0;
    for (Chain& c : chains_) free_chain(c);
}

void Screen::configure(int view_w, int view_h) {
    band_tick_ = 0;   // refaz as faixas no próximo quadro
    view_w_ = std::max(1, view_w);
    view_h_ = std::max(1, view_h);
    SDL_GetRendererOutputSize(r_, &out_w_, &out_h_);
    if (out_w_ <= 0 || out_h_ <= 0) {
        out_w_ = view_w_;
        out_h_ = view_h_;
    }
    double s = std::min(double(out_w_) / view_w_, double(out_h_) / view_h_);
    int gw = std::max(1, int(std::lround(view_w_ * s)));
    int gh = std::max(1, int(std::lround(view_h_ * s)));
    game_rect = {(out_w_ - gw) / 2, (out_h_ - gh) / 2, gw, gh};
    // O jogo é desenhado numa escala INTEIRA (ex.: 4x) e depois reduzido para o
    // tamanho da tela. Escalar direto por um fator quebrado (3,375x) deixa linhas
    // de 1 pixel com espessuras alternadas (moiré nas listras da introdução do
    // Zorbié); com escala inteira toda linha fica igual e a redução final é suave.
    int k = std::max(1, int(std::ceil(s - 1e-6)));
    k = std::min(k, 8);
    int tw = view_w_ * k, th = view_h_ * k;
    if (!game_ || tw != tex_w_ || th != tex_h_) {
        release();
        game_ = make_target(r_, tw, th);
        tex_w_ = tw;
        tex_h_ = th;
    }
}

void Screen::begin() {
    if (!game_) configure(view_w_, view_h_);
    SDL_SetRenderTarget(r_, game_);
    SDL_RenderSetScale(r_, float(tex_w_) / view_w_, float(tex_h_) / view_h_);
}

// Faixa de preenchimento: pega uma tira fina encostada na borda do jogo,
// desfoca só ao longo da borda (reduções pela metade) e estica até a faixa,
// de modo que as cores da borda continuem até a beira da tela.
void Screen::band(const SDL_Rect& src, const SDL_Rect& dst, bool along_x, Chain& chain, bool refresh) {
    if (src.w <= 0 || src.h <= 0 || dst.w <= 0 || dst.h <= 0) return;
    std::vector<SDL_Point> sizes;
    int w = src.w, h = src.h;
    do {
        if (along_x) w = std::max(1, w / 2);
        else h = std::max(1, h / 2);
        sizes.push_back({w, h});
    } while ((along_x ? w : h) > 24 && sizes.size() < 10);
    bool same = sizes.size() == chain.size.size();
    for (size_t i = 0; same && i < sizes.size(); ++i)
        same = sizes[i].x == chain.size[i].x && sizes[i].y == chain.size[i].y;
    if (!same) {
        free_chain(chain);
        for (const SDL_Point& p : sizes) chain.tex.push_back(make_target(r_, p.x, p.y));
        chain.size = sizes;
    }
    for (SDL_Texture* t : chain.tex)
        if (!t) return;
    // O desfoque só é refeito de tempos em tempos (a borda muda devagar e
    // borrada); nos outros quadros a última versão é reaproveitada.
    if (refresh || !same) {
        SDL_SetRenderTarget(r_, chain.tex[0]);
        SDL_RenderCopy(r_, game_, &src, nullptr);
        for (size_t i = 1; i < chain.tex.size(); ++i) {
            SDL_SetRenderTarget(r_, chain.tex[i]);
            SDL_RenderCopy(r_, chain.tex[i - 1], nullptr, nullptr);
        }
        SDL_SetRenderTarget(r_, nullptr);
    }
    SDL_RenderCopy(r_, chain.tex.back(), nullptr, &dst);
}

// Escurece a faixa aos poucos: transparente junto do jogo, mais escura na beira.
static void fade(SDL_Renderer* r, const SDL_Rect& bar, int edge /*0 cima 1 baixo 2 esq 3 dir*/) {
    const int steps = 24;
    bool vertical = edge < 2;
    int len = vertical ? bar.h : bar.w;
    for (int i = 0; i < steps; ++i) {
        int a0 = len * i / steps, a1 = len * (i + 1) / steps;
        if (a1 <= a0) continue;
        // i = 0 encosta no jogo
        Uint8 alpha = Uint8(20 + 170 * i / (steps - 1));
        SDL_Rect s;
        switch (edge) {
            case 0: s = {bar.x, bar.y + bar.h - a1, bar.w, a1 - a0}; break;
            case 1: s = {bar.x, bar.y + a0, bar.w, a1 - a0}; break;
            case 2: s = {bar.x + bar.w - a1, bar.y, a1 - a0, bar.h}; break;
            default: s = {bar.x + a0, bar.y, a1 - a0, bar.h}; break;
        }
        SDL_SetRenderDrawColor(r, 0, 0, 0, alpha);
        SDL_RenderFillRect(r, &s);
    }
}

void Screen::end() {
    SDL_SetRenderTarget(r_, nullptr);
    SDL_RenderSetScale(r_, 1, 1);
    SDL_SetRenderDrawBlendMode(r_, SDL_BLENDMODE_NONE);
    SDL_SetRenderDrawColor(r_, 0, 0, 0, 255);
    SDL_RenderClear(r_);
    if (!game_) return;

    // sobras de 1-2 px (arredondamento) não viram faixa
    if (game_rect.y <= 2 && out_h_ - (game_rect.y + game_rect.h) <= 2) { game_rect.y = 0; game_rect.h = out_h_; }
    if (game_rect.x <= 2 && out_w_ - (game_rect.x + game_rect.w) <= 2) { game_rect.x = 0; game_rect.w = out_w_; }
    const SDL_Rect& g = game_rect;
    if (ambient) {
        // tira de ~2 linhas do jogo junto de cada borda
        int th = std::max(1, tex_h_ / 200), tw = std::max(1, tex_w_ / 200);
        int below = out_h_ - (g.y + g.h), right = out_w_ - (g.x + g.w);
        SDL_Rect bars[4] = {{0, 0, out_w_, g.y},
                            {0, g.y + g.h, out_w_, below},
                            {0, 0, g.x, out_h_},
                            {g.x + g.w, 0, right, out_h_}};
        bool refresh = band_tick_++ % 3 == 0;
        if (g.y > 0) band({0, 0, tex_w_, th}, bars[0], true, chains_[0], refresh);
        if (below > 0) band({0, tex_h_ - th, tex_w_, th}, bars[1], true, chains_[1], refresh);
        if (g.x > 0) band({0, 0, tw, tex_h_}, bars[2], false, chains_[2], refresh);
        if (right > 0) band({tex_w_ - tw, 0, tw, tex_h_}, bars[3], false, chains_[3], refresh);
        SDL_SetRenderDrawBlendMode(r_, SDL_BLENDMODE_BLEND);
        if (g.y > 0) fade(r_, bars[0], 0);
        if (below > 0) fade(r_, bars[1], 1);
        if (g.x > 0) fade(r_, bars[2], 2);
        if (right > 0) fade(r_, bars[3], 3);
        SDL_SetRenderDrawBlendMode(r_, SDL_BLENDMODE_NONE);
    }
    SDL_RenderCopy(r_, game_, nullptr, &game_rect);
}

void Screen::to_game(int wx, int wy, SDL_Window* win, int& gx, int& gy) const {
    int ww = 0, wh = 0;
    SDL_GetWindowSize(win, &ww, &wh);
    double px = ww > 0 ? double(wx) * out_w_ / ww : wx;   // pontos -> pixels (telas HiDPI)
    double py = wh > 0 ? double(wy) * out_h_ / wh : wy;
    if (game_rect.w <= 0 || game_rect.h <= 0) {
        gx = int(px);
        gy = int(py);
        return;
    }
    gx = int(std::floor((px - game_rect.x) * view_w_ / game_rect.w));
    gy = int(std::floor((py - game_rect.y) * view_h_ / game_rect.h));
}

}  // namespace pb
```

## player/src/runtime/screen.hpp

```cpp
// Composição do jogo na tela do aparelho.
//
// O jogo é desenhado numa textura em escala inteira (sem moiré em linhas finas),
// reduzido para o tamanho que ocupa na tela e colocado no centro, sem deformar.
// As sobras (faixas em cima/embaixo ou dos lados, quando o formato da tela não
// bate com o do jogo) não ficam pretas: continuam as cores da borda do jogo,
// escurecendo aos poucos até a beira da tela.
// Os toques são convertidos para coordenadas do jogo, inclusive nas faixas.
#pragma once

#include <SDL.h>

#include <vector>

namespace pb {

class Screen {
public:
    explicit Screen(SDL_Renderer* r) : r_(r) {}
    ~Screen() { release(); }
    Screen(const Screen&) = delete;
    Screen& operator=(const Screen&) = delete;

    // Área visível do jogo (unidades do jogo); refaz o cálculo pelo tamanho atual da saída.
    void configure(int view_w, int view_h);
    void begin();   // passa a desenhar o jogo (unidades do jogo)
    void end();     // compõe na janela (faixas + jogo)
    // Ponto da janela (coordenadas de evento do SDL) -> unidades do jogo.
    void to_game(int wx, int wy, SDL_Window* win, int& gx, int& gy) const;
    void release(); // destrói as texturas (contexto gráfico perdido)

    bool ambient = true;      // false: faixas pretas
    SDL_Rect game_rect{};     // onde o jogo fica na saída (pixels)

private:
    struct Chain {           // reduções sucessivas pela metade = desfoque barato e estável
        std::vector<SDL_Texture*> tex;
        std::vector<SDL_Point> size;
    };
    void band(const SDL_Rect& src, const SDL_Rect& dst, bool along_x, Chain& chain, bool refresh);
    static void free_chain(Chain& c);

    SDL_Renderer* r_;
    SDL_Texture* game_ = nullptr;
    int tex_w_ = 0, tex_h_ = 0, view_w_ = 0, view_h_ = 0, out_w_ = 0, out_h_ = 0;
    Chain chains_[4];   // cima, baixo, esquerda, direita
    unsigned band_tick_ = 0;
};

}  // namespace pb
```

## player/src/runtime/text.cpp

```cpp
#include "runtime/text.hpp"

#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <vector>

#define STB_TRUETYPE_IMPLEMENTATION
#define STBTT_STATIC
#include "stb_truetype.h"

// Gerados pelo CMake a partir de third_party/fonts (Liberation Sans, licença OFL).
extern const unsigned char pb_font_regular[];
extern const unsigned char pb_font_bold[];

namespace pb {
namespace {

struct Face {
    stbtt_fontinfo info{};
    bool ok = false;
};

Face& face(bool bold) {
    static Face faces[2];
    static bool init = false;
    if (!init) {
        init = true;
        faces[0].ok = stbtt_InitFont(&faces[0].info, pb_font_regular, 0) != 0;
        faces[1].ok = stbtt_InitFont(&faces[1].info, pb_font_bold, 0) != 0;
    }
    return faces[bold ? 1 : 0].ok ? faces[bold ? 1 : 0] : faces[0];
}

std::vector<uint32_t> utf8(const std::string& s) {
    std::vector<uint32_t> out;
    for (size_t i = 0; i < s.size();) {
        unsigned char c = static_cast<unsigned char>(s[i]);
        uint32_t cp = c;
        int n = 0;
        if (c >= 0xF0) { cp = c & 0x07; n = 3; }
        else if (c >= 0xE0) { cp = c & 0x0F; n = 2; }
        else if (c >= 0xC0) { cp = c & 0x1F; n = 1; }
        bool bad = false;
        for (int k = 1; k <= n; ++k) {
            if (i + size_t(k) >= s.size() || (static_cast<unsigned char>(s[i + size_t(k)]) & 0xC0) != 0x80) {
                bad = true;
                break;
            }
            cp = (cp << 6) | (static_cast<unsigned char>(s[i + size_t(k)]) & 0x3F);
        }
        if (bad) { cp = c; n = 0; }  // Latin-1 solto
        out.push_back(cp);
        i += size_t(n) + 1;
    }
    return out;
}

struct Cached {
    SDL_Texture* tex = nullptr;
    std::string key;
    int w = 0, h = 0;
    float k = 1;
    ~Cached() {
        if (tex) SDL_DestroyTexture(tex);
    }
};

struct Line {
    std::vector<uint32_t> cps;
    float width = 0;
};

}  // namespace

void draw_text(SDL_Renderer* r, std::shared_ptr<void>& cache, const std::string& text, const TextStyle& st,
               const SDL_FRect& box) {
    if (text.empty()) return;
    float sx = 1, sy = 1;
    SDL_RenderGetScale(r, &sx, &sy);
    const float k = std::max(1.0f, std::max(sx, sy));  // pixels por unidade do jogo
    const bool bold = st.font && st.font->weight >= 600;
    const float em = st.font && st.font->height ? float(std::abs(st.font->height)) : 13.0f;

    char hdr[96];
    std::snprintf(hdr, sizeof hdr, "%d|%.2f|%.2f|%.1f|%.1f|%u|", int(bold), em, k, box.w, box.h, unsigned(st.flags));
    std::string key = std::string(hdr) + text;
    if (!cache) cache = std::make_shared<Cached>();
    Cached& c = *static_cast<Cached*>(cache.get());

    if (c.key != key || !c.tex) {
        if (c.tex) SDL_DestroyTexture(c.tex);
        c.tex = nullptr;
        c.key = key;
        c.k = k;
        Face& F = face(bold);
        if (!F.ok) return;
        const float scale = stbtt_ScaleForMappingEmToPixels(&F.info, em * k);
        int ascent = 0, descent = 0, gap = 0;
        stbtt_GetFontVMetrics(&F.info, &ascent, &descent, &gap);
        const float line_h = std::ceil((ascent - descent + gap) * scale);
        const float base = std::ceil(ascent * scale);
        const float wrap = box.w > 0 ? box.w * k : 1e9f;

        auto advance = [&](uint32_t a, uint32_t b) {
            int adv = 0, lsb = 0;
            stbtt_GetCodepointHMetrics(&F.info, int(a), &adv, &lsb);
            float w = adv * scale;
            if (b) w += stbtt_GetCodepointKernAdvance(&F.info, int(a), int(b)) * scale;
            return w;
        };
        auto measure = [&](const std::vector<uint32_t>& cps) {
            float w = 0;
            for (size_t i = 0; i < cps.size(); ++i) w += advance(cps[i], i + 1 < cps.size() ? cps[i + 1] : 0);
            return w;
        };

        // Quebra de linha por palavras (e nos \n do texto).
        std::vector<Line> lines;
        std::vector<uint32_t> all = utf8(text);
        Line cur;
        std::vector<uint32_t> word;
        auto flush_word = [&]() {
            if (word.empty()) return;
            std::vector<uint32_t> trial = cur.cps;
            if (!trial.empty()) trial.push_back(' ');
            trial.insert(trial.end(), word.begin(), word.end());
            float w = measure(trial);
            if (w > wrap && !cur.cps.empty()) {
                lines.push_back(cur);
                cur = Line{};
                cur.cps = word;
                cur.width = measure(word);
            } else {
                cur.cps = trial;
                cur.width = w;
            }
            word.clear();
        };
        for (uint32_t cp : all) {
            if (cp == '\r') continue;
            if (cp == '\n') {
                flush_word();
                lines.push_back(cur);
                cur = Line{};
            } else if (cp == ' ') {
                flush_word();
            } else {
                word.push_back(cp);
            }
        }
        flush_word();
        lines.push_back(cur);
        while (lines.size() > 1 && lines.back().cps.empty()) lines.pop_back();

        float maxw = 0;
        for (auto& l : lines) maxw = std::max(maxw, l.width);
        int tw = std::max(1, int(std::ceil(box.w > 0 ? std::max(box.w * k, maxw) : maxw)) + 2);
        int th = std::max(1, int(line_h * float(lines.size())) + 2);
        std::vector<uint8_t> alpha(size_t(tw) * size_t(th), 0);

        for (size_t li = 0; li < lines.size(); ++li) {
            const Line& l = lines[li];
            float x = 1;
            if (st.flags & 1) x = (float(tw) - l.width) / 2;
            else if (st.flags & 2) x = float(tw) - l.width - 1;
            float y = 1 + base + line_h * float(li);
            for (size_t i = 0; i < l.cps.size(); ++i) {
                uint32_t cp = l.cps[i];
                float xs = x - std::floor(x);
                int x0, y0, x1, y1;
                stbtt_GetCodepointBitmapBoxSubpixel(&F.info, int(cp), scale, scale, xs, 0, &x0, &y0, &x1, &y1);
                int gw = x1 - x0, gh = y1 - y0;
                if (gw > 0 && gh > 0) {
                    std::vector<uint8_t> g(size_t(gw) * size_t(gh));
                    stbtt_MakeCodepointBitmapSubpixel(&F.info, g.data(), gw, gh, gw, scale, scale, xs, 0, int(cp));
                    int ox = int(std::floor(x)) + x0, oy = int(y) + y0;
                    for (int yy = 0; yy < gh; ++yy) {
                        int ty = oy + yy;
                        if (ty < 0 || ty >= th) continue;
                        for (int xx = 0; xx < gw; ++xx) {
                            int tx = ox + xx;
                            if (tx < 0 || tx >= tw) continue;
                            uint8_t& d = alpha[size_t(ty) * size_t(tw) + size_t(tx)];
                            d = uint8_t(std::min(255, d + g[size_t(yy) * size_t(gw) + size_t(xx)]));
                        }
                    }
                }
                x += advance(cp, i + 1 < l.cps.size() ? l.cps[i + 1] : 0);
            }
        }

        SDL_Texture* tex = SDL_CreateTexture(r, SDL_PIXELFORMAT_RGBA32, SDL_TEXTUREACCESS_STATIC, tw, th);
        if (!tex) return;
        std::vector<uint8_t> rgba(size_t(tw) * size_t(th) * 4);
        for (size_t i = 0; i < alpha.size(); ++i) {
            rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = 255;  // cor entra pelo ColorMod
            rgba[i * 4 + 3] = alpha[i];
        }
        SDL_UpdateTexture(tex, nullptr, rgba.data(), tw * 4);
        SDL_SetTextureBlendMode(tex, SDL_BLENDMODE_BLEND);
        SDL_SetTextureScaleMode(tex, SDL_ScaleModeLinear);
        c.tex = tex;
        c.w = tw;
        c.h = th;
    }

    // Posição: o tamanho da textura está em pixels reais; divide por k.
    float w = float(c.w) / c.k, h = float(c.h) / c.k;
    float x = box.x - 1.0f / c.k, y = box.y - 1.0f / c.k;
    if (box.h > 0) {
        if (st.flags & 4) y += (box.h - h) / 2;
        else if (st.flags & 8) y += box.h - h;
    }
    SDL_Rect src{0, 0, c.w, c.h};
    if (box.h > 0 && h > box.h + 2.0f / c.k && !(st.flags & (4 | 8))) {  // o Text do Clickteam corta no retângulo
        src.h = int(std::ceil((box.h + 2.0f / c.k) * c.k));
        h = float(src.h) / c.k;
    }
    SDL_FRect dst{x, y, w, h};
    SDL_SetTextureColorMod(c.tex, Uint8(st.rgb >> 16), Uint8(st.rgb >> 8), Uint8(st.rgb));
    SDL_SetTextureAlphaMod(c.tex, Uint8(255 - std::clamp(st.alpha, 0, 255)));
    SDL_RenderCopyF(r, c.tex, &src, &dst);
}

}  // namespace pb
```

## player/src/runtime/text.hpp

```cpp
// Texto dos jogos Clickteam (objetos Text e contadores do tipo "texto").
//
// As fontes dos jogos são descritas só pelo nome (ex.: "Arial", 13 px, negrito):
// o runtime original usa a fonte do sistema. Aqui o texto é rasterizado com
// stb_truetype usando a Liberation Sans embutida (mesmas métricas do Arial), na
// escala real em que o jogo é desenhado, para ficar nítido.
#pragma once

#include <SDL.h>

#include <memory>
#include <string>

#include "core/game.hpp"

namespace pb {

struct TextStyle {
    const FontInfo* font = nullptr;  // nullptr: Arial 13 px
    uint32_t rgb = 0xFFFFFF;         // 0xRRGGBB
    uint16_t flags = 0;              // 1 centro, 2 direita, 4 centro vertical, 8 embaixo
    int alpha = 0;                   // coeficiente Clickteam: 0 opaco, 255 invisível
};

// Desenha `text` (UTF-8) dentro de `box` (unidades do jogo; largura 0 = sem
// quebra). `cache` guarda a textura entre quadros (refeita se algo mudar).
void draw_text(SDL_Renderer* r, std::shared_ptr<void>& cache, const std::string& text, const TextStyle& st,
               const SDL_FRect& box);

}  // namespace pb
```

## player/src/runtime/tweaks.cpp

```cpp
#include "runtime/tweaks.hpp"

#include <cmath>
#include <map>

namespace pb {

namespace {

// Zorbié (com.gameatelier.zorbie): o personagem anda até o dedo um número fixo
// de pixels por passo do jogo (grupos "spd 0/1/2": 5, 7 e 10 px; 60 passos/s)
// e a carga do machado sobe um nível a cada 80 ms (60 ms com a melhoria da
// loja). No celular o dedo anda bem mais rápido que isso. O ajuste deixa o
// personagem 1,6x mais rápido atrás do dedo e a carga ~1,6x mais rápida, sem
// mexer no resto (inimigos, machado, tempo da partida).
// O "spd 3" (2 px, andar lento durante a recarga) fica como está.
std::vector<std::string> tweak_zorbie(Game& game) {
    std::vector<std::string> log;
    int player_col = -1;
    for (const auto& [handle, def] : game.objects)
        if (def.name == "player_col") player_col = handle;
    if (player_col < 0) return log;

    const std::map<int32_t, int32_t> speed{{5, 8}, {7, 11}, {10, 16}};
    const std::map<int32_t, int32_t> charge{{80, 50}, {60, 40}};
    int speeds = 0, timers = 0;
    for (auto& frame : game.frames) {
        std::string group;
        for (auto& g : frame.events.groups) {
            for (const auto& c : g.conditions) {
                if (c.type == -1 && c.num == -10 && !c.params.empty()) group = c.params[0].str;  // NewGroup
                if (c.type == -1 && c.num == -11) group.clear();                                     // GroupEnd
            }
            const bool spd = group == "spd 0" || group == "spd 1" || group == "spd 2" ||
                             group == "spd 0 - lo" || group == "spd 1 - lo" || group == "spd 2 - lo";
            if (spd) {
                for (auto& a : g.actions) {
                    if (a.type != 2 || a.num != 2 || a.oi != uint16_t(player_col)) continue;  // SetX player_col
                    for (auto& p : a.params)
                        for (auto& e : p.expr)
                            if (e.type == -1 && e.num == 0) {
                                auto it = speed.find(e.ival);
                                if (it != speed.end()) {
                                    e.ival = it->second;
                                    ++speeds;
                                }
                            }
                }
            }
            if (group == "charge") {
                for (auto& c : g.conditions) {
                    if (c.type != -4 || (c.num != -4 && c.num != -8) || c.params.empty()) continue;  // Every
                    Param& p = c.params[0];
                    if (!p.expr.empty()) continue;
                    auto it = charge.find(p.i0);
                    if (it != charge.end()) {
                        p.i0 = it->second;
                        ++timers;
                    }
                }
            }
        }
    }
    if (speeds) log.push_back("Zorbié: personagem segue o dedo 1,6x mais rápido (" + std::to_string(speeds) + " ações)");
    if (timers) log.push_back("Zorbié: carga do machado 1,6x mais rápida (" + std::to_string(timers) + " temporizadores)");
    return log;
}

}  // namespace

std::vector<std::string> apply_game_tweaks(Game& game, const std::string& bundle_id) {
    if (bundle_id == "com.gameatelier.zorbie") return tweak_zorbie(game);
    return {};
}

}  // namespace pb
```

## player/src/runtime/tweaks.hpp

```cpp
// Ajustes por jogo, aplicados aos eventos logo depois de carregar o .cci.
//
// Mudam o jogo de propósito (não são correções do runtime): cada ajuste é
// identificado pelo bundle id e confere o que vai alterar antes de mexer.
#pragma once

#include <string>
#include <vector>

#include "core/game.hpp"

namespace pb {

// Devolve uma linha por ajuste aplicado (para o log).
std::vector<std::string> apply_game_tweaks(Game& game, const std::string& bundle_id);

}  // namespace pb
```

## player/src/runtime/value.hpp

```cpp
// Valor dinâmico das expressões Clickteam: inteiro, real ou texto.
#pragma once
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstdint>
#include <string>
#include <type_traits>

namespace pb {

struct Value {
    enum Kind : uint8_t { INT, DBL, STR } kind = INT;
    int64_t i = 0;
    double d = 0;
    std::string s;

    Value() = default;
    template <class T, std::enable_if_t<std::is_integral_v<T>, int> = 0>
    Value(T v) : kind(INT), i(int64_t(v)) {}
    Value(double v) : kind(DBL), d(v) {}
    Value(float v) : kind(DBL), d(v) {}
    Value(std::string v) : kind(STR), s(std::move(v)) {}

    bool is_str() const { return kind == STR; }
    bool is_num() const { return kind != STR; }
    double num() const { return kind == INT ? double(i) : kind == DBL ? d : std::atof(s.c_str()); }
    int64_t int_() const { return kind == INT ? i : kind == DBL ? int64_t(d) : int64_t(std::atof(s.c_str())); }
    int as_int() const { return int(int_()); }
    std::string str() const {
        if (kind == STR) return s;
        if (kind == INT) return std::to_string(i);
        // como o runtime Clickteam: sem zeros à direita
        char buf[64];
        std::snprintf(buf, sizeof buf, "%.10g", d);
        return buf;
    }
};

inline bool compare(const Value& a, int op, const Value& b) {
    // op: 0 ==, 1 !=, 2 <=, 3 <, 4 >=, 5 >
    if (a.is_str() || b.is_str()) {
        int c = a.str().compare(b.str());
        switch (op) {
            case 0: return c == 0; case 1: return c != 0; case 2: return c <= 0;
            case 3: return c < 0; case 4: return c >= 0; default: return c > 0;
        }
    }
    if (a.kind == Value::INT && b.kind == Value::INT) {
        switch (op) {
            case 0: return a.i == b.i; case 1: return a.i != b.i; case 2: return a.i <= b.i;
            case 3: return a.i < b.i; case 4: return a.i >= b.i; default: return a.i > b.i;
        }
    }
    double x = a.num(), y = b.num();
    switch (op) {
        case 0: return x == y; case 1: return x != y; case 2: return x <= y;
        case 3: return x < y; case 4: return x >= y; default: return x > y;
    }
}

}  // namespace pb
```

## player/src/tools/pbinfo.cpp

```cpp
// pbinfo: mostra o que o núcleo C++ leu de um IPA/.cci (para validar o parser).
#include <cstdio>
#include <cstdlib>
#include <map>

#include <string>

#include "core/game.hpp"
#include "core/names.hpp"
#include "core/package.hpp"

static const pb::Game* G = nullptr;

static std::string obj_name(int oi) {
    if (oi & 0x8000) return "qualif" + std::to_string(oi & 0x7FFF);
    auto* o = G->object(oi);
    return o ? o->name : "oi" + std::to_string(oi);
}

static std::string expr_str(const std::vector<pb::Expr>& ex) {
    std::string s;
    for (auto& e : ex) {
        if (!s.empty()) s += ' ';
        if (e.type == -1 && e.num == 0) s += std::to_string(e.ival);
        else if (e.type == -1 && e.num == 23) s += std::to_string(e.dval);
        else if (e.type == -1 && e.num == 3) s += '"' + e.sval + '"';
        else if (e.type == -1 && (e.num == 24 || e.num == 50)) s += (e.num == 24 ? "GV" : "GS") + std::to_string(e.index);
        else if (e.type == -1 && e.num == -1) s += '(';
        else if (e.type == -1 && e.num == -2) s += ')';
        else if (e.type == -1 && e.num == -3) s += ',';
        else if (e.type == 0) {
            static const char* ops[] = {"?", "+", "-", "*", "/", "mod", "pow", "and", "or", "xor"};
            s += (e.num / 2 <= 9) ? ops[e.num / 2] : "op?";
        } else {
            s += pb::item_name(pb::ItemKind::Expression, e.type, e.num);
            if (e.type >= 2) s += "[" + obj_name(e.oi) + "]";
            if (e.num == 16 || e.num == 19) s += "#" + std::to_string(e.index);
        }
    }
    return s;
}

static std::string param_str(const pb::Param& p) {
    static const char* cmp[] = {"==", "!=", "<=", "<", ">=", ">"};
    if (!p.expr.empty()) {
        std::string c = (p.code == 23 || p.code == 46) && p.comparison >= 0 && p.comparison < 6 ? std::string(cmp[p.comparison]) + " " : "";
        return c + expr_str(p.expr);
    }
    switch (p.code) {
        case pb::P_OBJECT: return "obj " + obj_name(p.oi);
        case pb::P_CREATE: case pb::P_SHOOT:
            return "create " + obj_name(p.oi) + " @(" + std::to_string(p.pos.x) + "," + std::to_string(p.pos.y) + ") parent=" + (p.pos.type_parent ? obj_name(p.pos.oi_parent) : std::string("frame")) + " layer=" + std::to_string(p.pos.layer);
        case pb::P_POSITION: case pb::P_NEWPOSITION:
            return "pos (" + std::to_string(p.pos.x) + "," + std::to_string(p.pos.y) + ") parent=" + (p.pos.type_parent ? obj_name(p.pos.oi_parent) : std::string("frame"));
        case pb::P_SAMPLE: case pb::P_CNDSAMPLE: return "sample " + std::to_string(p.i0) + " '" + p.str + "'";
        case pb::P_GROUPTITLE: return "group '" + p.str + "' id=" + std::to_string(p.i1) + " flags=" + std::to_string(p.i0);
        case pb::P_GROUPPOINTER: return "group id=" + std::to_string(p.i1) + " ptr=" + std::to_string(p.i0);
        case pb::P_TIME: case pb::P_EVERY: return std::to_string(p.i0) + "ms";
        case pb::P_ZONE: return "zone(" + std::to_string(p.i0) + "," + std::to_string(p.i1) + ")-(" + std::to_string(p.i2) + "," + std::to_string(p.comparison) + ")";
        case pb::P_EXTENSION: return "ext data " + std::to_string(p.raw.size()) + "b";
        default: return "p" + std::to_string(p.code) + "=" + std::to_string(p.i0) + (p.str.empty() ? "" : " '" + p.str + "'");
    }
}

static void dump_events(const pb::FrameDef& f, size_t from, size_t count) {
    for (size_t i = from; i < f.events.groups.size() && i < from + count; ++i) {
        auto& g = f.events.groups[i];
        std::printf("#%zu flags=%04x @%u\n", i, g.flags, g.offset);
        for (auto* list : {&g.conditions, &g.actions}) {
            bool cond = list == &g.conditions;
            for (auto& it : *list) {
                std::printf("   %s %s%s", cond ? "?" : "!", cond && it.negated() ? "NOT " : "",
                            pb::item_name(cond ? pb::ItemKind::Condition : pb::ItemKind::Action, it.type, it.num).c_str());
                if (it.type >= 2) std::printf(" [%s]", obj_name(it.oi).c_str());
                for (auto& p : it.params) std::printf(" | %s", param_str(p).c_str());
                std::printf("\n");
            }
        }
    }
}

int main(int argc, char** argv) {
    if (argc < 2) {
        std::fprintf(stderr, "uso: pbinfo <jogo.ipa | Application.cci>\n");
        return 2;
    }
    try {
        pb::PackageInfo pkg = pb::open_package(argv[1]);
        auto g = pb::load_game(std::move(pkg.game_data));
        G = g.get();
        if (argc > 3 && std::string(argv[2]) == "--instances") {
            const auto& f = g->frames[size_t(std::atoi(argv[3]))];
            for (const auto& in : f.instances) {
                const pb::ObjectDef* od = g->object(in.oi);
                std::string mv;
                if (od) for (const auto& m : od->movements) mv += " mov" + std::to_string(m.type) + (m.move_at_start ? "*" : "");
                std::printf("%-24s (%d,%d) camada %d pai %d%s\n", od ? od->name.c_str() : "?", in.x, in.y, in.layer,
                            in.parent_type, mv.c_str());
            }
            return 0;
        }
        if (argc > 2 && std::string(argv[2]) == "--objects") {
            // Contadores, textos e fontes: o que o runtime precisa desenhar além das imagens.
            for (const auto& f : g->fonts)
                std::printf("fonte %d '%s' altura %d peso %d%s\n", f.handle, f.face.c_str(), f.height, f.weight,
                            f.italic ? " itálico" : "");
            if (argc > 3) {  // --objects NOME: flags de um objeto
                for (const auto& [h, o] : g->objects)
                    if (o.name == argv[3])
                        std::printf("%d '%s' tipo %d oe_flags %#x flags %#x flags2 %#x prefs %#x neverkill %d\n", h,
                                    o.name.c_str(), o.type, o.oe_flags, o.flags, o.flags2, o.prefs,
                                    int((o.oe_flags & 0x2000) != 0));
                for (const auto& [h, o] : g->objects)  // valores alteráveis iniciais (A, B, C...)
                    if (o.name == argv[3] && !o.values.empty()) {
                        std::printf("  valores iniciais:");
                        for (size_t i = 0; i < o.values.size(); ++i)
                            if (o.values[i]) std::printf(" %c=%d", char('A' + (i < 26 ? i : 25)), o.values[i]);
                        std::printf("\n");
                    }
                for (const auto& [h, o] : g->objects)
                    if (o.name == argv[3])
                        for (const auto& a : o.anims)
                            for (const auto& d : a.dirs)
                                if (d.present && !d.frames.empty()) {
                                    auto it = g->images.find(d.frames[0]);
                                    if (it != g->images.end())
                                        std::printf("  imagem %d: %dx%d ponto quente (%d,%d) ação (%d,%d)\n", d.frames[0],
                                                    it->second.width, it->second.height, it->second.hot_x,
                                                    it->second.hot_y, it->second.act_x, it->second.act_y);
                                    goto movs;
                                }
            movs:
                for (const auto& [h, o] : g->objects)
                    if (o.name == argv[3])
                        for (const auto& m : o.movements) {
                            std::printf("  movimento tipo %d %s:", m.type, m.module.c_str());
                            for (auto v : m.v) std::printf(" %d", v);
                            std::printf("\n");
                        }
            next_obj:
                return 0;
            }
                        static const char* kDisp[] = {"oculto", "números", "barra vertical", "barra horizontal", "animação", "texto"};
            for (const auto& [h, o] : g->objects) {
                if (o.type == pb::OBJ_COUNTER || o.type == pb::OBJ_SCORE || o.type == pb::OBJ_LIVES)
                    std::printf("contador %d '%s' tipo %d exibição %d (%s) %dx%d fonte %d imagens %zu valor %d [%d..%d] visível %d\n",
                                h, o.name.c_str(), o.type, o.counter_display,
                                o.counter_display >= 0 && o.counter_display < 6 ? kDisp[o.counter_display] : "?",
                                o.counter_w, o.counter_h, o.counter_font, o.counter_frames.size(), o.counter_init,
                                o.counter_min, o.counter_max, int(o.visible_at_start()));
                if (o.counter_display == 2 || o.counter_display == 3 || o.counter_display == 5)
                    std::printf("   preenchimento %d cor1 %#08x cor2 %#08x flags %#x\n", o.counter_fill, o.counter_color1, o.counter_color2, o.counter_flags);
                if (o.type == pb::OBJ_TEXT) {
                    std::printf("texto %d '%s' %dx%d visível %d\n", h, o.name.c_str(), o.text_w, o.text_h,
                                int(o.visible_at_start()));
                    for (const auto& p : o.paragraphs)
                        std::printf("   fonte %d flags %#06x cor %#08x \"%s\"\n", p.font, p.flags, p.color, p.text.c_str());
                }
            }
            return 0;
        }
        if (argc > 2 && std::string(argv[2]) == "--layers") {
            for (size_t fi = 0; fi < g->frames.size(); ++fi) {
                const auto& f = g->frames[fi];
                std::printf("frame %zu '%s' %dx%d\n", fi, f.name.c_str(), f.width, f.height);
                for (const auto& l : f.layers)
                    std::printf("   %-10s flags %#06x  coef x %.3f  y %.3f\n", l.name.c_str(), l.flags, l.x_coef, l.y_coef);
            }
            return 0;
        }
        if (argc > 3 && std::string(argv[2]) == "--group-pointers") {
            // calibra a fórmula dos "group pointers": alvo = pos + ptr + k
            int fi = std::atoi(argv[3]);
            const auto& ev = g->frames[size_t(fi)].events;
            std::map<uint32_t, size_t> starts;
            for (size_t i = 0; i < ev.groups.size(); ++i) starts[ev.groups[i].offset] = i;
            std::map<long, int> hits;
            int total = 0;
            for (size_t i = 0; i < ev.groups.size(); ++i)
                for (auto& a : ev.groups[i].actions)
                    for (auto& p : a.params)
                        if (p.code == pb::P_GROUPPOINTER) {
                            ++total;
                            for (long k = -64; k <= 64; ++k) {
                                auto it = starts.find(uint32_t(long(p.file_pos) + p.i0 + k));
                                if (it != starts.end()) {
                                    auto& c = ev.groups[it->second].conditions;
                                    if (!c.empty() && c[0].type == -1 && c[0].num == -10) ++hits[k];
                                }
                            }
                        }
            std::printf("ponteiros: %d\n", total);
            for (auto& [k, n] : hits) std::printf("k=%ld acertos=%d\n", k, n);
            return 0;
        }
        if (argc > 3 && std::string(argv[2]) == "--events") {
            int fi = std::atoi(argv[3]);
            size_t from = argc > 4 ? std::strtoul(argv[4], nullptr, 10) : 0;
            size_t count = argc > 5 ? std::strtoul(argv[5], nullptr, 10) : 100000;
            dump_events(g->frames.at(fi), from, count);
            return 0;
        }
        std::printf("pacote: %s  nome: %s  id: %s  versão: %s\n", pkg.kind.c_str(),
                    pkg.display_name.c_str(), pkg.bundle_id.c_str(), pkg.version.c_str());
        std::printf("tela %dx%d  %d fps  frames %zu  build %u  ícone %zu bytes\n", g->width,
                    g->height, g->frame_rate, g->frames.size(), g->product_build, pkg.icon.size());
        std::printf("objetos %zu  imagens %zu  sons %zu  fontes %zu  extensões %zu\n",
                    g->objects.size(), g->images.size(), g->sounds.size(), g->fonts.size(),
                    g->extensions.size());
        std::map<std::string, int> mv;
        size_t anims = 0;
        for (auto& [h, o] : g->objects) {
            for (auto& m : o.movements) mv[m.type == pb::MV_EXTENSION ? m.module : std::to_string(m.type)]++;
            if (!o.anims.empty()) ++anims;
        }
        std::printf("objetos com animação %zu  movimentos:", anims);
        for (auto& [k, v] : mv) std::printf(" %s=%d", k.c_str(), v);
        std::printf("\n");
        size_t groups = 0, conds = 0, acts = 0, exprs = 0;
        for (auto& f : g->frames) {
            groups += f.events.groups.size();
            for (auto& gr : f.events.groups) {
                conds += gr.conditions.size();
                acts += gr.actions.size();
                for (auto* list : {&gr.conditions, &gr.actions})
                    for (auto& it : *list)
                        for (auto& p : it.params) exprs += p.expr.size();
            }
            std::printf("  frame %-22s %4dx%-4d instâncias %4zu  grupos %5zu %s\n", f.name.c_str(),
                        f.width, f.height, f.instances.size(), f.events.groups.size(),
                        f.events_error.c_str());
        }
        std::printf("grupos %zu  condições %zu  ações %zu  tokens de expressão %zu\n", groups,
                    conds, acts, exprs);
        std::printf("frame_handles:");
        for (auto h : g->frame_handles) std::printf(" %u", h);
        std::printf("\navisos: %zu\n", g->warnings.size());
        for (size_t i = 0; i < g->warnings.size() && i < 10; ++i)
            std::printf("  %s\n", g->warnings[i].c_str());
        if (argc > 2) {  // decodifica todas as imagens (teste de integridade)
            std::vector<uint8_t> rgba;
            size_t ok = 0;
            for (auto& [h, im] : g->images) ok += g->decode_image(im, rgba);
            std::printf("imagens decodificadas: %zu/%zu\n", ok, g->images.size());
            double px = 0;
            for (const auto& [h, im] : g->images) px += double(im.width) * im.height;
            std::printf("pixels de todas as imagens: %.1f milhões (%.0f MB como textura RGBA)\n", px / 1e6, px * 4 / 1048576);
        }
    } catch (const std::exception& e) {
        std::fprintf(stderr, "erro: %s\n", e.what());
        return 1;
    }
    return 0;
}
```

---

# App Android, conversor e templates

## android/.gitignore

```text
.gradle/
build/
*/build/
*/.cxx/
local.properties
*.keystore
```

## android/app/build.gradle

```groovy
plugins {
    id 'com.android.application'
}

// PortBridge (conversor): escolhe um IPA e gera um APK independente para o jogo.
// O runtime de cada APK gerado vem de um template:
//   templates/clickteam.apk  <- módulo :runtime (jogos Clickteam Fusion, runtime próprio)
//   templates/hle.apk        <- módulo :hle (apps nativos de 32 bits, touchHLE)
// Sem Rust/cargo-ndk instalados, compile com -Ppb.noHle (só o template Clickteam).
def templatesDir = layout.buildDirectory.dir('generated/pbtemplates')
def withHle = !project.hasProperty('pb.noHle')

tasks.register('copyTemplates', Copy) {
    dependsOn ':runtime:assembleRelease'
    from(project(':runtime').layout.buildDirectory.file('outputs/apk/release/runtime-release-unsigned.apk')) {
        rename { 'clickteam.apk' }
    }
    if (withHle) {
        dependsOn ':hle:assembleRelease'
        from(project(':hle').layout.buildDirectory.file('outputs/apk/release/hle-release-unsigned.apk')) {
            rename { 'hle.apk' }
        }
    }
    into(templatesDir.map { it.dir('templates') })
}

android {
    namespace 'com.portbridge.app'
    compileSdk 35

    defaultConfig {
        applicationId 'com.portbridge.app'
        minSdk 26
        targetSdk 35
        versionCode 14
        versionName '0.4.7'
    }

    sourceSets {
        main {
            assets.srcDirs += templatesDir
        }
    }

    buildTypes {
        release {
            minifyEnabled false
            signingConfig signingConfigs.debug
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }

    packaging {
        resources {
            excludes += ['META-INF/*.SF', 'META-INF/*.RSA', 'META-INF/*.DSA']
        }
    }
}

dependencies {
    implementation project(':converter')
}

tasks.named('preBuild') { dependsOn 'copyTemplates' }
```

## android/app/src/main/AndroidManifest.xml

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- para abrir o instalador com o APK gerado -->
    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:theme="@style/Theme.PortBridge">

        <activity
            android:name=".ConverterActivity"
            android:exported="true"
            android:launchMode="singleTask">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
            <!-- "Abrir com PortBridge" para arquivos .ipa -->
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <action android:name="android.intent.action.SEND" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="application/octet-stream" />
                <data android:mimeType="application/x-itunes-ipa" />
                <data android:mimeType="application/zip" />
            </intent-filter>
        </activity>

        <provider
            android:name=".ApkProvider"
            android:authorities="${applicationId}.apks"
            android:exported="false"
            android:grantUriPermissions="true" />
    </application>
</manifest>
```

## android/app/src/main/java/com/portbridge/app/ApkProvider.java

```java
package com.portbridge.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

/** Entrega os APKs gerados ao instalador e ao "compartilhar" (sem depender do AndroidX). */
public class ApkProvider extends ContentProvider {
    static String authority(Context c) {
        return c.getPackageName() + ".apks";
    }

    static Uri uriFor(Context c, File apk) {
        return new Uri.Builder().scheme("content").authority(authority(c)).appendPath(apk.getName()).build();
    }

    private File fileFor(Uri uri) throws FileNotFoundException {
        String name = uri.getLastPathSegment();
        if (name == null || name.contains("/") || name.contains("..")) throw new FileNotFoundException();
        File f = new File(new File(getContext().getExternalFilesDir(null), "apks"), name);
        if (!f.exists()) throw new FileNotFoundException(name);
        return f;
    }

    @Override public boolean onCreate() { return true; }

    @Override
    public String getType(Uri uri) {
        return "application/vnd.android.package-archive";
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        return ParcelFileDescriptor.open(fileFor(uri), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String sel, String[] args, String order) {
        try {
            File f = fileFor(uri);
            MatrixCursor c = new MatrixCursor(new String[] {OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE});
            c.addRow(new Object[] {f.getName(), f.length()});
            return c;
        } catch (FileNotFoundException e) {
            return null;
        }
    }

    @Override public Uri insert(Uri uri, ContentValues v) { return null; }
    @Override public int delete(Uri uri, String s, String[] a) { return 0; }
    @Override public int update(Uri uri, ContentValues v, String s, String[] a) { return 0; }
}
```

## android/app/src/main/java/com/portbridge/app/ConverterActivity.java

```java
package com.portbridge.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;

import com.portbridge.converter.Converter;
import com.portbridge.converter.Ipa;
import com.portbridge.converter.SigningKey;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.EnumMap;
import java.util.Map;

/**
 * PortBridge: escolha um IPA de iOS e gere um APK de Android independente
 * (nome, ícone e pacote do próprio jogo), pronto para instalar ou distribuir.
 */
public class ConverterActivity extends Activity {
    private static final int REQ_IPA = 1;

    private LinearLayout card;
    private ImageView icon;
    private TextView title, details, status;
    private ProgressBar progress;
    private Button convertBtn, installBtn, shareBtn;
    private File ipaFile, apkFile;
    private Ipa ipa;

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(16), dp(18), dp(16));

        TextView intro = new TextView(this);
        intro.setText("Escolha um IPA de iOS. O PortBridge gera um APK de Android para esse app, "
                + "com o nome e o ícone dele, para instalar ou distribuir.");
        intro.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        root.addView(intro);

        Button pick = new Button(this);
        pick.setText("Escolher IPA");
        pick.setOnClickListener(v -> pickIpa());
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
        lp.topMargin = dp(14);
        root.addView(pick, lp);

        card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(0, dp(18), 0, 0);
        card.setVisibility(View.GONE);
        LinearLayout head = new LinearLayout(this);
        head.setGravity(Gravity.CENTER_VERTICAL);
        icon = new ImageView(this);
        head.addView(icon, new LinearLayout.LayoutParams(dp(72), dp(72)));
        title = new TextView(this);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setPadding(dp(14), 0, 0, 0);
        head.addView(title);
        card.addView(head);
        details = new TextView(this);
        details.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        details.setPadding(0, dp(12), 0, dp(12));
        card.addView(details);
        convertBtn = new Button(this);
        convertBtn.setText("Gerar APK");
        convertBtn.setOnClickListener(v -> convert());
        card.addView(convertBtn, new LinearLayout.LayoutParams(-1, -2));
        progress = new ProgressBar(this);
        progress.setIndeterminate(true);
        progress.setVisibility(View.GONE);
        card.addView(progress);
        status = new TextView(this);
        status.setPadding(0, dp(8), 0, dp(8));
        card.addView(status);
        installBtn = new Button(this);
        installBtn.setText("Instalar");
        installBtn.setVisibility(View.GONE);
        installBtn.setOnClickListener(v -> install());
        card.addView(installBtn, new LinearLayout.LayoutParams(-1, -2));
        shareBtn = new Button(this);
        shareBtn.setText("Compartilhar APK");
        shareBtn.setVisibility(View.GONE);
        shareBtn.setOnClickListener(v -> share());
        card.addView(shareBtn, new LinearLayout.LayoutParams(-1, -2));
        root.addView(card);

        ScrollView sv = new ScrollView(this);
        sv.addView(root);
        setContentView(sv);
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        Uri uri = null;
        if (Intent.ACTION_VIEW.equals(intent.getAction())) uri = intent.getData();
        else if (Intent.ACTION_SEND.equals(intent.getAction())) uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        if (uri != null) load(uri);
    }

    private void pickIpa() {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("*/*");
        startActivityForResult(i, REQ_IPA);
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == REQ_IPA && res == RESULT_OK && data != null && data.getData() != null) load(data.getData());
    }

    // ------------------------------------------------------------ análise
    private void load(Uri uri) {
        card.setVisibility(View.VISIBLE);
        title.setText("Lendo…");
        details.setText("");
        status.setText("");
        convertBtn.setEnabled(false);
        installBtn.setVisibility(View.GONE);
        shareBtn.setVisibility(View.GONE);
        progress.setVisibility(View.VISIBLE);
        new Thread(() -> {
            try {
                File f = new File(getCacheDir(), "input.ipa");
                try (InputStream in = getContentResolver().openInputStream(uri);
                     OutputStream out = new FileOutputStream(f)) {
                    if (in == null) throw new IOException("não foi possível ler o arquivo");
                    byte[] buf = new byte[1 << 16];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                }
                Ipa info = Ipa.inspect(f);
                runOnUiThread(() -> showInfo(f, info));
            } catch (Exception e) {
                runOnUiThread(() -> fail("Este arquivo não é um IPA válido", e));
            }
        }).start();
    }

    private void showInfo(File f, Ipa info) {
        ipaFile = f;
        ipa = info;
        progress.setVisibility(View.GONE);
        title.setText(info.name);
        if (info.icon != null) {
            Bitmap b = BitmapFactory.decodeByteArray(info.icon, 0, info.icon.length);
            if (b != null) icon.setImageBitmap(b);
        } else {
            icon.setImageDrawable(null);
            icon.setBackgroundColor(Color.rgb(0x3B, 0x2A, 0x8C));
        }
        String support;
        boolean ok = false;
        switch (info.runtime) {
            case CLICKTEAM: support = "✅ Pode ser portado (runtime Clickteam do PortBridge)"; ok = true; break;
            case HLE:
                ok = hasTemplate(Ipa.Runtime.HLE);
                support = ok ? "⚠️ Emulação do iOS (touchHLE): compatibilidade depende do jogo"
                             : "🚧 App nativo ARM 32 bits: precisa do runtime de emulação, ainda não incluído nesta versão";
                break;
            default: support = "❌ Ainda não pode ser portado: " + info.reason;
        }
        details.setText("Versão " + info.version + " · " + info.bundleId + "\n"
                + "Engine: " + info.engine + " · " + String.join(", ", info.archs)
                + (info.minimumOs.isEmpty() ? "" : " · iOS " + info.minimumOs + "+") + "\n"
                + "Pacote Android: " + info.suggestedPackage() + "\n\n" + support);
        convertBtn.setEnabled(ok);
    }

    private boolean hasTemplate(Ipa.Runtime rt) {
        try (InputStream in = getAssets().open("templates/" + rt.name().toLowerCase() + ".apk")) {
            return in != null;
        } catch (IOException e) {
            return false;
        }
    }

    // ------------------------------------------------------------ conversão
    private void convert() {
        convertBtn.setEnabled(false);
        progress.setVisibility(View.VISIBLE);
        new Thread(() -> {
            try {
                Map<Ipa.Runtime, File> templates = new EnumMap<>(Ipa.Runtime.class);
                for (Ipa.Runtime rt : new Ipa.Runtime[] {Ipa.Runtime.CLICKTEAM, Ipa.Runtime.HLE}) {
                    if (!hasTemplate(rt)) continue;
                    File t = new File(getCacheDir(), "template-" + rt.name().toLowerCase() + ".apk");
                    templates.put(rt, Converter.copyToFile(getAssets().open("templates/" + rt.name().toLowerCase() + ".apk"), t));
                }
                SigningKey key = SigningKey.loadOrCreate(new File(getFilesDir(), "signing"), "PortBridge");
                File out = new File(getExternalFilesDir(null), "apks");
                Converter.Result r = Converter.convert(ipaFile, templates, out, key, ConverterActivity::scaledPng,
                        msg -> runOnUiThread(() -> status.setText(msg)));
                apkFile = r.apk;
                String where = saveToDownloads(r.apk);
                runOnUiThread(() -> {
                    progress.setVisibility(View.GONE);
                    status.setText("APK gerado: " + r.apk.getName() + " (" + (r.apk.length() / (1024 * 1024)) + " MB)"
                            + (where != null ? "\nCópia em " + where : ""));
                    installBtn.setVisibility(View.VISIBLE);
                    shareBtn.setVisibility(View.VISIBLE);
                    convertBtn.setEnabled(true);
                });
            } catch (Exception e) {
                runOnUiThread(() -> fail("Não foi possível gerar o APK", e));
            }
        }).start();
    }

    /** Ícone quadrado em PNG (Android). */
    static byte[] scaledPng(byte[] src, int size) throws IOException {
        Bitmap b = BitmapFactory.decodeByteArray(src, 0, src.length);
        if (b == null) throw new IOException("ícone em formato desconhecido");
        Bitmap s = Bitmap.createScaledBitmap(b, size, size, true);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        s.compress(Bitmap.CompressFormat.PNG, 100, out);
        return out.toByteArray();
    }

    /** Android 10+: copia para Downloads/PortBridge, onde o usuário acha o arquivo depois. */
    private String saveToDownloads(File apk) {
        if (Build.VERSION.SDK_INT < 29) return null;
        try {
            ContentValues v = new ContentValues();
            v.put(MediaStore.Downloads.DISPLAY_NAME, apk.getName());
            v.put(MediaStore.Downloads.MIME_TYPE, "application/vnd.android.package-archive");
            v.put(MediaStore.Downloads.RELATIVE_PATH, "Download/PortBridge");
            Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
            if (uri == null) return null;
            try (OutputStream out = getContentResolver().openOutputStream(uri);
                 InputStream in = new FileInputStream(apk)) {
                byte[] buf = new byte[1 << 16];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            }
            return "Download/PortBridge";
        } catch (Exception e) {
            return null;
        }
    }

    private Uri apkUri() {
        return ApkProvider.uriFor(this, apkFile);
    }

    private void install() {
        if (apkFile == null) return;
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(apkUri(), "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(i);
        } catch (Exception e) {
            fail("Não foi possível abrir o instalador", e);
        }
    }

    private void share() {
        if (apkFile == null) return;
        Intent i = new Intent(Intent.ACTION_SEND);
        i.setType("application/vnd.android.package-archive");
        i.putExtra(Intent.EXTRA_STREAM, apkUri());
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        startActivity(Intent.createChooser(i, "Compartilhar APK"));
    }

    private void fail(String what, Exception e) {
        progress.setVisibility(View.GONE);
        convertBtn.setEnabled(ipa != null);
        String msg = e.getMessage() != null ? e.getMessage() : e.toString();
        status.setText(what + ": " + msg);
        new AlertDialog.Builder(this).setTitle(what).setMessage(msg).setPositiveButton("OK", null).show();
    }
}
```

## android/app/src/main/res/values/strings.xml

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">PortBridge</string>
</resources>
```

## android/app/src/main/res/values/styles.xml

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.PortBridge" parent="@android:style/Theme.Material.Light.DarkActionBar">
        <item name="android:colorPrimary">#3B2A8C</item>
        <item name="android:colorPrimaryDark">#2A1E66</item>
        <item name="android:colorAccent">#FF7A1A</item>
    </style>
    <style name="Theme.PortBridge.Fullscreen" parent="@android:style/Theme.Black.NoTitleBar.Fullscreen" />
</resources>
```

## android/build.gradle

```groovy
plugins {
    id 'com.android.application' version '8.7.3' apply false
}
```

## android/converter/build.gradle

```groovy
plugins {
    id 'java-library'
}

// Conversor IPA -> APK em Java puro: usado pelo app Android e pelo .jar de desktop.
java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

dependencies {
    api 'com.android.tools.build:apksig:8.7.3'
}

// Desktop: java -jar portbridge-converter.jar Jogo.ipa
// (inclui o apksig e os templates de runtime: :runtime -> clickteam.apk, :hle -> hle.apk)
tasks.register('desktopJar', Jar) {
    dependsOn ':runtime:assembleRelease', 'classes'
    archiveFileName = 'portbridge-converter.jar'
    destinationDirectory = layout.buildDirectory.dir('dist')
    duplicatesStrategy = DuplicatesStrategy.EXCLUDE
    manifest { attributes 'Main-Class': 'com.portbridge.converter.Cli' }
    from sourceSets.main.output
    from { configurations.runtimeClasspath.collect { it.isDirectory() ? it : zipTree(it) } }
    from(project(':runtime').layout.buildDirectory.file('outputs/apk/release/runtime-release-unsigned.apk')) {
        into 'templates'
        rename { 'clickteam.apk' }
    }
    if (!project.hasProperty('pb.noHle')) {
        dependsOn ':hle:assembleRelease'
        from(project(':hle').layout.buildDirectory.file('outputs/apk/release/hle-release-unsigned.apk')) {
            into 'templates'
            rename { 'hle.apk' }
        }
    }
    exclude 'META-INF/*.SF', 'META-INF/*.RSA', 'META-INF/*.DSA'
}
```

## android/converter/src/main/java/com/portbridge/converter/Axml.java

```java
package com.portbridge.converter;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.function.UnaryOperator;

/**
 * Edita o AndroidManifest.xml compilado (XML binário do Android): troca strings do
 * string pool (pacote, nome do app, versão) e reconstrói o pool com os novos offsets.
 * O restante do arquivo referencia strings por índice e continua válido.
 */
public final class Axml {
    private static final int RES_XML_TYPE = 0x0003, RES_STRING_POOL_TYPE = 0x0001;
    private static final int UTF8_FLAG = 1 << 8;

    private Axml() {}

    public static List<String> strings(byte[] axml) throws IOException {
        return readPool(axml).strings;
    }

    public static byte[] replaceStrings(byte[] axml, UnaryOperator<String> fn) throws IOException {
        Pool pool = readPool(axml);
        boolean changed = false;
        for (int i = 0; i < pool.strings.size(); i++) {
            String s = pool.strings.get(i);
            String r = fn.apply(s);
            if (r != null && !r.equals(s)) {
                pool.strings.set(i, r);
                changed = true;
            }
        }
        if (!changed) return axml;
        byte[] newPool = writePool(pool);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        int rest = pool.chunkStart + pool.chunkSize;
        out.write(axml, 0, pool.chunkStart);
        out.write(newPool);
        out.write(axml, rest, axml.length - rest);
        byte[] res = out.toByteArray();
        ByteBuffer.wrap(res).order(ByteOrder.LITTLE_ENDIAN).putInt(4, res.length);  // tamanho total
        return res;
    }

    private static final class Pool {
        int chunkStart, chunkSize, flags, styleCount;
        List<String> strings = new ArrayList<>();
        byte[] styleOffsets = new byte[0], styleData = new byte[0];
    }

    private static Pool readPool(byte[] a) throws IOException {
        ByteBuffer b = ByteBuffer.wrap(a).order(ByteOrder.LITTLE_ENDIAN);
        if ((b.getShort(0) & 0xFFFF) != RES_XML_TYPE) throw new IOException("AndroidManifest.xml não é XML binário");
        int headerSize = b.getShort(2) & 0xFFFF;
        int p = headerSize;
        if ((b.getShort(p) & 0xFFFF) != RES_STRING_POOL_TYPE) throw new IOException("string pool não encontrado");
        Pool pool = new Pool();
        pool.chunkStart = p;
        int poolHeader = b.getShort(p + 2) & 0xFFFF;
        pool.chunkSize = b.getInt(p + 4);
        int count = b.getInt(p + 8);
        pool.styleCount = b.getInt(p + 12);
        pool.flags = b.getInt(p + 16);
        int stringsStart = b.getInt(p + 20), stylesStart = b.getInt(p + 24);
        boolean utf8 = (pool.flags & UTF8_FLAG) != 0;
        int offs = p + poolHeader;
        for (int i = 0; i < count; i++) {
            int s = p + stringsStart + b.getInt(offs + i * 4);
            pool.strings.add(utf8 ? readUtf8(a, s) : readUtf16(b, s));
        }
        if (pool.styleCount > 0) {
            int so = offs + count * 4;
            pool.styleOffsets = java.util.Arrays.copyOfRange(a, so, so + pool.styleCount * 4);
            pool.styleData = java.util.Arrays.copyOfRange(a, p + stylesStart, p + pool.chunkSize);
        }
        return pool;
    }

    private static String readUtf16(ByteBuffer b, int p) {
        int len = b.getShort(p) & 0xFFFF;
        if ((len & 0x8000) != 0) {
            len = ((len & 0x7FFF) << 16) | (b.getShort(p + 2) & 0xFFFF);
            p += 4;
        } else {
            p += 2;
        }
        char[] c = new char[len];
        for (int i = 0; i < len; i++) c[i] = b.getChar(p + i * 2);
        return new String(c);
    }

    private static String readUtf8(byte[] a, int p) {
        int[] r = varlen8(a, p);  // comprimento em UTF-16
        r = varlen8(a, r[1]);     // comprimento em bytes
        return new String(a, r[1], r[0], StandardCharsets.UTF_8);
    }

    private static int[] varlen8(byte[] a, int p) {
        int v = a[p] & 0xFF;
        if ((v & 0x80) != 0) return new int[] {((v & 0x7F) << 8) | (a[p + 1] & 0xFF), p + 2};
        return new int[] {v, p + 1};
    }

    private static byte[] writePool(Pool pool) throws IOException {
        boolean utf8 = (pool.flags & UTF8_FLAG) != 0;
        ByteArrayOutputStream data = new ByteArrayOutputStream();
        int[] offsets = new int[pool.strings.size()];
        for (int i = 0; i < offsets.length; i++) {
            offsets[i] = data.size();
            String s = pool.strings.get(i);
            if (utf8) {
                byte[] u = s.getBytes(StandardCharsets.UTF_8);
                writeLen8(data, s.length());
                writeLen8(data, u.length);
                data.write(u);
                data.write(0);
            } else {
                int len = s.length();
                if (len > 0x7FFF) {
                    le16(data, 0x8000 | (len >> 16));
                    le16(data, len & 0xFFFF);
                } else {
                    le16(data, len);
                }
                for (int k = 0; k < len; k++) le16(data, s.charAt(k));
                le16(data, 0);
            }
        }
        while (data.size() % 4 != 0) data.write(0);
        int header = 28;
        int stringsStart = header + offsets.length * 4 + pool.styleCount * 4;
        int stylesStart = pool.styleCount > 0 ? stringsStart + data.size() : 0;
        int size = stringsStart + data.size() + pool.styleData.length;
        ByteBuffer out = ByteBuffer.allocate(size).order(ByteOrder.LITTLE_ENDIAN);
        out.putShort((short) RES_STRING_POOL_TYPE).putShort((short) header).putInt(size)
           .putInt(offsets.length).putInt(pool.styleCount).putInt(pool.flags)
           .putInt(stringsStart).putInt(stylesStart);
        for (int o : offsets) out.putInt(o);
        out.put(pool.styleOffsets);
        out.put(data.toByteArray());
        out.put(pool.styleData);
        return out.array();
    }

    private static void writeLen8(ByteArrayOutputStream o, int v) throws IOException {
        if (v > 0x7F) {
            if (v > 0x7FFF) throw new IOException("string longa demais para o manifesto");
            o.write(0x80 | (v >> 8));
            o.write(v & 0xFF);
        } else {
            o.write(v);
        }
    }

    private static void le16(ByteArrayOutputStream o, int v) {
        o.write(v & 0xFF);
        o.write((v >> 8) & 0xFF);
    }
}
```

## android/converter/src/main/java/com/portbridge/converter/Cli.java

```java
package com.portbridge.converter;

import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.util.EnumMap;
import java.util.Map;

import javax.imageio.ImageIO;

/**
 * Conversor de linha de comando (Linux, Windows, macOS; precisa de Java 17+):
 *
 *   java -jar portbridge-converter.jar Jogo.ipa [-o pasta] [--template-clickteam t.apk]
 *        [--template-hle t.apk] [--key-dir ~/.portbridge]
 */
public final class Cli {
    public static void main(String[] args) throws Exception {
        File ipa = null, out = new File(".");
        File keyDir = new File(System.getProperty("user.home"), ".portbridge");
        Map<Ipa.Runtime, File> templates = new EnumMap<>(Ipa.Runtime.class);
        boolean inspectOnly = false;
        for (int i = 0; i < args.length; i++) {
            switch (args[i]) {
                case "-o": out = new File(args[++i]); break;
                case "--key-dir": keyDir = new File(args[++i]); break;
                case "--template-clickteam": templates.put(Ipa.Runtime.CLICKTEAM, new File(args[++i])); break;
                case "--template-hle": templates.put(Ipa.Runtime.HLE, new File(args[++i])); break;
                case "--inspect": inspectOnly = true; break;
                default: ipa = new File(args[i]);
            }
        }
        if (ipa == null) {
            System.err.println("uso: java -jar portbridge-converter.jar Jogo.ipa [-o pasta]");
            System.exit(2);
        }
        if (inspectOnly) {
            Ipa info = Ipa.inspect(ipa);
            System.out.println(Converter.metadata(info, info.suggestedPackage()));
            System.out.println("archs=" + info.archs + " minOS=" + info.minimumOs + " icon="
                    + (info.icon == null ? 0 : info.icon.length) + (info.reason.isEmpty() ? "" : " motivo=" + info.reason));
            return;
        }
        for (Ipa.Runtime rt : new Ipa.Runtime[] {Ipa.Runtime.CLICKTEAM, Ipa.Runtime.HLE}) {
            if (templates.containsKey(rt)) continue;
            InputStream res = Cli.class.getResourceAsStream("/templates/" + rt.name().toLowerCase() + ".apk");
            if (res != null) {
                File t = File.createTempFile("portbridge-" + rt.name().toLowerCase(), ".apk");
                t.deleteOnExit();
                templates.put(rt, Converter.copyToFile(res, t));
            }
        }
        SigningKey key = SigningKey.loadOrCreate(keyDir, "PortBridge");
        Converter.Result r = Converter.convert(ipa, templates, out, key, Cli::scaledPng, System.out::println);
        System.out.println("pacote: " + r.packageName);
        System.out.println("apk: " + r.apk.getAbsolutePath());
    }

    static byte[] scaledPng(byte[] src, int size) throws IOException {
        BufferedImage in = ImageIO.read(new ByteArrayInputStream(src));
        if (in == null) throw new IOException("ícone em formato desconhecido");
        BufferedImage out = new BufferedImage(size, size, BufferedImage.TYPE_INT_ARGB);
        java.awt.Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.drawImage(in, 0, 0, size, size, null);
        g.dispose();
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        ImageIO.write(out, "png", b);
        return b.toByteArray();
    }
}
```

## android/converter/src/main/java/com/portbridge/converter/Converter.java

```java
package com.portbridge.converter;

import com.android.apksig.ApkSigner;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Enumeration;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.CRC32;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipOutputStream;

/**
 * IPA -> APK. Copia um APK-template (runtime do PortBridge já compilado para arm64-v8a,
 * armeabi-v7a e x86_64), troca pacote/nome/versão/ícone, embute o IPA em
 * assets/game.ipa e assina. O APK gerado é um app comum, independente do PortBridge.
 */
public final class Converter {
    /** Valores fixos gravados no AndroidManifest.xml do template (android/runtime). */
    public static final String PLACEHOLDER_PACKAGE = "com.portbridge.rtplaceholder";
    public static final String PLACEHOLDER_LABEL = "@@PB_LABEL@@";
    public static final String PLACEHOLDER_VERSION = "@@PB_VERSION@@";

    public interface Images {
        /** Ícone quadrado size x size em PNG, a partir de JPEG/PNG. */
        byte[] scaledPng(byte[] src, int size) throws IOException;
    }

    public interface Progress {
        void step(String message);
    }

    public static final class Result {
        public Ipa ipa;
        public File apk;
        public String packageName;
    }

    private static final Pattern ICON = Pattern.compile("res/mipmap-([a-z]+)(-v\\d+)?/ic_launcher\\.png");

    private Converter() {}

    /**
     * @param templates template por runtime (CLICKTEAM, HLE); null = runtime indisponível
     * @param outDir pasta de saída; o APK recebe o nome do jogo
     */
    public static Result convert(File ipaFile, Map<Ipa.Runtime, File> templates, File outDir,
                                 SigningKey key, Images images, Progress progress) throws Exception {
        Progress p = progress != null ? progress : m -> { };
        p.step("Lendo o IPA");
        Ipa ipa = Ipa.inspect(ipaFile);
        if (ipa.runtime == Ipa.Runtime.UNSUPPORTED)
            throw new IOException("Este IPA ainda não pode ser portado: " + ipa.reason);
        File template = templates.get(ipa.runtime);
        if (template == null || !template.exists())
            throw new IOException("Runtime para \"" + ipa.engine + "\" ainda não está disponível nesta versão");

        Result r = new Result();
        r.ipa = ipa;
        r.packageName = ipa.suggestedPackage();
        outDir.mkdirs();
        File unsigned = new File(outDir, ipa.safeFileName() + ".unsigned.apk");
        r.apk = new File(outDir, ipa.safeFileName() + ".apk");

        p.step("Montando o APK de " + ipa.name);
        try (ZipFile tz = new ZipFile(template);
             ZipOutputStream zo = new ZipOutputStream(new FileOutputStream(unsigned))) {
            for (Enumeration<? extends ZipEntry> e = tz.entries(); e.hasMoreElements(); ) {
                ZipEntry src = e.nextElement();
                String name = src.getName();
                if (name.startsWith("META-INF/") || src.isDirectory()) continue;
                byte[] data;
                try (InputStream in = tz.getInputStream(src)) {
                    data = Ipa.readAll(in);
                }
                if (name.equals("AndroidManifest.xml")) {
                    data = Axml.replaceStrings(data, s -> patchString(s, ipa, r.packageName));
                } else {
                    Matcher m = ICON.matcher(name);
                    if (m.matches() && ipa.icon != null) {
                        try {
                            data = images.scaledPng(ipa.icon, densitySize(m.group(1)));
                        } catch (IOException ignored) {
                            // mantém o ícone padrão do PortBridge
                        }
                    }
                }
                put(zo, name, data, src.getMethod() == ZipEntry.STORED);
            }
            put(zo, "assets/portbridge.json", metadata(ipa, r.packageName).getBytes(StandardCharsets.UTF_8), false);
            p.step("Embutindo o jogo (" + (ipaFile.length() / (1024 * 1024)) + " MB)");
            putFile(zo, "assets/game.ipa", ipaFile);
        }

        p.step("Assinando");
        ApkSigner.SignerConfig signer = new ApkSigner.SignerConfig.Builder(
                "portbridge", key.key, Collections.singletonList(key.cert)).build();
        new ApkSigner.Builder(Collections.singletonList(signer))
                .setInputApk(unsigned)
                .setOutputApk(r.apk)
                .setMinSdkVersion(21)
                .setV1SigningEnabled(true)
                .setV2SigningEnabled(true)
                .setV3SigningEnabled(true)
                .setLibraryPageAlignmentBytes(16384)
                .build()
                .sign();
        unsigned.delete();
        p.step("Pronto: " + r.apk.getName());
        return r;
    }

    static String patchString(String s, Ipa ipa, String pkg) {
        if (s.equals(PLACEHOLDER_PACKAGE)) return pkg;
        if (s.startsWith(PLACEHOLDER_PACKAGE + ".")) return pkg + s.substring(PLACEHOLDER_PACKAGE.length());
        if (s.equals(PLACEHOLDER_LABEL)) return ipa.name;
        if (s.equals(PLACEHOLDER_VERSION)) return ipa.version;
        return s;
    }

    static int densitySize(String d) {
        switch (d) {
            case "ldpi": return 36;
            case "mdpi": return 48;
            case "hdpi": return 72;
            case "xhdpi": return 96;
            case "xxhdpi": return 144;
            default: return 192;
        }
    }

    static String metadata(Ipa ipa, String pkg) {
        return "{\"name\":" + json(ipa.name) + ",\"bundle\":" + json(ipa.bundleId) + ",\"version\":"
                + json(ipa.version) + ",\"runtime\":" + json(ipa.runtime.name().toLowerCase()) + ",\"engine\":"
                + json(ipa.engine) + ",\"package\":" + json(pkg) + ",\"portrait\":" + ipa.portrait + "}";
    }

    private static String json(String s) {
        StringBuilder b = new StringBuilder("\"");
        for (char c : s.toCharArray()) {
            if (c == '"' || c == '\\') b.append('\\').append(c);
            else if (c < 0x20) b.append(String.format("\\u%04x", (int) c));
            else b.append(c);
        }
        return b.append('"').toString();
    }

    private static void put(ZipOutputStream zo, String name, byte[] data, boolean stored) throws IOException {
        ZipEntry z = new ZipEntry(name);
        if (stored) {
            CRC32 crc = new CRC32();
            crc.update(data);
            z.setMethod(ZipEntry.STORED);
            z.setSize(data.length);
            z.setCompressedSize(data.length);
            z.setCrc(crc.getValue());
        } else {
            z.setMethod(ZipEntry.DEFLATED);
        }
        zo.putNextEntry(z);
        zo.write(data);
        zo.closeEntry();
    }

    /** Arquivo grande, sem comprimir (o IPA já é zip) e sem carregar tudo na memória. */
    private static void putFile(ZipOutputStream zo, String name, File f) throws IOException {
        CRC32 crc = new CRC32();
        byte[] buf = new byte[1 << 16];
        try (InputStream in = new BufferedInputStream(new FileInputStream(f))) {
            int n;
            while ((n = in.read(buf)) > 0) crc.update(buf, 0, n);
        }
        ZipEntry z = new ZipEntry(name);
        z.setMethod(ZipEntry.STORED);
        z.setSize(f.length());
        z.setCompressedSize(f.length());
        z.setCrc(crc.getValue());
        zo.putNextEntry(z);
        try (InputStream in = new BufferedInputStream(new FileInputStream(f))) {
            int n;
            while ((n = in.read(buf)) > 0) zo.write(buf, 0, n);
        }
        zo.closeEntry();
    }

    /** Copia um recurso (ex.: template dentro do .jar ou dos assets) para um arquivo. */
    public static File copyToFile(InputStream in, File dest) throws IOException {
        dest.getParentFile().mkdirs();
        try (InputStream i = in; OutputStream o = new FileOutputStream(dest)) {
            byte[] buf = new byte[1 << 16];
            int n;
            while ((n = i.read(buf)) > 0) o.write(buf, 0, n);
        }
        return dest;
    }
}
```

## android/converter/src/main/java/com/portbridge/converter/Ipa.java

```java
package com.portbridge.converter;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.zip.Inflater;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/** Inspeção de um IPA: metadados, engine, executável e ícone. */
public final class Ipa {
    /** Como o jogo pode rodar no Android. */
    public enum Runtime {
        /** Dados de Clickteam Fusion: runtime PortBridge (interpreta o .cci). */
        CLICKTEAM,
        /** Executável ARM de 32 bits sem engine conhecida: emulação de alto nível (touchHLE). */
        HLE,
        /** Não suportado ainda (64 bits, engine sem runtime etc.). */
        UNSUPPORTED
    }

    public final File file;
    public String appDir = "";
    public String name = "", bundleId = "", version = "1.0", executable = "";
    public String minimumOs = "";
    public boolean portrait = true;
    public Runtime runtime = Runtime.UNSUPPORTED;
    public String engine = "desconhecida";
    public String reason = "";
    public List<String> archs = new ArrayList<>();
    public byte[] icon;  // JPEG ou PNG que o Android consegue abrir

    private Ipa(File f) { this.file = f; }

    public static Ipa inspect(File f) throws IOException {
        Ipa ipa = new Ipa(f);
        try (ZipFile zip = new ZipFile(f)) {
            ipa.read(zip);
        }
        return ipa;
    }

    private void read(ZipFile zip) throws IOException {
        List<String> names = new ArrayList<>();
        for (Enumeration<? extends ZipEntry> e = zip.entries(); e.hasMoreElements(); ) {
            ZipEntry z = e.nextElement();
            if (!z.isDirectory()) names.add(z.getName());
        }
        for (String n : names) {
            if (n.startsWith("Payload/") && n.endsWith("/Info.plist") && n.split("/").length == 3) {
                appDir = n.substring(0, n.length() - "Info.plist".length());
                break;
            }
        }
        if (appDir.isEmpty()) throw new IOException("o arquivo não é um IPA (não há Payload/*.app/Info.plist)");

        Map<String, Object> info = Plist.parse(readAll(zip, appDir + "Info.plist"));
        String folder = appDir.substring(8, appDir.length() - 1).replaceAll("\\.app$", "");
        name = java.text.Normalizer.normalize(
                first(Plist.str(info, "CFBundleDisplayName"), Plist.str(info, "CFBundleName"), folder),
                java.text.Normalizer.Form.NFC);
        bundleId = first(Plist.str(info, "CFBundleIdentifier"), folder);
        version = first(Plist.str(info, "CFBundleShortVersionString"), Plist.str(info, "CFBundleVersion"), "1.0");
        executable = first(Plist.str(info, "CFBundleExecutable"), folder);
        minimumOs = first(Plist.str(info, "MinimumOSVersion"), "");
        List<String> orient = Plist.strings(info, "UISupportedInterfaceOrientations");
        if (orient.isEmpty()) {
            String o = Plist.str(info, "UIInterfaceOrientation");
            if (o != null) orient.add(o);
        }
        portrait = orient.isEmpty() || orient.stream().anyMatch(o -> o.contains("Portrait"));

        // engine
        boolean clickteam = false;
        for (String n : names) {
            String rel = n.startsWith(appDir) ? n.substring(appDir.length()) : "";
            String low = rel.toLowerCase(Locale.ROOT);
            if (low.endsWith(".cci") || low.equals("application.ccn")) clickteam = true;
        }
        byte[] exe = zip.getEntry(appDir + executable) != null ? readAll(zip, appDir + executable) : new byte[0];
        archs = MachO.archs(exe);
        if (clickteam) {
            runtime = Runtime.CLICKTEAM;
            engine = "Clickteam Fusion";
        } else if (archs.isEmpty()) {
            reason = "executável não encontrado ou não é Mach-O";
        } else if (MachO.encrypted(exe)) {
            reason = "o executável ainda está criptografado pela App Store (FairPlay)";
        } else if (archs.stream().anyMatch(a -> a.startsWith("armv"))) {
            runtime = Runtime.HLE;
            engine = "nativo (ARM 32 bits)";
        } else {
            reason = "só há código ARM de 64 bits (" + String.join(", ", archs) + "): ainda não suportado";
        }

        icon = pickIcon(zip, names);
    }

    // ------------------------------------------------------------ ícone
    private byte[] pickIcon(ZipFile zip, List<String> names) throws IOException {
        if (zip.getEntry("iTunesArtwork") != null) {
            byte[] a = readAll(zip, "iTunesArtwork");
            if (a.length > 4 && ((a[0] & 0xFF) == 0xFF || a[1] == 'P')) return a;
        }
        String best = null;
        long bestSize = -1;
        for (String n : names) {
            if (!n.startsWith(appDir) || n.substring(appDir.length()).contains("/")) continue;
            String rel = n.substring(appDir.length());
            String low = rel.toLowerCase(Locale.ROOT);
            boolean looksIcon = low.endsWith(".png") && (low.contains("icon") || low.contains("artwork")
                    || rel.contains("アイコン"));
            if (!looksIcon) continue;
            long sz = zip.getEntry(n).getSize();
            if (sz > bestSize) { bestSize = sz; best = n; }
        }
        if (best == null) return null;
        byte[] png = readAll(zip, best);
        return CgBI.isCgBI(png) ? CgBI.toPng(png) : png;
    }

    // ------------------------------------------------------------ util
    public String suggestedPackage() {
        String b = bundleId.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9.]", "_");
        StringBuilder sb = new StringBuilder("com.portbridge.port");
        for (String part : b.split("\\.")) {
            if (part.isEmpty()) continue;
            if (!Character.isLetter(part.charAt(0))) part = "p" + part;
            sb.append('.').append(part);
        }
        return sb.toString();
    }

    /** Nome de arquivo só com ASCII (acentos removidos), para funcionar em qualquer sistema. */
    public String safeFileName() {
        String s = java.text.Normalizer.normalize(name, java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .replaceAll("[^A-Za-z0-9 ._-]+", "")
                .replaceAll("\\s+", " ").trim();
        return s.isEmpty() ? "jogo" : s;
    }

    static byte[] readAll(ZipFile zip, String name) throws IOException {
        ZipEntry z = zip.getEntry(name);
        if (z == null) throw new IOException("faltando no IPA: " + name);
        try (InputStream in = zip.getInputStream(z)) {
            return readAll(in);
        }
    }

    static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[1 << 16];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        return out.toByteArray();
    }

    private static String first(String... v) {
        for (String s : v) if (s != null && !s.trim().isEmpty()) return s.trim();
        return "";
    }

    // ------------------------------------------------------------ Mach-O
    static final class MachO {
        static List<String> archs(byte[] d) {
            List<String> out = new ArrayList<>();
            if (d.length < 8) return out;
            long be = u32be(d, 0);
            if (be == 0xCAFEBABEL) {
                int n = (int) u32be(d, 4);
                for (int i = 0; i < n && 8 + i * 20 + 20 <= d.length; i++) {
                    int cpu = (int) u32be(d, 8 + i * 20), sub = (int) u32be(d, 12 + i * 20);
                    out.add(name(cpu, sub));
                }
            } else {
                long le = u32le(d, 0);
                if (le == 0xFEEDFACEL || le == 0xFEEDFACFL) out.add(name((int) u32le(d, 4), (int) u32le(d, 8)));
            }
            return out;
        }

        /** Algum slice com LC_ENCRYPTION_INFO e cryptid != 0? */
        static boolean encrypted(byte[] d) {
            List<int[]> slices = new ArrayList<>();
            if (u32be(d, 0) == 0xCAFEBABEL) {
                int n = (int) u32be(d, 4);
                for (int i = 0; i < n; i++) slices.add(new int[] {(int) u32be(d, 16 + i * 20), (int) u32be(d, 20 + i * 20)});
            } else {
                slices.add(new int[] {0, d.length});
            }
            for (int[] s : slices) {
                int base = s[0];
                if (base + 32 > d.length) continue;
                long magic = u32le(d, base);
                int hdr = magic == 0xFEEDFACFL ? 32 : 28;
                int ncmds = (int) u32le(d, base + 16);
                int p = base + hdr;
                for (int i = 0; i < ncmds && p + 8 <= d.length; i++) {
                    long cmd = u32le(d, p), size = u32le(d, p + 4);
                    if ((cmd == 0x21 || cmd == 0x2C) && p + 20 <= d.length && u32le(d, p + 16) != 0) return true;
                    if (size < 8) break;
                    p += (int) size;
                }
            }
            return false;
        }

        static String name(int cpu, int sub) {
            sub &= 0x00FFFFFF;
            if (cpu == 12) return sub == 11 ? "armv7s" : sub == 9 ? "armv7" : sub == 6 ? "armv6" : "armv?";
            if (cpu == 0x0100000C) return sub == 2 ? "arm64e" : "arm64";
            if (cpu == 7) return "i386";
            if (cpu == 0x01000007) return "x86_64";
            return "cpu" + cpu;
        }

        static long u32be(byte[] d, int p) {
            if (p + 4 > d.length) return 0;
            return ((d[p] & 0xFFL) << 24) | ((d[p + 1] & 0xFFL) << 16) | ((d[p + 2] & 0xFFL) << 8) | (d[p + 3] & 0xFFL);
        }

        static long u32le(byte[] d, int p) {
            if (p + 4 > d.length) return 0;
            return ((d[p + 3] & 0xFFL) << 24) | ((d[p + 2] & 0xFFL) << 16) | ((d[p + 1] & 0xFFL) << 8) | (d[p] & 0xFFL);
        }
    }

    // ------------------------------------------------------------ PNG CgBI da Apple
    static final class CgBI {
        static boolean isCgBI(byte[] p) {
            return p.length > 16 && p[12] == 'C' && p[13] == 'g' && p[14] == 'B' && p[15] == 'I';
        }

        /** Converte CgBI (BGRA pré-multiplicado, deflate cru) em PNG RGBA comum. */
        static byte[] toPng(byte[] p) throws IOException {
            int pos = 8, w = 0, h = 0;
            ByteArrayOutputStream idat = new ByteArrayOutputStream();
            while (pos + 12 <= p.length) {
                int len = (int) MachO.u32be(p, pos);
                String type = new String(p, pos + 4, 4, java.nio.charset.StandardCharsets.US_ASCII);
                if (type.equals("IHDR")) { w = (int) MachO.u32be(p, pos + 8); h = (int) MachO.u32be(p, pos + 12); }
                else if (type.equals("IDAT")) idat.write(p, pos + 8, len);
                else if (type.equals("IEND")) break;
                pos += 12 + len;
            }
            if (w <= 0 || h <= 0) throw new IOException("PNG CgBI inválido");
            Inflater inf = new Inflater(true);
            inf.setInput(idat.toByteArray());
            byte[] raw = new byte[(w * 4 + 1) * h];
            try {
                int off = 0;
                while (off < raw.length && !inf.finished()) {
                    int n = inf.inflate(raw, off, raw.length - off);
                    if (n == 0 && (inf.needsInput() || inf.needsDictionary())) break;
                    off += n;
                }
            } catch (java.util.zip.DataFormatException e) {
                throw new IOException("PNG CgBI corrompido", e);
            } finally {
                inf.end();
            }
            int stride = w * 4;
            byte[] px = new byte[stride * h];
            byte[] prev = new byte[stride];
            for (int y = 0; y < h; y++) {
                int f = raw[y * (stride + 1)] & 0xFF;
                int src = y * (stride + 1) + 1;
                byte[] cur = new byte[stride];
                for (int x = 0; x < stride; x++) {
                    int a = x >= 4 ? cur[x - 4] & 0xFF : 0, b = prev[x] & 0xFF, c = x >= 4 ? prev[x - 4] & 0xFF : 0;
                    int v = raw[src + x] & 0xFF;
                    switch (f) {
                        case 1: v += a; break;
                        case 2: v += b; break;
                        case 3: v += (a + b) >> 1; break;
                        case 4: { int pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
                            v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); break; }
                        default: break;
                    }
                    cur[x] = (byte) v;
                }
                for (int x = 0; x < w; x++) {  // BGRA pré-multiplicado -> RGBA
                    int B = cur[x * 4] & 0xFF, G = cur[x * 4 + 1] & 0xFF, R = cur[x * 4 + 2] & 0xFF, A = cur[x * 4 + 3] & 0xFF;
                    if (A > 0 && A < 255) { R = Math.min(255, R * 255 / A); G = Math.min(255, G * 255 / A); B = Math.min(255, B * 255 / A); }
                    int o = y * stride + x * 4;
                    px[o] = (byte) R; px[o + 1] = (byte) G; px[o + 2] = (byte) B; px[o + 3] = (byte) A;
                }
                prev = cur;
            }
            return Png.encode(w, h, px);
        }
    }
}
```

## android/converter/src/main/java/com/portbridge/converter/Plist.java

```java
package com.portbridge.converter;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Leitor de Info.plist: binário (bplist00) ou XML. Devolve Map/List/String/Long/Boolean. */
public final class Plist {
    private Plist() {}

    public static Map<String, Object> parse(byte[] d) {
        if (d.length >= 8 && new String(d, 0, 8, StandardCharsets.US_ASCII).equals("bplist00")) {
            Object top = new Binary(d).top();
            if (top instanceof Map) {
                @SuppressWarnings("unchecked") Map<String, Object> m = (Map<String, Object>) top;
                return m;
            }
            return new LinkedHashMap<>();
        }
        return parseXml(new String(d, StandardCharsets.UTF_8));
    }

    public static String str(Map<String, Object> m, String key) {
        Object v = m.get(key);
        return v instanceof String ? (String) v : null;
    }

    @SuppressWarnings("unchecked")
    public static List<String> strings(Map<String, Object> m, String key) {
        List<String> out = new ArrayList<>();
        Object v = m.get(key);
        if (v instanceof List) for (Object o : (List<Object>) v) if (o instanceof String) out.add((String) o);
        return out;
    }

    // ------------------------------------------------------------ binário
    private static final class Binary {
        final byte[] d;
        final int offSize, refSize;
        final long numObjects, topObject, tableOffset;

        Binary(byte[] d) {
            this.d = d;
            int t = d.length - 32;
            offSize = d[t + 6] & 0xFF;
            refSize = d[t + 7] & 0xFF;
            numObjects = be(t + 8, 8);
            topObject = be(t + 16, 8);
            tableOffset = be(t + 24, 8);
        }

        long be(int p, int n) {
            long v = 0;
            for (int i = 0; i < n; i++) v = (v << 8) | (d[p + i] & 0xFF);
            return v;
        }

        Object top() { return object(topObject, 0); }

        int offset(long idx) { return (int) be((int) (tableOffset + idx * offSize), offSize); }

        Object object(long idx, int depth) {
            if (depth > 32 || idx < 0 || idx >= numObjects) return null;
            int p = offset(idx);
            int marker = d[p] & 0xFF;
            int type = marker >> 4, info = marker & 0x0F;
            switch (type) {
                case 0x0: return info == 0x9 ? Boolean.TRUE : info == 0x8 ? Boolean.FALSE : null;
                case 0x1: return be(p + 1, 1 << info);
                case 0x5: case 0x6: case 0xA: case 0xD: {
                    int[] lp = length(p, info);
                    int len = lp[0], q = lp[1];
                    if (type == 0x5) return new String(d, q, len, StandardCharsets.ISO_8859_1);
                    if (type == 0x6) return new String(d, q, len * 2, StandardCharsets.UTF_16BE);
                    if (type == 0xA) {
                        List<Object> list = new ArrayList<>();
                        for (int i = 0; i < len; i++) list.add(object(be(q + i * refSize, refSize), depth + 1));
                        return list;
                    }
                    Map<String, Object> map = new LinkedHashMap<>();
                    for (int i = 0; i < len; i++) {
                        Object k = object(be(q + i * refSize, refSize), depth + 1);
                        Object v = object(be(q + (len + i) * refSize, refSize), depth + 1);
                        if (k instanceof String) map.put((String) k, v);
                    }
                    return map;
                }
                default: return null;
            }
        }

        int[] length(int p, int info) {
            if (info != 0xF) return new int[] {info, p + 1};
            int m = d[p + 1] & 0x0F;
            int n = 1 << m;
            return new int[] {(int) be(p + 2, n), p + 2 + n};
        }
    }

    // ------------------------------------------------------------ XML (só o necessário)
    private static final Pattern ENTRY = Pattern.compile(
            "<key>([^<]*)</key>\\s*(<string>([^<]*)</string>|<array>(.*?)</array>|<(true|false)\\s*/>|<integer>([^<]*)</integer>)",
            Pattern.DOTALL);
    private static final Pattern ARRAY_STRING = Pattern.compile("<string>([^<]*)</string>");

    static Map<String, Object> parseXml(String s) {
        Map<String, Object> m = new LinkedHashMap<>();
        Matcher e = ENTRY.matcher(s);
        while (e.find()) {
            String k = e.group(1);
            if (m.containsKey(k)) continue;  // primeiro nível tem prioridade
            if (e.group(3) != null) m.put(k, unescape(e.group(3)));
            else if (e.group(4) != null) {
                List<Object> list = new ArrayList<>();
                Matcher a = ARRAY_STRING.matcher(e.group(4));
                while (a.find()) list.add(unescape(a.group(1)));
                m.put(k, list);
            } else if (e.group(5) != null) m.put(k, Boolean.valueOf(e.group(5)));
            else if (e.group(6) != null) {
                try { m.put(k, Long.parseLong(e.group(6).trim())); } catch (NumberFormatException ignored) { }
            }
        }
        return m;
    }

    private static String unescape(String s) {
        return s.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"")
                .replace("&apos;", "'").replace("&amp;", "&");
    }
}
```

## android/converter/src/main/java/com/portbridge/converter/Png.java

```java
package com.portbridge.converter;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.util.zip.CRC32;
import java.util.zip.Deflater;

/** Codificador PNG mínimo (RGBA 8 bits), sem depender de ImageIO/Bitmap. */
public final class Png {
    private Png() {}

    public static byte[] encode(int w, int h, byte[] rgba) throws IOException {
        ByteArrayOutputStream raw = new ByteArrayOutputStream();
        for (int y = 0; y < h; y++) {
            raw.write(0);
            raw.write(rgba, y * w * 4, w * 4);
        }
        Deflater def = new Deflater(9);
        def.setInput(raw.toByteArray());
        def.finish();
        ByteArrayOutputStream z = new ByteArrayOutputStream();
        byte[] buf = new byte[1 << 16];
        while (!def.finished()) z.write(buf, 0, def.deflate(buf));
        def.end();

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        DataOutputStream d = new DataOutputStream(out);
        d.write(new byte[] {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'});
        ByteArrayOutputStream ihdr = new ByteArrayOutputStream();
        DataOutputStream ih = new DataOutputStream(ihdr);
        ih.writeInt(w);
        ih.writeInt(h);
        ih.write(new byte[] {8, 6, 0, 0, 0});
        chunk(d, "IHDR", ihdr.toByteArray());
        chunk(d, "IDAT", z.toByteArray());
        chunk(d, "IEND", new byte[0]);
        return out.toByteArray();
    }

    private static void chunk(DataOutputStream d, String type, byte[] body) throws IOException {
        byte[] t = type.getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        d.writeInt(body.length);
        d.write(t);
        d.write(body);
        CRC32 crc = new CRC32();
        crc.update(t);
        crc.update(body);
        d.writeInt((int) crc.getValue());
    }
}
```

## android/converter/src/main/java/com/portbridge/converter/SigningKey.java

```java
package com.portbridge.converter;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.security.spec.PKCS8EncodedKeySpec;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.TimeZone;

/**
 * Chave de assinatura dos APKs gerados. Criada uma vez e reutilizada: o Android só
 * aceita atualizar um app se a assinatura for a mesma.
 * Arquivos: key.pk8 (PKCS#8) e cert.der (X.509 autoassinado, RSA 2048, SHA-256).
 */
public final class SigningKey {
    public final PrivateKey key;
    public final X509Certificate cert;

    private SigningKey(PrivateKey key, X509Certificate cert) {
        this.key = key;
        this.cert = cert;
    }

    public static SigningKey loadOrCreate(File dir, String commonName) throws IOException, GeneralSecurityException {
        File pk8 = new File(dir, "key.pk8"), der = new File(dir, "cert.der");
        if (pk8.exists() && der.exists()) {
            PrivateKey k = KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(read(pk8)));
            X509Certificate c = (X509Certificate) CertificateFactory.getInstance("X.509")
                    .generateCertificate(new ByteArrayInputStream(read(der)));
            return new SigningKey(k, c);
        }
        dir.mkdirs();
        KeyPairGenerator g = KeyPairGenerator.getInstance("RSA");
        g.initialize(2048, new SecureRandom());
        KeyPair kp = g.generateKeyPair();
        byte[] certDer = selfSigned(kp, commonName);
        write(pk8, kp.getPrivate().getEncoded());
        write(der, certDer);
        X509Certificate c = (X509Certificate) CertificateFactory.getInstance("X.509")
                .generateCertificate(new ByteArrayInputStream(certDer));
        return new SigningKey(kp.getPrivate(), c);
    }

    // ------------------------------------------------------------ DER mínimo
    private static final byte[] OID_SHA256_RSA = {0x2A, (byte) 0x86, 0x48, (byte) 0x86, (byte) 0xF7, 0x0D, 0x01, 0x01, 0x0B};
    private static final byte[] OID_CN = {0x55, 0x04, 0x03};

    static byte[] selfSigned(KeyPair kp, String cn) throws GeneralSecurityException, IOException {
        byte[] algId = seq(tlv(0x06, OID_SHA256_RSA), tlv(0x05, new byte[0]));
        byte[] name = seq(tlv(0x31, seq(tlv(0x06, OID_CN), tlv(0x0C, cn.getBytes(StandardCharsets.UTF_8)))));
        Date from = new Date(System.currentTimeMillis() - 86400000L);
        Date to = new Date(from.getTime() + 80L * 365 * 86400000L);
        byte[] validity = seq(time(from), time(to));
        byte[] serial = tlv(0x02, new BigInteger(63, new SecureRandom()).add(BigInteger.ONE).toByteArray());
        byte[] version = tlv(0xA0, tlv(0x02, new byte[] {2}));  // v3
        byte[] tbs = seq(version, serial, algId, name, validity, name, kp.getPublic().getEncoded());
        Signature s = Signature.getInstance("SHA256withRSA");
        s.initSign(kp.getPrivate());
        s.update(tbs);
        byte[] sig = s.sign();
        byte[] bits = new byte[sig.length + 1];
        System.arraycopy(sig, 0, bits, 1, sig.length);
        return seq(tbs, algId, tlv(0x03, bits));
    }

    private static byte[] time(Date d) throws IOException {
        SimpleDateFormat f = new SimpleDateFormat("yyyyMMddHHmmss'Z'");
        f.setTimeZone(TimeZone.getTimeZone("UTC"));
        String s = f.format(d);
        if (s.compareTo("2050") < 0) return tlv(0x17, s.substring(2).getBytes(StandardCharsets.US_ASCII));
        return tlv(0x18, s.getBytes(StandardCharsets.US_ASCII));
    }

    private static byte[] seq(byte[]... parts) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        for (byte[] p : parts) b.write(p);
        return tlv(0x30, b.toByteArray());
    }

    private static byte[] tlv(int tag, byte[] v) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        b.write(tag);
        int n = v.length;
        if (n < 0x80) b.write(n);
        else if (n < 0x100) { b.write(0x81); b.write(n); }
        else if (n < 0x10000) { b.write(0x82); b.write(n >> 8); b.write(n & 0xFF); }
        else { b.write(0x83); b.write(n >> 16); b.write((n >> 8) & 0xFF); b.write(n & 0xFF); }
        b.write(v);
        return b.toByteArray();
    }

    private static byte[] read(File f) throws IOException {
        try (InputStream in = new FileInputStream(f)) {
            return Ipa.readAll(in);
        }
    }

    private static void write(File f, byte[] d) throws IOException {
        try (OutputStream o = new FileOutputStream(f)) {
            o.write(d);
        }
    }
}
```

## android/gradle.properties

```properties
org.gradle.jvmargs=-Xmx3g -Dfile.encoding=UTF-8
android.useAndroidX=false
android.nonTransitiveRClass=true
android.enableResourceOptimizations=false
```

## android/gradle/wrapper/gradle-wrapper.properties

```properties
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\://services.gradle.org/distributions/gradle-8.14.3-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
```

## android/hle/README.md

````markdown
# Template HLE (touchHLE) — apps iOS nativos de 32 bits

Este módulo gera `hle-release-unsigned.apk`, o template que o conversor usa para
apps iOS **sem engine conhecida**, cujo código é ARM de 32 bits (armv6/armv7):
Objective-C/C++ com OpenGL ES 1.1, típicos de iPhone OS 2 a iOS 5.

Dentro do APK vai o [touchHLE](https://touchhle.org/) (emulador de alto nível do
iOS, MPL-2.0): um JIT (dynarmic) traduz o código ARM32 para ARM64 e as APIs do iOS
(UIKit, Foundation, OpenGL ES, OpenAL, Core Audio…) são reimplementadas em Rust.
O conversor troca pacote, nome, versão e ícone, embute o IPA em `assets/game.ipa`
e assina.

## Como o APK gerado funciona

1. `HleActivity` (extends `SDLActivity`) copia `assets/game.ipa` para
   `files/game.ipa` na primeira execução e a cada atualização do APK.
2. Chama o touchHLE com `files/game.ipa --fullscreen --lenient --no-error-popup`
   (mais `hle_args` de `assets/portbridge.json`, se houver).
3. O log fica em `Android/data/<pacote>/files/touchHLE_log.txt` e os dados do jogo
   (saves) em `Android/data/<pacote>/files/touchHLE_sandbox/`.
4. Se o jogo fecha com erro (`Panic`, `touchHLE errored`), o app mostra na hora o
   fim do log com **Compartilhar relatório** (e, se não deu para ver, de novo na
   próxima abertura). Se o jogo travar sem fechar, tocar e segurar o ícone →
   **Relatório** mostra o log da última execução. É isso que precisa ser enviado
   quando um jogo não roda.

`--lenient` é uma opção do patch do PortBridge: em vez de fechar o app quando ele
chama uma função, classe ou método que o touchHLE ainda não tem, registra um aviso
(uma vez) e devolve 0/nil. Recursos como loja In-App, Twitter e Game Center ficam
simplesmente sem efeito. Também cobre erros internos de funções já implementadas
(um `unimplemented!()` para um parâmetro raro, por exemplo): o estado da CPU é
restaurado ao de antes da chamada, ela devolve 0 e o log registra
`PortBridge (lenient): recovered from an error`. Erros da CPU emulada (acesso
inválido à memória etc.) continuam fechando o jogo.

## Patch do PortBridge

O submódulo `third_party/touchHLE` fica no commit oficial; as mudanças estão em
`third_party/patches/touchHLE/portbridge.patch`, aplicado na compilação
(`sh tools/touchhle_patches.sh apply`, idempotente). Para alterar:

```bash
sh tools/touchhle_patches.sh apply      # aplica
# ...edite third_party/touchHLE/...
sh tools/touchhle_patches.sh save       # grava o patch
```

Resumo do patch: `SDL_main` aceita argumentos no Android (abre o IPA embutido em vez
do seletor de apps), builds marcados como `UNOFFICIAL`, modo `--lenient`, e as APIs
que apps feitos com o SDK do iOS 5/6 importam (ARC, runtime de *blocks*, proteção de
pilha, `__divmodsi4`, introspecção `class_*`/`ivar_*`, subscripting e literais,
`NSOrderedSet`, `presentViewController:…`). Detalhes em
[docs/ROADMAP.md](../../docs/ROADMAP.md#fase-3-apps-nativos-com-touchhle--primeira-versão).

O projeto touchHLE não aceita contribuições geradas com IA; por isso essas mudanças
ficam só no PortBridge e não devem ser enviadas a ele.

## Compilar

Além do que o resto de `android/` pede (JDK 17, SDK 35, NDK 28.2):

```bash
rustup target add aarch64-linux-android
cargo install cargo-ndk
git submodule update --init --recursive third_party/touchHLE
# Boost (só cabeçalhos): apt install libboost-dev | brew install boost
# (tools/touchhle_patches.sh liga /usr/include/boost etc. em vendor/boost)

cd android
./gradlew :hle:assembleRelease      # ou :app:assembleRelease / :converter:desktopJar
```

A tarefa `touchHLENative` roda `cargo ndk -t arm64-v8a` e copia `libtouchHLE.so`,
`libSDL2.so` e `libc++_shared.so`. Para o SDL2 do touchHLE compilar com o NDK r28,
o build força a inclusão de `third_party/patches/touchHLE/android_looper_compat.h`
(`ALooper_pollAll` foi removida do NDK). Com `-Ppb.hle.prebuilt=<pasta>` o Gradle usa
bibliotecas já compiladas (`<pasta>/arm64-v8a/*.so`); com `-Ppb.noHle`, o conversor é
montado sem este template.

Só `arm64-v8a`: o dynarmic gera código para ARM64 e x86_64, e o x86_64 só serviria
para emuladores.

## Rodar um IPA no computador (testes)

O touchHLE do patch também compila para Linux (`cargo build --release` em
`third_party/touchHLE`, com `PORTBRIDGE_BUILD=1`). Com Xvfb, ImageMagick e xdotool dá
para rodar um jogo sem tela, tirar capturas e simular toques:

```bash
Xvfb :91 -screen 0 1024x768x24 &
cd pasta_de_teste   # com links para touchHLE_dylibs, touchHLE_fonts e touchHLE_default_options.txt
DISPLAY=:91 SDL_AUDIODRIVER=dummy ALSOFT_DRIVERS=null \
    ../third_party/touchHLE/target/release/touchHLE Jogo.ipa --lenient --no-error-popup &
DISPLAY=:91 import -window root captura.png
DISPLAY=:91 xdotool mousemove --window "$(DISPLAY=:91 xdotool search --name touchHLE)" 240 205 click 1
```

O log fica em `touchHLE_log.txt` na pasta de teste. No modo tolerante, cada erro
recuperado vem com a função (ou `[Classe método]`) onde aconteceu.

No computador o touchHLE usa a camada GLES1-sobre-GL2; no Android, o OpenGL ES 1.1
do aparelho. Para testar o caminho do Android, compile um Mesa com GLES1 (o Mesa das
distribuições costuma vir sem) e rode com `--gles1=gles1_native`:

```bash
apt-get source mesa   # precisa de deb-src; ou o tarball do Mesa
meson setup build --prefix=$PWD/inst -Dplatforms=x11 -Degl=enabled -Dgles1=enabled \
    -Dgles2=enabled -Dglx=disabled -Dglvnd=disabled -Dgbm=disabled \
    -Dgallium-drivers=softpipe -Dvulkan-drivers= -Dllvm=disabled -Dvideo-codecs= \
    -Dxmlconfig=disabled -Dbuild-tests=false
ninja -C build install
DISPLAY=:91 LD_LIBRARY_PATH=$PWD/inst/lib/x86_64-linux-gnu SDL_VIDEO_X11_FORCE_EGL=1 \
    .../touchHLE Jogo.ipa --gles1=gles1_native --lenient --no-error-popup
```

O log mostra `Driver info: OpenGL ES-CM 1.1 Mesa …`. Os quadros são apresentados por
um contexto GL separado, que compartilha os objetos com o do jogo, para não mexer no
estado GL do jogo (ver o estudo de caso do Ninja Striker em `docs/ROADMAP.md`).

## Checar um IPA antes

```bash
python -m portbridge hle-check Jogo.ipa
```

Compara o que o executável importa e chama com `portbridge/data/touchhle_api.json`
(gerado por `tools/gen_touchhle_api.py` a partir do touchHLE com o patch). É uma
estimativa estática: o app não é executado.

## Licença

touchHLE: MPL-2.0 (dynarmic 0BSD, SDL2 zlib, OpenAL Soft LGPL, dylibs do
`touchHLE_dylibs` com as licenças dos respectivos `COPYING.*`). Quem distribuir APKs
com este runtime precisa disponibilizar o código-fonte do touchHLE usado (o commit
do submódulo mais o patch) para quem recebe o APK.
````

## android/hle/build.gradle

```groovy
plugins {
    id 'com.android.application'
}

// Template dos APKs gerados para apps iOS nativos (código ARM de 32 bits):
// o touchHLE (emulador de alto nível, MPL-2.0) com os patches do PortBridge,
// sem jogo. O conversor troca pacote, nome, versão e ícone, embute o IPA em
// assets/game.ipa e assina — igual ao template Clickteam (:runtime).
//
// Requisitos para compilar: Rust (rustup target add aarch64-linux-android),
// cargo-ndk (cargo install cargo-ndk), cabeçalhos do Boost em
// third_party/touchHLE/vendor/boost (veja android/hle/README.md).
// Com -Ppb.hle.prebuilt=<pasta> usa bibliotecas já compiladas (arm64-v8a/*.so).
def touchhleDir = file('../../third_party/touchHLE')
def jniOut = layout.buildDirectory.dir('touchhle-jni').get().asFile
def assetsOut = layout.buildDirectory.dir('touchhle-assets').get().asFile
def cargoFeatures = 'touchHLE_openal_soft_wrapper/static,sdl2/bundled'

android {
    namespace 'com.portbridge.hle'
    compileSdk 35
    ndkVersion '28.2.13676358'

    defaultConfig {
        applicationId 'com.portbridge.rtplaceholder'   // Converter.PLACEHOLDER_PACKAGE
        minSdk 21
        targetSdk 35
        versionCode 1
        versionName '@@PB_VERSION@@'                    // Converter.PLACEHOLDER_VERSION
        ndk {
            // dynarmic (o JIT ARM32 do touchHLE) só gera código para arm64 e x86_64
            abiFilters 'arm64-v8a'
        }
    }

    sourceSets {
        main {
            java.srcDirs = ['src/main/java',
                            "${touchhleDir}/vendor/SDL/android-project/app/src/main/java"]
            jniLibs.srcDirs = [jniOut]
            assets.srcDirs = ['src/main/assets', assetsOut]
        }
    }

    buildTypes {
        release {
            minifyEnabled false
            shrinkResources false
            signingConfig null   // o conversor assina cada APK gerado
            vcsInfo.include false   // não embute dados do repositório nos APKs distribuídos
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }

    packaging {
        jniLibs {
            useLegacyPackaging false
        }
    }

    androidResources {
        noCompress += ['ipa']
    }
}

tasks.register('applyTouchHLEPatches', Exec) {
    description 'Aplica third_party/patches/touchHLE/*.patch (idempotente)'
    workingDir rootDir.parentFile
    commandLine 'sh', 'tools/touchhle_patches.sh', 'apply'
}

tasks.register('touchHLENative') {
    description 'Compila libtouchHLE.so (+ libSDL2.so, libc++_shared.so) para arm64-v8a'
    def prebuilt = project.findProperty('pb.hle.prebuilt')
    if (!prebuilt) dependsOn 'applyTouchHLEPatches'
    outputs.dir jniOut
    outputs.upToDateWhen { false }   // o cargo decide o que recompilar
    doLast {
        def abiDir = new File(jniOut, 'arm64-v8a')
        abiDir.mkdirs()
        if (prebuilt) {
            project.copy { from(new File(prebuilt.toString(), 'arm64-v8a')) { include '*.so' }; into abiDir }
            return
        }
        def ndk = android.ndkDirectory.absolutePath
        project.exec {
            workingDir touchhleDir
            environment 'ANDROID_NDK_HOME', ndk
            environment 'ANDROID_NDK', ndk
            environment 'PORTBRIDGE_BUILD', '1'
            // SDL2 do touchHLE ainda chama ALooper_pollAll, removida no NDK r28
            environment 'CFLAGS_aarch64_linux_android',
                        '-include ' + file('../../third_party/patches/touchHLE/android_looper_compat.h').absolutePath
            commandLine 'cargo', 'ndk', '-t', 'arm64-v8a', '-P', '21', '-o', jniOut.absolutePath,
                        'build', '--release', '--lib', '--no-default-features', '--features', cargoFeatures
        }
        // SDL2 (compilado pelo sdl2-sys) e a libc++ do NDK ficam na pasta do target
        def rel = new File(touchhleDir, 'target/aarch64-linux-android/release')
        project.copy { from(rel) { include 'libSDL2.so', 'libc++_shared.so' }; into abiDir }
        ['libtouchHLE.so', 'libSDL2.so', 'libc++_shared.so'].each {
            if (!new File(abiDir, it).exists()) throw new GradleException("faltou ${it} em ${abiDir}")
        }
    }
}

tasks.register('touchHLEAssets', Copy) {
    description 'Copia as dylibs, fontes e opções padrão do touchHLE para os assets'
    from(touchhleDir) {
        include 'touchHLE_dylibs/**', 'touchHLE_fonts/**', 'touchHLE_default_options.txt'
        exclude '**/README.md'
    }
    into assetsOut
}

tasks.named('preBuild') {
    dependsOn 'touchHLENative', 'touchHLEAssets'
}
```

## android/hle/src/main/AndroidManifest.xml

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    android:installLocation="auto">

    <uses-feature android:glEsVersion="0x00010001" android:required="true" />
    <uses-feature android:name="android.hardware.touchscreen" android:required="false" />
    <uses-feature android:name="android.hardware.gamepad" android:required="false" />
    <uses-feature android:name="android.hardware.bluetooth" android:required="false" />
    <uses-feature android:name="android.hardware.usb.host" android:required="false" />

    <uses-permission android:name="android.permission.VIBRATE" />

    <!-- "@@PB_LABEL@@" é trocado pelo nome do jogo (Converter.PLACEHOLDER_LABEL) -->
    <application
        android:allowBackup="true"
        android:hardwareAccelerated="true"
        android:extractNativeLibs="false"
        android:icon="@mipmap/ic_launcher"
        android:label="@@PB_LABEL@@"
        android:theme="@android:style/Theme.Black.NoTitleBar.Fullscreen">

        <activity
            android:name="com.portbridge.hle.HleActivity"
            android:exported="true"
            android:alwaysRetainTaskState="true"
            android:launchMode="singleInstance"
            android:preferMinimalPostProcessing="true"
            android:configChanges="layoutDirection|locale|orientation|uiMode|screenLayout|screenSize|smallestScreenSize|keyboard|keyboardHidden|navigation">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- atalho "Relatório" (tocar e segurar o ícone): log da última execução -->
        <activity
            android:name="com.portbridge.hle.ReportActivity"
            android:exported="true"
            android:excludeFromRecents="true"
            android:taskAffinity=""
            android:theme="@android:style/Theme.Translucent.NoTitleBar" />
    </application>
</manifest>
```

## android/hle/src/main/java/com/portbridge/hle/HleActivity.java

```java
package com.portbridge.hle;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.InputDevice;
import android.view.Surface;
import android.view.SurfaceHolder;

import org.json.JSONArray;
import org.json.JSONObject;
import org.libsdl.app.SDLActivity;
import org.libsdl.app.SDLSurface;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * App gerado pelo PortBridge para um app iOS nativo: roda o IPA embutido em
 * assets/game.ipa no touchHLE (emulação de alto nível do iOS).
 *
 * <p>O touchHLE precisa de um caminho de arquivo, então na primeira execução
 * (e a cada atualização do APK) o IPA é copiado para files/game.ipa. O log da
 * última execução fica em Android/data/&lt;pacote&gt;/files/touchHLE_log.txt; se
 * ela terminou com erro, o app mostra o relatório e oferece compartilhar.
 */
public class HleActivity extends SDLActivity {
    private static final String TAG = "PortBridge";
    private boolean exitReportShown;

    @Override
    protected void onCreate(Bundle state) {
        File log = Report.logFile(this);
        String previous = Report.readTail(log);
        super.onCreate(state);
        Report.installShortcut(this);
        if (Report.hasFatalError(previous) && !Report.alreadyShown(this, log)) {
            Report.markShown(this, log);
            Report.show(this, "O jogo fechou com erro na última vez", previous, null);
        }
    }

    /**
     * O SDL chama finish() quando o touchHLE termina. Se terminou com erro,
     * mostra o relatório na hora, antes de fechar.
     */
    @Override
    public void finish() {
        if (!exitReportShown) {
            File log = Report.logFile(this);
            String text = Report.readTail(log);
            if (Report.hasFatalError(text)) {
                exitReportShown = true;
                Report.markShown(this, log);
                Report.show(this, "O jogo fechou com erro", text, super::finish);
                return;
            }
        }
        super.finish();
    }

    @Override
    protected String[] getLibraries() {
        return new String[] {"c++_shared", "SDL2", "touchHLE"};
    }

    /** Chamado na thread do SDL (não na de UI), então a cópia do IPA não trava a tela. */
    // O jogo desenha 60 quadros/s: pede ao sistema a tela a 60 Hz. Em aparelhos
    // de 120 Hz isso evita a tela trabalhando no dobro do ritmo do jogo (menos
    // bateria e menos calor) e casa cada quadro com uma atualização da tela.
    @Override
    protected SDLSurface createSDLSurface(Context context) {
        SDLSurface surface = super.createSDLSurface(context);
        // Toques entregues assim que chegam, sem esperar o lote do próximo quadro
        // da tela (o Android agrupa os eventos por quadro): o jogo vê o dedo antes.
        if (Build.VERSION.SDK_INT >= 30) {
            surface.requestUnbufferedDispatch(InputDevice.SOURCE_CLASS_POINTER);
        }
        surface.getHolder().addCallback(new SurfaceHolder.Callback() {
            @Override public void surfaceCreated(SurfaceHolder h) { request60Hz(h); }
            @Override public void surfaceChanged(SurfaceHolder h, int f, int w, int ht) { request60Hz(h); }
            @Override public void surfaceDestroyed(SurfaceHolder h) { }
        });
        return surface;
    }

    private static void request60Hz(SurfaceHolder holder) {
        if (Build.VERSION.SDK_INT < 30) return;
        try {
            holder.getSurface().setFrameRate(60f, Surface.FRAME_RATE_COMPATIBILITY_FIXED_SOURCE);
        } catch (RuntimeException e) {
            // superfície já liberada: a próxima chamada (surfaceChanged) resolve
        }
    }

    @Override
    protected String[] getArguments() {
        List<String> args = new ArrayList<>();
        try {
            args.add(extractGame().getAbsolutePath());
        } catch (Exception e) {
            Log.e(TAG, "não foi possível preparar o jogo", e);
            appendLog("PortBridge: ERRO ao copiar o jogo embutido: " + e);
            return new String[0];   // abre o seletor de apps do touchHLE, com o erro no log
        }
        args.add("--fullscreen");
        // O que o touchHLE ainda não implementa (loja, redes sociais...) vira
        // "nada" com aviso no log, em vez de fechar o jogo.
        args.add("--lenient");
        // O relatório do PortBridge substitui a janela de erro do touchHLE
        // (cujo botão "Open touchHLE directory" não funciona no APK gerado).
        args.add("--no-error-popup");
        // Opções extras por jogo (o conversor pode gravar em assets/portbridge.json)
        try (InputStream in = getAssets().open("portbridge.json")) {
            JSONObject cfg = new JSONObject(new String(readAll(in), StandardCharsets.UTF_8));
            JSONArray extra = cfg.optJSONArray("hle_args");
            if (extra != null) for (int i = 0; i < extra.length(); i++) args.add(extra.getString(i));
        } catch (Exception ignored) {
            // sem configuração extra
        }
        return args.toArray(new String[0]);
    }

    /** Copia assets/game.ipa para files/game.ipa quando o APK é instalado/atualizado. */
    private File extractGame() throws Exception {
        File ipa = new File(getFilesDir(), "game.ipa");
        File stamp = new File(getFilesDir(), "game.ipa.stamp");
        PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), 0);
        String want = pi.lastUpdateTime + ":" + pi.versionName;
        if (ipa.exists() && want.equals(readSmall(stamp))) return ipa;

        File tmp = new File(getFilesDir(), "game.ipa.tmp");
        try (InputStream in = getAssets().open("game.ipa");
             OutputStream out = new FileOutputStream(tmp)) {
            byte[] buf = new byte[1 << 16];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        }
        if (ipa.exists() && !ipa.delete()) throw new IllegalStateException("não apagou " + ipa);
        if (!tmp.renameTo(ipa)) throw new IllegalStateException("não renomeou " + tmp);
        try (OutputStream out = new FileOutputStream(stamp)) {
            out.write(want.getBytes(StandardCharsets.UTF_8));
        }
        return ipa;
    }

    private void appendLog(String line) {
        try (OutputStream out = new FileOutputStream(Report.logFile(this), true)) {
            out.write((line + "\n").getBytes(StandardCharsets.UTF_8));
        } catch (Exception ignored) {
        }
    }

    private static String readSmall(File f) {
        if (!f.exists()) return null;
        try (InputStream in = new FileInputStream(f)) {
            return new String(readAll(in), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }

    private static byte[] readAll(InputStream in) throws java.io.IOException {
        ByteArrayOutputStream bo = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
        return bo.toByteArray();
    }
}
```

## android/hle/src/main/java/com/portbridge/hle/Report.java

```java
package com.portbridge.hle;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ShortcutInfo;
import android.content.pm.ShortcutManager;
import android.graphics.drawable.Icon;
import android.os.Build;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

/** Log do touchHLE: leitura, detecção de erro fatal e o diálogo de relatório. */
final class Report {
    private static final String[] FATAL_MARKERS = {
        "Panic at", "Panic:", "touchHLE errored", "PortBridge: ERRO",
    };
    private static final String PREFS = "portbridge_report";

    private Report() {}

    static File logFile(Context c) {
        // SDL_AndroidGetExternalStoragePath() == getExternalFilesDir(null)
        File base = c.getExternalFilesDir(null);
        return new File(base != null ? base : c.getFilesDir(), "touchHLE_log.txt");
    }

    static boolean hasFatalError(String log) {
        if (log == null) return false;
        for (String m : FATAL_MARKERS) if (log.contains(m)) return true;
        return false;
    }

    /** Identifica uma execução (o log é recriado a cada abertura do jogo). */
    private static String stamp(File log) {
        return log.length() + ":" + log.lastModified();
    }

    static boolean alreadyShown(Context c, File log) {
        SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return stamp(log).equals(p.getString("shown", ""));
    }

    static void markShown(Context c, File log) {
        c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("shown", stamp(log)).apply();
    }

    static String deviceLine() {
        return "Aparelho: " + Build.MANUFACTURER + " " + Build.MODEL + " · Android " + Build.VERSION.RELEASE
                + " (API " + Build.VERSION.SDK_INT + ")";
    }

    /** Mostra o fim do log com "Compartilhar relatório"; onClose roda ao fechar. */
    static void show(Activity a, String title, String log, Runnable onClose) {
        String full = deviceLine() + "\n\n" + (log == null ? "(o log está vazio)" : log);
        String tail = full.length() > 6000 ? "…" + full.substring(full.length() - 6000) : full;
        a.runOnUiThread(() -> {
            AlertDialog d = new AlertDialog.Builder(a)
                    .setTitle(title)
                    .setMessage(tail)
                    .setNegativeButton("Fechar", null)
                    .setPositiveButton("Compartilhar relatório", (dlg, w) -> {
                        Intent i = new Intent(Intent.ACTION_SEND);
                        i.setType("text/plain");
                        i.putExtra(Intent.EXTRA_SUBJECT, "Relatório do PortBridge (touchHLE)");
                        i.putExtra(Intent.EXTRA_TEXT, full);
                        a.startActivity(Intent.createChooser(i, "Compartilhar relatório"));
                    })
                    .create();
            if (onClose != null) d.setOnDismissListener(x -> onClose.run());
            d.show();
        });
    }

    /** Atalho "Relatório" ao tocar e segurar o ícone do jogo (Android 7.1+). */
    static void installShortcut(Context c) {
        if (Build.VERSION.SDK_INT < 25) return;
        try {
            ShortcutManager sm = c.getSystemService(ShortcutManager.class);
            if (sm == null) return;
            Intent intent = new Intent(c, ReportActivity.class).setAction(Intent.ACTION_VIEW);
            ShortcutInfo info = new ShortcutInfo.Builder(c, "report")
                    .setShortLabel("Relatório")
                    .setLongLabel("Relatório de erros")
                    .setIcon(Icon.createWithResource(c, R.mipmap.ic_launcher))
                    .setIntent(intent)
                    .build();
            sm.setDynamicShortcuts(Collections.singletonList(info));
        } catch (Exception ignored) {
            // atalhos são opcionais
        }
    }

    static String readTail(File f) {
        if (!f.exists()) return null;
        try (InputStream in = new FileInputStream(f)) {
            long len = f.length(), max = 64 * 1024;
            if (len > max) in.skip(len - max);   // o fim do log é o que importa
            byte[] b = new byte[(int) Math.min(len, max)];
            int off = 0, n;
            while (off < b.length && (n = in.read(b, off, b.length - off)) > 0) off += n;
            return off > 0 ? new String(b, 0, off, StandardCharsets.UTF_8) : null;
        } catch (Exception e) {
            return null;
        }
    }
}
```

## android/hle/src/main/java/com/portbridge/hle/ReportActivity.java

```java
package com.portbridge.hle;

import android.app.Activity;
import android.os.Bundle;

/** Aberta pelo atalho "Relatório": mostra o log da última execução do jogo. */
public class ReportActivity extends Activity {
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        String log = Report.readTail(Report.logFile(this));
        Report.show(this, "Relatório da última execução", log, this::finish);
    }
}
```

## android/runtime/build.gradle

```groovy
plugins {
    id 'com.android.application'
}

// Template dos APKs gerados: o runtime do PortBridge (player C++) sem jogo.
// O conversor troca pacote, nome, versão e ícone, embute o IPA e assina.
def playerDir = file('../../player')

android {
    namespace 'com.portbridge.runtime'
    compileSdk 35
    ndkVersion '28.2.13676358'

    defaultConfig {
        applicationId 'com.portbridge.rtplaceholder'   // Converter.PLACEHOLDER_PACKAGE
        minSdk 21
        targetSdk 35
        versionCode 1
        versionName '@@PB_VERSION@@'                    // Converter.PLACEHOLDER_VERSION
        externalNativeBuild {
            cmake {
                arguments '-DANDROID_STL=c++_shared', '-DPB_BUILD_TOOLS=OFF',
                          '-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON'
            }
        }
        ndk {
            abiFilters 'arm64-v8a', 'armeabi-v7a', 'x86_64'
        }
    }

    externalNativeBuild {
        cmake {
            path "${playerDir}/CMakeLists.txt"
            version '3.22.1'
        }
    }

    sourceSets {
        main {
            java.srcDirs = ['src/main/java',
                            "${playerDir}/third_party/SDL/android-project/app/src/main/java"]
        }
    }

    buildTypes {
        release {
            minifyEnabled false
            shrinkResources false
            signingConfig null   // o conversor assina cada APK gerado
            vcsInfo.include false   // não embute dados do repositório nos APKs distribuídos
        }
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }

    packaging {
        jniLibs {
            useLegacyPackaging false
        }
    }

    androidResources {
        // o jogo vai em assets/game.ipa sem compressão (já é zip)
        noCompress += ['ipa']
    }
}
```

## android/runtime/src/main/AndroidManifest.xml

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-feature android:glEsVersion="0x00020000" android:required="true" />
    <uses-feature android:name="android.hardware.touchscreen" android:required="false" />

    <!-- "@@PB_LABEL@@" é trocado pelo nome do jogo (Converter.PLACEHOLDER_LABEL) -->
    <application
        android:allowBackup="true"
        android:hardwareAccelerated="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@@PB_LABEL@@"
        android:theme="@android:style/Theme.Black.NoTitleBar.Fullscreen">

        <activity
            android:name="com.portbridge.runtime.GameActivity"
            android:exported="true"
            android:alwaysRetainTaskState="true"
            android:launchMode="singleInstance"
            android:configChanges="layoutDirection|locale|orientation|uiMode|screenLayout|screenSize|smallestScreenSize|keyboard|keyboardHidden|navigation">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

## android/runtime/src/main/java/com/portbridge/runtime/GameActivity.java

```java
package com.portbridge.runtime;

import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.InputDevice;
import android.view.Surface;
import android.view.SurfaceHolder;

import org.libsdl.app.SDLActivity;
import org.libsdl.app.SDLSurface;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * App gerado pelo PortBridge: roda o jogo embutido em assets/game.ipa com o runtime nativo.
 * O log da última execução fica em files/portbridge.log; se ela terminou com erro ou
 * travamento, o app mostra o relatório e oferece compartilhar.
 */
public class GameActivity extends SDLActivity {
    private File log;

    @Override
    protected void onCreate(Bundle state) {
        log = new File(getFilesDir(), "portbridge.log");
        String previous = read(log);
        super.onCreate(state);
        if (previous != null && (previous.contains("TRAVAMENTO:") || previous.contains("ERRO:"))) {
            showReport(previous);
        }
    }

    // O jogo desenha 60 quadros/s: pede ao sistema a tela a 60 Hz. Em aparelhos
    // de 120 Hz isso evita a tela trabalhando no dobro do ritmo do jogo (menos
    // bateria e menos calor) e casa cada quadro com uma atualização da tela.
    @Override
    protected SDLSurface createSDLSurface(Context context) {
        SDLSurface surface = super.createSDLSurface(context);
        // Toques entregues assim que chegam, sem esperar o lote do próximo quadro
        // da tela (o Android agrupa os eventos por quadro): o jogo vê o dedo antes.
        if (Build.VERSION.SDK_INT >= 30) {
            surface.requestUnbufferedDispatch(InputDevice.SOURCE_CLASS_POINTER);
        }
        surface.getHolder().addCallback(new SurfaceHolder.Callback() {
            @Override public void surfaceCreated(SurfaceHolder h) { request60Hz(h); }
            @Override public void surfaceChanged(SurfaceHolder h, int f, int w, int ht) { request60Hz(h); }
            @Override public void surfaceDestroyed(SurfaceHolder h) { }
        });
        return surface;
    }

    private static void request60Hz(SurfaceHolder holder) {
        if (Build.VERSION.SDK_INT < 30) return;
        try {
            holder.getSurface().setFrameRate(60f, Surface.FRAME_RATE_COMPATIBILITY_FIXED_SOURCE);
        } catch (RuntimeException e) {
            // superfície já liberada: a próxima chamada (surfaceChanged) resolve
        }
    }

    @Override
    protected String[] getLibraries() {
        return new String[] {"c++_shared", "SDL2", "main"};
    }

    @Override
    protected String[] getArguments() {
        File save = new File(getFilesDir(), "save");
        save.mkdirs();
        return new String[] {
            "asset:game.ipa",
            "--save-dir", save.getAbsolutePath(),
            "--log", log.getAbsolutePath(),
            "--device", Build.MANUFACTURER + " " + Build.MODEL + " Android " + Build.VERSION.RELEASE
                    + " (API " + Build.VERSION.SDK_INT + ", " + Build.SUPPORTED_ABIS[0] + ")",
        };
    }

    private void showReport(String text) {
        String tail = text.length() > 6000 ? text.substring(text.length() - 6000) : text;
        runOnUiThread(() -> new AlertDialog.Builder(this)
                .setTitle("O jogo fechou com erro na última vez")
                .setMessage(tail)
                .setNegativeButton("Fechar", null)
                .setPositiveButton("Compartilhar relatório", (d, w) -> {
                    Intent i = new Intent(Intent.ACTION_SEND);
                    i.setType("text/plain");
                    i.putExtra(Intent.EXTRA_SUBJECT, "Relatório do PortBridge");
                    i.putExtra(Intent.EXTRA_TEXT, text);
                    startActivity(Intent.createChooser(i, "Compartilhar relatório"));
                }).show());
    }

    private static String read(File f) {
        if (!f.exists()) return null;
        try (InputStream in = new FileInputStream(f)) {
            long len = f.length(), max = 64 * 1024;
            if (len > max) in.skip(len - max);  // o fim do log é o que importa
            byte[] b = new byte[(int) Math.min(len, max)];
            int off = 0, n;
            while (off < b.length && (n = in.read(b, off, b.length - off)) > 0) off += n;
            return off > 0 ? new String(b, 0, off, StandardCharsets.UTF_8) : null;
        } catch (Exception e) {
            return null;
        }
    }
}
```

## android/settings.gradle

```groovy
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "PortBridge"
include ':app', ':runtime', ':hle', ':converter'
```

---

# Patch do touchHLE (runtime de apps nativos; não entra no APK do Zorbié)

## third_party/patches/touchHLE/android_looper_compat.h

```cpp
/*
 * PortBridge: compatibility shim for building touchHLE's bundled SDL2 with
 * NDK r28+. Those NDKs mark ALooper_pollAll() as removed (it "may ignore
 * wakes"); SDL2's Android sensor code still calls it. This header is
 * force-included (-include) into the C files compiled for Android and
 * redirects the call to ALooper_pollOnce(), which has the same signature.
 * SDL only polls its own sensor queue (registered with an ident > 0), so the
 * behaviour is the same for it.
 */
#ifndef PORTBRIDGE_ANDROID_LOOPER_COMPAT_H
#define PORTBRIDGE_ANDROID_LOOPER_COMPAT_H
#if defined(__ANDROID__)
#include <android/looper.h>
static inline int portbridge_ALooper_pollAll(int timeoutMillis, int *outFd, int *outEvents,
                                             void **outData) {
    return ALooper_pollOnce(timeoutMillis, outFd, outEvents, outData);
}
#define ALooper_pollAll portbridge_ALooper_pollAll
#endif
#endif
```

## third_party/patches/touchHLE/portbridge.patch

```diff
diff --git a/OPTIONS_HELP.txt b/OPTIONS_HELP.txt
index 9297a5f..072b7e6 100644
--- a/OPTIONS_HELP.txt
+++ b/OPTIONS_HELP.txt
@@ -280,6 +280,12 @@ Other options:
     --allow-network-access
         Allow apps running in touchHLE to access the Internet and the local network.
 
+    --lenient
+        (PortBridge) When the app calls a function, class or method that is
+        not implemented, log a warning once and carry on as if it returned
+        0/nil, instead of stopping the app. Useful for optional features
+        (in-app purchases, social networks); may cause odd behaviour.
+
     --ignore-gl-errors
         Ignore host OpenGL errors as queried by glGetError function.
         This only affects return value of glGetError as seen by the guest
diff --git a/src/audio.rs b/src/audio.rs
index fd8b35c..b15fc37 100644
--- a/src/audio.rs
+++ b/src/audio.rs
@@ -48,6 +48,34 @@ pub struct AudioDescription {
     pub bits_per_channel: u32,
 }
 
+/// PortBridge: returns the `data` chunk of a RIFF/WAVE file whose `fmt ` chunk
+/// says MPEG (0x50) or MPEG Layer 3 (0x55).
+fn mp3_inside_wave(bytes: &[u8]) -> Option<Vec<u8>> {
+    if bytes.len() < 12 || &bytes[0..4] != b"RIFF" || &bytes[8..12] != b"WAVE" {
+        return None;
+    }
+    let mut pos = 12;
+    let mut is_mpeg = false;
+    while pos + 8 <= bytes.len() {
+        let id = &bytes[pos..pos + 4];
+        let size = u32::from_le_bytes(bytes[pos + 4..pos + 8].try_into().ok()?) as usize;
+        let body = pos + 8;
+        let end = body.checked_add(size)?.min(bytes.len());
+        if id == b"fmt " && end >= body + 2 {
+            let tag = u16::from_le_bytes([bytes[body], bytes[body + 1]]);
+            is_mpeg = tag == 0x55 || tag == 0x50;
+        } else if id == b"data" {
+            return if is_mpeg {
+                Some(bytes[body..end].to_vec())
+            } else {
+                None
+            };
+        }
+        pos = body + size + (size & 1);
+    }
+    None
+}
+
 pub struct AudioFile(AudioFileInner);
 enum AudioFileInner {
     Wave(hound::WavReader<Cursor<Vec<u8>>>),
@@ -89,6 +117,13 @@ impl AudioFile {
         // are immediately decoding the entire file to PCM and acting as if
         // it's a PCM file, simply because because this is easier. Full MP3
         // support would require a lot of changes in Audio Toolbox.
+        } else if let Some(mp3) = mp3_inside_wave(&bytes) {
+            // PortBridge: RIFF/WAVE container with an MPEG Layer 3 payload
+            // (format tag 0x55), which neither hound nor symphonia's WAVE reader
+            // accept; decode the payload as a plain MP3 stream.
+            symphonia_formats::decode_symphonia_to_pcm(Cursor::new(mp3))
+                .map(|pcm| AudioFile(AudioFileInner::Symphonia(pcm)))
+                .map_err(|_| AudioFileOpenError::FileDecodeError)
         } else if let Ok(pcm) = symphonia_formats::decode_symphonia_to_pcm(Cursor::new(bytes)) {
             Ok(AudioFile(AudioFileInner::Symphonia(pcm)))
         } else {
diff --git a/src/dyld.rs b/src/dyld.rs
index 71b8d00..f02c7b1 100644
--- a/src/dyld.rs
+++ b/src/dyld.rs
@@ -228,6 +228,8 @@ pub struct Dyld {
     /// The `&'static str` part here is purely for debugging and could be
     /// removed in release builds if it's ever necessary.
     linked_host_functions: Vec<(&'static str, HostFunction)>,
+    /// PortBridge: name of the host function being called (diagnostics).
+    pub last_host_symbol: &'static str,
     return_to_host_routine: Option<GuestFunction>,
     thread_exit_routine: Option<GuestFunction>,
     constants_to_link_later: Vec<(MutPtr<ConstVoidPtr>, &'static HostConstant)>,
@@ -257,6 +259,7 @@ impl Dyld {
     pub fn new() -> Dyld {
         Dyld {
             linked_host_functions: Vec::new(),
+            last_host_symbol: "",
             return_to_host_routine: None,
             thread_exit_routine: None,
             constants_to_link_later: Vec::new(),
@@ -641,7 +644,12 @@ impl Dyld {
     ) -> Option<HostFunction> {
         match svc {
             Self::SVC_LAZY_LINK | Self::SVC_LAZY_LINK_RET_FLAG => {
-                self.do_lazy_link(bins, mem, cpu, svc_pc)
+                let before = self.linked_host_functions.len();
+                let f = self.do_lazy_link(bins, mem, cpu, svc_pc);
+                if self.linked_host_functions.len() > before {
+                    self.last_host_symbol = self.linked_host_functions.last().unwrap().0;
+                }
+                f
             }
             Self::SVC_THREAD_EXIT | Self::SVC_RETURN_TO_HOST => unreachable!(), // don't handle here
             Self::SVC_LINKED_FUNCTIONS_BASE.. => {
@@ -653,6 +661,7 @@ impl Dyld {
                     panic!("Unexpected SVC #{svc} at {svc_pc:#x}");
                 };
                 log_dbg!("Call to host function, already linked: {}", symbol);
+                self.last_host_symbol = symbol;
                 Some(f)
             }
         }
@@ -808,6 +817,26 @@ impl Dyld {
             }
         }
 
+        if crate::objc::is_lenient() {
+            // PortBridge: link the stub to a function that returns 0, so the
+            // app can carry on (the warning is logged once per symbol).
+            crate::objc::warn_once(format!(
+                "call to unimplemented function {symbol}; it will return 0"
+            ));
+            let &(stub_symbol, f) = &crate::objc::UNIMPLEMENTED_FUNCTION[0];
+            let idx: u32 = self.linked_host_functions.len().try_into().unwrap();
+            let mut svc = idx + Self::SVC_LINKED_FUNCTIONS_BASE;
+            if info.entry_size == 4 {
+                assert!(svc < Self::SVC_LAZY_LINK_RET_FLAG);
+                svc |= Self::SVC_LAZY_LINK_RET_FLAG;
+            }
+            self.linked_host_functions.push((stub_symbol, f));
+            let stub_function_ptr: MutPtr<u32> = Ptr::from_bits(svc_pc);
+            mem.write(stub_function_ptr, encode_a32_svc(svc));
+            cpu.invalidate_cache_range(stub_function_ptr.to_bits(), 4);
+            return Some(f);
+        }
+
         panic!("Call to unimplemented function {symbol}");
     }
 
diff --git a/src/environment.rs b/src/environment.rs
index 131c45d..2cf8ccb 100644
--- a/src/environment.rs
+++ b/src/environment.rs
@@ -497,6 +497,26 @@ impl Environment {
             }
         }
 
+        // PortBridge: on iOS 5, libSystem re-exports the compiler support
+        // routines (__divsi3, __moddi3, __fixdfdi...). touchHLE only loads the
+        // bundled libgcc_s when the app links it directly, so apps built with
+        // newer SDKs (which link only libSystem) got 0 back from those calls.
+        let gcc_path = fs::GuestPath::new("/usr/lib/libgcc_s.1.dylib");
+        if !dylibs
+            .iter()
+            .any(|d: &mach_o::MachO| d.name.starts_with("libgcc_s"))
+            && executable
+                .dynamic_libraries
+                .iter()
+                .any(|d| d.starts_with("/usr/lib/libSystem"))
+            && fs.is_file(gcc_path)
+        {
+            let gcc = mach_o::MachO::load_from_file(gcc_path, &fs, &mut mem, 0x30000000)
+                .map_err(|e| format!("Could not load bundled dylib: {e}"))?;
+            log!("PortBridge: loaded libgcc_s.1.dylib for the compiler support routines");
+            dylibs.push(gcc);
+        }
+
         let entry_point_addr = executable
             .entry_point_pc
             .ok_or_else(|| {
@@ -1608,7 +1628,38 @@ impl Environment {
                             svc_pc,
                             svc,
                         ) {
-                            f.call_from_guest(self);
+                            if crate::objc::is_lenient() {
+                                // PortBridge: a panic inside the host function
+                                // becomes "returned 0" with the CPU state as it
+                                // was before the call.
+                                let saved_regs = *self.cpu.regs();
+                                let saved_cpsr = self.cpu.cpsr();
+                                if crate::objc::run_guarded(|| f.call_from_guest(self)).is_err() {
+                                    let symbol = self.dyld.last_host_symbol;
+                                    let message = if symbol.starts_with("objc_msgSend") {
+                                        crate::objc::last_host_message().map(|(class, sel)| {
+                                            format!(
+                                                " [{} {}]",
+                                                self.objc.try_get_class_name(class).unwrap_or("?"),
+                                                sel.as_str(&self.mem)
+                                            )
+                                        })
+                                    } else {
+                                        None
+                                    };
+                                    log!(
+                                        "PortBridge (lenient): the error above was in {}{}",
+                                        symbol,
+                                        message.unwrap_or_default()
+                                    );
+                                    self.cpu.regs_mut().copy_from_slice(&saved_regs);
+                                    self.cpu.set_cpsr(saved_cpsr);
+                                    self.cpu.regs_mut()[0] = 0;
+                                    self.cpu.regs_mut()[1] = 0;
+                                }
+                            } else {
+                                f.call_from_guest(self);
+                            }
                             if let Some(len) = self.options.zero_stack_after_guest_to_host_call {
                                 log_once!("Applying zeroing of stack after guest to host call.");
                                 let start = self.cpu.regs()[cpu::Cpu::SP] - len;
diff --git a/src/frameworks.rs b/src/frameworks.rs
index 30c70c0..a295725 100644
--- a/src/frameworks.rs
+++ b/src/frameworks.rs
@@ -53,6 +53,8 @@ pub struct State {
     openal: openal::State,
     opengles: opengles::State,
     uikit: uikit::State,
+    /// PortBridge: device vibration.
+    pub portbridge_haptics: crate::portbridge_haptics::State,
 }
 
 /// Container for thread local state of various child modules
diff --git a/src/frameworks/audio_toolbox/audio_services.rs b/src/frameworks/audio_toolbox/audio_services.rs
index b8469b5..1d22e1c 100644
--- a/src/frameworks/audio_toolbox/audio_services.rs
+++ b/src/frameworks/audio_toolbox/audio_services.rs
@@ -141,7 +141,8 @@ fn AudioServicesGetProperty(
 
 fn AudioServicesPlaySystemSound(env: &mut Environment, sys_sound_id: SystemSoundID) {
     if sys_sound_id == kSystemSoundID_Vibrate {
-        log!("TODO: vibration (AudioServicesPlaySystemSound)");
+        // PortBridge: vibrate the device (Android), like an iPhone does.
+        crate::portbridge_haptics::vibrate(1.0, 400);
     } else {
         let (state, context) =
             State::get_with_context(&mut env.framework_state, &mut env.openal_manager);
diff --git a/src/frameworks/audio_toolbox/extended_audio_file.rs b/src/frameworks/audio_toolbox/extended_audio_file.rs
index f973abf..f224f96 100644
--- a/src/frameworks/audio_toolbox/extended_audio_file.rs
+++ b/src/frameworks/audio_toolbox/extended_audio_file.rs
@@ -55,6 +55,63 @@ type ExtAudioFileRef = MutPtr<OpaqueExtAudioFile>;
 type ExtAudioFilePropertyID = u32;
 const kExtAudioFileProperty_FileDataFormat: ExtAudioFilePropertyID = fourcc(b"ffmt");
 const kExtAudioFileProperty_ClientDataFormat: ExtAudioFilePropertyID = fourcc(b"cfmt");
+// PortBridge: more properties (values from the public ExtendedAudioFile.h docs).
+const kExtAudioFileProperty_FileLengthFrames: ExtAudioFilePropertyID = fourcc(b"#frm");
+const kExtAudioFileProperty_AudioFile: ExtAudioFilePropertyID = fourcc(b"afil");
+const kExtAudioFileError_InvalidProperty: OSStatus = -66561;
+const kAudio_ParamError: OSStatus = -50;
+
+/// PortBridge: apps sometimes keep using a ref after ExtAudioFileOpenURL
+/// failed (uninitialised variable); answer with an error instead of aborting.
+fn is_open(env: &Environment, ext: ExtAudioFileRef) -> bool {
+    env.framework_state
+        .audio_toolbox
+        .extended_audio_file
+        .extended_audio_files
+        .contains_key(&ext)
+}
+
+/// PortBridge: the file's data format, as touchHLE exposes it (always linear
+/// PCM: compressed formats are decoded when the file is opened).
+fn file_data_format(env: &Environment, ext: ExtAudioFileRef) -> AudioStreamBasicDescription {
+    let host_object = env
+        .framework_state
+        .audio_toolbox
+        .extended_audio_file
+        .extended_audio_files
+        .get(&ext)
+        .unwrap();
+    let audio_file = &env
+        .framework_state
+        .audio_toolbox
+        .audio_file
+        .audio_files
+        .get(&host_object.guest_audio_file)
+        .unwrap()
+        .audio_file;
+    AudioStreamBasicDescription::from_audio_description(audio_file.audio_description())
+}
+
+/// PortBridge: length of the file in sample frames.
+fn file_length_frames(env: &Environment, ext: ExtAudioFileRef) -> i64 {
+    let host_object = env
+        .framework_state
+        .audio_toolbox
+        .extended_audio_file
+        .extended_audio_files
+        .get(&ext)
+        .unwrap();
+    let audio_file = &env
+        .framework_state
+        .audio_toolbox
+        .audio_file
+        .audio_files
+        .get(&host_object.guest_audio_file)
+        .unwrap()
+        .audio_file;
+    let desc = audio_file.audio_description();
+    (audio_file.packet_count() * u64::from(desc.frames_per_packet.max(1))) as i64
+}
 
 fn ExtAudioFileOpenURL(
     env: &mut Environment,
@@ -110,13 +167,76 @@ fn ExtAudioFileGetProperty(
     out_property_data: MutVoidPtr,
 ) -> OSStatus {
     return_if_null!(in_ext_audio_file);
+    if !is_open(env, in_ext_audio_file) {
+        log!(
+            "Warning: {} called with an ExtAudioFileRef that is not open",
+            "ExtAudioFileGetProperty"
+        );
+        return kAudio_ParamError;
+    }
+
+    // PortBridge: properties answered directly.
+    match in_property_id {
+        kExtAudioFileProperty_FileLengthFrames => {
+            if env.mem.read(io_property_data_size) < guest_size_of::<i64>() {
+                return kAudioFileBadPropertySizeError;
+            }
+            let frames = file_length_frames(env, in_ext_audio_file);
+            env.mem.write(out_property_data.cast(), frames);
+            env.mem.write(io_property_data_size, guest_size_of::<i64>());
+            return 0;
+        }
+        kExtAudioFileProperty_ClientDataFormat => {
+            if env.mem.read(io_property_data_size) < guest_size_of::<AudioStreamBasicDescription>()
+            {
+                return kAudioFileBadPropertySizeError;
+            }
+            let client = env
+                .framework_state
+                .audio_toolbox
+                .extended_audio_file
+                .extended_audio_files
+                .get(&in_ext_audio_file)
+                .unwrap()
+                .client_data_format;
+            let desc = match client {
+                Some(desc) => desc,
+                None => file_data_format(env, in_ext_audio_file),
+            };
+            env.mem.write(out_property_data.cast(), desc);
+            env.mem.write(
+                io_property_data_size,
+                guest_size_of::<AudioStreamBasicDescription>(),
+            );
+            return 0;
+        }
+        kExtAudioFileProperty_AudioFile => {
+            if env.mem.read(io_property_data_size) < guest_size_of::<AudioFileID>() {
+                return kAudioFileBadPropertySizeError;
+            }
+            let audio_file = env
+                .framework_state
+                .audio_toolbox
+                .extended_audio_file
+                .extended_audio_files
+                .get(&in_ext_audio_file)
+                .unwrap()
+                .guest_audio_file;
+            env.mem.write(out_property_data.cast(), audio_file);
+            return 0;
+        }
+        _ => (),
+    }
 
     let audio_file_property_id = match in_property_id {
         kExtAudioFileProperty_FileDataFormat => kAudioFilePropertyDataFormat,
-        _ => unimplemented!(
-            "Unimplemented property ID: {}",
-            debug_fourcc(in_property_id)
-        ),
+        _ => {
+            log!(
+                "Warning: ExtAudioFileGetProperty: unimplemented property {}",
+                debug_fourcc(in_property_id)
+            );
+            return kExtAudioFileError_InvalidProperty;
+        }
     };
 
     let required_size = property_size(audio_file_property_id);
@@ -150,8 +270,21 @@ fn ExtAudioFileSetProperty(
     in_property_data: ConstVoidPtr,
 ) -> OSStatus {
     return_if_null!(in_ext_audio_file);
+    if !is_open(env, in_ext_audio_file) {
+        log!(
+            "Warning: {} called with an ExtAudioFileRef that is not open",
+            "ExtAudioFileSetProperty"
+        );
+        return kAudio_ParamError;
+    }
 
-    assert_eq!(in_property_id, kExtAudioFileProperty_ClientDataFormat);
+    if in_property_id != kExtAudioFileProperty_ClientDataFormat {
+        log!(
+            "Warning: ExtAudioFileSetProperty: ignoring unimplemented property {}",
+            debug_fourcc(in_property_id)
+        );
+        return kExtAudioFileError_InvalidProperty;
+    }
     assert_eq!(
         in_property_data_size,
         guest_size_of::<AudioStreamBasicDescription>()
@@ -171,7 +304,7 @@ fn ExtAudioFileSetProperty(
         .extended_audio_files
         .get_mut(&in_ext_audio_file)
         .unwrap();
-    assert!(host_object.client_data_format.is_none());
+    // PortBridge: setting it again (same or new format) just replaces it.
     host_object.client_data_format = Some(client_audio_desc);
 
     let host_object = env
@@ -192,7 +325,18 @@ fn ExtAudioFileSetProperty(
         other_host_object.audio_file.audio_description(),
     );
     // TODO: support audio format conversions
-    assert_eq!(audio_desc, client_audio_desc);
+    if audio_desc != client_audio_desc {
+        if crate::objc::is_lenient() {
+            log!(
+                "Warning: ExtAudioFileSetProperty: format conversion is not implemented \
+                 (file {:?}, client {:?}); audio will be read unconverted",
+                audio_desc,
+                client_audio_desc
+            );
+        } else {
+            assert_eq!(audio_desc, client_audio_desc);
+        }
+    }
 
     0 // success
 }
@@ -204,10 +348,18 @@ fn ExtAudioFileRead(
     io_data: MutPtr<AudioBufferList<1>>,
 ) -> OSStatus {
     return_if_null!(in_ext_audio_file);
+    if !is_open(env, in_ext_audio_file) {
+        log!(
+            "Warning: {} called with an ExtAudioFileRef that is not open",
+            "ExtAudioFileRead"
+        );
+        return kAudio_ParamError;
+    }
 
     let mut audio_buffer_list = env.mem.read(io_data);
     let num_buffers = audio_buffer_list.number_buffers;
     assert_eq!(num_buffers, 1);
+    let file_format = file_data_format(env, in_ext_audio_file);
 
     let host_object = env
         .framework_state
@@ -217,11 +369,16 @@ fn ExtAudioFileRead(
         .get(&in_ext_audio_file)
         .unwrap();
 
-    audio_buffer_list.buffers[0].number_channels =
-        host_object.client_data_format.unwrap().channels_per_frame;
+    audio_buffer_list.buffers[0].number_channels = host_object
+        .client_data_format
+        .unwrap_or(file_format)
+        .channels_per_frame;
 
     let number_frames = env.mem.read(io_number_frames);
-    let bytes_per_frame = host_object.client_data_format.unwrap().bytes_per_frame;
+    let bytes_per_frame = host_object
+        .client_data_format
+        .unwrap_or(file_format)
+        .bytes_per_frame;
     let number_of_bytes = number_frames.checked_mul(bytes_per_frame).unwrap();
     let number_of_bytes_ptr = env.mem.alloc_and_write(number_of_bytes);
     let res = AudioFileReadBytes(
@@ -268,8 +425,76 @@ fn ExtAudioFileRead(
     0 // success
 }
 
+/// PortBridge: position in sample frames of the client format.
+fn ExtAudioFileSeek(
+    env: &mut Environment,
+    in_ext_audio_file: ExtAudioFileRef,
+    in_frame_offset: i64,
+) -> OSStatus {
+    return_if_null!(in_ext_audio_file);
+    if !is_open(env, in_ext_audio_file) {
+        log!(
+            "Warning: {} called with an ExtAudioFileRef that is not open",
+            "ExtAudioFileSeek"
+        );
+        return kAudio_ParamError;
+    }
+    let file_format = file_data_format(env, in_ext_audio_file);
+    let host_object = env
+        .framework_state
+        .audio_toolbox
+        .extended_audio_file
+        .extended_audio_files
+        .get_mut(&in_ext_audio_file)
+        .unwrap();
+    let bytes_per_frame = host_object
+        .client_data_format
+        .unwrap_or(file_format)
+        .bytes_per_frame;
+    host_object.current_bytes_read = in_frame_offset.max(0) * i64::from(bytes_per_frame);
+    0 // success
+}
+
+fn ExtAudioFileTell(
+    env: &mut Environment,
+    in_ext_audio_file: ExtAudioFileRef,
+    out_frame_offset: MutPtr<i64>,
+) -> OSStatus {
+    return_if_null!(in_ext_audio_file);
+    if !is_open(env, in_ext_audio_file) {
+        log!(
+            "Warning: {} called with an ExtAudioFileRef that is not open",
+            "ExtAudioFileTell"
+        );
+        return kAudio_ParamError;
+    }
+    let file_format = file_data_format(env, in_ext_audio_file);
+    let host_object = env
+        .framework_state
+        .audio_toolbox
+        .extended_audio_file
+        .extended_audio_files
+        .get(&in_ext_audio_file)
+        .unwrap();
+    let bytes_per_frame = host_object
+        .client_data_format
+        .unwrap_or(file_format)
+        .bytes_per_frame
+        .max(1);
+    let frames = host_object.current_bytes_read / i64::from(bytes_per_frame);
+    env.mem.write(out_frame_offset, frames);
+    0 // success
+}
+
 fn ExtAudioFileDispose(env: &mut Environment, in_ext_audio_file: ExtAudioFileRef) -> OSStatus {
     return_if_null!(in_ext_audio_file);
+    if !is_open(env, in_ext_audio_file) {
+        log!(
+            "Warning: {} called with an ExtAudioFileRef that is not open",
+            "ExtAudioFileDispose"
+        );
+        return kAudio_ParamError;
+    }
 
     let host_object = env
         .framework_state
@@ -299,5 +524,7 @@ pub const FUNCTIONS: FunctionExports = &[
     export_c_func!(ExtAudioFileGetProperty(_, _, _, _)),
     export_c_func!(ExtAudioFileSetProperty(_, _, _, _)),
     export_c_func!(ExtAudioFileRead(_, _, _)),
+    export_c_func!(ExtAudioFileSeek(_, _)),
+    export_c_func!(ExtAudioFileTell(_, _)),
     export_c_func!(ExtAudioFileDispose(_)),
 ];
diff --git a/src/frameworks/core_graphics/cg_image.rs b/src/frameworks/core_graphics/cg_image.rs
index a6b936a..02aa003 100644
--- a/src/frameworks/core_graphics/cg_image.rs
+++ b/src/frameworks/core_graphics/cg_image.rs
@@ -205,11 +205,19 @@ fn CGImageCreateWithJPEGDataProvider(
     from_image(env, image)
 }
 
-fn CGImageGetAlphaInfo(_env: &mut Environment, _image: CGImageRef) -> CGImageAlphaInfo {
+fn CGImageGetAlphaInfo(env: &mut Environment, image: CGImageRef) -> CGImageAlphaInfo {
     // our Image type always returns premultiplied RGBA
     // (the premultiplied part must match what the real UIImage does, but
     // considering CgBI's design, maybe the order doesn't?)
-    kCGImageAlphaPremultipliedLast
+    // PortBridge: images whose file had no alpha channel (RGB or palette PNG
+    // without transparency, JPEG) report no alpha, like iOS. Texture loaders
+    // branch on this; e.g. games that use a color key (pure green) only remove
+    // it for images without alpha.
+    if image != nil && !borrow_image(&env.objc, image).has_alpha() {
+        kCGImageAlphaNoneSkipLast
+    } else {
+        kCGImageAlphaPremultipliedLast
+    }
 }
 
 fn CGImageGetColorSpace(env: &mut Environment, _image: CGImageRef) -> CGColorSpaceRef {
diff --git a/src/frameworks/foundation.rs b/src/frameworks/foundation.rs
index 441c507..d112ca7 100644
--- a/src/frameworks/foundation.rs
+++ b/src/frameworks/foundation.rs
@@ -44,6 +44,7 @@ pub mod ns_notification_center;
 pub mod ns_null;
 pub mod ns_objc_runtime;
 pub mod ns_object;
+pub mod ns_ordered_set;
 pub mod ns_process_info;
 pub mod ns_property_list_serialization;
 pub mod ns_run_loop;
@@ -86,6 +87,7 @@ pub const DYLIB: crate::dyld::HostDylib = crate::dyld::HostDylib {
         ns_locale::CLASSES,
         ns_lock::CLASSES,
         ns_notification::CLASSES,
+        ns_ordered_set::CLASSES,
         ns_notification_center::CLASSES,
         ns_null::CLASSES,
         ns_method_signature::CLASSES,
diff --git a/src/frameworks/foundation/ns_array.rs b/src/frameworks/foundation/ns_array.rs
index a23f284..a192554 100644
--- a/src/frameworks/foundation/ns_array.rs
+++ b/src/frameworks/foundation/ns_array.rs
@@ -248,6 +248,12 @@ pub const CLASSES: ClassExports = objc_classes! {
     true
 }
 
+
+// PortBridge: subscripting used by Objective-C literals (iOS 6 SDK).
+- (id)objectAtIndexedSubscript:(NSUInteger)index {
+    msg![env; this objectAtIndex:index]
+}
+
 @end
 
 // NSMutableArray is an abstract class. A subclass must provide everything
@@ -346,6 +352,17 @@ pub const CLASSES: ClassExports = objc_classes! {
     other
 }
 
+
+// PortBridge: `array[i] = obj` (appends when i == count, like Apple's).
+- (())setObject:(id)obj atIndexedSubscript:(NSUInteger)index {
+    let count: NSUInteger = msg![env; this count];
+    if index == count {
+        msg![env; this addObject:obj]
+    } else {
+        msg![env; this replaceObjectAtIndex:index withObject:obj]
+    }
+}
+
 @end
 
 // Our private subclass that is the single implementation of NSArray for the
diff --git a/src/frameworks/foundation/ns_dictionary.rs b/src/frameworks/foundation/ns_dictionary.rs
index 7e49445..6d70520 100644
--- a/src/frameworks/foundation/ns_dictionary.rs
+++ b/src/frameworks/foundation/ns_dictionary.rs
@@ -381,6 +381,20 @@ pub const CLASSES: ClassExports = objc_classes! {
 // For the time being, that will always be _touchHLE_NSDictionary.
 @implementation NSDictionary: NSObject
 
+// PortBridge: `@{...}` literals and `dict[key]` subscripting (iOS 6 SDK).
++ (id)dictionaryWithObjects:(ConstPtr<id>)objects
+                    forKeys:(ConstPtr<id>)keys
+                      count:(NSUInteger)count {
+    let mut pairs = Vec::with_capacity(count as usize);
+    for i in 0..count {
+        let key: id = env.mem.read(keys + i);
+        let object: id = env.mem.read(objects + i);
+        pairs.push((key, object));
+    }
+    let dict = dict_from_keys_and_objects(env, &pairs);
+    autorelease(env, dict)
+}
+
 + (id)allocWithZone:(NSZonePtr)zone {
     // NSDictionary might be subclassed by something which needs allocWithZone:
     // to have the normal behaviour. Unimplemented: call superclass alloc then.
@@ -538,6 +552,10 @@ pub const CLASSES: ClassExports = objc_classes! {
     msg![env; this objectForKey:file_type_key]
 }
 
+- (id)objectForKeyedSubscript:(id)key {
+    msg![env; this objectForKey:key]
+}
+
 @end
 
 // NSMutableDictionary is an abstract class. A subclass must provide everything
@@ -593,6 +611,16 @@ pub const CLASSES: ClassExports = objc_classes! {
     res
 }
 
+
+// PortBridge: `dict[key] = obj` (iOS 6 SDK).
+- (())setObject:(id)object forKeyedSubscript:(id)key {
+    if object == nil {
+        msg![env; this removeObjectForKey:key]
+    } else {
+        msg![env; this setObject:object forKey:key]
+    }
+}
+
 @end
 
 // Our private subclass that is the single implementation of NSDictionary for
diff --git a/src/frameworks/foundation/ns_ordered_set.rs b/src/frameworks/foundation/ns_ordered_set.rs
new file mode 100644
index 0000000..740ec00
--- /dev/null
+++ b/src/frameworks/foundation/ns_ordered_set.rs
@@ -0,0 +1,214 @@
+/*
+ * This Source Code Form is subject to the terms of the Mozilla Public
+ * License, v. 2.0. If a copy of the MPL was not distributed with this
+ * file, You can obtain one at https://mozilla.org/MPL/2.0/.
+ */
+//! `NSOrderedSet` and `NSMutableOrderedSet` (iOS 5), added by PortBridge.
+//!
+//! A simple implementation: the elements live in an `NSMutableArray` owned by
+//! the set, and uniqueness is checked with `containsObject:` (`isEqual:`).
+
+use super::ns_enumerator::NSFastEnumerationState;
+use super::NSUInteger;
+use crate::mem::{ConstPtr, MutPtr};
+use crate::objc::{
+    autorelease, id, msg, msg_class, nil, objc_classes, release, ClassExports, HostObject,
+    NSZonePtr,
+};
+
+struct OrderedSetHostObject {
+    /// NSMutableArray *
+    array: id,
+}
+impl HostObject for OrderedSetHostObject {}
+
+fn inner(env: &mut crate::Environment, this: id) -> id {
+    let array = env.objc.borrow::<OrderedSetHostObject>(this).array;
+    if array != nil {
+        return array;
+    }
+    let array: id = msg_class![env; NSMutableArray new];
+    env.objc.borrow_mut::<OrderedSetHostObject>(this).array = array;
+    array
+}
+
+fn add_unique(env: &mut crate::Environment, this: id, object: id) {
+    if object == nil {
+        return;
+    }
+    let array = inner(env, this);
+    let contains: bool = msg![env; array containsObject:object];
+    if !contains {
+        () = msg![env; array addObject:object];
+    }
+}
+
+pub const CLASSES: ClassExports = objc_classes! {
+
+(env, this, _cmd);
+
+@implementation NSOrderedSet: NSObject
+
++ (id)allocWithZone:(NSZonePtr)_zone {
+    let host_object = Box::new(OrderedSetHostObject { array: nil });
+    env.objc.alloc_object(this, host_object, &mut env.mem)
+}
+
++ (id)orderedSet {
+    let set: id = msg![env; this new];
+    autorelease(env, set)
+}
++ (id)orderedSetWithObject:(id)object {
+    let set: id = msg![env; this new];
+    add_unique(env, set, object);
+    autorelease(env, set)
+}
++ (id)orderedSetWithArray:(id)array {
+    let set: id = msg![env; this alloc];
+    let set: id = msg![env; set initWithArray:array];
+    autorelease(env, set)
+}
++ (id)orderedSetWithObjects:(ConstPtr<id>)objects count:(NSUInteger)count {
+    let set: id = msg![env; this new];
+    for i in 0..count {
+        let object: id = env.mem.read(objects + i);
+        add_unique(env, set, object);
+    }
+    autorelease(env, set)
+}
+
+- (id)init {
+    inner(env, this);
+    this
+}
+- (id)initWithArray:(id)array {
+    inner(env, this);
+    let count: NSUInteger = msg![env; array count];
+    for i in 0..count {
+        let object: id = msg![env; array objectAtIndex:i];
+        add_unique(env, this, object);
+    }
+    this
+}
+- (id)initWithOrderedSet:(id)other {
+    let array: id = msg![env; other array];
+    msg![env; this initWithArray:array]
+}
+
+- (())dealloc {
+    let array = env.objc.borrow::<OrderedSetHostObject>(this).array;
+    release(env, array);
+    env.objc.dealloc_object(this, &mut env.mem)
+}
+
+- (id)copyWithZone:(NSZonePtr)_zone {
+    let array = inner(env, this);
+    let copy: id = msg_class![env; NSOrderedSet alloc];
+    msg![env; copy initWithArray:array]
+}
+- (id)mutableCopyWithZone:(NSZonePtr)_zone {
+    let array = inner(env, this);
+    let copy: id = msg_class![env; NSMutableOrderedSet alloc];
+    msg![env; copy initWithArray:array]
+}
+
+- (NSUInteger)count {
+    let array = inner(env, this);
+    msg![env; array count]
+}
+- (id)objectAtIndex:(NSUInteger)index {
+    let array = inner(env, this);
+    msg![env; array objectAtIndex:index]
+}
+- (id)objectAtIndexedSubscript:(NSUInteger)index {
+    let array = inner(env, this);
+    msg![env; array objectAtIndex:index]
+}
+- (NSUInteger)indexOfObject:(id)object {
+    let array = inner(env, this);
+    msg![env; array indexOfObject:object]
+}
+- (bool)containsObject:(id)object {
+    let array = inner(env, this);
+    msg![env; array containsObject:object]
+}
+- (id)firstObject {
+    let array = inner(env, this);
+    msg![env; array firstObject]
+}
+- (id)lastObject {
+    let array = inner(env, this);
+    msg![env; array lastObject]
+}
+- (id)array {
+    let array = inner(env, this);
+    let copy: id = msg_class![env; NSArray alloc];
+    let copy: id = msg![env; copy initWithArray:array];
+    autorelease(env, copy)
+}
+- (id)objectEnumerator {
+    let array = inner(env, this);
+    msg![env; array objectEnumerator]
+}
+- (NSUInteger)countByEnumeratingWithState:(MutPtr<NSFastEnumerationState>)state
+                                  objects:(MutPtr<id>)stackbuf
+                                    count:(NSUInteger)len {
+    let array = inner(env, this);
+    msg![env; array countByEnumeratingWithState:state objects:stackbuf count:len]
+}
+
+@end
+
+@implementation NSMutableOrderedSet: NSOrderedSet
+
+- (())addObject:(id)object {
+    add_unique(env, this, object);
+}
+- (())addObjectsFromArray:(id)array {
+    let count: NSUInteger = msg![env; array count];
+    for i in 0..count {
+        let object: id = msg![env; array objectAtIndex:i];
+        add_unique(env, this, object);
+    }
+}
+- (())insertObject:(id)object atIndex:(NSUInteger)index {
+    let array = inner(env, this);
+    let contains: bool = msg![env; array containsObject:object];
+    if !contains {
+        () = msg![env; array insertObject:object atIndex:index];
+    }
+}
+- (())setObject:(id)object atIndex:(NSUInteger)index {
+    let array = inner(env, this);
+    let count: NSUInteger = msg![env; array count];
+    if index >= count {
+        add_unique(env, this, object);
+    } else {
+        let contains: bool = msg![env; array containsObject:object];
+        if !contains {
+            () = msg![env; array replaceObjectAtIndex:index withObject:object];
+        }
+    }
+}
+- (())setObject:(id)object atIndexedSubscript:(NSUInteger)index {
+    () = msg![env; this setObject:object atIndex:index];
+}
+- (())replaceObjectAtIndex:(NSUInteger)index withObject:(id)object {
+    () = msg![env; this setObject:object atIndex:index];
+}
+- (())removeObject:(id)object {
+    let array = inner(env, this);
+    () = msg![env; array removeObject:object];
+}
+- (())removeObjectAtIndex:(NSUInteger)index {
+    let array = inner(env, this);
+    () = msg![env; array removeObjectAtIndex:index];
+}
+- (())removeAllObjects {
+    let array = inner(env, this);
+    () = msg![env; array removeAllObjects];
+}
+
+@end
+
+};
diff --git a/src/frameworks/foundation/ns_run_loop.rs b/src/frameworks/foundation/ns_run_loop.rs
index f473e09..e8a3ecd 100644
--- a/src/frameworks/foundation/ns_run_loop.rs
+++ b/src/frameworks/foundation/ns_run_loop.rs
@@ -86,6 +86,11 @@ pub const CLASSES: ClassExports = objc_classes! {
     run_loop_for_thread(env, this, env.current_thread)
 }
 
+// PortBridge: only the default mode is modelled.
+- (id)currentMode {
+    ns_string::get_static_str(env, NSDefaultRunLoopMode)
+}
+
 // TODO: more accessors
 
 - (id) retain { this }
diff --git a/src/frameworks/foundation/ns_string.rs b/src/frameworks/foundation/ns_string.rs
index 99906b0..bcbb17f 100644
--- a/src/frameworks/foundation/ns_string.rs
+++ b/src/frameworks/foundation/ns_string.rs
@@ -62,6 +62,8 @@ const C_STRING_FRIENDLY_ENCODINGS: &[NSStringEncoding] = &[
     NSWindowsCP1252StringEncoding,
     NSMacOSRomanStringEncoding,
     NSISOLatin1StringEncoding,
+    // PortBridge: multibyte encodings without zero bytes (Japanese apps)
+    NSShiftJISStringEncoding,
 ];
 
 pub const NSMaximumStringLength: NSUInteger = (i32::MAX - 1) as _;
@@ -111,13 +113,15 @@ impl StringHostObject {
                 let string = unsafe { String::from_utf8_unchecked(bytes.into_owned()) };
                 StringHostObject::Utf8(Cow::Owned(string))
             }
-            NSMacOSRomanStringEncoding | NSISOLatin1StringEncoding => {
-                // TODO: support non ASCII symbols
-                assert!(bytes.iter().all(|byte| byte.is_ascii()));
-                // Safety: guaranteed by above assertion
-                let string = unsafe { String::from_utf8_unchecked(bytes.into_owned()) };
+            NSISOLatin1StringEncoding => {
+                // PortBridge: ISO 8859-1 maps each byte to the same code point
+                let string: String = bytes.iter().map(|&b| char::from(b)).collect();
                 StringHostObject::Utf8(Cow::Owned(string))
             }
+            NSMacOSRomanStringEncoding => {
+                let (cow, _, _) = encoding_rs::MACINTOSH.decode(&bytes);
+                StringHostObject::Utf8(Cow::Owned(cow.into_owned()))
+            }
             NSUTF8StringEncoding => {
                 let string = String::from_utf8(bytes.into_owned()).unwrap();
                 StringHostObject::Utf8(Cow::Owned(string))
@@ -129,9 +133,11 @@ impl StringHostObject {
                 StringHostObject::Utf8(Cow::Owned(cow.into_owned()))
             }
             NSShiftJISStringEncoding => {
-                let (cow, encoding_used, had_errors) = SHIFT_JIS.decode(&bytes);
-                assert_eq!(encoding_used, SHIFT_JIS);
-                assert!(!had_errors);
+                // PortBridge: invalid sequences become U+FFFD instead of aborting
+                let (cow, _encoding_used, had_errors) = SHIFT_JIS.decode(&bytes);
+                if had_errors {
+                    log!("Warning: invalid Shift-JIS bytes in string, replaced");
+                }
                 log_dbg!("ShiftJIS decoded {:?}", cow);
                 StringHostObject::Utf8(Cow::Owned(cow.to_string()))
             }
diff --git a/src/frameworks/foundation/ns_timer.rs b/src/frameworks/foundation/ns_timer.rs
index 68fc992..e978cdf 100644
--- a/src/frameworks/foundation/ns_timer.rs
+++ b/src/frameworks/foundation/ns_timer.rs
@@ -66,6 +66,18 @@ pub const CLASSES: ClassExports = objc_classes! {
     });
     let new = env.objc.alloc_object(this, host_object, &mut env.mem);
 
+    // PortBridge: repeating timers usually drive the game loop, so their
+    // interval (e.g. 1/60 s or 1/30 s) is worth having in the log.
+    if repeats {
+        log!(
+            "New repeating timer {:?}, interval {}s ({:.1}/s), target [{:?} {}]",
+            new,
+            ns_interval,
+            1.0 / ns_interval,
+            target,
+            selector.as_str(&env.mem),
+        );
+    }
     log_dbg!(
         "New {} timer {:?}, interval {}s, target [{:?} {}], user info {:?}",
         if repeats { "repeating" } else { "single-use" },
diff --git a/src/frameworks/opengles/eagl.rs b/src/frameworks/opengles/eagl.rs
index 32a0b5c..fc85a8e 100644
--- a/src/frameworks/opengles/eagl.rs
+++ b/src/frameworks/opengles/eagl.rs
@@ -67,6 +67,20 @@ pub(super) struct EAGLContextHostObject {
     fps_counter: Option<FpsCounter>,
     next_frame_due: Option<Instant>,
     pub mapped_buffers: HashMap<GLuint, (MutPtr<GLvoid>, *mut GLvoid)>,
+    /// PortBridge: second context, sharing objects with `gles_ctx`, used only
+    /// to draw frames on the window (see [present_renderbuffer]).
+    presenter: Option<Box<dyn GLESContext>>,
+    presenter_failed: bool,
+    /// PortBridge: framebuffer and texture of `presenter`, kept between
+    /// frames (allocating a texture every frame is slow on some drivers).
+    presenter_fb: GLuint,
+    presenter_tex: GLuint,
+    presenter_tex_size: (GLsizei, GLsizei),
+    /// PortBridge: frames presented since `stat_since` and the time spent
+    /// presenting them (logged every 30 s).
+    stat_since: Option<Instant>,
+    stat_frames: u32,
+    stat_present: Duration,
 }
 impl HostObject for EAGLContextHostObject {}
 
@@ -83,6 +97,14 @@ pub const CLASSES: ClassExports = objc_classes! {
         fps_counter: None,
         next_frame_due: None,
         mapped_buffers: HashMap::new(),
+        presenter: None,
+        presenter_failed: false,
+        presenter_fb: 0,
+        presenter_tex: 0,
+        presenter_tex_size: (0, 0),
+        stat_since: None,
+        stat_frames: 0,
+        stat_present: Duration::ZERO,
     });
     env.objc.alloc_object(this, host_object, &mut env.mem)
 }
@@ -268,6 +290,26 @@ pub const CLASSES: ClassExports = objc_classes! {
     // delayed, so this needs to be checked before returning.
     let sleep_for = limit_framerate(&mut env.objc.borrow_mut::<EAGLContextHostObject>(this).next_frame_due, &env.options);
 
+    // PortBridge: the real frame rate goes to the log (and the APK report).
+    {
+        let host = env.objc.borrow_mut::<EAGLContextHostObject>(this);
+        let now = Instant::now();
+        let since = *host.stat_since.get_or_insert(now);
+        host.stat_frames += 1;
+        let secs = now.saturating_duration_since(since).as_secs_f64();
+        if secs >= 30.0 {
+            log!(
+                "PortBridge: {:.1} quadros/s (apresentação {:.2} ms por quadro)",
+                f64::from(host.stat_frames) / secs,
+                host.stat_present.as_secs_f64() * 1000.0 / f64::from(host.stat_frames),
+            );
+            host.stat_since = Some(now);
+            host.stat_frames = 0;
+            host.stat_present = Duration::ZERO;
+        }
+    }
+    crate::portbridge_haptics::on_frame(env);
+
     if env.options.print_fps {
         env
             .objc
@@ -542,11 +584,181 @@ unsafe fn read_renderbuffer(gles: &mut dyn GLES, mut pixel_buffer: Vec<u8>) -> (
     (pixel_buffer, width_u32, height_u32)
 }
 
+/// PortBridge: presents the renderbuffer bound to `GL_RENDERBUFFER_BINDING_OES`
+/// through a second context that shares objects with the app's context, so
+/// the app's OpenGL ES state is never touched.
+///
+/// The in-place path ([present_renderbuffer_in_place]) has to switch app state
+/// off and restore it afterwards from values read back from the driver. Some
+/// Android drivers report that state wrongly: Ninja Striker enables GL_BLEND
+/// once at startup, and on a Samsung phone blending was gone after the first
+/// frame, so the green color key showed behind every sprite.
+unsafe fn present_renderbuffer(env: &mut Environment) {
+    let ctx_id = env
+        .framework_state
+        .opengles
+        .current_ctx_for_thread(env.current_thread)
+        .unwrap();
+
+    let (has_presenter, failed) = {
+        let host = env.objc.borrow::<EAGLContextHostObject>(ctx_id);
+        (host.presenter.is_some(), host.presenter_failed)
+    };
+    if failed {
+        return present_renderbuffer_in_place(env);
+    }
+    if !has_presenter {
+        // The app's context must be current so the new one shares with it.
+        {
+            let host = env.objc.borrow_mut::<EAGLContextHostObject>(ctx_id);
+            let _ = host
+                .gles_ctx
+                .as_deref_mut()
+                .unwrap()
+                .make_current(env.window.as_mut().unwrap());
+        }
+        let presenter = env.on_parent_stack_in_coroutine(|window, options| {
+            window.set_share_with_current_context(true);
+            let ctx = crate::gles::try_create_gles1_ctx_no_parent_stack(window, options);
+            window.set_share_with_current_context(false);
+            ctx
+        });
+        let host = env.objc.borrow_mut::<EAGLContextHostObject>(ctx_id);
+        match presenter {
+            Some(presenter) => {
+                log!("PortBridge: frames are presented through a separate shared context.");
+                host.presenter = Some(presenter);
+            }
+            None => {
+                log!("PortBridge: could not create a shared context for presenting; using the in-place path.");
+                host.presenter_failed = true;
+                return present_renderbuffer_in_place(env);
+            }
+        }
+    }
+
+    let started = Instant::now();
+    let viewport = env.window.as_mut().unwrap().viewport();
+    let rotation_matrix = env.window.as_mut().unwrap().rotation_matrix();
+    let virtual_cursor_visible_at = env.window.as_mut().unwrap().virtual_cursor_visible_at();
+
+    // Read which renderbuffer to show (app context; nothing is changed there).
+    let (renderbuffer, width, height) = {
+        let host = env.objc.borrow_mut::<EAGLContextHostObject>(ctx_id);
+        let mut gles_boxed = host
+            .gles_ctx
+            .as_deref_mut()
+            .unwrap()
+            .make_current(env.window.as_mut().unwrap());
+        let gles = gles_boxed.as_mut();
+        let renderbuffer: GLuint = get_int(gles, gles11::RENDERBUFFER_BINDING_OES) as _;
+        let (width, height) = get_renderbuffer_size(gles);
+        // Make the app's drawing visible to the other context.
+        gles.Flush();
+        (renderbuffer, width, height)
+    };
+
+    let (mut framebuffer, mut texture, texture_size) = {
+        let host = env.objc.borrow::<EAGLContextHostObject>(ctx_id);
+        (
+            host.presenter_fb,
+            host.presenter_tex,
+            host.presenter_tex_size,
+        )
+    };
+    {
+        let host = env.objc.borrow_mut::<EAGLContextHostObject>(ctx_id);
+        let mut gles_boxed = host
+            .presenter
+            .as_deref_mut()
+            .unwrap()
+            .make_current(env.window.as_mut().unwrap());
+        let gles = gles_boxed.as_mut();
+
+        // Copy the renderbuffer (shared) into this context's texture. The
+        // framebuffer and the texture are reused from frame to frame.
+        if framebuffer == 0 {
+            gles.GenFramebuffersOES(1, &mut framebuffer);
+        }
+        gles.BindFramebufferOES(gles11::FRAMEBUFFER_OES, framebuffer);
+        gles.FramebufferRenderbufferOES(
+            gles11::FRAMEBUFFER_OES,
+            gles11::COLOR_ATTACHMENT0_OES,
+            gles11::RENDERBUFFER_OES,
+            renderbuffer,
+        );
+        if texture == 0 {
+            gles.GenTextures(1, &mut texture);
+        }
+        gles.BindTexture(gles11::TEXTURE_2D, texture);
+        if texture_size != (width, height) {
+            gles.TexImage2D(
+                gles11::TEXTURE_2D,
+                0,
+                gles11::RGB as _,
+                width,
+                height,
+                0,
+                gles11::RGB,
+                gles11::UNSIGNED_BYTE,
+                std::ptr::null(),
+            );
+            gles.TexParameteri(
+                gles11::TEXTURE_2D,
+                gles11::TEXTURE_MIN_FILTER,
+                gles11::LINEAR as _,
+            );
+            gles.TexParameteri(
+                gles11::TEXTURE_2D,
+                gles11::TEXTURE_MAG_FILTER,
+                gles11::LINEAR as _,
+            );
+        }
+        gles.CopyTexSubImage2D(gles11::TEXTURE_2D, 0, 0, 0, 0, 0, width, height);
+        // Back to the window's framebuffer.
+        gles.BindFramebufferOES(gles11::FRAMEBUFFER_OES, 0);
+
+        // This context is ours alone: just set the state the quad needs.
+        for &name in gles1_on_gl2::CAPABILITIES {
+            gles.Disable(name);
+        }
+        for info in gles1_on_gl2::ARRAYS {
+            gles.DisableClientState(info.name);
+        }
+        for mode in [gles11::MODELVIEW, gles11::PROJECTION, gles11::TEXTURE] {
+            gles.MatrixMode(mode);
+            gles.LoadIdentity();
+        }
+        gles.Color4f(1.0, 1.0, 1.0, 1.0);
+        gles.TexEnvi(
+            gles11::TEXTURE_ENV,
+            gles11::TEXTURE_ENV_MODE,
+            gles11::REPLACE as _,
+        );
+
+        present_frame(gles, viewport, rotation_matrix, virtual_cursor_visible_at);
+    }
+
+    env.window.as_ref().unwrap().swap_window();
+
+    // The app's context is current again, with its state as the app left it.
+    let host = env.objc.borrow_mut::<EAGLContextHostObject>(ctx_id);
+    host.presenter_fb = framebuffer;
+    host.presenter_tex = texture;
+    host.presenter_tex_size = (width, height);
+    let _ = host
+        .gles_ctx
+        .as_deref_mut()
+        .unwrap()
+        .make_current(env.window.as_mut().unwrap());
+    host.stat_present += started.elapsed();
+}
+
 /// Copies the pixels in a renderbuffer bound to `GL_RENDERBUFFER_BINDING_OES`
 /// (which should be provided by the app) to a texture and presents it with
 /// [present_frame], trying to avoid noticeably modifying OpenGL ES state while
 /// doing so. The front and back buffers are then swapped.
-unsafe fn present_renderbuffer(env: &mut Environment) {
+unsafe fn present_renderbuffer_in_place(env: &mut Environment) {
     // Save these for when we need to draw the frame
     let viewport = env.window.as_mut().unwrap().viewport();
     let rotation_matrix = env.window.as_mut().unwrap().rotation_matrix();
diff --git a/src/frameworks/opengles/gles_guest.rs b/src/frameworks/opengles/gles_guest.rs
index 9c86ac4..0cc7f8d 100644
--- a/src/frameworks/opengles/gles_guest.rs
+++ b/src/frameworks/opengles/gles_guest.rs
@@ -154,6 +154,7 @@ fn glGetError(env: &mut Environment) -> GLenum {
     })
 }
 fn glEnable(env: &mut Environment, cap: GLenum) {
+    crate::objc::trace_once((4u64 << 60) | cap as u64, || format!("glEnable {cap:#x}"));
     with_ctx_and_mem(env, |gles, _mem| {
         unsafe { gles.Enable(cap) };
     });
@@ -162,6 +163,7 @@ fn glIsEnabled(env: &mut Environment, cap: GLenum) -> GLboolean {
     with_ctx_and_mem(env, |gles, _mem| unsafe { gles.IsEnabled(cap) })
 }
 fn glDisable(env: &mut Environment, cap: GLenum) {
+    crate::objc::trace_once((5u64 << 60) | cap as u64, || format!("glDisable {cap:#x}"));
     with_ctx_and_mem(env, |gles, _mem| {
         unsafe { gles.Disable(cap) };
     });
@@ -304,6 +306,10 @@ fn glAlphaFuncx(env: &mut Environment, func: GLenum, ref_: GLclampx) {
     with_ctx_and_mem(env, |gles, _mem| unsafe { gles.AlphaFuncx(func, ref_) })
 }
 fn glBlendFunc(env: &mut Environment, sfactor: GLenum, dfactor: GLenum) {
+    crate::objc::trace_once(
+        (2u64 << 60) | ((sfactor as u64) << 32) | dfactor as u64,
+        || format!("glBlendFunc {sfactor:#x} {dfactor:#x}"),
+    );
     with_ctx_and_mem(env, |gles, _mem| unsafe {
         gles.BlendFunc(sfactor, dfactor)
     })
@@ -1061,6 +1067,23 @@ fn glTexImage2D(
             let size = image_size_estimate(pixel_count, format, type_);
             mem.ptr_at(pixels.cast::<u8>(), size).cast::<GLvoid>()
         };
+        // PortBridge diagnostics: texture formats and how many texels are
+        // transparent (for 5551 color-keyed sprites).
+        {
+            let key = (1u64 << 60)
+                | ((internalformat as u64 & 0xffff) << 32)
+                | ((format as u64) << 16)
+                | type_ as u64;
+            crate::objc::trace_once(key, || {
+                let mut transparent = 0usize;
+                if !pixels.is_null() && type_ == 0x8034 {
+                    let n = (width * height) as usize;
+                    let px = std::slice::from_raw_parts(pixels as *const u16, n);
+                    transparent = px.iter().filter(|v| **v & 1 == 0).count();
+                }
+                format!("glTexImage2D internal {internalformat:#x} {width}x{height} format {format:#x} type {type_:#x} (transparent texels in this one: {transparent})")
+            });
+        }
         gles.TexImage2D(
             target,
             level,
@@ -1167,6 +1190,10 @@ fn glTexEnvx(env: &mut Environment, target: GLenum, pname: GLenum, param: GLfixe
     })
 }
 fn glTexEnvi(env: &mut Environment, target: GLenum, pname: GLenum, param: GLint) {
+    crate::objc::trace_once(
+        (3u64 << 60) | ((pname as u64) << 32) | param as u32 as u64,
+        || format!("glTexEnvi {target:#x} {pname:#x} {param:#x}"),
+    );
     with_ctx_and_mem(env, |gles, _mem| unsafe {
         gles.TexEnvi(target, pname, param)
     })
diff --git a/src/frameworks/uikit/ui_screen.rs b/src/frameworks/uikit/ui_screen.rs
index 840d763..d11c51a 100644
--- a/src/frameworks/uikit/ui_screen.rs
+++ b/src/frameworks/uikit/ui_screen.rs
@@ -11,6 +11,8 @@ use crate::objc::{id, msg, msg_class, objc_classes, ClassExports, TrivialHostObj
 #[derive(Default)]
 pub struct State {
     main_screen: Option<id>,
+    /// PortBridge: the single UIScreenMode (current = preferred = only mode)
+    main_mode: Option<id>,
 }
 
 pub const CLASSES: ClassExports = objc_classes! {
@@ -74,6 +76,48 @@ pub const CLASSES: ClassExports = objc_classes! {
     1.0
 }
 
+// PortBridge: iOS 3.2+ screen modes. Apps use [[UIScreen mainScreen]
+// currentMode].size to find the resolution in pixels; nil gave them 0x0.
+- (id)currentMode {
+    if let Some(mode) = env.framework_state.uikit.ui_screen.main_mode {
+        mode
+    } else {
+        let class = env.objc.get_known_class("UIScreenMode", &mut env.mem);
+        let new = env.objc.alloc_static_object(
+            class,
+            Box::new(TrivialHostObject),
+            &mut env.mem
+        );
+        env.framework_state.uikit.ui_screen.main_mode = Some(new);
+        new
+    }
+}
+- (id)preferredMode {
+    msg![env; this currentMode]
+}
+- (id)availableModes {
+    let mode: id = msg![env; this currentMode];
+    msg_class![env; NSArray arrayWithObject:mode]
+}
+
+@end
+
+@implementation UIScreenMode: NSObject
+
+- (id)retain { this }
+- (())release {}
+- (id)autorelease { this }
+
+- (CGSize)size {
+    let screen: id = msg_class![env; UIScreen mainScreen];
+    let bounds: CGRect = msg![env; screen bounds];
+    let scale: CGFloat = msg![env; screen scale];
+    CGSize { width: bounds.size.width * scale, height: bounds.size.height * scale }
+}
+- (CGFloat)pixelAspectRatio {
+    1.0
+}
+
 @end
 
 };
diff --git a/src/frameworks/uikit/ui_view.rs b/src/frameworks/uikit/ui_view.rs
index b4dc3af..c4e3fa3 100644
--- a/src/frameworks/uikit/ui_view.rs
+++ b/src/frameworks/uikit/ui_view.rs
@@ -87,6 +87,9 @@ pub(super) struct UIViewHostObject {
     clears_context_before_drawing: bool,
     user_interaction_enabled: bool,
     multiple_touch_enabled: bool,
+    /// PortBridge: UIViewAutoresizing mask and autoresizesSubviews.
+    autoresizing_mask: NSUInteger,
+    autoresizes_subviews: bool,
 }
 impl HostObject for UIViewHostObject {}
 impl Default for UIViewHostObject {
@@ -102,10 +105,75 @@ impl Default for UIViewHostObject {
             clears_context_before_drawing: true,
             user_interaction_enabled: true,
             multiple_touch_enabled: false,
+            autoresizing_mask: 0,
+            autoresizes_subviews: true,
         }
     }
 }
 
+/// PortBridge: UIView autoresizing. When a view's size changes, each subview's
+/// flexible parts (left margin / width / right margin, and the vertical
+/// equivalents) share the difference in proportion to their current sizes.
+fn autoresize_subviews(env: &mut Environment, view: id, old: CGSize, new: CGSize) {
+    let (dw, dh) = (new.width - old.width, new.height - old.height);
+    if dw == 0.0 && dh == 0.0 {
+        return;
+    }
+    let host = env.objc.borrow::<UIViewHostObject>(view);
+    if !host.autoresizes_subviews {
+        return;
+    }
+    let subviews = host.subviews.clone();
+    fn share(delta: f32, parts: [(bool, f32); 3]) -> [f32; 3] {
+        let flexible: Vec<usize> = (0..3).filter(|&i| parts[i].0).collect();
+        let mut out = [0.0; 3];
+        if flexible.is_empty() {
+            return out;
+        }
+        let total: f32 = flexible.iter().map(|&i| parts[i].1.max(0.0)).sum();
+        for &i in &flexible {
+            out[i] = if total > 0.0 {
+                delta * parts[i].1.max(0.0) / total
+            } else {
+                delta / flexible.len() as f32
+            };
+        }
+        out
+    }
+    for sub in subviews {
+        let mask = env.objc.borrow::<UIViewHostObject>(sub).autoresizing_mask;
+        if mask == 0 {
+            continue;
+        }
+        let mut f: CGRect = msg![env; sub frame];
+        let right = old.width - f.origin.x - f.size.width;
+        let bottom = old.height - f.origin.y - f.size.height;
+        // UIViewAutoresizingFlexible{LeftMargin, Width, RightMargin} = 1, 2, 4
+        let h = share(
+            dw,
+            [
+                (mask & 1 != 0, f.origin.x),
+                (mask & 2 != 0, f.size.width),
+                (mask & 4 != 0, right),
+            ],
+        );
+        // UIViewAutoresizingFlexible{TopMargin, Height, BottomMargin} = 8, 16, 32
+        let v = share(
+            dh,
+            [
+                (mask & 8 != 0, f.origin.y),
+                (mask & 16 != 0, f.size.height),
+                (mask & 32 != 0, bottom),
+            ],
+        );
+        f.origin.x += h[0];
+        f.size.width += h[1];
+        f.origin.y += v[0];
+        f.size.height += v[1];
+        () = msg![env; sub setFrame:f];
+    }
+}
+
 #[derive(Default)]
 struct UIViewAnimationDelegateHostObject {
     animation_id: id, // NSString*
@@ -393,6 +461,19 @@ pub const CLASSES: ClassExports = objc_classes! {
     () = msg![env; this setTag:tag];
     () = msg![env; this setMultipleTouchEnabled:multi_touch_enabled];
 
+    // PortBridge: autoresizing, so views from nibs follow their window when it
+    // is resized to the screen (UIResizesToFullScreen).
+    let key_ns_string = get_static_str(env, "UIAutoresizingMask");
+    let mask: NSInteger = msg![env; coder decodeIntegerForKey:key_ns_string];
+    let key_ns_string = get_static_str(env, "UIAutoresizeSubviews");
+    let has_key: bool = msg![env; coder containsValueForKey:key_ns_string];
+    let autoresizes: bool = !has_key || msg![env; coder decodeBoolForKey:key_ns_string];
+    {
+        let host = env.objc.borrow_mut::<UIViewHostObject>(this);
+        host.autoresizing_mask = mask as NSUInteger;
+        host.autoresizes_subviews = autoresizes;
+    }
+
     for i in 0..subview_count {
         let subview: id = msg![env; subviews objectAtIndex:i];
         () = msg![env; this addSubview:subview];
@@ -625,6 +706,8 @@ pub const CLASSES: ClassExports = objc_classes! {
         clears_context_before_drawing: _,
         user_interaction_enabled: _,
         multiple_touch_enabled: _,
+        autoresizing_mask: _,
+        autoresizes_subviews: _,
     } = std::mem::take(env.objc.borrow_mut(this));
 
     release(env, layer);
@@ -724,7 +807,9 @@ pub const CLASSES: ClassExports = objc_classes! {
 }
 - (())setBounds:(CGRect)bounds {
     let layer = env.objc.borrow::<UIViewHostObject>(this).layer;
-    msg![env; layer setBounds:bounds]
+    let old: CGRect = msg![env; layer bounds];
+    () = msg![env; layer setBounds:bounds];
+    autoresize_subviews(env, this, old.size, bounds.size);
 }
 - (CGPoint)center {
     // FIXME: what happens if [layer anchorPoint] isn't (0.5, 0.5)?
@@ -741,7 +826,10 @@ pub const CLASSES: ClassExports = objc_classes! {
 }
 - (())setFrame:(CGRect)frame {
     let layer = env.objc.borrow::<UIViewHostObject>(this).layer;
-    msg![env; layer setFrame:frame]
+    let old: CGRect = msg![env; layer bounds];
+    () = msg![env; layer setFrame:frame];
+    let new: CGRect = msg![env; layer bounds];
+    autoresize_subviews(env, this, old.size, new.size);
 }
 - (CGAffineTransform)transform {
     let layer = env.objc.borrow::<UIViewHostObject>(this).layer;
@@ -893,10 +981,16 @@ pub const CLASSES: ClassExports = objc_classes! {
 }
 
 - (())setAutoresizingMask:(NSUInteger)mask {
-    todo_objc_setter!(this, mask);
+    env.objc.borrow_mut::<UIViewHostObject>(this).autoresizing_mask = mask;
+}
+- (NSUInteger)autoresizingMask {
+    env.objc.borrow::<UIViewHostObject>(this).autoresizing_mask
 }
 - (())setAutoresizesSubviews:(bool)enabled {
-    todo_objc_setter!(this, enabled);
+    env.objc.borrow_mut::<UIViewHostObject>(this).autoresizes_subviews = enabled;
+}
+- (bool)autoresizesSubviews {
+    env.objc.borrow::<UIViewHostObject>(this).autoresizes_subviews
 }
 
 - (CGSize)sizeThatFits:(CGSize)size {
diff --git a/src/frameworks/uikit/ui_view/ui_alert_view.rs b/src/frameworks/uikit/ui_view/ui_alert_view.rs
index 7dc2539..d894dc1 100644
--- a/src/frameworks/uikit/ui_view/ui_alert_view.rs
+++ b/src/frameworks/uikit/ui_view/ui_alert_view.rs
@@ -6,6 +6,7 @@
 //! `UIAlertView`.
 
 use crate::frameworks::foundation::ns_string;
+use crate::frameworks::foundation::NSInteger;
 use crate::objc::{id, msg_super, nil, objc_classes, ClassExports};
 use std::borrow::Cow;
 
@@ -34,6 +35,11 @@ pub const CLASSES: ClassExports = objc_classes! {
     log!("TODO: [(UIAlertView *){:?} addButtonWithTitle:{}]", this, ns_string::to_rust_string(env, title));
 }
 
+// PortBridge: alerts aren't displayed yet, so the index is only logged.
+- (())setCancelButtonIndex:(NSInteger)index {
+    log!("TODO: [(UIAlertView*){:?} setCancelButtonIndex:{}]", this, index);
+}
+
 - (())show {
     log!("TODO: [(UIAlertView*){:?} show]", this);
 }
diff --git a/src/frameworks/uikit/ui_view/ui_window.rs b/src/frameworks/uikit/ui_view/ui_window.rs
index 1998df4..93073fa 100644
--- a/src/frameworks/uikit/ui_view/ui_window.rs
+++ b/src/frameworks/uikit/ui_view/ui_window.rs
@@ -64,6 +64,16 @@ pub const CLASSES: ClassExports = objc_classes! {
 // NSCoding implementation
 - (id)initWithCoder:(id)coder {
     let this = msg_super![env; this initWithCoder:coder];
+    // PortBridge: "Full Screen at Launch" in Interface Builder. A window made
+    // for another screen size (e.g. 320x568 for the iPhone 5) is resized to the
+    // screen, and its subviews follow their autoresizing masks.
+    let key_ns_string = ns_string::get_static_str(env, "UIResizesToFullScreen");
+    let full_screen: bool = msg![env; coder decodeBoolForKey:key_ns_string];
+    if full_screen {
+        let screen: id = msg_class![env; UIScreen mainScreen];
+        let bounds: CGRect = msg![env; screen bounds];
+        () = msg![env; this setFrame:bounds];
+    }
     // Undocumented: windows seem to be hidden by default on iOS, unlike views.
     // Super call to bypass the overriden setter on this class, which would post
     // a notification.
diff --git a/src/frameworks/uikit/ui_view_controller.rs b/src/frameworks/uikit/ui_view_controller.rs
index d0a73bc..e7c803a 100644
--- a/src/frameworks/uikit/ui_view_controller.rs
+++ b/src/frameworks/uikit/ui_view_controller.rs
@@ -191,6 +191,19 @@ pub const CLASSES: ClassExports = objc_classes! {
     todo_objc_setter!(this, style);
 }
 
+// PortBridge: iOS 5 presentation API. Presenting isn't modelled (as with the
+// modal API above); completion blocks are run so the app's flow continues.
+- (())presentViewController:(id)controller
+                   animated:(bool)animated
+                 completion:(id)completion {
+    log!("TODO: [(UIViewController*){:?} presentViewController:{:?} animated:{}]", this, controller, animated);
+    crate::objc::call_block_void(env, completion);
+}
+- (())dismissViewControllerAnimated:(bool)animated completion:(id)completion {
+    log!("TODO: [(UIViewController*){:?} dismissViewControllerAnimated:{}]", this, animated);
+    crate::objc::call_block_void(env, completion);
+}
+
 - (())dismissModalViewControllerAnimated:(bool)animated {
     log!("TODO: [(UIViewController*){:?} dismissModalViewControllerAnimated:{}]", this, animated); // TODO
 }
diff --git a/src/gles.rs b/src/gles.rs
index b222877..c090760 100644
--- a/src/gles.rs
+++ b/src/gles.rs
@@ -136,6 +136,16 @@ pub fn create_gles1_ctx_no_parent_stack(
     window: &mut crate::window::Window,
     options: &crate::options::Options,
 ) -> Box<dyn GLESContext> {
+    try_create_gles1_ctx_no_parent_stack(window, options)
+        .expect("Couldn't create OpenGL ES 1.1 context!")
+}
+
+/// PortBridge: like [create_gles1_ctx_no_parent_stack], but returns [None]
+/// instead of panicking when no implementation works.
+pub fn try_create_gles1_ctx_no_parent_stack(
+    window: &mut crate::window::Window,
+    options: &crate::options::Options,
+) -> Option<Box<dyn GLESContext>> {
     assert!(window.on_main_stack());
     log!("Creating an OpenGL ES 1.1 context:");
     let list = if let Some(ref preference) = options.gles1_implementation {
@@ -157,5 +167,5 @@ pub fn create_gles1_ctx_no_parent_stack(
             }
         }
     }
-    gles1_ctx.expect("Couldn't create OpenGL ES 1.1 context!")
+    gles1_ctx
 }
diff --git a/src/gles/gles1_native.rs b/src/gles/gles1_native.rs
index 8b0fd9d..6edb618 100644
--- a/src/gles/gles1_native.rs
+++ b/src/gles/gles1_native.rs
@@ -21,6 +21,46 @@ use crate::window::{GLContext, GLVersion, Window};
 use std::ffi::CStr;
 use std::marker::PhantomData;
 
+/// PortBridge: expands 16-bit packed RGBA texels (5551 or 4444) to RGBA8888.
+/// Some Android GLES 1.1 drivers mishandle the 1-bit alpha of 5551 textures
+/// (color-keyed sprites showed their key color); RGBA8888 is universal.
+/// `pixels` holds `height` rows of `width` texels, each row padded to the
+/// current GL_UNPACK_ALIGNMENT.
+unsafe fn expand_packed_rgba(
+    type_: GLenum,
+    width: GLsizei,
+    height: GLsizei,
+    pixels: *const GLvoid,
+) -> Option<Vec<u8>> {
+    if type_ != gles11::UNSIGNED_SHORT_5_5_5_1 && type_ != gles11::UNSIGNED_SHORT_4_4_4_4 {
+        return None;
+    }
+    if pixels.is_null() || width <= 0 || height <= 0 {
+        return None;
+    }
+    let mut alignment: GLint = 4;
+    gles11::GetIntegerv(gles11::UNPACK_ALIGNMENT, &mut alignment);
+    let alignment = alignment.max(1) as usize;
+    let (w, h) = (width as usize, height as usize);
+    let stride = (w * 2).div_ceil(alignment) * alignment;
+    let src = std::slice::from_raw_parts(pixels as *const u8, stride * (h - 1) + w * 2);
+    let mut out = Vec::with_capacity(w * h * 4);
+    for y in 0..h {
+        for x in 0..w {
+            let i = y * stride + x * 2;
+            let v = u16::from_ne_bytes([src[i], src[i + 1]]);
+            if type_ == gles11::UNSIGNED_SHORT_5_5_5_1 {
+                let c5 = |s: u16| (((v >> s) & 31) as u32 * 255 / 31) as u8;
+                out.extend_from_slice(&[c5(11), c5(6), c5(1), if v & 1 != 0 { 255 } else { 0 }]);
+            } else {
+                let c4 = |s: u16| (((v >> s) & 15) as u8) * 17;
+                out.extend_from_slice(&[c4(12), c4(8), c4(4), c4(0)]);
+            }
+        }
+    }
+    Some(out)
+}
+
 pub struct GLES1NativeContext {
     gl_ctx: GLContext,
     is_loaded: bool,
@@ -50,8 +90,13 @@ impl GLESContext for GLES1NativeContext {
         unsafe {
             window.make_gl_context_current(&self.gl_ctx);
         }
-        gles11::load_with(|s| window.gl_get_proc_address(s));
-        self.is_loaded = true;
+        // PortBridge: EGL function pointers do not depend on the context, so
+        // they are loaded once per context instead of on every switch (frames
+        // are now presented through a second context, two switches a frame).
+        if !self.is_loaded {
+            gles11::load_with(|s| window.gl_get_proc_address(s));
+            self.is_loaded = true;
+        }
         Box::new(GLES1Native {
             _gl_lifetime: PhantomData,
         })
@@ -510,6 +555,32 @@ impl GLES for GLES1Native<'_> {
             // https://android-review.googlesource.com/c/platform/external/qemu/+/974666
             internalformat = gles11::BGRA_EXT as GLint
         }
+        if format == gles11::RGBA
+            && (type_ == gles11::UNSIGNED_SHORT_5_5_5_1 || type_ == gles11::UNSIGNED_SHORT_4_4_4_4)
+        {
+            let expanded = expand_packed_rgba(type_, width, height, pixels);
+            let old_alignment = {
+                let mut a: GLint = 4;
+                gles11::GetIntegerv(gles11::UNPACK_ALIGNMENT, &mut a);
+                a
+            };
+            gles11::PixelStorei(gles11::UNPACK_ALIGNMENT, 4);
+            gles11::TexImage2D(
+                target,
+                level,
+                gles11::RGBA as GLint,
+                width,
+                height,
+                border,
+                gles11::RGBA,
+                gles11::UNSIGNED_BYTE,
+                expanded
+                    .as_ref()
+                    .map_or(std::ptr::null(), |v| v.as_ptr() as *const GLvoid),
+            );
+            gles11::PixelStorei(gles11::UNPACK_ALIGNMENT, old_alignment);
+            return;
+        }
         gles11::TexImage2D(
             target,
             level,
@@ -534,6 +605,26 @@ impl GLES for GLES1Native<'_> {
         type_: GLenum,
         pixels: *const GLvoid,
     ) {
+        if format == gles11::RGBA {
+            if let Some(expanded) = expand_packed_rgba(type_, width, height, pixels) {
+                let mut old_alignment: GLint = 4;
+                gles11::GetIntegerv(gles11::UNPACK_ALIGNMENT, &mut old_alignment);
+                gles11::PixelStorei(gles11::UNPACK_ALIGNMENT, 4);
+                gles11::TexSubImage2D(
+                    target,
+                    level,
+                    xoffset,
+                    yoffset,
+                    width,
+                    height,
+                    gles11::RGBA,
+                    gles11::UNSIGNED_BYTE,
+                    expanded.as_ptr() as *const GLvoid,
+                );
+                gles11::PixelStorei(gles11::UNPACK_ALIGNMENT, old_alignment);
+                return;
+            }
+        }
         gles11::TexSubImage2D(
             target, level, xoffset, yoffset, width, height, format, type_, pixels,
         )
diff --git a/src/image.rs b/src/image.rs
index 3afe2c2..360a3d6 100644
--- a/src/image.rs
+++ b/src/image.rs
@@ -25,6 +25,9 @@ use touchHLE_stb_image_wrapper::*;
 pub struct Image {
     pixels: PixelStore,
     dimensions: (u32, u32),
+    /// PortBridge: whether the source file had an alpha channel (RGBA/gray+alpha
+    /// or a palette with transparency). Decoded pixels are always RGBA.
+    has_alpha: bool,
 }
 
 enum PixelStore {
@@ -40,7 +43,7 @@ impl Image {
 
         let mut x: c_int = 0;
         let mut y: c_int = 0;
-        let mut _channels_in_file: c_int = 0;
+        let mut channels_in_file: c_int = 0;
 
         // TODO: we're currently assuming this is sRGB, can we check somehow?
 
@@ -59,7 +62,7 @@ impl Image {
                 len,
                 &mut x,
                 &mut y,
-                &mut _channels_in_file,
+                &mut channels_in_file,
                 4,
             )
         };
@@ -88,6 +91,7 @@ impl Image {
         Ok(Image {
             pixels: PixelStore::StbImage(pixels),
             dimensions: (width, height),
+            has_alpha: channels_in_file == 2 || channels_in_file == 4,
         })
     }
 
@@ -98,6 +102,7 @@ impl Image {
         Image {
             pixels: PixelStore::Vec(pixels),
             dimensions,
+            has_alpha: true,
         }
     }
 
@@ -105,6 +110,11 @@ impl Image {
         self.dimensions
     }
 
+    /// PortBridge: see [Image::has_alpha].
+    pub fn has_alpha(&self) -> bool {
+        self.has_alpha
+    }
+
     /// Get image data as bytes (8 bits per channel sRGB RGBA with premultiplied
     /// alpha). Rows are in top-to-bottom order.
     pub fn pixels(&self) -> &[u8] {
diff --git a/src/lib.rs b/src/lib.rs
index fcfec3f..fca7b45 100644
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -48,6 +48,7 @@ mod mem;
 mod objc;
 mod options;
 mod paths;
+mod portbridge_haptics;
 mod stack;
 mod window;
 
@@ -87,8 +88,18 @@ pub extern "C" fn SDL_main(
         }
     }));
 
-    // Empty args: brings up app picker.
-    match main([String::new()].into_iter()) {
+    // PortBridge: the Java activity of a generated APK passes the path of the
+    // embedded app (plus options) as arguments. Without arguments we keep the
+    // original behaviour (empty args: brings up app picker).
+    let mut args = vec![String::new()];
+    for i in 1..(_argc.max(0) as usize) {
+        let arg = unsafe { *_argv.add(i) };
+        if !arg.is_null() {
+            let arg = unsafe { std::ffi::CStr::from_ptr(arg) };
+            args.push(arg.to_string_lossy().into_owned());
+        }
+    }
+    match main(args.into_iter()) {
         Ok(_) => echo!("touchHLE finished"),
         Err(e) => echo!("touchHLE errored: {e:?}"),
     }
@@ -339,6 +350,10 @@ pub fn main<T: Iterator<Item = String>>(mut args: T) -> Result<(), String> {
     }
 
     let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
+        objc::set_lenient(options.lenient);
+        if options.lenient {
+            objc::install_panic_hook_filter();
+        }
         Environment::new(bundle, fs, options.clone(), app_args.unwrap_or_default())
     }));
     let env = match res {
diff --git a/src/objc.rs b/src/objc.rs
index 065cd62..0d7dbb4 100644
--- a/src/objc.rs
+++ b/src/objc.rs
@@ -27,6 +27,7 @@ mod classes;
 mod messages;
 mod methods;
 mod objects;
+mod portbridge_compat;
 mod properties;
 mod selectors;
 mod synchronization;
@@ -40,16 +41,18 @@ pub use methods::{HostIMP, IMP};
 pub use objects::{
     id, impl_HostObject_with_superclass, nil, AnyHostObject, HostObject, TrivialHostObject,
 };
+pub use portbridge_compat::{
+    call_block_void, install_panic_hook_filter, is_lenient, run_guarded, set_lenient, trace_once,
+    warn_once, UNIMPLEMENTED_FUNCTION,
+};
 pub use properties::todo_objc_setter;
 pub use selectors::{selector, SEL};
 
-use crate::mem::ConstVoidPtr;
-use crate::Environment;
 use classes::{
     class_getInstanceSize, class_getMethodImplementation, class_getProperty, class_getSuperclass,
     class_replaceMethod, objc_getClass, ClassHostObject, FakeClass, UnimplementedClass,
 };
-pub(crate) use messages::objc_msgSend;
+pub(crate) use messages::{last_host_message, objc_msgSend};
 use messages::{objc_msgSendSuper2, objc_msgSend_stret, MsgSendSignature, MsgSendSuperSignature};
 use methods::method_list_t;
 use objects::{objc_object, object_getClass, HostObjectEntry};
@@ -106,9 +109,9 @@ impl ObjC {
 pub const DYLIB: HostDylib = HostDylib {
     path: "/usr/lib/libobjc.A.dylib",
     aliases: &["/usr/lib/libobjc.dylib"],
-    class_exports: &[],
-    constant_exports: &[CONSTANTS],
-    function_exports: &[FUNCTIONS],
+    class_exports: &[portbridge_compat::CLASSES],
+    constant_exports: &[CONSTANTS, portbridge_compat::CONSTANTS],
+    function_exports: &[FUNCTIONS, portbridge_compat::FUNCTIONS],
 };
 
 const CONSTANTS: ConstantExports = &[
@@ -119,21 +122,6 @@ const CONSTANTS: ConstantExports = &[
     ("__objc_empty_cache", HostConstant::NullPtr),
 ];
 
-/// Block support is iOS 4+, but it seems like Block Runtime Helpers
-/// could still be called on even if minimal iOS version is set to 3.x?
-///
-/// ref. <https://clang.llvm.org/docs/Block-ABI-Apple.html#runtime-helper-functions>
-fn _Block_object_dispose(_env: &mut Environment, object: ConstVoidPtr, flags: i32) {
-    // `BLOCK_FIELD_IS_BYREF` flag defines an on stack structure holding
-    // the __block variable. It is _probably_ safe to ignore.
-    // TODO: properly implement for block support
-    assert!(flags == 8); // BLOCK_FIELD_IS_BYREF
-    log!(
-        "Warning: Ignoring _Block_object_dispose({:?}, BLOCK_FIELD_IS_BYREF)",
-        object
-    );
-}
-
 const FUNCTIONS: FunctionExports = &[
     export_c_func!(class_getInstanceSize(_)),
     export_c_func!(class_getSuperclass(_)),
@@ -151,5 +139,4 @@ const FUNCTIONS: FunctionExports = &[
     export_c_func!(objc_sync_exit(_)),
     export_c_func!(object_getClass(_)),
     export_c_func!(sel_registerName(_)),
-    export_c_func!(_Block_object_dispose(_, _)),
 ];
diff --git a/src/objc/messages.rs b/src/objc/messages.rs
index 03a6f99..b503001 100644
--- a/src/objc/messages.rs
+++ b/src/objc/messages.rs
@@ -35,7 +35,11 @@ pub(super) struct ThreadInitializer {
 }
 
 fn maybe_initialize_class(env: &mut Environment, receiver: id) {
-    let class_host_object = env.objc.get_host_object(receiver).unwrap();
+    // PortBridge: objects whose memory isn't managed by touchHLE (e.g. block
+    // literals, whose isa is one of the block classes) have no host object.
+    let Some(class_host_object) = env.objc.get_host_object(receiver) else {
+        return;
+    };
     let Some(&super::ClassHostObject {
         superclass,
         is_metaclass,
@@ -211,6 +215,17 @@ fn objc_msgSend_inner(
                 ..
             } = class_host_object.as_any().downcast_ref().unwrap();
 
+            if super::is_lenient() {
+                super::warn_once(format!(
+                    "{}class \"{}\" does not respond to selector \"{}\"; returning nil/0",
+                    if is_metaclass { "meta" } else { "" },
+                    name,
+                    selector.as_str(&env.mem),
+                ));
+                env.cpu.regs_mut()[0..2].fill(0);
+                return;
+            }
+
             panic!(
                 "{} {:?} ({}class \"{}\", {:?}){} does not respond to selector \"{}\"!",
                 if is_metaclass { "Class" } else { "Object" },
@@ -247,6 +262,7 @@ fn objc_msgSend_inner(
                 log_dbg!("Found method on: {}", name);
                 match imp {
                     IMP::Host(host_imp) => {
+                        LAST_HOST_MESSAGE.with(|m| m.set(Some((class, selector))));
                         // TODO: do type checks when calling GuestIMPs too.
                         // That requires using Objective-C type strings,
                         // rather than Rust types, and should probably
@@ -289,6 +305,16 @@ Type mismatch when sending message {} to {:?}!
             is_metaclass,
         }) = host_object.as_any().downcast_ref()
         {
+            if super::is_lenient() {
+                super::warn_once(format!(
+                    "class \"{}\" is unimplemented; {} method \"{}\" behaves as a message to nil",
+                    name,
+                    if is_metaclass { "class" } else { "instance" },
+                    selector.as_str(&env.mem),
+                ));
+                env.cpu.regs_mut()[0..2].fill(0);
+                return;
+            }
             panic!(
                 "Class \"{}\" ({:?}) is unimplemented. Call to {} method \"{}\".",
                 name,
@@ -318,6 +344,16 @@ Type mismatch when sending message {} to {:?}!
     }
 }
 
+thread_local! {
+    /// PortBridge: last message dispatched to a host method (diagnostics).
+    static LAST_HOST_MESSAGE: std::cell::Cell<Option<(Class, SEL)>> = const { std::cell::Cell::new(None) };
+}
+
+/// PortBridge: class and selector of the last message handled by touchHLE.
+pub(crate) fn last_host_message() -> Option<(Class, SEL)> {
+    LAST_HOST_MESSAGE.with(|m| m.get())
+}
+
 /// Standard variant of `objc_msgSend`. See [objc_msgSend_inner].
 #[allow(non_snake_case)]
 pub(crate) fn objc_msgSend(env: &mut Environment, receiver: id, selector: SEL) {
diff --git a/src/objc/portbridge_compat.rs b/src/objc/portbridge_compat.rs
new file mode 100644
index 0000000..bfb8d2c
--- /dev/null
+++ b/src/objc/portbridge_compat.rs
@@ -0,0 +1,774 @@
+/*
+ * This Source Code Form is subject to the terms of the Mozilla Public
+ * License, v. 2.0. If a copy of the MPL was not distributed with this
+ * file, You can obtain one at https://mozilla.org/MPL/2.0/.
+ */
+//! PortBridge compatibility layer (not part of upstream touchHLE).
+//!
+//! Runtime pieces that apps built with the iOS 5/6 SDKs import even when they
+//! target older devices: the ARC entry points, the Blocks runtime and block
+//! classes, stack protector symbols, a few compiler-rt helpers and part of the
+//! Objective-C runtime introspection API. It also hosts the "lenient" switch
+//! (`--lenient`), which turns calls to unimplemented functions, classes and
+//! methods into logged no-ops instead of aborting the app.
+//!
+//! References (public documentation only):
+//! - Block ABI: <https://clang.llvm.org/docs/Block-ABI-Apple.html>
+//! - ARC runtime functions: <https://clang.llvm.org/docs/AutomaticReferenceCounting.html#runtime-support>
+//! - Objective-C runtime reference (class_addMethod, class_getInstanceMethod,
+//!   class_getInstanceVariable, ivar_getName, ivar_getOffset, object_setIvar).
+
+use super::{
+    autorelease, id, msg, msg_class, nil, objc_classes, release, retain, Class, ClassExports,
+    ClassHostObject, IMP, SEL,
+};
+use crate::abi::{CallFromHost, GuestFunction};
+use crate::dyld::{export_c_func, ConstantExports, FunctionExports, HostConstant};
+use crate::frameworks::foundation::NSUInteger;
+use crate::libc::string::strdup;
+use crate::mem::{ConstPtr, ConstVoidPtr, GuestUSize, MutPtr, MutVoidPtr, Ptr};
+use crate::Environment;
+use std::collections::{HashMap, HashSet};
+use std::sync::atomic::{AtomicBool, Ordering};
+use std::sync::{LazyLock, Mutex};
+
+// ------------------------------------------------------------------ lenient
+
+static LENIENT: AtomicBool = AtomicBool::new(false);
+static WARNED: LazyLock<Mutex<HashSet<String>>> = LazyLock::new(Default::default);
+
+pub fn set_lenient(value: bool) {
+    LENIENT.store(value, Ordering::Relaxed);
+}
+
+pub fn is_lenient() -> bool {
+    LENIENT.load(Ordering::Relaxed)
+}
+
+/// Logs a lenient-mode warning once per distinct message.
+pub fn warn_once(message: String) {
+    if WARNED.lock().unwrap().insert(message.clone()) {
+        log!("Warning (lenient): {}", message);
+    }
+}
+
+thread_local! {
+    static GUARD_DEPTH: std::cell::Cell<u32> = const { std::cell::Cell::new(0) };
+}
+
+/// Lenient mode: runs a host function, turning a panic inside it (e.g. an
+/// `unimplemented!()` for some rarely used parameter) into `Err(())`. The
+/// caller restores the guest CPU state and returns 0 to the app.
+pub fn run_guarded<F: FnOnce()>(f: F) -> Result<(), ()> {
+    GUARD_DEPTH.with(|d| d.set(d.get() + 1));
+    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(f));
+    GUARD_DEPTH.with(|d| d.set(d.get() - 1));
+    result.map_err(|_| ())
+}
+
+/// Lenient mode: panics that [run_guarded] will catch are logged as recovered
+/// errors instead of going through the normal (fatal) panic hook.
+pub fn install_panic_hook_filter() {
+    let previous = std::panic::take_hook();
+    std::panic::set_hook(Box::new(move |info| {
+        if GUARD_DEPTH.with(|d| d.get()) == 0 {
+            previous(info);
+            return;
+        }
+        let payload = if let Some(s) = info.payload().downcast_ref::<&str>() {
+            s.to_string()
+        } else if let Some(s) = info.payload().downcast_ref::<String>() {
+            s.clone()
+        } else {
+            "(non-string payload)".to_string()
+        };
+        let location = info.location().map(|l| l.to_string()).unwrap_or_default();
+        log!(
+            "PortBridge (lenient): recovered from an error at {}: {} (the call returns 0)",
+            location,
+            payload
+        );
+    }));
+}
+
+static TRACED: LazyLock<Mutex<HashSet<u64>>> = LazyLock::new(Default::default);
+
+/// PortBridge diagnostics: in lenient mode (generated APKs), logs `text()` the
+/// first time `key` is seen. Cheap enough for per-draw GL state calls, and the
+/// result ends up in the report the APK shares.
+pub fn trace_once(key: u64, text: impl FnOnce() -> String) {
+    if !is_lenient() {
+        return;
+    }
+    if TRACED.lock().unwrap().insert(key) {
+        log!("PortBridge trace: {}", text());
+    }
+}
+
+/// Host function linked in place of a missing C function in lenient mode.
+fn _portbridge_unimplemented_function(_env: &mut Environment) -> u32 {
+    0
+}
+
+pub const UNIMPLEMENTED_FUNCTION: FunctionExports =
+    &[export_c_func!(_portbridge_unimplemented_function())];
+
+// -------------------------------------------------------- compiler support
+
+fn __divmodsi4(env: &mut Environment, a: i32, b: i32, rem: MutPtr<i32>) -> i32 {
+    if b == 0 {
+        if !rem.is_null() {
+            env.mem.write(rem, 0);
+        }
+        return 0;
+    }
+    let q = a.wrapping_div(b);
+    if !rem.is_null() {
+        env.mem.write(rem, a.wrapping_sub(q.wrapping_mul(b)));
+    }
+    q
+}
+
+fn __udivmodsi4(env: &mut Environment, a: u32, b: u32, rem: MutPtr<u32>) -> u32 {
+    if b == 0 {
+        if !rem.is_null() {
+            env.mem.write(rem, 0);
+        }
+        return 0;
+    }
+    if !rem.is_null() {
+        env.mem.write(rem, a % b);
+    }
+    a / b
+}
+
+fn __stack_chk_fail(_env: &mut Environment) {
+    panic!("__stack_chk_fail: stack buffer overflow detected in the app");
+}
+
+fn __assert_rtn(
+    env: &mut Environment,
+    func: ConstPtr<u8>,
+    file: ConstPtr<u8>,
+    line: i32,
+    expr: ConstPtr<u8>,
+) {
+    let s = |p: ConstPtr<u8>| -> String {
+        if p.is_null() {
+            String::from("?")
+        } else {
+            String::from_utf8_lossy(env.mem.cstr_at(p)).into_owned()
+        }
+    };
+    panic!(
+        "Assertion failed in the app: ({}), function {}, file {}, line {}",
+        s(expr),
+        s(func),
+        s(file),
+        line
+    );
+}
+
+// --------------------------------------------------------------------- ARC
+
+fn objc_retain(env: &mut Environment, obj: id) -> id {
+    retain(env, obj)
+}
+fn objc_release(env: &mut Environment, obj: id) {
+    release(env, obj)
+}
+fn objc_autorelease(env: &mut Environment, obj: id) -> id {
+    autorelease(env, obj)
+}
+fn objc_retainAutorelease(env: &mut Environment, obj: id) -> id {
+    let obj = retain(env, obj);
+    autorelease(env, obj)
+}
+fn objc_retainAutoreleasedReturnValue(env: &mut Environment, obj: id) -> id {
+    retain(env, obj)
+}
+fn objc_autoreleaseReturnValue(env: &mut Environment, obj: id) -> id {
+    autorelease(env, obj)
+}
+fn objc_retainAutoreleaseReturnValue(env: &mut Environment, obj: id) -> id {
+    let obj = retain(env, obj);
+    autorelease(env, obj)
+}
+fn objc_storeStrong(env: &mut Environment, location: MutPtr<id>, obj: id) {
+    let old = env.mem.read(location);
+    let obj = retain(env, obj);
+    env.mem.write(location, obj);
+    release(env, old);
+}
+fn objc_retainBlock(env: &mut Environment, block: id) -> id {
+    _Block_copy(env, block.cast().cast_const()).cast()
+}
+fn objc_autoreleasePoolPush(env: &mut Environment) -> id {
+    msg_class![env; NSAutoreleasePool new]
+}
+fn objc_autoreleasePoolPop(env: &mut Environment, pool: id) {
+    if pool != nil {
+        let _: () = msg![env; pool drain];
+    }
+}
+// Weak references are kept as plain (non-zeroing) pointers.
+fn objc_storeWeak(env: &mut Environment, location: MutPtr<id>, obj: id) -> id {
+    env.mem.write(location, obj);
+    obj
+}
+fn objc_initWeak(env: &mut Environment, location: MutPtr<id>, obj: id) -> id {
+    env.mem.write(location, obj);
+    obj
+}
+fn objc_loadWeak(env: &mut Environment, location: MutPtr<id>) -> id {
+    env.mem.read(location)
+}
+fn objc_loadWeakRetained(env: &mut Environment, location: MutPtr<id>) -> id {
+    let obj = env.mem.read(location);
+    retain(env, obj)
+}
+fn objc_destroyWeak(env: &mut Environment, location: MutPtr<id>) {
+    env.mem.write(location, nil);
+}
+fn objc_copyWeak(env: &mut Environment, to: MutPtr<id>, from: MutPtr<id>) {
+    let obj = env.mem.read(from);
+    env.mem.write(to, obj);
+}
+fn objc_moveWeak(env: &mut Environment, to: MutPtr<id>, from: MutPtr<id>) {
+    let obj = env.mem.read(from);
+    env.mem.write(to, obj);
+    env.mem.write(from, nil);
+}
+
+fn objc_enumerationMutation(_env: &mut Environment, obj: id) {
+    // Apple's runtime raises an exception here. Keep going and leave a trace.
+    log!(
+        "Warning: collection {:?} was mutated while being enumerated",
+        obj
+    );
+}
+
+// ------------------------------------------------------------------ Blocks
+
+const BLOCK_REFCOUNT_MASK: u32 = 0xfffe;
+const BLOCK_NEEDS_FREE: u32 = 1 << 24;
+const BLOCK_HAS_COPY_DISPOSE: u32 = 1 << 25;
+const BLOCK_IS_GLOBAL: u32 = 1 << 28;
+
+const BLOCK_FIELD_IS_OBJECT: i32 = 3;
+const BLOCK_FIELD_IS_BLOCK: i32 = 7;
+const BLOCK_FIELD_IS_BYREF: i32 = 8;
+const BLOCK_BYREF_CALLER: i32 = 128;
+
+fn rd(env: &Environment, addr: u32) -> u32 {
+    env.mem.read(Ptr::<u32, false>::from_bits(addr))
+}
+fn wr(env: &mut Environment, addr: u32, value: u32) {
+    env.mem.write(Ptr::<u32, true>::from_bits(addr), value)
+}
+fn call_helper(env: &mut Environment, func: u32, a: u32, b: Option<u32>) {
+    if func == 0 {
+        return;
+    }
+    let f = GuestFunction::from_addr_with_thumb_bit(func);
+    let a: MutVoidPtr = Ptr::from_bits(a);
+    match b {
+        Some(b) => {
+            let b: MutVoidPtr = Ptr::from_bits(b);
+            let () = f.call_from_host(env, (a, b));
+        }
+        None => {
+            let () = f.call_from_host(env, (a,));
+        }
+    }
+}
+
+// Block literal layout (32-bit): isa, flags, reserved, invoke, descriptor.
+// Descriptor: reserved, size, [copy_helper, dispose_helper].
+pub(crate) fn _Block_copy(env: &mut Environment, block: ConstVoidPtr) -> MutVoidPtr {
+    let b = block.to_bits();
+    if b == 0 {
+        return Ptr::null();
+    }
+    let flags = rd(env, b + 4);
+    if flags & BLOCK_NEEDS_FREE != 0 {
+        // already on the heap: just add a reference
+        let rc = flags & BLOCK_REFCOUNT_MASK;
+        if rc != BLOCK_REFCOUNT_MASK {
+            wr(env, b + 4, flags + 2);
+        }
+        return block.cast_mut();
+    }
+    if flags & BLOCK_IS_GLOBAL != 0 {
+        return block.cast_mut();
+    }
+    let descriptor = rd(env, b + 16);
+    let size = rd(env, descriptor + 4).max(20);
+    let copy: MutVoidPtr = env.mem.alloc(size);
+    env.mem.memmove(copy, block, size);
+    let c = copy.to_bits();
+    let malloc_class = env.objc.get_known_class("__NSMallocBlock__", &mut env.mem);
+    wr(env, c, malloc_class.to_bits());
+    wr(
+        env,
+        c + 4,
+        (flags & !BLOCK_REFCOUNT_MASK) | BLOCK_NEEDS_FREE | 2,
+    );
+    if flags & BLOCK_HAS_COPY_DISPOSE != 0 {
+        let copy_helper = rd(env, descriptor + 8);
+        call_helper(env, copy_helper, c, Some(b));
+    }
+    copy
+}
+
+pub(crate) fn _Block_release(env: &mut Environment, block: ConstVoidPtr) {
+    let b = block.to_bits();
+    if b == 0 {
+        return;
+    }
+    let flags = rd(env, b + 4);
+    if flags & BLOCK_NEEDS_FREE == 0 {
+        return; // stack or global block
+    }
+    let rc = flags & BLOCK_REFCOUNT_MASK;
+    if rc == BLOCK_REFCOUNT_MASK {
+        return; // saturated: leak rather than free a live block
+    }
+    if rc > 2 {
+        wr(env, b + 4, flags - 2);
+        return;
+    }
+    if flags & BLOCK_HAS_COPY_DISPOSE != 0 {
+        let descriptor = rd(env, b + 16);
+        let dispose_helper = rd(env, descriptor + 12);
+        call_helper(env, dispose_helper, b, None);
+    }
+    env.mem.free(block.cast_mut());
+}
+
+// __block variable layout (32-bit): isa, forwarding, flags, size,
+// [byref_keep, byref_destroy], variable...
+fn byref_copy(env: &mut Environment, src: u32) -> u32 {
+    let forwarding = rd(env, src + 4);
+    let fwd_flags = rd(env, forwarding + 8);
+    if fwd_flags & BLOCK_NEEDS_FREE != 0 {
+        if fwd_flags & BLOCK_REFCOUNT_MASK != BLOCK_REFCOUNT_MASK {
+            wr(env, forwarding + 8, fwd_flags + 2);
+        }
+        return forwarding;
+    }
+    let flags = rd(env, src + 8);
+    let size = rd(env, src + 12).max(16);
+    let copy: MutVoidPtr = env.mem.alloc(size);
+    let c = copy.to_bits();
+    env.mem
+        .memmove(copy, Ptr::<u8, false>::from_bits(src).cast(), size);
+    // one reference for the heap copy held by the block, one for the stack
+    wr(
+        env,
+        c + 8,
+        (flags & !BLOCK_REFCOUNT_MASK) | BLOCK_NEEDS_FREE | 4,
+    );
+    wr(env, c + 4, c);
+    wr(env, src + 4, c);
+    if flags & BLOCK_HAS_COPY_DISPOSE != 0 {
+        let keep = rd(env, src + 16);
+        call_helper(env, keep, c, Some(src));
+    }
+    c
+}
+
+fn byref_release(env: &mut Environment, byref: u32) {
+    let byref = rd(env, byref + 4); // follow forwarding
+    let flags = rd(env, byref + 8);
+    if flags & BLOCK_NEEDS_FREE == 0 {
+        return;
+    }
+    let rc = flags & BLOCK_REFCOUNT_MASK;
+    if rc == BLOCK_REFCOUNT_MASK {
+        return;
+    }
+    if rc > 2 {
+        wr(env, byref + 8, flags - 2);
+        return;
+    }
+    if flags & BLOCK_HAS_COPY_DISPOSE != 0 {
+        let destroy = rd(env, byref + 20);
+        call_helper(env, destroy, byref, None);
+    }
+    env.mem.free(Ptr::from_bits(byref));
+}
+
+fn _Block_object_assign(
+    env: &mut Environment,
+    dest: MutPtr<u32>,
+    object: ConstVoidPtr,
+    flags: i32,
+) {
+    let obj = object.to_bits();
+    let value = if flags & BLOCK_FIELD_IS_BYREF == BLOCK_FIELD_IS_BYREF {
+        byref_copy(env, obj)
+    } else if flags & BLOCK_BYREF_CALLER != 0 {
+        obj // __block object/block variables are not retained (MRR semantics)
+    } else if flags & BLOCK_FIELD_IS_BLOCK == BLOCK_FIELD_IS_BLOCK {
+        _Block_copy(env, object).to_bits()
+    } else if flags & BLOCK_FIELD_IS_OBJECT == BLOCK_FIELD_IS_OBJECT {
+        retain(env, object.cast().cast_mut()).to_bits()
+    } else {
+        obj
+    };
+    env.mem.write(dest, value);
+}
+
+pub(crate) fn _Block_object_dispose(env: &mut Environment, object: ConstVoidPtr, flags: i32) {
+    let obj = object.to_bits();
+    if obj == 0 {
+        return;
+    }
+    if flags & BLOCK_FIELD_IS_BYREF == BLOCK_FIELD_IS_BYREF {
+        byref_release(env, obj);
+    } else if flags & BLOCK_BYREF_CALLER != 0 {
+        // not retained by _Block_object_assign
+    } else if flags & BLOCK_FIELD_IS_BLOCK == BLOCK_FIELD_IS_BLOCK {
+        _Block_release(env, object);
+    } else if flags & BLOCK_FIELD_IS_OBJECT == BLOCK_FIELD_IS_OBJECT {
+        release(env, object.cast().cast_mut());
+    }
+}
+
+/// Calls a block that takes no arguments besides itself (e.g. a completion
+/// handler `void (^)(void)`), if it isn't NULL.
+pub fn call_block_void(env: &mut Environment, block: id) {
+    if block == nil {
+        return;
+    }
+    let invoke = rd(env, block.to_bits() + 12);
+    call_helper(env, invoke, block.to_bits(), None);
+}
+
+fn block_retain_count(env: &Environment, this: id) -> NSUInteger {
+    let flags = rd(env, this.to_bits() + 4);
+    if flags & BLOCK_NEEDS_FREE != 0 {
+        (flags & BLOCK_REFCOUNT_MASK) >> 1
+    } else {
+        1
+    }
+}
+
+fn block_class_constant(env: &mut Environment, name: &str) -> ConstVoidPtr {
+    env.objc
+        .get_known_class(name, &mut env.mem)
+        .cast()
+        .cast_const()
+}
+
+pub const CLASSES: ClassExports = objc_classes! {
+
+(env, this, _cmd);
+
+// Blocks are Objective-C objects whose memory is managed by the Blocks
+// runtime, so these classes never touch NSObject's reference counting.
+@implementation NSBlock: NSObject
+
+- (id)copy {
+    _Block_copy(env, this.cast().cast_const()).cast()
+}
+- (id)copyWithZone:(MutVoidPtr)_zone {
+    _Block_copy(env, this.cast().cast_const()).cast()
+}
+- (id)retain {
+    _Block_copy(env, this.cast().cast_const()).cast()
+}
+- (())release {
+    _Block_release(env, this.cast().cast_const())
+}
+- (id)autorelease {
+    let flags = rd(env, this.to_bits() + 4);
+    if flags & BLOCK_NEEDS_FREE != 0 {
+        let _: () = msg_class![env; NSAutoreleasePool addObject:this];
+    }
+    this
+}
+- (NSUInteger)retainCount {
+    block_retain_count(env, this)
+}
+- (())dealloc {
+    // memory is freed by _Block_release
+}
+- (())invoke {
+    call_block_void(env, this)
+}
+
+@end
+
+@implementation __NSStackBlock__: NSBlock
+- (id)retain {
+    this // retaining a stack block does nothing, like Apple's runtime
+}
+- (())release {}
+@end
+
+@implementation __NSMallocBlock__: NSBlock
+@end
+
+@implementation __NSGlobalBlock__: NSBlock
+- (id)copy {
+    this
+}
+- (id)retain {
+    this
+}
+- (())release {}
+- (id)autorelease {
+    this
+}
+@end
+
+};
+
+// ---------------------------------------------- runtime introspection API
+
+/// Guest-visible `Method` / `Ivar` handles, created on demand and cached.
+static METHOD_HANDLES: LazyLock<Mutex<HashMap<(u32, u32), u32>>> = LazyLock::new(Default::default);
+static IVAR_HANDLES: LazyLock<Mutex<HashMap<(u32, String), u32>>> = LazyLock::new(Default::default);
+
+fn class_info(env: &Environment, class: Class) -> Option<&ClassHostObject> {
+    env.objc
+        .get_host_object(class)?
+        .as_any()
+        .downcast_ref::<ClassHostObject>()
+}
+
+fn class_addMethod(
+    env: &mut Environment,
+    cls: Class,
+    name: SEL,
+    imp: GuestFunction,
+    types: ConstPtr<u8>,
+) -> bool {
+    if cls == nil || name.is_null() {
+        return false;
+    }
+    if class_info(env, cls).is_none_or(|c| c.methods.contains_key(&name)) {
+        return false;
+    }
+    let types_copy = if types.is_null() {
+        types
+    } else {
+        strdup(env, types).cast_const()
+    };
+    let class = env.objc.borrow_mut::<ClassHostObject>(cls);
+    class.methods.insert(name, IMP::Guest(imp));
+    class.guest_method_signatures.insert(name, types_copy);
+    true
+}
+
+/// Returns a `Method` (pointer to a `{SEL name; char *types; IMP imp}` struct)
+/// or NULL. The IMP is NULL for methods implemented by touchHLE itself.
+fn class_getInstanceMethod(env: &mut Environment, cls: Class, name: SEL) -> MutVoidPtr {
+    let mut class = cls;
+    while class != nil {
+        let Some(info) = class_info(env, class) else {
+            return Ptr::null();
+        };
+        if let Some(imp) = info.methods.get(&name) {
+            let imp = match imp {
+                IMP::Guest(g) => g.addr_with_thumb_bit(),
+                IMP::Host(_) => 0,
+            };
+            let types = info
+                .guest_method_signatures
+                .get(&name)
+                .map_or(0, |t| t.to_bits());
+            let key = (class.to_bits(), name.to_ptr().to_bits());
+            if let Some(&h) = METHOD_HANDLES.lock().unwrap().get(&key) {
+                return Ptr::from_bits(h);
+            }
+            let h = env.mem.alloc(12).to_bits();
+            wr(env, h, name.to_ptr().to_bits());
+            wr(env, h + 4, types);
+            wr(env, h + 8, imp);
+            METHOD_HANDLES.lock().unwrap().insert(key, h);
+            return Ptr::from_bits(h);
+        }
+        class = info.superclass;
+    }
+    Ptr::null()
+}
+
+fn class_getClassMethod(env: &mut Environment, cls: Class, name: SEL) -> MutVoidPtr {
+    if cls == nil {
+        return Ptr::null();
+    }
+    let metaclass = super::ObjC::read_isa(cls, &env.mem);
+    class_getInstanceMethod(env, metaclass, name)
+}
+
+fn method_getImplementation(env: &mut Environment, method: MutVoidPtr) -> u32 {
+    if method.is_null() {
+        0
+    } else {
+        rd(env, method.to_bits() + 8)
+    }
+}
+
+fn method_getName(env: &mut Environment, method: MutVoidPtr) -> u32 {
+    if method.is_null() {
+        0
+    } else {
+        rd(env, method.to_bits())
+    }
+}
+
+/// Returns an `Ivar` (pointer to a `{char *name; GuestUSize *offset}` struct).
+fn class_getInstanceVariable(env: &mut Environment, cls: Class, name: ConstPtr<u8>) -> MutVoidPtr {
+    if cls == nil || name.is_null() {
+        return Ptr::null();
+    }
+    let wanted = String::from_utf8_lossy(env.mem.cstr_at(name)).into_owned();
+    let mut class = cls;
+    while class != nil {
+        let Some(info) = class_info(env, class) else {
+            return Ptr::null();
+        };
+        if let Some(&(offset_ptr, _align)) = info.ivars.get(&wanted) {
+            let key = (class.to_bits(), wanted.clone());
+            if let Some(&h) = IVAR_HANDLES.lock().unwrap().get(&key) {
+                return Ptr::from_bits(h);
+            }
+            let name_copy = env.mem.alloc_and_write_cstr(wanted.as_bytes());
+            let h = env.mem.alloc(8).to_bits();
+            wr(env, h, name_copy.to_bits());
+            wr(env, h + 4, offset_ptr.to_bits());
+            IVAR_HANDLES.lock().unwrap().insert(key, h);
+            return Ptr::from_bits(h);
+        }
+        class = info.superclass;
+    }
+    Ptr::null()
+}
+
+fn ivar_getName(env: &mut Environment, ivar: MutVoidPtr) -> u32 {
+    if ivar.is_null() {
+        0
+    } else {
+        rd(env, ivar.to_bits())
+    }
+}
+
+fn ivar_getOffset(env: &mut Environment, ivar: MutVoidPtr) -> GuestUSize {
+    if ivar.is_null() {
+        return 0;
+    }
+    let offset_ptr = rd(env, ivar.to_bits() + 4);
+    if offset_ptr == 0 {
+        0
+    } else {
+        rd(env, offset_ptr)
+    }
+}
+
+fn object_setIvar(env: &mut Environment, obj: id, ivar: MutVoidPtr, value: id) {
+    if obj == nil || ivar.is_null() {
+        return;
+    }
+    let offset = ivar_getOffset(env, ivar);
+    wr(env, obj.to_bits() + offset, value.to_bits());
+}
+
+fn object_getIvar(env: &mut Environment, obj: id, ivar: MutVoidPtr) -> id {
+    if obj == nil || ivar.is_null() {
+        return nil;
+    }
+    let offset = ivar_getOffset(env, ivar);
+    Ptr::from_bits(rd(env, obj.to_bits() + offset))
+}
+
+fn class_getIvarLayout(_env: &mut Environment, _cls: Class) -> ConstPtr<u8> {
+    Ptr::null() // no GC/ARC layout information: "scan conservatively"
+}
+
+/// `struct objc_method_description` is returned through a hidden pointer.
+fn protocol_getMethodDescription(
+    env: &mut Environment,
+    result: MutPtr<u32>,
+    _protocol: ConstVoidPtr,
+    _name: SEL,
+    _required: bool,
+    _instance: bool,
+) {
+    // Protocol metadata isn't tracked: report "not found" ({NULL, NULL}).
+    if !result.is_null() {
+        env.mem.write(result, 0);
+        env.mem.write(result + 1, 0);
+    }
+}
+
+pub const FUNCTIONS: FunctionExports = &[
+    export_c_func!(__divmodsi4(_, _, _)),
+    export_c_func!(__udivmodsi4(_, _, _)),
+    export_c_func!(__stack_chk_fail()),
+    export_c_func!(__assert_rtn(_, _, _, _)),
+    export_c_func!(objc_retain(_)),
+    export_c_func!(objc_release(_)),
+    export_c_func!(objc_autorelease(_)),
+    export_c_func!(objc_retainAutorelease(_)),
+    export_c_func!(objc_retainAutoreleasedReturnValue(_)),
+    export_c_func!(objc_autoreleaseReturnValue(_)),
+    export_c_func!(objc_retainAutoreleaseReturnValue(_)),
+    export_c_func!(objc_storeStrong(_, _)),
+    export_c_func!(objc_retainBlock(_)),
+    export_c_func!(objc_autoreleasePoolPush()),
+    export_c_func!(objc_autoreleasePoolPop(_)),
+    export_c_func!(objc_storeWeak(_, _)),
+    export_c_func!(objc_initWeak(_, _)),
+    export_c_func!(objc_loadWeak(_)),
+    export_c_func!(objc_loadWeakRetained(_)),
+    export_c_func!(objc_destroyWeak(_)),
+    export_c_func!(objc_copyWeak(_, _)),
+    export_c_func!(objc_moveWeak(_, _)),
+    export_c_func!(objc_enumerationMutation(_)),
+    export_c_func!(_Block_copy(_)),
+    export_c_func!(_Block_release(_)),
+    export_c_func!(_Block_object_assign(_, _, _)),
+    export_c_func!(_Block_object_dispose(_, _)),
+    export_c_func!(class_addMethod(_, _, _, _)),
+    export_c_func!(class_getInstanceMethod(_, _)),
+    export_c_func!(class_getClassMethod(_, _)),
+    export_c_func!(method_getImplementation(_)),
+    export_c_func!(method_getName(_)),
+    export_c_func!(class_getInstanceVariable(_, _)),
+    export_c_func!(class_getIvarLayout(_)),
+    export_c_func!(ivar_getName(_)),
+    export_c_func!(ivar_getOffset(_)),
+    export_c_func!(object_setIvar(_, _, _)),
+    export_c_func!(object_getIvar(_, _)),
+    export_c_func!(protocol_getMethodDescription(_, _, _, _, _)),
+];
+
+pub const CONSTANTS: ConstantExports = &[
+    // StoreKit (iOS 6): only used as a dictionary key for the App Store sheet.
+    (
+        "_SKStoreProductParameterITunesItemIdentifier",
+        HostConstant::NSString("id"),
+    ),
+    (
+        "___stack_chk_guard",
+        HostConstant::Custom(|env| -> ConstVoidPtr {
+            // Any stable value works; avoid zero bytes like a real canary.
+            env.mem.alloc_and_write(0x5A3C_9E17u32).cast().cast_const()
+        }),
+    ),
+    (
+        "__NSConcreteStackBlock",
+        HostConstant::Custom(|env| block_class_constant(env, "__NSStackBlock__")),
+    ),
+    (
+        "__NSConcreteMallocBlock",
+        HostConstant::Custom(|env| block_class_constant(env, "__NSMallocBlock__")),
+    ),
+    (
+        "__NSConcreteGlobalBlock",
+        HostConstant::Custom(|env| block_class_constant(env, "__NSGlobalBlock__")),
+    ),
+];
diff --git a/src/objc/selectors.rs b/src/objc/selectors.rs
index 204754a..3723381 100644
--- a/src/objc/selectors.rs
+++ b/src/objc/selectors.rs
@@ -67,6 +67,10 @@ impl SEL {
     pub fn is_null(self) -> bool {
         self.0.is_null()
     }
+    /// PortBridge: raw pointer (used as a cache key by portbridge_compat).
+    pub fn to_ptr(self) -> ConstPtr<u8> {
+        self.0
+    }
 }
 
 unsafe impl SafeRead for SEL {}
diff --git a/src/options.rs b/src/options.rs
index 7f13c7f..e9fc329 100644
--- a/src/options.rs
+++ b/src/options.rs
@@ -62,6 +62,8 @@ pub struct Options {
     pub dumping_file: PathBuf,
     pub ignore_gl_errors: bool,
     pub zero_stack_after_guest_to_host_call: Option<u32>,
+    /// PortBridge: log and continue instead of aborting on unimplemented APIs.
+    pub lenient: bool,
 }
 
 impl Default for Options {
@@ -95,6 +97,7 @@ impl Default for Options {
             dumping_file: crate::paths::user_data_base_path().join("DUMP.txt"),
             ignore_gl_errors: false,
             zero_stack_after_guest_to_host_call: None,
+            lenient: false,
         }
     }
 }
@@ -252,6 +255,8 @@ impl Options {
             self.dumping_file = crate::paths::user_data_base_path().join(path);
         } else if arg == "--ignore-gl-errors" {
             self.ignore_gl_errors = true;
+        } else if arg == "--lenient" {
+            self.lenient = true;
         } else if let Some(value) = arg.strip_prefix("--zero-stack-after-guest-to-host-call=") {
             self.zero_stack_after_guest_to_host_call = Some(value.parse().map_err(|_| {
                 "Invalid value for --zero-stack-after-guest-to-host-call=".to_string()
diff --git a/src/portbridge_haptics.rs b/src/portbridge_haptics.rs
new file mode 100644
index 0000000..fa24d07
--- /dev/null
+++ b/src/portbridge_haptics.rs
@@ -0,0 +1,155 @@
+/*
+ * This Source Code Form is subject to the terms of the Mozilla Public
+ * License, v. 2.0. If a copy of the MPL was not distributed with this
+ * file, You can obtain one at https://mozilla.org/MPL/2.0/.
+ */
+//! PortBridge: vibration on the host device.
+//!
+//! - `AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)` vibrates the phone.
+//! - Ninja Striker! has a "VIBRATION EFFECT" option (NONE/MILD/NORMAL/STRONG)
+//!   that only shakes the screen (the iPhone version never calls a vibration
+//!   API). On Android each screen shake also vibrates the phone, for as long
+//!   as the shake lasts and as strong as its amplitude, so the option does
+//!   what its name says. With NONE the game starts no shake, so no vibration.
+//!
+//! On Android this goes through SDL's haptic API, which exposes the system
+//! vibrator (the APK declares `android.permission.VIBRATE`). Elsewhere it does
+//! nothing.
+
+use crate::mem::{ConstPtr, Ptr};
+use crate::Environment;
+
+/// Vibrates for `ms` milliseconds; `strength` goes from 0 to 1.
+pub fn vibrate(strength: f32, ms: u32) {
+    #[cfg(target_os = "android")]
+    android::vibrate(strength, ms);
+    #[cfg(not(target_os = "android"))]
+    let _ = (strength, ms);
+}
+
+#[cfg(target_os = "android")]
+mod android {
+    use sdl2::sys;
+    use std::cell::Cell;
+    use std::ffi::CStr;
+
+    thread_local! {
+        // None: not tried yet; Some(null): no vibrator.
+        static HAPTIC: Cell<Option<*mut sys::SDL_Haptic>> = const { Cell::new(None) };
+    }
+
+    fn open() -> *mut sys::SDL_Haptic {
+        unsafe {
+            if sys::SDL_InitSubSystem(sys::SDL_INIT_HAPTIC) != 0 {
+                log!("PortBridge: no haptic subsystem, vibration disabled");
+                return std::ptr::null_mut();
+            }
+            let count = sys::SDL_NumHaptics();
+            // Prefer the phone's own vibrator over a game controller's.
+            let mut chosen = None;
+            for i in 0..count {
+                let name = sys::SDL_HapticName(i);
+                let name = if name.is_null() {
+                    String::new()
+                } else {
+                    CStr::from_ptr(name).to_string_lossy().into_owned()
+                };
+                if chosen.is_none() || name.contains("VIBRATOR") {
+                    chosen = Some((i, name));
+                }
+            }
+            let Some((index, name)) = chosen else {
+                log!("PortBridge: no vibrator found, vibration disabled");
+                return std::ptr::null_mut();
+            };
+            let haptic = sys::SDL_HapticOpen(index);
+            if haptic.is_null() || sys::SDL_HapticRumbleInit(haptic) != 0 {
+                log!("PortBridge: could not open vibrator {:?}", name);
+                return std::ptr::null_mut();
+            }
+            log!("PortBridge: vibration through {:?}", name);
+            haptic
+        }
+    }
+
+    pub fn vibrate(strength: f32, ms: u32) {
+        let haptic = HAPTIC.with(|h| {
+            if h.get().is_none() {
+                h.set(Some(open()));
+            }
+            h.get().unwrap()
+        });
+        if !haptic.is_null() && ms > 0 {
+            unsafe {
+                sys::SDL_HapticRumblePlay(haptic, strength.clamp(0.05, 1.0), ms);
+            }
+        }
+    }
+}
+
+/// Ninja Striker!'s screen-shake object (a static C++ object of version 1.05).
+const NINJA_BUNDLE_ID: &str = "Q-Cumber-Factory.NinjaStriker";
+const NINJA_SHAKE_OBJECT: u32 = 0x21a8d0;
+const NINJA_SHAKE_VTABLE: u32 = 0x1d4c88;
+
+#[derive(Default)]
+pub struct State {
+    /// None: not checked yet; Some(false): not the known game binary.
+    ninja_shake: Option<bool>,
+    last_shake_frames: i32,
+    logged: u32,
+}
+
+/// Called once per presented frame.
+pub fn on_frame(env: &mut Environment) {
+    let state = &mut env.framework_state.portbridge_haptics;
+    if state.ninja_shake == Some(false) {
+        return;
+    }
+    if state.ninja_shake.is_none() {
+        let known = env.bundle.bundle_identifier() == NINJA_BUNDLE_ID
+            && read_u32(env, NINJA_SHAKE_OBJECT) == Some(NINJA_SHAKE_VTABLE);
+        let state = &mut env.framework_state.portbridge_haptics;
+        state.ninja_shake = Some(known);
+        if !known {
+            return;
+        }
+        log!("PortBridge: Ninja Striker! screen shake also vibrates the phone");
+    }
+    // Shake object fields: +0x24 frames left; +0x0c/+0x10 and +0x1c/+0x20 the
+    // horizontal and vertical ranges (e.g. -10..10 for STRONG, -5..5 MILD).
+    let Some(frames) = read_u32(env, NINJA_SHAKE_OBJECT + 0x24).map(|v| v as i32) else {
+        return;
+    };
+    let last = std::mem::replace(
+        &mut env.framework_state.portbridge_haptics.last_shake_frames,
+        frames,
+    );
+    if frames > last && frames > 0 {
+        let amplitude = [0x0c, 0x10, 0x1c, 0x20]
+            .iter()
+            .filter_map(|&off| read_u32(env, NINJA_SHAKE_OBJECT + off))
+            .map(|v| (v as i32).unsigned_abs())
+            .max()
+            .unwrap_or(10)
+            .min(10);
+        let strength = 0.3 + 0.7 * (amplitude as f32 / 10.0);
+        let ms = (frames as u32).min(120) * 1000 / 60;
+        let state = &mut env.framework_state.portbridge_haptics;
+        if state.logged < 3 {
+            state.logged += 1;
+            log!("PortBridge: screen shake -> vibration {} ms, strength {:.2}", ms, strength);
+        }
+        vibrate(strength, ms);
+    }
+}
+
+fn read_u32(env: &Environment, addr: u32) -> Option<u32> {
+    // Only addresses inside the game binary's data are read (after the bundle
+    // identifier matched), which are always mapped.
+    if addr < 0x1000 {
+        return None;
+    }
+    let ptr: ConstPtr<u32> = Ptr::from_bits(addr);
+    Some(env.mem.read(ptr))
+}
diff --git a/src/version/lib.rs b/src/version/lib.rs
index ff5a09d..73fa275 100644
--- a/src/version/lib.rs
+++ b/src/version/lib.rs
@@ -13,6 +13,10 @@ pub const GITHUB_REF_NAME: Option<&str> = option_env!("GITHUB_REF_NAME");
 pub const GITHUB_EVENT_NAME: Option<&str> = option_env!("GITHUB_EVENT_NAME");
 
 pub fn branding() -> &'static str {
+    // PortBridge: builds with PortBridge's patch set are not official touchHLE.
+    if option_env!("PORTBRIDGE_BUILD").is_some() {
+        return "UNOFFICIAL";
+    }
     if GITHUB_RUN_ID.is_none() {
         return "";
     }
diff --git a/src/window.rs b/src/window.rs
index d4eae99..be120db 100644
--- a/src/window.rs
+++ b/src/window.rs
@@ -1266,6 +1266,17 @@ impl Window {
     /// Swap front-buffer and back-buffer so the result of OpenGL rendering is
     /// presented.
     pub fn swap_window(&self) {
+        // PortBridge: on Android, EGL's default swap interval (1) makes the
+        // swap wait for v-sync on top of touchHLE's own 60 fps limiter. The
+        // two clocks drift apart and frames miss their slot (judder, less than
+        // 60 fps). Let the limiter alone set the pace; Android composites the
+        // frames without tearing.
+        #[cfg(target_os = "android")]
+        {
+            let _ = self
+                .video_ctx
+                .gl_set_swap_interval(sdl2::video::SwapInterval::Immediate);
+        }
         self.window.gl_swap_window();
     }
```

