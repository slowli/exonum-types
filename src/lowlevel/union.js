import { initType, rawValue, setRawValue } from './common'
import initFactory from './initFactory'
import { validateAndResolveFields } from './TypeResolver'

const DEFAULT_MARKER = 'type'

export function parseUnion (obj, marker, variantNames) {
  var variantName, variant

  if (obj[marker]) {
    variant = Object.assign({}, obj)
    variantName = obj[marker]
    delete variant[marker]

    if (variantNames.indexOf(variantName) < 0) {
      return undefined
    }
  } else {
    variantName = variantNames.find(name => name in obj)
    if (variantName) variant = obj[variantName]
  }
  return variantName ? [variantName, variant] : undefined
}

/** TODO: implement a simple matcher a la

@example
  const MaybePoint = union([
    { name: 'none', type: 'None' },
    { name: 'some', type: 'Point' }
  ])
  const x = new MaybePoint({ some: [4, 5] })
  x.match(
    'some', ({x, y}) => console.log(`Point: (${x}, ${y})`,
    'none', () => console.log('I got nothing')
  )
*/

/**
 * Union type factory. Tagged union (aka enum, aka type sum) is a type,
 * instances of which belong to one of the defined variants.
 */
function union (spec, resolver) {
  let marker, variants
  if (!Array.isArray(spec)) {
    ({ marker, variants } = spec)
  } else {
    marker = DEFAULT_MARKER
    variants = spec
  }

  variants = validateAndResolveFields(variants, resolver)
  const variantNames = variants.map(f => f.name)
  const markerByteLength = 1

  const UnionType = initType(class {
    constructor (obj) {
      const parsed = parseUnion(obj, marker, variantNames)
      if (!parsed) {
        // TODO: more desriptive message
        throw new TypeError('Invalid union initializer')
      }
      const value = variants[variantNames.indexOf(parsed[0])].type.from(parsed[1])

      // We don't want to return raw value for external uses;
      // instead, the value may be unwrapped in `get()` (see below)
      setRawValue(this, { value, variant: parsed[0] }, () => this)
    }

    byteLength () {
      return markerByteLength + getValue(this).byteLength()
    }

    /**
     * Retrieves a variant by its name, converted to the "raw" format.
     * Integers, strings and other objects are converted to the
     * corresponding native JS entities, while `struct`s, `union`s and other
     * constructed types are preserved.
     *
     * If another variant is set, returns `undefined`.
     *
     * @param {string} name
     */
    get (name) {
      if (getVariant(this) !== name) return undefined

      const val = rawValue(this).value
      const rawVal = rawValue(val, true)
      return rawVal !== undefined ? rawVal : val
    }

    /**
     * Retrieves an original, Exonum-typed variant.
     * If another variant is set, returns `undefined`.
     *
     * @param {string} name
     */
    getOriginal (name) {
      if (getVariant(this) !== name) return undefined
      return rawValue(this).value
    }

    serialize (buffer) {
      buffer[0] = variantNames.indexOf(getVariant(this))
      getValue(this).serialize(buffer.subarray(1))
    }

    toJSON () {
      return { [getVariant(this)]: getValue(this).toJSON() }
    }

    toString () {
      return `${getVariant(this)}(${getValue(this)})`
    }
  }, {
    typeLength: undefined
  })

  function getVariant (union) {
    return rawValue(union).variant
  }

  function getValue (union) {
    return rawValue(union).value
  }

  variantNames.forEach(name => {
    Object.defineProperty(UnionType, name, {
      value: function (obj) {
        return new UnionType({ [name]: obj })
      }
    })

    Object.defineProperty(UnionType.prototype, name, {
      enumerable: true,
      configurable: false,
      get () {
        return this.get(name)
      }
    })
  })

  Object.defineProperty(UnionType.prototype, marker, {
    enumerable: true,
    configurable: false,
    get () {
      return getVariant(this)
    }
  })

  return UnionType
}

export default initFactory(union, {
  name: 'union'
  // TODO: typeTag
})
