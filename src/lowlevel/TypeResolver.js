import { List, Stack, Map as ImmutableMap } from 'immutable'

import placeholder from './placeholder'
import initFactory from './initFactory'
import { isExonumFactory, isExonumType, setKind } from './common'

// Initial factories that are present in every instance of `TypeResolver`
const INIT_FACTORIES = {
  typeParam
}

/**
 * Resolver of datatypes. The resolver is a singleton
 */
export default class TypeResolver {
  constructor (types, factories) {
    Object.defineProperty(this, 'types', { value: types || new ImmutableMap() })
    Object.defineProperty(this, 'factories', { value: factories || new ImmutableMap(INIT_FACTORIES) })
  }

  addNativeType (name, type) {
    if (!isExonumType(type)) {
      throw new TypeError('Type needs to be an Exonum type')
    }
    if (this.types.has(name)) {
      throw new Error(`Type ${name} already exists`)
    }

    return new TypeResolver(this.types.set(name, type), this.factories)
  }

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

  addFactory (name, factory) {
    if (!isExonumFactory(factory)) {
      throw new TypeError('Factory needs to be initialized with `initFactory()`')
    }
    if (this.factories.has(name)) {
      throw new Error(`Factory ${name} already exists`)
    }

    return new TypeResolver(this.types, this.factories.set(name, factory))
  }

  addFactories (namedFactories) {
    Object.keys(namedFactories).forEach(name => {
      if (this.factories.has(name)) {
        throw new Error(`Factory ${name} already exists`)
      }

      const factory = namedFactories[name]
      if (!isExonumFactory(factory)) {
        throw new TypeError('Factory needs to be initialized with `initFactory()`')
      }
    })

    const newFactories = this.factories.merge(namedFactories)
    return new TypeResolver(this.types, newFactories)
  }

  resolve (type) {
    type = createType.call(this, type)
    return type
  }

  namedTypes () {
    return this.types.filter((value, key) => typeof key === 'string')
  }

  namedFactories () {
    return this.factories.map(factory => {
      const fn = (arg) => factory(arg, this)
      setKind(fn, 'factory')
      return fn
    })
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
    if (!this._pendingTypes) {
      // `_resolvePendingType` invoked outside of `addTypes()`
      return
    }

    this._pendingTypes.get(name).replaceBy(type)
    this._pendingTypes = this._pendingTypes.set(name, type)
  }

  _bindTypeParams (factoryName, params) {
    Object.keys(params).forEach(name => {
      const Type = params[name]

      if (!isExonumType(Type)) {
        throw new TypeError('`_bindTypeParams` should bind Exonum types')
      }

      const key = List.of(factoryName, name)

      if (this._typeParams && this._typeParams.has(key)) {
        throw new Error(`Attempt to rebind type param ${name} in ${factoryName}; old value: ${this._typeParams.get(key)}, new value: ${Type}`)
      }
    })

    this._typeParams = (this._typeParams || ImmutableMap()).merge(
      Object.keys(params).map(name => [List.of(factoryName, name), params[name]])
    )

    this._factoryStack = (this._factoryStack || Stack()).push(factoryName)
  }

  _unbindTypeParams (factoryName) {
    if (this._factoryStack.peek() !== factoryName) {
      throw new Error(`Attempt to unbind type params for a wrong factory: ${factoryName} when ${this._factoryStack.peek()} was expected`)
    }

    this._factoryStack = this._factoryStack.pop()
    this._typeParams = this._typeParams.filterNot((_, key) => key.get(0) === factoryName)
  }

  addTypes (types) {
    // TODO: check existing types and factories

    const typeNames = types.filter(type => !type.factory)
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
      // Then, create types
      types.forEach(type => {
        const name = type.name
        // TODO: parse other metadata (e.g., documentation)

        type = Object.assign({}, type)
        delete type.name

        if (type.factory) {
          this._pendingFactories = this._pendingFactories.set(name,
            createFactory(name, type.factory))
        } else {
          type = createType.call(this, type)
          this._resolvePendingType(name, type)
        }
      })

      newTypes = this.types.mergeWith((oldVal, newVal, key) => {
        throw new Error(`Type ${key} already exists`)
      }, this._pendingTypes)

      newFactories = this.factories.mergeWith((oldVal, newVal, key) => {
        throw new Error(`Factory ${key} already exists`)
      }, this._pendingFactories)
    } finally {
      // Cleanup pending types which otherwise lead to unpredicatble effects
      // and occupy unnecessary memory
      delete this._pendingTypes
      delete this._pendingFactories
    }

    return new TypeResolver(newTypes, newFactories)
  }
}

/**
 * Dummy type resolver. Only resolves existing Exonum types to themselves.
 */
export function dummyResolver () {
  return {
    types: ImmutableMap(),
    pendingTypes: ImmutableMap(),

    resolve (type, callback) {
      if (!isExonumType(type)) {
        throw new Error('Invalid type specified; Exonum type expected')
      }

      if (callback) callback(type)
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
 * and resolves types in the field defintions.
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
 * @param {this} TypeResolver
 */
function createType (spec) {
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

    return factory(spec[key], this)
  } else {
    throw new Error('Invalid type specification')
  }
}

/**
 * Type parameter factory.
 *
 * @param {string} arg
 *   name of the parameter to look up
 */
function typeParam (arg, resolver) {
  if (!resolver._factoryStack) {
    throw new Error('Type param outside of factory declaration')
  }
  const factory = resolver._factoryStack.peek()
  if (!factory) {
    throw new Error('Type param outside of factory declaration')
  }

  const type = resolver._typeParams.get(List.of(factory, arg))
  if (!type) {
    throw new Error(`Type param not bound: ${arg} in ${factory}`)
  }

  return type
}

setKind(typeParam, 'factory')

/**
 * Validates type parameter specification and resolve them to Exonum types.
 *
 * @param {TypeSpec | {[key: string]: TypeSpec}} params
 *   If there is a single type parameter in the spec, this should be this parameter.
 *   Otherwise, this should be an object with properties corresponding to parameter names.
 * @param {Array<{name: string}>} spec
 * @param {TypeResolver} resolver
 */
function validateAndResolveParams (params, spec, resolver) {
  if (spec.length === 1) {
    params = { [spec[0].name]: params }
  }

  const resolvedParams = {}
  spec.forEach(({ name }) => {
    if (!(name in params)) {
      throw new Error(`Missing type parameter ${name}`)
    }

    resolvedParams[name] = resolver.resolve(params[name])
  })

  return resolvedParams
}

function createFactory (factoryName, spec) {
  const { typeParams } = spec

  const description = Object.assign({}, spec)
  delete description.typeParams

  if (!Array.isArray(typeParams)) {
    throw new Error('Invalid factory spec; typeParams field is not an array')
  }

  typeParams.forEach(({ name, type }) => {
    if (typeof name !== 'string') {
      throw new Error('Missing name for a type param in factory spec')
    }
  })

  function factory (arg, resolver) {
    resolver._bindTypeParams(factoryName, arg)

    try {
      return resolver.resolve(description)
    } finally {
      resolver._unbindTypeParams(factoryName)
    }
  }

  return initFactory(factory, {
    name: factoryName,

    prepare (arg, resolver) {
      return validateAndResolveParams(arg, typeParams, resolver)
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
