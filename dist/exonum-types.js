(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('sha.js'), require('tweetnacl'), require('immutable'), require('big-integer')) :
	typeof define === 'function' && define.amd ? define(['exports', 'sha.js', 'tweetnacl', 'immutable', 'big-integer'], factory) :
	(factory((global['exonum-types'] = {}),global.sha,global.nacl,global.immutable,global.bigInt));
}(this, (function (exports,sha,nacl,immutable,bigInt) { 'use strict';

sha = sha && sha.hasOwnProperty('default') ? sha['default'] : sha;
nacl = nacl && nacl.hasOwnProperty('default') ? nacl['default'] : nacl;
bigInt = bigInt && bigInt.hasOwnProperty('default') ? bigInt['default'] : bigInt;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
  return typeof obj;
} : function (obj) {
  return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
};





var asyncGenerator = function () {
  function AwaitValue(value) {
    this.value = value;
  }

  function AsyncGenerator(gen) {
    var front, back;

    function send(key, arg) {
      return new Promise(function (resolve, reject) {
        var request = {
          key: key,
          arg: arg,
          resolve: resolve,
          reject: reject,
          next: null
        };

        if (back) {
          back = back.next = request;
        } else {
          front = back = request;
          resume(key, arg);
        }
      });
    }

    function resume(key, arg) {
      try {
        var result = gen[key](arg);
        var value = result.value;

        if (value instanceof AwaitValue) {
          Promise.resolve(value.value).then(function (arg) {
            resume("next", arg);
          }, function (arg) {
            resume("throw", arg);
          });
        } else {
          settle(result.done ? "return" : "normal", result.value);
        }
      } catch (err) {
        settle("throw", err);
      }
    }

    function settle(type, value) {
      switch (type) {
        case "return":
          front.resolve({
            value: value,
            done: true
          });
          break;

        case "throw":
          front.reject(value);
          break;

        default:
          front.resolve({
            value: value,
            done: false
          });
          break;
      }

      front = front.next;

      if (front) {
        resume(front.key, front.arg);
      } else {
        back = null;
      }
    }

    this._invoke = send;

    if (typeof gen.return !== "function") {
      this.return = undefined;
    }
  }

  if (typeof Symbol === "function" && Symbol.asyncIterator) {
    AsyncGenerator.prototype[Symbol.asyncIterator] = function () {
      return this;
    };
  }

  AsyncGenerator.prototype.next = function (arg) {
    return this._invoke("next", arg);
  };

  AsyncGenerator.prototype.throw = function (arg) {
    return this._invoke("throw", arg);
  };

  AsyncGenerator.prototype.return = function (arg) {
    return this._invoke("return", arg);
  };

  return {
    wrap: function (fn) {
      return function () {
        return new AsyncGenerator(fn.apply(this, arguments));
      };
    },
    await: function (value) {
      return new AwaitValue(value);
    }
  };
}();





var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();





var defineProperty = function (obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
};

var get = function get(object, property, receiver) {
  if (object === null) object = Function.prototype;
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent === null) {
      return undefined;
    } else {
      return get(parent, property, receiver);
    }
  } else if ("value" in desc) {
    return desc.value;
  } else {
    var getter = desc.get;

    if (getter === undefined) {
      return undefined;
    }

    return getter.call(receiver);
  }
};

var inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
};











var possibleConstructorReturn = function (self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return call && (typeof call === "object" || typeof call === "function") ? call : self;
};

var EXONUM_KIND_PROP = typeof Symbol !== 'undefined' ? Symbol.for('exonum.kind') : '__exonumKind';
var EXONUM_RAW_PROP = typeof Symbol !== 'undefined' ? Symbol.for('exonum.raw') : '__exonumRaw';
function getKind(obj) {
  return !obj ? undefined : obj[EXONUM_KIND_PROP];
}
function setKind(obj, kind) {
  Object.defineProperty(obj, EXONUM_KIND_PROP, { value: kind });
  return obj;
}
function isExonumFactory(maybeExonumFactory) {
  return typeof maybeExonumFactory === 'function' && getKind(maybeExonumFactory) === 'factory';
}
function isExonumType(maybeExonumType) {
  return getKind(maybeExonumType) === 'type';
}
function isExonumObject(maybeExonumObj) {
  return getKind(maybeExonumObj) === 'object';
}
function setRawValue(obj, raw, clone) {
  Object.defineProperty(obj, EXONUM_RAW_PROP, { value: { data: raw, clone: clone } });
}
function rawValue(obj) {
  var externalUse = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
  if (!obj[EXONUM_RAW_PROP]) {
    return undefined;
  }
  return externalUse ? obj[EXONUM_RAW_PROP].clone() : obj[EXONUM_RAW_PROP].data;
}
function rawOrSelf(obj) {
  var externalUse = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
  if (obj && obj[EXONUM_RAW_PROP] !== undefined) {
    if (externalUse && !obj[EXONUM_RAW_PROP].clone) {
      return obj;
    }
    return rawValue(obj, externalUse);
  }
  return obj;
}
var memoize = function () {
  var memoizeCounter = 0;
  return function (fn) {
    memoizeCounter += 1;
    var slotName = memoizeCounter;
    return function () {
      if (!this.__memoize) this.__memoize = {};
      if (!this.__memoize[slotName]) {
        this.__memoize[slotName] = fn.call(this);
      }
      return this.__memoize[slotName];
    };
  };
}();
function createType(_ref) {
  var _ref$name = _ref.name,
      name = _ref$name === undefined ? '[Exonum type]' : _ref$name,
      _ref$typeTag = _ref.typeTag,
      _typeTag = _ref$typeTag === undefined ? immutable.List.of(name) : _ref$typeTag,
      _ref$typeLength = _ref.typeLength,
      _typeLength = _ref$typeLength === undefined ? undefined : _ref$typeLength,
      _ref$proxiedMethods = _ref.proxiedMethods,
      proxiedMethods = _ref$proxiedMethods === undefined ? [] : _ref$proxiedMethods,
      _ref$kind = _ref.kind,
      kind = _ref$kind === undefined ? 'type' : _ref$kind;
  var ExonumType = function () {
    createClass(ExonumType, null, [{
      key: 'inspect',
      value: function inspect() {
        return this.toString();
      }
    }, {
      key: 'toString',
      value: function toString() {
        return name;
      }
    }, {
      key: 'typeLength',
      value: function typeLength() {
        return _typeLength;
      }
    }, {
      key: 'typeTag',
      value: function typeTag() {
        return _typeTag;
      }
    }, {
      key: 'meta',
      value: function meta() {
        return {};
      }
    }, {
      key: 'hashCode',
      value: function hashCode() {
        return this.typeTag().hashCode();
      }
    }, {
      key: 'equals',
      value: function equals(other) {
        if (!isExonumType(other)) return false;
        return this.typeTag().equals(other.typeTag());
      }
    }, {
      key: 'from',
      value: function from(maybeInstance) {
        if (arguments.length === 1 && maybeInstance instanceof this) {
          return maybeInstance;
        }
        return new (Function.prototype.bind.apply(this, [null].concat(Array.prototype.slice.call(arguments))))();
      }
    }]);
    function ExonumType(rawValue) {
      var clone = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function () {
        return rawValue;
      };
      classCallCheck(this, ExonumType);
      if (rawValue !== undefined) {
        setRawValue(this, rawValue, clone);
      }
    }
    createClass(ExonumType, [{
      key: 'byteLength',
      value: function byteLength() {
        return _typeLength;
      }
    }, {
      key: 'serialize',
      value: function serialize(buffer) {
        if (!buffer) buffer = new Uint8Array(this.byteLength());
        this._doSerialize(buffer);
        return buffer;
      }
    }, {
      key: '_doSerialize',
      value: function _doSerialize(buffer) {
        throw new Error('Not implemented; please redefine `_doSerialize()` in child classes');
      }
    }, {
      key: 'toJSON',
      value: function toJSON() {
        throw new Error('Not implemented; please redefine `toJSON()` in child classes');
      }
    }]);
    return ExonumType;
  }();
  Object.defineProperty(ExonumType, EXONUM_KIND_PROP, { value: kind });
  Object.defineProperty(ExonumType.prototype, EXONUM_KIND_PROP, { value: 'object' });
  proxiedMethods.forEach(function (name) {
    ExonumType.prototype[name] = function () {
      var raw = rawValue(this);
      return raw[name].apply(raw, arguments);
    };
  });
  return ExonumType;
}
function getMethodNames(obj) {
  return Object.getOwnPropertyNames(obj).filter(function (name) {
    var descriptor = Object.getOwnPropertyDescriptor(obj, name);
    return name !== 'constructor' && name[0] !== '_' && typeof descriptor.value === 'function';
  });
}

var PROXIED_METHODS = ['toString', 'inspect'];
function placeholder(typeName, _typeTag) {
  var Replacement = null;
  var Placeholder = function (_createType) {
    inherits(Placeholder, _createType);
    createClass(Placeholder, null, [{
      key: 'typeTag',
      value: function typeTag() {
        return _typeTag;
      }
    }, {
      key: 'replaceBy',
      value: function replaceBy(type) {
        var _this2 = this;
        if (Replacement) {
          throw new Error('Attempt to replace the placeholder when it is already replaced');
        }
        Replacement = type;
        PROXIED_METHODS.forEach(function (name) {
          Object.defineProperty(_this2, name, {
            enumerable: false,
            configurable: true,
            value: type[name]
          });
        });
      }
    }]);
    function Placeholder() {
      var _ret;
      classCallCheck(this, Placeholder);
      var _this = possibleConstructorReturn(this, (Placeholder.__proto__ || Object.getPrototypeOf(Placeholder)).call(this));
      if (!Replacement) {
        throw new Error('Placeholders should be replaced with real types');
      }
      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }
      return _ret = new (Function.prototype.bind.apply(Replacement, [null].concat(args)))(), possibleConstructorReturn(_this, _ret);
    }
    return Placeholder;
  }(createType({
    name: typeName,
    typeLength: undefined
  }));
  return Placeholder;
}

