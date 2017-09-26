/* eslint-env mocha */

import chai from 'chai'
import chaiBytes from 'chai-bytes'
import dirtyChai from 'dirty-chai'

import Bool from '../../src/lowlevel/Bool'
import { rawValue } from '../../src/lowlevel/common'

const expect = chai
  .use(chaiBytes)
  .use(dirtyChai)
  .expect

describe('Bool', function () {
  it('should declare byteLength 1', () => {
    expect(Bool.typeLength()).to.equal(1)
  })

  it('should declare true contant', () => {
    expect(rawValue(Bool.TRUE)).to.be.true()
  })

  it('should declare false contant', () => {
    expect(rawValue(Bool.FALSE)).to.be.false()
  })

  describe('constructor', () => {
    it('should accept JS boolean', () => {
      let x = new Bool(true)
      expect(rawValue(x)).to.be.true()
      x = new Bool(false)
      expect(rawValue(x)).to.be.false()
    })

    it('should accept another Bool', () => {
      let x = new Bool(Bool.TRUE)
      expect(rawValue(x)).to.be.true()
      x = new Bool(Bool.FALSE)
      expect(rawValue(x)).to.be.false()
    })

    it('should not accept anything else', () => {
      const unacceptable = [
        [], {}, () => {}, null, undefined, '', 'true', 5, NaN
      ]

      unacceptable.forEach(x => {
        expect(() => new Bool(x)).to.throw(/cannot construct Bool/i)
      })
    })
  })

  describe('serialize', () => {
    it('should serialize false as [0]', () => {
      expect(Bool.FALSE.serialize()).to.equalBytes('00')
    })

    it('should serialize true as [1]', () => {
      expect(Bool.TRUE.serialize()).to.equalBytes('01')
    })
  })

  describe('toJSON', () => {
    it('should return raw value', () => {
      expect(Bool.TRUE.toJSON()).to.be.true()
      expect(Bool.FALSE.toJSON()).to.be.false()
    })
  })
})
