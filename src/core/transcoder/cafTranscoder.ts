/**
 * Apple Core Audio Format (.caf) Transcoder -> Standard RIFF WAV (16-bit PCM).
 * Supports both linear PCM ('lpcm', 8/16-bit BE/LE) AND Apple IMA4 ADPCM ('ima4'),
 * widely used in classic & modern iOS games (Cocos2d, SpriteKit, Clickteam, Unity).
 */

const IMA_INDEX_TABLE = [
  -1, -1, -1, -1, 2, 4, 6, 8,
  -1, -1, -1, -1, 2, 4, 6, 8,
];

const IMA_STEP_TABLE = [
  7, 8, 9, 10, 11, 12, 13, 14, 16, 17,
  19, 21, 23, 25, 28, 31, 34, 37, 41, 45,
  50, 55, 60, 66, 73, 80, 88, 97, 107, 118,
  130, 143, 157, 173, 190, 209, 230, 253, 279, 307,
  337, 371, 408, 449, 494, 544, 598, 658, 724, 796,
  876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066,
  2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358,
  5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899,
  15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767,
];

function readU32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function decodeIma4PacketsToPcm16LE(imaBytes: Uint8Array, channels: number): Uint8Array {
  // Apple IMA4 packet = 34 bytes per channel -> 64 mono 16-bit samples per channel
  const packetBytesPerChannel = 34;
  const frameBytes = packetBytesPerChannel * channels;
  const numFrames = Math.floor(imaBytes.byteLength / frameBytes);
  const totalSamples = numFrames * 64 * channels;
  const pcmOut = new Uint8Array(totalSamples * 2);
  const outView = new DataView(pcmOut.buffer);

  for (let f = 0; f < numFrames; f++) {
    for (let ch = 0; ch < channels; ch++) {
      const pktOff = f * frameBytes + ch * packetBytesPerChannel;
      const header = (imaBytes[pktOff] << 8) | imaBytes[pktOff + 1];
      let predictor = (header & 0xff80) << 16 >> 16; // signed 16-bit top 9 bits
      let stepIndex = Math.max(0, Math.min(88, header & 0x007f));

      let sampleIdx = 0;
      for (let b = 2; b < packetBytesPerChannel; b++) {
        const packed = imaBytes[pktOff + b];
        for (let nib = 0; nib < 2; nib++) {
          const code = nib === 0 ? packed & 0x0f : (packed >>> 4) & 0x0f;
          const step = IMA_STEP_TABLE[stepIndex];
          let diff = step >> 3;
          if (code & 1) diff += step >> 2;
          if (code & 2) diff += step >> 1;
          if (code & 4) diff += step;
          if (code & 8) predictor -= diff;
          else predictor += diff;

          if (predictor > 32767) predictor = 32767;
          else if (predictor < -32768) predictor = -32768;

          stepIndex = Math.max(0, Math.min(88, stepIndex + IMA_INDEX_TABLE[code]));

          const outSamplePos = ((f * 64 + sampleIdx) * channels + ch) * 2;
          outView.setInt16(outSamplePos, predictor, true);
          sampleIdx++;
        }
      }
    }
  }

  return pcmOut;
}

export interface CafTranscodeResult {
  wavBytes: Uint8Array;
  formatId: 'lpcm' | 'ima4';
  sampleRate: number;
  channels: number;
  bitsPerChannel: number;
}

