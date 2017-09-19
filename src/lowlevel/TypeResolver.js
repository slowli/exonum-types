import { Map as ImmutableMap } from 'immutable'

import placeholder, { isPlaceholder } from './placeholder'
import { isExonumFactory, isExonumType, setKind } from './common'
import { parseUnion } from './union'

const FACTORY_MARKER = 'type'

/**
 * Resolver of datatypes. The resolver is a singleton
 */
export default class TypeResolver {
  constructor (types, factories) {
    Object.defineProperty(this, 'types', { value: types || new ImmutableMap() })
    Object.defineProperty(this, 'factories', { value: factories || new ImmutableMap() })
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

  resolve (type, callback) {
    type = createType.call(this, type)
    if (isPlaceholder(type)) {
      if (!callback) {
        // Resolved type is placeholder, but there is no callback to replace it in the future
        // XXX: warn somehow?
      } else {
        type.on('replace', callback)
      }
    }

    if (callback) callback(type)
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
    let type = this.types.get(name)
    if (type !== undefined) return type
    if (this._pendingTypes) {
      return this._pendingTypes.get(name)
    }
    return undefined
  }

  _addPendingType (name) {
    if (!this._pendingTypes) {
      // `_addPendingType` invoked outside of `addTypes()`.
      // This is probably not a problem
      return
    }

    this._pendingTypes = this._pendingTypes.set(name, placeholder())
  }

  _resolvePendingType (name, type) {
    if (!this._pendingTypes) {
      // `_resolvePendingType` invoked outside of `addTypes()`
      return
    }

    this._pendingTypes.get(name).replaceBy(type)
    this._pendingTypes = this._pendingTypes.set(name, type)
  }

  addTypes (types) {
    const typeNames = types.map(type => type.name)
    this._pendingTypes = ImmutableMap().withMutations(m => {
      typeNames.forEach(name => {
        m.set(name, placeholder())
      })
    })

    // Then, create types
    types.forEach(type => {
      const name = type.name
      // TODO: parse other metadata (e.g., documentation)

      type = createType.call(this, type)
      this._resolvePendingType(name, type)
    })

    const newTypes = this.types.mergeWith((oldVal, newVal, key) => {
      throw new Error(`Type ${key} already exists`)
    }, this._pendingTypes)

    delete this._pendingTypes
    return new TypeResolver(newTypes, this.factories)
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
    resolver.resolve(prop.type, type => { resolvedProp.type = type })
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
    const type = this.types.get(spec) ||
      this._pendingTypes.get(spec)
    if (!type) {
      throw new Error(`Unknown type name: ${spec}`)
    }
    return type
  } else if (typeof spec === 'object') {
    // We have a generic type
    let factory = parseUnion(spec, FACTORY_MARKER, this.factories.keySeq())

    if (factory) {
      let arg = factory[1]
      factory = this.factories.get(factory[0])
      return factory(arg, this)
    } else {
      // TODO: try to guess the missing type factory
      throw new Error('Cannot find type factory')
    }
  } else {
    throw new Error('Invalid type specification')
  }
}
