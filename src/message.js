import * as crypto from './crypto'
import { createType, rawValue } from './lowlevel/common'
import initFactory from './lowlevel/initFactory'

const DEFAULT_NETWORK_ID = 0
const DEFAULT_PROTO_VER = 0

function message ({
  networkId,
  protocolVersion,
  serviceId,
  messageId,
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

  // XXX: revert when meta for struct fields is implemented
  const authorField = undefined

  class MessageType extends createType({
    name: `Message<${BodyType.inspect()}>`,
    typeLength: BodyType.typeLength() === undefined
      ? undefined
      : (headLength + BodyType.typeLength() + sigLength)
  }) {
    constructor ({ body, signature }) {
      signature = signature ? Signature.from(signature) : undefined
      super({
        signature,
        body: BodyType.from(body)
      }, null)
    }

    header () {
      return new MessageHeader({
        networkId,
        protocolVersion,
        serviceId,
        messageId,
        payloadLength: this.byteLength()
      })
    }

    body () {
      return rawValue(this).body
    }

    signature () {
      return rawValue(this).signature
    }

    bodyLength () {
      return this.body().byteLength()
    }

    serializeForSigning () {
      const buffer = new Uint8Array(this.byteLength() - sigLength)
      this.header().serialize(buffer.subarray(0, headLength))
      this.body()._doSerialize(buffer.subarray(headLength), { offset: headLength })
      return buffer
    }

    _doSerialize (buffer) {
      if (!this.signature()) {
        throw new Error('Attempt to serialize unsigned message')
      }

      this.header().serialize(buffer.subarray(0, headLength))
      this.body()._doSerialize(buffer.subarray(headLength, buffer.length - sigLength), {
        offset: headLength
      })
      this.signature().serialize(buffer.subarray(buffer.length - sigLength))
    }

    byteLength () {
      return headLength + this.bodyLength() + sigLength
    }

    /**
     * Retrieves the public key, against which the signature of the message will
     * be checked. By default, it is defined as the first field with the `"author"` metadata.
     *
     * @returns {PublicKey}
     */
    author () {
      return this.body()[authorField]
    }

    sign (privateKey) {
      return new MessageType({
        body: this.body(),
        signature: crypto.sign(this.serializeForSigning(), privateKey)
      })
    }

    verify () {
      if (!this.signature()) return false

      return crypto.verify(this.serializeForSigning(),
        this.signature(),
        this.author())
    }

    toJSON () {
      const json = {
        networkId,
        protocolVersion,
        serviceId,
        messageId,
        body: this.body().toJSON()
      }

      if (this.signature()) {
        json.signature = this.signature().toJSON()
      }

      return json
    }

    toString () {
      return `Message:${this.body()}`
    }
  }

  return MessageType
}

export default initFactory(message, {
  name: 'message',

  prepare ({
    networkId = DEFAULT_NETWORK_ID,
    protocolVersion = DEFAULT_PROTO_VER,
    serviceId,
    messageId,
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
      body
    }
  }
})
