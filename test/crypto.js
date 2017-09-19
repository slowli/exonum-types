/* eslint-env mocha */

import chai from 'chai'
import chaiBytes from 'chai-bytes'
import dirtyChai from 'dirty-chai'

import fixedBuffer from '../src/lowlevel/fixedBuffer'
import { resolver } from '../src/std'
import { hash } from '../src/crypto'

const expect = chai
  .use(chaiBytes)
  .use(dirtyChai)
  .expect

describe('hash', () => {
  const SequenceType = resolver.resolve({
    struct: [
      { name: 'foo', type: { buffer: 4 } },
      { name: 'bar', type: 'Uint32' }
    ]
  })

  const Wallet = resolver.resolve({
    struct: [
      { name: 'pubkey', type: 'PublicKey' },
      { name: 'name', type: 'Str' },
      { name: 'balance', type: 'Uint64' },
      { name: 'history_hash', type: 'Hash' }
    ]
  })

  it('should calculate hash correctly for raw Uint8Array', () => {
    const buffer = Uint8Array.of(0xde, 0xad, 0xbe, 0xef, 0x2b, 0x02, 0x00, 0x00)
    expect(hash(buffer)).to.equalBytes(
      '739b3099b5fb4f2d51d02404e3e4383be880e16e2c2f1656a97ca27971777003')
  })

  it('should calculate hash correctly for buffer type', () => {
    const buffer = new (fixedBuffer(8))('deadbeef2b020000')
    expect(hash(buffer)).to.equalBytes(
      '739b3099b5fb4f2d51d02404e3e4383be880e16e2c2f1656a97ca27971777003')
  })

  it('should calculate hash correctly for complex type', () => {
    const x = new SequenceType('deadbeef', 555)
    // SHA256(0xdeadbeef2b020000)
    expect(hash(x)).to.equalBytes(
      '739b3099b5fb4f2d51d02404e3e4383be880e16e2c2f1656a97ca27971777003')
  })

  it('should calculate hash correctly for multiple fragments', () => {
    const digest = hash(fixedBuffer(4).from('deadbeef'), Uint8Array.of(0x2b, 0x02, 0, 0))
    expect(digest).to.equalBytes(
      '739b3099b5fb4f2d51d02404e3e4383be880e16e2c2f1656a97ca27971777003')
  })

  it('should calculate hash correctly for wallet type', () => {
    const wallet = new Wallet({
      pubkey: 'f5864ab6a5a2190666b47c676bcf15a1f2f07703c5bcafb5749aa735ce8b7c36',
      name: 'Smart wallet',
      balance: 359120,
      history_hash: '6752BE882314F5BBBC9A6AF2AE634FC07038584A4A77510EA5ECED45F54DC030'
    })
    expect(hash(wallet)).to.equalBytes(
      '86b47510fbcbc83f9926d8898a57c53662518c97502625a6d131842f2003f974')
  })
})
