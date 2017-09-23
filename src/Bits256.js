import std from './std'

const BIT_LENGTH = 256

const Bits256Base = std.resolve({
  struct: [
    { name: 'isTerminal', type: 'Bool' },
    { name: 'bytes', type: { fixedBuffer: BIT_LENGTH / 8 } },
    { name: 'bitLengthByte', type: 'Uint8' }
  ]
})

export function getBit (buffer, pos) {
  const byte = Math.floor(pos / 8)
  const bitPos = pos % 8

  return (buffer[byte] & (1 << (7 - bitPos))) >> (7 - bitPos)
}

/**
 * `Bits256` represents partial and complete (terminal) keys of `MapView`s. The instances
 * are comprised of 3 fields:
 *
 *   - `isTerminal` marker signifying whether the the instance corresponds to a complete
 *     or incomplete key
 *   - `bytes` is an ordinary 32-byte serialization of the key
 *   - `bitLengthByte` is the number of bits in the `bytes` that are actually used.
*      Other bits are set to zero. For terminal keys, this field is equal to 0
 */
export default class Bits256 extends Bits256Base {
  constructor (str) {
    if (typeof str !== 'string') {
      throw new TypeError('Bits256 can only be initialized with a string')
    }
    if (!/^[01]*$/.test(str)) {
      throw new TypeError('Invalid initializer string; binary string expected')
    }
    if (str.length > BIT_LENGTH) {
      throw new TypeError(`Initializer too long: max ${BIT_LENGTH} bits expected`)
    }

    super({
      isTerminal: str.length === BIT_LENGTH,
      bytes: { bin: padWithZeros(str, BIT_LENGTH) },
      bitLengthByte: str.length % BIT_LENGTH
    })
  }

  bitLength () {
    return this.isTerminal ? BIT_LENGTH : this.bitLengthByte
  }

  /**
   * Retrieves a bit at a specific position of this key.
   *
   * @param {number} pos
   * @returns {0 | 1 | void}
   */
  bit (pos) {
    pos = +pos
    if (pos >= this.bitLength() || pos < 0) {
      return undefined
    }

    return getBit(this.bytes, pos)
  }

  /**
   * Returns the result of concatenation of this key with another one. If the length
   * of the concatenated key exceeds 256 bits, an error is raised.
   *
   * @param {Bits256} other
   * @returns {Bits256}
   */
  append (otherBits) {
    const sumLength = this.bitLength() + otherBits.bitLength()
    if (sumLength > BIT_LENGTH) {
      throw new Error(`Resulting bit slice too long: ${sumLength} (max ${BIT_LENGTH} supported)`)
    }

    // XXX: lazy and inefficient
    return new Bits256(this.toJSON() + otherBits.toJSON())
  }

  toJSON () {
    return trimZeros(this.getOriginal('bytes').toString('bin'), this.bitLength())
  }

  toString () {
    const bits = (this.bitLength() > 8)
      ? trimZeros(this.getOriginal('bytes').toString('bin'), 8) + '...'
      : trimZeros(this.getOriginal('bytes').toString('bin'), this.bitLength())
    return `bits(${bits})`
  }
}

const ZEROS = (() => {
  let str = '0'
  for (let i = 0; i < 8; i++) str = str + str
  return str
})()

function padWithZeros (str, desiredLength) {
  return str + ZEROS.substring(0, desiredLength - str.length)
}

function trimZeros (str, desiredLength) {
  /* istanbul ignore next: should never be triggered */
  if (str.length < desiredLength) {
    throw new Error('Invariant broken: negative zero trimming requested')
  }
  return str.substring(0, desiredLength)
}
