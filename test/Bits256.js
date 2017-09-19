/* eslint-env mocha */

import chai from 'chai'
import chaiBytes from 'chai-bytes'
import dirtyChai from 'dirty-chai'

import Bits256 from '../src/Bits256'

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
        expect(() => Bits256.from(str)).to.throw(/binary/i)
      })
    })

    it('should not accept oversized string', () => {
      let str = '1'
      for (let i = 0; i < 8; i++) str = str + str
      str += '0'

      expect(() => Bits256.from(str)).to.throw(/long/i)
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
})
