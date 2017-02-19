/* global describe, it */

'use strict'

var assert = require('assert')
var clones = require('clones')
var saferEval = require('..')

var isBrowser = (typeof window !== 'undefined')
// var isSafari = isBrowser && version(/Version\/(\d+).* Safari/)
// var isFirefox = isBrowser && version(/Firefox\/(\d+)/)
// var isEdge = isBrowser && version(/Edge\/(\d+)/)

function version (regex) {
  var m = regex.exec(navigator.userAgent)
  if (m) return m[1]
}

describe('#saferEval', function () {
  it('should throw if code is not a string', function () {
    assert.throws(function () {
      saferEval(function () {})
    }, TypeError)
  })

  describe('should evaluate', function () {
    var tests = [
      ['[object String]', "'string'", 'string'],
      ['[object Number]', '3.1415', 3.1415],
      ['[object Boolean]', 'true', true],
      ['[object Null]', 'null', null],
      ['[object Undefined]', 'undefined', undefined],
      ['[object Array]', "[1, 2, '3']", [1, 2, '3']],
      ['[object Object]', '{a: "a", b: "b"}', {a: 'a', b: 'b'}],
      ['[object RegExp]', '/test/', /test/],
      ['[object Date]', 'new Date("1970-01-01T00:00:00")', new Date('1970-01-01T00:00:00')],
      ['[object Error]', 'new Error("boom")', new Error('boom')],
      ['[object Uint8Array]', 'new Uint8Array([0, 1, 2, 3])', new Uint8Array([0, 1, 2, 3])],
      ['[object Function]', 'function () { return 3 }', function () { return 3 }]
    ]
    tests.forEach(function (test) {
      var type = test[0]
      var inp = test[1]
      var exp = test[2]
      it('to ' + type + ' ' + inp, function () {
        var res = saferEval(inp)
        assert.equal(toString.call(res), type)
        if (type === '[object Function]') {
          assert.equal(res(), exp())
        } else if (type === '[object Error]') {
          assert.equal(res.message, exp.message)
        } else {
          assert.deepEqual(res, exp)
        }
      })
    })

    it('on IIFE', function () {
      var res = saferEval('(function () { return 42 })()')
      assert.equal(toString.call(res), '[object Number]')
      assert.deepEqual(res, 42)
    })

    if (!isBrowser) {
      it('throwing on unknown Buffer', function () {
        assert.throws(function () {
          saferEval("new Buffer('data')")
        }, /Buffer is not /)
      })
    }
  })

  describe('should evaluate with context', function () {
    it('to Function', function () {
      var res = saferEval('new Function("return 9 + 25")', {Function, Function}) // eslint-disable-line no-dupe-keys
      assert.equal(toString.call(res), '[object Function]')
      assert.equal(res(), 34)
    })
    it('allowing console.log', function () {
      var res = saferEval('console.log("hurrah")', {console: console})
      assert.equal(res, undefined)
    })
    if (!isBrowser) {
      it('to Buffer', function () {
        var res = saferEval("new Buffer('data')", {Buffer: Buffer})
        assert.equal(toString.call(res), '[object Uint8Array]')
        assert.deepEqual(res, new Buffer('data'))
      })
    }
    if (isBrowser) {
      it('can pass navigator', function () {
        var code = `{d: new Date('1970-01-01'), b: function () { return navigator.userAgent }}`
        var res = saferEval(code, {navigator: window.navigator})
        assert.equal(toString.call(res.b), '[object Function]')
        assert.equal(toString.call(res.b()), '[object String]')
        // console.log(res.b())
      })
    }
  })

  describe('should protect against overwriting', function () {
    it('Math', function () {
      var res = saferEval(`(function () {
          Math.abs = function () {}
          if (Math.abs(4) !== undefined) {
            throw new Error()
          }
        })`)
      res()
      assert.equal(Math.abs(-4), 4)
    })
    it('Math should work', function () {
      var res = saferEval(`Math.abs(-4)`)
      assert.equal(res, Math.abs(-4))
    })
    it('JSON', function () {
      var res = saferEval(`(function () {
          JSON.stringify = function () {}
          if (JSON.stringify({a: 1}) !== undefined) {
            throw new Error()
          }
        })`)
      res()
      assert.equal(JSON.stringify({a: 1}), '{"a":1}')
    })
    it('JSON should work', function () {
      var res = saferEval(`JSON.stringify({a: 1})`)
      assert.equal(res, '{"a":1}')
    })
  })

  describe('should not evaluate', function () {
    it('throws on console.log', function () {
      assert.throws(function () {
        saferEval('console.log("exploit")')
      }, /console|log/)
    })
    it('throws on eval', function () {
      assert.throws(function () {
        saferEval('eval(9 + 25)')
      })
    })
    it('throws on Function', function () {
      assert.throws(function () {
        saferEval('Function("9 + 25")')
      })
    })
    it('throws on new Function', function () {
      assert.throws(function () {
        saferEval('new Function("return 9 + 25")')
      })
    })
    it('should not overwrite unescape', function () {
      saferEval('(unescape = function () { return 1 })')
      assert.ok(unescape.toString() !== 'function () { return 1 })')
    })

    if (!isBrowser) {
      describe('in node', function () {
        it('overwriting setTimeout', function () {
          assert.throws(function () {
            saferEval('(setTimeout = "exploit")')
          }, /setTimeout is not defined/)
        })
        it('throws on setting a global variable', function () {
          assert.throws(function () {
            saferEval('(global.exploit = "exploit")')
          })
        })
      })
    }

    if (isBrowser) {
      describe('in browser', function () {
        it('overwriting setTimeout', function () {
          saferEval('(setTimeout = "exploit")')
          assert.equal(toString.call(setTimeout), '[object Function]')
        })
        it('throws on setting a global variable', function () {
          assert.throws(function () {
            saferEval('(window.exploit = "exploit")')
          })
        })
      })
    }
  })

  describe('harmful context', function () {
    if (!isBrowser) {
      describe('in node', function () {
        it('evaluates global.eval', function () {
          var res = saferEval('global.eval(9 + 25)', {global: global}) // !!! try to avoid passing a global context
          assert.equal(res, 34)
        })
        it('should not be able to exploit a global property', function () {
          global.myglobal = 'test'
          saferEval("(global.myglobal = 'exploited')", {global: clones(global)})
          assert.equal(global.myglobal, 'test')
        })
        it('should not be able to overwrite a global method', function () {
          saferEval('(global.setTimeout = undefined)', {global: clones(global)})
          assert.ok(global.setTimeout !== undefined)
        })
        it('should evaluate', function (done) {
          saferEval(`(function () {
            global.setTimeout(function () {
              global.console.log('hello')
            }, 10)
            global.clearTimeout = undefined
          })()`, {global: clones(global)})
          setTimeout(function () {
            assert.ok(global.clearTimeout !== undefined)
            done()
          }, 30)
        })
      })
    }

    if (isBrowser) {
      describe('in browser', function () {
        it('evaluates window.eval', function () {
          this.timeout(10000)
          var res = saferEval('window.eval(9 + 25)', {window: window}) // !!! try to avoid passing a global context
          assert.equal(res, 34)
        })
        it('should not be able to exploit into a global property', function () {
          this.timeout(10000)
          saferEval("(window.myglobal = 'exploited')", clones({window: window}))
          assert.equal(window.myglobal, undefined)
        })
        it('using safer context', function () {
          var code = `[window.location.origin, window.screen.availWidth, window.btoa('Hello, world')]`
          var context = {
            window: {
              screen: window.screen, // can't wrap screen and location with clones
              location: window.location,
              btoa: clones(window.btoa, window)
            }
          }
          var res = saferEval(code, context)
          // console.log(res)
          assert.equal(res.length, 3)
          assert.equal(typeof res[0], 'string')
          assert.equal(typeof res[1], 'number')
          assert.equal(res[2], 'SGVsbG8sIHdvcmxk')
        })
        it('should evaluate', function (done) {
          this.timeout(10000)
          saferEval(`(function () {
            window.setTimeout(function () {
              window.console.log('hello')
            }, 10)
            // window.clearTimeout = undefined // this is harmful!!!
          })()`, {window: window})
          setTimeout(function () {
            // assert.ok(window.clearTimeout !== undefined)
            done()
          }, 30)
        })
        it('should evaluate safely', function (done) {
          var context = {
            setTimeout: clones(setTimeout, window),
            clearTimeout: clones(clearTimeout, window),
            console: clones(console, console)
          }

          saferEval(`(function () {
            var start = Date.now()
            setTimeout(function () {
              console.log('hello', Date.now() - start)
            }, 10)
            clearTimeout = undefined
          })()`, context)
          setTimeout(function () {
            assert.ok(clearTimeout !== undefined)
            done()
          }, 30)
        })
      })
    }
  })
})
