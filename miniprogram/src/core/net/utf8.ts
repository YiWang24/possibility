/**
 * 增量 UTF-8 解码 —— 小程序运行时没有 `TextDecoder`，必须自己写。
 *
 * 为什么不能一个 chunk 一个 chunk 直接解码：`onChunkReceived` 的分片边界是按字节切的，
 * 一个汉字占 3 字节，完全可能被切成「前 2 字节在这个 chunk，第 3 字节在下一个 chunk」。
 * 逐片独立解码就会在每个边界吐出一个乱码字符。所以要留一个未消费字节缓冲，
 * 只解码构成完整序列的部分，尾部残字节滚到下一片。
 */

/**
 * 返回 `bytes` 中构成完整 UTF-8 序列的字节数。
 *
 * 做法：从尾部回溯找最后一个「首字节」（非 `10xxxxxx` 的续字节），由它的高位得出这个
 * 序列需要几个字节；够了就整段完整，不够就把这个残缺序列留到下一片。
 */
export function completeByteLength(bytes: Uint8Array): number {
  const len = bytes.length
  if (len === 0) return 0

  // UTF-8 单序列最长 4 字节，回溯超过 4 字节说明字节流本身有问题
  const limit = Math.max(0, len - 4)
  let i = len - 1
  while (i >= limit && ((bytes[i] ?? 0) & 0xc0) === 0x80) i--
  if (i < limit) return len // 非法字节流：整段交出去，由解码器用替换字符兜底

  const lead = bytes[i] ?? 0
  let need: number
  if ((lead & 0x80) === 0) need = 1
  else if ((lead & 0xe0) === 0xc0) need = 2
  else if ((lead & 0xf0) === 0xe0) need = 3
  else if ((lead & 0xf8) === 0xf0) need = 4
  else return len // 非法首字节，同上

  return i + need <= len ? len : i
}

/** 把完整的 UTF-8 字节序列解成字符串（含 4 字节 emoji 的代理对处理）。 */
export function decodeUtf8(bytes: Uint8Array): string {
  const len = bytes.length
  let out = ''
  // 分批 flush：String.fromCharCode(...arr) 的参数个数有上限，长文本一次展开会爆栈
  let units: number[] = []
  let i = 0

  while (i < len) {
    const b0 = bytes[i] ?? 0
    let cp: number

    if ((b0 & 0x80) === 0) {
      cp = b0
      i += 1
    } else if ((b0 & 0xe0) === 0xc0) {
      cp = ((b0 & 0x1f) << 6) | ((bytes[i + 1] ?? 0) & 0x3f)
      i += 2
    } else if ((b0 & 0xf0) === 0xe0) {
      cp = ((b0 & 0x0f) << 12) |
        (((bytes[i + 1] ?? 0) & 0x3f) << 6) |
        ((bytes[i + 2] ?? 0) & 0x3f)
      i += 3
    } else if ((b0 & 0xf8) === 0xf0) {
      cp = ((b0 & 0x07) << 18) |
        (((bytes[i + 1] ?? 0) & 0x3f) << 12) |
        (((bytes[i + 2] ?? 0) & 0x3f) << 6) |
        ((bytes[i + 3] ?? 0) & 0x3f)
      i += 4
    } else {
      cp = 0xfffd // 非法首字节 → U+FFFD REPLACEMENT CHARACTER
      i += 1
    }

    if (cp > 0xffff) {
      const v = cp - 0x10000
      units.push(0xd800 + (v >> 10), 0xdc00 + (v & 0x3ff))
    } else {
      units.push(cp)
    }

    if (units.length >= 2048) {
      out += String.fromCharCode.apply(null, units)
      units = []
    }
  }

  if (units.length > 0) out += String.fromCharCode.apply(null, units)
  return out
}

/**
 * 有状态的流式解码器：喂 ArrayBuffer 分片，吐已可安全解码的字符串。
 *
 * 用法：
 * ```ts
 * const dec = new StreamingUtf8Decoder()
 * task.onChunkReceived((res) => buffer += dec.push(res.data))
 * buffer += dec.flush()   // 流结束时把残余字节交出来
 * ```
 */
export class StreamingUtf8Decoder {
  private pending = new Uint8Array(0)

  push(chunk: ArrayBuffer | Uint8Array): string {
    const incoming = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)

    let bytes: Uint8Array
    if (this.pending.length === 0) {
      bytes = incoming
    } else {
      bytes = new Uint8Array(this.pending.length + incoming.length)
      bytes.set(this.pending, 0)
      bytes.set(incoming, this.pending.length)
    }

    const usable = completeByteLength(bytes)
    if (usable === bytes.length) {
      this.pending = new Uint8Array(0)
      return decodeUtf8(bytes)
    }

    this.pending = bytes.slice(usable)
    return usable === 0 ? '' : decodeUtf8(bytes.subarray(0, usable))
  }

  /** 流结束：把残余字节按现状解出来（正常收尾时应为空）。 */
  flush(): string {
    if (this.pending.length === 0) return ''
    const rest = decodeUtf8(this.pending)
    this.pending = new Uint8Array(0)
    return rest
  }
}
