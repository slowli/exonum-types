/* eslint-env mocha */

import { List } from 'immutable'
import chai from 'chai'
import chaiBytes from 'chai-bytes'
import dirtyChai from 'dirty-chai'

import std from '../../src/std'
import { heapStart, serialize } from '../../src/lowlevel/segments'

const expect = chai
  .use(chaiBytes)
  .use(dirtyChai)
  .expect

describe('segments', () => {
  describe('heapStart', () => {
    it('should perform correctly for fixed-length types', () => {
      let start = heapStart([std.Uint32, std.Int8])
      expect(start).to.equal(5)
      start = heapStart([std.resolve({ buffer: 128 }), std.Int8, std.Bool])
      expect(start).to.equal(128 + 1 + 1)
    })

    it('should perform correctly for var-length types', () => {
      const start = heapStart([std.Str, std.Str])
      expect(start).to.equal(16)
    })

    it('should perform correctly for combination of fixed- and var-length types', () => {
      const start = heapStart([std.PublicKey, std.Str, std.Bool, std.Str])
      expect(start).to.equal(32 + 8 + 1 + 8)
    })
  })

  describe('serialize', () => {
    it('should work without specifying the heapPos', () => {
      let objs = [std.Uint32.from(132), std.Bool.FALSE]
      let types = List.of(std.Uint32, std.Bool)
      let buffer = new Uint8Array(5)
      expect(serialize(buffer, objs, types)).to.equalBytes('84000000' + '00')

      objs = [std.Uint32.from(132), std.Str.from('abc'), std.Bool.FALSE]
      types = List.of(std.Uint32, std.Str, std.Bool)
      buffer = new Uint8Array(16)
      expect(serialize(buffer, objs, types)).to.equalBytes(
        '84000000' + // first object
        '0d000000' + '03000000' + // segment pointing to the string
        '00' + // boolean
        '616263' // encoded string
      )
    })

    it('should work specifying heapPos', () => {
      let objs = [std.Uint32.from(132), std.Bool.FALSE]
      let types = List.of(std.Uint32, std.Bool)
      let buffer = new Uint8Array(5)
      expect(serialize(buffer, objs, types, { heapPos: 5 })).to.equalBytes('84000000' + '00')

      objs = [std.Uint32.from(132), std.Str.from('abc'), std.Bool.FALSE]
      types = List.of(std.Uint32, std.Str, std.Bool)
      buffer = new Uint8Array(16)
      expect(serialize(buffer, objs, types, { heapPos: 13 })).to.equalBytes(
        '84000000' + // first object
        '0d000000' + '03000000' + // segment pointing to the string
        '00' + // boolean
        '616263' // encoded string
      )
    })

    it('should throw on under-allocation of memory', () => {
      let objs = [std.Uint32.from(132), std.Bool.FALSE]
      let types = List.of(std.Uint32, std.Bool)
      let buffer = new Uint8Array(4) // 5 bytes needed
      expect(() => serialize(buffer, objs, types)).to.throw(/under-allocation/i)

      objs = [std.Uint32.from(132), std.Str.from('abc'), std.Bool.FALSE]
      types = List.of(std.Uint32, std.Str, std.Bool)
      buffer = new Uint8Array(15) // the correct length is 4 + 8 + 1 + 3 = 16
      expect(() => serialize(buffer, objs, types)).to.throw(/under-allocation/i)
    })

    it('should throw on over-allocation of memory', () => {
      let objs = [std.Uint32.from(132), std.Bool.FALSE]
      let types = [std.Uint32, std.Bool]
      let buffer = new Uint8Array(6) // 5 bytes needed
      expect(() => serialize(buffer, objs, types)).to.throw(/over-allocation/i)

      objs = [std.Uint32.from(132), std.Str.from('abc'), std.Bool.FALSE]
      types = [std.Uint32, std.Str, std.Bool]
      buffer = new Uint8Array(17)
      expect(() => serialize(buffer, objs, types)).to.throw(/over-allocation/i)
    })

    it('should throw on incorrect specification of the heapPos', () => {
      const objs = [std.Uint32.from(132), std.Str.from('abc'), std.Bool.FALSE]
      const types = [std.Uint32, std.Str, std.Bool]
      const buffer = new Uint8Array(4 + 8 + 1 + 3)
      let heapPos = 12 // the correct value is 4 + 8 + 1 = 13
      expect(() => serialize(buffer, objs, types, { heapPos })).to.throw(/main segment.*does not match.*heap/i)
      heapPos = 14
      expect(() => serialize(buffer, objs, types, { heapPos })).to.throw(/main segment.*does not match.*heap/i)
    })
  })
})
