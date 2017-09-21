/* eslint-env mocha */

import chai from 'chai'
import chaiBytes from 'chai-bytes'
import dirtyChai from 'dirty-chai'

import listView from '../src/listView'
import { convertListJSON } from '../src/jsonConverters'
import std from '../src/std'

import samples from './data/listView.json'

const expect = chai
  .use(chaiBytes)
  .use(dirtyChai)
  .expect

describe('listView', () => {
  function testValidSample (sampleName) {
    describe(`on sample ${sampleName}`, () => {
      const sample = samples[sampleName]
      const expected = sample.expected
      const json = convertListJSON(sample.data)
      const elementLength = expected.elementLength || expected.elements[0].length
      const ListView = listView({ fixedBuffer: elementLength }, std.resolver)
      let lst

      it(`should parse valid list view from sample`, () => {
        lst = new ListView(json)
        expect(lst.keySeq().first()).to.equal(expected.rangeStart)
        expect(lst.keySeq().last()).to.equal(expected.rangeEnd - 1)
        expect(lst.keySeq().count()).to.equal(expected.rangeEnd - expected.rangeStart)
      })

      if (expected.elements) {
        it('should correctly determine elements', () => {
          let i = 0
          lst.valueSeq().forEach(val => {
            expect(val).to.equalBytes(expected.elements[i++])
          })
        })
      }

      it('should calculate correct root hash', () => {
        expect(lst.rootHash()).to.equalBytes(expected.rootHash)
      })
    })
  }

  function testInvalidSample (sampleName, expectedError) {
    it(`should fail on sample ${sampleName}`, () => {
      const sample = samples[sampleName]
      const elementLength = sample.expected.elementLength
      const json = convertListJSON(sample.data)

      const ListView = listView({ fixedBuffer: elementLength }, std.resolver)

      expect(() => new ListView(json)).to.throw(expectedError)
    })
  }

  testValidSample('valid-10')
  testValidSample('valid-short')
  testValidSample('valid-full')
  testValidSample('valid-many-elements')

  testInvalidSample('invalid-stub-placement', /stub/i)
  testInvalidSample('invalid-value-height', /value.*height/i)
})
