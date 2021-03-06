/* eslint-env mocha */

import bigInt from 'big-integer'
import { List } from 'immutable'
import chai from 'chai'
import chaiBytes from 'chai-bytes'
import dirtyChai from 'dirty-chai'

import { isExonumType, isExonumObject } from '../../src/lowlevel/common'
import struct from '../../src/lowlevel/struct'
import std from '../../src/std'

const expect = chai
  .use(chaiBytes)
  .use(dirtyChai)
  .expect

describe('struct', () => {
  const Type = struct([
    { name: 'foo', type: std.Uint32 },
    { name: 'bar', type: std.Int64 }
  ])

  const VarType = struct([
    { name: 'str', type: std.Str },
    { name: 'foo', type: std.Uint8 }
  ])

  const ComplexType = struct([
    { name: 'a', type: std.Int16 },
    { name: 'b', type: VarType },
    { name: 'c', type: std.Str }
  ])

  const Wallet = struct([
    { name: 'pubkey', type: std.PublicKey },
    { name: 'name', type: std.Str },
    { name: 'balance', type: std.Uint64 },
    { name: 'history_hash', type: std.Hash }
  ])

  const StructWithOption = std.resolve({
    struct: [
      { name: 'foo', type: std.Uint32 },
      { name: 'bar', type: std.option(std.Int64) }
    ]
  })

  describe('inspect', () => {
    it('should describe simple struct', () => {
      expect(Type.inspect()).to.equal('[Uint32, Int64]')
    })

    it('should describe simple struct', () => {
      expect(Wallet.inspect()).to.equal('[Buffer<32>, Str, Uint64, Buffer<32>]')
    })

    it('should describe complex struct', () => {
      expect(ComplexType.inspect()).to.equal('[Int16, [Str, Uint8], Str]')
    })
  })

  describe('constructor', () => {
    it('should parse spec', () => {
      expect(Type).to.satisfy(isExonumType)
      expect(Type.meta().factoryName).to.equal('struct')
      expect(Type.meta().fields).to.deep.equal([
        { name: 'foo', type: std.Uint32 },
        { name: 'bar', type: std.Int64 }
      ])
    })

    it('should retain additional meta in field spec', () => {
      const TypeWithMeta = struct([
        { name: 'foo', type: std.Uint32, transient: true },
        { name: 'bar', type: std.PublicKey, author: true }
      ])

      expect(TypeWithMeta.meta().fields[0].transient).to.be.true()
      expect(TypeWithMeta.meta().fields[1].author).to.be.true()
    })

    it('should calculate type length', () => {
      expect(Type.typeLength()).to.equal(12)
      expect(VarType.typeLength()).to.be.undefined()
    })

    it('should instantiate from an object', () => {
      const x = new Type({
        foo: 12,
        bar: -344666
      })
      expect(x).to.have.property('foo')
      expect(x).to.have.property('bar')
      expect(x.foo).to.equal(12)
      expect(x.bar).to.equal(-344666)
    })

    it('should instantiate from an array', () => {
      const x = new Type([12, -30000])
      expect(x).to.have.property('foo')
      expect(x).to.have.property('bar')
      expect(x.foo).to.equal(12)
      expect(x.bar).to.equal(-30000)
    })

    it('should support struct-typed properties', () => {
      const ComplexType = struct([
        { name: 'complex', type: Type },
        { name: 'simple', type: std.Int64 }
      ])

      const x = new ComplexType([
        new Type([1, -2]),
        new std.Int64(25)
      ])
      expect(x).to.have.property('complex')
      expect(x).to.have.property('simple')
      expect(x.complex).to.have.property('foo')
      expect(x.complex).to.have.property('bar')
      expect(x.complex.foo).to.equal(1)
      expect(x.complex.bar).to.equal(-2)
      expect(x.simple).to.equal(25)
    })

    it('should support object assignment of struct-typed properties', () => {
      const ComplexType = struct([
        { name: 'complex', type: Type },
        { name: 'simple', type: std.Int64 }
      ])

      const x = new ComplexType({
        complex: {
          foo: 1,
          bar: -2
        },
        simple: 25
      })
      expect(x.complex.foo).to.equal(1)
      expect(x.complex.bar).to.equal(-2)
      expect(x.simple).to.equal(25)
    })

    it('should support partial assignement through object', () => {
      // As option types support `undefined` initialization, they can be omitted when
      // used as fields in structs
      const x = new StructWithOption({ foo: 11 })
      expect(x.foo).to.equal(11)
      expect(x.bar.type).to.equal('none')
    })

    it('should support partial assignement through array', () => {
      const x = new StructWithOption([ 11 ])
      expect(x.foo).to.equal(11)
      expect(x.bar.type).to.equal('none')
    })

    it('should parse wallet from JSON', () => {
      const json = {
        pubkey: 'f5864ab6a5a2190666b47c676bcf15a1f2f07703c5bcafb5749aa735ce8b7c36',
        name: 'Smart wallet',
        balance: '359120',
        history_hash: '6752be882314f5bbbc9a6af2ae634fc07038584a4a77510ea5eced45f54dc030'
      }
      const wallet = new Wallet(json)

      expect(wallet.pubkey).to.equalBytes('f5864ab6a5a2190666b47c676bcf15a1f2f07703c5bcafb5749aa735ce8b7c36')
      expect(wallet.name).to.equal('Smart wallet')
      expect(wallet.balance).to.equal(359120)
      expect(wallet.history_hash).to.equalBytes('6752be882314f5bbbc9a6af2ae634fc07038584a4a77510ea5eced45f54dc030')
      expect(wallet.toJSON()).to.deep.equal(json)
    })
  })

  describe('get', () => {
    it('should return values of defined properties', () => {
      const x = new Type([1, -2])
      expect(x.get('foo')).to.equal(1)
      expect(x.get('bar')).to.equal(-2)
    })

    it('should return undefined for undefined properties', () => {
      const x = new Type([1, -2])
      expect(x.get('bazz')).to.be.undefined()
      expect(x.get('get')).to.be.undefined()
      expect(x.get('set')).to.be.undefined()
      expect(x.get('hasContsantLength')).to.be.undefined()
    })
  })

  describe('getOriginal', () => {
    it('should return an Exonum-typed object', () => {
      const x = new Type([1, -2])
      expect(x.getOriginal('foo')).to.satisfy(isExonumObject)
      expect(x.getOriginal('bar')).to.satisfy(isExonumObject)
      expect(+x.getOriginal('foo')).to.equal(1)
    })
  })

  describe('set', () => {
    it('should set defined properties', () => {
      let x = new Type([1, -2])
      x = x.set('foo', 5)
      expect(x.foo).to.equal(5)
      x = x.set('foo', '256765')
      expect(x.foo).to.equal(256765)
    })

    it('should throw for undefined properties', () => {
      const x = new Type([1, -2])
      expect(() => x.set('bazz', 5)).to.throw(Error, /property/i)
      expect(() => x.set('get', 5)).to.throw(Error, /property/i)
      expect(() => x.set('set', 5)).to.throw(Error, /property/i)
    })

    it('should support property writes with various coercible types', () => {
      let x = new Type([12, -344666])
      x = x.set('foo', 23)
      expect(x.foo).to.equal(23)
      x = x.set('foo', '42')
      expect(x.foo).to.equal(42)
      x = x.set('foo', bigInt('111'))
      expect(x.foo).to.equal(111)
      x = x.set('foo', new std.Uint32(57566))
      expect(x.foo).to.equal(57566)
    })

    it('should throw for out-of-range assignments of integer properties', () => {
      let x = new Type([12, -344666])
      expect(() => { x.set('foo', 5000000000) }).to.throw()
      expect(() => { x.set('foo', x.foo - 13) }).to.throw()
      expect(() => { x.set('foo', x.foo * x.bar) }).to.throw()
    })
  })

  describe('byteLength', () => {
    it('should count segments in var-length types', () => {
      const x = new VarType(['ABC', 55])
      expect(x.byteLength()).to.equal(8 + 1 + 3)
    })

    it('should count all segments in embedded var-length types', () => {
      const x = new ComplexType({
        a: -10,
        b: {
          str: 'ABC',
          foo: 55
        },
        c: 'f00'
      })
      expect(x.byteLength()).to.equal(2 + (8 + (8 + 1 + 3)) + (8 + 3))
    })
  })

  describe('serialize', () => {
    it('should serialize a fixed-length type', () => {
      const x = new Type([1, -2])
      expect(x.serialize()).to.equalBytes([1, 0, 0, 0, 254, 255, 255, 255, 255, 255, 255, 255])
    })

    it('should serialize a var-length type', () => {
      const x = new VarType(['ABC', 55])
      expect(x.serialize()).to.equalBytes([
        9, 0, 0, 0, // segment start
        3, 0, 0, 0, // segment length
        55, // x.bar
        65, 66, 67 // x.foo
      ])
    })

    it('should serialize a complex var-length type', () => {
      const x = new ComplexType({
        a: -10,
        b: {
          str: 'cabbage',
          foo: 16
        },
        c: 'f00'
      })

      expect(x.serialize()).to.equalBytes([
        // offset: contents
        /*  0: */ 0xf6, 0xff, // x.a
        /*  2: */ 18, 0, 0, 0, // segment for x.b
        /*  6: */ 16, 0, 0, 0,
        /* 10: */ 34, 0, 0, 0, // segment for x.c
        /* 14: */ 3, 0, 0, 0,

        // start x.b
        /* 18: */ 9, 0, 0, 0, // segment for x.b.str
        /* 22: */ 7, 0, 0, 0,
        /* 26: */ 16, // x.b.foo
        /* 27: */ 99, 97, 98, 98, 97, 103, 101, // x.b.str
        // end x.b

        /* 34: */ 102, 48, 48 // x.c
      ])
    })

    it('should serialize a type with several var-length properties', () => {
      const Type = struct([
        { name: 'foo', type: std.Str },
        { name: 'bar', type: std.Str }
      ])

      const x = new Type(['ABC', '----'])
      expect(x.serialize()).to.equalBytes([
        16, 0, 0, 0, // segment for x.foo
        3, 0, 0, 0,
        19, 0, 0, 0, // segment for x.bar
        4, 0, 0, 0,
        65, 66, 67, // x.foo
        45, 45, 45, 45 // x.bar
      ])
    })

    it('should serialize wallet type', () => {
      const wallet = new Wallet({
        pubkey: 'f5864ab6a5a2190666b47c676bcf15a1f2f07703c5bcafb5749aa735ce8b7c36',
        name: 'Smart wallet',
        balance: 359120,
        history_hash: '6752BE882314F5BBBC9A6AF2AE634FC07038584A4A77510EA5ECED45F54DC030'
      })

      expect(wallet.serialize()).to.equalBytes([
        245, 134, 74, 182, 165, 162, 25, 6, 102, 180, 124, 103, 107, 207, 21, 161,
        242, 240, 119, 3, 197, 188, 175, 181, 116, 154, 167, 53, 206, 139, 124, 54,
        80, 0, 0, 0, 12, 0, 0, 0, 208, 122, 5, 0, 0, 0, 0, 0, 103, 82, 190, 136, 35,
        20, 245, 187, 188, 154, 106, 242, 174, 99, 79, 192, 112, 56, 88, 74, 74, 119,
        81, 14, 165, 236, 237, 69, 245, 77, 192, 48, 83, 109, 97, 114, 116, 32, 119,
        97, 108, 108, 101, 116
      ])
    })
  })

  describe('toJSON', () => {
    it('should work for simple struct type', () => {
      const obj = { foo: 5, bar: '-1000' }
      const x = new Type(obj)
      expect(x.toJSON()).to.deep.equal(obj)
    })

    it('should work for hierarchical struct type', () => {
      const obj = {
        a: -10,
        b: {
          str: 'cabbage',
          foo: 16
        },
        c: 'f00'
      }

      const x = new ComplexType(obj)
      expect(x.toJSON()).to.deep.equal(obj)
    })
  })

  describe('toString', () => {
    it('should yield expected result for simple struct', () => {
      const x = new Type({ foo: 5, bar: -1000 })
      expect(x.toString()).to.equal('{ foo: 5, bar: -1000 }')
    })

    it('should yield expected result for complex struct', () => {
      const x = new ComplexType({
        a: -10,
        b: {
          str: 'cabbage',
          foo: 16
        },
        c: 'f00'
      })
      expect(x.toString()).to.equal('{ a: -10, b: { str: cabbage, foo: 16 }, c: f00 }')
    })
  })

  describe('typeTag', () => {
    it('should be defined', () => {
      expect(Type.typeTag).to.be.a('function')
    })

    it('should yield a list', () => {
      const lst = List.of('struct',
        List.of('foo', std.Uint32, 'bar', std.Int64))
      expect(lst.equals(Type.typeTag())).to.be.true()
    })
  })

  describe('static hashCode', () => {
    it('should proxy typeTag hashCode', () => {
      expect(Type.hashCode()).to.equal(Type.typeTag().hashCode())
    })
  })

  describe('static equals', () => {
    it('should structurually determine type equality', () => {
      expect(Type.equals(Type)).to.be.true()
      expect(Type.equals(ComplexType)).to.be.false()
      expect(ComplexType.equals(Type)).to.be.false()

      let OtherType = struct([
        { name: 'foo', type: std.Uint32 },
        { name: 'bar', type: std.Int64 }
      ])

      expect(Type.equals(OtherType)).to.be.true()
      expect(OtherType.equals(Type)).to.be.true()
      expect(ComplexType.equals(OtherType)).to.be.false()
      expect(OtherType.equals(ComplexType)).to.be.false()

      OtherType = std.resolve({
        struct: [
          { name: 'foo', type: 'Uint32' },
          { name: 'bar', type: 'Int64' }
        ]
      })

      expect(Type.equals(OtherType)).to.be.true()
      expect(OtherType.equals(Type)).to.be.true()
      expect(ComplexType.equals(OtherType)).to.be.false()
      expect(OtherType.equals(ComplexType)).to.be.false()
    })

    it('should structurually determine type equality in complex case', () => {
      const OtherType = std.resolve({
        struct: [
          { name: 'a', type: 'Int16' },
          {
            name: 'b',
            type: {
              struct: [
                { name: 'str', type: 'Str' },
                { name: 'foo', type: 'Uint8' }
              ]
            }
          },
          { name: 'c', type: 'Str' }
        ]
      })

      expect(OtherType.equals(ComplexType)).to.be.true()
    })
  })

  describe('hashCode', () => {
    it('should return identical values for equal structs', () => {
      const obj1 = Type.from([1, 2])
      const obj2 = Type.from([1, 2])
      expect(obj1.hashCode()).to.equal(obj2.hashCode())

      const OtherType = struct([
        { name: 'foo', type: std.Uint32 },
        { name: 'bar', type: std.Uint8 }
      ])

      // Integer types are compared by value
      expect(OtherType.from([1, 2]).hashCode()).to.equal(obj1.hashCode())
    })
  })

  describe('equals', () => {
    it('should make struct incomparable to simple JS objects', () => {
      const obj1 = Type.from([1, 2])
      const obj2 = { foo: 1, bar: 2 }
      expect(obj1.equals(obj2)).to.be.false()
    })

    it('should structurally compare structs', () => {
      const obj1 = Type.from([1, 2])
      const obj2 = Type.from([1, 2])
      expect(obj1.equals(obj2)).to.be.true()
      expect(obj2.equals(obj1)).to.be.true()
    })

    it('should compare structs with fields having synonymous types', () => {
      const StructWithPubkey = struct([
        { name: 'val', type: std.PublicKey },
        { name: 'comment', type: std.Str }
      ])
      const StructWithHash = struct([
        { name: 'val', type: std.Hash },
        { name: 'comment', type: std.Str }
      ])

      const json = {
        val: '0000000000000000000000000000000000000000000000000000000000000000',
        comment: 'testing equality'
      }
      const pkObj = StructWithPubkey.from(json)
      const hashObj = StructWithHash.from(json)

      expect(pkObj.equals(hashObj)).to.be.true()
      expect(hashObj.equals(pkObj)).to.be.true()
    })

    it('should compare structs with fields having different types', () => {
      const StructWithPubkey = struct([
        { name: 'val', type: std.PublicKey },
        { name: 'comment', type: std.Str }
      ])
      const StructWithStr = struct([
        { name: 'val', type: std.Str },
        { name: 'comment', type: std.Str }
      ])

      const json = {
        val: '0000000000000000000000000000000000000000000000000000000000000000',
        comment: 'testing equality'
      }
      const pkObj = StructWithPubkey.from(json)
      const strObj = StructWithStr.from(json)

      expect(pkObj.equals(strObj)).to.be.false()
      expect(strObj.equals(pkObj)).to.be.false()
    })

    it('should compare embedded structs', () => {
      const obj1 = ComplexType.from({ a: -1, b: { str: 'str', foo: 0 }, c: 'c' })
      const obj2 = ComplexType.from([-1, ['str', { hex: '0' }], 'c'])

      expect(obj1.hashCode()).to.equal(obj2.hashCode())
      expect(obj1.equals(obj2)).to.be.true()
      expect(obj2.equals(obj1)).to.be.true()
    })
  })
})
