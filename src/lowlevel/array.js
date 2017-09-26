import { List } from 'immutable'

import initFactory from './initFactory'
import { createType, rawValue, rawOrSelf } from './common'
import { uinteger } from './integers'
import * as segments from './segments'

// TODO: support other array-like objects (e.g., `List`)? And/or copy `List`s persistent methods
// (e.g., `push`) with wrappers?

const SizeType = uinteger(4)

/**
 * `Array<T>` represents a variable number of elements of type `T`.
 *
 * JSON presentation: array of elements' JSONs.
 *
 * Binary serialization: `Uint32` number of elements `n`, followed by serializations
 * of elements. If `T` is a var-length type, elements are serialized with the help
 * of segments (i.e., bytes `4..8*n + 4` are occuped with segment pointers to elements),
 * followed by elements themselves. If `T` is fixed-length, elements are serialized
 * in place.
 *
 * @example
 *   const StrArray = std.array(std.Str)
 *   let arr = new StrArray(['hello', 'world', '!'])
 *   arr.byteLength() // = 4 (length) + 3*8 (segment pointers) + 11 (strings)
 */
function array (ElementType, resolver) {
  class ExonumArray extends createType({
    name: `Array<${ElementType.inspect()}>`,
    typeLength: undefined
  }) {
    constructor (arr) {
      let elements
      if (Array.isArray(arr)) {
        elements = arr.map(x => ElementType.from(x))
      } else {
        throw new TypeError('Invalid array initializer, JS array expected')
      }

      const list = List(elements)
      const count = SizeType.from(list.count())
      super({
        list,
        count,
        serialization: list.unshift(count)
      }, null)
    }

    byteLength () {
      return segments.byteLength(rawValue(this).serialization)
    }

    /**
     * Returns the number of elements in this array.
     *
     * @returns {number}
     */
    count () {
      return +rawValue(this).count
    }

    /**
     * Gets an element of this array, possibly coerced to a "primitive" value.
     *
     * @param {number} index
     */
    get (index) {
      return rawOrSelf(this.getOriginal(index), true)
    }

    /**
     * Gets the original Exonum-typed element of the array, with no conversion performed.
     *
     * @param {number} index
     */
    getOriginal (index) {
      return rawValue(this).list.get(index)
    }

    /**
     * Returns an immutable list with elements of this array possibly coerced to
     * their "primitive" values.
     */
    toList () {
      return rawValue(this).list.map(val => rawOrSelf(val, true))
    }

    /**
     * Returns an immutable list with elements of this array, with no coercion.
     */
    toOriginalList () {
      return rawValue(this).list
    }

    _doSerialize (buffer) {
      // XXX: this differs from the current serialization protocol!
      segments.serialize(buffer, rawValue(this).serialization)
    }

    toJSON () {
      return rawValue(this).list.map(x => x.toJSON()).toJS()
    }
  }

  return ExonumArray
}

export default initFactory(array, {
  name: 'array',

  prepare (Type, resolver) {
    return resolver.resolve(Type)
  }
})
