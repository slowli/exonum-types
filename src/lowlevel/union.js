import { List } from 'immutable'

import { createType, rawValue, rawOrSelf } from './common'
import initFactory from './initFactory'
import { validateAndResolveFields } from './TypeResolver'

/**
 * Tagged union (aka enum, aka type sum) is a type,
 * instances of which belong to one of the defined variants.
 *
 * Tagged unions are specified by an array of variant specs. A variant spec
 * is similar to field spec in `struct`s; it contains the name of the variant
 * and its type.
 *
 * JSON presentation: an object with a single key, the active variant name, mapped
 * to the JSON presentation of the variant.
 *
 * Binary serialization: `Uint8` index of the variant (0-based, taken from the order
 * of the variants in the spec), followed by the serialization of the variant.
 *
 * Note: all unions are considered var-length types, even if all variants have the same
 * type length. This is to assist in forward compatibility: a new variant may appear
 * with a different type length.
 *
 * @example
 *   const StrOrInt = std.union([
 *     { name: 'str', type: 'Str' },
 *     { name: 'int', type: 'Uint32' }
 *   ])
 *   let x = StrOrInt.from({ str: 'Hello, world' })
 *   x = StrOrInt.int(5) // Shortcuts are available to initialize variants
 *   console.log(x.type) // 'int'
 *   console.log(x.int) // 5, primitive JS value
 *   console.log(x.str) // undefined
 *   console.log(x.toJSON()) // { int: 5 }
 */
function union ({
  tag: tagProperty,
  tagEmbedding,
  variants
}, resolver) {
  const variantNames = variants.map(f => f.name)
  const markerByteLength = 1 // XXX: may become variable later

  class UnionType extends createType({
    name: unionName(variants),
    typeLength: undefined
  }) {
    constructor (obj, maybeTag) {
      let tag, value

      if (maybeTag) {
        // Tag is explicitly mentioned in the constructor
        tag = maybeTag
        if (variantNames.indexOf(tag) < 0) {
          throw new Error(`Invalid union tag specified: ${tag}`)
        }

        value = variants[variantNames.indexOf(tag)].type.from(obj)
      } else if (tagEmbedding === 'none') {
        // Sequentially try all variants; initialize to the first matching variant
        for (let i = 0; i < variants.length; i++) {
          const { name, type } = variants[i]

          try {
            tag = name
            value = type.from(obj)
            break
          } catch (e) {
            // XXX: narrow `e` to a sensible type and rethrow for other errors
          }
        }

        if (!value) {
          throw new Error('No matching union variant found')
        }
      } else {
        let valueInitializer

        if (typeof obj !== 'object' || !obj) {
          throw new TypeError('Invalid initializer for union; object expected')
        }

        switch (tagEmbedding) {
          case 'external':
            // Search for variant tags in keys of the object
            const possibleTags = Object.keys(obj).filter(name => variantNames.indexOf(name) >= 0)
            if (possibleTags.length === 0) {
              throw new Error('No matching union variant found')
            } else if (possibleTags.length > 1) {
              throw new Error(`Ambiguous union initializer: cannot decide among variants ${possibleTags.join(', ')}`)
            }

            tag = possibleTags[0]
            valueInitializer = obj[tag]
            break
          case 'internal':
            tag = obj[tagProperty]
            valueInitializer = Object.assign({}, obj)
            delete valueInitializer[tagProperty]
            break
        }

        if (variantNames.indexOf(tag) < 0) {
          throw new Error(`Invalid union tag specified: ${tag}`)
        }

        value = variants[variantNames.indexOf(tag)].type.from(valueInitializer)
      }

      // We don't want to return raw value for external uses;
      // instead, the value may be unwrapped in `get()` (see below)
      super({ value, variant: tag }, null)
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
      switch (tagEmbedding) {
        case 'external':
          return { [getVariant(this)]: getValue(this).toJSON() }
        case 'internal':
          return Object.assign(getValue(this).toJSON(), { [tagProperty]: getVariant(this) })
        case 'none':
          return getValue(this).toJSON()
      }
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
        return new this(obj, name)
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

  Object.defineProperty(UnionType.prototype, tagProperty, {
    enumerable: true,
    configurable: false,
    get () {
      return getVariant(this)
    }
  })

  return UnionType
}

export default initFactory(union, {
  name: 'union',

  argumentMeta (spec) {
    return {
      tag: spec.tag,
      tagEmbedding: spec.tagEmbedding,
      variants: spec.variants
    }
  },

  prepare (spec, resolver) {
    if (Array.isArray(spec)) {
      spec = { variants: spec }
    }
    let { tagEmbedding = 'external', tag = 'type', variants } = spec

    const allowedEmbeddings = [ 'none', 'internal', 'external' ]
    if (allowedEmbeddings.indexOf(tagEmbedding) < 0) {
      throw new TypeError(`Invalid tag embedding: ${tagEmbedding}; one of ${allowedEmbeddings.join(', ')} expected`)
    }

    variants = validateAndResolveFields(variants, resolver)
    return { tagEmbedding, tag, variants }
  },

  typeTag ({ variants }) {
    return List().withMutations(l => {
      variants.map(({ name, type }) => l.push(name, type))
    })
  }
})

function unionName (variants) {
  const varDescription = variants
    .map(variant => variant.type.inspect())
    .join(' | ')
  return `(${varDescription})`
}
