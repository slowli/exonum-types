import { List, Map as ImmutableMap } from 'immutable'

import placeholder from './placeholder'
import initFactory from './initFactory'
import typeParam from './typeParam'
import { isExonumFactory, isExonumType, setKind } from './common'

// Initial factories that are present in every instance of `TypeResolver`
const INIT_FACTORIES = {
  typeParam
}

/**
 * Resolver of Exonum datatypes.
 */
export default class TypeResolver {
  constructor (types, factories) {
    Object.defineProperty(this, 'types', { value: types || new ImmutableMap() })
    Object.defineProperty(this, 'factories', { value: factories || new ImmutableMap(INIT_FACTORIES) })
  }

  /**
   * Adds a named datatype with a "native" JSON implementation (as opposed to parsing
   * the JSON type def with `addAll()`).
   *
   * @param {string} name
   * @param {Class<ExonumType>} type
   * @returns {TypeResolver}
   *   type resolver with the added datatype
   */
  addNativeType (name, type) {
    if (!isExonumType(type)) {
      throw new TypeError('Type needs to be an Exonum type')
    }
    if (this.types.has(name)) {
      throw new Error(`Type ${name} already exists`)
    }

    return new TypeResolver(this.types.set(name, type), this.factories)
  }

  /**
   * Adds several named datatypes with "native" JS implementations.
   *
   * @param {{| [name: string]: Class<ExonumType> |}} types
   * @returns {TypeResolver}
   */
  addNativeTypes (namedTypes) {
    Object.keys(namedTypes).forEach(name => {
      if (this.types.has(name)) {
        throw new Error(`Type ${name} already exists`)
      }

      const type = namedTypes[name]
      if (!isExonumType(type)) {
        throw new TypeError('Type needs to be an Exonum type')
      }
    })

    const newTypes = this.types.merge(namedTypes)
    return new TypeResolver(newTypes, this.factories)
  }

  /**
   * Adds a type factory to the resolver.
   *
   * @param {string} name
   * @param {ExonumFactory} factory
   * @returns {TypeResolver}
   */
  addFactory (name, factory) {
    if (!isExonumFactory(factory)) {
      throw new TypeError('Factory needs to be initialized with `initFactory()`')
    }
    if (this.factories.has(name)) {
      throw new Error(`Factory ${name} already exists`)
    }

    return new TypeResolver(this.types, this.factories.set(name, factory))
  }

  /**
   * Adds several type factories to the resolver.
   *
   * @param {{| [name: string]: ExonumFactory |}} namedFactories
   * @returns {TypeResolver}
   */
  addFactories (namedFactories) {
    Object.keys(namedFactories).forEach(name => {
      if (this.factories.has(name)) {
        throw new Error(`Factory ${name} already exists`)
      }

      const factory = namedFactories[name]
      if (!isExonumFactory(factory)) {
        throw new TypeError(`Factory ${name} needs to be initialized with initFactory()`)
      }
    })

    const newFactories = this.factories.merge(namedFactories)
    return new TypeResolver(this.types, newFactories)
  }

  /**
   * Resolves a type specification to a type. The specification may be an existing
   * type (they just fall through), a name of the type known to this resolver, or
   * a factory invocation in form `{ [factoryName]: arg }`.
   *
   * @param {Class<ExonumType> | string | Object} spec
   * @returns {Class<ExonumType>}
   */
  resolve (spec) {
    if (isExonumType(spec)) {
      return spec
    } if (typeof spec === 'string') {
      // String specification (e.g., 'Uint32')
      const type = this._getType(spec)
      if (!type) {
        throw new Error(`Unknown type name: ${spec}`)
      }

      return type
    } else if (typeof spec === 'object') {
      const keys = Object.keys(spec)
      if (keys.length !== 1) {
        throw new Error('Unexpected type specification; expected an object with exactly 1 key')
      }

      // The specification has the form `{ [factoryName]: factoryArg }`
      const key = keys[0]
      const factory = this._getFactory(key)
      if (!factory) {
        throw new Error(`Unknown factory: ${key}`)
      }

      if (!this._pendingTypes) {
        // Just started type resolution. Create a slot for pending types and safely
        // clean it up afterwards
        try {
          return factory(spec[key], this)
        } finally {
          delete this._pendingTypes
        }
      } else {
        return factory(spec[key], this)
      }
    } else {
      throw new Error('Invalid type specification')
    }
  }

