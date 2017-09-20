import { OrderedMap } from 'immutable'

import { memoize, rawValue, setRawValue } from './lowlevel/common'
import std from './std'
import { hash } from './crypto'
import Bits256 from './Bits256'

const MAP_VIEW_NODE_DEF = [
  {
    name: 'MapViewNode',
    union: [
      {
        name: 'branch',
        type: {
          struct: [
            { name: 'left', type: 'MapViewNode' },
            { name: 'right', type: 'MapViewNode' },
            { name: 'leftKey', type: 'Bits256' },
            { name: 'rightKey', type: 'Bits256' }
          ]
        }
      },
      { name: 'hash', type: 'Hash' },
      { name: 'val', type: 'T' }
    ]
  },
  {
    name: 'MapViewRoot',
    union: [
      { name: 'empty', type: 'None' },
      {
        name: 'stub',
        type: {
          struct: [
            { name: 'key', type: 'Bits256' },
            {
              name: 'value',
              type: {
                union: [
                  { name: 'hash', type: 'Hash' },
                  { name: 'val', type: 'T' }
                ]
              }
            }
          ]
        }
      },
      { name: 'tree', type: 'MapViewNode' }
    ]
  }
]

/**
 * Creates a `MapViewNode<ValType>` for a specific type of values.
 */
function mapViewRoot (ValType, resolver) {
  // XXX: works only with "native" type definitions
  return std.resolver.addNativeTypes({ Bits256, T: ValType })
    .addTypes(MAP_VIEW_NODE_DEF)
    .resolve('MapViewRoot')
}

/**
 * Walks the tree and parses the structure of a proof for MapView.
 * Throws errors if the structure is incorrect (i.e., some broken invariants).
 */
function parseTreeStructure (tree) {
  const nodes = []
  const leaves = []

  /**
   * Recursively walks the tree from root to leaves.
   */
  function walkTree (node, key = Bits256.from('')) {
    node.fullKey = key
    nodes.push(node)

    switch (node.type) {
      case 'val':
      case 'hash':
        leaves.push(node)
        break
      case 'branch':
        const { left, right, leftKey, rightKey } = node.branch

        if (key.bitLength() === 0) {
          // Root branch has the special rules as to the validity of the keys:
          // Neither of the keys should be a substring of the other key
          let pos = 0
          const maxPos = Math.min(leftKey.bitLength(), rightKey.bitLength())
          while (pos < maxPos && leftKey.bit(pos) === rightKey.bit(pos)) {
            pos++
          }
          if (pos === maxPos) {
            throw new Error('Invalid MapView: one of the keys at the root is a substring of the other key')
          }

          if (leftKey.bit(pos) > rightKey.bit(pos)) {
            throw new TypeError('Invalid MapView: Incorrect key ordering')
          }
        } else {
          // Non-root branch; left key should start with 0, and right one with 1
          if (leftKey.bit(0) !== 0 || rightKey.bit(0) !== 1) {
            throw new Error('Invalid MapView: Incorrect key ordering')
          }
        }

        // `key.append(...)` checks overflow of keys
        walkTree(left, key.append(leftKey))
        walkTree(right, key.append(rightKey))
        break
    }
  }

  walkTree(tree)
  const values = leaves.filter(node => node.type === 'val')

  // All values must have terminal keys
  if (!values.every(node => node.fullKey.isTerminal)) {
    throw new Error('Invalid MapView: non-terminal key at value node')
  }

  return { nodes, leaves, values }
}

function validateStub (stub) {
  if (!stub.key.isTerminal) {
    throw new Error('Invalid MapView: non-terminal key at an isolated node')
  }
}

/**
 * Calculates tree hash of a stub `MapView`.
 *
 * @returns {Uint8Array}
 */
function stubHash ({ key, value }) {
  const valueHash = (value.type === 'val') ? hash(value.val) : value.hash
  return hash(key, valueHash)
}

/**
 * Recursively calculates the hash of the entire `MapView`.
 *
 * @param {MapViewNode<any>} node
 * @returns {Uint8Array}
 */
function treeHash (node) {
  switch (node.type) {
    case 'hash':
      return node.hash
    case 'val':
      return hash(node.val)
    case 'branch':
      const { left, right } = node.branch
      return hash(treeHash(left), treeHash(right), left.fullKey, right.fullKey)
  }
}

// Methods proxied from `OrderedMap` to `MapView`
const PROXIED_METHODS = [
  'get',
  'count',
  'keys',
  'values',
  'entries',
  'keySeq',
  'valueSeq',
  'entrySeq'
]

export default function mapView (ValType, resolver) {
  // The `Root<ValType>` class
  const Root = mapViewRoot(ValType, resolver)

  class MapView {
    constructor (obj) {
      const root = Root.from(obj)

      let mapEntries = []

      switch (root.type) {
        case 'empty':
          break
        case 'stub':
          const stub = root.stub
          validateStub(stub)
          if (stub.value.type === 'val') {
            // Initialize the tree with a single element
            mapEntries = [[stub.key.bytes, stub.value.val]]
          } else {
            // No visible elements in the tree
          }
          break
        case 'tree':
          const { values } = parseTreeStructure(root.tree)
          // Guaranteed to be sorted by ascending `node.pos`
          mapEntries = values.map(node => [node.fullKey.bytes, node.val])
          break
      }

      const map = OrderedMap(mapEntries)
      setRawValue(this, { root, map })
    }

    rootHash () {
      const root = rawValue(this).root

      switch (root.type) {
        case 'empty':
          return new Uint8Array(32)
        case 'stub':
          return stubHash(root.stub)
        case 'tree':
          return treeHash(root.tree)
      }
    }
  }

  MapView.prototype.rootHash = memoize(MapView.prototype.rootHash)

  PROXIED_METHODS.forEach(methodName => {
    MapView.prototype[methodName] = function () {
      const map = rawValue(this).map
      return map[methodName].apply(map, arguments)
    }
  })

  return MapView
}
