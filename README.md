# Exonum Serialization for JavaScript

This is the alternative/experimental JavaScript implementation of the type system for
the [Exonum][exonum] framework. It provides a library of standard types
and the ability to define new types (including generic types).

Each Exonum type can be serialized to and deserialized from JSON, and also serialized
into the binary format (but not deserialized from it for the moment).
There are also special types, such as `ListView<E>` and `MapView<K, V>`,
which implement views of Merkelized lists and maps, respectively.

**WORK IN PROGRESS. PLEASE DO NOT USE IN PRODUCTION.**
See [`exonum-client`][exonum-client] for the current stable implementation.

## License

Available under the [Apache-2.0 license](LICENSE).

[exonum]: https://exonum.com/
[exonum-client]: https://github.com/exonum/exonum-client
