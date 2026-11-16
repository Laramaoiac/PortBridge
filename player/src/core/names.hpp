// Nomes legíveis de condições, ações e expressões (para logs e ferramentas).
#pragma once
#include <string>

namespace pb {

enum class ItemKind { Condition, Action, Expression };

// "Active.SetX", "Special.CompareGlobalValue", "Extension#3" ...
std::string item_name(ItemKind kind, int obj_type, int num);
const char* object_type_name(int obj_type);

}  // namespace pb