function typeParam(arg, resolver) {
  if (!resolver._factoryStack) {
    throw new Error('Type param outside of factory declaration');
  }
  var factory = resolver._factoryStack.peek();
  if (!factory) {
    throw new Error('Type param outside of factory declaration');
  }
  var type = resolver._typeParams.get(immutable.List.of(factory, arg));
  if (!type) {
    throw new Error('Type param not bound: ' + arg + ' in ' + factory);
  }
  return type;
}
setKind(typeParam, 'factory');
function pushTypeParams(resolver, factoryName, params) {
  Object.keys(params).forEach(function (name) {
    var Type = params[name];
    var key = immutable.List.of(factoryName, name);
    if (resolver._typeParams && resolver._typeParams.has(key)) {
      throw new Error('Attempt to rebind type param ' + name + ' in ' + factoryName + '; old value: ' + resolver._typeParams.get(key) + ', new value: ' + Type);
    }
  });
  resolver._typeParams = (resolver._typeParams || immutable.Map()).merge(Object.keys(params).map(function (name) {
    return [immutable.List.of(factoryName, name), params[name]];
  }));
  resolver._factoryStack = (resolver._factoryStack || immutable.Stack()).push(factoryName);
}
function popTypeParams(resolver, factoryName) {
  if (resolver._factoryStack.peek() !== factoryName) {
    throw new Error('Attempt to unbind type params for a wrong factory: ' + factoryName + ' when ' + resolver._factoryStack.peek() + ' was expected');
  }
  resolver._factoryStack = resolver._factoryStack.pop();
  resolver._typeParams = resolver._typeParams.filterNot(function (_, key) {
    return key.get(0) === factoryName;
  });
}
typeParam.push = pushTypeParams;
typeParam.pop = popTypeParams;

var INIT_FACTORIES = {
  typeParam: typeParam
};
var TypeResolver = function () {
  function TypeResolver(types, factories) {
    classCallCheck(this, TypeResolver);
    Object.defineProperty(this, 'types', { value: types || new immutable.Map() });
    Object.defineProperty(this, 'factories', { value: factories || new immutable.Map(INIT_FACTORIES) });
  }
  createClass(TypeResolver, [{
    key: 'addNativeType',
    value: function addNativeType(name, type) {
      if (!isExonumType(type)) {
        throw new TypeError('Type needs to be an Exonum type');
      }
      if (this.types.has(name)) {
        throw new Error('Type ' + name + ' already exists');
      }
      return new TypeResolver(this.types.set(name, type), this.factories);
    }
  }, {
    key: 'addNativeTypes',
    value: function addNativeTypes(namedTypes) {
      var _this = this;
      Object.keys(namedTypes).forEach(function (name) {
        if (_this.types.has(name)) {
          throw new Error('Type ' + name + ' already exists');
        }
        var type = namedTypes[name];
        if (!isExonumType(type)) {
          throw new TypeError('Type needs to be an Exonum type');
        }
      });
      var newTypes = this.types.merge(namedTypes);
      return new TypeResolver(newTypes, this.factories);
    }
  }, {
    key: 'addFactory',
    value: function addFactory(name, factory) {
      if (!isExonumFactory(factory)) {
        throw new TypeError('Factory needs to be initialized with `initFactory()`');
      }
      if (this.factories.has(name)) {
        throw new Error('Factory ' + name + ' already exists');
      }
      return new TypeResolver(this.types, this.factories.set(name, factory));
    }
  }, {
    key: 'addFactories',
    value: function addFactories(namedFactories) {
      var _this2 = this;
      Object.keys(namedFactories).forEach(function (name) {
        if (_this2.factories.has(name)) {
          throw new Error('Factory ' + name + ' already exists');
        }
        var factory = namedFactories[name];
        if (!isExonumFactory(factory)) {
          throw new TypeError('Factory ' + name + ' needs to be initialized with initFactory()');
        }
      });
      var newFactories = this.factories.merge(namedFactories);
      return new TypeResolver(this.types, newFactories);
    }
  }, {
    key: 'resolve',
    value: function resolve(spec) {
      if (isExonumType(spec)) {
        return spec;
      }if (typeof spec === 'string') {
        var type = this._getType(spec);
        if (!type) {
          throw new Error('Unknown type name: ' + spec);
        }
        return type;
      } else if ((typeof spec === 'undefined' ? 'undefined' : _typeof(spec)) === 'object') {
        var keys = Object.keys(spec);
        if (keys.length !== 1) {
          throw new Error('Unexpected type specification; expected an object with exactly 1 key');
        }
        var key = keys[0];
        var factory = this._getFactory(key);
        if (!factory) {
          throw new Error('Unknown factory: ' + key);
        }
        if (!this._pendingTypes) {
          try {
            return factory(spec[key], this);
          } finally {
            delete this._pendingTypes;
          }
        } else {
          return factory(spec[key], this);
        }
      } else {
        throw new Error('Invalid type specification');
      }
    }
  }, {
    key: 'namedTypes',
    value: function namedTypes() {
      return this.types.filter(function (value, key) {
        return typeof key === 'string';
      });
    }
  }, {
    key: 'namedFactories',
    value: function namedFactories() {
      var _this3 = this;
      return this.factories.map(function (factory) {
        var fn = function fn(arg) {
          return factory(arg, _this3);
        };
        setKind(fn, 'factory');
        return fn;
      });
    }
  }, {
    key: 'add',
    value: function add(definitions) {
      var _this4 = this;
      if (!Array.isArray(definitions)) {
        definitions = [definitions];
      }
      definitions.forEach(function (_ref, i) {
        var name = _ref.name,
            factory = _ref.factory;
        if (typeof name !== 'string') {
          throw new Error('Name not specified for definition #' + i);
        }
        if (factory && _this4.factories.has(name)) {
          throw new Error('Factory ' + name + ' already exists');
        } else if (_this4.types.has(name)) {
          throw new Error('Type ' + name + ' already exists');
        }
      });
      var typeNames = definitions.filter(function (def) {
        return !def.factory;
      }).map(function (type) {
        return type.name;
      });
      this._pendingTypes = immutable.Map().withMutations(function (m) {
        typeNames.forEach(function (name) {
          m.set(name, placeholder(name, immutable.List.of(name)));
        });
      });
      this._pendingFactories = immutable.Map();
      var newTypes = void 0;
      var newFactories = void 0;
      try {
        definitions.forEach(function (def) {
          var name = def.name;
          def = Object.assign({}, def);
          delete def.name;
          if (def.factory) {
            _this4._pendingFactories = _this4._pendingFactories.set(name, createFactory(name, def.factory));
          } else {
            var type = _this4.resolve(def);
            _this4._resolvePendingType(name, type);
          }
        });
        newTypes = this.types.merge(this._pendingTypes);
        newFactories = this.factories.merge(this._pendingFactories);
      } finally {
        delete this._pendingTypes;
        delete this._pendingFactories;
      }
      return new TypeResolver(newTypes, newFactories);
    }
  }, {
    key: 'extend',
    value: function extend(name, extendFn) {
      var Type = this.types.get(name);
      if (!Type) {
        throw new Error('Type ' + name + ' does not exist');
      }
      Type = extendFn(Type);
      if (!isExonumType(Type)) {
        throw new TypeError('Extended type needs to be an Exonum type');
      }
      return new TypeResolver(this.types.set(name, Type), this.factories);
    }
  }, {
    key: '_hasType',
    value: function _hasType(name) {
      return this.types.has(name) || this._pendingTypes && this._pendingTypes.has(name);
    }
  }, {
    key: '_getType',
    value: function _getType(name) {
      var type = this.types.get(name);
      if (type !== undefined) return type;
      if (this._pendingTypes) {
        return this._pendingTypes.get(name);
      }
      return undefined;
    }
  }, {
    key: '_getFactory',
    value: function _getFactory(name) {
      var factory = this.factories.get(name);
      if (factory !== undefined) return factory;
      if (this._pendingFactories) {
        return this._pendingFactories.get(name);
      }
      return undefined;
    }
  }, {
    key: '_addPendingType',
    value: function _addPendingType(typeTag, name) {
      this._pendingTypes = (this._pendingTypes || immutable.Map()).set(typeTag, placeholder(name, typeTag));
    }
  }, {
    key: '_resolvePendingType',
    value: function _resolvePendingType(name, type) {
      this._pendingTypes.get(name).replaceBy(type);
      this._pendingTypes = this._pendingTypes.set(name, type);
    }
  }]);
  return TypeResolver;
}();
function dummyResolver() {
  return {
    types: immutable.Map(),
    pendingTypes: immutable.Map(),
    resolve: function resolve(type) {
      if (!isExonumType(type)) {
        throw new Error('Invalid type specified; Exonum type expected');
      }
      return type;
    },
    _hasType: function _hasType(name) {
      return false;
    },
    _getType: function _getType(name) {},
    _addPendingType: function _addPendingType(name) {},
    _resolvePendingType: function _resolvePendingType(name, type) {}
  };
}
function validateAndResolveFields(fields, resolver) {
  var definedNames = [];
  var resolvedFields = [];
  fields.forEach(function (prop, i) {
    if (typeof prop.name !== 'string') {
      throw new TypeError('No property name specified for property #' + i);
    }
    if (definedNames.indexOf(prop.name) >= 0) {
      throw new TypeError('Property redefined: ' + prop.name);
    }
    definedNames.push(prop.name);
    if (!prop.type) {
      throw new TypeError('No property type specified for property #' + i);
    }
    var resolvedProp = Object.assign({}, prop);
    resolvedProp.type = resolver.resolve(prop.type);
    resolvedFields.push(resolvedProp);
  });
  return resolvedFields;
}
function createFactory(factoryName, spec) {
  var typeParams = spec.typeParams;
  var definition = Object.assign({}, spec);
  delete definition.typeParams;
  if (!Array.isArray(typeParams)) {
    throw new Error('Invalid factory spec; typeParams field is not an array');
  }
  typeParams.forEach(function (_ref2) {
    var name = _ref2.name;
    if (typeof name !== 'string') {
      throw new Error('Missing name for a type param in factory spec');
    }
  });
  function factory(arg, resolver) {
    typeParam.push(resolver, factoryName, arg);
    try {
      return resolver.resolve(definition);
    } finally {
      typeParam.pop(resolver, factoryName);
    }
  }
  return initFactory(factory, {
    name: factoryName,
    prepare: function prepare(arg, resolver) {
      if (typeParams.length === 1) {
        arg = defineProperty({}, typeParams[0].name, arg);
      }
      var resolvedParams = {};
      typeParams.forEach(function (_ref3) {
        var name = _ref3.name;
        if (!(name in arg)) {
          throw new Error('Missing type parameter ' + name);
        }
        resolvedParams[name] = resolver.resolve(arg[name]);
      });
      return resolvedParams;
    },
    typeTag: function typeTag(arg) {
      return immutable.List(typeParams.map(function (_ref4) {
        var name = _ref4.name;
        return arg[name];
      }));
    },
    typeName: function typeName(arg) {
      var typeDescription = typeParams.map(function (_ref5) {
        var name = _ref5.name;
        return arg[name].inspect();
      }).join(', ');
      return factoryName + '<' + typeDescription + '>';
    }
  });
}

