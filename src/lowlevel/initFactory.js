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
 * @param {string | (any) => Object} argumentMeta
 *   Information inferred from the factory argument that should be added to the
 *   constructed type meta. If `argumentMeta` is a string, the prepared argument
 *   is recorded in the corresponding property of the meta. Otherwise, `argumentMeta`
 *   is assumed to be a function that converts prepared factory argument into an object,
 *   which is then added to meta with `Object.assign`.
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
  name = factory.name,
  argumentMeta = 'argument',
  prepare = (arg, resolver) => arg,
  typeTag = (arg) => arg,
  typeName = (arg) => `${name}<${arg}>`
} = {}) {
  if (typeof argumentMeta === 'string') {
    const prop = argumentMeta
    argumentMeta = (arg) => ({ [prop]: arg })
  }

  const memoizedFactory = (arg, resolver) => {
    if (!resolver) resolver = DUMMY_RESOLVER

    arg = prepare(arg, resolver) // here, types should be resolved, etc.

    const fullTag = List.of(name, typeTag(arg))

    if (resolver._hasType(fullTag)) {
      return resolver._getType(fullTag)
    } else {
      const cachedTypeName = typeName(arg)
      resolver._addPendingType(fullTag, cachedTypeName)
      const type = factory(arg, resolver)
      resolver._resolvePendingType(fullTag, type)

      Object.defineProperty(type, 'typeTag', {
        enumerable: false,
        configurable: true,
        value: function () {
          return fullTag
        }
      })

      Object.defineProperty(type, 'meta', {
        enumerable: false,
        configurable: true,
        value: function () {
          return Object.assign({
            factory: memoizedFactory,
            factoryName: name
          }, argumentMeta(arg))
        }
      })

      Object.defineProperty(type, 'toString', {
        enumerable: false,
        configurable: true,
        value: function () {
          return cachedTypeName
        }
      })

      return type
    }
  }

  setKind(memoizedFactory, 'factory')
  Object.defineProperties(memoizedFactory, {
    name: { configurable: true, value: name },
    prepare: { configurable: true, value: prepare },
    argumentMeta: { configurable: true, value: argumentMeta },
    typeTag: { configurable: true, value: typeTag },
    typeName: { configurable: true, value: typeName }
  })

  return memoizedFactory
}
