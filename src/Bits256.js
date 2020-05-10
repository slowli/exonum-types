export function getBit (buffer, pos) {
  const byte = Math.floor(pos / 8)
  const bitPos = pos % 8

  return (buffer[byte] & (1 << (7 - bitPos))) >> (7 - bitPos)
}

/**
 * Sets a specified bit in the byte buffer.
 *
 * @param {Uint8Array} buffer
 * @param {number} pos 0-based position in the buffer to set
 * @param {0 | 1} bit
 */
function setBit (buffer, pos, bit) {
  const byte = Math.floor(pos / 8)
  const bitPos = pos % 8

  if (bit === 0) {
    const mask = 255 - (1 << (7 - bitPos))
    buffer[byte] &= mask
  } else {
    const mask = (1 << (7 - bitPos))
    buffer[byte] |= mask
  }
}

export default function extendBits256 (Bits256Base) {
  // Length of the key
  const BIT_LENGTH = 256

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
  return class Bits256 extends Bits256Base {
    /**
     * Creates a leaf `Bits256` key from the specified buffer.
     *
     * @param {Uint8Array} bytes
     */
    static leaf (bytes) {
      return new this(bytes, BIT_LENGTH)
    }

    /**
     * Compares two `Bits256` instances.
     *
     * @param {Bits256} x
     * @param {Bits256} y
     * @returns {-1 | 0 | 1}
     */
    static comparator (x, y) {
      const minBits = Math.min(x.bitLength(), y.bitLength())
      const minBytes = minBits >> 3
      const [xBytes, yBytes] = [x.bytes, y.bytes]

      for (let i = 0; i < minBytes; i++) {
        if (xBytes[i] < yBytes[i]) {
          return -1
        } else if (xBytes[i] > yBytes[i]) {
          return 1
        }
      }

      for (let bit = minBytes * 8; bit < minBits; bit++) {
        if (x.bit(bit) < y.bit(bit)) {
          return -1
        } else if (x.bit(bit) > y.bit(bit)) {
          return 1
        }
      }

      if (x.bitLength() < y.bitLength()) {
        return -1
      } else if (x.bitLength() > y.bitLength()) {
        return 1
      } else {
        return 0
      }
    }

    constructor (strOrBytes, bitLength) {
      if (typeof strOrBytes === 'string') {
        super({
          isTerminal: strOrBytes.length === BIT_LENGTH,
          bytes: { bin: padWithZeros(strOrBytes, BIT_LENGTH) },
          bitLengthByte: strOrBytes.length % BIT_LENGTH
        })
      } else if (strOrBytes instanceof Uint8Array) {
        super({
          isTerminal: bitLength === BIT_LENGTH,
          bytes: strOrBytes,
          bitLengthByte: bitLength % BIT_LENGTH
        })
      } else {
        throw new TypeError('Invalid initializer; string or Uint8Array expected')
      }
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
     * Truncates this bit sequence to a shorter one by removing some bits from the end.
     *
     * @param {number} bits
     *   new length of the sequence
     * @returns {Bits256}
     *   truncated bit sequence
     */
    truncate (bits) {
      bits = +bits
      if (bits > this.bitLength()) {
        throw new TypeError(`Cannot truncate bit slice to length more than current (current: ${this.bitLength()}, requested: ${bits})`)
      }

      const bytes = new Uint8Array(BIT_LENGTH / 8)
      for (let i = 0; i < bits >> 3; i++) {
        bytes[i] = this.bytes[i]
      }
      for (let bit = 8 * (bits >> 3); bit < bits; bit++) {
        setBit(bytes, bit, this.bit(bit))
      }

      return new Bits256(bytes, bits)
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

    /**
     * Computes a common prefix of this and another byte sequence.
     *
     * @param {Bits256} other
     * @returns {Bits256}
     */
    commonPrefix (other) {
      const intersectingBits = Math.min(this.bitLength(), other.bitLength())

      // First, advance by a full byte while it is possible
      let pos
      for (pos = 0;
        pos < intersectingBits >> 3 && this.bytes[pos >> 3] === other.bytes[pos >> 3];
        pos += 8) ;

      // Then, check inidividual bits
      for (; pos < intersectingBits && this.bit(pos) === other.bit(pos); pos++) ;

      return this.truncate(pos)
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
