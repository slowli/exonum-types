/* eslint-env mocha */

import chai from 'chai'
import chaiBytes from 'chai-bytes'
import dirtyChai from 'dirty-chai'

import { convertListJSON } from '../src/jsonConverters'
import types from '../src/std'
import { isExonumType } from '../src/lowlevel/common'

import samples from './data/listView.json'

const expect = chai
  .use(chaiBytes)
  .use(dirtyChai)
  .expect

const listView = types.listView

describe('listView', () => {
  describe('factory', () => {
    it('should create type', () => {
      const StrListView = listView('Str')
      expect(StrListView).to.satisfy(isExonumType)
      expect(StrListView.meta().factoryName).to.equal('listView')
      expect(StrListView.meta().value).to.equal(types.Str)
    })
  })

  function testValidSample (sampleName) {
    describe(`on sample ${sampleName}`, () => {
      const sample = samples[sampleName]
      const expected = sample.expected
      const json = convertListJSON(sample.data)
      const elementLength = expected.elementLength || expected.elements[0].length
      const ListView = listView({ fixedBuffer: elementLength })
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
        expect(lst.hash()).to.equalBytes(expected.rootHash)
      })
    })
  }

  function testInvalidSample (sampleName, expectedError) {
    it(`should fail on sample ${sampleName}`, () => {
      const sample = samples[sampleName]
      const elementLength = sample.expected.elementLength
      const json = convertListJSON(sample.data)

      const ListView = listView({ fixedBuffer: elementLength })

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
