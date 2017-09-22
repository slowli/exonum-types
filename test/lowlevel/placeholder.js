/* eslint-env mocha */

import chai from 'chai'
import dirtyChai from 'dirty-chai'

import placeholder from '../../src/lowlevel/placeholder'
import Str from '../../src/lowlevel/Str'
import Bool from '../../src/lowlevel/Bool'

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
    it('should describe the target type', () => {
      const P = placeholder('Foo', Str.typeTag())
      expect(P.inspect()).to.equal('Foo')
      expect(P.typeTag()).to.equal(Str.typeTag())
    })
  })

  describe('equals', () => {
    it('should equal to the main type', () => {
      const P = placeholder('Str', Str.typeTag())
      expect(P.equals(Str)).to.be.true()
      expect(Str.equals(P)).to.be.true()
    })
  })

  describe('replaceBy', () => {
    it('should fail on multiple invocations', () => {
      const P = placeholder('Str', Str.typeTag())
      P.replaceBy(Str)
      expect(() => P.replaceBy(Str)).to.throw(/replace/)
    })

    it('should allow to instantiate the type', () => {
      const P = placeholder('Str', Str.typeTag())
      P.replaceBy(Str)
      expect(new P('abc')).to.be.instanceof(Str)
      expect(P.from('def')).to.be.instanceof(Str)
      expect(P.inspect()).to.equal('Str')
      expect(P.equals(Str)).to.be.true()
      expect(Str.equals(P)).to.be.true()
    })

    it('should differentiate among different placeholders', () => {
      const P1 = placeholder('Str', Str.typeTag())
      const P2 = placeholder('Bool', Bool.typeTag())
      P1.replaceBy(Str)
      expect(P1.equals(Str)).to.be.true()
      expect(P2.equals(Str)).to.be.false()
      P2.replaceBy(Bool)
      expect(P1.equals(Str)).to.be.true()
      expect(P2.equals(Str)).to.be.false()
      expect(P2.equals(Bool)).to.be.true()
    })
  })
})
