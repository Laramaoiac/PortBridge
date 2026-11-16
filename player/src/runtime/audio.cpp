#define DR_WAV_IMPLEMENTATION
#define DR_MP3_IMPLEMENTATION
#include "runtime/audio.hpp"

#include <algorithm>
#include <cstring>

#include "dr_mp3.h"
#include "dr_wav.h"

namespace pb {

Audio::Audio(const Game& game) : game_(game) {
    if (SDL_InitSubSystem(SDL_INIT_AUDIO) != 0) {
        SDL_Log("PortBridge: sem áudio (%s)", SDL_GetError());
        return;
    }
    SDL_AudioSpec want{}, have{};
    want.freq = 44100;
    want.format = AUDIO_S16SYS;
    want.channels = 2;
    want.samples = 1024;
    want.callback = &Audio::callback;
    want.userdata = this;
    dev_ = SDL_OpenAudioDevice(nullptr, 0, &want, &have, 0);
    if (!dev_) {
        SDL_Log("PortBridge: falha ao abrir áudio (%s)", SDL_GetError());
        return;
    }
    rate_ = have.freq;
    SDL_PauseAudioDevice(dev_, 0);
}

Audio::~Audio() {
    if (dev_) SDL_CloseAudioDevice(dev_);
}

std::shared_ptr<Audio::Clip> Audio::clip(int handle) {
    auto it = cache_.find(handle);
    if (it != cache_.end()) return it->second;
    auto si = game_.sounds.find(handle);
    if (si == game_.sounds.end()) return nullptr;
    const uint8_t* data = game_.buf.data() + si->second.offset;
    size_t size = si->second.size;
    auto c = std::make_shared<Clip>();
    unsigned channels = 0, rate = 0;
    if (size >= 12 && std::memcmp(data, "RIFF", 4) == 0) {
        drwav_uint64 frames = 0;
        drwav_int16* pcm = drwav_open_memory_and_read_pcm_frames_s16(data, size, &channels, &rate, &frames, nullptr);
        if (pcm) {
            c->pcm.resize(size_t(frames) * 2);
            for (drwav_uint64 i = 0; i < frames; ++i) {
                c->pcm[i * 2] = pcm[i * channels];
                c->pcm[i * 2 + 1] = pcm[i * channels + (channels > 1 ? 1 : 0)];
            }
            drwav_free(pcm, nullptr);
        }
    } else {
        drmp3_config cfg{};
        drmp3_uint64 frames = 0;
        drmp3_int16* pcm = drmp3_open_memory_and_read_pcm_frames_s16(data, size, &cfg, &frames, nullptr);
        if (pcm) {
            channels = cfg.channels;
            rate = cfg.sampleRate;
            c->pcm.resize(size_t(frames) * 2);
            for (drmp3_uint64 i = 0; i < frames; ++i) {
                c->pcm[i * 2] = pcm[i * channels];
                c->pcm[i * 2 + 1] = pcm[i * channels + (channels > 1 ? 1 : 0)];
            }
            drmp3_free(pcm, nullptr);
        }
    }
    c->rate = rate ? int(rate) : 44100;
    cache_[handle] = c;
    return c;
}

void Audio::play(int handle, int channel, int loops) {
    if (!dev_) return;
    auto c = clip(handle);
    if (!c || c->pcm.empty()) return;
    std::lock_guard<std::mutex> lk(m_);
    int idx = channel - 1;
    if (channel <= 0 || channel > kChannels) {
        idx = -1;
        for (int i = kChannels - 1; i >= 0; --i)  // canais altos para "qualquer"
            if (!ch_[i].active) { idx = i; break; }
        if (idx < 0) idx = kChannels - 1;
    }
    Chan& ch = ch_[idx];
    ch.clip = c;
    ch.handle = handle;
    ch.pos = 0;
    ch.loops_left = loops;
    ch.paused = false;
    ch.active = true;
}

void Audio::stop_channel(int c) {
    std::lock_guard<std::mutex> lk(m_);
    if (c >= 1 && c <= kChannels) { ch_[c - 1].active = false; ch_[c - 1].clip.reset(); }
}
void Audio::stop_sound(int h) {
    std::lock_guard<std::mutex> lk(m_);
    for (auto& ch : ch_)
        if (ch.handle == h) { ch.active = false; ch.clip.reset(); }
}
void Audio::stop_all() {
    std::lock_guard<std::mutex> lk(m_);
    for (auto& ch : ch_) { ch.active = false; ch.clip.reset(); }
}
void Audio::pause_channel(int c, bool p) {
    std::lock_guard<std::mutex> lk(m_);
    if (c >= 1 && c <= kChannels) ch_[c - 1].paused = p;
}
void Audio::pause_all(bool p) {
    std::lock_guard<std::mutex> lk(m_);
    for (auto& ch : ch_) ch.paused = p;
}
void Audio::set_channel_volume(int c, int v) {
    std::lock_guard<std::mutex> lk(m_);
    if (c >= 1 && c <= kChannels) ch_[c - 1].volume = std::clamp(v, 0, 100);
}
void Audio::set_channel_frequency(int c, int hz) {
    std::lock_guard<std::mutex> lk(m_);
    if (c >= 1 && c <= kChannels) ch_[c - 1].freq = std::max(0, hz);
}
bool Audio::sound_playing(int h) {
    std::lock_guard<std::mutex> lk(m_);
    for (auto& ch : ch_)
        if (ch.active && ch.handle == h) return true;
    return false;
}
bool Audio::channel_playing(int c) {
    std::lock_guard<std::mutex> lk(m_);
    return c >= 1 && c <= kChannels && ch_[c - 1].active;
}
bool Audio::channel_paused(int c) {
    std::lock_guard<std::mutex> lk(m_);
    return c >= 1 && c <= kChannels && ch_[c - 1].active && ch_[c - 1].paused;
}
bool Audio::any_playing() {
    std::lock_guard<std::mutex> lk(m_);
    for (auto& ch : ch_)
        if (ch.active) return true;
    return false;
}

void Audio::callback(void* self, Uint8* stream, int len) {
    static_cast<Audio*>(self)->mix(reinterpret_cast<int16_t*>(stream), len / 4);
}

void Audio::mix(int16_t* out, int frames) {
    std::vector<int32_t> acc(size_t(frames) * 2, 0);
    {
        std::lock_guard<std::mutex> lk(m_);
        for (auto& ch : ch_) {
            if (!ch.active || ch.paused || !ch.clip) continue;
            const auto& pcm = ch.clip->pcm;
            size_t n = pcm.size() / 2;
            double step = double(ch.freq > 0 ? ch.freq : ch.clip->rate) / rate_;
            int vol = ch.volume;
            for (int i = 0; i < frames; ++i) {
                size_t k = size_t(ch.pos);
                if (k >= n) {
                    if (ch.loops_left == 1) { ch.active = false; ch.clip.reset(); break; }
                    if (ch.loops_left > 1) --ch.loops_left;
                    ch.pos -= double(n);
                    k = size_t(ch.pos);
                    if (k >= n) { ch.pos = 0; k = 0; }
                }
                acc[size_t(i) * 2] += pcm[k * 2] * vol / 100;
                acc[size_t(i) * 2 + 1] += pcm[k * 2 + 1] * vol / 100;
                ch.pos += step;
            }
        }
    }
    for (size_t i = 0; i < acc.size(); ++i)
        out[i] = muted_ ? 0 : int16_t(std::clamp<int32_t>(acc[i], -32768, 32767));
}

}  // namespace pb
