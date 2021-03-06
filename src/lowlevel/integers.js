import bigInt from 'big-integer'
import { isExonumObject, createType, getMethodNames, rawValue } from './common'
import initFactory from './initFactory'

// istanbul ignore next: fallback code; hardly possible to trigger in modern envs
const MAX_SAFE_INTEGER = bigInt(Number.MAX_SAFE_INTEGER || '9007199254740991')
// istanbul ignore next: fallback code; hardly possible to trigger in modern envs
const MIN_SAFE_INTEGER = bigInt(Number.MIN_SAFE_INTEGER || '-9007199254740991')

// Maximum size of integer type in which all values fall into safe category
const MAX_SAFE_SIZE = 6

/**
 * Checks whether a value looks like an instance of an Exonum integer type.
 *
 * @param {any} maybeInteger value to check
 * @returns {boolean}
 */
function isInteger (maybeInteger) {
  if (!isExonumObject(maybeInteger)) return false

  const raw = rawValue(maybeInteger)
  return raw && raw.toJSNumber
}

function getEncoding (obj) {
  if (!obj) return undefined

  for (let enc of [ 'dec', 'hex', 'oct', 'bin' ]) {
    if (obj[enc] && typeof obj[enc] === 'string') {
      return enc
    }
  }
  return undefined
}

const PROXIED_METHODS = getMethodNames(Object.getPrototypeOf(bigInt(0)))
  .filter(method => method !== 'toJSON')

/**
 * Instantiates a new integer type.
 *
 * @param {number} byteLength byte length of a type
 * @param {boolean} signed does the type need to be signed?
 * @returns created integer type
 */
function $integer (byteLength, signed) {
  const MIN_VALUE = signed
    ? bigInt(1).shiftLeft(byteLength * 8 - 1).multiply(-1)
    : bigInt(0)
  const MAX_VALUE = (signed
    ? bigInt(1).shiftLeft(byteLength * 8 - 1)
    : bigInt(1).shiftLeft(byteLength * 8)).minus(1)

  class SizedInteger extends createType({
    typeLength: byteLength,
    proxiedMethods: PROXIED_METHODS
  }) {
    constructor (value, encoding) {
      let _raw

      if (getEncoding(value)) {
        // Allow initializations like `SizedInteger({ hex: 'abcdef' })`,
        // which are useful in JSON parsing
        encoding = getEncoding(value)
        value = value[encoding]
      }

      if (isInteger(value)) {
        _raw = rawValue(value)
      } else if (bigInt.isInstance(value)) {
        _raw = value
      } else if (typeof value === 'string') {
        if (encoding === undefined) encoding = 'dec'

        // XXX: bigInt's parsing rules are lax: e.g., bigInt('18', 8) parses as 1
        // Not sure whether this needs to be addressed here

        switch (encoding) {
          case 'dec':
            _raw = bigInt(value, 10); break
          case 'hex':
            _raw = bigInt(value, 16); break
          case 'oct':
            _raw = bigInt(value, 8); break
          case 'bin':
            _raw = bigInt(value, 2); break
          default:
            throw new Error(`Unknown encoding: ${encoding}`)
        }
      } else if (typeof value === 'number' && !isNaN(value)) {
        _raw = bigInt(value)
      } else {
        throw new TypeError(`Not a number: ${value}`)
      }

      if (_raw.lt(MIN_VALUE) || _raw.gt(MAX_VALUE)) {
        throw new Error(`Value out of range: expected ${MIN_VALUE} <= x <= ${MAX_VALUE}, got ${_raw}`)
      }

      const externalValue = (_raw.gt(MAX_SAFE_INTEGER) || _raw.lt(MIN_SAFE_INTEGER))
        ? _raw
        : _raw.toJSNumber()

      super(_raw, () => externalValue)
    }

    _doSerialize (buffer) {
      let x = rawValue(this)
      if (signed && x.isNegative()) {
        x = x.minus(MIN_VALUE.multiply(2))
      }

      for (let i = 0; i < byteLength; i++) {
        const divmod = x.divmod(256)
        buffer[i] = divmod.remainder
        x = divmod.quotient
      }
    }

    toJSON () {
      const raw = rawValue(this)
      return (byteLength > MAX_SAFE_SIZE)
        ? raw.toString()
        : raw.toJSNumber()
    }
  }

  return SizedInteger
}

// Maximum supported byte length of integer types. Chosen according to the maximum supported message size;
// the sane values are orders of magnitude lower.
const MAX_BYTE_LENGTH = 2 * 1024 * 1024

function prepareLength (length) {
  length = +length
  if (isNaN(length)) {
    throw new TypeError('Invalid byte length of integer type; number expected')
  }

  if (length <= 0 || length > MAX_BYTE_LENGTH) {
    throw new RangeError(`Unexpected byte length of integer type: ${length}; expected value between 1 and ${MAX_BYTE_LENGTH}`)
  }

  return length
}

/**
 * Instantiates a new signed integer type.
 *
 * @param {number} byteLength byte length of a type
 * @returns created integer type
 *
 * @api public
 */
export const integer = initFactory((byteLength) => {
  return $integer(byteLength, true)
}, {
  name: 'integer',
  prepare: prepareLength,

  typeName (byteLength) {
    return `Int${byteLength * 8}`
  }
})

/**
 * Instantiates a new unsigned integer type.
 *
 * @param {number} byteLength byte length of a type
 * @returns created integer type
 *
 * @api public
 */
export const uinteger = initFactory((byteLength) => {
  return $integer(byteLength, false)
}, {
  name: 'uinteger',
  prepare: prepareLength,

  typeName (byteLength) {
    return `Uint${byteLength * 8}`
  }
})