export function transcodeCafToWav(cafBytes: Uint8Array): CafTranscodeResult | null {
  if (
    cafBytes.byteLength < 64 ||
    cafBytes[0] !== 0x63 ||
    cafBytes[1] !== 0x61 ||
    cafBytes[2] !== 0x66 ||
    cafBytes[3] !== 0x66
  ) {
    return null;
  }

  let pos = 8;
  let sampleRate = 44100;
  let formatId = '';
  let formatFlags = 0;
  let channels = 1;
  let bitsPerChannel = 16;
  let rawAudio: Uint8Array | null = null;

  const view = new DataView(cafBytes.buffer, cafBytes.byteOffset, cafBytes.byteLength);

  while (pos + 12 <= cafBytes.byteLength) {
    const chunkType = String.fromCharCode(
      cafBytes[pos],
      cafBytes[pos + 1],
      cafBytes[pos + 2],
      cafBytes[pos + 3]
    );
    const sizeHigh = readU32BE(cafBytes, pos + 4);
    const sizeLow = readU32BE(cafBytes, pos + 8);
    const chunkSize =
      sizeHigh === 0xffffffff
        ? cafBytes.byteLength - (pos + 12)
        : sizeHigh * 0x100000000 + sizeLow;
    const dataStart = pos + 12;

    if (chunkType === 'desc' && chunkSize >= 32 && dataStart + 32 <= cafBytes.byteLength) {
      sampleRate = Math.round(view.getFloat64(dataStart, false)) || 44100;
      formatId = String.fromCharCode(
        cafBytes[dataStart + 8],
        cafBytes[dataStart + 9],
        cafBytes[dataStart + 10],
        cafBytes[dataStart + 11]
      );
      formatFlags = readU32BE(cafBytes, dataStart + 12);
      channels = readU32BE(cafBytes, dataStart + 24) || 1;
      bitsPerChannel = readU32BE(cafBytes, dataStart + 28) || 16;
    } else if (chunkType === 'data' && chunkSize > 4) {
      const audioStart = dataStart + 4; // skip 4-byte editCount
      const audioEnd = Math.min(cafBytes.byteLength, dataStart + chunkSize);
      if (audioEnd > audioStart) {
        rawAudio = cafBytes.subarray(audioStart, audioEnd);
      }
      break;
    }

    if (chunkSize < 0 || dataStart + chunkSize > cafBytes.byteLength) break;
    pos = dataStart + chunkSize;
  }

  if (!rawAudio) return null;

  let wavPcm: Uint8Array;
  let outBits = bitsPerChannel;

  if (formatId === 'lpcm') {
    if (bitsPerChannel !== 16 && bitsPerChannel !== 8) return null;
    const isLittleEndian = (formatFlags & 2) !== 0;
    wavPcm = new Uint8Array(rawAudio.byteLength);
    if (!isLittleEndian && bitsPerChannel === 16) {
      for (let i = 0; i + 1 < rawAudio.byteLength; i += 2) {
        wavPcm[i] = rawAudio[i + 1];
        wavPcm[i + 1] = rawAudio[i];
      }
    } else {
      wavPcm.set(rawAudio);
    }
  } else if (formatId === 'ima4') {
    if (channels < 1 || channels > 2) return null;
    wavPcm = decodeIma4PacketsToPcm16LE(rawAudio, channels);
    outBits = 16;
  } else {
    return null;
  }

  const byteRate = sampleRate * channels * (outBits / 8);
  const blockAlign = channels * (outBits / 8);
  const wavOut = new Uint8Array(44 + wavPcm.byteLength);
  const wv = new DataView(wavOut.buffer);

  wavOut.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  wv.setUint32(4, 36 + wavPcm.byteLength, true);
  wavOut.set([0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20], 8); // WAVEfmt 
  wv.setUint32(16, 16, true);
  wv.setUint16(20, 1, true); // PCM
  wv.setUint16(22, channels, true);
  wv.setUint32(24, sampleRate, true);
  wv.setUint32(28, byteRate, true);
  wv.setUint16(32, blockAlign, true);
  wv.setUint16(34, outBits, true);
  wavOut.set([0x64, 0x61, 0x74, 0x61], 36); // data
  wv.setUint32(40, wavPcm.byteLength, true);
  wavOut.set(wavPcm, 44);

  return {
    wavBytes: wavOut,
    formatId,
    sampleRate,
    channels,
    bitsPerChannel: outBits,
  };
}
