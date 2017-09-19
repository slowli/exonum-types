import { rawValue, setRawValue, isExonumObject, initType } from './common'
import initFactory from './initFactory'

const ENCODINGS = {
  hex: {
    validate (str, expectedLength) {
      return (str.length === expectedLength * 2) && /^[0-9a-f]+$/i.test(str)
    },

    decode (str, buffer) {
      for (var i = 0; i < buffer.length; i++) {
        var byte = str.substring(2 * i, 2 * i + 2)
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
      for (var i = 0; i < buffer.length; i++) {
        var byte = str.substring(8 * i, 8 * i + 8)
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

export const encodings = ENCODINGS

/**
 * @param {number} expectedLength expected buffer length in bytes
 * @returns {boolean} is `str` valid for the buffer?
 */
function validateString (str, expectedLength, encoding) {
  if (!ENCODINGS[encoding]) {
    throw new TypeError(`Unknown encoding: ${encoding}`)
  }
  return ENCODINGS[encoding].validate(str, expectedLength)
}

/**
 * Checks if an object is an Exonum buffer.
 */
function isBuffer (obj) {
  return isExonumObject(obj) && (rawValue(obj) instanceof Uint8Array)
}

function decode (str, length, encoding) {
  if (!ENCODINGS[encoding]) {
    throw new TypeError(`Unknown encoding: ${encoding}`)
  }
  var buffer = new Uint8Array(length)
  ENCODINGS[encoding].decode(str, buffer)
  return buffer
}

function encode (buffer, encoding) {
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
function getEncoding (obj) {
  if (!obj) return undefined

  for (var enc in ENCODINGS) {
    if (obj[enc] && typeof obj[enc] === 'string') {
      return enc
    }
  }
  return undefined
}

/**
 * Creates a new fixed-length buffer type.
 *
 * @param {length} length of the buffer
 * @api public
 */
function fixedBuffer (length) {
  return initType(class {
    /**
     * @param {String | Array<number> | Uint8Array | FixedBuffer} obj
     * @param {String} [encoding]
     */
    constructor (obj, encoding) {
      var _raw

      if (!encoding) {
        // Allow initializations like `SizedBuffer({ hex: 'abcdef' })`,
        // which are useful in JSON parsing
        const inferredEncoding = getEncoding(obj)
        if (inferredEncoding) {
          encoding = inferredEncoding
          obj = obj[encoding]
        }
      }

      if (obj === undefined) {
        // Initialize with zeros
        _raw = new Uint8Array(length)
      } else if (typeof obj === 'string') {
        // String-based construc
        if (!encoding) encoding = 'hex'
        if (!validateString(obj, length, encoding)) {
          throw new TypeError(`Cannot parse string: ${obj}`)
        }
        _raw = decode(obj, length, encoding)
      } else if (isBuffer(obj)) {
        // Copying constructor
        if (obj.byteLength() !== length) {
          throw new Error(`Unexpected buffer length: ${obj.byteLength()}; ${length} expected`)
        }
        _raw = rawValue(obj)
      } else {
        // Assume `obj` is array-like
        if (!obj || obj.length === undefined) {
          throw new TypeError('Invalid-typed buffer initializer')
        }

        if (obj.length !== length) {
          throw new Error(`Unexpected buffer length: ${obj.length}; ${length} expected`)
        }

        _raw = new Uint8Array(obj)
      }

      // As `Uint8Array` instances are mutable, we need to specify an explicit cloning
      // procedure
      setRawValue(this, _raw, () => _raw.slice(0))
    }

    serialize (buffer) {
      if (buffer.length !== length) {
        throw new Error(`Unexpected buffer length: ${buffer.length}; ${length} expected`)
      }
      buffer.set(rawValue(this))
    }

    toJSON () {
      return encode(rawValue(this), 'hex')
    }

    toString (encoding) {
      if (encoding !== undefined) {
        return encode(rawValue(this), encoding)
      }

      const bytes = (length > 4) ? rawValue(this).subarray(0, 4) : rawValue(this)
      return `Buffer(${encode(bytes, 'hex')}${(length > 4) ? '...' : ''})`
    }
  }, {
    byteLength: length,
    name: `Buffer<${length}>`
  })
}

export default initFactory(fixedBuffer, {
  name: 'buffer'
})
