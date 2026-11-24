#pragma once

// PortBridge Layer 4 — Non-Destructive Runtime i18n Hook (C++17).
// Loads external UTF-8 translation dictionaries (PortBridgeI18nPack JSON)
// without modifying fixed-offset binary strings inside Application.cci.

#include <string>
#include <unordered_map>

namespace pb {

class RuntimeI18n {
public:
    void clear();

    // Loads a PortBridgeI18nPack JSON string (supports "byOriginal" map).
    bool load_json(const std::string& json_text);

    // Loads from a UTF-8 JSON file on disk (e.g. save_dir/i18n/pt_BR.json).
    bool load_file(const std::string& file_path);

    // Translates text dynamically; returns original unchanged if no entry matches.
    std::string translate(const std::string& original) const;

    float auto_shrink_min_scale() const { return auto_shrink_min_scale_; }
    size_t entry_count() const { return by_original_.size(); }
    bool active() const { return !by_original_.empty(); }

private:
    std::unordered_map<std::string, std::string> by_original_;
    float auto_shrink_min_scale_ = 0.78f;
};

RuntimeI18n& runtime_i18n();

}  // namespace pb
