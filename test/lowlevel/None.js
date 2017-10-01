/* eslint-env mocha */

import chai from 'chai'
import chaiBytes from 'chai-bytes'
import dirtyChai from 'dirty-chai'

import None from '../../src/lowlevel/None'
import { isExonumObject } from '../../src/lowlevel/common'

const expect = chai
  .use(chaiBytes)
  .use(dirtyChai)
  .expect

describe('None', () => {
  describe('constructor', () => {
    it('should support undefined', () => {
      expect(None.from()).to.satisfy(isExonumObject)
    })

    it('should support null', () => {
      expect(None.from(null)).to.satisfy(isExonumObject)
    })

    const invalidInitializers = [
      ['string', 'abcdef'],
      ['number', 555],
      ['boolean', true],
      ['object', {}],
      ['array', [1, 2]]
    ]

    invalidInitializers.forEach(({ 0: name, 1: val }) => {
      it(`should throw on invalid initializer (${name})`, () => {
        expect(() => new None(val)).to.throw(/Invalid None initializer/i)
      })
    })
  })

  describe('typeLength', () => {
    it('should be equal to 0', () => {
      expect(None.typeLength()).to.equal(0)
    })
  })

  describe('serialize', () => {
    it('should serialize None instance to an empty buffer', () => {
      expect(new None().serialize()).to.equalBytes('')
    })
  })

  describe('toJSON', () => {
    it('should convert None to null', () => {
      expect(new None().toJSON()).to.be.null()
    })
  })
})