var DUMMY_RESOLVER = dummyResolver();
function initFactory(factory) {
  var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
      name = _ref.name,
      _ref$argumentMeta = _ref.argumentMeta,
      argumentMeta = _ref$argumentMeta === undefined ? 'argument' : _ref$argumentMeta,
      _ref$prepare = _ref.prepare,
      prepare = _ref$prepare === undefined ? function (arg, resolver) {
    return arg;
  } : _ref$prepare,
      _ref$typeTag = _ref.typeTag,
      typeTag = _ref$typeTag === undefined ? function (arg) {
    return arg;
  } : _ref$typeTag,
      _ref$typeName = _ref.typeName,
      typeName = _ref$typeName === undefined ? function (arg) {
    return name + '<?>';
  } : _ref$typeName;
  if (typeof argumentMeta === 'string') {
    var prop = argumentMeta;
    argumentMeta = function argumentMeta(arg) {
      return defineProperty({}, prop, arg);
    };
  }
  var memoizedFactory = function memoizedFactory(arg, resolver) {
    if (!resolver) resolver = DUMMY_RESOLVER;
    arg = prepare(arg, resolver);
    var fullTag = immutable.List.of(name, typeTag(arg));
    if (resolver._hasType(fullTag)) {
      return resolver._getType(fullTag);
    } else {
      resolver._addPendingType(fullTag, typeName(arg));
      var type = factory(arg, resolver);
      resolver._resolvePendingType(fullTag, type);
      Object.defineProperty(type, 'typeTag', {
        enumerable: false,
        configurable: true,
        value: function value() {
          return fullTag;
        }
      });
      Object.defineProperty(type, 'meta', {
        enumerable: false,
        configurable: true,
        value: function value() {
          return Object.assign({
            factory: memoizedFactory,
            factoryName: name
          }, argumentMeta(arg));
        }
      });
      return type;
    }
  };
  setKind(memoizedFactory, 'factory');
  return memoizedFactory;
}

var ENCODINGS = {
  hex: {
    validate: function validate(str, expectedLength) {
      return str.length === expectedLength * 2 && /^[0-9a-f]+$/i.test(str);
    },
    decode: function decode(str, buffer) {
      for (var i = 0; i < buffer.length; i++) {
        var byte = str.substring(2 * i, 2 * i + 2);
        buffer[i] = parseInt(byte, 16);
      }
    },
    encode: function encode(buffer) {
      return Array.prototype.map.call(buffer, function (x) {
        return x.toString(16);
      }).map(function (x) {
        return x.length === 1 ? '0' + x : x;
      }).join('');
    }
  },
  bin: {
    validate: function validate(str, expectedLength) {
      return str.length === expectedLength * 8 && /^[01]+$/.test(str);
    },
    decode: function decode(str, buffer) {
      for (var i = 0; i < buffer.length; i++) {
        var byte = str.substring(8 * i, 8 * i + 8);
        buffer[i] = parseInt(byte, 2);
      }
    },
    encode: function encode(buffer) {
      return Array.prototype.map.call(buffer, function (x) {
        return x.toString(2);
      }).map(function (x) {
        while (x.length < 8) {
          x = '0' + x;
        }return x;
      }).join('');
    }
  }
};
function validateString(str, expectedLength, encoding) {
  if (!ENCODINGS[encoding]) return false;
  return ENCODINGS[encoding].validate(str, expectedLength);
}
function decode(str, length, encoding) {
  var buffer = new Uint8Array(length);
  ENCODINGS[encoding].decode(str, buffer);
  return buffer;
}
function encode(buffer, encoding) {
  return ENCODINGS[encoding].encode(buffer);
}
function getEncoding(obj) {
  if (!obj) return undefined;
  for (var enc in ENCODINGS) {
    if (obj[enc] && typeof obj[enc] === 'string') {
      return enc;
    }
  }
  return undefined;
}

function isBuffer(obj) {
  return isExonumObject(obj) && rawValue(obj) instanceof Uint8Array;
}
function fixedBuffer(length) {
  var FixedBuffer = function (_createType) {
    inherits(FixedBuffer, _createType);
    function FixedBuffer(obj, encoding) {
      classCallCheck(this, FixedBuffer);
      var _raw = void 0;
      if (!encoding) {
        var inferredEncoding = getEncoding(obj);
        if (inferredEncoding) {
          encoding = inferredEncoding;
          obj = obj[encoding];
        }
      }
      if (typeof obj === 'string') {
        if (!encoding) encoding = 'hex';
        if (!validateString(obj, length, encoding)) {
          throw new TypeError('Cannot parse buffer string ' + obj + ' in ' + encoding + ' encoding');
        }
        _raw = decode(obj, length, encoding);
      } else if (isBuffer(obj)) {
        if (obj.byteLength() !== length) {
          throw new Error('Unexpected buffer length: ' + obj.byteLength() + '; ' + length + ' expected');
        }
        _raw = rawValue(obj);
      } else {
        if (!obj || obj.length === undefined) {
          throw new TypeError('Invalid-typed buffer initializer');
        }
        if (obj.length !== length) {
          throw new Error('Unexpected buffer length: ' + obj.length + '; ' + length + ' expected');
        }
        _raw = new Uint8Array(obj);
      }
      return possibleConstructorReturn(this, (FixedBuffer.__proto__ || Object.getPrototypeOf(FixedBuffer)).call(this, _raw, function () {
        return _raw.slice(0);
      }));
    }
    createClass(FixedBuffer, [{
      key: '_doSerialize',
      value: function _doSerialize(buffer) {
        buffer.set(rawValue(this));
      }
    }, {
      key: 'toJSON',
      value: function toJSON() {
        return encode(rawValue(this), 'hex');
      }
    }, {
      key: 'toString',
      value: function toString(encoding) {
        if (encoding !== undefined) {
          return encode(rawValue(this), encoding);
        }
        var bytes = length > 4 ? rawValue(this).subarray(0, 4) : rawValue(this);
        return 'Buffer(' + encode(bytes, 'hex') + (length > 4 ? '...' : '') + ')';
      }
    }, {
      key: 'hashCode',
      value: function hashCode() {
        return immutable.List(rawValue(this)).hashCode();
      }
    }, {
      key: 'equals',
      value: function equals(other) {
        if (!isBuffer(other)) return false;
        var rawThis = rawValue(this);
        var rawOther = rawValue(other);
        if (rawOther.length !== rawThis.length) return false;
        return rawThis.every(function (byte, i) {
          return byte === rawOther[i];
        });
      }
    }]);
    return FixedBuffer;
  }(createType({
    typeLength: length,
    name: 'Buffer<' + length + '>'
  }));
  FixedBuffer.ZEROS = new FixedBuffer(new Array(length));
  FixedBuffer.prototype.hashCode = memoize(FixedBuffer.prototype.hashCode);
  return FixedBuffer;
}
var MAX_BUFFER_LENGTH = 2 * 1024 * 1024;
var fixedBuffer$1 = initFactory(fixedBuffer, {
  name: 'buffer',
  argumentMeta: 'size',
  prepare: function prepare(length) {
    length = +length;
    if (isNaN(length)) {
      throw new TypeError('Invalid buffer size; number expected');
    }
    if (length <= 0 || length > MAX_BUFFER_LENGTH) {
      throw new RangeError('Unexpected buffer size: ' + length + '; expected value between 1 and ' + MAX_BUFFER_LENGTH);
    }
    return length;
  }
});

var PublicKey = fixedBuffer$1(32);
var hashLength = 32;
var secretKeyLength = nacl.sign.secretKeyLength;
var publicKeyLength = nacl.sign.publicKeyLength;
var signatureLength = nacl.sign.signatureLength;
function hash() {
  for (var _len = arguments.length, fragments = Array(_len), _key = 0; _key < _len; _key++) {
    fragments[_key] = arguments[_key];
  }
  var lengths = fragments.map(function (b) {
    return isExonumObject(b) ? b.byteLength() : b.length;
  });
  var totalLen = lengths.reduce(function (total, len) {
    return len + total;
  }, 0);
  if (typeof totalLen !== 'number' || isNaN(totalLen)) {
    throw new TypeError('Invalid argument(s) supplied for hash digest; arrayish objects and Exonum types supported');
  }
  var buffer = new Uint8Array(totalLen);
  var pos = 0;
  fragments.forEach(function (b, i) {
    isExonumObject(b) ? b.serialize(buffer.subarray(pos, pos + b.byteLength())) : buffer.set(b, pos);
    pos += lengths[i];
  });
  return sha('sha256').update(buffer).digest();
}
function sign(message, secretKey) {
  if (isExonumObject(message)) {
    message = message.serialize();
  }
  return nacl.sign.detached(message, secretKey);
}
function verify(message, signature, pubkey) {
  if (isExonumObject(message)) {
    message = message.serialize();
  }
  return nacl.sign.detached.verify(message, rawOrSelf(signature), rawOrSelf(pubkey));
}
function secret() {
  var _nacl$sign$keyPair = nacl.sign.keyPair(),
      secretKey = _nacl$sign$keyPair.secretKey,
      publicKey = _nacl$sign$keyPair.publicKey;
  var exonumPub = PublicKey.from(publicKey);
  secretKey.pub = function () {
    return exonumPub;
  };
  secretKey.rawPub = function () {
    return publicKey.slice(0);
  };
  return secretKey;
}
secret.fromSeed = function (seed) {
  var _nacl$sign$keyPair$fr = nacl.sign.keyPair.fromSeed(seed),
      secretKey = _nacl$sign$keyPair$fr.secretKey,
      publicKey = _nacl$sign$keyPair$fr.publicKey;
  var exonumPub = PublicKey.from(publicKey);
  secretKey.pub = function () {
    return exonumPub;
  };
  secretKey.rawPub = function () {
    return publicKey.slice(0);
  };
  return secretKey;
};
function fromSecretKey(secretKey) {
  return nacl.sign.keyPair.fromSecretKey(secretKey).publicKey;
}

