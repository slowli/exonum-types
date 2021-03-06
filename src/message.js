import * as crypto from './crypto'
import initFactory from './lowlevel/initFactory'

const DEFAULT_NETWORK_ID = 0
const DEFAULT_PROTO_VER = 0

// Fields in the messages that should not be settable via `.set()` method
const READONLY_FIELDS = [
  'networkId',
  'protocolVersion',
  'messageId',
  'serviceId'
]

function message ({
  networkId,
  protocolVersion,
  serviceId,
  messageId,
  author: authorField,
  body: BodyType
}, resolver) {
  const MessageHeader = resolver.resolve({
    struct: [
      { name: 'networkId', type: 'Uint8' },
      { name: 'protocolVersion', type: 'Uint8' },
      { name: 'messageId', type: 'Uint16' },
      { name: 'serviceId', type: 'Uint16' },
      { name: 'payloadLength', type: 'Uint32' }
    ]
  })
  const headLength = MessageHeader.typeLength()

  const Signature = resolver.resolve('Signature')
  const sigLength = Signature.typeLength()

  class MessageType extends resolver.resolve({
    struct: [
      { name: 'networkId', type: 'Uint8' },
      { name: 'protocolVersion', type: 'Uint8' },
      { name: 'messageId', type: 'Uint16' },
      { name: 'serviceId', type: 'Uint16' },
      { name: 'body', type: BodyType },
      { name: 'signature', type: 'Signature' }
    ]
  }) {
    static typeLength () {
      return BodyType.typeLength() === undefined
        ? undefined
        : (headLength + BodyType.typeLength() + sigLength)
    }

    /**
     * Creates a new unsigned message with the specified body content.
     */
    static fromBody (body) {
      return new this({ body })
    }

    constructor ({ body, signature = Signature.ZEROS }) {
      super({
        networkId,
        protocolVersion,
        messageId,
        serviceId,
        body,
        signature
      })
    }

    set (name, value) {
      if (READONLY_FIELDS.indexOf(name) >= 0) {
        throw new TypeError(`Cannot set field ${name}, it is readonly`)
      }
      return super.set(name, value)
    }

    serializeForSigning () {
      const buffer = new Uint8Array(this.byteLength() - sigLength)

      header(this.byteLength()).serialize(buffer.subarray(0, headLength))
      this.body._doSerialize(buffer.subarray(headLength), { offset: headLength })

      return buffer
    }

    _doSerialize (buffer) {
      header(this.byteLength()).serialize(buffer.subarray(0, headLength))

      this.body._doSerialize(buffer.subarray(headLength, buffer.length - sigLength), {
        offset: headLength
      })

      this.getOriginal('signature').serialize(buffer.subarray(buffer.length - sigLength))
    }

    byteLength () {
      return headLength + this.body.byteLength() + sigLength
    }

    /**
     * Retrieves the public key, against which the signature of the message will
     * be checked. If the message declaration contains `author`, it is treated
     * as the name of the field in the message body that should be accessed to get author.
     * Otherwise, `author()` returns `undefined` and should be overridden in child
     * classes.
     *
     * @returns {?PublicKey}
     */
    author () {
      return this.body[authorField]
    }

    sign (privateKey) {
      return new this.constructor({
        body: this.body,
        signature: crypto.sign(this.serializeForSigning(), privateKey)
      })
    }

    verify () {
      if (!this.author()) {
        return false
      }
      if (this.getOriginal('signature').equals(Signature.ZEROS)) {
        return false
      }

      return crypto.verify(this.serializeForSigning(),
        this.signature,
        this.author())
    }

    toString () {
      return `Message:${this.body}`
    }
  }

  function header (payloadLength) {
    return new MessageHeader({
      networkId,
      protocolVersion,
      serviceId,
      messageId,
      payloadLength
    })
  }

  return MessageType
}

export default initFactory(message, {
  name: 'message',

  argumentMeta (spec) {
    return Object.assign({}, spec)
  },

  prepare ({
    networkId = DEFAULT_NETWORK_ID,
    protocolVersion = DEFAULT_PROTO_VER,
    serviceId,
    messageId,
    author,
    body
  }, resolver) {
    // Allow to specify message body as a `struct` specification
    body = Array.isArray(body)
      ? resolver.resolve({ struct: body })
      : resolver.resolve(body)

    return {
      networkId,
      protocolVersion,
      serviceId,
      messageId,
      author,
      body
    }
  }
})
