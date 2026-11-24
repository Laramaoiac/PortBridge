#pragma once

// Emulador StoreKit (extensão Clickteam iOSStore) para PortBridge (libmain.so).
// Adaptado 1:1 às estruturas reais do PortBridge (runtime.hpp, game.hpp, value.hpp):
//   - EvalContext& c -> c.f.loop (tick), c.f.app.game().extension_name(it.type)
//   - Ações:      idx = it.num - 80   (MMF2 iOSStore: 0=RequestPayment, 1=RequestInfo, 2=Restore)
//   - Condições:  idx = -it.num - 81  (suporta parâmetro opcional product_id em it.params[0])
//   - Expressões: idx = e.num - 80    (retorna Value(std::string), Value(double), Value(int64_t))

#if __has_include(<SDL_log.h>)
#include <SDL_log.h>
#define PB_STORE_LOG(...) SDL_Log(__VA_ARGS__)
#else
#include <cstdio>
#define PB_STORE_LOG(...) ((void)0)
#endif

#include <algorithm>
#include <cstdint>
#include <deque>
#include <map>
#include <set>
#include <string>
#include <utility>
#include <vector>

namespace pb {

namespace ios_store_ace {
#ifdef PB_IOS_STORE_FUSION25_ORDER
    constexpr int ACT_REQUEST_PRODUCT_INFO = 0;
    constexpr int ACT_REQUEST_PAYMENT      = 1;
#else
    constexpr int ACT_REQUEST_PAYMENT      = 0;
    constexpr int ACT_REQUEST_PRODUCT_INFO = 1;
#endif
    constexpr int ACT_RESTORE_TRANSACTIONS = 2;
    constexpr int ACT_REQUEST_PAYMENT_QTY  = 3;

    constexpr int CND_CAN_PAYMENTS_BE_MADE = 0;
    constexpr int CND_REQUEST_RESPONSE     = 1;
    constexpr int CND_PAYMENT_PROCESSED    = 2;
    constexpr int CND_PAYMENT_FAILED       = 3;
    constexpr int CND_PAYMENT_CANCELLED    = 4;
    constexpr int CND_PAYMENT_RESTORED     = 5;
    constexpr int CND_INVALID_IDENTIFIER   = 6;
    constexpr int CND_RESTORE_FINISHED     = 7;
    constexpr int CND_RESTORE_FAILED       = 8;

    constexpr int EXP_PRODUCT_NAME         = 0;
    constexpr int EXP_PRODUCT_DESCRIPTION  = 1;
    constexpr int EXP_PRODUCT_PRICE        = 2;
    constexpr int EXP_PRODUCT_PRICE_LOCALE = 3;
    constexpr int EXP_PRODUCT_IDENTIFIER   = 4;
    constexpr int EXP_PRODUCT_FORMATTED    = 5;
    constexpr int EXP_PRODUCT_QUANTITY     = 6;
    constexpr int EXP_RECEIPT_DATA         = 7;
    constexpr int EXP_ERROR_CODE           = 8;
    constexpr int EXP_ERROR_STRING         = 9;
}  // namespace ios_store_ace

class IosStoreEmulator {
public:
    void register_product(const std::string& product_id) {
        if (!product_id.empty()) known_ids_.insert(product_id);
    }

    void begin_step() {
        move_all(staged_info_, q_info_);
        move_all(staged_purchased_, q_purchased_);
        move_all(staged_restored_, q_restored_);
        if (staged_restore_finished_) {
            pending_restore_finished_ = true;
            staged_restore_finished_ = false;
        }
    }

    void on_request_info(const std::string& product_id) {
        const std::string id = product_id.empty() ? "default.product" : product_id;
        known_ids_.insert(id);
        current_id_ = id;
        staged_info_.push_back(id);
        PB_STORE_LOG("[PortBridge][iOSStore] RequestProductInfo('%s')", id.c_str());
    }

    void on_request_payment(const std::string& product_id, int qty = 1) {
        const std::string id = product_id.empty() ? current_id_ : product_id;
        if (id.empty()) return;
        known_ids_.insert(id);
        purchased_ids_.insert(id);
        current_id_ = id;
        current_qty_ = qty > 0 ? qty : 1;
        staged_info_.push_back(id);
        staged_purchased_.push_back(id);
        PB_STORE_LOG("[PortBridge][iOSStore] RequestPayment('%s', qty=%d) -> OK", id.c_str(), current_qty_);
    }

