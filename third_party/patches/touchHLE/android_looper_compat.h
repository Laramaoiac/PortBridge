/*
 * PortBridge: compatibility shim for building touchHLE's bundled SDL2 with
 * NDK r28+. Those NDKs mark ALooper_pollAll() as removed (it "may ignore
 * wakes"); SDL2's Android sensor code still calls it. This header is
 * force-included (-include) into the C files compiled for Android and
 * redirects the call to ALooper_pollOnce(), which has the same signature.
 * SDL only polls its own sensor queue (registered with an ident > 0), so the
 * behaviour is the same for it.
 */
#ifndef PORTBRIDGE_ANDROID_LOOPER_COMPAT_H
#define PORTBRIDGE_ANDROID_LOOPER_COMPAT_H
#if defined(__ANDROID__)
#include <android/looper.h>
static inline int portbridge_ALooper_pollAll(int timeoutMillis, int *outFd, int *outEvents,
                                             void **outData) {
    return ALooper_pollOnce(timeoutMillis, outFd, outEvents, outData);
}
#define ALooper_pollAll portbridge_ALooper_pollAll
#endif
#endif
