/*
 * gif.js — minimal animated-GIF encoder (GIF89a), zero dependencies.
 *
 * Usage:
 *   const enc = createGifEncoder(width, height, delayCs);
 *   enc.addFrame(rgba);        // Uint8ClampedArray (width*height*4), per frame
 *   const blob = enc.finish(); // Blob('image/gif'), loops forever
 *
 * A 256-color palette is median-cut from the first frame (colors bucketed at
 * 5 bits/channel, averaged to 8-bit palette entries). Later frames map
 * through the same palette with a cached nearest-color fallback, so the
 * palette stays identical across the loop and colors never flicker.
 */
(() => {
  function createGifEncoder(width, height, delayCs) {
    const parts = [];
    const u16 = (v) => [v & 255, (v >> 8) & 255];
    const push = (bytes) => parts.push(new Uint8Array(bytes));

    let palette = null; // flat [r,g,b, r,g,b, ...] padded to 768 bytes
    let palCount = 0;
    const lookup = new Int16Array(32768).fill(-1); // 15-bit color key -> index
    const key = (r, g, b) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);

    function buildPalette(rgba) {
      // Histogram entries: [count, rSum, gSum, bSum, key]
      const hist = new Map();
      for (let i = 0; i < rgba.length; i += 4) {
        const k = key(rgba[i], rgba[i + 1], rgba[i + 2]);
        const e = hist.get(k);
        if (e) { e[0]++; e[1] += rgba[i]; e[2] += rgba[i + 1]; e[3] += rgba[i + 2]; }
        else hist.set(k, [1, rgba[i], rgba[i + 1], rgba[i + 2], k]);
      }
      // Median cut: repeatedly split the box with the widest channel spread.
      const boxes = [[...hist.values()]];
      while (boxes.length < 256) {
        let bi = -1, axis = 1, spread = 0;
        for (let b = 0; b < boxes.length; b++) {
          if (boxes[b].length < 2) continue;
          for (let ch = 1; ch <= 3; ch++) {
            let lo = Infinity, hi = -Infinity;
            for (const e of boxes[b]) {
              const m = e[ch] / e[0];
              if (m < lo) lo = m;
              if (m > hi) hi = m;
            }
            if (hi - lo > spread) { spread = hi - lo; bi = b; axis = ch; }
          }
        }
        if (bi < 0) break;
        const box = boxes[bi];
        box.sort((a, b) => a[axis] / a[0] - b[axis] / b[0]);
        const half = box.reduce((s, e) => s + e[0], 0) / 2;
        let acc = 0, cut = 0;
        while (cut < box.length - 1 && acc + box[cut][0] <= half) acc += box[cut++][0];
        if (cut === 0) cut = 1;
        boxes.push(box.splice(cut));
      }
      palette = new Uint8Array(768);
      palCount = boxes.length;
      boxes.forEach((box, i) => {
        let c = 0, r = 0, g = 0, b = 0;
        for (const e of box) { c += e[0]; r += e[1]; g += e[2]; b += e[3]; lookup[e[4]] = i; }
        palette[i * 3] = Math.round(r / c);
        palette[i * 3 + 1] = Math.round(g / c);
        palette[i * 3 + 2] = Math.round(b / c);
      });
    }

    function indexFor(r, g, b) {
      const k = key(r, g, b);
      let idx = lookup[k];
      if (idx < 0) {
        let best = 0, bd = Infinity;
        for (let i = 0; i < palCount; i++) {
          const dr = r - palette[i * 3], dg = g - palette[i * 3 + 1], db = b - palette[i * 3 + 2];
          const d = dr * dr + dg * dg + db * db;
          if (d < bd) { bd = d; best = i; }
        }
        lookup[k] = idx = best;
      }
      return idx;
    }

    function lzwEncode(indices) {
      const minCodeSize = 8;
      const out = new Uint8Array(indices.length * 2 + 64);
      let len = 0, cur = 0, curBits = 0;
      const emit = (code, size) => {
        cur |= code << curBits;
        curBits += size;
        while (curBits >= 8) { out[len++] = cur & 255; cur >>= 8; curBits -= 8; }
      };
      const CLEAR = 1 << minCodeSize, EOI = CLEAR + 1;
      let dict, next, codeSize;
      const reset = () => { dict = new Map(); next = EOI + 1; codeSize = minCodeSize + 1; };
      reset();
      emit(CLEAR, codeSize);
      let prev = indices[0];
      for (let i = 1; i < indices.length; i++) {
        const k = indices[i];
        const found = dict.get((prev << 8) | k);
        if (found !== undefined) { prev = found; continue; }
        emit(prev, codeSize);
        if (next === 4096) {
          emit(CLEAR, codeSize);
          reset();
        } else {
          dict.set((prev << 8) | k, next++);
          // The decoder grows its table one entry behind the encoder, so it
          // switches to the wider code size exactly when next exceeds it.
          if (next > (1 << codeSize) && codeSize < 12) codeSize++;
        }
        prev = k;
      }
      emit(prev, codeSize);
      // The decoder adds one final table entry after the last data code and
      // may widen before reading EOI; mirror that.
      if (next >= (1 << codeSize) && codeSize < 12) codeSize++;
      emit(EOI, codeSize);
      if (curBits) out[len++] = cur & 255;
      return out.subarray(0, len);
    }

    function writeHeader() {
      push([71, 73, 70, 56, 57, 97]); // "GIF89a"
      push([...u16(width), ...u16(height), 0xf7, 0, 0]); // 256-entry global color table
      parts.push(palette);
      // NETSCAPE2.0 application extension: loop forever
      push([0x21, 0xff, 0x0b, 78, 69, 84, 83, 67, 65, 80, 69, 50, 46, 48, 3, 1, 0, 0, 0]);
    }

    function addFrame(rgba) {
      if (!palette) {
        buildPalette(rgba);
        writeHeader();
      }
      const n = width * height;
      const indices = new Uint8Array(n);
      for (let i = 0, j = 0; j < n; i += 4, j++) {
        indices[j] = indexFor(rgba[i], rgba[i + 1], rgba[i + 2]);
      }
      push([0x21, 0xf9, 4, 4, ...u16(delayCs), 0, 0]); // GCE: keep frame, no transparency
      push([0x2c, 0, 0, 0, 0, ...u16(width), ...u16(height), 0]); // image descriptor
      const data = lzwEncode(indices);
      push([8]); // LZW min code size
      for (let o = 0; o < data.length; o += 255) {
        const block = data.subarray(o, Math.min(o + 255, data.length));
        push([block.length]);
        parts.push(block);
      }
      push([0]); // block terminator
    }

    function finish() {
      push([0x3b]); // trailer
      return new Blob(parts, { type: 'image/gif' });
    }

    return { addFrame, finish };
  }

  (typeof window !== 'undefined' ? window : globalThis).createGifEncoder = createGifEncoder;
  if (typeof module !== 'undefined' && module.exports) module.exports = { createGifEncoder };
})();
