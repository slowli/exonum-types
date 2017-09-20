import { OrderedMap } from 'immutable'

import { memoize, rawValue, setRawValue } from './lowlevel/common'
import std from './std'
import { hash } from './crypto'
import Bits256, { getBit } from './Bits256'

const Hash = std.resolve('Hash')

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

/**
 * Searches for a (hash) key in a tree-like proof for the `MapView`.
 *
 * @returns {boolean}
 *   `true` if the tree *may* continue the searched key, `false` otherwise
 */
function searchKey (node, key) {
  let pos = 0

  while (node.type === 'branch') {
    const { left, right, leftKey, rightKey } = node.branch

    let i = 0
    while (leftKey.bit(i) === getBit(key, pos + i) && rightKey.bit(i) === getBit(key, pos + i)) {
      i++ // May only be triggered for the root branch
    }

    // Are the both keys different from our key? If yes, our key is not in the tree
    if (
      pos === 0 &&
      leftKey.bit(i) === rightKey.bit(i) &&
      leftKey.bit(i) !== getBit(key, i)
    ) {
      return false
    }

    // `leftKey` and `rightKey` cannot be both exhausted here
    // because otherwise they would be the same

    let path
    let pathKey
    if (leftKey.bitLength() < i || leftKey.bit(i) === getBit(key, pos + i)) {
      [path, pathKey] = [left, leftKey]
    } else if (rightKey.bitLength() < i || rightKey.bit(i) === getBit(key, pos + i)) {
      [path, pathKey] = [right, rightKey]
    } else {
      /* istanbul ignore next: seems to be unreachable */
      throw new Error('Invariant broken: Bogus execution path in searching a key in MapView')
    }

    // Go down the path until it is exhausted or there is a discrepancy among keys
    while (i < pathKey.bitLength() && pathKey.bit(i) === getBit(key, pos + i)) {
      i++
    }

    if (i >= pathKey.bitLength()) {
      pos += pathKey.bitLength()
      node = path
    } else {
      return false
    }
  }

  // node.type !== 'branch', there is or may be a specified key
  return true
}

const PROXIED_METHODS = [
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
            mapEntries = [[stub.key.getOriginal('bytes'), stub.value.val]]
          } else {
            // No visible elements in the tree
          }
          break
        case 'tree':
          const { values } = parseTreeStructure(root.tree)
          // Guaranteed to be sorted by ascending `node.pos`
          mapEntries = values.map(node => [node.fullKey.getOriginal('bytes'), node.val])
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

    count () {
      return rawValue(this).map.count()
    }

    has (hash) {
      const map = rawValue(this).map
      return map.has(Hash.from(hash))
    }

    get (hash) {
      const map = rawValue(this).map
      return map.get(Hash.from(hash))
    }

    /**
     * Checks whether this map can contain a key matching the specified hash.
     */
    mayHave (hash) {
      const root = rawValue(this).root

      switch (root.type) {
        case 'empty':
          return false
        case 'stub':
          return Hash.from(hash).equals(root.stub.key.getOriginal('bytes'))
        case 'tree':
          return searchKey(root.tree, rawValue(Hash.from(hash)))
      }
    }
  }

  MapView.prototype.rootHash = memoize(MapView.prototype.rootHash)

  PROXIED_METHODS.forEach(methodName => {
    MapView.prototype[methodName] = function () {
      const map = rawValue(this).map.mapKeys(k => rawValue(k, true))
      return map[methodName].apply(map, arguments)
    }
  })

  return MapView
}
