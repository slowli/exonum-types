import { rawValue, getMethodNames, createType } from './common'

/**
 * Calculates string length in bytes.
 *
 * @param {string} str
 * @returns {number}
 */
function stringLength (str) {
  let len = 0

  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)

    if (c < 128) {
      len++
    } else if (c < 2048) {
      len += 2
    } else if (((c & 0xFC00) === 0xD800) && (i + 1) < str.length && ((str.charCodeAt(i + 1) & 0xFC00) === 0xDC00)) {
      // surrogate pair
      len += 4
      i++
    } else {
      len += 3
    }
  }
  return len
}

/**
 * @param {string} str
 * @param {Uint8Array} buffer
 */
function serializeString (str, buffer) {
  let from = 0

  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)

    if (c < 128) {
      buffer[from++] = c
    } else if (c < 2048) {
      buffer[from++] = (c >> 6) | 192
      buffer[from++] = (c & 63) | 128
    } else if (((c & 0xFC00) === 0xD800) && (i + 1) < str.length && ((str.charCodeAt(i + 1) & 0xFC00) === 0xDC00)) {
      // surrogate pair
      const pairC = 0x10000 + ((c & 0x03FF) << 10) + (str.charCodeAt(++i) & 0x03FF)
      buffer[from++] = (pairC >> 18) | 240
      buffer[from++] = ((pairC >> 12) & 63) | 128
      buffer[from++] = ((pairC >> 6) & 63) | 128
      buffer[from++] = (pairC & 63) | 128
    } else {
      buffer[from++] = (c >> 12) | 224
      buffer[from++] = ((c >> 6) & 63) | 128
      buffer[from++] = (c & 63) | 128
    }
  }
}

export default class Str extends createType({
  typeLength: undefined,
  proxiedMethods: getMethodNames(String.prototype),
  name: 'Str'
}) {
  constructor (obj) {
    super(obj.toString())
  }

  _doSerialize (buffer) {
    serializeString(rawValue(this), buffer)
  }

  toJSON () {
    return rawValue(this)
  }

  byteLength () {
    return stringLength(rawValue(this))
  }
}
