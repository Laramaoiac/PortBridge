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