var crypto = Object.freeze({
	hashLength: hashLength,
	secretKeyLength: secretKeyLength,
	publicKeyLength: publicKeyLength,
	signatureLength: signatureLength,
	hash: hash,
	sign: sign,
	verify: verify,
	secret: secret,
	fromSecretKey: fromSecretKey
});

function isStr(maybeStr) {
  return maybeStr && typeof rawValue(maybeStr) === 'string';
}
function stringLength(str) {
  var len = 0;
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (c < 128) {
      len++;
    } else if (c < 2048) {
      len += 2;
    } else if ((c & 0xFC00) === 0xD800 && i + 1 < str.length && (str.charCodeAt(i + 1) & 0xFC00) === 0xDC00) {
      len += 4;
      i++;
    } else {
      len += 3;
    }
  }
  return len;
}
function serializeString(str, buffer) {
  var from = 0;
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (c < 128) {
      buffer[from++] = c;
    } else if (c < 2048) {
      buffer[from++] = c >> 6 | 192;
      buffer[from++] = c & 63 | 128;
    } else if ((c & 0xFC00) === 0xD800 && i + 1 < str.length && (str.charCodeAt(i + 1) & 0xFC00) === 0xDC00) {
      var pairC = 0x10000 + ((c & 0x03FF) << 10) + (str.charCodeAt(++i) & 0x03FF);
      buffer[from++] = pairC >> 18 | 240;
      buffer[from++] = pairC >> 12 & 63 | 128;
      buffer[from++] = pairC >> 6 & 63 | 128;
      buffer[from++] = pairC & 63 | 128;
    } else {
      buffer[from++] = c >> 12 | 224;
      buffer[from++] = c >> 6 & 63 | 128;
      buffer[from++] = c & 63 | 128;
    }
  }
}
var Str = function (_createType) {
  inherits(Str, _createType);
  function Str(str) {
    classCallCheck(this, Str);
    if (isStr(str)) str = rawValue(str);
    if (typeof str !== 'string') {
      throw new TypeError('Cannot construct Str from ' + str);
    }
    return possibleConstructorReturn(this, (Str.__proto__ || Object.getPrototypeOf(Str)).call(this, str));
  }
  createClass(Str, [{
    key: '_doSerialize',
    value: function _doSerialize(buffer) {
      serializeString(rawValue(this), buffer);
    }
  }, {
    key: 'toJSON',
    value: function toJSON() {
      return rawValue(this);
    }
  }, {
    key: 'byteLength',
    value: function byteLength() {
      return stringLength(rawValue(this));
    }
  }]);
  return Str;
}(createType({
  typeLength: undefined,
  proxiedMethods: getMethodNames(String.prototype),
  name: 'Str'
}));

function isBoolean(obj) {
  return obj && typeof rawValue(obj) === 'boolean';
}
var Bool = function (_createType) {
  inherits(Bool, _createType);
  function Bool(val) {
    classCallCheck(this, Bool);
    if (isBoolean(val)) val = rawValue(val);
    if (typeof val !== 'boolean') {
      throw new TypeError('Cannot construct Bool from ' + val);
    }
    return possibleConstructorReturn(this, (Bool.__proto__ || Object.getPrototypeOf(Bool)).call(this, val));
  }
  createClass(Bool, [{
    key: '_doSerialize',
    value: function _doSerialize(buffer) {
      buffer[0] = rawValue(this) ? 1 : 0;
      return buffer;
    }
  }, {
    key: 'toJSON',
    value: function toJSON() {
      return rawValue(this);
    }
  }]);
  return Bool;
}(createType({
  typeLength: 1,
  proxiedMethods: ['toString', 'valueOf'],
  name: 'Bool'
}));
Object.defineProperty(Bool, 'TRUE', { value: new Bool(true) });
Object.defineProperty(Bool, 'FALSE', { value: new Bool(false) });

var None = function (_createType) {
  inherits(None, _createType);
  function None(nullOrUndefined) {
    classCallCheck(this, None);
    if (nullOrUndefined !== null && nullOrUndefined !== undefined) {
      throw new Error('Invalid None initializer; null or undefined expected');
    }
    return possibleConstructorReturn(this, (None.__proto__ || Object.getPrototypeOf(None)).call(this));
  }
  createClass(None, [{
    key: '_doSerialize',
    value: function _doSerialize(buffer) {}
  }, {
    key: 'toJSON',
    value: function toJSON() {
      return null;
    }
  }]);
  return None;
}(createType({
  name: 'None',
  typeLength: 0
}));

var MAX_SAFE_INTEGER = bigInt(Number.MAX_SAFE_INTEGER || '9007199254740991');
var MIN_SAFE_INTEGER = bigInt(Number.MIN_SAFE_INTEGER || '-9007199254740991');
var MAX_SAFE_SIZE = 6;
function isInteger(maybeInteger) {
  if (!isExonumObject(maybeInteger)) return false;
  var raw = rawValue(maybeInteger);
  return raw && raw.toJSNumber;
}
function getEncoding$1(obj) {
  if (!obj) return undefined;
  var _arr = ['dec', 'hex', 'oct', 'bin'];
  for (var _i = 0; _i < _arr.length; _i++) {
    var enc = _arr[_i];
    if (obj[enc] && typeof obj[enc] === 'string') {
      return enc;
    }
  }
  return undefined;
}
var PROXIED_METHODS$1 = getMethodNames(Object.getPrototypeOf(bigInt(0))).filter(function (method) {
  return method !== 'toJSON';
});
function $integer(byteLength, signed) {
  var MIN_VALUE = signed ? bigInt(1).shiftLeft(byteLength * 8 - 1).multiply(-1) : bigInt(0);
  var MAX_VALUE = (signed ? bigInt(1).shiftLeft(byteLength * 8 - 1) : bigInt(1).shiftLeft(byteLength * 8)).minus(1);
  var SizedInteger = function (_createType) {
    inherits(SizedInteger, _createType);
    function SizedInteger(value, encoding) {
      classCallCheck(this, SizedInteger);
      var _raw = void 0;
      if (getEncoding$1(value)) {
        encoding = getEncoding$1(value);
        value = value[encoding];
      }
      if (isInteger(value)) {
        _raw = rawValue(value);
      } else if (bigInt.isInstance(value)) {
        _raw = value;
      } else if (typeof value === 'string') {
        if (encoding === undefined) encoding = 'dec';
        switch (encoding) {
          case 'dec':
            _raw = bigInt(value, 10);break;
          case 'hex':
            _raw = bigInt(value, 16);break;
          case 'oct':
            _raw = bigInt(value, 8);break;
          case 'bin':
            _raw = bigInt(value, 2);break;
          default:
            throw new Error('Unknown encoding: ' + encoding);
        }
      } else if (typeof value === 'number' && !isNaN(value)) {
        _raw = bigInt(value);
      } else {
        throw new TypeError('Not a number: ' + value);
      }
      if (_raw.lt(MIN_VALUE) || _raw.gt(MAX_VALUE)) {
        throw new Error('Value out of range: expected ' + MIN_VALUE + ' <= x <= ' + MAX_VALUE + ', got ' + _raw);
      }
      var externalValue = _raw.gt(MAX_SAFE_INTEGER) || _raw.lt(MIN_SAFE_INTEGER) ? _raw : _raw.toJSNumber();
      return possibleConstructorReturn(this, (SizedInteger.__proto__ || Object.getPrototypeOf(SizedInteger)).call(this, _raw, function () {
        return externalValue;
      }));
    }
    createClass(SizedInteger, [{
      key: '_doSerialize',
      value: function _doSerialize(buffer) {
        var x = rawValue(this);
        if (signed && x.isNegative()) {
          x = x.minus(MIN_VALUE.multiply(2));
        }
        for (var i = 0; i < byteLength; i++) {
          var divmod = x.divmod(256);
          buffer[i] = divmod.remainder;
          x = divmod.quotient;
        }
      }
    }, {
      key: 'toJSON',
      value: function toJSON() {
        var raw = rawValue(this);
        return byteLength > MAX_SAFE_SIZE ? raw.toString() : raw.toJSNumber();
      }
    }]);
    return SizedInteger;
  }(createType({
    typeLength: byteLength,
    proxiedMethods: PROXIED_METHODS$1,
    name: signed ? 'Int' + byteLength * 8 : 'Uint' + byteLength * 8
  }));
  return SizedInteger;
}
var MAX_BYTE_LENGTH = 2 * 1024 * 1024;
function prepareLength(length) {
  length = +length;
  if (isNaN(length)) {
    throw new TypeError('Invalid byte length of integer type; number expected');
  }
  if (length <= 0 || length > MAX_BYTE_LENGTH) {
    throw new RangeError('Unexpected byte length of integer type: ' + length + '; expected value between 1 and ' + MAX_BYTE_LENGTH);
  }
  return length;
}
var integer = initFactory(function (byteLength) {
  return $integer(byteLength, true);
}, {
  name: 'integer',
  prepare: prepareLength
});
var uinteger = initFactory(function (byteLength) {
  return $integer(byteLength, false);
}, {
  name: 'uinteger',
  prepare: prepareLength
});

