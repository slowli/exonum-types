/* eslint-env mocha */

import chai from 'chai'
import chaiBytes from 'chai-bytes'
import dirtyChai from 'dirty-chai'

import option from '../../src/lowlevel/option'
import struct from '../../src/lowlevel/struct'
import std from '../../src/std'

const expect = chai
  .use(chaiBytes)
  .use(dirtyChai)
  .expect

describe('option', function () {
  const MaybeStr = option(std.Str)

  const List = option(struct([
    { name: 'head', type: std.Uint32 },
    { name: 'tail', type: std.Str }
  ]))

  describe('constructor', function () {
    it('should parse spec', function () {
      expect(MaybeStr).to.be.a('function')
      expect(List).to.be.a('function')
    })

    it('should calculate type length', function () {
      expect(MaybeStr.typeLength()).to.be.undefined()
    })

    it('should instantiate from an object', function () {
      const x = new MaybeStr('Hello world')
      expect('' + x.some).to.equal('Hello world')
    })

    it('should instantiate from null', function () {
      const x = new MaybeStr(null)
      expect(x.type).to.equal('none')
    })

    it('should instantiate from explicit undefined', function () {
      const x = new MaybeStr(undefined)
      expect(x.type).to.equal('none')
    })

    it('should instantiate from implicit undefined', function () {
      const x = new MaybeStr()
      expect(x.type).to.equal('none')
    })

    it('should instantiate for complex wrapped type', function () {
      const x = new List({ head: 1, tail: 'tail' })
      expect(x.some.head).to.equal(1)
      expect(x.some.tail).to.equal('tail')
    })
  })

  describe('toJSON', function () {
    it('should return the internal value if it is set', function () {
      const x = new MaybeStr('abc')
      expect(x.toJSON()).to.equal('abc')
    })

    it('should return the internal value if it is set, with the wrapped type', function () {
      const x = new List({ head: 1, tail: 'tail' })
      expect(x.toJSON()).to.deep.equal({ head: 1, tail: 'tail' })
    })
  })

  describe('serialize', function () {
    it('should serialize as a single zero byte if not set', function () {
      const x = new MaybeStr(null)
      expect(x.serialize()).to.equalBytes('00')
    })

    it('should serialize as a 0x01 + wrapped value if set', function () {
      const x = new MaybeStr('ABC')
      expect(x.serialize()).to.equalBytes('01414243')
    })
  })

  it('should work as a field (simple case)', function () {
    const Type = struct([
      { name: 'list', type: List },
      { name: 'len', type: std.Uint32 }
    ])

    let x = new Type([ null, 3 ])
    expect(x.list.type).to.equal('none')
    x = x.set('list', [ 42, '!' ])
    expect(x.list.some.head).to.equal(42)
    expect(x.list.some.tail).to.equal('!')
  })
})
