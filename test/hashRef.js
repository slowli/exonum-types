/* eslint-env mocha */

import chai from 'chai'
import chaiBytes from 'chai-bytes'
import dirtyChai from 'dirty-chai'

import std from '../src/std'
import { hash } from '../src/crypto'
import hashRef from '../src/hashRef'

const expect = chai
  .use(chaiBytes)
  .use(dirtyChai)
  .expect

describe('hashRef', () => {
  const ArrayHashRef = hashRef({
    array: {
      struct: [
        { name: 'x', type: 'Int32' },
        { name: 'y', type: 'Int32' }
      ]
    }
  }, std.resolver)
  const TimeSpecHashRef = hashRef('TimeSpec', std.resolver)
  const TxHashRef = hashRef({
    message: {
      serviceId: 1,
      messageId: 129,
      body: [
        { name: 'from', type: 'PublicKey' },
        { name: 'to', type: 'PublicKey' },
        { name: 'amount', type: 'Uint64' }
      ]
    }
  }, std.resolver)

  describe('typeLength', () => {
    it('should be equal to 32', () => {
      expect(ArrayHashRef.typeLength()).to.equal(32)
      expect(TimeSpecHashRef.typeLength()).to.equal(32)
      expect(TxHashRef.typeLength()).to.equal(32)
    })
  })

  describe('meta', () => {
    it('should be declared', () => {
      expect(ArrayHashRef.meta().factoryName).to.equal('hashRef')
      expect(ArrayHashRef.meta().value.meta().factoryName).to.equal('array')
      expect(TxHashRef.meta().value.meta().body.meta().fields[1]).to.deep.equal({ name: 'to', type: std.PublicKey })
    })
  })

  describe('constructor', () => {
    it('should call to the underlying value constructor', () => {
      let ref = ArrayHashRef.from([
        { x: 1, y: -1 },
        { x: 5, y: -5 }
      ])
      expect(ref.value().count()).to.equal(2)
      expect(ref.value().get(1).x).to.equal(5)

      ref = TxHashRef.from({
        body: {
          from: '0000000000000000000000000000000000000000000000000000000000000000',
          to: '0000000000000000000000000000000000000000000000000000000000000001',
          amount: 1000
        }
      })
      expect(ref.value().messageId).to.equal(129)
      expect(ref.value().body.amount).to.equal(1000)
    })

    it('should be called when a hash reference is encountered in another type', () => {
      const StructType = std.struct([
        { name: 'foo', type: ArrayHashRef },
        { name: 'bar', type: 'Str' }
      ])

      const s = StructType.from({
        foo: [ [1, 2], [-3, -4], [5, 6] ],
        bar: 'abcdef'
      })
      expect(s.foo.count()).to.equal(3)
      expect(s.foo.get(1).x).to.equal(-3)
      expect(s.getOriginal('foo')).to.be.instanceof(ArrayHashRef)
      expect(s.bar).to.equal('abcdef')
    })
  })

  describe('hash', () => {
    it('should be computed according to the underlying value', () => {
      const ref = TimeSpecHashRef.from({ secs: '1400000000', nanos: 900000 })
      // Expected serialization of value
      const ser = new Uint8Array([
        0x00, 0x4e, 0x72, 0x53, 0, 0, 0, 0, // `secs` serialization
        0xa0, 0xbb, 0x0d, 0x00 // `nanos serialization`
      ])
      expect(ref.hash()).to.equalBytes(hash(ser))
    })

    it('should use value().hash() if it is present', () => {
      const ListViewRef = hashRef({ listView: { buffer: 8 } }, std.resolver)
      const lst = ListViewRef.from({
        branch: {
          left: { val: '0000000000000000' },
          right: { val: '0101010101010101' }
        }
      })

      // check that the list is constructed correctly
      expect(lst.value().count()).to.equal(2)
      expect(lst.value().get(0)).to.equalBytes('0000000000000000')

      expect(lst.hash()).to.equalBytes(hash(
        hash(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0])),
        hash(new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1]))
      ))
    })
  })

  describe('serialize', () => {
    it('should serialize to the hash of the value', () => {
      const ref = TimeSpecHashRef.from({ secs: '1400000000', nanos: 900000 })
      // Expected serialization of value
      const ser = new Uint8Array([
        0x00, 0x4e, 0x72, 0x53, 0, 0, 0, 0, // `secs` serialization
        0xa0, 0xbb, 0x0d, 0x00 // `nanos serialization`
      ])
      expect(ref.serialize()).to.equalBytes(hash(ser))
    })

    it('should serialize as hash within struct', () => {
      const StructType = std.struct([
        { name: 'foo', type: ArrayHashRef },
        { name: 'bar', type: 'Str' }
      ])

      const s = StructType.from({
        foo: [ [1, 2], [-3, -4], [5, 6] ],
        bar: 'abcdef'
      })

      // Expected array hash
      const h = hash(new Uint8Array([
        3, 0, 0, 0, // array length
        1, 0, 0, 0, 2, 0, 0, 0, // first element
        0xfd, 0xff, 0xff, 0xff, 0xfc, 0xff, 0xff, 0xff, // second element
        5, 0, 0, 0, 6, 0, 0, 0 // first element
      ]))

      const serialization = s.serialize()
      expect(serialization.subarray(0, 32)).to.equalBytes(h)
      expect(serialization.subarray(32)).to.equalBytes([
        40, 0, 0, 0, 6, 0, 0, 0, // segment pointer
        97, 98, 99, 100, 101, 102 // string
      ])
    })

    it('should serialize using value().hash() if it is present', () => {
      const ListViewRef = hashRef({ listView: { buffer: 8 } }, std.resolver)
      const StructWithList = std.struct([
        { name: 'name', type: 'Str' },
        { name: 'list', type: ListViewRef },
        { name: 'age', type: 'Uint8' }
      ])

      const rec = StructWithList.from({
        name: 'Alice',
        list: {
          branch: {
            left: { val: '0102030405060708' },
            right: { val: '0807060504030201' }
          }
        },
        age: 30
      })

      // Check that the structure is OK
      expect(rec.name).to.equal('Alice')
      expect(rec.list.count()).to.equal(2)
      expect(rec.list.get(1)).to.equalBytes('0807060504030201')

      const s = rec.serialize()
      expect(s.subarray(0, 8)).to.equalBytes([41, 0, 0, 0, 5, 0, 0, 0]) // segment pointer to `name`
      expect(s.subarray(8, 40)).to.equalBytes(hash( // hash ref for `list`
        hash(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])),
        hash(new Uint8Array([8, 7, 6, 5, 4, 3, 2, 1]))
      ))
      expect(s.subarray(40)).to.equalBytes([
        30, // `age`
        65, 108, 105, 99, 101 // 'Alice'
      ])
    })
  })

  describe('toJSON', () => {
    it('should serialize as underlying value', () => {
      const ref = TimeSpecHashRef.from({ secs: '1400000000', nanos: 900000 })
      expect(ref.toJSON()).to.deep.equal({ secs: '1400000000', nanos: 900000 })
    })

    it('should serialize as underlying value within another type', () => {
      const StructType = std.struct([
        { name: 'foo', type: ArrayHashRef },
        { name: 'bar', type: 'Str' }
      ])

      const s = StructType.from({
        foo: [ [1, 2], [-3, -4], [5, 6] ],
        bar: 'abcdef'
      })

      expect(s.toJSON()).to.deep.equal({
        foo: [
          { x: 1, y: 2 }, { x: -3, y: -4 }, { x: 5, y: 6 }
        ],
        bar: 'abcdef'
      })
    })
  })
})