var Uint32 = uinteger(4);
var SEGMENT_LENGTH = 8;
function serializeSegment(buffer, segment) {
  var start = Uint32.from(segment.start);
  var length = Uint32.from(segment.length);
  start.serialize(buffer.subarray(0, 4));
  length.serialize(buffer.subarray(4, 8));
  return buffer;
}
function _byteLength(val) {
  var typeLength = val.constructor.typeLength();
  return typeLength === undefined ? SEGMENT_LENGTH + val.byteLength() : typeLength;
}
function byteLength(values) {
  return values.reduce(function (acc, val) {
    return acc + _byteLength(val);
  }, 0);
}
function heapStart(types) {
  return types.reduce(function (acc, type) {
    return acc + (type.typeLength() || SEGMENT_LENGTH);
  }, 0);
}
function serialize(buffer, values) {
  var _ref = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
      heapPos = _ref.heapPos,
      _ref$offset = _ref.offset,
      offset = _ref$offset === undefined ? 0 : _ref$offset;
  if (heapPos === undefined) {
    heapPos = heapStart(values.map(function (val) {
      return val.constructor;
    }));
  }
  var initHeap = heapPos;
  var mainPos = 0;
  values.forEach(function (val) {
    var typeLength = val.constructor.typeLength();
    if (typeLength === undefined) {
      var len = val.byteLength();
      val.serialize(buffer.subarray(heapPos, heapPos + len));
      var segment = { start: heapPos + offset, length: len };
      serializeSegment(buffer.subarray(mainPos, mainPos + SEGMENT_LENGTH), segment);
      heapPos += len;
      mainPos += SEGMENT_LENGTH;
    } else {
      val.serialize(buffer.subarray(mainPos, mainPos + typeLength));
      mainPos += typeLength;
    }
  });
  if (mainPos !== initHeap) {
    throw new Error('Invariant broken: The length of the main segment ' + mainPos + ' does not match the heap position ' + initHeap);
  }
  if (heapPos < buffer.length) {
    throw new Error('Invariant broken: Over-allocation of heap, ' + buffer.length + ' bytes allocated vs ' + heapPos + ' used');
  } else if (heapPos > buffer.length) {
    throw new Error('Invariant broken: Under-allocation of heap, ' + buffer.length + ' bytes allocated vs ' + heapPos + ' used');
  }
  return buffer;
}

var SizeType = uinteger(4);
function array(ElementType, resolver) {
  var ExonumArray = function (_createType) {
    inherits(ExonumArray, _createType);
    function ExonumArray(arr) {
      classCallCheck(this, ExonumArray);
      var elements = void 0;
      if (Array.isArray(arr)) {
        elements = arr.map(function (x) {
          return ElementType.from(x);
        });
      } else {
        throw new TypeError('Invalid array initializer, JS array expected');
      }
      var list = immutable.List(elements);
      var count = SizeType.from(list.count());
      return possibleConstructorReturn(this, (ExonumArray.__proto__ || Object.getPrototypeOf(ExonumArray)).call(this, {
        list: list,
        count: count,
        serialization: list.unshift(count)
      }, null));
    }
    createClass(ExonumArray, [{
      key: 'byteLength',
      value: function byteLength$$1() {
        return byteLength(rawValue(this).serialization);
      }
    }, {
      key: 'count',
      value: function count() {
        return +rawValue(this).count;
      }
    }, {
      key: 'get',
      value: function get$$1(index) {
        return rawOrSelf(this.getOriginal(index), true);
      }
    }, {
      key: 'getOriginal',
      value: function getOriginal(index) {
        return rawValue(this).list.get(index);
      }
    }, {
      key: 'toList',
      value: function toList() {
        return rawValue(this).list.map(function (val) {
          return rawOrSelf(val, true);
        });
      }
    }, {
      key: 'toOriginalList',
      value: function toOriginalList() {
        return rawValue(this).list;
      }
    }, {
      key: '_doSerialize',
      value: function _doSerialize(buffer) {
        serialize(buffer, rawValue(this).serialization);
      }
    }, {
      key: 'toJSON',
      value: function toJSON() {
        return rawValue(this).list.map(function (x) {
          return x.toJSON();
        }).toJS();
      }
    }]);
    return ExonumArray;
  }(createType({
    name: 'Array<' + ElementType.inspect() + '>',
    typeLength: undefined
  }));
  return ExonumArray;
}
var array$1 = initFactory(array, {
  name: 'array',
  argumentMeta: 'element',
  prepare: function prepare(Type, resolver) {
    return resolver.resolve(Type);
  }
});

function union(_ref, resolver) {
  var tagProperty = _ref.tag,
      tagEmbedding = _ref.tagEmbedding,
      variants = _ref.variants;
  var variantNames = variants.map(function (f) {
    return f.name;
  });
  var markerByteLength = 1;
  var UnionType = function (_createType) {
    inherits(UnionType, _createType);
    function UnionType(obj, maybeTag) {
      classCallCheck(this, UnionType);
      var tag = void 0,
          value = void 0;
      if (maybeTag) {
        tag = maybeTag;
        if (variantNames.indexOf(tag) < 0) {
          throw new Error('Invalid union tag specified: ' + tag);
        }
        value = variants[variantNames.indexOf(tag)].type.from(obj);
      } else if (tagEmbedding === 'none') {
        for (var i = 0; i < variants.length; i++) {
          var _variants$i = variants[i],
              name = _variants$i.name,
              type = _variants$i.type;
          try {
            tag = name;
            value = type.from(obj);
            break;
          } catch (e) {}
        }
        if (!value) {
          throw new Error('No matching union variant found');
        }
      } else {
        var valueInitializer = void 0;
        if ((typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) !== 'object' || !obj) {
          throw new TypeError('Invalid initializer for union; object expected');
        }
        switch (tagEmbedding) {
          case 'external':
            var possibleTags = Object.keys(obj).filter(function (name) {
              return variantNames.indexOf(name) >= 0;
            });
            if (possibleTags.length === 0) {
              throw new Error('No matching union variant found');
            } else if (possibleTags.length > 1) {
              throw new Error('Ambiguous union initializer: cannot decide among variants ' + possibleTags.join(', '));
            }
            tag = possibleTags[0];
            valueInitializer = obj[tag];
            break;
          case 'internal':
            tag = obj[tagProperty];
            valueInitializer = Object.assign({}, obj);
            delete valueInitializer[tagProperty];
            break;
        }
        if (variantNames.indexOf(tag) < 0) {
          throw new Error('Invalid union tag specified: ' + tag);
        }
        value = variants[variantNames.indexOf(tag)].type.from(valueInitializer);
      }
      return possibleConstructorReturn(this, (UnionType.__proto__ || Object.getPrototypeOf(UnionType)).call(this, { value: value, variant: tag }, null));
    }
    createClass(UnionType, [{
      key: 'byteLength',
      value: function byteLength() {
        return markerByteLength + getValue(this).byteLength();
      }
    }, {
      key: 'get',
      value: function get$$1(name) {
        if (getVariant(this) !== name) return undefined;
        var val = rawValue(this).value;
        return rawOrSelf(val, true);
      }
    }, {
      key: 'getOriginal',
      value: function getOriginal(name) {
        if (getVariant(this) !== name) return undefined;
        return rawValue(this).value;
      }
    }, {
      key: 'match',
      value: function match(matcher) {
        return matchAndGet(this, matcher, 'get');
      }
    }, {
      key: 'matchOriginal',
      value: function matchOriginal(matcher) {
        return matchAndGet(this, matcher, 'getOriginal');
      }
    }, {
      key: '_doSerialize',
      value: function _doSerialize(buffer) {
        buffer[0] = variantNames.indexOf(getVariant(this));
        getValue(this).serialize(buffer.subarray(1));
      }
    }, {
      key: 'toJSON',
      value: function toJSON() {
        switch (tagEmbedding) {
          case 'external':
            return defineProperty({}, getVariant(this), getValue(this).toJSON());
          case 'internal':
            return Object.assign(getValue(this).toJSON(), defineProperty({}, tagProperty, getVariant(this)));
          case 'none':
            return getValue(this).toJSON();
        }
      }
    }, {
      key: 'toString',
      value: function toString() {
        return getVariant(this) + '(' + getValue(this) + ')';
      }
    }]);
    return UnionType;
  }(createType({
    name: unionName(variants),
    typeLength: undefined
  }));
  function getVariant(union) {
    return rawValue(union).variant;
  }
  function getValue(union) {
    return rawValue(union).value;
  }
  function matchAndGet(union, matcher, getter) {
    if (!matcher || (typeof matcher === 'undefined' ? 'undefined' : _typeof(matcher)) !== 'object') {
      throw new TypeError('Matcher should be an object');
    }
    var variant = getVariant(union);
    if (typeof matcher[variant] === 'function') {
      return matcher[variant](union[getter](variant));
    } else if (typeof matcher._ === 'function') {
      return matcher._(union[getter](variant));
    } else {}
  }
  variantNames.forEach(function (name) {
    Object.defineProperty(UnionType, name, {
      value: function value(obj) {
        return new this(obj, name);
      }
    });
    Object.defineProperty(UnionType.prototype, name, {
      enumerable: true,
      configurable: false,
      get: function get$$1() {
        return this.get(name);
      }
    });
  });
  Object.defineProperty(UnionType.prototype, tagProperty, {
    enumerable: true,
    configurable: false,
    get: function get$$1() {
      return getVariant(this);
    }
  });
  return UnionType;
}
var union$1 = initFactory(union, {
  name: 'union',
  argumentMeta: function argumentMeta(spec) {
    return {
      tag: spec.tag,
      tagEmbedding: spec.tagEmbedding,
      variants: spec.variants
    };
  },
  prepare: function prepare(spec, resolver) {
    if (Array.isArray(spec)) {
      spec = { variants: spec };
    }
    var _spec = spec,
        _spec$tagEmbedding = _spec.tagEmbedding,
        tagEmbedding = _spec$tagEmbedding === undefined ? 'external' : _spec$tagEmbedding,
        _spec$tag = _spec.tag,
        tag = _spec$tag === undefined ? 'type' : _spec$tag,
        variants = _spec.variants;
    var allowedEmbeddings = ['none', 'internal', 'external'];
    if (allowedEmbeddings.indexOf(tagEmbedding) < 0) {
      throw new TypeError('Invalid tag embedding: ' + tagEmbedding + '; one of ' + allowedEmbeddings.join(', ') + ' expected');
    }
    variants = validateAndResolveFields(variants, resolver);
    return { tagEmbedding: tagEmbedding, tag: tag, variants: variants };
  },
  typeTag: function typeTag(_ref3) {
    var variants = _ref3.variants;
    return immutable.List().withMutations(function (l) {
      variants.map(function (_ref4) {
        var name = _ref4.name,
            type = _ref4.type;
        return l.push(name, type);
      });
    });
  }
});
function unionName(variants) {
  var varDescription = variants.map(function (variant) {
    return variant.type.inspect();
  }).join(' | ');
  return '(' + varDescription + ')';
}

