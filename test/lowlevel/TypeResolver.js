/* eslint-env mocha */

import chai from 'chai'
import chaiBytes from 'chai-bytes'
import dirtyChai from 'dirty-chai'

import TypeResolver, { dummyResolver, validateAndResolveFields } from '../../src/lowlevel/TypeResolver'
import Str from '../../src/lowlevel/Str'
import array from '../../src/lowlevel/array'
import fixedBuffer from '../../src/lowlevel/fixedBuffer'
import { integer, uinteger } from '../../src/lowlevel/integers'
import option from '../../src/lowlevel/option'
import struct from '../../src/lowlevel/struct'
import union from '../../src/lowlevel/union'
import { isExonumType } from '../../src/lowlevel/common'

const expect = chai
  .use(chaiBytes)
  .use(dirtyChai)
  .expect

const FACTORIES = {
  array,
  integer,
  uinteger,
  fixedBuffer,
  buffer: fixedBuffer,
  option,
  struct,
  union,
  enum: union
}

describe('TypeResolver', () => {
  let resolver

  beforeEach(() => {
    resolver = new TypeResolver()
  })

  it('should fail on inadmissible native type', () => {
    expect(() => resolver.addNativeType('foo', String)).to.throw(/Exonum type/i)
    expect(() => resolver.addNativeTypes({ 'Foo': uinteger(3), String })).to.throw(/Exonum type/i)
  })

  it('should fail on adding native type with existing name', () => {
    resolver = resolver.addNativeType('Foo', uinteger(3))
    expect(() => resolver.addNativeType('Foo', uinteger(1))).to.throw(/Foo.*exists/)
    expect(() => resolver.addNativeTypes({ Foo: uinteger(1) })).to.throw(/Foo.*exists/)
  })

  it('should fail on adding type with existing name', () => {
    resolver = resolver.addNativeType('Foo', uinteger(3))
      .addFactories({ uinteger })
    expect(() => resolver.addTypes([
      { name: 'Foo', uinteger: 2 }
    ])).to.throw(/Foo.*exists/)
  })

  it('should fail on inadmissible factory', () => {
    const factory = () => 42
    expect(() => resolver.addFactory(factory)).to.throw(/initFactory/)
    expect(() => resolver.addFactories({ factory })).to.throw(/initFactory/)
  })

  it('should fail on adding factory with existing name', () => {
    resolver = resolver.addFactories(FACTORIES)
    expect(() => resolver.addFactory('enum', uinteger)).to.throw(/enum.*exists/i)
    expect(() => resolver.addFactories({ enum: uinteger })).to.throw(/enum.*exists/i)
  })

  it('should fail on unknown type name', () => {
    expect(() => resolver.addFactory('struct', struct)
      .addTypes([{
        name: 'Struct',
        struct: [
          { name: 'foo', type: 'Bar' }
        ]
      }])).to.throw(/Unknown.*Bar/i)
  })

  it('should fail on unknown factory', () => {
    // The `uinteger` factory is not enabled
    expect(() => resolver.addTypes([
      { name: 'Uint8', uinteger: 1 }
    ])).to.throw(/factory/i)
  })

  it('should create integer type', () => {
    resolver = resolver.addFactories({ integer, uinteger })
      .addTypes([
        { name: 'Uint8', uinteger: 1 }
      ])

    const Uint8 = resolver.resolve('Uint8')

    expect(Uint8.typeLength()).to.equal(1)
    expect(+Uint8.from(25)).to.equal(25)
    expect(+Uint8.from('33')).to.equal(33)
    expect(() => Uint8.from(-1)).to.throw(/range/i)
  })

  it('should create multiple integer types', () => {
    resolver = resolver.addFactories({ integer, uinteger })
      .addTypes([
        { name: 'Uint8', uinteger: 1 },
        { name: 'Int64', integer: 8 }
      ])

    const Uint8 = resolver.resolve('Uint8')
    const Int64 = resolver.resolve('Int64')

    expect(Uint8.typeLength()).to.equal(1)
    expect(+Uint8.from(25)).to.equal(25)
    expect(Int64.typeLength()).to.equal(8)
    expect(Int64.from('12345678987654321').toJSON()).to.equal('12345678987654321')
  })

  it('should memoize integer types', () => {
    resolver = resolver.addFactories({ integer, uinteger })
      .addTypes([
        { name: 'Uint8', uinteger: 1 },
        { name: 'Int64', integer: 8 },
        { name: 'Foo', uinteger: 1 }
      ])

    expect(resolver.resolve('Foo')).to.equal(resolver.resolve('Uint8'))
  })

  it('should memoize integer types when added iteratively', () => {
    resolver = resolver.addFactories({ integer, uinteger })
      .addTypes([
        { name: 'Uint8', uinteger: 1 },
        { name: 'Int64', integer: 8 }
      ])
      .addTypes([
        { name: 'Foo', uinteger: 1 }
      ])

    expect(resolver.resolve('Foo')).to.equal(resolver.resolve('Uint8'))
  })

  it('should memoize fixedBuffer types', () => {
    resolver = resolver.addFactories({ fixedBuffer })
      .addTypes([
        { name: 'PublicKey', fixedBuffer: 32 },
        { name: 'Hash', fixedBuffer: 32 }
      ])

    expect(resolver.resolve('PublicKey')).to.equal(resolver.resolve('Hash'))
  })

  it('should compute known named types', () => {
    resolver = resolver.addFactories({ integer, uinteger })
      .addTypes([
        { name: 'Uint8', uinteger: 1 },
        { name: 'Int64', integer: 8 }
      ])

    expect(resolver.namedTypes().toObject()).to.deep.equal({
      Uint8: resolver.resolve('Uint8'),
      Int64: resolver.resolve('Int64')
    })
  })

  it('should not return anonymous types as known', () => {
    resolver = resolver.addFactories({ array, uinteger })
      .addTypes([
        { name: 'EUint32Array', array: { uinteger: 4 } }
      ])

    // This creates 2 anonymous types, `uinteger<4>` and `array<uinteger<4>>`

    expect(resolver.namedTypes().toObject()).to.deep.equal({
      EUint32Array: resolver.resolve('EUint32Array')
    })
  })

  it('should return curried named factories', () => {
    resolver = resolver.addFactories({ array, uinteger })
    const factories = resolver.namedFactories().toObject()

    expect(factories).to.have.property('array').that.is.a('function')
    expect(factories).to.have.property('uinteger').that.is.a('function')

    // Test that the factory is bound to the resolver, i.e., resolves string types
    const EUint16Array = factories.array({ uinteger: 2 })
    expect(EUint16Array.from([255, 32767, 0]).serialize()).to.equalBytes('03000000ff00ff7f0000')
  })

  it('should create a struct type', () => {
    resolver = resolver.addFactories({ struct, uinteger })
      .addTypes([{
        name: 'Timespec',
        struct: [
          { name: 'seconds', type: { uinteger: 8 } },
          { name: 'nanos', type: { uinteger: 4 } }
        ]
      }])

    const Timespec = resolver.resolve('Timespec')

    expect(Timespec.typeLength()).to.equal(12)
    expect(Timespec.from([ 1400000000, 90000000 ]).toJSON()).to.deep.equal({
      seconds: 1400000000,
      nanos: 90000000
    })
  })

  it('should parse type spec with known types', () => {
    resolver = resolver.addFactories(FACTORIES)
      .addNativeTypes({
        Str,
        PublicKey: fixedBuffer(32),
        Uint64: uinteger(8),
        Hash: fixedBuffer(32)
      }).addTypes([{
        name: 'Wallet',
        struct: [
          { name: 'pubkey', type: 'PublicKey' },
          { name: 'name', type: 'Str' },
          { name: 'balance', type: 'Uint64' },
          { name: 'history_hash', type: 'Hash' }
        ]
      }])

    const Wallet = resolver.resolve('Wallet')

    const json = {
      pubkey: 'f5864ab6a5a2190666b47c676bcf15a1f2f07703c5bcafb5749aa735ce8b7c36',
      name: 'Smart wallet',
      balance: 359120,
      history_hash: '6752be882314f5bbbc9a6af2ae634fc07038584a4a77510ea5eced45f54dc030'
    }
    const wallet = Wallet.from(json)

    expect(wallet.pubkey).to.equalBytes('f5864ab6a5a2190666b47c676bcf15a1f2f07703c5bcafb5749aa735ce8b7c36')
    expect(wallet.name).to.equal('Smart wallet')
    expect(wallet.balance).to.equal(359120)
    expect(wallet.history_hash).to.equalBytes('6752be882314f5bbbc9a6af2ae634fc07038584a4a77510ea5eced45f54dc030')
    expect(wallet.toJSON()).to.deep.equal(json)
  })

  it('should parse recursive type spec', function () {
    resolver = resolver.addFactories(FACTORIES)
      .addNativeType('Uint32', uinteger(4))
      .addTypes([{
        name: 'List',
        option: {
          struct: [
            { name: 'head', type: 'Uint32' },
            { name: 'tail', type: 'List' }
          ]
        }
      }])

    const List = resolver.resolve('List')

    List.prototype.elements = function () {
      const elements = []
      let list = this
      while (list.type === 'some') {
        elements.push(list.some.head)
        list = list.some.tail
      }
      return elements
    }

    const lst = List.from([0, [1, [2, null]]])
    expect(lst.elements()).to.deep.equal([0, 1, 2])
  })

  it('should fail on non-sensical type spec', () => {
    expect(() => resolver.resolve(5)).to.throw(/invalid.*spec/i)
  })
})

