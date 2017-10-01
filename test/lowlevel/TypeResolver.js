/* eslint-env mocha */

import chai from 'chai'
import chaiBytes from 'chai-bytes'
import dirtyChai from 'dirty-chai'

import TypeResolver, { dummyResolver, validateAndResolveFields } from '../../src/lowlevel/TypeResolver'
import initFactory from '../../src/lowlevel/initFactory'
import Bool from '../../src/lowlevel/Bool'
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
    expect(() => resolver.add({ name: 'Foo', uinteger: 2 })).to.throw(/Foo.*exists/)
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

  it('should fail on definition with undefined name', () => {
    resolver = resolver.addFactories(FACTORIES)
    expect(() => resolver.add({ uinteger: 2 })).to.throw(/name not specified/i)
    expect(() => resolver.add({
      factory: {
        typeParams: [{ name: 'T' }],
        array: { typeParam: 'T' }
      }
    })).to.throw(/name not specified/i)
  })

  it('should fail on unknown type name', () => {
    expect(() => resolver.addFactory('array', array)
      .resolve({ array: 'Foo' })).to.throw(/Unknown.*\bFoo\b/i)

    expect(() => resolver.addFactory('struct', struct)
      .add({
        name: 'Struct',
        struct: [
          { name: 'foo', type: 'Bar' }
        ]
      })).to.throw(/Unknown.*\bBar\b/i)
  })

  it('should fail on unknown factory', () => {
    // The `uinteger` factory is not enabled here
    expect(() => resolver.resolve({ uinteger: 1 })).to.throw(/factory.*\buinteger\b/i)
    expect(() => resolver.add({ name: 'Uint8', uinteger: 1 })).to.throw(/factory.*\buinteger\b/i)
  })

  it('should fail on invalid type spec', () => {
    expect(() => resolver.addFactories(FACTORIES).add({
      name: 'Uint8', uinteger: 1, foo: 'bar'
    })).to.throw(/expected an object with.*1 key/)
  })

  it('should fail on non-sensical type spec', () => {
    expect(() => resolver.resolve(5)).to.throw(/invalid.*spec/i)
  })

  it('should create integer type', () => {
    resolver = resolver.addFactories({ integer, uinteger })
      .add({ name: 'Uint8', uinteger: 1 })

    const Uint8 = resolver.resolve('Uint8')

    expect(Uint8.typeLength()).to.equal(1)
    expect(+Uint8.from(25)).to.equal(25)
    expect(+Uint8.from('33')).to.equal(33)
    expect(() => Uint8.from(-1)).to.throw(/range/i)
  })

  it('should create multiple integer types', () => {
    resolver = resolver.addFactories({ integer, uinteger })
      .add([
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
      .add([
        { name: 'Uint8', uinteger: 1 },
        { name: 'Int64', integer: 8 },
        { name: 'Foo', uinteger: 1 }
      ])

    expect(resolver.resolve('Foo')).to.equal(resolver.resolve('Uint8'))
  })

  it('should memoize integer types when added iteratively', () => {
    resolver = resolver.addFactories({ integer, uinteger })
      .add([
        { name: 'Uint8', uinteger: 1 },
        { name: 'Int64', integer: 8 }
      ])
      .add({ name: 'Foo', uinteger: 1 })

    expect(resolver.resolve('Foo')).to.equal(resolver.resolve('Uint8'))
  })

  it('should memoize fixedBuffer types', () => {
    resolver = resolver.addFactories({ fixedBuffer })
      .add([
        { name: 'PublicKey', fixedBuffer: 32 },
        { name: 'Hash', fixedBuffer: 32 }
      ])

    expect(resolver.resolve('PublicKey')).to.equal(resolver.resolve('Hash'))
  })

  it('should compute known named types', () => {
    resolver = resolver.addFactories({ integer, uinteger })
      .add([
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
      .add({ name: 'EUint32Array', array: { uinteger: 4 } })

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
      .add({
        name: 'Timespec',
        struct: [
          { name: 'seconds', type: { uinteger: 8 } },
          { name: 'nanos', type: { uinteger: 4 } }
        ]
      })

    const Timespec = resolver.resolve('Timespec')

    expect(Timespec.typeLength()).to.equal(12)
    expect(Timespec.from([ 1400000000, 90000000 ]).toJSON()).to.deep.equal({
      seconds: '1400000000',
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
      }).add({
        name: 'Wallet',
        struct: [
          { name: 'pubkey', type: 'PublicKey' },
          { name: 'name', type: 'Str' },
          { name: 'balance', type: 'Uint64' },
          { name: 'history_hash', type: 'Hash' }
        ]
      })

    const Wallet = resolver.resolve('Wallet')

    const json = {
      pubkey: 'f5864ab6a5a2190666b47c676bcf15a1f2f07703c5bcafb5749aa735ce8b7c36',
      name: 'Smart wallet',
      balance: '359120',
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
      .add({
        name: 'List',
        option: {
          struct: [
            { name: 'head', type: 'Uint32' },
            { name: 'tail', type: 'List' }
          ]
        }
      })

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

  it('should fail on invalid factory spec', () => {
    resolver = resolver.addNativeType('Uint32', uinteger(4))
      .addFactories(FACTORIES)

    expect(() => resolver.add({
      name: 'Foo',
      factory: {
        option: 'Uint32'
      }
    })).to.throw(/typeParams.*array/)

    expect(() => resolver.add({
      name: 'Foo',
      factory: {
        typeParams: [{ type: '*' }],
        option: 'Uint32'
      }
    })).to.throw(/missing name.*type param/i)
  })

  it('should fail on duplicate factory spec', () => {
    resolver = resolver.addFactories(FACTORIES)

    expect(() => resolver.add({
      name: 'uinteger',
      factory: {
        typeParams: [{ name: 'T' }],
        array: { typeParam: 'T' }
      }
    })).to.throw(/\buinteger\b.*exists/)
  })

  it('should create a type factory from spec', () => {
    resolver = resolver.addNativeType('Uint32', uinteger(4))
      .addFactories(FACTORIES)

    resolver = resolver.add({
      name: 'list',
      factory: {
        typeParams: [{ name: 'T', type: 'type' }],
        option: {
          struct: [
            { name: 'head', type: { typeParam: 'T' } },
            { name: 'tail', type: { list: { typeParam: 'T' } } }
          ]
        }
      }
    })

    expect(resolver.factories.has('list')).to.be.true()

    const StrList = resolver.resolve({ list: Str })
    expect(StrList).to.satisfy(isExonumType)
    expect(StrList.inspect()).to.equal('(None | [Str, list<Str>])')

    expect(new StrList(['foo', ['bar', null]]).toJSON()).to.deep.equal({
      head: 'foo',
      tail: { head: 'bar', tail: null }
    })

    const StructList = resolver.resolve({
      list: {
        struct: [
          { name: 'x', type: 'Uint32' },
          { name: 'y', type: 'Uint32' }
        ]
      }
    })

    expect(StructList).to.satisfy(isExonumType)
    expect(StructList.inspect()).to.equal('(None | [[Uint32, Uint32], list<[Uint32, Uint32]>])')

    // Check caching
    expect(resolver.resolve({ list: Str })).to.equal(StrList)

    const structList = StructList.from({
      head: [5, 6],
      tail: {
        head: [4, 3],
        tail: [[2, 1], null]
      }
    })

    expect(structList.some.head.x).to.equal(5)
    expect(structList.some.head.y).to.equal(6)
    expect(structList.some.tail.some.head.toJSON()).to.deep.equal({ x: 4, y: 3 })

    const SuperList = resolver.resolve({
      list: { list: Str }
    })
    expect(SuperList).to.satisfy(isExonumType)

    const superList = SuperList.from([
      ['abc', null],
      [
        ['def', ['ghi', ['jkl', null]]], null
      ]
    ])

    expect(superList.some.head.toJSON()).to.deep.equal({ head: 'abc', tail: null })
    expect(superList.some.tail.some.head.toJSON()).to.deep.equal({
      head: 'def',
      tail: {
        head: 'ghi',
        tail: { head: 'jkl', tail: null }
      }
    })
  })

  it('should fail on a bogus factory spec', () => {
    resolver = resolver.addFactories(FACTORIES).add({
      name: 'bogus',
      factory: {
        typeParams: [{ name: 'B' }],
        bogus: { array: { typeParam: 'B' } }
      }
    })

    expect(() => resolver.resolve({ bogus: { buffer: 4 } })).to.throw(/rebind type param/)

    // Interestingly, this recursive def is not bogus:
    resolver = resolver.add({
      name: 'notBogus',
      factory: {
        typeParams: [{ name: 'B' }],
        array: { notBogus: { typeParam: 'B' } }
      }
    })

    const XArray = resolver.resolve({ notBogus: { buffer: 4 } })
    // It only supports empty arrays though:
    const arr = XArray.from([[], [], [[], []]])
    expect(arr.count()).to.equal(3)
    expect(arr.get(1).count()).to.equal(0)
    expect(arr.get(2).count()).to.equal(2)
    expect(arr.get(2).get(0).count()).to.equal(0)
  })

  it('should fail on bogus factory', () => {
    const bogusFactory = initFactory((arg) => array(arg), {
      name: 'bogus'
      // Forgot to declare sane `prepare` here
    })

    resolver = resolver.addNativeType('Str', Str)
      .addFactory('bogus', bogusFactory)

    expect(() => resolver.resolve({ bogus: 'Str' })).to.throw(/Exonum type expected/)
  })

  it('should resolve factories using other factories', () => {
    resolver = resolver.addNativeTypes({
      Uint32: uinteger(4)
    }).addFactories(FACTORIES)

    resolver = resolver.add([{
      name: 'point',
      factory: {
        typeParams: [{ name: 'T', type: 'type' }],
        struct: [
          { name: 'x', type: { typeParam: 'T' } },
          { name: 'y', type: { typeParam: 'T' } }
        ]
      }
    }, {
      name: 'wArray',
      factory: {
        typeParams: [{ name: 'T', type: 'type' }],
        array: {
          struct: [
            { name: 'w', type: { uinteger: 8 } },
            { name: 'obj', type: { typeParam: 'T' } }
          ]
        }
      }
    }])

    const WPoints = resolver.resolve({ wArray: { point: 'Uint32' } })
    expect(WPoints).to.satisfy(isExonumType)

    const wPoints = WPoints.from([
      { w: 25, obj: [2, 3] },
      { w: 100, obj: [100, 101] }
    ])

    expect(wPoints.count()).to.equal(2)
    expect(wPoints.get(0).toJSON()).to.deep.equal({ w: '25', obj: { x: 2, y: 3 } })
    expect(wPoints.get(1).serialize()).to.equalBytes(
      '6400000000000000' + // w
      '64000000' + // obj.x
      '65000000' // obj.y
    )

    // Check that Point still works
    const UnionPoint = resolver.resolve({
      point: {
        union: [
          { name: 'u32', type: 'Uint32' },
          { name: 'bool', type: Bool }
        ]
      }
    })
    expect(UnionPoint).to.satisfy(isExonumType)

    const p = new UnionPoint([ { u32: 32767 }, { bool: true } ])
    expect(p.x.type).to.equal('u32')
    expect(p.y.bool).to.be.true()
    expect(p.y.u32).to.be.undefined()
    expect(p.serialize()).to.equalBytes(
      '10000000' + '05000000' + // segment for x
      '15000000' + '02000000' + // segment for y
      '00' + 'ff7f0000' + // marker + x.u32
      '01' + '01' // marker + y.bool
    )
  })

  it('should support type equality for factories', () => {
    resolver = resolver.addFactories(FACTORIES).add([{
      name: 'Uint32',
      uinteger: 4
    }, {
      name: 'list',
      factory: {
        typeParams: [{ name: 'T', type: 'type' }],
        option: {
          struct: [
            { name: 'head', type: { typeParam: 'T' } },
            { name: 'tail', type: { list: { typeParam: 'T' } } }
          ]
        }
      }
    }])

    const Uint32List = resolver.resolve({ list: 'Uint32' })
    const OtherList = resolver.resolve({ list: { uinteger: 4 } })
    const YetAnotherList = resolver.resolve({ list: uinteger(4) })

    expect(Uint32List.equals(Uint32List)).to.be.true()
    expect(Uint32List.equals(OtherList)).to.be.true()
    expect(YetAnotherList.equals(OtherList)).to.be.true()
  })

  it('should be able to instantiate types from factory on the same iteration', () => {
    resolver = resolver.addFactories(FACTORIES).add([{
      name: 'Uint32',
      uinteger: 4
    }, {
      name: 'list',
      factory: {
        typeParams: [{ name: 'T', type: 'type' }],
        option: {
          struct: [
            { name: 'head', type: { typeParam: 'T' } },
            { name: 'tail', type: { list: { typeParam: 'T' } } }
          ]
        }
      }
    }, {
      name: 'Uint32List',
      list: 'Uint32'
    }, {
      name: 'StructListArray',
      array: {
        list: {
          struct: [
            { name: 'x', type: 'Uint32' },
            { name: 'y', type: 'Uint32' }
          ]
        }
      }
    }])

    const Uint32List = resolver.resolve('Uint32List')
    expect(Uint32List).to.satisfy(isExonumType)
    expect(Uint32List.from([45, [100, null]]).toJSON()).to.deep.equal({
      head: 45, tail: { head: 100, tail: null }
    })

    const StructListArray = resolver.resolve('StructListArray')
    expect(StructListArray).to.satisfy(isExonumType)
    const la = StructListArray.from([
      [{ x: 1, y: 2 }, [[3, 4], null]],
      [[5, 6], [[7, 8], [{ x: 9, y: 10 }, null]]]
    ])

    expect(la.count()).to.equal(2)
    expect(la.get(0).some.head.toJSON()).to.deep.equal({ x: 1, y: 2 })
    expect(la.get(1).some.tail.some.head.toJSON()).to.deep.equal({ x: 7, y: 8 })
  })

  it('should be able to parse cross-recursive factory defs', () => {
    resolver = resolver.addFactories(FACTORIES).add([{
      name: 'Hash',
      buffer: 8
    }, {
      name: 'Node',
      factory: {
        typeParams: [{ name: 'T' }],
        union: [
          {
            name: 'branch',
            type: { Branch: { typeParam: 'T' } }
          },
          { name: 'hash', type: 'Hash' },
          { name: 'val', type: { typeParam: 'T' } }
        ]
      }
    }, {
      name: 'Branch',
      factory: {
        typeParams: [{ name: 'T' }],
        struct: [
          { name: 'left', type: { Node: { typeParam: 'T' } } },
          { name: 'right', type: { Node: { typeParam: 'T' } } }
        ]
      }
    }, {
      name: 'Int64Node',
      Node: { integer: 8 }
    }])

    const StrBranch = resolver.resolve({ Branch: Str })
    expect(StrBranch).to.satisfy(isExonumType)

    let branch = StrBranch.from({
      left: { hash: '0001020304050607' },
      right: { val: 'Hello, world' }
    })
    expect(branch.left.type).to.equal('hash')
    expect(branch.right.val).to.equal('Hello, world')
    branch = branch.set('right', {
      branch: {
        left: { val: '!' },
        right: { hash: 'ffffffff00000000' }
      }
    })

    expect(branch.right.type).to.equal('branch')
    expect(branch.right.branch.left.val).to.equal('!')
  })

  it('should be able to parse factories with several params', () => {
    resolver = resolver.addFactories(FACTORIES).add([{
      name: 'Tuple',
      factory: {
        typeParams: [
          { name: 'U' }, { name: 'V' }
        ],
        struct: [
          { name: 'first', type: { typeParam: 'U' } },
          { name: 'second', type: { typeParam: 'V' } }
        ]
      }
    }, {
      name: 'Point',
      factory: {
        typeParams: [{ name: 'T' }],
        Tuple: { U: { typeParam: 'T' }, V: { typeParam: 'T' } }
      }
    }])

    const SITuple = resolver.resolve({ Tuple: { U: Str, V: uinteger(1) } })
    expect(SITuple).to.satisfy(isExonumType)
    expect(SITuple.inspect()).to.equal('[Str, Uint8]')

    const tuple = SITuple.from([ 'foo', 4 ])
    expect(tuple.first).to.equal('foo')
    expect(tuple.second).to.equal(4)

    const I16Point = resolver.resolve({ Point: { integer: 2 } })
    expect(I16Point).to.satisfy(isExonumType)

    const pt = I16Point.from([32, -1])
    expect(pt.serialize()).to.equalBytes('2000' + 'ffff')
  })

  it('should throw on non-existing type parameters', () => {
    const origResolver = resolver

    const tupleDecl = {
      name: 'Tuple',
      factory: {
        typeParams: [
          { name: 'U' }, { name: 'V' }
        ],
        struct: [
          { name: 'first', type: { typeParam: 'U' } },
          { name: 'second', type: { typeParam: 'W' } }
        ]
      }
    }

    resolver = resolver.addFactories(FACTORIES).add([
      { name: 'Int8', integer: 1 },
      tupleDecl
    ])
    expect(() => resolver.resolve({ Tuple: { U: 'Int8', V: 'Int8' } }))
      .to.throw(/not bound.*\bW\b/)
    expect(() => resolver.resolve({ Tuple: { U: 'Int8', W: 'Int8' } }))
      .to.throw(/missing.*\bV\b/i)

    // Correct the tuple declaration
    tupleDecl.factory.struct[1].type.typeParam = 'V'

    resolver = origResolver.addFactories(FACTORIES).add([
      { name: 'Int8', integer: 1 },
      tupleDecl
    ])
    expect(() => resolver.resolve({ Tuple: { U: 'Int8', W: 'Int8' } }))
      .to.throw(/missing.*\bV\b/i)
  })

  it('should throw on type params outside of factory declaration', () => {
    resolver = resolver.addFactories(FACTORIES)
    const msg = /type param outside of factory declaration/i

    expect(() => resolver.resolve({ typeParam: 'U' })).to.throw(msg)
    expect(() => resolver.resolve({ option: { typeParam: 'T' } })).to.throw(msg)

    // Check that it still throws after processing the factory

    resolver = resolver.add({
      name: 'Foo',
      factory: {
        typeParams: [ { name: 'T' } ],
        array: { option: { typeParam: 'T' } }
      }
    })

    const IntFoo = resolver.resolve({ Foo: integer(1) })
    expect(IntFoo).to.satisfy(isExonumType)
    expect(() => resolver.resolve({ typeParam: 'T' })).to.throw(msg)
  })

  it('should fail to extend a non-existing type', () => {
    expect(() => resolver.extend('Foo', (foo) => foo)).to.throw(/Type Foo does not exist/i)
  })

  it('should fail to apply an invalid extension function', () => {
    resolver = resolver.addNativeType('Int8', integer(1))
    expect(() => resolver.extend('Int8', () => {})).to.throw(/extended type.*Exonum type/i)
  })

  it('should extend a type', () => {
    resolver = resolver.addNativeType('Int8', integer(1))
      .extend('Int8', (Int8) => {
        return class extends Int8 {
          static foo () { return `bar${this.typeLength()}` }
        }
      })

    const Int8 = resolver.resolve('Int8')
    expect(Int8).to.satisfy(isExonumType)
    expect(Int8.foo()).to.equal('bar1')
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
