import { createType } from './common'

// XXX: this *seems* to work, but maybe a full replacement is still required.

const PROXIED_METHODS = [
  'toString',
  'inspect'
]

/**
 * Placeholders are used internally during processing type declarations to create
 * recursive types. A placeholder are then replaced by the real type using
 * the `replaceBy(Type)` method.
 */
export default function placeholder (typeName, typeTag) {
  let Replacement = null

  class Placeholder extends createType({
    name: typeName,
    typeLength: undefined
  }) {
    static typeTag () {
      return typeTag
    }

    static replaceBy (type) {
      if (Replacement) {
        throw new Error('Attempt to replace the placeholder when it is already replaced')
      }
      Replacement = type

      PROXIED_METHODS.forEach(name => {
        Object.defineProperty(this, name, {
          enumerable: false,
          configurable: true,
          value: type[name]
        })
      })
    }

    constructor (...args) {
      super()
      if (!Replacement) {
        throw new Error('Placeholders should be replaced with real types')
      }
      return new Replacement(...args)
    }
  }

  return Placeholder
}
