/* eslint-env mocha */

import chai from 'chai'
import chaiBytes from 'chai-bytes'
import dirtyChai from 'dirty-chai'

import mapView from '../src/mapView'
import { convertMapJSON } from '../src/jsonConverters'
import fixedBuffer from '../src/lowlevel/fixedBuffer'

import samples from './data/mapView.json'

const expect = chai
  .use(chaiBytes)
  .use(dirtyChai)
  .expect

describe('mapView', () => {
  function testValidSample (sampleName) {
    describe(`on sample ${sampleName}`, () => {
      const sample = samples[sampleName]
      const expected = sample.expected
      const json = convertMapJSON(sample.data)
      const elementLength = expected.elementLength
      const MapView = mapView(fixedBuffer(elementLength))

      let map

      it(`should parse valid map view from sample`, () => {
        map = new MapView(json)
        expect(map.count()).to.equal(expected.entries.length)
        map.entrySeq().forEach(({ 0: key, 1: val }, i) => {
          expect(key).to.equalBytes(expected.entries[i][0])
          expect(val).to.equalBytes(expected.entries[i][1])
        })
      })

      it('should calculate correct root hash', () => {
        expect(map.rootHash()).to.equalBytes(expected.rootHash)
      })
    })
  }

  testValidSample('valid-no-values')
  testValidSample('valid-8')
  testValidSample('valid-special-root')
  testValidSample('valid-special-root-no-values')
  testValidSample('valid-single-value')
})
