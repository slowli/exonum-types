/* eslint-env mocha */

import chai from 'chai'
import chaiBytes from 'chai-bytes'
import dirtyChai from 'dirty-chai'

import Str from '../../src/lowlevel/Str'
import { rawValue } from '../../src/lowlevel/common'

const expect = chai
  .use(chaiBytes)
  .use(dirtyChai)
  .expect

describe('str', function () {
  it('should declare variable length', function () {
    expect(Str.typeLength()).to.be.undefined()
  })

  describe('constructor', function () {
    it('should accept string', function () {
      const s = new Str('abcdef')
      expect(rawValue(s)).to.equal('abcdef')
    })

    it('should accept non-ASCII string', function () {
      const s = new Str('абцдеф')
      expect(rawValue(s)).to.equal('абцдеф')
    })

    it('should accept another Str', function () {
      const s = new Str('abc')
      expect(rawValue(new Str(s))).to.equal('abc')
    })
  })

  describe('byteLength', function () {
    it('should calculate length correctly for ASCII strings', function () {
      const s = new Str('a12!@#')
      expect(s.byteLength()).to.equal(6)
    })

    it('should calculate length correctly for 2-byte UTF-8 strings', function () {
      const s = new Str('абцдеф')
      expect(s.byteLength()).to.equal(12)
    })

    it('should calculate length correctly for 3-byte UTF-8 strings', function () {
      const s = new Str('愛')
      expect(s.byteLength()).to.equal(3)
    })

    it('should calculate length correctly for 4-byte UTF-8 strings', function () {
      const s = new Str('😆')
      expect(s.byteLength()).to.equal(4)
    })

    it('should calculate length correctly for mixed-length UTF-8 strings', function () {
      const s = new Str('悔しい😆 !!')
      expect(s.byteLength()).to.equal(9 + 4 + 3)
    })
  })

  describe('serialize', function () {
    it('should serialize ASCII strings', function () {
      const s = new Str('ABC')
      expect(s.serialize()).to.equalBytes([65, 66, 67])
    })

    it('should serialize non-ASCII strings', function () {
      const s = new Str('👌хД')
      expect(s.serialize()).to.equalBytes([0xf0, 0x9f, 0x91, 0x8c, 0xd1, 0x85, 0xd0, 0x94])
    })
  })

  describe('toJSON', function () {
    it('should return an original string', function () {
      const s = new Str('abc')
      expect(s.toJSON()).to.equal('abc')
    })
  })
})
