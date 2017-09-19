import struct from './lowlevel/struct'
import * as crypto from './crypto'
import { initType } from './lowlevel/common'
import initFactory from './lowlevel/initFactory'
import std, { resolver } from './std'

const { Signature } = std

const DEFAULT_NETWORK_ID = 0
const DEFAULT_PROTO_VER = 0

function message ({
  networkId = DEFAULT_NETWORK_ID,
  protocolVersion = DEFAULT_PROTO_VER,
  serviceId,
  messageId,
  name = 'Message',
  body: BodyType
}, resolver) {
  // Allow to specify message body as a `struct` specification
  BodyType = Array.isArray(BodyType)
    ? struct(BodyType, resolver)
    : resolver.resolve(BodyType)

  let authorFields = [] // XXX: revert BodyType.filter(field => field.author === true)
  if (authorFields.length > 1) {
    throw new Error('Multiple author fields in message body')
  }
  const authorField = authorFields[0]

  const MessageType = initType(class {
    constructor (body, maybeSignature) {
      this.body = BodyType.from(body)
      if (maybeSignature) {
        this.signature = Signature.from(maybeSignature)
      }
    }

    header () {
      return new MessageHeader({
        networkId,
        protocolVersion,
        serviceId,
        messageId,
        length: this.bodyLength()
      })
    }

    bodyLength () {
      return this.body.byteLength()
    }

    serializeForSigning () {
      const buffer = new Uint8Array(this.byteLength() - sigLength)
      this.header().serialize(buffer.subarray(0, headLength))
      this.body.serialize(buffer.subarray(headLength))
      return buffer
    }

    serialize (buffer) {
      if (!this.signature) {
        throw new Error('Attempt to serialize unsigned message')
      }

      this.header().serialize(buffer.subarray(0, headLength))
      this.body.serialize(buffer.subarray(headLength, buffer.length - sigLength))
      this.signature.serialize(buffer.subarray(buffer.length - sigLength))
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
      return this.body[authorField]
    }

    sign (privateKey) {
      return new MessageType(this.body, crypto.sign(this.serializeForSigning(), privateKey))
    }

    verify () {
      if (!this.__signature) return false
      return crypto.verify(this.serializeForSigning(),
        this.signature,
        this.author())
    }

    toJSON () {
      const json = {
        networkId,
        protocolVersion,
        serviceId,
        messageId,
        body: this.body.toJSON()
      }

      if (this.signature) {
        json.signature = this.signature.toJSON()
      }

      return json
    }
  }, {
    name,
    byteLength: BodyType.typeLength() === undefined
      ? undefined
      : (headLength + BodyType.typeLength() + sigLength)
  })

  return MessageType
}

export default initFactory(message, {
  name: 'message'
  // TODO: typeTag
})

const MessageHeader = resolver.resolve({
  struct: [
    { name: 'networkId', type: 'Uint8' },
    { name: 'protocolVersion', type: 'Uint8' },
    { name: 'messageId', type: 'Uint16' },
    { name: 'serviceId', type: 'Uint16' },
    { name: 'length', type: 'Uint32' }
  ]
})

const headLength = MessageHeader.typeLength()
const sigLength = Signature.typeLength()
