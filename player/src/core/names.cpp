#include "names.hpp"

#include <map>
#include <utility>

namespace pb {
namespace {

using Key = std::pair<int, int>;
// Tipos: -7 Player, -6 Keyboard/Mouse, -5 Create, -4 Timer, -3 Game, -2 Sound, -1 Special,
// 0 operadores (expressões), 2 Active, 3 Text, 7 Counter. "Common" (tipo 2 = qualquer objeto)
// cobre os números < 80, que valem para todos os objetos.
const std::map<Key, const char*> kConditions = {
    {{-1, -1}, "Always"}, {{-1, -2}, "Never"}, {{-1, -3}, "Compare"}, {{-1, -4}, "Restrict"},
    {{-1, -5}, "Repeat"}, {{-1, -6}, "Once"}, {{-1, -7}, "NotAlways"},
    {{-1, -8}, "CompareGlobalValue"}, {{-1, -9}, "Remark"}, {{-1, -10}, "NewGroup"},
    {{-1, -11}, "GroupEnd"}, {{-1, -12}, "GroupActivated"}, {{-1, -16}, "OnLoop"},
    {{-1, -20}, "CompareGlobalString"}, {{-1, -24}, "OrFiltered"}, {{-1, -25}, "OrLogical"},
    {{-1, -26}, "Chance"},
    {{-2, -1}, "SampleNotPlaying"}, {{-2, -3}, "NoSamplePlaying"}, {{-2, -8}, "ChannelNotPlaying"},
    {{-3, -1}, "StartOfFrame"}, {{-3, -2}, "EndOfFrame"}, {{-3, -8}, "ApplicationResumed"},
    {{-4, -1}, "TimerGreater"}, {{-4, -2}, "TimerLess"}, {{-4, -3}, "TimerEquals"},
    {{-4, -4}, "Every"}, {{-4, -8}, "Every2"},
    {{-6, -1}, "KeyPressed"}, {{-6, -2}, "KeyDown"}, {{-6, -3}, "MouseInZone"},
    {{-6, -4}, "MouseOnObject"}, {{-6, -5}, "MouseClicked"}, {{-6, -6}, "MouseClickedInZone"},
    {{-6, -7}, "ObjectClicked"}, {{-6, -8}, "WhileMousePressed"},
    {{2, -1}, "AnimationFrame"}, {{2, -2}, "AnimationFinished"}, {{2, -3}, "AnimationPlaying"},
    {{2, -4}, "IsOverlapping"}, {{2, -7}, "MovementStopped"}, {{2, -8}, "FacingInDirection"},
    {{2, -14}, "OnCollision"}, {{2, -15}, "CompareSpeed"}, {{2, -16}, "CompareY"},
    {{2, -17}, "CompareX"}, {{2, -21}, "PathFinished"}, {{2, -22}, "NearBorders"},
    {{2, -23}, "OverlappingBackground"}, {{2, -24}, "FlagOff"}, {{2, -25}, "FlagOn"},
    {{2, -27}, "CompareAlterableValue"}, {{2, -28}, "ObjectInvisible"},
    {{2, -29}, "ObjectVisible"}, {{2, -30}, "ObjectsInZone"}, {{2, -31}, "NoObjectsInZone"},
    {{2, -32}, "NumberOfObjects"}, {{2, -33}, "AllDestroyed"}, {{2, -34}, "PickRandom"},
    {{7, -81}, "CompareCounter"},
};
const std::map<Key, const char*> kActions = {
    {{-1, 0}, "Skip"}, {{-1, 3}, "SetGlobalValue"}, {{-1, 4}, "SubtractGlobalValue"},
    {{-1, 5}, "AddGlobalValue"}, {{-1, 6}, "ActivateGroup"}, {{-1, 7}, "DeactivateGroup"},
    {{-1, 14}, "StartLoop"}, {{-1, 15}, "StopLoop"}, {{-1, 19}, "SetGlobalString"},
    {{-2, 0}, "PlaySample"}, {{-2, 1}, "StopAllSamples"}, {{-2, 6}, "StopSample"},
    {{-2, 11}, "PlayChannelSample"}, {{-2, 12}, "PlayLoopingChannelSample"},
    {{-2, 13}, "PauseChannel"}, {{-2, 14}, "ResumeChannel"}, {{-2, 15}, "StopChannel"},
    {{-2, 17}, "SetChannelVolume"}, {{-2, 32}, "SetChannelFrequency"},
    {{-3, 0}, "NextFrame"}, {{-3, 1}, "PreviousFrame"}, {{-3, 2}, "JumpToFrame"},
    {{-3, 4}, "EndApplication"}, {{-3, 7}, "CenterDisplay"}, {{-3, 8}, "CenterDisplayX"},
    {{-3, 9}, "CenterDisplayY"}, {{-3, 16}, "SetFrameRate"}, {{-3, 18}, "PauseApplication"},
    {{-3, 23}, "SetFrameBackgroundColor"}, {{-3, 27}, "SetFrameHeight"},
    {{-4, 0}, "SetTimer"}, {{-5, 0}, "CreateObject"},
    {{2, 1}, "SetPosition"}, {{2, 2}, "SetX"}, {{2, 3}, "SetY"}, {{2, 4}, "Stop"},
    {{2, 5}, "Start"}, {{2, 6}, "SetSpeed"}, {{2, 9}, "Bounce"}, {{2, 11}, "NextMovement"},
    {{2, 13}, "SelectMovement"}, {{2, 14}, "LookAt"}, {{2, 15}, "StopAnimation"},
    {{2, 16}, "StartAnimation"}, {{2, 17}, "ForceAnimation"}, {{2, 18}, "ForceDirection"},
    {{2, 19}, "ForceSpeed"}, {{2, 20}, "RestoreAnimation"}, {{2, 21}, "RestoreDirection"},
    {{2, 23}, "SetDirection"}, {{2, 24}, "Destroy"}, {{2, 26}, "Hide"}, {{2, 27}, "Show"},
    {{2, 28}, "FlashDuring"}, {{2, 29}, "Shoot"}, {{2, 30}, "ShootToward"},
    {{2, 31}, "SetAlterableValue"}, {{2, 32}, "AddToAlterable"},
    {{2, 33}, "SubtractFromAlterable"}, {{2, 34}, "SpreadValue"}, {{2, 40}, "ForceFrame"},
    {{2, 41}, "RestoreFrame"}, {{2, 43}, "SetDeceleration"}, {{2, 57}, "BringToFront"},
    {{2, 58}, "BringToBack"}, {{2, 59}, "MoveBehind"}, {{2, 60}, "MoveInFront"},
    {{2, 61}, "MoveToLayer"}, {{2, 65}, "SetAlphaCoefficient"}, {{2, 66}, "SetRGBCoefficient"},
    {{2, 85}, "SetScale"}, {{2, 86}, "SetXScale"}, {{2, 87}, "SetYScale"}, {{2, 88}, "SetAngle"},
    {{3, 88}, "SetString"},
    {{7, 80}, "SetCounterValue"}, {{7, 81}, "AddCounterValue"}, {{7, 82}, "SubtractCounterValue"},
    {{7, 83}, "SetMinimumValue"}, {{7, 84}, "SetMaximumValue"}, {{7, 85}, "SetCounterColor1"},
    {{7, 86}, "SetCounterColor2"},
};
const std::map<Key, const char*> kExpressions = {
    {{-1, -3}, "Comma"}, {{-1, -2}, "EndParenthesis"}, {{-1, -1}, "Parenthesis"},
    {{-1, 0}, "Long"}, {{-1, 1}, "Random"}, {{-1, 2}, "GlobalValueExpression"},
    {{-1, 3}, "String"}, {{-1, 4}, "ToString"}, {{-1, 5}, "ToNumber"}, {{-1, 10}, "Sin"},
    {{-1, 11}, "Cos"}, {{-1, 23}, "Double"}, {{-1, 24}, "GlobalValue"},
    {{-1, 50}, "GlobalString"},
    {{0, 2}, "Plus"}, {{0, 4}, "Minus"}, {{0, 6}, "Multiply"}, {{0, 8}, "Divide"},
    {{0, 10}, "Modulus"}, {{0, 12}, "Power"}, {{0, 14}, "And"}, {{0, 16}, "Or"}, {{0, 18}, "Xor"},
    {{-3, 3}, "XRightFrame"}, {{-3, 5}, "YBottomFrame"}, {{-3, 6}, "FrameWidth"},
    {{-3, 7}, "FrameHeight"}, {{-3, 10}, "FrameRate"},
    {{-5, 0}, "TotalObjectCount"}, {{-6, 0}, "XMouse"}, {{-6, 1}, "YMouse"},
    {{2, 1}, "YPosition"}, {{2, 2}, "AnimationFrame"}, {{2, 3}, "Speed"}, {{2, 6}, "GetDirection"},
    {{2, 7}, "ObjectLeft"}, {{2, 8}, "ObjectRight"}, {{2, 9}, "ObjectTop"},
    {{2, 10}, "ObjectBottom"}, {{2, 11}, "XPosition"}, {{2, 14}, "AnimationNumber"},
    {{2, 15}, "ObjectCount"}, {{2, 16}, "AlterableValue"}, {{2, 25}, "ActionX"},
    {{2, 26}, "ActionY"}, {{2, 27}, "AlphaCoefficient"}, {{2, 28}, "RGBCoefficient"},
    {{2, 81}, "GetXScale"}, {{2, 82}, "GetYScale"}, {{2, 83}, "GetAngle"},
    {{7, 80}, "CounterValue"}, {{7, 81}, "CounterMinimumValue"}, {{7, 82}, "CounterMaximumValue"},
};

const char* lookup(const std::map<Key, const char*>& m, int t, int n) {
    auto it = m.find({t, n});
    if (it != m.end()) return it->second;
    if (t >= 2) {  // comuns a todos os objetos
        bool common = n > -80 && n < 80;
        if (common) {
            it = m.find({2, n});
            if (it != m.end()) return it->second;
        }
    }
    return nullptr;
}

}  // namespace

const char* object_type_name(int t) {
    switch (t) {
        case -7: return "Player"; case -6: return "Keyboard/Mouse"; case -5: return "Create";
        case -4: return "Timer"; case -3: return "Game"; case -2: return "Sound";
        case -1: return "Special"; case 0: return "Operator"; case 1: return "Backdrop";
        case 2: return "Active"; case 3: return "Text"; case 4: return "Question";
        case 5: return "Score"; case 6: return "Lives"; case 7: return "Counter";
        case 8: return "RTF"; case 9: return "SubApplication";
        default: return t >= 32 ? "Extension" : "Unknown";
    }
}

std::string item_name(ItemKind kind, int t, int n) {
    const auto& m = kind == ItemKind::Condition ? kConditions
                    : kind == ItemKind::Action  ? kActions
                                                : kExpressions;
    std::string base = object_type_name(t);
    if (t >= 32) {
        int idx = kind == ItemKind::Condition ? -n - 81 : n - 80;
        if (idx >= 0) return base + "#" + std::to_string(idx);
    }
    if (const char* s = lookup(m, t, n)) return base + "." + s;
    return base + "(" + std::to_string(n) + ")";
}

}  // namespace pb
