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
