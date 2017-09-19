import EventEmitter from 'events'

import { initType, rawValue, setRawValue } from './common'

export function isPlaceholder (maybePlaceholder) {
  return maybePlaceholder && rawValue(maybePlaceholder) &&
    rawValue(maybePlaceholder).placeholder === true
}

export default function placeholder () {
  const emitter = new EventEmitter()

  const Placeholder = initType(class {
    constructor () {
      throw new Error('Placeholders should be replaced with real types')
    }

    static replaceBy (type) {
      this.emit('replace', type)
    }
  }, {
    name: 'Placeholder',
    byteLength: undefined
  })

  setRawValue(Placeholder, { placeholder: true })

  const proxiedMethods = [
    'on',
    'emit'
  ]
  proxiedMethods.forEach(method => {
    Placeholder[method] = emitter[method].bind(emitter)
  })

  return Placeholder
}
