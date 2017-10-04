import { OrderedMap } from 'immutable'

import { createType, memoize, rawValue } from './lowlevel/common'
import initFactory from './lowlevel/initFactory'
import { hash } from './crypto'
import { getBit } from './Bits256'

/**
 * Walks the tree and parses the structure of a proof for MapView.
 * Throws errors if the structure is incorrect (i.e., some broken invariants).
 */
function parseTreeStructure (tree, Bits256) {
  const nodes = []
  const leaves = []

  function pushNode (node, key) {
    node.fullKey = key
    nodes.push(node)
  }

  pushNode(tree, Bits256.from(''))

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    const key = node.fullKey

    node.match({
      branch: ({ left, right, leftKey, rightKey }) => {
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
        pushNode(left, key.append(leftKey))
        pushNode(right, key.append(rightKey))
      },

      // Not a branch node
      _: () => leaves.push(node)
    })
  }

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
  return node.match({
    hash: (h) => h,
    val: (val) => hash(val),
    branch: ({ left, right }) => hash(treeHash(left), treeHash(right), left.fullKey, right.fullKey)
  })
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

function mapView (ValType, resolver) {
  const Hash = resolver.resolve('Hash')
  const Bits256 = resolver.resolve('Bits256')

  const ProofRoot = resolver.resolve({ MapProofRoot: ValType })

  class MapView extends createType({
    name: `MapView<${ValType.inspect()}>`
  }) {
    constructor (obj) {
      const root = ProofRoot.from(obj)

      const mapEntries = root.match({
        empty: () => [],
        stub: (stub) => {
          validateStub(stub)
          return stub.value.match({
            val: (val) => [[stub.key.getOriginal('bytes'), val]],
            _: () => []
          })
        },
        tree: (tree) => {
          const { values } = parseTreeStructure(tree, Bits256)
          // Guaranteed to be sorted by ascending `node.pos`
          return values.map(node => [node.fullKey.getOriginal('bytes'), node.val])
        }
      })

      super({ root, map: OrderedMap(mapEntries) })
    }

    hash () {
      const root = rawValue(this).root
      return root.match({
        empty: () => new Uint8Array(32),
        stub: (stub) => stubHash(stub),
        tree: (tree) => treeHash(tree)
      })
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
      return root.match({
        empty: () => false,
        stub: (stub) => Hash.from(hash).equals(stub.key.getOriginal('bytes')),
        tree: (tree) => searchKey(tree, rawValue(Hash.from(hash)))
      })
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

export default initFactory(mapView, {
  name: 'mapView',
  argumentMeta: 'value',

  prepare (ValType, resolver) {
    return resolver.resolve(ValType)
  }
})