  /**
   * Retrieves the collection of all named types known to this resolver.
   *
   * @returns {Map<string, Class<ExonumType>>}
   */
  namedTypes () {
    return this.types.filter((value, key) => typeof key === 'string')
  }

  /**
   * Retrieves the collection of all named factories known to this resolver.
   *
   * @returns {Map<string, ExonumFactory>}
   */
  namedFactories () {
    return this.factories.map(factory => {
      const fn = (arg) => factory(arg, this)
      setKind(fn, 'factory')
      return fn
    })
  }

  /**
   * Adds types and factories to this resolver.
   *
   * @param {Array<Object> | Object} definitions
   *   type / factory definition, or array of such
   * @returns {TypeResolver}
   *   resolver with updated types / factories
   */
  add (definitions) {
    if (!Array.isArray(definitions)) {
      definitions = [ definitions ]
    }

    definitions.forEach(({ name, factory }, i) => {
      if (typeof name !== 'string') {
        throw new Error(`Name not specified for definition #${i}`)
      }
      if (factory && this.factories.has(name)) {
        throw new Error(`Factory ${name} already exists`)
      } else if (this.types.has(name)) {
        throw new Error(`Type ${name} already exists`)
      }
    })

    const typeNames = definitions.filter(def => !def.factory)
      .map(type => type.name)
    this._pendingTypes = ImmutableMap().withMutations(m => {
      typeNames.forEach(name => {
        m.set(name, placeholder(name, List.of(name)))
      })
    })
    this._pendingFactories = ImmutableMap()

    let newTypes
    let newFactories

    try {
      // Then, create types / factories
      definitions.forEach(def => {
        const name = def.name
        // TODO: parse other metadata (e.g., documentation)

        def = Object.assign({}, def)
        delete def.name

        if (def.factory) {
          this._pendingFactories = this._pendingFactories.set(name,
            createFactory(name, def.factory))
        } else {
          const type = this.resolve(def)
          this._resolvePendingType(name, type)
        }
      })

      newTypes = this.types.merge(this._pendingTypes)
      newFactories = this.factories.merge(this._pendingFactories)
    } finally {
      // Cleanup pending types which otherwise lead to unpredicatble effects
      // and occupy unnecessary memory
      delete this._pendingTypes
      delete this._pendingFactories
    }

    return new TypeResolver(newTypes, newFactories)
  }

  /**
   * Extends the type with the specified name by applying an extend function.
   * The function typically should be constructed as
   *
   * ```javascript
   * function extendFn (Type) {
   *   return class extends Type { ... }
   * }
   * ```
   *
   * For example, you may add new methods or change some serialization rules
   * in the extension.
   *
   * This method does not check that the function output is actually a type extension,
   * so you need to be careful.
   *
   * @param {string} name
   * @param {(Class<ExonumType>) => Class<ExonumType>} extendFn
   * @returns {TypeResolver}
   *   resolver with the type replaced by its extension
   */
  extend (name, extendFn) {
    let Type = this.types.get(name)
    if (!Type) {
      throw new Error(`Type ${name} does not exist`)
    }

    Type = extendFn(Type)
    if (!isExonumType(Type)) {
      throw new TypeError('Extended type needs to be an Exonum type')
    }

    return new TypeResolver(this.types.set(name, Type), this.factories)
  }

  _hasType (name) {
    return this.types.has(name) ||
      (this._pendingTypes && this._pendingTypes.has(name))
  }

  _getType (name) {
    const type = this.types.get(name)
    if (type !== undefined) return type
    if (this._pendingTypes) {
      return this._pendingTypes.get(name)
    }
    return undefined
  }

  _getFactory (name) {
    const factory = this.factories.get(name)
    if (factory !== undefined) return factory
    if (this._pendingFactories) {
      return this._pendingFactories.get(name)
    }
    return undefined
  }

