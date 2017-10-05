/* eslint-env mocha */

import chai from 'chai'
import dirtyChai from 'dirty-chai'

import { convertMapJSON } from '../src/jsonConverters'

const expect = chai
  .use(dirtyChai)
  .expect

describe('convertMapJSON', () => {
  it('should throw if supplied with non-object', () => {
    expect(() => convertMapJSON(null)).to.throw('Invalid JSON for MapView; object expected')
    expect(() => convertMapJSON(undefined)).to.throw('Invalid JSON for MapView; object expected')
    expect(() => convertMapJSON(5)).to.throw('Invalid JSON for MapView; object expected')
    expect(() => convertMapJSON('map')).to.throw('Invalid JSON for MapView; object expected')
    expect(() => convertMapJSON(true)).to.throw('Invalid JSON for MapView; object expected')
  })

  it('should convert empty map', () => {
    expect(convertMapJSON({})).to.be.null()
  })

  it('should convert map with single element', () => {
    const json = {
      '1000101': { val: 'abcdef' }
    }

    expect(convertMapJSON(json)).to.deep.equal({
      key: '1000101',
      value: { val: 'abcdef' }
    })
  })

  it('should convert simple branching JSON', () => {
    const json = {
      '0': { val: [1, 2, 3] },
      '1': {
        '0': { val: [4, 5, 6] },
        '111': '0000000000000000000000000000000000000000000000000000000000000000'
      }
    }

    expect(convertMapJSON(json)).to.deep.equal({
      branch: {
        leftKey: '0',
        rightKey: '1',
        left: { val: [1, 2, 3] },
        right: {
          branch: {
            leftKey: '0',
            rightKey: '111',
            left: { val: [4, 5, 6] },
            right: { hash: '0000000000000000000000000000000000000000000000000000000000000000' }
          }
        }
      }
    })
  })

  it('should throw if root node has greater number of properties than expected', () => {
    const json = {
      '0': { val: [1, 2, 3] },
      '1': {
        '0': { val: [4, 5, 6] },
        '111': '0000000000000000000000000000000000000000000000000000000000000000'
      },
      '111': { val: [7, 8, 9] }
    }

    expect(() => convertMapJSON(json)).to.throw('object with <=2 properties expected')
  })

  it('should throw if intermediate node has extra properties', () => {
    const json = {
      '0': { val: [1, 2, 3] },
      '1': {
        '0': { val: [4, 5, 6] },
        '111': '0000000000000000000000000000000000000000000000000000000000000000',
        '1101': { val: [7, 8, 9] }
      }
    }

    expect(() => convertMapJSON(json)).to.throw('Invalid proof node')
  })

  it('should throw if intermediate node has insuffiecient properties', () => {
    const json = {
      '0': { val: [1, 2, 3] },
      '1': {
        '0': { val: [4, 5, 6] }
      }
    }

    expect(() => convertMapJSON(json)).to.throw('Invalid proof node')
  })
})
