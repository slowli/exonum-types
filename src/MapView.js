import { Map as ImmutableMap, Set as ImmutableSet } from 'immutable'

import { createType, rawValue } from './lowlevel/common'
import initFactory from './lowlevel/initFactory'
import { hash } from './crypto'

/**
 * Calculates the hash for a tree with a single key.
 *
 * @param {Bits256} key
 * @param {Uint8Array} nodeHash
 * @returns {Uint8Array}
 */
function stubHash (key, nodeHash) {
  return hash(key, nodeHash)
}

/**
 * Calculates the hash for a tree node.
 *
 * @param {TreeNode} node
 * @returns {Uint8Array}
 */
function nodeHash (node) {
  return hash(node.leftHash, node.rightHash, node.leftKey, node.rightKey)
}

/**
 * Node in a Merkle Patricia tree backing the map view.
 */
class TreeNode {
  /**
   * Creates a root node with a specified child key for a leftmost child in the map view.
   *
   * @param {Bits256} emptyKey
   * @param {Bits256} key
   */
  static root (emptyKey, key) {
    return new this({
      key: emptyKey,
      leftKey: null,
      leftHash: null,
      rightKey: key
    })
  }

  constructor ({ key, leftKey, leftHash, rightKey }) {
    this.key = key
    this.leftKey = leftKey
    this.rightKey = rightKey
    this.leftHash = leftHash
  }

  /**
   * Truncates the right key of the node to the specified length.
   *
   * @param {number} toBits
   */
  truncateRightKey (toBits) {
    this.rightKey = this.rightKey.truncate(toBits)
  }

  /**
   * Finalizes the node. Finalization takes the hash of the right child of the node
   * and returns the hash of the node itself.
   *
   * @param {Uint8Array} rightHash
   * @returns {Uint8Array}
   */
  finalize (rightHash) {
    if (!this.leftHash) {
      // Special case for the root node: it can be "finalized" 2 times (for the left and right subtrees).
      // This is the first finalization.

      this.leftKey = this.rightKey
      this.leftHash = rightHash
      this.rightKey = null
      return rightHash
    } else {
      this.rightHash = rightHash
      return nodeHash(this)
    }
  }
}

/**
 * Computes the root hash of the Merkle Patricia tree backing the specified entries
 * in the map view.
 *
 * The tree is not restored in full; instead, we add the keys to
 * the tree in their lexicographic order (i.e., according to the `Bits256.comparator()` function)
 * and keep track of the rightmost nodes (the right contour) of the tree.
 * It is easy to see that adding keys in the lexicographic order means that only
 * the nodes in the right contour may be updated on each step. Further, on each step
 * zero or more nodes are evicted from the contour, and a single new node is
 * added to it.
 *
 * @param {List<[Bits256, ?Hash]>} entries
 *   Guaranteed to be sorted by increasing `Bits256` component
 */
