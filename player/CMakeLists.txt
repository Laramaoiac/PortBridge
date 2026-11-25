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
# Os fontes do miniz vindos direto do repositório (não o zip de release) incluem
# miniz_export.h, que normalmente é gerado pelo CMake do próprio miniz. Como aqui
# ele é compilado como biblioteca estática, basta um MINIZ_EXPORT vazio.
if(NOT EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/third_party/miniz/miniz_export.h")
    set(PB_MINIZ_GEN "${CMAKE_BINARY_DIR}/pb_miniz_gen")
    file(WRITE "${PB_MINIZ_GEN}/miniz_export.h"
        "#pragma once\n#ifndef MINIZ_EXPORT\n#define MINIZ_EXPORT\n#endif\n")
    target_include_directories(pb_miniz PUBLIC "${PB_MINIZ_GEN}")
endif()
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
        src/runtime/screen.cpp src/runtime/text.cpp src/runtime/i18n.cpp ${PB_FONT_SOURCES}
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
