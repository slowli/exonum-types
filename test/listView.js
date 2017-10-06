/* eslint-env mocha */

import chai from 'chai'
import chaiBytes from 'chai-bytes'
import dirtyChai from 'dirty-chai'

import types from '../src/std'
import { hash } from '../src/crypto'
import { isExonumType } from '../src/lowlevel/common'

import samples from './data/listView.json'

const expect = chai
  .use(chaiBytes)
  .use(dirtyChai)
  .expect

const ListView = types.ListView

describe('ListView', () => {
  const StrListView = ListView('Str')

  describe('factory', () => {
    it('should create type', () => {
      expect(StrListView).to.satisfy(isExonumType)
      expect(StrListView.meta().factoryName).to.equal('ListView')
      expect(StrListView.meta().element).to.equal(types.Str)
    })
  })

  describe('constructor', () => {
    it('should parse list views', () => {
      const view = StrListView.from({
        entries: [
          { key: '0', value: 'foo' },
          { key: '1', value: 'bar' }
        ],
        proof: []
      })

      expect(view.count()).to.equal(2)
      expect(view.get(0)).to.equal('foo')
      expect(view.get(1)).to.equal('bar')
      expect(view.has(0)).to.be.true()
      expect(view.has(2)).to.be.false()
    })

    it('should not parse list view with redefined entries', () => {
      expect(() => StrListView.from({
        entries: [
          { key: '0', value: 'foo' },
          { key: '0', value: 'bar' }
        ],
        proof: []
      })).to.throw(/duplicate key/i)
    })

    it('should not parse list view with redefined proof entries', () => {
      expect(() => StrListView.from({
        entries: [
          { key: '1', value: 'bar' }
        ],
        proof: [
          { level: 1, pos: 1, hash: '0000000000000000000000000000000000000000000000000000000000000000' },
          { level: 1, pos: 1, hash: '1000000000000000000000000000000000000000000000000000000000000000' }
        ]
      })).to.throw(/duplicate entry in proof/i)
    })

    it('should not parse list view with entries colliding with proof entries', () => {
      expect(() => StrListView.from({
        entries: [
          { key: '0', value: 'foo' },
          { key: '1', value: 'bar' }
        ],
        proof: [
          { level: 1, pos: 1, hash: '0000000000000000000000000000000000000000000000000000000000000000' }
        ]
      })).to.throw('redefined entry (1, 1)')

      expect(() => StrListView.from({
        entries: [
          { key: '0', value: 'foo' },
          { key: '1', value: 'bar' }
        ],
        proof: [
          { level: 2, pos: 0, hash: '0000000000000000000000000000000000000000000000000000000000000000' }
        ]
      })).to.throw('redefined entry (2, 0)')

      expect(() => StrListView.from({
        entries: [
          { key: '0', value: 'foo' },
          { key: '1', value: 'bar' }
        ],
        proof: [
          { level: 10, pos: 0, hash: '0000000000000000000000000000000000000000000000000000000000000000' }
        ]
      })).to.throw('proof entry at level 10')
    })

    it('should not parse list view with insufficient information to construct root hash', () => {
      expect(() => StrListView.from({
        entries: [
          { key: '2', value: 'bar' }
        ],
        proof: [ ]
      })).to.throw('missing entry (2, 0)')

      expect(() => StrListView.from({
        entries: [
          { key: '0', value: 'foo' },
          { key: '3', value: 'bar' }
        ],
        proof: [ ]
      })).to.throw('missing entry (1, 2)')

      expect(() => StrListView.from({
        entries: [
          { key: '1', value: 'bar' },
          { key: '2', value: 'bar' }
        ],
        proof: [ ]
      })).to.throw('missing entry (1, 0)')

      expect(() => StrListView.from({
        entries: [
          { key: '1000', value: 'bar' },
          { key: '1001', value: 'bar' }
        ],
        proof: [ ]
      })).to.throw('missing entry (4, 124)')
    })

    it('should not parse list view with entries in proof conflicting with discovered stub', () => {
      expect(() => StrListView.from({
        entries: [
          { key: '4', value: 'bar' }
        ],
        proof: [
          { level: 3, pos: 0, hash: hash(new Uint8Array(10)) },
          { level: 3, pos: 2, hash: hash(new Uint8Array(20)) }
        ]
      })).to.throw(/encountered element at position/)

      expect(() => StrListView.from({
        entries: [
          { key: '4', value: 'bar' },
          { key: '5', value: 'foo' }
        ],
        proof: [
          { level: 3, pos: 0, hash: hash(new Uint8Array(10)) },
          { level: 3, pos: 3, hash: hash(new Uint8Array(20)) }
        ]
      })).to.throw(/encountered element at position/)
    })
  })

  describe('hash', () => {
    it('should calculate hash correctly for a single-node tree', () => {
      const view = StrListView.from({
        entries: [
          { key: '0', value: 'foo' }
        ],
        proof: []
      })

      expect(view.hash()).to.equalBytes(hash(types.Str.from('foo')))
    })

    it('should calculate hash correctly for a 2-node tree', () => {
      const view = StrListView.from({
        entries: [
          { key: '0', value: 'foo' },
          { key: '1', value: 'bar' }
        ],
        proof: []
      })

      expect(view.hash()).to.equalBytes(hash(
        hash(types.Str.from('foo')),
        hash(types.Str.from('bar'))
      ))
    })

    it('should calculate hash correctly for a 3-node tree', () => {
      const view = StrListView.from({
        entries: [
          { key: '0', value: 'foo' },
          { key: '2', value: 'bazz' },
          { key: '1', value: 'bar' }
        ],
        proof: []
      })

      expect(view.hash()).to.equalBytes(hash(
        hash(
          hash(types.Str.from('foo')),
          hash(types.Str.from('bar'))
        ),
        hash(hash(types.Str.from('bazz')))
      ))
    })

    it('should calculate hash correctly for a 4-node tree with a single entry in proof', () => {
      const view = StrListView.from({
        entries: [
          { key: '2', value: 'bazz' },
          { key: '1', value: 'bar' }
        ],
        proof: [
          { level: 1, pos: 0, hash: hash(types.Str.from('foo')) },
          { level: 1, pos: 3, hash: hash(types.Str.from('foobar')) }
        ]
      })

      expect(view.hash()).to.equalBytes(hash(
        hash(
          hash(types.Str.from('foo')),
          hash(types.Str.from('bar'))
        ),
        hash(
          hash(types.Str.from('bazz')),
          hash(types.Str.from('foobar'))
        )
      ))
    })

    it('should calculate hash correctly for a 5-node tree with a full stub path', () => {
      const h1to4 = hash(
        hash(
          hash(types.Str.from('item0')),
          hash(types.Str.from('item1'))
        ),
        hash(
          hash(types.Str.from('item2')),
          hash(types.Str.from('item3'))
        )
      )
      const rootHash = hash(
        h1to4,
        hash(hash(hash(types.Str.from('item4'))))
      )

      const view = StrListView.from({
        entries: [
          { key: '4', value: 'item4' }
        ],
        proof: [
          { level: 3, pos: 0, hash: h1to4 }
        ]
      })

      expect(view.hash()).to.equalBytes(rootHash)
    })
  })

  function testValidSample (sampleName) {
    describe(`on sample ${sampleName}`, () => {
      const sample = samples[sampleName]
      const expected = sample.expected
      const json = sample.data
      const elementLength = expected.elementLength || expected.elements[0].length
      const LView = ListView({ fixedBuffer: elementLength })
      let lst

      it(`should parse valid list view from sample`, () => {
        lst = new LView(json)
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
      const json = sample.data

      const LView = ListView({ fixedBuffer: elementLength })

      expect(() => new LView(json)).to.throw(expectedError)
    })
  }

  testValidSample('valid-10')
  testValidSample('valid-short')
  testValidSample('valid-full')
  testValidSample('valid-many-elements')

  testInvalidSample('invalid-stub-placement', /proof entry at level/i)
})
