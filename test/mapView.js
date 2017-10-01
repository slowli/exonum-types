/* eslint-env mocha */

import chai from 'chai'
import chaiBytes from 'chai-bytes'
import dirtyChai from 'dirty-chai'

import { convertMapJSON } from '../src/jsonConverters'
import types from '../src/std'
import { isExonumType } from '../src/lowlevel/common'

import samples from './data/mapView.json'

const expect = chai
  .use(chaiBytes)
  .use(dirtyChai)
  .expect

const mapView = types.mapView

function padWithZeros (bits) {
  while (bits.length < 256) bits = bits + '0'
  return { bin: bits }
}

function padWithOnes (bits) {
  while (bits.length < 256) bits = bits + '1'
  return { bin: bits }
}

function padWithRandom (bits) {
  while (bits.length < 256) bits = bits + (Math.random() > 0.5 ? '1' : '0')
  return { bin: bits }
}

describe('mapView', () => {
  describe('factory', () => {
    it('should create type', () => {
      const StrMapView = mapView('Str')
      expect(StrMapView).to.satisfy(isExonumType)
      expect(StrMapView.meta().factoryName).to.equal('mapView')
      expect(StrMapView.meta().value).to.equal(types.Str)
    })
  })

  function testValidSample (sampleName) {
    describe(`on sample ${sampleName}`, () => {
      const sample = samples[sampleName]
      const expected = sample.expected
      const json = convertMapJSON(sample.data)
      const elementLength = expected.elementLength
      const MapView = mapView({ fixedBuffer: elementLength }, types.resolver)

      let map

      it('should parse valid map view from sample', () => {
        map = new MapView(json)

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
        expect(map.rootHash()).to.equalBytes(expected.rootHash)
      })

      it('should report visible keys as potential', () => {
        map.keySeq().forEach(key => {
          expect(map.mayHave(key), `Failed for key ${key}`).to.be.true()
        })
      })

      if (expected.maybeKeys) {
        it('should report potential keys in the map', () => {
          expected.maybeKeys.forEach(key => {
            if (key.endsWith('...')) {
              key = key.substring(0, key.length - 3)

              expect(map.mayHave(padWithZeros(key)), `Failed for ${key}(0)*`).to.be.true()
              expect(map.mayHave(padWithOnes(key)), `Failed for ${key}(1)*`).to.be.true()
              expect(map.mayHave(padWithRandom(key)), `Failed for ${key}.*`).to.be.true()
            } else {
              expect(map.mayHave({ bin: key }), `Failed for ${key.substring(0, 20)}...`).to.be.true()
            }
          })
        })
      }

      if (expected.notKeys) {
        it('should report non-existing keys in the map', () => {
          expected.notKeys.forEach(key => {
            if (key.endsWith('...')) {
              key = key.substring(0, key.length - 3)

              expect(map.mayHave(padWithZeros(key)), `Failed for ${key}(0)*`).to.be.false()
              expect(map.mayHave(padWithOnes(key)), `Failed for ${key}(1)*`).to.be.false()
              expect(map.mayHave(padWithRandom(key)), `Failed for ${key}.*`).to.be.false()
            } else {
              expect(map.mayHave({ bin: key }), `Failed for ${key.substring(0, 20)}...`).to.be.true()
            }
          })
        })
      }
    })
  }

  testValidSample('valid-no-values')
  testValidSample('valid-8')
  testValidSample('valid-special-root')
  testValidSample('valid-special-root-no-values')
  testValidSample('valid-single-value')
  testValidSample('valid-empty')
})
