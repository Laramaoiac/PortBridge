"""Eventos Clickteam (chunk 0x333D): a lógica do jogo.

Estrutura::

    'ER>>' cabeçalho (máx. objetos, nº de condições por tipo, qualificadores)
    'ERes' i32 (tamanho total dos eventos)
    'ERev' i32 tamanho + grupos de eventos
    'ERop' i32 tamanho + dados de extensões (opcional)
    '<<ER' fim

Grupo:     i16 -tamanho, u8 nCond, u8 nAct, u16 flags, 4 x i16
Condição:  u16 tam, i16 tipo_obj, i16 num, u16 oi, i16 oiList, u8 flags, u8 flags2,
           u8 nParams, u8 defType, u16 id     (+ parâmetros)
Ação:      igual à condição, sem o u16 id final
Parâmetro: u16 tam, i16 código, dados
Expressão: i16 tipo_obj, i16 num [u16 tam, dados]  — termina em (0, 0)

O inventário de (tipo_obj, num) usados é exatamente a lista do que um runtime
Android precisa implementar para rodar o jogo.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field

from .chunks import Reader

OBJECT_TYPES = {
    -7: "Player", -6: "Keyboard/Mouse", -5: "Create", -4: "Timer", -3: "Game",
    -2: "Sound", -1: "Special", 0: "QuickBackdrop", 1: "Backdrop", 2: "Active",
    3: "Text", 4: "Question", 5: "Score", 6: "Lives", 7: "Counter", 8: "RTF",
    9: "SubApplication",
}
# Códigos de parâmetro que carregam expressões.
EXPRESSION_PARAMS = {15, 22, 23, 27, 28, 45, 46, 52, 53, 54, 59, 62}
PARAM_GROUP = 38
CND_GROUP = -10      # condição especial que abre um grupo
CND_ENDGROUP = -11


class EventParseError(Exception):
    pass


@dataclass
class EventStats:
    max_objects: int = 0
    max_object_infos: int = 0
    players: int = 0
    conditions_per_type: list[int] = field(default_factory=list)
    qualifiers: list[tuple[int, int]] = field(default_factory=list)
    declared_size: int = 0
    event_groups: int = 0
    conditions: Counter = field(default_factory=Counter)
    actions: Counter = field(default_factory=Counter)
    expressions: Counter = field(default_factory=Counter)
    params: Counter = field(default_factory=Counter)
    group_titles: list[str] = field(default_factory=list)
    extension_data_size: int = 0

    def merge(self, other: "EventStats") -> None:
        self.event_groups += other.event_groups
        self.conditions.update(other.conditions)
        self.actions.update(other.actions)
        self.expressions.update(other.expressions)
        self.params.update(other.params)
        self.group_titles += other.group_titles


def parse(data: bytes, unicode: bool = False) -> EventStats:
    r = Reader(data, 0, unicode)
    st = EventStats()
    while True:
        if r.remaining() < 4:
            raise EventParseError("eventos terminaram sem '<<ER'")
        tag = r.bytes(4)
        if tag == b"ER>>":
            st.max_objects = r.i16()
            st.max_object_infos = r.i16()
            st.players = r.i16()
            st.conditions_per_type = [r.i16() for _ in range(17)]
            n = r.i16()
            st.qualifiers = [(r.u16(), r.i16()) for _ in range(n)]
        elif tag == b"ERes":
            st.declared_size = r.i32()
        elif tag == b"ERev":
            size = r.i32()
            end = r.p + size
            while r.p < end:
                _group(r, st)
            if r.p != end:
                raise EventParseError("bloco ERev desalinhado")
        elif tag == b"ERop":
            size = r.i32()
            st.extension_data_size += size
            r.p += size
        elif tag == b"<<ER":
            return st
        else:
            raise EventParseError(f"marcador de eventos desconhecido {tag!r} em {r.p - 4:#x}")


def _group(r: Reader, st: EventStats) -> None:
    start = r.p
    size = -r.i16()
    if size <= 0:
        raise EventParseError(f"grupo com tamanho inválido em {start:#x}")
    n_cond, n_act = r.u8(), r.u8()
    r.p += 2 + 8  # flags + 4 campos internos
    for _ in range(n_cond):
        _item(r, st, is_condition=True)
    for _ in range(n_act):
        _item(r, st, is_condition=False)
    if r.p != start + size:
        raise EventParseError(f"grupo em {start:#x} desalinhado ({r.p - start} != {size})")
    st.event_groups += 1


def _item(r: Reader, st: EventStats, is_condition: bool) -> None:
    start = r.p
    size = r.u16()
    obj_type, num = r.i16(), r.i16()
    r.p += 2 + 2 + 1 + 1   # oi, oiList, flags, flags2
    n_params = r.u8()
    r.p += 1               # defType
    if is_condition:
        r.p += 2           # identificador
        st.conditions[(obj_type, num)] += 1
    else:
        st.actions[(obj_type, num)] += 1
    for _ in range(n_params):
        _param(r, st)
    if r.p != start + size:
        raise EventParseError(f"item em {start:#x} desalinhado")


def _param(r: Reader, st: EventStats) -> None:
    start = r.p
    size = r.u16()
    code = r.i16()
    st.params[code] += 1
    end = start + size
    if code == PARAM_GROUP:
        r.p += 4  # flags, id
        st.group_titles.append(r.cstr())
    elif code in EXPRESSION_PARAMS:
        r.p += 2  # comparação
        while r.p < end:
            t_start = r.p
            obj_type, num = r.i16(), r.i16()
            if obj_type == 0 and num == 0:
                break
            t_size = r.u16()
            if t_size < 6:
                raise EventParseError(f"token de expressão inválido em {t_start:#x}")
            st.expressions[(obj_type, num)] += 1
            r.p = t_start + t_size
    r.p = end


def type_name(obj_type: int, extensions: dict[int, str] | None = None,
              expression: bool = False) -> str:
    if expression and obj_type == 0:
        return "Operator"      # em expressões, tipo 0 = operadores (+, -, *, /...)
    if obj_type in OBJECT_TYPES:
        return OBJECT_TYPES[obj_type]
    if obj_type >= 32 and extensions:
        return extensions.get(obj_type - 32, f"Extension#{obj_type - 32}")
    return f"Type{obj_type}"
