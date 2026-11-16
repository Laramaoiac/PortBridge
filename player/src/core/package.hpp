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