function option(Type, resolver) {
  var spec = [{ name: 'none', type: None }, { name: 'some', type: Type }];
  return function (_union) {
    inherits(_class, _union);
    function _class(obj) {
      classCallCheck(this, _class);
      if (obj === null || obj === undefined) {
        obj = { none: null };
      } else {
        obj = { some: obj };
      }
      return possibleConstructorReturn(this, (_class.__proto__ || Object.getPrototypeOf(_class)).call(this, obj));
    }
    createClass(_class, [{
      key: 'toJSON',
      value: function toJSON() {
        return this.type === 'none' ? null : this.getOriginal('some').toJSON();
      }
    }]);
    return _class;
  }(union$1(spec, resolver));
}
var option$1 = initFactory(option, {
  name: 'option',
  prepare: function prepare(Type, resolver) {
    return resolver.resolve(Type);
  },
  typeTag: function typeTag(Type) {
    return Type;
  }
});

function struct(spec, resolver) {
  var propertyNames = spec.map(function (f) {
    return f.name;
  });
  var propertyTypes = immutable.List(spec.map(function (f) {
    return f.type;
  }));
  var recordSpec = {};
  propertyNames.forEach(function (name) {
    recordSpec[name] = undefined;
  });
  var Rec = immutable.Record(recordSpec);
  var fixedLength = heapStart(propertyTypes);
  var hasFixedLength = propertyTypes.every(function (T) {
    return T.typeLength() !== undefined;
  });
  var StructType = function (_createType) {
    inherits(StructType, _createType);
    function StructType(objectOrArray) {
      classCallCheck(this, StructType);
      return possibleConstructorReturn(this, (StructType.__proto__ || Object.getPrototypeOf(StructType)).call(this, Rec(parseInitializer(spec, objectOrArray, Rec)), null));
    }
    createClass(StructType, [{
      key: 'set',
      value: function set$$1(name, value) {
        var idx = propertyNames.indexOf(name);
        if (idx >= 0) {
          var Type = spec[idx].type;
          if (!(value instanceof Type)) {
            value = new Type(value);
          }
          return this.constructor.from(rawValue(this).set(name, value));
        } else {
          throw new Error('Unknown property: ' + name);
        }
      }
    }, {
      key: 'get',
      value: function get$$1(name) {
        return rawOrSelf(rawValue(this).get(name), true);
      }
    }, {
      key: 'getOriginal',
      value: function getOriginal(name) {
        return rawValue(this).get(name);
      }
    }, {
      key: 'byteLength',
      value: function byteLength$$1() {
        var _this2 = this;
        return byteLength(propertyNames.map(function (name) {
          return _this2.getOriginal(name);
        }));
      }
    }, {
      key: '_doSerialize',
      value: function _doSerialize(buffer) {
        var _this3 = this;
        var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
            _ref$offset = _ref.offset,
            offset = _ref$offset === undefined ? 0 : _ref$offset;
        return serialize(buffer, propertyNames.map(function (name) {
          return _this3.getOriginal(name);
        }), { offset: offset, heapPos: fixedLength });
      }
    }, {
      key: 'toJSON',
      value: function toJSON() {
        var obj = {};
        for (var i = 0; i < spec.length; i++) {
          var value = this.getOriginal(spec[i].name);
          obj[spec[i].name] = value ? value.toJSON() : undefined;
        }
        return obj;
      }
    }, {
      key: 'toString',
      value: function toString() {
        var props = [];
        for (var i = 0; i < spec.length; i++) {
          var value = this.getOriginal(spec[i].name);
          props.push(value === undefined ? '?' + spec[i].name : spec[i].name + ': ' + value);
        }
        return '{ ' + props.join(', ') + ' }';
      }
    }, {
      key: 'hashCode',
      value: function hashCode() {
        return rawValue(this).hashCode();
      }
    }, {
      key: 'equals',
      value: function equals(other) {
        if (!isExonumObject(other)) return false;
        return rawValue(this).equals(rawValue(other));
      }
    }]);
    return StructType;
  }(createType({
    typeLength: hasFixedLength ? fixedLength : undefined,
    name: structName(spec)
  }));
  propertyNames.forEach(function (name) {
    Object.defineProperty(StructType.prototype, name, {
      enumerable: true,
      configurable: true,
      get: function get$$1() {
        return this.get(name);
      }
    });
  });
  return StructType;
}
var struct$1 = initFactory(struct, {
  name: 'struct',
  argumentMeta: 'fields',
  prepare: function prepare(fields, resolver) {
    return validateAndResolveFields(fields, resolver);
  },
  typeTag: function typeTag(fields, resolver) {
    return immutable.List().withMutations(function (l) {
      fields.map(function (_ref2) {
        var name = _ref2.name,
            type = _ref2.type;
        return l.push(name, type);
      });
    });
  }
});
function parseInitializer(spec, arg, Rec) {
  var parsed = {};
  var i = void 0;
  if (arg instanceof Rec) {
    return arg;
  }if (Array.isArray(arg)) {
    for (i = 0; i < spec.length; i++) {
      var T = spec[i].type;
      parsed[spec[i].name] = T.from(arg[i]);
    }
  } else if (arg && (typeof arg === 'undefined' ? 'undefined' : _typeof(arg)) === 'object') {
    for (i = 0; i < spec.length; i++) {
      var val = arg[spec[i].name];
      var _T = spec[i].type;
      parsed[spec[i].name] = _T.from(val);
    }
  } else {
    throw new TypeError('Cannot instantiate struct from ' + arg);
  }
  return parsed;
}
function structName(spec) {
  var fields = spec.map(function (field) {
    return field.type.toString();
  }).join(', ');
  return '[' + fields + ']';
}

var DEFAULT_NETWORK_ID = 0;
var DEFAULT_PROTO_VER = 0;
var READONLY_FIELDS = ['networkId', 'protocolVersion', 'messageId', 'serviceId'];
function message(_ref, resolver) {
  var networkId = _ref.networkId,
      protocolVersion = _ref.protocolVersion,
      serviceId = _ref.serviceId,
      messageId = _ref.messageId,
      authorField = _ref.author,
      BodyType = _ref.body;
  var MessageHeader = resolver.resolve({
    struct: [{ name: 'networkId', type: 'Uint8' }, { name: 'protocolVersion', type: 'Uint8' }, { name: 'messageId', type: 'Uint16' }, { name: 'serviceId', type: 'Uint16' }, { name: 'payloadLength', type: 'Uint32' }]
  });
  var headLength = MessageHeader.typeLength();
  var Signature = resolver.resolve('Signature');
  var sigLength = Signature.typeLength();
  var MessageType = function (_resolver$resolve) {
    inherits(MessageType, _resolver$resolve);
    createClass(MessageType, null, [{
      key: 'typeLength',
      value: function typeLength() {
        return BodyType.typeLength() === undefined ? undefined : headLength + BodyType.typeLength() + sigLength;
      }
    }, {
      key: 'fromBody',
      value: function fromBody(body) {
        return new this({ body: body });
      }
    }]);
    function MessageType(_ref2) {
      var body = _ref2.body,
          _ref2$signature = _ref2.signature,
          signature = _ref2$signature === undefined ? Signature.ZEROS : _ref2$signature;
      classCallCheck(this, MessageType);
      return possibleConstructorReturn(this, (MessageType.__proto__ || Object.getPrototypeOf(MessageType)).call(this, {
        networkId: networkId,
        protocolVersion: protocolVersion,
        messageId: messageId,
        serviceId: serviceId,
        body: body,
        signature: signature
      }));
    }
    createClass(MessageType, [{
      key: 'set',
      value: function set$$1(name, value) {
        if (READONLY_FIELDS.indexOf(name) >= 0) {
          throw new TypeError('Cannot set field ' + name + ', it is readonly');
        }
        return get(MessageType.prototype.__proto__ || Object.getPrototypeOf(MessageType.prototype), 'set', this).call(this, name, value);
      }
    }, {
      key: 'serializeForSigning',
      value: function serializeForSigning() {
        var buffer = new Uint8Array(this.byteLength() - sigLength);
        header(this.byteLength()).serialize(buffer.subarray(0, headLength));
        this.body._doSerialize(buffer.subarray(headLength), { offset: headLength });
        return buffer;
      }
    }, {
      key: '_doSerialize',
      value: function _doSerialize(buffer) {
        header(this.byteLength()).serialize(buffer.subarray(0, headLength));
        this.body._doSerialize(buffer.subarray(headLength, buffer.length - sigLength), {
          offset: headLength
        });
        this.getOriginal('signature').serialize(buffer.subarray(buffer.length - sigLength));
      }
    }, {
      key: 'byteLength',
      value: function byteLength() {
        return headLength + this.body.byteLength() + sigLength;
      }
    }, {
      key: 'author',
      value: function author() {
        return this.body[authorField];
      }
    }, {
      key: 'sign',
      value: function sign$$1(privateKey) {
        return new this.constructor({
          body: this.body,
          signature: sign(this.serializeForSigning(), privateKey)
        });
      }
    }, {
      key: 'verify',
      value: function verify$$1() {
        if (!this.author()) {
          return false;
        }
        if (this.getOriginal('signature').equals(Signature.ZEROS)) {
          return false;
        }
        return verify(this.serializeForSigning(), this.signature, this.author());
      }
    }, {
      key: 'toString',
      value: function toString() {
        return 'Message:' + this.body;
      }
    }]);
    return MessageType;
  }(resolver.resolve({
    struct: [{ name: 'networkId', type: 'Uint8' }, { name: 'protocolVersion', type: 'Uint8' }, { name: 'messageId', type: 'Uint16' }, { name: 'serviceId', type: 'Uint16' }, { name: 'body', type: BodyType }, { name: 'signature', type: 'Signature' }]
  }));
  function header(payloadLength) {
    return new MessageHeader({
      networkId: networkId,
      protocolVersion: protocolVersion,
      serviceId: serviceId,
      messageId: messageId,
      payloadLength: payloadLength
    });
  }
  return MessageType;
}
var message$1 = initFactory(message, {
  name: 'message',
  argumentMeta: function argumentMeta(spec) {
    return Object.assign({}, spec);
  },
  prepare: function prepare(_ref3, resolver) {
    var _ref3$networkId = _ref3.networkId,
        networkId = _ref3$networkId === undefined ? DEFAULT_NETWORK_ID : _ref3$networkId,
        _ref3$protocolVersion = _ref3.protocolVersion,
        protocolVersion = _ref3$protocolVersion === undefined ? DEFAULT_PROTO_VER : _ref3$protocolVersion,
        serviceId = _ref3.serviceId,
        messageId = _ref3.messageId,
        author = _ref3.author,
        body = _ref3.body;
    body = Array.isArray(body) ? resolver.resolve({ struct: body }) : resolver.resolve(body);
    return {
      networkId: networkId,
      protocolVersion: protocolVersion,
      serviceId: serviceId,
      messageId: messageId,
      author: author,
      body: body
    };
  }
});

