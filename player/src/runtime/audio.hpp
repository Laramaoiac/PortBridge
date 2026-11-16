// Mixer de áudio com canais no estilo Clickteam (canais 1..N, volume, frequência, loop).
#pragma once
#include <SDL.h>

#include <memory>
#include <mutex>
#include <unordered_map>
#include <vector>

#include "core/game.hpp"

namespace pb {

class Audio {
public:
    explicit Audio(const Game& game);
    ~Audio();
    bool ok() const { return dev_ != 0; }

    // canal: 1..kChannels, ou -1 para "qualquer livre". loops: 0 = infinito.
    void play(int sound_handle, int channel, int loops);
    void stop_channel(int ch);
    void stop_sound(int sound_handle);
    void stop_all();
    void pause_channel(int ch, bool pause);
    void pause_all(bool pause);
    void set_channel_volume(int ch, int volume);
    void set_channel_frequency(int ch, int hz);
    bool sound_playing(int sound_handle);
    bool channel_playing(int ch);
    bool channel_paused(int ch);
    bool any_playing();
    void set_muted(bool m) { muted_ = m; }

    static constexpr int kChannels = 48;

private:
    struct Clip {
        std::vector<int16_t> pcm;  // estéreo intercalado
        int rate = 44100;
    };
    struct Chan {
        std::shared_ptr<Clip> clip;
        int handle = -1;
        double pos = 0;
        int loops_left = 1;  // 0 = infinito
        bool paused = false, active = false;
        int volume = 100, freq = 0;
    };
    std::shared_ptr<Clip> clip(int handle);
    static void callback(void* self, Uint8* stream, int len);
    void mix(int16_t* out, int frames);

    const Game& game_;
    SDL_AudioDeviceID dev_ = 0;
    int rate_ = 44100;
    std::mutex m_;
    Chan ch_[kChannels];
    std::unordered_map<int, std::shared_ptr<Clip>> cache_;
    bool muted_ = false;
};

}  // namespace pb