    void on_restore_transactions() {
        PB_STORE_LOG("[PortBridge][iOSStore] RestoreTransactions() -> %zu known", known_ids_.size());
        for (const auto& id : known_ids_) {
            purchased_ids_.insert(id);
            staged_restored_.push_back(id);
        }
        staged_restore_finished_ = true;
    }

    bool check_condition(int local_cnd, int64_t current_tick, const std::string& filter_id) {
        using namespace ios_store_ace;
        switch (local_cnd) {
            case CND_CAN_PAYMENTS_BE_MADE:
                return true;
            case CND_REQUEST_RESPONSE:
                return consume_queue_for_tick(q_info_, CND_REQUEST_RESPONSE, current_tick, filter_id);
            case CND_PAYMENT_PROCESSED:
                return consume_queue_for_tick(q_purchased_, CND_PAYMENT_PROCESSED, current_tick, filter_id);
            case CND_PAYMENT_RESTORED:
                return consume_queue_for_tick(q_restored_, CND_PAYMENT_RESTORED, current_tick, filter_id);
            case CND_RESTORE_FINISHED: {
                if (last_restore_finished_tick_ == current_tick) return true;
                if (pending_restore_finished_ && q_restored_.empty()) {
                    pending_restore_finished_ = false;
                    last_restore_finished_tick_ = current_tick;
                    return true;
                }
                return false;
            }
            case CND_PAYMENT_FAILED:
            case CND_PAYMENT_CANCELLED:
            case CND_INVALID_IDENTIFIER:
            case CND_RESTORE_FAILED:
            default:
                return false;
        }
    }

    const std::string& current_id() const { return current_id_; }
    int current_qty() const { return current_qty_; }
    const std::set<std::string>& purchased_ids() const { return purchased_ids_; }

    void reset() {
        staged_info_.clear();
        staged_purchased_.clear();
        staged_restored_.clear();
        q_info_.clear();
        q_purchased_.clear();
        q_restored_.clear();
        fired_this_tick_.clear();
        staged_restore_finished_ = false;
        pending_restore_finished_ = false;
        last_restore_finished_tick_ = -1;
        current_qty_ = 1;
    }

private:
    static void move_all(std::deque<std::string>& from, std::deque<std::string>& to) {
        while (!from.empty()) {
            to.push_back(std::move(from.front()));
            from.pop_front();
        }
    }

    bool consume_queue_for_tick(std::deque<std::string>& q, int cnd, int64_t tick,
                                const std::string& filter_id) {
        if (last_fired_tick_ != tick) {
            last_fired_tick_ = tick;
            fired_this_tick_.clear();
        }

        const auto key = std::make_pair(cnd, filter_id);
        auto active_it = fired_this_tick_.find(key);
        if (active_it != fired_this_tick_.end()) {
            current_id_ = active_it->second;
            return true;
        }

        if (q.empty()) return false;

        std::string matched;
        if (filter_id.empty()) {
            matched = q.front();
            q.pop_front();
        } else {
            auto it = std::find(q.begin(), q.end(), filter_id);
            if (it == q.end()) return false;
            matched = *it;
            q.erase(it);
        }

        current_id_ = matched;
        fired_this_tick_[key] = matched;
        return true;
    }

    std::deque<std::string> staged_info_;
    std::deque<std::string> staged_purchased_;
    std::deque<std::string> staged_restored_;

    std::deque<std::string> q_info_;
    std::deque<std::string> q_purchased_;
    std::deque<std::string> q_restored_;

    std::set<std::string> known_ids_;
    std::set<std::string> purchased_ids_;

    std::string current_id_;
    int current_qty_ = 1;

    bool staged_restore_finished_ = false;
    bool pending_restore_finished_ = false;
    int64_t last_restore_finished_tick_ = -1;

    int64_t last_fired_tick_ = -1;
    std::map<std::pair<int, std::string>, std::string> fired_this_tick_;
};

inline IosStoreEmulator& ios_store() {
    static IosStoreEmulator instance;
    return instance;
}

inline bool is_ios_store_ext(const std::string& name) {
    return name == "iOSStore" || name == "kcstore" || name == "Store" ||
           name == "iOS Store" || name == "InAppPurchase";
}

}  // namespace pb