function parseTreeStructure(tree) {
  var nodes = [];
  function pushNode(node, level, pos) {
    node.level = level;
    node.pos = pos;
    nodes.push(node);
  }
  nodes.push(tree);
  tree.level = 0;
  tree.pos = 0;
  var _loop = function _loop(i) {
    var node = nodes[i];
    node.match({
      branch: function branch(_ref2) {
        var left = _ref2.left,
            right = _ref2.right;
        pushNode(left, node.level + 1, 2 * node.pos);
        pushNode(right, node.level + 1, 2 * node.pos + 1);
      },
      stub: function stub(_stub) {
        pushNode(_stub, node.level + 1, 2 * node.pos);
      }
    });
  };
  for (var i = 0; i < nodes.length; i++) {
    _loop(i);
  }
  var levels = nodes.map(function (node) {
    return node.level;
  });
  var depth = Math.max.apply(null, levels);
  var values = nodes.filter(function (node) {
    return node.type === 'val';
  });
  if (!values.every(function (node) {
    return node.level === depth;
  })) {
    throw new Error('Invalid value / hash height');
  }
  if (nodes.filter(function (node) {
    return node.type === 'branch';
  }).some(function (_ref) {
    var branch = _ref.branch;
    return branch.left.type === 'stub';
  })) {
    throw new TypeError('Stub node being the left child of parent');
  }
  return { depth: depth, nodes: nodes, values: values };
}
function treeHash(node) {
  return node.match({
    hash: function hash$$1(h) {
      return h;
    },
    val: function val(_val) {
      return hash(_val);
    },
    branch: function branch(_ref3) {
      var left = _ref3.left,
          right = _ref3.right;
      return hash(treeHash(left), treeHash(right));
    },
    stub: function stub(_stub2) {
      return hash(treeHash(_stub2));
    }
  });
}
var PROXIED_METHODS$2 = ['get', 'count', 'keys', 'values', 'entries', 'keySeq', 'valueSeq', 'entrySeq'];
function listView(ValType, resolver) {
  var ProofNode = resolver.resolve({ ListProofNode: ValType });
  var ListView = function (_createType) {
    inherits(ListView, _createType);
    function ListView(obj) {
      classCallCheck(this, ListView);
      var root = ProofNode.from(obj);
      var _parseTreeStructure = parseTreeStructure(root),
          depth = _parseTreeStructure.depth,
          values = _parseTreeStructure.values;
      var map = immutable.OrderedMap(values.map(function (node) {
        return [node.pos, node.val];
      }));
      return possibleConstructorReturn(this, (ListView.__proto__ || Object.getPrototypeOf(ListView)).call(this, { map: map, root: root, depth: depth }));
    }
    createClass(ListView, [{
      key: 'rootHash',
      value: function rootHash() {
        return treeHash(rawValue(this).root);
      }
    }, {
      key: 'depth',
      value: function depth() {
        return rawValue(this).depth;
      }
    }]);
    return ListView;
  }(createType({
    name: 'ListView<' + ValType.inspect() + '>'
  }));
  ListView.prototype.rootHash = memoize(ListView.prototype.rootHash);
  PROXIED_METHODS$2.forEach(function (methodName) {
    ListView.prototype[methodName] = function () {
      var map = rawValue(this).map;
      return map[methodName].apply(map, arguments);
    };
  });
  return ListView;
}
var listView$1 = initFactory(listView, {
  name: 'listView',
  argumentMeta: 'value',
  prepare: function prepare(Type, resolver) {
    return resolver.resolve(Type);
  }
});

function getBit(buffer, pos) {
  var byte = Math.floor(pos / 8);
  var bitPos = pos % 8;
  return (buffer[byte] & 1 << 7 - bitPos) >> 7 - bitPos;
}
function extendBits256(Bits256Base) {
  var BIT_LENGTH = 256;
  return function (_Bits256Base) {
    inherits(Bits256, _Bits256Base);
    function Bits256(str) {
      classCallCheck(this, Bits256);
      return possibleConstructorReturn(this, (Bits256.__proto__ || Object.getPrototypeOf(Bits256)).call(this, {
        isTerminal: str.length === BIT_LENGTH,
        bytes: { bin: padWithZeros(str, BIT_LENGTH) },
        bitLengthByte: str.length % BIT_LENGTH
      }));
    }
    createClass(Bits256, [{
      key: 'bitLength',
      value: function bitLength() {
        return this.isTerminal ? BIT_LENGTH : this.bitLengthByte;
      }
    }, {
      key: 'bit',
      value: function bit(pos) {
        pos = +pos;
        if (pos >= this.bitLength() || pos < 0) {
          return undefined;
        }
        return getBit(this.bytes, pos);
      }
    }, {
      key: 'append',
      value: function append(otherBits) {
        var sumLength = this.bitLength() + otherBits.bitLength();
        if (sumLength > BIT_LENGTH) {
          throw new Error('Resulting bit slice too long: ' + sumLength + ' (max ' + BIT_LENGTH + ' supported)');
        }
        return new Bits256(this.toJSON() + otherBits.toJSON());
      }
    }, {
      key: 'toJSON',
      value: function toJSON() {
        return trimZeros(this.getOriginal('bytes').toString('bin'), this.bitLength());
      }
    }, {
      key: 'toString',
      value: function toString() {
        var bits = this.bitLength() > 8 ? trimZeros(this.getOriginal('bytes').toString('bin'), 8) + '...' : trimZeros(this.getOriginal('bytes').toString('bin'), this.bitLength());
        return 'bits(' + bits + ')';
      }
    }]);
    return Bits256;
  }(Bits256Base);
}
var ZEROS = function () {
  var str = '0';
  for (var i = 0; i < 8; i++) {
    str = str + str;
  }return str;
}();
function padWithZeros(str, desiredLength) {
  return str + ZEROS.substring(0, desiredLength - str.length);
}
function trimZeros(str, desiredLength) {
  if (str.length < desiredLength) {
    throw new Error('Invariant broken: negative zero trimming requested');
  }
  return str.substring(0, desiredLength);
}

function parseTreeStructure$1(tree, Bits256) {
  var nodes = [];
  var leaves = [];
  function pushNode(node, key) {
    node.fullKey = key;
    nodes.push(node);
  }
  pushNode(tree, Bits256.from(''));
  var _loop = function _loop(i) {
    var node = nodes[i];
    var key = node.fullKey;
    node.match({
      branch: function branch(_ref) {
        var left = _ref.left,
            right = _ref.right,
            leftKey = _ref.leftKey,
            rightKey = _ref.rightKey;
        if (key.bitLength() === 0) {
          var pos = 0;
          var maxPos = Math.min(leftKey.bitLength(), rightKey.bitLength());
          while (pos < maxPos && leftKey.bit(pos) === rightKey.bit(pos)) {
            pos++;
          }
          if (pos === maxPos) {
            throw new Error('Invalid MapView: one of the keys at the root is a substring of the other key');
          }
          if (leftKey.bit(pos) > rightKey.bit(pos)) {
            throw new TypeError('Invalid MapView: Incorrect key ordering');
          }
        } else {
          if (leftKey.bit(0) !== 0 || rightKey.bit(0) !== 1) {
            throw new Error('Invalid MapView: Incorrect key ordering');
          }
        }
        pushNode(left, key.append(leftKey));
        pushNode(right, key.append(rightKey));
      },
      _: function _() {
        return leaves.push(node);
      }
    });
  };
  for (var i = 0; i < nodes.length; i++) {
    _loop(i);
  }
  var values = leaves.filter(function (node) {
    return node.type === 'val';
  });
  if (!values.every(function (node) {
    return node.fullKey.isTerminal;
  })) {
    throw new Error('Invalid MapView: non-terminal key at value node');
  }
  return { nodes: nodes, leaves: leaves, values: values };
}
function validateStub(stub) {
  if (!stub.key.isTerminal) {
    throw new Error('Invalid MapView: non-terminal key at an isolated node');
  }
}
function stubHash(_ref2) {
  var key = _ref2.key,
      value = _ref2.value;
  var valueHash = value.type === 'val' ? hash(value.val) : value.hash;
  return hash(key, valueHash);
}
function treeHash$1(node) {
  return node.match({
    hash: function hash$$1(h) {
      return h;
    },
    val: function val(_val) {
      return hash(_val);
    },
    branch: function branch(_ref3) {
      var left = _ref3.left,
          right = _ref3.right;
      return hash(treeHash$1(left), treeHash$1(right), left.fullKey, right.fullKey);
    }
  });
}
function searchKey(node, key) {
  var pos = 0;
  while (node.type === 'branch') {
    var _node$branch = node.branch,
        left = _node$branch.left,
        right = _node$branch.right,
        leftKey = _node$branch.leftKey,
        rightKey = _node$branch.rightKey;
    var i = 0;
    while (leftKey.bit(i) === getBit(key, pos + i) && rightKey.bit(i) === getBit(key, pos + i)) {
      i++;
    }
    if (pos === 0 && leftKey.bit(i) === rightKey.bit(i) && leftKey.bit(i) !== getBit(key, i)) {
      return false;
    }
    var path = void 0;
    var pathKey = void 0;
    if (leftKey.bitLength() < i || leftKey.bit(i) === getBit(key, pos + i)) {
      path = left;
      pathKey = leftKey;
    } else if (rightKey.bitLength() < i || rightKey.bit(i) === getBit(key, pos + i)) {
      path = right;
      pathKey = rightKey;
    } else {
      throw new Error('Invariant broken: Bogus execution path in searching a key in MapView');
    }
    while (i < pathKey.bitLength() && pathKey.bit(i) === getBit(key, pos + i)) {
      i++;
    }
    if (i >= pathKey.bitLength()) {
      pos += pathKey.bitLength();
      node = path;
    } else {
      return false;
    }
  }
  return true;
}
var PROXIED_METHODS$3 = ['keys', 'values', 'entries', 'keySeq', 'valueSeq', 'entrySeq'];
function mapView(ValType, resolver) {
  var Hash = resolver.resolve('Hash');
  var Bits256 = resolver.resolve('Bits256');
  var ProofRoot = resolver.resolve({ MapProofRoot: ValType });
  var MapView = function (_createType) {
    inherits(MapView, _createType);
    function MapView(obj) {
      classCallCheck(this, MapView);
      var root = ProofRoot.from(obj);
      var mapEntries = root.match({
        empty: function empty() {
          return [];
        },
        stub: function stub(_stub) {
          validateStub(_stub);
          return _stub.value.match({
            val: function val(_val2) {
              return [[_stub.key.getOriginal('bytes'), _val2]];
            },
            _: function _() {
              return [];
            }
          });
        },
        tree: function tree(_tree) {
          var _parseTreeStructure = parseTreeStructure$1(_tree, Bits256),
              values = _parseTreeStructure.values;
          return values.map(function (node) {
            return [node.fullKey.getOriginal('bytes'), node.val];
          });
        }
      });
      return possibleConstructorReturn(this, (MapView.__proto__ || Object.getPrototypeOf(MapView)).call(this, { root: root, map: immutable.OrderedMap(mapEntries) }));
    }
    createClass(MapView, [{
      key: 'rootHash',
      value: function rootHash() {
        var root = rawValue(this).root;
        return root.match({
          empty: function empty() {
            return new Uint8Array(32);
          },
          stub: function stub(_stub2) {
            return stubHash(_stub2);
          },
          tree: function tree(_tree2) {
            return treeHash$1(_tree2);
          }
        });
      }
    }, {
      key: 'count',
      value: function count() {
        return rawValue(this).map.count();
      }
    }, {
      key: 'has',
      value: function has(hash$$1) {
        var map = rawValue(this).map;
        return map.has(Hash.from(hash$$1));
      }
    }, {
      key: 'get',
      value: function get$$1(hash$$1) {
        var map = rawValue(this).map;
        return map.get(Hash.from(hash$$1));
      }
    }, {
      key: 'mayHave',
      value: function mayHave(hash$$1) {
        var root = rawValue(this).root;
        return root.match({
          empty: function empty() {
            return false;
          },
          stub: function stub(_stub3) {
            return Hash.from(hash$$1).equals(_stub3.key.getOriginal('bytes'));
          },
          tree: function tree(_tree3) {
            return searchKey(_tree3, rawValue(Hash.from(hash$$1)));
          }
        });
      }
    }]);
    return MapView;
  }(createType({
    name: 'MapView<' + ValType.inspect() + '>'
  }));
  MapView.prototype.rootHash = memoize(MapView.prototype.rootHash);
  PROXIED_METHODS$3.forEach(function (methodName) {
    MapView.prototype[methodName] = function () {
      var map = rawValue(this).map.mapKeys(function (k) {
        return rawValue(k, true);
      });
      return map[methodName].apply(map, arguments);
    };
  });
  return MapView;
}
var mapView$1 = initFactory(mapView, {
  name: 'mapView',
  argumentMeta: 'value',
  prepare: function prepare(ValType, resolver) {
    return resolver.resolve(ValType);
  }
});

