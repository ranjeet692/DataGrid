// Generated by CoffeeScript 1.8.0

/*
  @author Gilles Gerlinger
  Copyright 2014. All rights reserved.
 */

(function() {
  var Local, Remote, Rpc, angularRpc, ioRpc, json, scRpc, wsRpc, xmlHttpRpc,
    __slice = [].slice,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  json = require('circular-json');

  Local = (function() {
    function Local(local, method, asynchronous) {
      this.asynchronous = asynchronous;
      this[method] = (function(_this) {
        return function(id, args, cb) {
          console.log("rpc " + id + ": executing local " + method + " - asynchronous: " + _this.asynchronous);
          return local[method].apply(local, __slice.call(args).concat([cb]));
        };
      })(this);
    }

    return Local;

  })();

  Remote = (function() {
    function Remote() {
      var count, method, methods, rpc, uid, _fn, _i, _len;
      rpc = arguments[0], methods = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      count = 0;
      uid = (Math.random() + '').substring(2, 8);
      _fn = (function(_this) {
        return function(method) {
          return _this[method] = function() {
            var args, cb;
            args = Array.prototype.slice.call(arguments);
            if (typeof args[args.length - 1] === 'function') {
              cb = args.pop();
            }
            if (rpc) {
              return rpc._request({
                method: method,
                args: args,
                cb: cb,
                id: "" + uid + "-" + (++count)
              });
            }
          };
        };
      })(this);
      for (_i = 0, _len = methods.length; _i < _len; _i++) {
        method = methods[_i];
        _fn(method);
      }
    }

    return Remote;

  })();

  exports.Rpc = Rpc = (function() {
    Rpc.prototype.cbID = 0;

    function Rpc() {
      this.locals = [];
      this.callbacks = [];
      this._out = (function(_this) {
        return function(msg, message) {
          return _this.log("rpc " + msg.id + " error: no rpc out route defined");
        };
      })(this);
    }

    Rpc.prototype.out = function(send) {
      return this._out = send;
    };

    Rpc.prototype._request = function(msg) {
      var cbname, message;
      if (msg.cb && typeof msg.cb === 'function') {
        this.callbacks[cbname = msg.method + (" cb" + (this.cbID++))] = msg.cb;
        msg.cb = cbname;
      }
      message = json.stringify(msg);
      this.log("rpc " + msg.id + ": out " + message);
      this._out(msg, message);
      return message;
    };

    Rpc.prototype._reply = function(msg, args) {
      if (msg.cb) {
        return this._request({
          method: msg.cb,
          args: args,
          id: msg.id
        });
      }
    };

    Rpc.prototype._error = function(msg, args) {
      if (msg.cb) {
        return this._request({
          method: msg.cb,
          args: args,
          err: true,
          id: msg.id
        });
      }
    };

    Rpc.prototype.process = function(message) {
      var args, e, err, local, msg, rst;
      try {
        if (typeof message === 'string') {
          msg = json.parse(message);
        } else {
          message = json.stringify(msg = message);
        }
        if (!(msg && msg.method)) {
          this.log(args = "rpc error: message is null");
          this._error({
            method: 'missing'
          }, args);
          return;
        }
        local = this.locals[msg.method];
        this.log("rpc " + msg.id + ": in  " + message);
        if (local) {
          if (local.asynchronous) {
            return local[msg.method](msg.id, msg.args, (function(_this) {
              return function(rst, err) {
                if (err) {
                  return _this._error(msg, err);
                } else {
                  return _this._reply(msg, rst);
                }
              };
            })(this));
          } else {
            return this._reply(msg, local[msg.method](msg.id, msg.args));
          }
        } else if (this.callbacks[msg.method]) {
          if (msg.err) {
            err = msg.args;
          } else {
            rst = msg.args;
          }
          this.callbacks[msg.method](rst, err);
          return delete this.callbacks[msg.method];
        } else {
          this.log(args = "error: method " + msg.method + " is unknown");
          return this._error(msg, args);
        }
      } catch (_error) {
        e = _error;
        this.log(args = "error in " + msg.method + ": " + e);
        return this._error(msg, args);
      }
    };

    Rpc.prototype._splat = function() {
      var args;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      if (arguments.length === 1 && typeof arguments[0] !== 'string') {
        return arguments[0];
      } else {
        return args;
      }
    };

    Rpc.prototype.remote = function() {
      var methods;
      methods = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return (function(func, args, ctor) {
        ctor.prototype = func.prototype;
        var child = new ctor, result = func.apply(child, args);
        return Object(result) === result ? result : child;
      })(Remote, [this].concat(__slice.call(this._splat.apply(this, methods))), function(){});
    };

    Rpc.prototype.implement = function() {
      var local, methods;
      local = arguments[0], methods = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      return this._expose.apply(this, [local, false].concat(__slice.call(this._splat.apply(this, methods))));
    };

    Rpc.prototype.implementAsync = function() {
      var local, methods;
      local = arguments[0], methods = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      return this._expose.apply(this, [local, true].concat(__slice.call(this._splat.apply(this, methods))));
    };

    Rpc.prototype._expose = function() {
      var asynchronous, local, method, methods, _i, _len, _results;
      local = arguments[0], asynchronous = arguments[1], methods = 3 <= arguments.length ? __slice.call(arguments, 2) : [];
      if (!methods.length) {
        for (method in local) {
          if (typeof local[method] === 'function' && method.charAt(0) !== '_') {
            methods.push(method);
          }
        }
        this.log("rpc methods found: " + methods);
      }
      _results = [];
      for (_i = 0, _len = methods.length; _i < _len; _i++) {
        method = methods[_i];

        if (!local[method]) {

          _results.push(this.log("rpc warning: local object has no method " + method));
        } else {

          if (this.locals[method]) {
            this.log("rpc warning: duplicate method " + method + ", now asynchronous: " + asynchronous);
          }

          _results.push(this.locals[method] = new Local(local, method, asynchronous));
        }
      }
      return _results;
    };

    Rpc.prototype.log = function(text) {
      return console.log(text.length < 128 ? text : text.substring(0, 127) + ' ...');
    };

    return Rpc;

  })();

  exports.wsRpc = wsRpc = (function(_super) {
    __extends(wsRpc, _super);

    function wsRpc(ws) {
      wsRpc.__super__.constructor.call(this);
      if (ws && ws.send) {
        this.out(function(msg, message) {
          return ws.send(message, (function(_this) {
            return function(err) {
              if (err) {
                return _this.log(err.toString());
              }
            };
          })(this));
        });
      }
      this["in"](ws);
    }

    wsRpc.prototype["in"] = function(ws) {
      if (ws) {
        if (ws.on) {
          return ws.on('message', (function(_this) {
            return function(message, flags) {
              if (!flags.binary) {
                return _this.process(message);
              }
            };
          })(this));
        } else {
          return ws.onmessage = (function(_this) {
            return function(e) {
              if (e.data.length) {
                return _this.process(e.data);
              }
            };
          })(this);
        }
      }
    };

    return wsRpc;

  })(Rpc);

  exports.angularRpc = angularRpc = (function(_super) {
    __extends(angularRpc, _super);

    function angularRpc(http) {
      angularRpc.__super__.constructor.call(this);
      this.out(function(msg, message) {
        return http.post('/rpc', msg).success((function(_this) {
          return function(message) {
            if (message) {
              return _this.process(message);
            }
          };
        })(this));
      });
    }

    return angularRpc;

  })(Rpc);

  exports.xmlHttpRpc = xmlHttpRpc = (function(_super) {
    __extends(xmlHttpRpc, _super);

    function xmlHttpRpc(xhr) {
      xmlHttpRpc.__super__.constructor.call(this);
      this.out(function(msg, message) {
        xhr.open('POST', '/rpc', true);
        xhr.setRequestHeader('Content-type', 'application/json');
        xhr.onload((function(_this) {
          return function() {
            return _this.process(xhr.response);
          };
        })(this));
        return xhr.send(message);
      });
    }

    return xmlHttpRpc;

  })(Rpc);

  exports.ioRpc = ioRpc = (function(_super) {
    __extends(ioRpc, _super);

    function ioRpc(socket, tag) {
      this.socket = socket;
      this.tag = 'rpc';
      this.locals = [];
      if (this.socket) {
        this.socket.on('rpc', (function(_this) {
          console.log("listing" + this.tag);
          return function(message, ack_cb) {
              console.log("listing");
            return _this.process(message, ack_cb);
          };
        })(this));
      }
    }

    ioRpc.prototype._request = function(msg) {
      var message;
      this.log("rpc " + msg.id + ": out " + this.tag + " " + (message = json.stringify(msg)));
      if (this.socket) {
        return this.socket.emit('rpc', message, function() {
          console.log("result");
          if (msg.cb) {
            console.log("result with cb");
            return msg.cb.apply(this, arguments);
          }
        });
      }
    };

    ioRpc.prototype.process = function(message, ack_cb) {
      var args, e, local, msg;
      msg = json.parse(message);
      this.log("rpc " + msg.id + ": in  " + this.tag + " " + message);
      if (local = this.locals[msg.method]) {
        try {
          args = msg.args || [];
          args.push((function(_this) {
            return function() {
              return ack_cb.apply(_this, arguments);
            };
          })(this));
          if (local.asynchronous) {
            return local[msg.method](msg.id, args);
          } else {
            return ack_cb(local[msg.method](msg.id, args));
          }
        } catch (_error) {
          e = _error;
          this.log(args = "error in " + msg.method + ": " + e);
          return ack_cb(null, args);
        }
      } else {
        this.log(args = "error: method " + msg.method + " is unknown");
        return ack_cb(null, args);
      }
    };

    return ioRpc;

  })(Rpc);

  exports.scRpc = scRpc = (function(_super) {
    __extends(scRpc, _super);

    function scRpc() {
      return scRpc.__super__.constructor.apply(this, arguments);
    }

    scRpc.prototype.process = function(message, ack_cb) {
      var args, e, local, msg;
      //console.log(message);
      msg = json.parse(message);
      this.log("rpc " + msg.id + ": in  " + this.tag + " " + message);
      if (local = this.locals[msg.method]) {
        try {
          args = msg.args || [];
          args.push((function(_this) {
            return function() {
              return ack_cb.apply(_this, arguments);
            };
          })(this));
          if (local.asynchronous) {
            return local[msg.method](msg.id, args);
          } else {
            return ack_cb(null, local[msg.method](msg.id, args));
          }
        } catch (_error) {
          e = _error;
          this.log(args = "error in " + msg.method + ": " + e);
          return ack_cb(args);
        }
      } else {
        this.log(args = "error: method " + msg.method + " is unknown");
        return ack_cb(args);
      }
    };

    return scRpc;

  })(ioRpc);

}).call(this);
