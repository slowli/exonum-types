import { Map as ImmutableMap, OrderedMap } from 'immutable'

import { rawValue, createType } from './lowlevel/common'
import initFactory from './lowlevel/initFactory'
import { hash } from './crypto'

/**
 * Processes the proof returning a map, in which hashes are split by their level.
 *
 * @param {List<{ level: Uint8, pos: Uint64, hash: Hash }>} proof
 * @returns {OrderedMap<Uint8, OrderedMap<Uint64, Hash>>}
 */
function preprocessProof (proof) {
  let map = ImmutableMap().withMutations(m => {
    proof.forEach(({ level, pos, hash }) => {
      if (!m.has(level)) {
        m.set(level, ImmutableMap())
      }
      const entry = ImmutableMap([[pos, hash]])
      m.set(level, m.get(level).mergeWith(
        () => { throw new Error(`Duplicate entry in proof: (${level}, ${pos})`) },
        entry
      ))
    })
  })

  return map.sortBy((_, level) => level)
    .map(level => level.sortBy((_, pos) => pos))
}

/**
 * @param {OrderedMap<Uint8, OrderedMap<Uint64, Hash>>} proof
 * @param {Map<Uint64, ExonumType>} entries
 */
function treeHash (proof, entries, hashFn = hash) {
  const hashedEntries = entries.map(value => hashFn(value))
  let level = hashedEntries.mergeWith(
    (oldVal, newVal, pos) => { throw new Error(`Invalid proof: redefined entry (1, ${pos})`) },
    proof.get(1) || OrderedMap()
  )

  // Maximum index allowed on the level. Initially set to `+Infinity`; defined
  // once there is an odd number of elements on the level
  let maxPos = +Infinity
  // 1-based index of the current level
  let levelIdx = 1

  while (level.count() > 1 || !level.has(0)) {
    level = level.sortBy((_, pos) => pos)

    const actualMaxPos = level.keySeq().last()
    if (actualMaxPos > maxPos) {
      throw new Error(`Invalid proof: encountered element at position ${actualMaxPos} on level ${levelIdx}, whereas <=${maxPos} was expected`)
    }

    const nextLevel = OrderedMap().withMutations(nextLevel => {
      let index = 0 // index of the element on the level being iterated
      let prevHash, prevPos // properties of the previous iterated element

      level.forEach((hash, pos) => {
        if (index % 2 === 1) {
          if (prevPos !== pos - 1) {
            throw new Error(`Invalid proof: missing entry (${levelIdx}, ${pos - 1})`)
          }

          nextLevel.set(prevPos / 2, hashFn(prevHash, hash))
        } else {
          // The odd position / index; it will be grabbed by the next element,
          // unless it its the last element, in which case it needs to be treated specially.

          if (pos % 2 !== 0) {
            // Here `pos` is odd, and the entry at `pos - 1` should be (but is not) present in `level`
            // in order to hash it together with the entry at `pos`.
            //
            // Indeed, there are 2 cases:
            //
            // - This is the first entry at this level. Obviously, in this case the entry `pos - 1`
            //   is missing.
            // - This is not the first entry. The previous entry has an odd position
            //   (provable by induction), so it cannot have position `pos - 1`, which is odd. q.e.d.
            throw new Error(`Invalid proof: missing entry (${levelIdx}, ${pos - 1})`)
          }

          if (index === level.count() - 1) {
            // Special case: a single element at the end of the level. We hash the element separately
            // and set `maxPos`
            nextLevel.set(pos / 2, hashFn(hash))
            maxPos = pos // will be updated at the end of the loop
          }
        }

        prevHash = hash
        prevPos = pos
        index++
      })
    })

    levelIdx++
    level = nextLevel.mergeWith(
      (oldVal, newVal, pos) => { throw new Error(`Invalid proof: redefined entry (${levelIdx}, ${pos})`) },
      proof.get(levelIdx) || OrderedMap())
    maxPos = Math.floor(maxPos / 2)
  }

  // The maximum known level of the tree
  const maxLevel = proof.keySeq().last()
  if (maxLevel >= levelIdx) {
    throw new Error(`Invalid proof: proof entry at level ${maxLevel}, when the tree has root on level ${levelIdx}`)
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
        throw new Error('Invalid list view: duplicate key(s)')
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
