import { List } from 'immutable'

const EXONUM_KIND_PROP = typeof Symbol !== 'undefined'
  ? Symbol.for('exonum.kind')
  : '__exonumKind'

export function getKind (obj) {
  return !obj ? undefined : obj[EXONUM_KIND_PROP]
}

export function setKind (obj, kind) {
  Object.defineProperty(obj, EXONUM_KIND_PROP, { value: kind })
  return obj
}

/**
 * Checks if a supplied object is an Exonum factory.
 *
 * @param {any} maybeExonumFactory
 * @returns {boolean}
 */
export function isExonumFactory (maybeExonumFactory) {
  return typeof maybeExonumFactory === 'function' &&
    getKind(maybeExonumFactory) === 'factory'
}

/**
 * Checks if a supplied object is an Exonum type.
 *
 * @param {any} maybeExonumType
 * @returns {boolean}
 */
export function isExonumType (maybeExonumType) {
  return getKind(maybeExonumType) === 'type'
}

/**
 * Checks if a supplied object is an Exonum object, i.e., instance of an Exonum type.
 *
 * @param {any} maybeExonumObj
 * @returns {boolean}
 */
export function isExonumObject (maybeExonumObj) {
  return getKind(maybeExonumObj) === 'object'
}

const EXONUM_RAW_PROP = typeof Symbol !== 'undefined'
  ? Symbol.for('exonum.raw')
  : '__exonumRaw'

/**
 * Sets the "raw" value of an Exonum type instance. The raw value may be used
 * internally within the type definition, and is also exposed to external users
 * (e.g., by accessing fields of `struct`s).
 *
 * @param {Object} obj
 * @param {any} raw
 *   A raw value for internal use. Will be returned by reference.
 * @param {?() => any} clone
 *   A function to export the raw value for external use. If the raw value is not
 *   immutable, this function should clone the "internal" raw value (hence the name).
 */
export function setRawValue (obj, raw, clone) {
  Object.defineProperty(obj, EXONUM_RAW_PROP, { value: { data: raw, clone } })
}

/**
 * Retrieves the "raw" value of an Exonum type instance previously set by `setRawValue()`.
 *
 * @param {Object} obj
 * @param {boolean} externalUse
 *   The context to use the retrieved value
 * @returns {any}
 *   The stored raw value, or `undefined` if the object does not have one
 */
export function rawValue (obj, externalUse = false) {
  if (!obj[EXONUM_RAW_PROP]) {
    return undefined
  }
  return externalUse ? obj[EXONUM_RAW_PROP].clone() : obj[EXONUM_RAW_PROP].data
}

/**
 * Retrieves the "raw" value of an Exonum type instance previously set by `setRawValue()`,
 * or returns the original instance if it does not have the raw value.
 *
 * @param {Object} obj
 * @param {boolean} externalUse
 *   The context to use the retrieved value
 * @returns {any}
 *   The stored raw value, or the original object
 */
export function rawOrSelf (obj, externalUse = false) {
  if (obj && obj[EXONUM_RAW_PROP] !== undefined) {
    if (externalUse && !obj[EXONUM_RAW_PROP].clone) {
      // The Exonum type has opted out from exposing the raw value externally
      return obj
    }
    return rawValue(obj, externalUse)
  }
  return obj
}

// For zero-arity functions only!
let memoizeCounter = 0

export function memoize (fn) {
  memoizeCounter += 1
  let slotName = memoizeCounter

  return function () {
    if (!this.__memoize) this.__memoize = {}
    if (!this.__memoize[slotName]) {
      this.__memoize[slotName] = fn.call(this)
    }

    return this.__memoize[slotName]
  }
}

/**
 * Initializes an Exonum type by attaching some sensible default method implementations.
 *
 * @param {Object} options
 * @param {?string} options.name
 *   Type name; used to get string representation of the class
 * @param {number | void} options.typeLength
 *   The length of the type serialization for fixed-length types. For var-length types,
 *   should be `undefined`.
 * @param {?Array<string>} options.proxiedMethods
 *   Methods to proxy from the `rawValue()` of the type instances.
 */
export function createType ({
  name = '[Exonum type]',
  typeTag = List.of(name),
  typeLength = undefined,
  proxiedMethods = [],
  kind = 'type'
}) {
  class ExonumType {
    static inspect () {
      return this.toString()
    }

    static toString () {
      return name
    }

    static typeLength () {
      return typeLength
    }

    static typeTag () {
      return typeTag
    }

    static hashCode () {
      return this.typeTag().hashCode()
    }

    static equals (other) {
      if (!isExonumType(other)) return false
      return this.typeTag().equals(other.typeTag())
    }

    static from (maybeInstance) {
      if (arguments.length === 1 && maybeInstance instanceof this) {
        return maybeInstance
      }
      return new this(...arguments)
    }

    constructor (rawValue, clone = () => rawValue) {
      if (rawValue !== undefined) {
        setRawValue(this, rawValue, clone)
      }
    }

    byteLength () {
      return typeLength
    }

    serialize (buffer) {
      if (!buffer) buffer = new Uint8Array(this.byteLength())
      this._doSerialize(buffer)
      return buffer
    }

    _doSerialize (buffer) {
      throw new Error('Not implemented; please redefine `_doSerialize()` in child classes')
    }

    toJSON () {
      throw new Error('Not implemented; please redefine `toJSON()` in child classes')
    }
  }

  Object.defineProperty(ExonumType, EXONUM_KIND_PROP, { value: kind })
  Object.defineProperty(ExonumType.prototype, EXONUM_KIND_PROP, { value: 'object' })

  // XXX: Is it possible to get rid of `proxiedMethods` and perform movement of methods
  // individually in each case?
  if (proxiedMethods) {
    proxiedMethods.forEach(name => {
      ExonumType.prototype[name] = function () {
        const raw = rawValue(this)
        return raw[name].apply(raw, arguments)
      }
    })
  }

  return ExonumType
}

/**
 * Retrieves owned method names from an object.
 *
 * @returns {Array<string>} list of method names
 */
export function getMethodNames (obj) {
  return Object.getOwnPropertyNames(obj).filter(name => {
    const descriptor = Object.getOwnPropertyDescriptor(obj, name)
    return name !== 'constructor' &&
      name[0] !== '_' && // usually used for "private" APIs
      typeof descriptor.value === 'function'
  })
}
