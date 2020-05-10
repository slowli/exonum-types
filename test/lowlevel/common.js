/* eslint-env mocha */

import chai from 'chai'
import dirtyChai from 'dirty-chai'

import {
  isExonumFactory, isExonumType, isExonumObject,
  memoize,
  createType
} from '../../src/lowlevel/common'
import initFactory from '../../src/lowlevel/initFactory'
import std from '../../src'

const expect = chai
  .use(dirtyChai)
  .expect

describe('isExonumFactory', () => {
  const nonFactories = [
    ['null', null],
    ['boolean', true],
    ['undefined', undefined],
    ['string', 'abc'],
    ['number', 5],
    ['object', {}],
    ['array', [1, 2]],
    ['function', () => 100]
  ]

  nonFactories.forEach(({ 0: name, 1: obj }) => {
    it(`should recognize ${name} as non-factory`, () => {
      expect(isExonumFactory(obj)).to.be.false()
    })
  })

  it('should mark factories created with initFactory()', () => {
    const factory = initFactory(() => std.Int64)
    expect(isExonumFactory(factory)).to.be.true()
  })

  const standardFactories = [
    'struct',
    'array',
    'union',
    'option',
    'message',
    'MapView',
    'ListView'
  ]

  standardFactories.forEach(name => {
    it(`should recognize standard factory ${name}`, () => {
      expect(std[name]).to.satisfy(isExonumFactory)
    })
  })
})

describe('isExonumType', () => {
  const nonTypes = [
    ['null', null],
    ['boolean', true],
    ['undefined', undefined],
    ['string', 'abc'],
    ['number', 5],
    ['object', {}],
    ['array', [1, 2]],
    ['function', () => 100]
  ]

  nonTypes.forEach(({ 0: name, 1: obj }) => {
    it(`should recognize ${name} as non-type`, () => {
      expect(isExonumType(obj)).to.be.false()
    })
  })

  it('should recognize type created with createType()', () => {
    const SomeType = createType({ name: 'SomeType' })
    expect(SomeType).to.satisfy(isExonumType)
    expect(new SomeType()).to.not.satisfy(isExonumType)
  })

  const standardTypes = [
    'Uint8',
    'Int64',
    'Bool',
    'None',
    'PublicKey'
  ]

  standardTypes.forEach(name => {
    it(`should recognize standard type ${name}`, () => {
      expect(std[name]).to.satisfy(isExonumType)
    })
  })

  it('should recognize factory-produced types', () => {
    expect(std.fixedBuffer(32)).to.satisfy(isExonumType)
    expect(std.struct([
      { name: 'foo', type: { array: 'Str' } },
      { name: 'bar', type: 'PublicKey' }
    ])).to.satisfy(isExonumType)
  })
})

describe('isExonumObject', () => {
  const nonObjects = [
    ['null', null],
    ['boolean', true],
    ['undefined', undefined],
    ['string', 'abc'],
    ['number', 5],
    ['object', {}],
    ['array', [1, 2]],
    ['function', () => 100]
  ]

  nonObjects.forEach(({ 0: name, 1: obj }) => {
    it(`should recognize ${name} as non-object`, () => {
      expect(isExonumObject(obj)).to.be.false()
    })
  })

  it('should recognize instances of built-in types', () => {
    expect(new std.Int32('12345')).to.satisfy(isExonumObject)
    expect(std.Str.from('Hello, world!')).to.satisfy(isExonumObject)
  })

  it('should recognize instances of custom types', () => {
    const SomeType = createType({ name: 'SomeType' })
    expect(new SomeType()).to.satisfy(isExonumObject)
  })
})

describe('memoize', () => {
  it('should memoize function result', () => {
    let counter = 0
    let fn = () => { counter++; return 'foo' }
    fn = memoize(fn)

    const obj = {}

    for (let i = 0; i < 10; i++) {
      expect(fn.call(obj)).to.equal('foo')
    }
    expect(counter).to.equal(1)
  })

  it('should allocate multiple slots on the same object', () => {
    let fooCtr = 0
    let barCtr = 0
    const obj = {
      _foo: 5,
      _bar: 'abc',
      foo () { fooCtr++; return this._foo },
      bar () { barCtr++; return this._bar }
    }

    obj.foo = memoize(obj.foo)
    obj.bar = memoize(obj.bar)

    for (let i = 0; i < 10; i++) {
      expect(obj.foo()).to.equal(5)
      expect(obj.bar()).to.equal('abc')
    }
    expect(fooCtr).to.equal(1)
    expect(barCtr).to.equal(1)
  })
})

describe('createType', () => {
  it('should create type with unimplemented toJSON() and _doSerialize() methods', () => {
    const SomeType = createType({ name: 'SomeType' })
    expect(SomeType).to.satisfy(isExonumType)
    expect(SomeType.toString()).to.equal('SomeType')
    expect(SomeType.inspect()).to.equal('SomeType')
    expect(() => new SomeType().toJSON()).to.throw(/Not implemented.*toJSON/)
    expect(() => new SomeType().serialize()).to.throw(/Not implemented.*_doSerialize/)
  })
})