function treeHash (entries, emptyKey) {
  if (entries.count() === 0) {
    // Empty tree
    return new Uint8Array(32)
  } else if (entries.count() === 1) {
    // Tree with a single node
    const { 0: key, 1: hash } = entries.get(0)
    if (!key.isTerminal) {
      throw new Error('Invalid map view: non-terminal isolated node')
    }
    return stubHash(key, hash)
  }

  // Check that there are no super/subkeys among the entries, i.e., no pairs
  // like `[01, ...]` and `[011, ...]`
  for (let i = 1; i < entries.count(); i++) {
    const prevKey = entries.get(i - 1)[0]
    const key = entries.get(i)[0]

    if (prevKey.commonPrefix(key).equals(prevKey)) {
      throw new Error(`Invalid map view: key ${prevKey} is a prefix of key ${key}`)
    }
  }

  // Add the first entry into the right contour. This entry is the root of the tree.
  let { 0: prevKey, 1: prevHash } = entries.first() // track the most recently added node
  const root = TreeNode.root(emptyKey, prevKey)

  let rightContour = [ root ]
  rightContour.last = function () {
    return this[this.length - 1]
  }

  for (let i = 1; i < entries.count(); i++) {
    const { 0: key, 1: hash } = entries.get(i)
    if (!hash) continue

    const commonPrefix = prevKey.commonPrefix(key)

    // `finHash` and `finKey` are the characteristics of the last finalized node
    // in the contour
    let [finHash, finKey] = [prevHash, prevKey]
    while (rightContour.length > 0 && rightContour.last().key.bitLength() >= commonPrefix.bitLength()) {
      const node = rightContour.pop();
      // It is easy to see that `finHash` is the final value of the `node.rightHash`;
      // it cannot be updated during the further insertions to the tree.
      // Thus, we may calculate the hash of the node and evict it from the contour.
      [finHash, finKey] = [node.finalize(finHash), node.key]
    }

    if (rightContour.length > 0) {
      rightContour.last().truncateRightKey(commonPrefix.bitLength())

      const newBranch = new TreeNode({
        key: commonPrefix,
        leftKey: finKey,
        leftHash: finHash,
        rightKey: key
      })
      rightContour.push(newBranch)
    } else {
      // The root has been removed from the contour, which means that its left side is now finalized.
      // Push the root back with the finalized left side.
      root.rightKey = key
      rightContour.push(root)
    }

    [prevKey, prevHash] = [key, hash]
  }

  // Iteratively finalize all remaining nodes in the tree. This handles the special case
  // when all keys start with the same bit(s); see the special clause in `TreeNode.finalize()`.
  let finHash = prevHash
  while (rightContour.length > 0) {
    finHash = rightContour.pop().finalize(finHash)
  }
  return finHash
}

const PROXIED_METHODS = [
  'keys',
  'values',
  'entries',
  'keySeq',
  'valueSeq',
  'entrySeq'
]

function mapView ({ K: KeyType, V: ValType, hashKeys = true }, resolver) {
  const Bits256 = resolver.resolve('Bits256')
  const MapViewBase = resolver.resolve({ $MapViewBase: { K: KeyType, V: ValType } })

  class MapView extends createType({
    name: `MapView<${ValType.inspect()}>`
  }) {
    constructor (obj) {
      const parsed = MapViewBase.from(obj)

      // Entries in the proof presented as `[Bits256, Hash]` pairs
      const proofList = parsed.proof.toList().map(entry => [entry.key, entry.hash])
      // Visible entries as `[Bits256, ?Hash]` pairs
      const entryList = parsed.entries.toList().map(entry => entry.match({
        missing: (e) => [
          Bits256.leaf(hashKeys ? hash(e.getOriginal('missing')) : e.missing),
          null
        ],
        entry: (e) => [
          Bits256.leaf(hashKeys ? hash(e.getOriginal('key')) : e.key),
          hash(e.getOriginal('value'))
        ]
      }))

      const entries = entryList.concat(proofList).sort(
        ({ 0: keyA }, { 0: keyB }) => Bits256.comparator(keyA, keyB))

      super({
        map: ImmutableMap(parsed.entries
          .toList()
          .filter(e => e.type === 'entry')
          .map(e => [e.entry.getOriginal('key'), e.entry.value])),
        missing: ImmutableSet(entryList.filter(e => e[1] === null).map(e => e[0]))
      }, null)

      rawValue(this).hash = treeHash(entries, Bits256.from(''))
    }

    hash () {
      return rawValue(this).hash
    }

    count () {
      return rawValue(this).map.count()
    }

    has (key) {
      key = KeyType.from(key)
      return rawValue(this).map.has(key)
    }

    get (key) {
      key = KeyType.from(key)
      return rawValue(this).map.get(key)
    }
  }

  PROXIED_METHODS.forEach(methodName => {
    MapView.prototype[methodName] = function () {
      const map = rawValue(this).map.mapKeys(k => rawValue(k, true))
      return map[methodName].apply(map, arguments)
    }
  })

  return MapView
}

export default initFactory(mapView, {
  name: 'MapView',

  argumentMeta ({ K, V, hashKeys }) {
    return {
      key: K,
      value: V,
      hashKeys
    }
  },

  prepare ({ K, V, hashKeys = true }, resolver) {
    return {
      K: resolver.resolve(K),
      V: resolver.resolve(V),
      hashKeys: !!hashKeys
    }
  }
})
