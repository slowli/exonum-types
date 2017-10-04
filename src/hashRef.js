import { createType, rawValue } from './lowlevel/common'
import initFactory from './lowlevel/initFactory'
import * as crypto from './crypto'

/**
 * `HashRef<T>` represents a type, which is parsed from/to JSON as `T`, but
 * is serialized as the 32-byte hash of `T`. This is useful for seamlessly including
 * list and map views, transactions and the like into the input parsed by the client
 * without breaking cryptographic operations.
 */
function hashRef (Type, resolver) {
  return class extends createType({
    name: `HashRef<${Type.inspect()}>`,
    typeLength: crypto.hashLength
  }) {
    constructor (obj) {
      const typedObj = Type.from(obj)
      super(typedObj)
    }

    _doSerialize (buffer) {
      buffer.set(this.hash())
    }

    hash () {
      return (typeof rawValue(this).hash === 'function')
        ? rawValue(this).hash()
        : crypto.hash(rawValue(this))
    }

    value () {
      return rawValue(this)
    }

    toJSON () {
      return rawValue(this).toJSON()
    }
  }
}

export default initFactory(hashRef, {
  name: 'hashRef',
  argumentMeta: 'value',

  prepare (Type, resolver) {
    return resolver.resolve(Type)
  }
})
