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
    PackageInfo info;
    std::vector<uint8_t> file = read_file(path);
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
