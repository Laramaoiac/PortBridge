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