  /**
   * Adds a pending type under a specified key and with a specified name.
   *
   * @param {ValueObject} typeTag
   *   globally unique type identifier
   * @param {string} name
   *   human-readable type name
   */
  _addPendingType (typeTag, name) {
    this._pendingTypes = (this._pendingTypes || ImmutableMap()).set(typeTag,
      placeholder(name, typeTag))
  }

  _resolvePendingType (name, type) {
    this._pendingTypes.get(name).replaceBy(type)
    this._pendingTypes = this._pendingTypes.set(name, type)
  }
}

/**
 * Dummy type resolver. Only resolves existing Exonum types to themselves.
 */
export function dummyResolver () {
  return {
    types: ImmutableMap(),
    pendingTypes: ImmutableMap(),

    resolve (type) {
      if (!isExonumType(type)) {
        throw new Error('Invalid type specified; Exonum type expected')
      }
      return type
    },

    _hasType (name) {
      return false
    },

    _getType (name) {
    },

    _addPendingType (name) {
    },

    _resolvePendingType (name, type) {
    }
  }
}

/**
 * Validates specifications of fields / variants for structs / unions,
 * and resolves types in the field definitions.
 *
 * @param {Array<FieldSpec>} fields
 * @param {TypeResolver} resolver
 * @returns {Array<FieldSpec>} specification with resolved `type` fields.
 *   Some types may be placeholders; they will be replaced with real types
 */
export function validateAndResolveFields (fields, resolver) {
  const definedNames = []
  const resolvedFields = []

  fields.forEach((prop, i) => {
    if (typeof prop.name !== 'string') {
      throw new TypeError(`No property name specified for property #${i}`)
    }
    if (definedNames.indexOf(prop.name) >= 0) {
      throw new TypeError(`Property redefined: ${prop.name}`)
    }
    definedNames.push(prop.name)

    if (!prop.type) {
      throw new TypeError(`No property type specified for property #${i}`)
    }

    const resolvedProp = Object.assign({}, prop)
    resolvedProp.type = resolver.resolve(prop.type)
    resolvedFields.push(resolvedProp)
  })

  return resolvedFields
}

/**
 * Creates a factory with the specified name and specification.
 *
 * @param {string} factoryName
 * @param {Object} spec
 * @returns {ExonumFactory}
 */
function createFactory (factoryName, spec) {
  const { typeParams } = spec

  const definition = Object.assign({}, spec)
  delete definition.typeParams

  if (!Array.isArray(typeParams)) {
    throw new Error('Invalid factory spec; typeParams field is not an array')
  }

  typeParams.forEach(({ name, type }) => {
    if (typeof name !== 'string') {
      throw new Error('Missing name for a type param in factory spec')
    }
  })

  function factory (arg, resolver) {
    typeParam.push(resolver, factoryName, arg)

    try {
      return resolver.resolve(definition)
    } finally {
      typeParam.pop(resolver, factoryName)
    }
  }

  return initFactory(factory, {
    name: factoryName,

    /**
     * Validates type parameter specification and resolve them to Exonum types.
     *
     * @param {TypeSpec | {[key: string]: TypeSpec}} arg
     *   If there is a single type parameter in the spec, this should be this parameter.
     *   Otherwise, this should be an object with properties corresponding to parameter names.
     * @param {TypeResolver} resolver
     */
    prepare (arg, resolver) {
      if (typeParams.length === 1) {
        arg = { [typeParams[0].name]: arg }
      }

      const resolvedParams = {}
      typeParams.forEach(({ name }) => {
        if (!(name in arg)) {
          throw new Error(`Missing type parameter ${name}`)
        }

        resolvedParams[name] = resolver.resolve(arg[name])
      })

      return resolvedParams
    },

    typeTag (arg) {
      return List(typeParams.map(({ name }) => arg[name]))
    },

    typeName (arg) {
      const typeDescription = typeParams.map(({ name }) => arg[name].inspect()).join(', ')
      return `${factoryName}<${typeDescription}>`
    }
  })
}
