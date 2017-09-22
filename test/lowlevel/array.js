/* eslint-env mocha */

import chai from 'chai'
import chaiBytes from 'chai-bytes'
import dirtyChai from 'dirty-chai'

import { isExonumType, isExonumObject } from '../../src/lowlevel/common'
import array from '../../src/lowlevel/array'
import std from '../../src/std'

const expect = chai
  .use(chaiBytes)
  .use(dirtyChai)
  .expect

describe('array', () => {
  const EUint8Array = array(std.Uint8)
  const StrArray = array(std.Str)
  const BoolArray = array(std.Bool)
  const StructArray = array(std.resolve({
    struct: [
      { name: 'x', type: 'Uint32' },
      { name: 'y', type: 'Uint32' }
    ]
  }))

  const jsSamples = [
    [EUint8Array, [0, 1, 255, 3]],
    [StrArray, ['a', 'foo', 'бар']],
    [BoolArray, [true, false, true, true, true, true]]
  ]

  it('should parse type spec', () => {
    [EUint8Array, StrArray, BoolArray, StructArray].forEach(Type => {
      expect(Type).to.satisfy(isExonumType)
    })
  })

  describe('constructor', () => {
    it('should create an empty array', () => {
      const x = new StrArray()
      expect(x.count()).to.equal(0)
    })

    jsSamples.forEach(({ 0: Type, 1: arr }) => {
      it(`should support native JS array for ${Type.inspect()}`, () => {
        const x = new Type(arr)
        expect(x).to.satisfy(isExonumObject)
        expect(x.count()).to.equal(arr.length)
        arr.forEach((el, i) => expect(x.get(i)).to.equal(el))
      })
    })

    it('should support native JS array for StructArray', () => {
      const x = new StructArray([{ x: 10, y: 20 }, [50, 60]])
      expect(x).to.satisfy(isExonumObject)
      expect(x.count()).to.equal(2)
      expect(x.get(0).x).to.equal(10)
      expect(x.get(0).y).to.equal(20)
      expect(x.get(1).toJSON()).to.deep.equal({ x: 50, y: 60 })
    })

    const invalidInitializers = [
      ['string', 'foo'],
      ['boolean', true],
      ['uint8array', new Uint8Array(10)],
      ['object', { 1: 'bar' }],
      ['function', () => {}]
    ]

    invalidInitializers.forEach(({ 0: name, 1: val }) => {
      it(`should throw on invalid initializer ${name}`, () => {
        expect(() => new EUint8Array(val)).to.throw(/invalid.*initializer/i)
      })
    })
  })

  describe('serialize', () => {
    it('should serialize array with constant element size', () => {
      const x = new EUint8Array([32, 48, 255, 0, 0, 1])
      expect(x.serialize()).to.equalBytes(
        '06000000' + // array length
        '2030ff000001' // elements
      )
    })

    it('should serialize array with variable element size', () => {
      const x = new StrArray(['abc', 'AA'])
      expect(x.serialize()).to.equalBytes(
        '02000000' + // array length
        '14000000' + '03000000' + // segment for the first string
        '17000000' + '02000000' + // segment for the second string
        '616263' + // first string
        '4141' // second string
      )
    })
  })

  describe('toJSON', () => {
    jsSamples.forEach(({ 0: Type, 1: arr }) => {
      it(`should support native JS array for ${Type.inspect()}`, () => {
        const x = new Type(arr)
        expect(x.toJSON()).to.deep.equal(arr)
      })
    })

    it('should support native JS array for StructArray', () => {
      const x = new StructArray([{ x: 10, y: 20 }, [50, 60]])
      expect(x.toJSON()).to.deep.equal([{ x: 10, y: 20 }, { x: 50, y: 60 }])
    })
  })

  describe('toList', () => {
    it('should return list with primitive values when possible', () => {
      const x = new StrArray([ 'foo', 'bar' ])
      expect(x.toList().count()).to.equal(2)
      expect(x.toList().get(0)).to.equal('foo')
      expect(x.toList().get(1)).to.equal('bar')
    })

    it('should return list with original values for complex elements', () => {
      const x = new StructArray([ [1, 2], [3, 4], [5, 6] ])
      expect(x.toList().count()).to.equal(3)
      expect(x.toList()).to.satisfy(lst => lst.every(isExonumObject))
    })
  })

  describe('toOriginalList', () => {
    it('should return list with original elements even for coercible element types', () => {
      const x = new StrArray([ 'foo', 'bar' ])
      const lst = x.toOriginalList()
      expect(lst.count()).to.equal(2)
      expect(lst).to.satisfy(l => l.every(isExonumObject))
    })
  })

  describe('static equals', () => {
    it('should assert array equality correctly', () => {
      expect(StrArray.equals(StrArray)).to.be.true()
      expect(StrArray.equals(BoolArray)).to.be.false()

      const OtherStrArray = std.resolve({ array: 'Str' })
      expect(StrArray.equals(OtherStrArray)).to.be.true()

      const OtherStructArray = std.resolve({
        array: {
          struct: [
            { name: 'x', type: 'Uint32' },
            { name: 'y', type: { uinteger: 4 } }
          ]
        }
      })
      expect(OtherStructArray.equals(StructArray)).to.be.true()
    })
  })
})
