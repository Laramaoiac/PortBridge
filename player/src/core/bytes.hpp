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
