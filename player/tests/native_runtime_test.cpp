#include <cassert>
#include <iostream>
#include <string>

#include "runtime/ext_ios_store.hpp"
#include "runtime/i18n.hpp"

int main() {
    // 1. Test iOSStore StoreKit emulator state machine
    auto& st = pb::ios_store();
    st.reset();
    st.register_product("com.gameatelier.zorbie.fullgame");
    st.register_product("com.gameatelier.zorbie.coins_pack1");

    assert(st.check_condition(pb::ios_store_ace::CND_CAN_PAYMENTS_BE_MADE, 1, "") == true);
    assert(st.check_condition(pb::ios_store_ace::CND_PAYMENT_PROCESSED, 1, "") == false);

    st.on_request_payment("com.gameatelier.zorbie.fullgame", 1);
    // Must NOT fire on same tick before begin_step()
    assert(st.check_condition(pb::ios_store_ace::CND_PAYMENT_PROCESSED, 1, "") == false);

    // Next tick: promote staged -> ready
    st.begin_step();
    assert(st.check_condition(pb::ios_store_ace::CND_PAYMENT_PROCESSED, 2, "com.gameatelier.zorbie.fullgame") == true);
    // Same tick idempotency
    assert(st.check_condition(pb::ios_store_ace::CND_PAYMENT_PROCESSED, 2, "com.gameatelier.zorbie.fullgame") == true);
    assert(st.current_id() == "com.gameatelier.zorbie.fullgame");
    // Tick 3: expired (one-shot)
    assert(st.check_condition(pb::ios_store_ace::CND_PAYMENT_PROCESSED, 3, "com.gameatelier.zorbie.fullgame") == false);

    // Restore transactions flow
    st.on_restore_transactions();
    st.begin_step();
    assert(st.check_condition(pb::ios_store_ace::CND_PAYMENT_RESTORED, 4, "com.gameatelier.zorbie.coins_pack1") == true);
    assert(st.check_condition(pb::ios_store_ace::CND_PAYMENT_RESTORED, 5, "com.gameatelier.zorbie.fullgame") == true);
    assert(st.check_condition(pb::ios_store_ace::CND_RESTORE_FINISHED, 6, "") == true);
    assert(st.check_condition(pb::ios_store_ace::CND_PAYMENT_FAILED, 6, "") == false);

    // 2. Test RuntimeI18n non-destructive UTF-8 PT-BR dictionary loader
    auto& i18n = pb::runtime_i18n();
    i18n.clear();
    const std::string pack_json = R"({
      "schema": "PortBridgeI18nPack",
      "schemaVersion": 1,
      "locale": "pt-BR",
      "autoShrinkMinScale": 0.80,
      "byOriginal": {
        "PLAY": "JOGAR",
        "OPTIONS": "OP\u00c7\u00d5ES",
        "Press Start to continue!": "Pressione Iniciar para continuar!"
      }
    })";
    assert(i18n.load_json(pack_json) == true);
    assert(i18n.entry_count() == 3);
    assert(i18n.translate("PLAY") == "JOGAR");
    assert(i18n.translate("OPTIONS") == "OP\xC3\x87\xC3\x95""ES");  // OPÇÕES in UTF-8
    assert(i18n.translate("UNMAPPED_TEXT") == "UNMAPPED_TEXT");
    assert(i18n.auto_shrink_min_scale() > 0.79f && i18n.auto_shrink_min_scale() < 0.81f);

    std::cout << "[OK] PortBridge native C++17 tests passed (iOSStore + RuntimeI18n UTF-8).\n";
    return 0;
}
