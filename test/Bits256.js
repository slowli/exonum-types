/* eslint-env mocha */

import chai from 'chai'
import chaiBytes from 'chai-bytes'
import dirtyChai from 'dirty-chai'

import std from '../src/std'
const Bits256 = std.Bits256

const expect = chai
  .use(chaiBytes)
  .use(dirtyChai)
  .expect

describe('Bits256', () => {
  const binaryStrings = [
    '10',
    '01',
    '10001',
    '10101010001111',
    '00100000000000000000000000010000110000',
    '10111101010101000110000010001010001100101',
    '01010000000000000001010100000000000000010110010101001010010100010101001010101001',
    '1011010100101000000000000000000010010010010101000000011111111111111100000000010110001111111111111111111111100011000111111110000000000100110'
  ]

  describe('leaf', () => {
    it('should construct instance from buffer', () => {
      let buffer = new Uint8Array(32)
      let key = Bits256.leaf(buffer)
      expect(key.isTerminal).to.be.true()
      expect(key.bytes).to.equalBytes(buffer)
      expect(key.bitLength()).to.equal(256)

      buffer[0] = 192
      key = Bits256.leaf(buffer)
      expect(key.bytes).to.equalBytes(buffer)
      expect(key.bit(0)).to.equal(1)
    })
  })

  describe('comparator', () => {
    it('should compare 2 equal full-length instances', () => {
      let buffer = new Uint8Array(32)
      let key = Bits256.leaf(buffer)
      let otherKey = Bits256.leaf(buffer)
      expect(Bits256.comparator(key, otherKey)).to.equal(0)

      buffer[0] = 192
      buffer[10] = 100
      key = Bits256.leaf(buffer)
      otherKey = Bits256.leaf(buffer)
      expect(Bits256.comparator(key, otherKey)).to.equal(0)
    })

    it('should compare 2 equal partial-length instances', () => {
      let key = Bits256.from('100010')
      let otherKey = Bits256.from('100010')
      expect(Bits256.comparator(key, otherKey)).to.equal(0)

      key = Bits256.from('1000101010001010')
      otherKey = Bits256.from('1000101010001010')
      expect(Bits256.comparator(key, otherKey)).to.equal(0)
    })

    binaryStrings.forEach(str => {
      const key = Bits256.from(str)

      binaryStrings.forEach(otherStr => {
        const otherKey = Bits256.from(otherStr)

        it(`should correctly compare ${str} and ${otherStr}`, () => {
          const comp = (str === otherStr)
            ? 0
            : (str < otherStr) ? -1 : 1
          expect(Bits256.comparator(key, otherKey)).to.equal(comp)
        })
      })
    })

    it('should correctly compare substring instances', () => {
      let key = Bits256.from('10001')
      let otherKey = Bits256.from('100010')
      expect(Bits256.comparator(key, otherKey)).to.equal(-1)
      expect(Bits256.comparator(otherKey, key)).to.equal(1)

      key = Bits256.from('1000100')
      otherKey = Bits256.from('10001000')
      expect(Bits256.comparator(key, otherKey)).to.equal(-1)
      expect(Bits256.comparator(otherKey, key)).to.equal(1)

      key = Bits256.from('1000100')
      otherKey = Bits256.from('100010001')
      expect(Bits256.comparator(key, otherKey)).to.equal(-1)
      expect(Bits256.comparator(otherKey, key)).to.equal(1)
    })
  })

  describe('constructor', () => {
    it('should not accept object', () => {
      expect(() => Bits256.from({
        isLeaf: true,
        bits: 11,
        bitLength: 100
      })).to.throw(/string/i)
    })

    const nonBinaryStrings = [
      'foo',
      '01 ',
      ' 111 ',
      's10001'
    ]

    nonBinaryStrings.forEach(str => {
      it(`should not accept non-binary string '${str}'`, () => {
        expect(() => Bits256.from(str)).to.throw(/Cannot parse.*bin.*encoding/i)
      })
    })

    it('should not accept oversized string', () => {
      let str = '1'
      for (let i = 0; i < 8; i++) str = str + str
      str += '0'

      expect(() => Bits256.from(str)).to.throw(/Cannot parse.*bin.*encoding/i)
    })

    it('should initialize non-terminal bit string', () => {
      const bits = Bits256.from('1011')
      expect(bits.bitLength()).to.equal(4)
      expect(bits.isTerminal).to.be.false()
      expect(bits.bytes[0]).to.equal(176) // 10110000 in binary
    })

    it('should initialize terminal bit string', () => {
      let str = '0'
      for (let i = 0; i < 8; i++) str = str + str
      str = '1' + str.substring(1)
      expect(str.length).to.equal(256)

      const bits = Bits256.from(str)
      expect(bits.bitLengthByte).to.equal(0)
      expect(bits.bitLength()).to.equal(256)
      expect(bits.isTerminal).to.be.true()
      expect(bits.bytes[0]).to.equal(128)
    })
  })

  describe('serialize', () => {
    it('should serialize non-terminal bit string', () => {
      const bits = Bits256.from('1011')
      const buffer = bits.serialize()
      expect(buffer[0]).to.equal(0)
      expect(buffer[1]).to.equal(176)
      for (let i = 2; i < 33; i++) {
        expect(buffer[i]).to.equal(0)
      }
      expect(buffer[33]).to.equal(4)
    })
  })

  describe('toJSON', () => {
    binaryStrings.forEach(str => {
      const repr = (str.length > 40) ? str.substring(0, 40) + '...' : str

      it(`should serialize non-terminal bit string '${repr}'`, () => {
        const bits = Bits256.from(str)
        expect(bits.toJSON()).to.equal(str)
      })
    })
  })

  describe('bit', () => {
    binaryStrings.forEach(str => {
      const repr = (str.length > 40) ? str.substring(0, 40) + '...' : str

      it(`should serialize non-terminal bit string '${repr}'`, () => {
        const bits = Bits256.from(str)
        for (let i = 0; i < str.length; i++) {
          expect(bits.bit(i)).to.equal(parseInt(str[i]))
        }
      })
    })

    it('should throw on out-of-bounds access', () => {
      const bits = Bits256.from('11001010100101')
      expect(bits.bit(-1)).to.be.undefined()
      expect(bits.bit(100)).to.be.undefined()
    })
  })

  describe('truncate', () => {
    binaryStrings.forEach(str => {
      const repr = (str.length > 40) ? str.substring(0, 40) + '...' : str

      for (let len = 0; len < str.length; len++) {
        it(`should truncate bit string ${repr} to length ${len}`, () => {
          const bits = Bits256.from(str).truncate(len)
          expect(bits.bitLength()).to.equal(len)
          expect(bits.toJSON()).to.equal(str.substring(0, len))
        })
      }
    })

    it('should throw when instructed to truncate to an excessive length', () => {
      const bits = Bits256.from('110101')
      expect(() => bits.truncate(7)).to.throw(/Cannot truncate bit slice/i)
    })
  })

  describe('append', () => {
    it('should append 2 short bit slices', () => {
      const x = Bits256.from('10')
      const y = Bits256.from('11')
      const concat = x.append(y)
      expect(concat.bitLength()).to.equal(4)
      expect(concat.isTerminal).to.be.false()
      expect(concat.bytes[0]).to.equal(176)
      for (let i = 1; i < 32; i++) {
        expect(concat.bytes[i]).to.equal(0)
      }
    })

    it('should throw on overflow', () => {
      let str = '0'
      for (let i = 0; i < 8; i++) str = str + str
      const x = Bits256.from(str)
      expect(x.isTerminal).to.be.true()
      expect(() => x.append(Bits256.from('1'))).to.throw(/long/i)
    })

    binaryStrings.forEach((xStr, i) => {
      const xRepr = (xStr.length > 20) ? xStr.substring(0, 20) + '...' : xStr

      binaryStrings.forEach((yStr, j) => {
        const yRepr = (yStr.length > 20) ? yStr.substring(0, 20) + '...' : yStr

        if (xStr.length + yStr.length > 256) {
          it(`should throw on overflow when appending ${xRepr} and ${yRepr}`, () => {
            const x = Bits256.from(xStr)
            const y = Bits256.from(yStr)
            expect(() => x.append(y)).to.throw(/long/i)
          })
        } else {
          it(`should combine strings ${xRepr} and ${yRepr}`, () => {
            const x = Bits256.from(xStr)
            const y = Bits256.from(yStr)
            const concat = x.append(y)
            expect(concat.toJSON()).to.equal(x.toJSON() + y.toJSON())
          })
        }
      })
    })
  })

  describe('commonPrefix', () => {
    const pairs = [
      [ '100', '10001', '100' ],
      [ '1001', '1011101', '10' ],
      [ '1001', '1001', '1001' ],
      [ '00010100', '0001010111', '0001010' ],
      [ '000101010', '0001010111', '00010101' ],
      [ '0001001010000101010', '00010010100001010111', '000100101000010101' ]
    ]

    pairs.forEach(({ 0: xStr, 1: yStr, 2: prefix }) => {
      it(`should find common prefix for bit slices ${xStr} and ${yStr}`, () => {
        const x = Bits256.from(xStr)
        const y = Bits256.from(yStr)
        expect(x.commonPrefix(y).toJSON()).to.equal(prefix)
        expect(y.commonPrefix(x).toJSON()).to.equal(prefix)
      })
    })

    it('should return an empty bit slice when appropriate', () => {
      let x = Bits256.from('00')
      let y = Bits256.from('10001')
      expect(x.commonPrefix(y).toJSON()).to.equal('')
      expect(y.commonPrefix(x).toJSON()).to.equal('')

      x = Bits256.from('0000100000000000000000')
      expect(x.commonPrefix(y).toJSON()).to.equal('')
      expect(y.commonPrefix(x).toJSON()).to.equal('')
    })
  })

  describe('toString', () => {
    it('should output full bit contents for short slice', () => {
      const bits = Bits256.from('110111')
      expect(bits.toString()).to.equal('bits(110111)')
    })

    it('should shorten bit contents for long slice', () => {
      const bits = Bits256.from('1010101001')
      expect(bits.toString()).to.equal('bits(10101010...)')
    })
  })

  describe('equals', () => {
    it('should correctly determine that 2 terminal instances are equal', () => {
      const buffer = new Uint8Array(32)
      for (let i = 0; i < buffer.length; i++) buffer[i] = 65 + i

      const x = Bits256.leaf(buffer)
      const y = new Bits256(buffer, 256)
      expect(x.equals(y)).to.be.true()
    })

    it('should correctly determine that 2 non-terminal instances are equal', () => {
      const x = Bits256.from('110101')
      const y = new Bits256('110101')
      expect(x.equals(y)).to.be.true()
      expect(y.equals(x)).to.be.true()
    })

    it('should determine that a sub-key is not equal to the key', () => {
      const x = Bits256.from('1101')
      const y = new Bits256('110101')
      expect(x.equals(y)).to.be.false()
    })
  })
})
