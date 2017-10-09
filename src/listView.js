import { Map as ImmutableMap, OrderedMap, Seq } from 'immutable'

import { rawValue, createType } from './lowlevel/common'
import initFactory from './lowlevel/initFactory'
import { hash } from './crypto'

/**
 * Error during parsing a list view.
 */
class ListViewError extends Error {
  constructor (kind, args) {
    let message = ''

    switch (kind) {
      case 'missing':
        message = `Missing entry in list view proof: (${args.height}, ${args.index})`
        break
      case 'redefined':
        message = `Redefined entry in list view proof: (${args.height}, ${args.index})`
        break
      case 'unexpected':
        message = `Unexpected entry in list view proof: (${args.height}, ${args.index}) ` +
          `when index <= ${args.maxIndex} was expected at this height`
        break
      case 'extraHeight':
        message = `Entry in list view proof past tree root: entry at height ${args.height} ` +
          `whereas the root is at height ${args.treeHeight}`
        break
    }

    super(message)
  }
}

/**
 * Processes the proof returning a map, in which hashes are split by their level.
 *
 * @param {List<{ level: Uint8, index: Uint64, hash: Hash }>} proof
 * @returns {OrderedMap<Uint8, OrderedMap<Uint64, Hash>>}
 */
function preprocessProof (proof) {
  let map = ImmutableMap().withMutations(m => {
    proof.forEach(({ height, index, hash }) => {
      if (!m.has(height)) {
        m.set(height, ImmutableMap())
      }

      const entry = ImmutableMap([[index, hash]])
      m.set(height, m.get(height).mergeWith(
        () => { throw new ListViewError('redefined', { height, index }) },
        entry
      ))
    })
  })

  return map.sortBy((_, height) => height)
    .map(level => level.sortBy((_, index) => index))
}

/**
 * @param {OrderedMap<Uint8, OrderedMap<Uint64, Hash>>} proof
 * @param {Map<Uint64, ExonumType>} entries
 */
function treeHash (proof, entries, hashFn = hash) {
  const hashedEntries = entries.map(value => hashFn(value))
  let level = hashedEntries.mergeWith(
    (oldVal, newVal, index) => { throw new ListViewError('redefined', { index, height: 1 }) },
    proof.get(1) || OrderedMap()
  )

  // Maximum index allowed on the level. Initially set to `+Infinity`; defined
  // once there is an odd number of elements on the level
  let maxIndex = +Infinity
  // 1-based height of the current level of the tree
  let height = 1

  while (level.count() > 1 || !level.has(0)) {
    level = level.sortBy((_, index) => index)

    const actualMaxIndex = level.keySeq().last()
    if (actualMaxIndex > maxIndex) {
      throw new ListViewError('unexpected', {
        maxIndex,
        height,
        index: actualMaxIndex
      })
    }

    const nextLevel = OrderedMap().withMutations(nextLevel => {
      // Construct pairs of elements
      let pairs = level.count() > 1 ? (
        // Somehow, this code does not work if `level` contains a single element
        level.entrySeq()
          .zip(level.entrySeq().skip(1))
          .filter((_, index) => index % 2 === 0)
      ) : Seq.Indexed()

      // The last element may be needed to be added separately
      if (level.count() % 2 === 1) {
        // Array embedding is required for `concat()` to treat the inner array
        //  as a single pair of elements, rather than an iterator of 2 elements
        pairs = pairs.concat(Seq.Indexed.of([level.entrySeq().last(), undefined]))
      }

      pairs.forEach(({ 0: { 0: evenIndex, 1: evenHash }, 1: odd }) => {
        if (evenIndex % 2 !== 0) {
          // The entry at `evenIndex - 1` should be (but is not) present in `level`
          // in order to hash it together with the current entry.
          //
          // Indeed, there are 2 possibilities:
          //
          // - This is the first entry at this level. Obviously, in this case the entry
          //   `evenIndex - 1` is missing.
          // - This is not the first entry. The previous entry has an odd index
          //   (provable by induction), so it cannot have position `evenIndex - 1`,
          //   which is even. q.e.d.
          throw new ListViewError('missing', { height, index: evenIndex - 1 })
        }

        if (odd !== undefined) {
          const { 0: oddIndex, 1: oddHash } = odd

          if (oddIndex !== evenIndex + 1) {
            throw new ListViewError('missing', { height, index: oddIndex - 1 })
          }
          nextLevel.set(evenIndex / 2, hashFn(evenHash, oddHash))
        } else {
          // Special case: a single element at the end of the level. We hash the element separately
          // and set `maxIndex`
          nextLevel.set(evenIndex / 2, hashFn(evenHash))
          maxIndex = evenIndex // will be updated at the end of the loop
        }
      })
    })

    height++
    level = nextLevel.mergeWith(
      (oldVal, newVal, index) => { throw new ListViewError('redefined', { height, index }) },
      proof.get(height) || OrderedMap())
    maxIndex = Math.floor(maxIndex / 2)
  }

  // The maximum known level of the tree
  const maxHeight = proof.keySeq().last()
  if (maxHeight >= height) {
    throw new ListViewError('extraHeight', { height: maxHeight, treeHeight: height })
  }

  return level.get(0)
}

// Methods proxied from `OrderedMap` to `ListView`
const PROXIED_METHODS = [
  'get',
  'has',
  'count',
  'keys',
  'values',
  'entries',
  'keySeq',
  'valueSeq',
  'entrySeq'
]

function listView (ElementType, resolver) {
  const ListViewBase = resolver.resolve({ $ListViewBase: ElementType })

  class ListView extends createType({
    name: `ListView<${ElementType.inspect()}>`
  }) {
    constructor (obj) {
      const parsed = ListViewBase.from(obj)
      const entries = parsed.entries.toList()
      const proof = preprocessProof(parsed.proof.toList())

      const map = OrderedMap(entries.map(entry => [entry.key, entry.value]))
      if (map.count() !== parsed.entries.count()) {
        const redefinedKey = entries.groupBy(entry => entry.key)
          .findEntry(group => group.count() > 1)[0]
        throw new ListViewError('redefined', { height: 0, index: redefinedKey })
      }

      const originalMap = OrderedMap(entries.map(
        entry => [entry.key, entry.getOriginal('value')]))

      super({ map, originalMap }, null)
      rawValue(this).hash = treeHash(proof, originalMap)
    }

    getOriginal (index) {
      return rawValue(this).originalMap.get(index)
    }

    hash () {
      return rawValue(this).hash
    }
  }

  PROXIED_METHODS.forEach(methodName => {
    ListView.prototype[methodName] = function () {
      const map = rawValue(this).map
      return map[methodName].apply(map, arguments)
    }
  })

  return ListView
}

export default initFactory(listView, {
  name: 'ListView',
  argumentMeta: 'element',

  prepare (Type, resolver) {
    return resolver.resolve(Type)
  }
})
