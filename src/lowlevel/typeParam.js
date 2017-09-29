import { List, Stack, Map as ImmutableMap } from 'immutable'
import { setKind } from './common'

/**
 * Type parameter factory intended to resolve type parameters in factory declarations.
 * Should be used only internally.
 *
 * @param {string} arg
 *   name of the parameter to look up
 */
export default function typeParam (arg, resolver) {
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

function pushTypeParams (resolver, factoryName, params) {
  Object.keys(params).forEach(name => {
    const Type = params[name]
    const key = List.of(factoryName, name)

    if (resolver._typeParams && resolver._typeParams.has(key)) {
      throw new Error(`Attempt to rebind type param ${name} in ${factoryName}; old value: ${resolver._typeParams.get(key)}, new value: ${Type}`)
    }
  })

  resolver._typeParams = (resolver._typeParams || ImmutableMap()).merge(
    Object.keys(params).map(name => [List.of(factoryName, name), params[name]])
  )

  resolver._factoryStack = (resolver._factoryStack || Stack()).push(factoryName)
}

function popTypeParams (resolver, factoryName) {
  if (resolver._factoryStack.peek() !== factoryName) {
    throw new Error(`Attempt to unbind type params for a wrong factory: ${factoryName} when ${resolver._factoryStack.peek()} was expected`)
  }

  resolver._factoryStack = resolver._factoryStack.pop()
  resolver._typeParams = resolver._typeParams.filterNot((_, key) => key.get(0) === factoryName)
}

typeParam.push = pushTypeParams
typeParam.pop = popTypeParams
