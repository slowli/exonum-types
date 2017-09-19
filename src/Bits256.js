import std from './std'
import { encodings } from './lowlevel/fixedBuffer'

const BIT_LENGTH = 256

// Encodes `Uint8Array` into a binary string
const binEncode = encodings.bin.encode

const Bits256Base = std.resolver.resolve({
  struct: [
    { name: 'isTerminal', type: 'Bool' },
    { name: 'bytes', type: { fixedBuffer: BIT_LENGTH / 8 } },
    { name: 'bitLengthByte', type: 'Uint8' }
  ]
})

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

  bit (pos) {
    pos = +pos
    if (pos >= this.bitLength()) {
      throw new RangeError(`Bit position out of bounds: ${pos} (max ${this.bitLength()} expected)`)
    }

    const byte = Math.floor(pos / 8)
    const bitPos = pos % 8

    return (this.bytes[byte] & (1 << (7 - bitPos))) >> (7 - bitPos)
  }

  append (otherBits) {
    const sumLength = this.bitLength() + otherBits.bitLength()
    if (sumLength > BIT_LENGTH) {
      throw new Error(`Resulting bit slice too long: ${sumLength} (max ${BIT_LENGTH} supported)`)
    }

    // XXX: lazy
    return new Bits256(this.toJSON() + otherBits.toJSON())
  }

  toJSON () {
    return trimZeros(binEncode(this.bytes), this.bitLength())
  }

  toString () {
    const bits = (this.bitLength() > 8)
      ? trimZeros(binEncode(this.bytes), 8) + '...'
      : trimZeros(binEncode(this.bytes), this.bitLength())
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
  if (str.length < desiredLength) {
    throw new Error('Invariant broken: negative zero trimming requested')
  }
  return str.substring(0, desiredLength)
}
