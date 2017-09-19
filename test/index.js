/* eslint-env mocha */

import chai from 'chai'
import dirtyChai from 'dirty-chai'

import * as types from '../src'

const expect = chai.use(dirtyChai).expect

describe('main module', () => {
  const exonumVerifiers = [
    'isExonumFactory',
    'isExonumType',
    'isExonumObject'
  ]

  exonumVerifiers.forEach(fnName => {
    it(`should export ${fnName}`, () => {
      expect(types[fnName]).to.be.a('function')
    })
  })

  const typeNames = [
    'Uint8',
    'Str',
    'Int32',
    'PublicKey',
    'Signature',
    'Block'
  ]

  typeNames.forEach(typeName => {
    it(`should export type ${typeName}`, () => {
      expect(types[typeName]).to.satisfy(types.isExonumType)
    })
  })

  const factories = [
    'buffer',
    'integer',
    'uinteger',
    'array',
    'enum',
    'struct',
    'message'
  ]

  factories.forEach(fName => {
    it(`should export factory ${fName}`, () => {
      expect(types[fName]).to.satisfy(types.isExonumFactory)
    })
  })

  it('should export a type resolver', () => {
    expect(types.resolver).to.be.an('object')
    expect(types.resolve).to.be.a('function')
    expect(types.resolve({
      struct: [
        { name: 'block', type: 'Block' },
        { name: 'precommits', type: { array: 'Precommit' } },
        { name: 'someStuff', type: { option: 'Str' } }
      ]
    })).to.satisfy(types.isExonumType)
  })

  const cryptoTools = [
    'hash',
    'sign',
    'verify'
  ]

  cryptoTools.forEach(toolName => {
    it(`should export crypto.${toolName}`, () => {
      expect(types.crypto[toolName]).to.be.a('function')
    })
  })
})
