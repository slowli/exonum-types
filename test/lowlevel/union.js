/* eslint-env mocha */

import chai from 'chai'
import chaiBytes from 'chai-bytes'
import dirtyChai from 'dirty-chai'

import struct from '../../src/lowlevel/struct'
import union from '../../src/lowlevel/union'
import std from '../../src/std'
import { isExonumObject } from '../../src/lowlevel/common'

const expect = chai
  .use(chaiBytes)
  .use(dirtyChai)
  .expect

describe('union', () => {
  const StrOrInt = union([
    { name: 'str', type: std.Str },
    { name: 'int', type: std.Uint32 }
  ])

  // Not actually a list
  const ListRecord = struct([
    { name: 'head', type: std.Uint32 },
    { name: 'tail', type: std.Str }
  ])
  const List = union([
    { name: 'none', type: std.None },
    { name: 'some', type: ListRecord }
  ])

  const EmbeddedUnion = union([
    { name: 'union', type: StrOrInt },
    { name: 'bool', type: std.Bool }
  ])

  const UnionWithMarker = union({
    marker: 'kind',
    variants: [
      { name: 'int', type: std.Int32 },
      { name: 'bool', type: std.Bool }
    ]
  })

  describe('constructor', () => {
    it('should parse spec', () => {
      expect(StrOrInt).to.be.a('function')
      expect(StrOrInt.int).to.be.a('function')
      expect(StrOrInt.str).to.be.a('function')
    })

    it('should calculate byteLength', () => {
      expect(StrOrInt.typeLength()).to.be.undefined()
    })

    it('should instantiate from an object', () => {
      const x = new StrOrInt({ str: 'Hello world' })
      expect(x.type).to.equal('str')
      expect(x.str).to.equal('Hello world')
    })

    it('should instantiate from a variant shortcut', () => {
      const x = StrOrInt.str('Hello world')
      expect(x.type).to.equal('str')
      expect(x.str).to.equal('Hello world')
    })

    it('should instantiate from an object with embedded type declaration', () => {
      const x = new List({
        type: 'some',
        head: 15,
        tail: 'not actually a tail'
      })

      expect(x.some.toJSON()).to.deep.equal({ head: 15, tail: 'not actually a tail' })
    })

    it('should instantiate from an object with custom marker', () => {
      const x = UnionWithMarker.from({ kind: 'int', hex: 'ff' })
      expect(x.int).to.equal(255)
    })

    it('should throw if an object does not contain allowed variant tags', () => {
      expect(() => new StrOrInt({ bool: false })).to.throw(TypeError, /invalid/i)
    })

    it('should throw if a marker declaration does not have allowed variant tag', () => {
      expect(() => new StrOrInt({ type: 'bool', dec: '1' })).to.throw(TypeError, /invalid/i)
    })

    it('should throw if the custom marker is not specified', () => {
      // The marker is `kind`, but we have supplied default `type`
      expect(() => UnionWithMarker.from({ type: 'int', hex: 'ffffffff' })).to.throw(/invalid.*init/i)
    })
  })

  describe('byteLength', () => {
    it('should work in the basic case', () => {
      let x = new StrOrInt({ str: 'Hello world' })
      expect(x.byteLength()).to.equal(1 + 11)
      x = StrOrInt.int(123)
      expect(x.byteLength()).to.equal(1 + 4)
    })

    it('should work for union with embedded sequence', () => {
      const lst = {
        type: 'some',
        head: 15,
        tail: 'not actually a tail'
      }
      const x = new List(lst)
      expect(x.byteLength()).to.equal(1 + 4 + 8 + lst.tail.length)
      // 8 is for the segment pointer for the string
    })

    it('should work for union with embedded union', () => {
      const x = new EmbeddedUnion({
        union: {
          int: {
            dec: '1020304'
          }
        }
      })

      expect(x.byteLength()).to.equal(1 + 1 + 4)
    })
  })

  describe('value', () => {
    it('should return raw value for integers', () => {
      const x = StrOrInt.int(123)
      expect(x.int).to.be.a('number')
    })

    it('should return raw value for strings', () => {
      const x = StrOrInt.str('123')
      expect(x.str).to.be.a('string')
    })

    it('should return raw value for buffers', () => {
      const BufferUnion = std.resolve({
        union: [
          { name: 'buf', type: { fixedBuffer: 8 } },
          { name: 'u64', type: std.Uint64 }
        ]
      })

      const x = BufferUnion.buf('0011223344556677')
      expect(x.buf).to.be.a('uint8array')
      expect(x.buf[1]).to.equal(0x11)
    })

    it('should return unmodified value for structs', () => {
      const StructUnion = union([
        {
          name: 'point',
          type: struct([
            { name: 'x', type: std.Int32 },
            { name: 'y', type: std.Int32 }
          ])
        },
        { name: 'u64', type: std.Uint64 }
      ])

      const x = new StructUnion({ point: [5, -3] })
      expect(x.point).to.satisfy(isExonumObject)
      expect(x.point.get('x')).to.equal(5)
    })
  })

  describe('get', () => {
    it('should return raw value for integers', () => {
      const x = StrOrInt.int(123)
      expect(x.get('int')).to.be.a('number')
    })

    it('should return raw value for strings', () => {
      const x = StrOrInt.str('123')
      expect(x.get('str')).to.be.a('string')
    })

    it('should return `undefined` for unspecified variants', () => {
      let x = StrOrInt.int(123)
      expect(x.get('str')).to.be.undefined()
      x = StrOrInt.str('123')
      expect(x.get('int')).to.be.undefined()
    })

    it('should return unmodified value for structs', () => {
      const StructUnion = union([
        {
          name: 'point',
          type: struct([
            { name: 'x', type: std.Int32 },
            { name: 'y', type: std.Int32 }
          ])
        },
        { name: 'u64', type: std.Uint64 }
      ])

      const x = new StructUnion({ point: [5, -3] })
      expect(x.get('point')).to.satisfy(isExonumObject)
    })
  })

  describe('getOriginal', () => {
    it('should return original value for integers', () => {
      const x = StrOrInt.int(123)
      expect(x.getOriginal('int')).to.satisfy(isExonumObject)
      expect(+x.getOriginal('int')).to.equal(123)
    })

    it('should return original value for strings', () => {
      const x = StrOrInt.str('123')
      expect(x.getOriginal('str')).to.satisfy(isExonumObject)
      expect(x.getOriginal('str').toString()).to.equal('123')
    })

    it('should return undefined for other variants', () => {
      const x = StrOrInt.str('123')
      expect(x.getOriginal('int')).to.be.undefined()
    })
  })

  describe('match', () => {
    it('should throw if invoked not with an object', () => {
      let x = StrOrInt.str('123')

      const invalidMatchers = [ false, 5, 'abcd', null ]
      invalidMatchers.forEach(invalid => {
        expect(() => x.match(invalid)).to.throw(/matcher should be an object/i)
      })
    })

    it('should not try to invoke the variant handle if it is not a function', () => {
      let x = StrOrInt.str('123')
      expect(x.match({
        str: 123,
        int: () => { throw new Error('This should not be invoked!') }
      })).to.be.undefined()
    })

    it('should not try to invoke the sink handle if it is not a function', () => {
      let x = StrOrInt.str('123')
      expect(x.match({
        str: 123,
        int: () => { throw new Error('This should not be invoked!') },
        _: 'bar'
      })).to.be.undefined()
    })

    it('should invoke the matching method handle', (done) => {
      let x = StrOrInt.str('123')
      x.match({
        str (str) { expect(str).to.equal('123'); done() },
        int () { throw new Error('This should not be invoked!') }
      })
    })

    it('should be usable for descructuring variants', (done) => {
      const x = List.some({ head: 42, tail: '...' })
      x.match({
        some ({ head, tail }) {
          expect(head).to.equal(42)
          expect(tail).to.equal('...')
          done()
        },
        none () { throw new Error('not as planned') }
      })
    })

    it('should invoke the sink handle if there is no matching variant', (done) => {
      const x = new StrOrInt({ int: 25 })
      x.match({
        str (str) { throw new Error('This should not be invoked!') },
        _ (int) { expect(int).to.equal(25); done() }
      })
    })

    it('should return a value', () => {
      const RealList = std.resolver.addTypes([{
        name: 'List',
        union: [
          { name: 'none', type: 'None' },
          {
            name: 'some',
            type: {
              struct: [
                { name: 'head', type: 'Str' },
                { name: 'tail', type: 'List' }
              ]
            }
          }
        ]
      }]).resolve('List')

      let lst = RealList.from({ some: ['foo', { some: ['bar', { none: null }] }] })
      let elems = []
      while (lst) {
        lst = lst.match({
          some: ({ head, tail }) => { elems.push(head); return tail }
        })
      }
      expect(elems).to.deep.equal(['foo', 'bar'])
      expect(lst).to.be.undefined()
    })
  })

  describe('matchOriginal', () => {
    it('should invoke the matching method handle with original Exonum-typed object', (done) => {
      let x = StrOrInt.int(123)
      x.matchOriginal({
        str (str) { throw new Error('This should not be invoked!') },
        int (int) {
          expect(int).to.satisfy(isExonumObject)
          expect(+int).to.equal(123)
          done()
        }
      })
    })
  })

  describe('serialize', () => {
    it('should serialize as a marker + variant in the basic case', () => {
      const x = new StrOrInt({ int: 255 })
      expect(x.serialize()).to.equalBytes('01ff000000')
    })

    it('should serialize in the basic case for var-length variant', () => {
      const x = new StrOrInt({ str: 'ABC' })
      expect(x.serialize()).to.equalBytes('00414243')
    })

    it('should serialize as a marker + variant for embedded types', () => {
      let x = new List({ some: [ 256, 'ABC' ] })
      expect(x.serialize()).to.equalBytes('01' + // marker
        '00010000' + // head
        '0c000000' + '03000000' + // segment pointer to the tail
        '414243' // tail
      )

      x = new List({ none: null })
      expect(x.serialize()).to.equalBytes('00')
    })
  })

  describe('toJSON', () => {
    it('should work in the basic case', () => {
      let x = new StrOrInt({ str: 'Hello world' })
      expect(x.toJSON()).to.deep.equal({ str: 'Hello world' })
      x = StrOrInt.int(123)
      expect(x.toJSON()).to.deep.equal({ int: 123 })
    })

    it('should work for union with embedded union', () => {
      const lst = {
        some: {
          head: 15,
          tail: 'not actually a tail'
        }
      }
      const x = new List(lst)
      expect(x.toJSON()).to.deep.equal(lst)
    })

    it('should work for union with embedded union', () => {
      const x = new EmbeddedUnion({
        union: {
          int: {
            dec: '1020304'
          }
        }
      })
      expect(x.toJSON()).to.deep.equal({
        union: { int: 1020304 }
      })
    })
  })

  describe('toString', () => {
    it('should work in basic case', () => {
      let x = new StrOrInt({ str: 'Hello world' })
      expect(x.toString()).to.equal('str(Hello world)')
      x = StrOrInt.int(123)
      expect(x.toString()).to.equal('int(123)')
    })

    it('should work with complex variants', () => {
      const x = new EmbeddedUnion({
        union: {
          int: {
            dec: '1020304'
          }
        }
      })
      expect(x.toString()).to.equal('union(int(1020304))')
    })
  })
})