describe('dummyResolver', () => {
  const dummy = dummyResolver()

  it('should resolve Exonum types to themselves', () => {
    expect(dummy.resolve(Str)).to.equal(Str)
  })

  it('should fail to resolve non-Exonum types', () => {
    expect(() => dummy.resolve({ uinteger: 2 })).to.throw(/Exonum type expected/)
  })
})

describe('validateAndResolveFields', () => {
  const resolver = new TypeResolver()
    .addNativeTypes({ Str, Foo: uinteger(4) })

  it('should convert types in field specification', () => {
    const spec = [
      { name: 'foo', type: 'Foo' },
      { name: 'bar', type: 'Str' },
      { name: 'baz', type: option(integer(6)) }
    ]
    const parsedSpec = validateAndResolveFields(spec, resolver)

    expect(parsedSpec).to.not.equal(spec)
    parsedSpec.forEach(({ name, type }, i) => {
      expect(name).to.equal(spec[i].name)
      expect(type).to.satisfy(isExonumType)
    })
  })

  it('should fail on an unnamed field', () => {
    const spec = [
      { name: 'foo', type: 'Foo' },
      { noName: 'bar', type: 'Str' }
    ]

    expect(() => validateAndResolveFields(spec, resolver)).to.throw(/no.*name/i)
  })

  it('should fail on an untyped field', () => {
    const spec = [
      { name: 'foo', noType: 'Foo' },
      { noName: 'bar', type: 'Str' }
    ]

    expect(() => validateAndResolveFields(spec, resolver)).to.throw(/no.*type/i)
  })

  it('should fail on a duplicate field', () => {
    const spec = [
      { name: 'foo', type: 'Foo' },
      { name: 'foo', type: 'Str' }
    ]

    expect(() => validateAndResolveFields(spec, resolver)).to.throw(/redefined/i)
  })
})
