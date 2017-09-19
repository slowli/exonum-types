/* eslint-env mocha */

import chai from 'chai'
import chaiBytes from 'chai-bytes'
import dirtyChai from 'dirty-chai'

import fixedBuffer from '../../src/lowlevel/fixedBuffer'
import { rawValue } from '../../src/lowlevel/common'

const expect = chai
  .use(chaiBytes)
  .use(dirtyChai)
  .expect

// TODO: type equality

describe('fixedBuffer', () => {
  const ShortBuffer = fixedBuffer(4)
  const LongBuffer = fixedBuffer(32)

  it('should declare correct byteLength', () => {
    expect(ShortBuffer.typeLength()).to.equal(4)
    expect(LongBuffer.typeLength()).to.equal(32)
  })

  describe('constructor', () => {
    it('should accept hex string', () => {
      const buf = new ShortBuffer('01234567')
      expect(rawValue(buf)).to.equalBytes([0x01, 0x23, 0x45, 0x67])
    })

    it('should accept JS array', () => {
      const buf = new ShortBuffer([ 1, 2, 34, 56 ])
      expect(rawValue(buf)).to.equalBytes([1, 2, 34, 56])
    })

    it('should accept Uint8Array', () => {
      const arr = new Uint8Array([98, 76, 54, 32])
      const buf = new ShortBuffer(arr)
      expect(rawValue(buf)).to.equalBytes(arr)
    })

    it('should accept another buffer', () => {
      const buf = new ShortBuffer('01234567')
      const anotherBuf = new ShortBuffer(buf)
      expect(rawValue(anotherBuf)).to.equalBytes('01234567')
    })

    it('should accept an object with content and encoding', () => {
      const buf = new ShortBuffer({ hex: 'fedcba98' })
      expect(rawValue(buf)).to.equalBytes('fedcba98')
    })

    it('should accept no-args call', () => {
      const buf = new ShortBuffer()
      expect(rawValue(buf)).to.equalBytes('00000000')
    })

    it('should not accept hex string with invalid length', () => {
      expect(() => new ShortBuffer('123')).to.throw(TypeError, /string/i)
      expect(() => new ShortBuffer('aaaaaaaaaa')).to.throw(TypeError, /string/i)
    })

    it('should not accept hex string with invalid chars', () => {
      expect(() => new ShortBuffer('1234s678')).to.throw(TypeError, /string/i)
      expect(() => new ShortBuffer('123467 ')).to.throw(TypeError, /string/i)
      expect(() => new ShortBuffer('  12 34')).to.throw(TypeError, /string/i)
      expect(() => new ShortBuffer('пять5555')).to.throw(TypeError, /string/i)
    })

    it('should not accept JS array with invalid length', () => {
      expect(() => new ShortBuffer([1, 2])).to.throw(/length/i)
      expect(() => new ShortBuffer([5, 4, 3, 2, 1])).to.throw(/length/i)
    })

    it('should not accept Uint8Array with invalid length', () => {
      let arr = new Uint8Array(3)
      expect(() => new ShortBuffer(arr)).to.throw(/length/i)
      arr = new Uint8Array(10)
      expect(() => new ShortBuffer(arr)).to.throw(/length/i)
    })

    it('should not accept another buffer with invalid length', () => {
      let buf = new LongBuffer()
      expect(() => new ShortBuffer(buf)).to.throw(/length/i)
      buf = new ShortBuffer([1, 2, 3, 4])
      expect(() => new LongBuffer(buf)).to.throw(/length/i)
    })

    it('should not accept an object with content and encoding with invalid content length', () => {
      expect(() => new ShortBuffer({ hex: 'fedcba9' }))
        .to.throw(TypeError, /string/i)
      expect(() => new ShortBuffer({ hex: 'fedcba987' }))
        .to.throw(TypeError, /string/i)
    })

    const invalidInitializers = [
      null,
      true,
      1234567,
      {},
      { hax: 'fedcba90' },
      { hex: 1234 }
    ]

    invalidInitializers.forEach(x => {
      it(`should not accept an invalid-typed initializer ${JSON.stringify(x)}`, () => {
        expect(() => new ShortBuffer(x)).to.throw(TypeError, /invalid/i)
      })
    })
  })

  describe('serialize', () => {
    it('should serialize without modification', () => {
      const buf = new ShortBuffer([1, 2, 3, 4])
      expect(buf.serialize()).to.equalBytes([1, 2, 3, 4])
    })
  })

  describe('toJSON', () => {
    it('should return a hex string', () => {
      const buf = new ShortBuffer([1, 2, 254, 4])
      expect(buf.toJSON()).to.equal('0102fe04')
    })
  })

  describe('toString', () => {
    it('should return a full short buffer', () => {
      const buf = new ShortBuffer([1, 2, 254, 4])
      expect(buf.toString()).to.equal('Buffer(0102fe04)')
    })

    it('should shorten long buffer', () => {
      const buf = new LongBuffer()
      expect(buf.toString()).to.equal('Buffer(00000000...)')
    })
  })
})
