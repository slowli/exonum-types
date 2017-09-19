/* eslint-env mocha */

import chai from 'chai'
import chaiBytes from 'chai-bytes'
import dirtyChai from 'dirty-chai'

import None from '../../src/lowlevel/None'

const expect = chai
  .use(chaiBytes)
  .use(dirtyChai)
  .expect

describe('None', () => {
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
