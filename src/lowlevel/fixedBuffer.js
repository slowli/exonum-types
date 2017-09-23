import { List } from 'immutable'

import { rawValue, isExonumObject, createType, memoize } from './common'
import initFactory from './initFactory'
import { validateString, encode, decode, getEncoding } from './bufferEncodings'

/**
 * Checks if an object is an Exonum buffer.
 */
function isBuffer (obj) {
  return isExonumObject(obj) && (rawValue(obj) instanceof Uint8Array)
}

/**
 * Creates a new fixed-length buffer type.
 *
 * @param {length} length of the buffer
 * @api public
 */
function fixedBuffer (length) {
  class FixedBuffer extends createType({
    typeLength: length,
    name: `Buffer<${length}>`
  }) {
    /**
     * @param {String | Array<number> | Uint8Array | FixedBuffer} obj
     * @param {?String} encoding
     */
    constructor (obj, encoding) {
      let _raw

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
        // String-based constructor
        if (!encoding) encoding = 'hex'
        if (!validateString(obj, length, encoding)) {
          throw new TypeError(`Cannot parse buffer string ${obj} in ${encoding} encoding`)
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
      super(_raw, () => _raw.slice(0))
    }

    _doSerialize (buffer) {
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

    hashCode () {
      return List(rawValue(this)).hashCode()
    }

    equals (other) {
      if (!isBuffer(other)) return false

      const rawThis = rawValue(this)
      const rawOther = rawValue(other)

      // Different buffer lengths
      if (rawOther.length !== rawThis.length) return false
      return rawThis.every((byte, i) => byte === rawOther[i])
    }
  }

  FixedBuffer.prototype.hashCode = memoize(FixedBuffer.prototype.hashCode)

  return FixedBuffer
}

export default initFactory(fixedBuffer, {
  name: 'buffer'
})
