const EXONUM_KIND_PROP = typeof Symbol !== 'undefined'
  ? Symbol.for('exonum.kind')
  : '__exonumKind'

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
    maybeExonumFactory[EXONUM_KIND_PROP] === 'factory'
}

/**
 * Checks if a supplied object is an Exonum type.
 *
 * @param {any} maybeExonumType
 * @returns {boolean}
 */
export function isExonumType (maybeExonumType) {
  return maybeExonumType && maybeExonumType[EXONUM_KIND_PROP] === 'type'
}

/**
 * Checks if a supplied object is an Exonum object, i.e., instance of an Exonum type.
 *
 * @param {any} maybeExonumObj
 * @returns {boolean}
 */
export function isExonumObject (maybeExonumObj) {
  return maybeExonumObj && maybeExonumObj[EXONUM_KIND_PROP] === 'object'
}

const EXONUM_TYPEREF_PROP = typeof Symbol !== 'undefined'
  ? Symbol.for('exonum.typeref')
  : '__exonumTyperef'

export function getType (exonumObj) {
  if (!isExonumObject(exonumObj)) return undefined
  return exonumObj[EXONUM_TYPEREF_PROP]
}

const EXONUM_RAW_PROP = typeof Symbol !== 'undefined'
  ? Symbol.for('exonum.raw')
  : '__exonumRaw'

export function setRawValue (obj, raw, clone = () => raw) {
  Object.defineProperty(obj, EXONUM_RAW_PROP, { value: { data: raw, clone } })
}

export function rawValue (obj, externalUse = false) {
  if (!obj[EXONUM_RAW_PROP]) {
    return undefined
  }
  return externalUse ? obj[EXONUM_RAW_PROP].clone() : obj[EXONUM_RAW_PROP].data
}

export function rawOrSelf (obj, externalUse = false) {
  return (obj && obj[EXONUM_RAW_PROP] !== undefined) ? rawValue(obj, externalUse) : obj
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

export function initType (Type, { name, byteLength, proxiedMethods }) {
  class T extends Type {
    static typeLength () {
      return byteLength
    }

    static from (maybeInstance) {
      if (arguments.length === 1 && maybeInstance instanceof this) {
        return maybeInstance
      }
      return new this(...arguments)
    }

    byteLength () {
      return (byteLength !== undefined) ? byteLength : super.byteLength()
    }

    serialize (buffer) {
      if (!buffer) buffer = new Uint8Array(this.byteLength())
      super.serialize(buffer)
      return buffer
    }
  }

  T.prototype.byteLength = memoize(T.prototype.byteLength)

  Object.defineProperty(T, EXONUM_KIND_PROP, { value: 'type' })
  Object.defineProperty(T.prototype, EXONUM_KIND_PROP, { value: 'object' })
  Object.defineProperty(T.prototype, EXONUM_TYPEREF_PROP, { value: T })

  if (!name) {
    name = '[Exonum type]'
  }
  T.inspect = () => name
  T.toString = () => name

  if (proxiedMethods) {
    proxiedMethods.forEach(name => {
      T.prototype[name] = function () {
        const raw = rawValue(this)
        return raw[name].apply(raw, arguments)
      }
    })
  }

  return T
}

/**
 * Retrieves owned method names from an object.
 *
 * @returns {Array<string>} list of method names
 */
export function getMethodNames (obj) {
  return Object.getOwnPropertyNames(obj).filter(name => {
    var descriptor = Object.getOwnPropertyDescriptor(obj, name)
    return name !== 'constructor' &&
      name[0] !== '_' && // usually used for "private" APIs
      typeof descriptor.value === 'function'
  })
}
