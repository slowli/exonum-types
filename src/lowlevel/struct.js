import { Record } from 'immutable'

import { createType, rawValue, rawOrSelf } from './common'
import initFactory from './initFactory'
import { validateAndResolveFields } from './TypeResolver'
import * as segments from './segments'

/**
 * Creates a new structure type based on the specification of its fields.
 */
function struct (spec, resolver) {
  spec = validateAndResolveFields(spec, resolver)

  const propertyNames = spec.map(f => f.name)
  const recordSpec = {}
  propertyNames.forEach(name => { recordSpec[name] = undefined })
  // The backing `Record` class
  const Rec = Record(recordSpec)

  // The length of the fixed part of the structure
  const fixedLength = segments.heapStart(spec.map(f => f.type))
  // Is this structure fixed-length?
  const hasFixedLength = spec.every(f => f.type.typeLength() !== undefined)

  class StructType extends createType({
    typeLength: hasFixedLength ? fixedLength : undefined,
    name: structName(spec)
  }) {
    constructor (...args) {
      // `null` signals to opt out of external raw value exposition, e.g.,
      // in the `get` method below
      super(Rec(parseInitializer(spec, args, Rec)), null)
    }

    set (name, value) {
      const idx = propertyNames.indexOf(name)

      if (idx >= 0) {
        const Type = spec[idx].type

        if (!(value instanceof Type)) {
          value = new Type(value)
        }

        return StructType.from(rawValue(this).set(name, value))
      } else {
        throw new Error(`Unknown property: ${name}`)
      }
    }

    /**
     * Retrieves a field by its name, converted to the "raw" format.
     * Integers, strings and other objects are converted to the
     * corresponding native JS entities, while `struct`s, `union`s and other
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

    _doSerialize (buffer) {
      return segments.serialize(buffer,
        propertyNames.map(name => this.getOriginal(name)),
        fixedLength)
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
  name: 'struct'
  // TODO: define `typeTag`
})

/**
 * Parses an initializer for the structure.
 *
 * @param {Array<FieldSpec>} spec
 * @param {any} args
 */
function parseInitializer (spec, args, Rec) {
  let parsed = {}
  let i

  if (args.length === 1 && args[0] instanceof Rec) {
    // Shortcut if we have been a fitting `Record` object
    return args[0]
  } if (args.length === 1 && Array.isArray(args[0])) {
    // Assume `obj` is the sequence of properties
    // in the order of their declaration in the type
    for (i = 0; i < args[0].length; i++) {
      const T = spec[i].type
      parsed[spec[i].name] = T.from(args[0][i])
    }
  } else if (args.length === 1 && typeof args[0] === 'object') {
    for (i = 0; i < spec.length; i++) {
      const val = args[0][spec[i].name]
      if (val !== undefined) {
        const T = spec[i].type
        parsed[spec[i].name] = T.from(val)
      }
    }
  } else {
    // Assume arguments are the properties
    for (i = 0; i < args.length; i++) {
      const T = spec[i].type
      parsed[spec[i].name] = T.from(args[i])
    }
  }

  return parsed
}

function structName (spec) {
  const fields = spec.map(field => field.type.toString()).join(', ')
  return `[${fields}]`
}
