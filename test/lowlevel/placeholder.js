/* eslint-env mocha */

import chai from 'chai'
import dirtyChai from 'dirty-chai'

import placeholder from '../../src/lowlevel/placeholder'

const expect = chai
  .use(dirtyChai)
  .expect

describe('placeholder', () => {
  it('should create a new placeholder each time', () => {
    expect(placeholder()).to.not.equal(placeholder())
  })

  describe('typeLength', () => {
    it('should return undefined', () => {
      const P = placeholder()
      expect(P.typeLength()).to.be.undefined()
    })
  })

  describe('constructor', () => {
    it('should throw', () => {
      const P = placeholder()
      expect(() => new P()).to.throw(/placeholder/i)
    })
  })

  describe('inspect', () => {
    it('should describe the type', () => {
      const P = placeholder()
      expect(P.inspect()).to.equal('Placeholder')
    })
  })

  describe('replaceBy', () => {
    it('should emit `replace` event', (done) => {
      const P = placeholder()
      P.on('replace', (type) => {
        expect(type).to.equal('foo')
        done()
      })
      P.replaceBy('foo')
    })
  })
})
