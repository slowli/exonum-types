import { List } from 'immutable'

import { setKind } from './common'
import { dummyResolver } from './TypeResolver'

const DUMMY_RESOLVER = dummyResolver()

/**
 * Initializes an Exonum factory (= generic type). Initialization is required
 * in order to use the factory within a type resolver.
 *
 * @returns {Function} initialized factory
 */
export default function initFactory (factory, {
  name,
  prepare = (arg, resolver) => arg,
  typeTag = (arg) => arg,
  typeName = (arg) => `${name}<?>`
} = {}) {
  const memoizedFactory = (arg, resolver) => {
    if (!resolver) resolver = DUMMY_RESOLVER

    arg = prepare(arg, resolver) // here, types should be resolved, etc.

    const fullTag = List.of(name, typeTag(arg))

    if (resolver._hasType(fullTag)) {
      return resolver._getType(fullTag)
    } else {
      resolver._addPendingType(fullTag, typeName(arg))
      const type = factory(arg, resolver)
      resolver._resolvePendingType(fullTag, type)

      // TODO: hashCode(), equals() for type
      return type
    }
  }

  setKind(memoizedFactory, 'factory')
  return memoizedFactory
}
