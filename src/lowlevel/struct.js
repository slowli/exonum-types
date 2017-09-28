import { List, Record } from 'immutable'

import { createType, rawValue, rawOrSelf } from './common'
import initFactory from './initFactory'
import { validateAndResolveFields } from './TypeResolver'
import * as segments from './segments'

/**
 * `Struct<StructSpec>` creates a type with a fixed number of named, possibly
 * heterogeneous fields. These types correspond to Rust's `struct`s and
 * `Record`s in Immutable.js.
 *
 * `StructSpec` is an array of field specifications. Each field spec needs to
 * contain at minimum the string name of the field and its type, which is resolved
 * against the current resolver.
 *
 * JSON presentation: object with keys corresponding to named fields.
 *
 * Binary serialization: consists of 2 parts:
 *
 * - Fixed-sized part, containing segment pointers (in case of var-length fields)
 *   and fields themselves (in case of fixed-length fields)
 * - "Heap" containing var-length fields themselves
 *
 * @example
 *   const Point = std.struct([
 *     { name: 'x', type: 'Int32' }, // type resolved automatically
 *     { name: 'y', type: std.Int32 }
 *   ])
 *   const pt = Point.from({ x: 1, y: -1 })
 *   const otherPt = Point.from([5, 4]) // initializer accepts array of values
 *                                      // in the order of field declaration
 *   console.log(pt.x) // 1, the fields are coerced to primitives automatically
 *   console.log(otherPt.set('x', 2)) // { x: 5, y: 2 }, `Point` instance
 */
function struct (spec, resolver) {
  const propertyNames = spec.map(f => f.name)
  const propertyTypes = List(spec.map(f => f.type))

  const recordSpec = {}
  propertyNames.forEach(name => { recordSpec[name] = undefined })
  // The backing `Record` class
  const Rec = Record(recordSpec)

  // The length of the fixed part of the structure
  const fixedLength = segments.heapStart(propertyTypes)
  // Is this structure fixed-length?
  const hasFixedLength = propertyTypes.every(T => T.typeLength() !== undefined)

  class StructType extends createType({
    typeLength: hasFixedLength ? fixedLength : undefined,
    name: structName(spec)
  }) {
    constructor (objectOrArray) {
      // `null` signals to opt out of external raw value exposition, e.g.,
      // in the `get` method below
      super(Rec(parseInitializer(spec, objectOrArray, Rec)), null)
    }

    /**
     * Returns a struct copied from this one, with one of field set to the specified value.
     * The value does not necessarily have to have the exact type of the field,
     * but the type needs to know how to convert the value (via the constructor).
     *
     * @param {string} name
     * @param {any} value
     */
    set (name, value) {
      const idx = propertyNames.indexOf(name)

      if (idx >= 0) {
        const Type = spec[idx].type

        if (!(value instanceof Type)) {
          value = new Type(value)
        }

        return this.constructor.from(rawValue(this).set(name, value))
      } else {
        throw new Error(`Unknown property: ${name}`)
      }
    }

    /**
     * Retrieves a field by its name, optionally converted to a primitive value.
     * For example, integers, strings and other objects are converted to the
     * corresponding native JS entities. `struct`s, `union`s and other
     * constructed types are preserved.
     *
     * @param {string} name
     */
    get (name) {
      return rawOrSelf(rawValue(this).get(name), true)
    }

    /**
     * Retrieves the original, Exonum-typed field by its name.
     *
     * @param {string} name
     * @returns {ExonumType}
     */
    getOriginal (name) {
      return rawValue(this).get(name)
    }

    byteLength () {
      return segments.byteLength(propertyNames.map(name => this.getOriginal(name)))
    }

    // XXX: `offset` here is a hack needed due to quirky message serialization
    _doSerialize (buffer, { offset = 0 } = {}) {
      return segments.serialize(buffer,
        propertyNames.map(name => this.getOriginal(name)),
        { offset, heapPos: fixedLength })
    }

    toJSON () {
      const obj = {}
      for (let i = 0; i < spec.length; i++) {
        const value = this.getOriginal(spec[i].name)
        obj[spec[i].name] = value ? value.toJSON() : undefined
      }
      return obj
    }

    toString () {
      const props = []
      for (let i = 0; i < spec.length; i++) {
        const value = this.getOriginal(spec[i].name)
        props.push((value === undefined) ? `?${spec[i].name}` : `${spec[i].name}: ${value}`)
      }
      return `{ ${props.join(', ')} }`
    }
  }

  propertyNames.forEach(name => {
    Object.defineProperty(StructType.prototype, name, {
      enumerable: true,
      configurable: true,
      get: function () {
        return this.get(name)
      }
    })
  })

  return StructType
}

export default initFactory(struct, {
  name: 'struct',

  prepare (fields, resolver) {
    return validateAndResolveFields(fields, resolver)
  },

  typeTag (fields, resolver) {
    return List().withMutations(l => {
      fields.map(({ name, type }) => l.push(name, type))
    })
  }
})

/**
 * Parses an initializer for the structure.
 *
 * @param {Array<FieldSpec>} spec
 * @param {any} args
 */
function parseInitializer (spec, arg, Rec) {
  let parsed = {}
  let i

  if (arg instanceof Rec) {
    // Shortcut if we have been a fitting `Record` object
    return arg
  } if (Array.isArray(arg)) {
    // Assume `obj` is the sequence of properties
    // in the order of their declaration in the type
    for (i = 0; i < spec.length; i++) {
      const T = spec[i].type
      parsed[spec[i].name] = T.from(arg[i])
      // This will throw automatically if there are not enough props,
      // and `T.from` does not support instancing from `undefined`
    }
  } else if (arg && typeof arg === 'object') {
    for (i = 0; i < spec.length; i++) {
      const val = arg[spec[i].name]
      const T = spec[i].type
      parsed[spec[i].name] = T.from(val)
    }
  } else {
    throw new TypeError(`Cannot instantiate struct from ${arg}`)
  }

  return parsed
}

function structName (spec) {
  const fields = spec.map(field => field.type.toString()).join(', ')
  return `[${fields}]`
}
