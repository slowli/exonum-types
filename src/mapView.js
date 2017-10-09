import { Map as ImmutableMap, Set as ImmutableSet } from 'immutable'

import { createType, rawValue } from './lowlevel/common'
import initFactory from './lowlevel/initFactory'
import { hash } from './crypto'

function stubHash (key, nodeHash) {
  return hash(key, nodeHash)
}

function nodeHash (node) {
  return hash(node.leftHash, node.rightHash, node.leftKey, node.rightKey)
}

class TreeNode {
  constructor ({ key, leftKey, leftHash, rightKey }) {
    this.key = key
    this.leftKey = leftKey
    this.rightKey = rightKey
    this.leftHash = leftHash
  }

  truncateRightKey (toBits) {
    this.rightKey = this.rightKey.truncate(toBits)
  }

  finalize (rightHash) {
    this.rightHash = rightHash
    return nodeHash(this)
  }
}

/**
 * @param {List<[Bits256, ?Hash]>} entries
 *  Guaranteed to be sorted by increasing `Bits256` component
 */
function treeHash (entries, emptyKey) {
  if (entries.count() === 0) {
    return new Uint8Array(32)
  } else if (entries.count() === 1) {
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

  // Add the first entry into the right contour
  let lastKey = entries.get(0)[0]
  let lastHash = entries.first()[1]

  const root = {
    key: emptyKey,
    leftKey: null,
    rightKey: lastKey,
    leftHash: null,

    truncateRightKey (bitLength) {
      this.rightKey = this.rightKey.truncate(bitLength)
    },

    finalize (hash) {
      // The root node is special: it can be "finalized" 2 times (for the left and right subtree).
      if (!this.leftHash) {
        this.leftKey = this.rightKey
        this.leftHash = hash
        this.rightKey = null
        return hash
      } else {
        this.rightHash = hash
        return nodeHash(this)
      }
    }
  }

  let rightContour = [ root ]
  rightContour.last = function () {
    return this[this.length - 1]
  }

  for (let i = 1; i < entries.count(); i++) {
    const { 0: key, 1: hash } = entries.get(i)
    if (!hash) {
      continue
    }

    const commonPrefix = lastKey.commonPrefix(key)

    // `finHash` and `finKey` are the characteristics of the last finalized node
    // in the contour
    let [finHash, finKey] = [lastHash, lastKey]
    while (rightContour.length > 0 && rightContour.last().key.bitLength() >= commonPrefix.bitLength()) {
      const last = rightContour.pop()
      finHash = last.finalize(finHash)
      finKey = last.key
    }

    if (rightContour.length > 0) {
      rightContour[rightContour.length - 1].truncateRightKey(commonPrefix.bitLength())
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

    lastKey = key
    lastHash = hash
  }

  let finHash = lastHash
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
      })

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
  name: 'mapView',

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