var rawDefinitions = [{ "name": "Uint8", "uinteger": 1 }, { "name": "Int8", "integer": 1 }, { "name": "Uint16", "uinteger": 2 }, { "name": "Int16", "integer": 2 }, { "name": "Uint32", "uinteger": 4 }, { "name": "Int32", "integer": 4 }, { "name": "Uint64", "uinteger": 8 }, { "name": "Int64", "integer": 8 }, { "name": "PublicKey", "fixedBuffer": 32 }, { "name": "Signature", "fixedBuffer": 64 }, { "name": "Hash", "fixedBuffer": 32 }, {
  "name": "Block",
  "struct": [{ "name": "schemaVersion", "type": "Uint16" }, { "name": "proposerId", "type": "Uint16" }, { "name": "height", "type": "Uint64" }, { "name": "txCount", "type": "Uint32" }, { "name": "prevHash", "type": "Hash" }, { "name": "txHash", "type": "Hash" }, { "name": "stateHash", "type": "Hash" }]
}, {
  "name": "TimeSpec",
  "struct": [{ "name": "secs", "type": "Uint64" }, { "name": "nanos", "type": "Uint32" }]
}, {
  "name": "Precommit",
  "message": {
    "serviceId": 0,
    "messageId": 4,
    "body": {
      "struct": [{ "name": "validator", "type": "Uint16" }, { "name": "height", "type": "Uint64" }, { "name": "round", "type": "Uint32" }, { "name": "proposeHash", "type": "Hash" }, { "name": "blockHash", "type": "Hash" }, { "name": "time", "type": "TimeSpec" }]
    }
  }
}, {
  "name": "ListProofNode",
  "factory": {
    "typeParams": [{ "name": "T" }],
    "union": [{
      "name": "branch",
      "type": {
        "struct": [{ "name": "left", "type": { "ListProofNode": { "typeParam": "T" } } }, { "name": "right", "type": { "ListProofNode": { "typeParam": "T" } } }]
      }
    }, { "name": "stub", "type": { "ListProofNode": { "typeParam": "T" } } }, { "name": "hash", "type": "Hash" }, { "name": "val", "type": { "typeParam": "T" } }]
  }
}, {
  "name": "Bits256",
  "struct": [{ "name": "isTerminal", "type": "Bool" }, { "name": "bytes", "type": "Hash" }, { "name": "bitLengthByte", "type": "Uint8" }]
}, {
  "name": "MapProofNode",
  "factory": {
    "typeParams": [{ "name": "V" }],
    "union": [{
      "name": "branch",
      "type": {
        "struct": [{ "name": "left", "type": { "MapProofNode": { "typeParam": "V" } } }, { "name": "right", "type": { "MapProofNode": { "typeParam": "V" } } }, { "name": "leftKey", "type": "Bits256" }, { "name": "rightKey", "type": "Bits256" }]
      }
    }, { "name": "hash", "type": "Hash" }, { "name": "val", "type": { "typeParam": "V" } }]
  }
}, {
  "name": "MapProofRoot",
  "factory": {
    "typeParams": [{ "name": "V" }],
    "union": {
      "tagEmbedding": "none",
      "variants": [{ "name": "empty", "type": "None" }, {
        "name": "stub",
        "type": {
          "struct": [{ "name": "key", "type": "Bits256" }, {
            "name": "value",
            "type": {
              "union": [{ "name": "hash", "type": "Hash" }, { "name": "val", "type": { "typeParam": "V" } }]
            }
          }]
        }
      }, { "name": "tree", "type": { "MapProofNode": { "typeParam": "V" } } }]
    }
  }
}];

var resolver = new TypeResolver().addNativeTypes({ Str: Str, Bool: Bool, None: None }).addFactories({
  array: array$1,
  integer: integer,
  uinteger: uinteger,
  fixedBuffer: fixedBuffer$1,
  buffer: fixedBuffer$1,
  option: option$1,
  struct: struct$1,
  union: union$1,
  enum: union$1,
  message: message$1,
  listView: listView$1,
  mapView: mapView$1
}).add(rawDefinitions).extend('Bits256', extendBits256);
var types = resolver.namedTypes().toObject();
types.resolver = resolver;
types.resolve = resolver.resolve.bind(resolver);
resolver.namedFactories().forEach(function (factory, fName) {
  types[fName] = factory;
});

function convertListJSON(json) {
  function convertChild(json, child) {
    if (typeof json[child] === 'string') {
      json[child] = { hash: json[child] };
    } else {
      convertListJSON(json[child]);
    }
  }
  if ('left' in json && 'right' in json) {
    json.branch = {
      left: json.left,
      right: json.right
    };
    delete json.left;
    delete json.right;
    convertChild(json.branch, 'left');
    convertChild(json.branch, 'right');
  } else if ('left' in json) {
    json.stub = json.left;
    delete json.left;
    convertChild(json, 'stub');
  } else if ('val' in json) {} else {
    throw new TypeError('Invalid list JSON');
  }
  return json;
}
function convertTreeJSON(json) {
  function convertChild(json, child) {
    if (typeof json[child] === 'string') {
      json[child] = { hash: json[child] };
    } else {
      convertTreeJSON(json[child]);
    }
  }
  if ('val' in json) {} else if (Object.keys(json).length === 2) {
    var _Object$keys$sort = Object.keys(json).sort(),
        leftKey = _Object$keys$sort[0],
        rightKey = _Object$keys$sort[1];
    json.branch = {
      leftKey: leftKey,
      rightKey: rightKey,
      left: json[leftKey],
      right: json[rightKey]
    };
    delete json[leftKey];
    delete json[rightKey];
    convertChild(json.branch, 'left');
    convertChild(json.branch, 'right');
  } else {
    throw new TypeError('Invalid proof node');
  }
  return json;
}
function convertMapJSON(json) {
  if (!json || (typeof json === 'undefined' ? 'undefined' : _typeof(json)) !== 'object') {
    throw new TypeError('Invalid JSON for MapView; object expected');
  }
  var props = Object.keys(json);
  switch (props.length) {
    case 0:
      return null;
    case 1:
      return {
        key: props[0],
        value: typeof json[props[0]] === 'string' ? { hash: json[props[0]] } : json[props[0]]
      };
    case 2:
      return convertTreeJSON(json);
    default:
      throw new TypeError('Invalid JSON for MapView; object with <=2 properties expected');
  }
}

for (var name in types) {
  exports[name] = types[name];
}
var index = Object.assign(types, {
  isExonumFactory: isExonumFactory,
  isExonumType: isExonumType,
  isExonumObject: isExonumObject,
  crypto: crypto
});

exports.isExonumFactory = isExonumFactory;
exports.isExonumType = isExonumType;
exports.isExonumObject = isExonumObject;
exports.crypto = crypto;
exports['default'] = index;
exports.convertListJSON = convertListJSON;
exports.convertMapJSON = convertMapJSON;

Object.defineProperty(exports, '__esModule', { value: true });

})));
