import { List } from 'immutable'

import initFactory from './initFactory'
import { createType, rawValue, rawOrSelf } from './common'
import { uinteger } from './integers'
import * as segments from './segments'

const SizeType = uinteger(4)

function array (ElementType, resolver) {
  ElementType = resolver.resolve(ElementType)

  class ExonumArray extends createType({
    name: `Array<${ElementType.inspect()}>`,
    typeLength: undefined
  }) {
    constructor (arr) {
      let elements
      if (!arr) {
        // Initialize an empty array
        elements = []
      } else if (Array.isArray(arr)) {
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

    count () {
      return +rawValue(this).count
    }

    get (index) {
      return rawOrSelf(this.getOriginal(index), true)
    }

    getOriginal (index) {
      return rawValue(this).list.get(index)
    }

    toList () {
      return rawValue(this).list.map(val => rawOrSelf(val, true))
    }

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
  name: 'array'
})
