import { createType, rawValue, rawOrSelf } from './common'
import initFactory from './initFactory'
import { validateAndResolveFields } from './TypeResolver'

const DEFAULT_MARKER = 'type'

export function parseUnion (obj, marker, variantNames) {
  let variantName, variant

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

  class UnionType extends createType({
    name: unionName(variants),
    typeLength: undefined
  }) {
    constructor (obj) {
      const parsed = parseUnion(obj, marker, variantNames)
      if (!parsed) {
        // TODO: more desriptive message
        throw new TypeError('Invalid union initializer')
      }
      const value = variants[variantNames.indexOf(parsed[0])].type.from(parsed[1])

      // We don't want to return raw value for external uses;
      // instead, the value may be unwrapped in `get()` (see below)
      super({ value, variant: parsed[0] }, null)
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
      return rawOrSelf(val, true)
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

    /**
     * Matches this union against a *matcher* object. The object should have
     * function properties named according to variants; the one corresponding
     * to the actual variant will be invoked. Alternatively, if there is no
     * function matching this object's variant, but there is a *sink* method `_`,
     * it will be invoked instead. In both cases, the invoked method is supplied
     * with the active variant.
     *
     * @param {Object} matcher
     *
     * @example
     *   const MaybePoint = std.union([
     *     { name: 'none', type: 'None' },
     *     { name: 'some', type: Point } // Point is a struct with fields `x` and `y`
     *   ])
     *   const x = new MaybePoint({ some: [4, 5] })
     *   x.match({
     *     some: ({x, y}) => console.log(`Point: (${x}, ${y})`,
     *     none: () => console.log('I got nothing')
     *   })
     */
    match (matcher) {
      return matchAndGet(this, matcher, 'get')
    }

    /**
     * Same as `match`, but the invoked method is supplied with Exonum-typed object,
     * without coercion to a "primitive" value.
     *
     * @param {Object} matcher
     */
    matchOriginal (matcher) {
      return matchAndGet(this, matcher, 'getOriginal')
    }

    _doSerialize (buffer) {
      buffer[0] = variantNames.indexOf(getVariant(this))
      getValue(this).serialize(buffer.subarray(1))
    }

    toJSON () {
      return { [getVariant(this)]: getValue(this).toJSON() }
    }

    toString () {
      return `${getVariant(this)}(${getValue(this)})`
    }
  }

  function getVariant (union) {
    return rawValue(union).variant
  }

  function getValue (union) {
    return rawValue(union).value
  }

  function matchAndGet (union, matcher, getter) {
    if (!matcher || typeof matcher !== 'object') {
      throw new TypeError('Matcher should be an object')
    }

    const variant = getVariant(union)
    if (typeof matcher[variant] === 'function') {
      return matcher[variant](union[getter](variant))
    } else if (typeof matcher._ === 'function') {
      return matcher._(union[getter](variant))
    } else {
      // throw?
    }
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

function unionName (variants) {
  const varDescription = variants
    .map(variant => `${variant.name}:${variant.type}`)
    .join(' | ')
  return `(${varDescription})`
}
