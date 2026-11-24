#include "runtime/i18n.hpp"

#include <algorithm>
#include <cctype>
#include <cstdint>
#include <fstream>
#include <sstream>

namespace pb {
namespace {

void append_utf8(std::string& out, uint32_t cp) {
    if (cp <= 0x7F) {
        out.push_back(static_cast<char>(cp));
    } else if (cp <= 0x7FF) {
        out.push_back(static_cast<char>(0xC0 | ((cp >> 6) & 0x1F)));
        out.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
    } else if (cp <= 0xFFFF) {
        out.push_back(static_cast<char>(0xE0 | ((cp >> 12) & 0x0F)));
        out.push_back(static_cast<char>(0x80 | ((cp >> 6) & 0x3F)));
        out.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
    } else {
        out.push_back(static_cast<char>(0xF0 | ((cp >> 18) & 0x07)));
        out.push_back(static_cast<char>(0x80 | ((cp >> 12) & 0x3F)));
        out.push_back(static_cast<char>(0x80 | ((cp >> 6) & 0x3F)));
        out.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
    }
}

bool parse_json_string(const std::string& s, size_t& pos, std::string& out) {
    if (pos >= s.size() || s[pos] != '"') return false;
    ++pos;
    out.clear();
    while (pos < s.size()) {
        char ch = s[pos++];
        if (ch == '"') return true;
        if (ch == '\\' && pos < s.size()) {
            char esc = s[pos++];
            switch (esc) {
                case '"': out.push_back('"'); break;
                case '\\': out.push_back('\\'); break;
                case '/': out.push_back('/'); break;
                case 'n': out.push_back('\n'); break;
                case 'r': out.push_back('\r'); break;
                case 't': out.push_back('\t'); break;
                case 'u': {
                    if (pos + 4 <= s.size()) {
                        uint32_t cp = 0;
                        bool ok = true;
                        for (int k = 0; k < 4; ++k) {
                            char h = s[pos + k];
                            cp <<= 4;
                            if (h >= '0' && h <= '9') cp |= uint32_t(h - '0');
                            else if (h >= 'a' && h <= 'f') cp |= uint32_t(h - 'a' + 10);
                            else if (h >= 'A' && h <= 'F') cp |= uint32_t(h - 'A' + 10);
                            else ok = false;
                        }
                        if (ok) {
                            pos += 4;
                            append_utf8(out, cp);
                        }
                    }
                    break;
                }
                default:
                    out.push_back(esc);
                    break;
            }
        } else {
            out.push_back(ch);
        }
    }
    return false;
}

void skip_ws(const std::string& s, size_t& pos) {
    while (pos < s.size() && std::isspace(static_cast<unsigned char>(s[pos]))) ++pos;
}

}  // namespace

void RuntimeI18n::clear() {
    by_original_.clear();
    auto_shrink_min_scale_ = 0.78f;
}

bool RuntimeI18n::load_json(const std::string& json_text) {
    // Locate "byOriginal" object inside PortBridgeI18nPack (or accept flat string->string JSON object)
    size_t pos = json_text.find("\"byOriginal\"");
    if (pos != std::string::npos) {
        pos = json_text.find('{', pos);
    } else {
        pos = json_text.find('{');
    }
    if (pos == std::string::npos) return false;
    ++pos;

    size_t loaded = 0;
    while (pos < json_text.size()) {
        skip_ws(json_text, pos);
        if (pos >= json_text.size() || json_text[pos] == '}') break;
        if (json_text[pos] == ',') {
            ++pos;
            continue;
        }
        std::string key;
        if (!parse_json_string(json_text, pos, key)) break;
        skip_ws(json_text, pos);
        if (pos >= json_text.size() || json_text[pos] != ':') break;
        ++pos;
        skip_ws(json_text, pos);
        if (pos < json_text.size() && json_text[pos] == '"') {
            std::string val;
            if (!parse_json_string(json_text, pos, val)) break;
            if (!key.empty() && !val.empty()) {
                by_original_[key] = val;
                ++loaded;
            }
        } else {
            // Skip non-string value conservatively until comma or closing brace
            int depth = 0;
            while (pos < json_text.size()) {
                char c = json_text[pos];
                if (c == '{' || c == '[') ++depth;
                else if (c == '}' || c == ']') {
                    if (depth == 0) break;
                    --depth;
                } else if (c == ',' && depth == 0) {
                    break;
                }
                ++pos;
            }
        }
    }

    // Optional autoShrinkMinScale parsing
    size_t scale_pos = json_text.find("\"autoShrinkMinScale\"");
    if (scale_pos != std::string::npos) {
        size_t colon = json_text.find(':', scale_pos);
        if (colon != std::string::npos) {
            try {
                float parsed = std::stof(json_text.substr(colon + 1));
                auto_shrink_min_scale_ = std::clamp(parsed, 0.5f, 1.0f);
            } catch (...) {
            }
        }
    }

    return loaded > 0;
}

bool RuntimeI18n::load_file(const std::string& file_path) {
    std::ifstream f(file_path);
    if (!f) return false;
    std::ostringstream ss;
    ss << f.rdbuf();
    return load_json(ss.str());
}

std::string RuntimeI18n::translate(const std::string& original) const {
    if (by_original_.empty() || original.empty()) return original;
    auto it = by_original_.find(original);
    return it != by_original_.end() ? it->second : original;
}

RuntimeI18n& runtime_i18n() {
    static RuntimeI18n instance;
    return instance;
}

}  // namespace pb
