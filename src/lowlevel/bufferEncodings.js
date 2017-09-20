const ENCODINGS = {
  hex: {
    validate (str, expectedLength) {
      return (str.length === expectedLength * 2) && /^[0-9a-f]+$/i.test(str)
    },

    decode (str, buffer) {
      for (let i = 0; i < buffer.length; i++) {
        const byte = str.substring(2 * i, 2 * i + 2)
        buffer[i] = parseInt(byte, 16)
      }
    },

    encode (buffer) {
      return Array.prototype.map.call(buffer, x => x.toString(16))
        .map(x => (x.length === 1) ? ('0' + x) : x)
        .join('')
    }
  },

  bin: {
    validate (str, expectedLength) {
      return (str.length === expectedLength * 8) && /^[01]+$/.test(str)
    },

    decode (str, buffer) {
      for (let i = 0; i < buffer.length; i++) {
        const byte = str.substring(8 * i, 8 * i + 8)
        buffer[i] = parseInt(byte, 2)
      }
    },

    encode (buffer) {
      return Array.prototype.map.call(buffer, x => x.toString(2))
        .map(x => { while (x.length < 8) x = '0' + x; return x })
        .join('')
    }
  }
}

/**
 * Checks if a certain string encodes the byte buffer of a certain length.
 *
 * @param {number} expectedLength expected buffer length in bytes
 * @param {'bin' | 'hex'} encoding
 * @returns {boolean} is `str` valid for the buffer?
 */
export function validateString (str, expectedLength, encoding) {
  if (!ENCODINGS[encoding]) {
    throw new TypeError(`Unknown encoding: ${encoding}`)
  }

  return ENCODINGS[encoding].validate(str, expectedLength)
}

/**
 * Decodes the string to a byte buffer.
 *
 * @param {number} length buffer length
 * @param {'bin' | 'hex'} encoding
 * @returns {Uint8Array} created buffer
 */
export function decode (str, length, encoding) {
  if (!ENCODINGS[encoding]) {
    throw new TypeError(`Unknown encoding: ${encoding}`)
  }

  const buffer = new Uint8Array(length)
  ENCODINGS[encoding].decode(str, buffer)
  return buffer
}

/**
 * Encodes a byte buffer into a string.
 *
 * @param {Uint8Array} buffer
 * @param {'bin' | 'hex'} encoding encoding to use
 * @returns {string}
 */
export function encode (buffer, encoding) {
  if (!ENCODINGS[encoding]) {
    throw new TypeError(`Unknown encoding: ${encoding}`)
  }

  return ENCODINGS[encoding].encode(buffer)
}

/**
 * Attempts to get encoding from an object. To extract an encoding,
 * the object should have a key-value pair `enc: str`, where `enc` is one of
 * recognized encodings and `str` is a string.
 *
 * @param {any} obj
 * @returns {string | undefined} encoding
 */
export function getEncoding (obj) {
  if (!obj) return undefined

  for (let enc in ENCODINGS) {
    if (obj[enc] && typeof obj[enc] === 'string') {
      return enc
    }
  }

  return undefined
}
