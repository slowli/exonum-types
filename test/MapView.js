/* eslint-env mocha */

import chai from 'chai'
import chaiBytes from 'chai-bytes'
import dirtyChai from 'dirty-chai'

import types from '../src/std'
import { hash } from '../src/crypto'
import { isExonumType } from '../src/lowlevel/common'

import samples from './data/mapView.json'

const expect = chai
  .use(chaiBytes)
  .use(dirtyChai)
  .expect

const MapView = types.MapView

describe('MapView', () => {
  const StrMapView = MapView({ K: 'Str', V: 'Str' })

  const BufferMapView = MapView({
    K: 'PublicKey',
    V: { fixedBuffer: 8 },
    hashKeys: false
  })

  describe('factory', () => {
    it('should create type', () => {
      expect(StrMapView).to.satisfy(isExonumType)
      expect(StrMapView.meta().factoryName).to.equal('MapView')
      expect(StrMapView.meta().key).to.equal(types.Str)
      expect(StrMapView.meta().value).to.equal(types.Str)
      expect(StrMapView.meta().hashKeys).to.be.true()

      expect(BufferMapView).to.satisfy(isExonumType)
      expect(BufferMapView.meta().factoryName).to.equal('MapView')
      expect(BufferMapView.meta().key).to.equal(types.PublicKey)
      expect(BufferMapView.meta().value.meta().size).to.equal(8)
      expect(BufferMapView.meta().hashKeys).to.be.false()
    })
  })

  describe('constructor', () => {
    it('should throw on non-terminal solitary node', () => {
      expect(() => StrMapView.from({
        entries: [],
        proof: [
          { key: '001', hash: '34264463370758a230017c5635678c9a39fa90a5081ec08f85de6c56243f4011' }
        ]
      })).to.throw(/non-terminal isolated node/i)
    })

    it('should throw on discovered prefix key pairs', () => {
      expect(() => StrMapView.from({
        entries: [],
        proof: [
          { key: '0', hash: '34264463370758a230017c5635678c9a39fa90a5081ec08f85de6c56243f4011' },
          { key: '001', hash: '34264463370758a230017c5635678c9a39fa90a5081ec08f85de6c56243f4011' }
        ]
      })).to.throw('bits(0) is a prefix of key bits(001)')

      expect(() => StrMapView.from({
        entries: [
          { key: 'foo', value: 'FOO' }
        ],
        proof: [
          { key: '001', hash: '34264463370758a230017c5635678c9a39fa90a5081ec08f85de6c56243f4011' }
        ]
      })).to.throw('bits(001) is a prefix of key bits(00101100') // SHA-256('foo') = 2c26...

      expect(() => StrMapView.from({
        entries: [
          { missing: 'foo' }
        ],
        proof: [
          { key: '001', hash: '34264463370758a230017c5635678c9a39fa90a5081ec08f85de6c56243f4011' }
        ]
      })).to.throw('bits(001) is a prefix of key bits(00101100')
    })
  })

  describe('hash', () => {
    it('should return zeros on empty map', () => {
      const view = StrMapView.from({
        entries: [],
        proof: []
      })

      expect(view.hash()).to.equalBytes(new Uint8Array(32))
    })

    it('should calculate hash for a single exposed node', () => {
      const view = StrMapView.from({
        entries: [
          { key: 'foo', value: 'FOO' }
        ],
        proof: []
      })

      expect(view.hash()).to.equalBytes(hash(
        types.Bool.TRUE,
        hash(types.Str.from('foo')),
        types.Uint8.from(0),
        hash(types.Str.from('FOO'))
      ))
    })

    it('should calculate hash for a single hashed node', () => {
      const view = StrMapView.from({
        entries: [],
        proof: [
          {
            key: types.Bits256.leaf(hash(types.Str.from('foo'))).toJSON(),
            hash: Buffer.from(hash(types.Str.from('FOO'))).toString('hex')
          }
        ]
      })

      expect(view.hash()).to.equalBytes(hash(
        types.Bool.TRUE,
        hash(types.Str.from('foo')),
        types.Uint8.from(0),
        hash(types.Str.from('FOO'))
      ))
    })

    it('should calculate hash for 2-node tree', () => {
      const view = StrMapView.from({
        entries: [],
        proof: [
          {
            key: '0',
            hash: '0000000000000000000000000000000000000000000000000000000000000000'
          },
          {
            key: '10',
            hash: '0f00000000000000000000000000000000000000000000000000000000000000'
          }
        ]
      })

      const rightHash = new Uint8Array(32)
      rightHash[0] = 15
      const rightKey = new Uint8Array(32)
      rightKey[0] = 128

      expect(view.hash()).to.equalBytes(hash(
        new Uint8Array(32),
        rightHash,

        types.Bool.FALSE,
        new Uint8Array(32),
        types.Uint8.from(1),

        types.Bool.FALSE,
        rightKey,
        types.Uint8.from(2)
      ))
    })

    it('should calculate hash for 2-node tree with intersecting root keys', () => {
      const view = StrMapView.from({
        entries: [],
        proof: [
          {
            key: '001',
            hash: '0000000000000000000000000000000000000000000000000000000000000000'
          },
          {
            key: '01',
            hash: 'ff00000000000000000000000000000000000000000000000000000000000000'
          }
        ]
      })

      const rightHash = new Uint8Array(32)
      rightHash[0] = 255
      const leftKey = new Uint8Array(32)
      leftKey[0] = 32
      const rightKey = new Uint8Array(32)
      rightKey[0] = 64

      expect(view.hash()).to.equalBytes(hash(
        new Uint8Array(32),
        rightHash,

        types.Bool.FALSE,
        leftKey,
        types.Uint8.from(3),

        types.Bool.FALSE,
        rightKey,
        types.Uint8.from(2)
      ))
    })
  })

  function testValidSample (sampleName) {
    describe(`on sample ${sampleName}`, () => {
      const sample = samples[sampleName]
      const expected = sample.expected
      const json = sample.data
      const elementLength = expected.elementLength
      const MView = MapView({
        K: 'PublicKey',
        V: { fixedBuffer: elementLength },
        hashKeys: false
      })

      let map

      it('should parse valid map view from sample', () => {
        map = new MView(json)

        expect(map.count()).to.equal(expected.entries.length)

        map.entrySeq().forEach(({ 0: key, 1: val }, i) => {
          expect(key).to.equalBytes(expected.entries[i][0])
          expect(val).to.equalBytes(expected.entries[i][1])
        })

        expected.entries.forEach(({ 0: key, 1: val }) => {
          expect(map.has(key)).to.be.true()
          expect(map.get(key)).to.equalBytes(val)
        })
      })

      it('should calculate correct root hash', () => {
        expect(map.hash()).to.equalBytes(expected.rootHash)
      })
    })
  }

  function testInvalidSample (sampleName, expectedError) {
    it(`should fail on sample ${sampleName}`, () => {
      const sample = samples[sampleName]
      const elementLength = sample.expected.elementLength
      const json = sample.data

      const MView = MapView({
        K: 'Hash',
        V: { fixedBuffer: elementLength },
        hashKeys: false
      })

      expect(() => new MView(json)).to.throw(expectedError)
    })
  }

  testValidSample('valid-no-values')
  testValidSample('valid-8')
  testValidSample('valid-special-root')
  testValidSample('valid-special-root-no-values')
  testValidSample('valid-single-value')
  testValidSample('valid-single-hash')
  testValidSample('valid-empty')

  testInvalidSample('invalid-single-hash-non-term', /non-terminal isolated node/i)
  testInvalidSample('invalid-8-oversized-key', /Cannot parse buffer/i)
  testInvalidSample('invalid-special-root', 'key bits(0011) is a prefix of key bits(00111)')
})
