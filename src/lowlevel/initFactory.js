import { List } from 'immutable'

import { setKind } from './common'
import { dummyResolver } from './TypeResolver'

const DUMMY_RESOLVER = dummyResolver()

/**
 * Initializes an Exonum factory (= generic type). Initialization is required
 * in order to use the factory within a type resolver.
 *
 * @param {(any, TypeResolver) => any} factory
 * @param {string} name
 *   Name of the factory. Should be unique (XXX: enforce on resolver level?)
 * @param {(any, TypeResolver) => any} prepare
 *   Callback that can be used to validate and/or transform the argument passed
 *   to the factory. For example, a factory may resolve type definitions
 *   to Exonum types here. `prepare` is called before the call to the original `factory`;
 *   `typeTag()` and `typeName()` callbacks are also invoked with the transformed argument.
 *   The default implementation leaves the argument intact.
 * @param {(any) => ValueObject} typeTag
 *   Returns the *tag* of the datatype produced by supplying the argument to the factory.
 *   The result should be a `ValueObject`. Tags are used to memoize factory invocations,
 *   which is necessary to support recursive templated types, among other things.
 *   The default implementation passes the argument through, which only makes sense
 *   if there is a single type parameter resolved within `prepare()`.
 * @param {(any) => string} typeName
 *   Returns the name of the datatype produced by supplying the argument to the factory.
 *
 * @returns {(any, ?TypeResolver) => ExonumType} initialized factory
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
