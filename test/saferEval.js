/* eslint no-new-func:0 */
/* global describe, it */

var assert = require('assert')
var clones = require('clones')
var saferEval = require('..')

var isBrowser = (typeof window !== 'undefined')
// var isSafari = isBrowser && version(/Version\/(\d+).* Safari/)
// var isFirefox = isBrowser && version(/Firefox\/(\d+)/)
// var isEdge = isBrowser && version(/Edge\/(\d+)/)

// zuul testing needs some special treatment
if (typeof assert.deepStrictEqual === 'undefined') {
  assert.deepStrictEqual = assert.deepEqual // eslint-disable-line
}

function version (regex) { // eslint-disable-line no-unused-vars
  var m = regex.exec(navigator.userAgent)
  if (m) return m[1]
}

describe('#saferEval', function () {
  it('should throw if code is not a string', function () {
    assert.throws(function () {
      saferEval(function () {})
    }, Error)
  })

  describe('should evaluate', function () {
    var tests = [
      ['[object String]', "'string'", 'string'],
      ['[object Number]', '3.1415', 3.1415],
      ['[object Boolean]', 'true', true],
      ['[object Null]', 'null', null],
      ['[object Undefined]', 'undefined', undefined],
      ['[object Array]', "[1, 2, '3']", [1, 2, '3']],
      ['[object Object]', '{a: "a", b: "b"}', { a: 'a', b: 'b' }],
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

        assert.strictEqual(toString.call(res), type)

        if (type === '[object Function]') {
          assert.strictEqual(res(), exp())
        } else if (type === '[object Error]') {
          assert.strictEqual(res.message, exp.message)
        } else if (type === '[object Uint8Array]') {
          assert.strictEqual(res.toString(), exp.toString()) // can't deepEqual typed arrays on node4
        } else {
          assert.deepEqual(res, exp) // eslint-disable-line node/no-deprecated-api
        }
      })
    })

    it('allowing console.log', function () {
      var res = saferEval('console.log("hurrah")')
      assert.strictEqual(res, undefined)
    })

    it('setTimeout passing a function', function (done) {
      var res = saferEval('setTimeout(function () {Array._test = 111}, 5)')
      assert.ok(res)
      setTimeout(function () {
        assert.strictEqual(Array._test, undefined)
        done()
      }, 10)
    })

    it('setInterval passing a function', function (done) {
      var res = saferEval('(function (){var id = setInterval(function () {Array._test = 111;  console.log("intervall"); clearInterval(id)}, 5)}())')
      assert.strictEqual(res)
      setTimeout(function () {
        assert.strictEqual(Array._test, undefined)
        done()
      }, 15)
    })

    if (!isBrowser) {
      it('to Buffer', function () {
        var res = saferEval("new Buffer('data')")
        assert.strictEqual(toString.call(res), '[object Uint8Array]')
        assert.deepStrictEqual(res, Buffer.from('data'))
      })
    }

    it('on IIFE', function () {
      var res = saferEval('(function () { return 42 })()')
      assert.strictEqual(toString.call(res), '[object Number]')
      assert.deepStrictEqual(res, 42)
    })
  })

  describe('should evaluate with context', function () {
    if (isBrowser) {
      it('can pass navigator', function () {
        var code = `{d: new Date('1970-01-01'), b: function () { return navigator.userAgent }}`
        var res = saferEval(code, { navigator: window.navigator })
        assert.strictEqual(toString.call(res.b), '[object Function]')
        assert.strictEqual(toString.call(res.b()), '[object String]')
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
        })`
      )
      res()
      assert.strictEqual(Math.abs(-4), 4)
    })
    it('Math should work', function () {
      var res = saferEval(`Math.abs(-4)`)
      assert.strictEqual(res, Math.abs(-4))
    })
    it('JSON', function () {
      var res = saferEval(`(function () {
          JSON.stringify = function () {}
          if (JSON.stringify({a: 1}) !== undefined) {
            throw new Error()
          }
        })`)
      res()
      assert.strictEqual(JSON.stringify({ a: 1 }), '{"a":1}')
    })
    it('JSON should work', function () {
      var res = saferEval(`JSON.stringify({a: 1})`)
      assert.strictEqual(res, '{"a":1}')
    })
    it('unescape', function () {
      saferEval('(unescape = function () { return 1 })')
      assert.ok(unescape.toString() !== 'function () { return 1 })')
    })
    it('console.log', function () {
      saferEval(`(function () {
        console.log = function () { return 1 }
        if (console.log() !== 1) {
          throw new Error()
        }
      })()`)
      assert.ok(console.log.toString() !== 'function () { return 1 })')
    })
    it('Array', function () {
      saferEval(`(function () {
        Array.prototype.reverse = function () { return 1 }
        Array.exploit = 1
      })()`)
      assert.ok(Array.prototype.reverse.toString() !== 'function () { return 1 })')
      assert.ok(Array.exploit === undefined)
    })
    it('Object', function () {
      var res = saferEval(`(function () {
          Object = {}
          Object.assign = function () {}
          if (Object.assign({a:1}, {b:1}) !== undefined) {
            throw new Error()
          }
        })`)
      res()
      assert.deepStrictEqual(Object.assign({ a: 1 }, { b: 2 }), { a: 1, b: 2 })
    })
    it('Function', function () {
      var res = saferEval(`(function () {
        Function = function () { return function () { return 7 } }
        return Function("return 9 + 25")()
      })()`)
      assert.strictEqual(res, 7)
      assert.strictEqual(Function('return 9 + 25')(), 34)
    })
    it('new Function', function () {
      var res = saferEval(`(function () {
        Function = function () { return function () { return 7 } }
        return new Function("return 9 + 25")()
      })()`)
      assert.strictEqual(res, 7)
      assert.strictEqual(new Function('return 9 + 25')(), 34)
    })
    if (!isBrowser) {
      it('Buffer', function () {
        saferEval('(function () { Buffer.poolSize = "exploit"; })()')
        assert.ok(Buffer.poolSize !== 'exploit')
      })
    }
    it('setTimeout', function () {
      try {
        saferEval('(setTimeout = "exploit")')
      } catch (e) {}
      assert.ok(setTimeout !== 'exploit')
    })
  })

  describe('should not evaluate', function () {
    it('throws on eval', function () {
      let res
      try {
        res = saferEval('eval(9 + 25)')
      } catch (e) {}
      assert.strictEqual(res, undefined)
    })

    it('to Function', function () {
      let res
      try {
        res = saferEval('new Function("return 9 + 25")')
      } catch (e) {}
      assert.strictEqual(res, undefined)
    })

    it('setTimeout passing a string', function (done) {
      try {
        saferEval('setTimeout("Array._test = 111", 5)')
      } catch (e) {
        /setTimeout requires function as argument/.test(e)
      }
      setTimeout(function () {
        assert.strictEqual(Array._test, undefined)
        done()
      }, 15)
    })

    it('setInterval passing a string', function (done) {
      try {
        saferEval('setInterval("Array._test = 111", 5)')
      } catch (e) {
        /setInterval requires function as argument/.test(e)
      }
      setTimeout(function () {
        assert.strictEqual(Array._test, undefined)
        done()
      }, 15)
    })

    if (!isBrowser) {
      describe('in node', function () {
        it('setting a global variable', function () {
          try {
            saferEval('(global.exploit = "exploit")')
          } catch (e) {
            /TypeError/.test(e)
          }
          assert.strictEqual(global.exploit, undefined)
        })
        it('should not allow using this.constructor.constructor', function () {
          let res
          try {
            res = saferEval("this.constructor.constructor('return process')()")
          } catch (e) {
          }
          assert.strictEqual(res, undefined)
        })
        it('should not allow using Object.constructor.constructor', function () {
          let res
          try {
            res = saferEval("Object.constructor.constructor('return process')()")
          } catch (e) {
          }
          assert.strictEqual(res, undefined)
        })
      })
    }

    if (isBrowser) {
      describe('in browser', function () {
        it('setting a global variable', function () {
          try {
            saferEval('(window.exploit = "exploit")')
          } catch (e) {}
          assert.strictEqual(window.exploit, undefined)
        })
        it('should not allow using this.constructor.constructor', function () {
          let res
          try {
            res = saferEval("this.constructor.constructor('return window.atob(\"42\")')()")
          } catch (e) {}
          assert.strictEqual(res, undefined)
          assert.strictEqual(
            this.constructor.constructor('return window.atob("42")')(), 'ã',
            'should not overwrite'
          )
        })
        it('should not allow using Object.constructor.constructor', function () {
          let res
          try {
            res = saferEval("Object.constructor.constructor('return localStorage')()")
          } catch (e) {
          }
          assert.strictEqual(res, undefined)
        })
      })
    }
  })

  describe('harmful context', function () {
    if (!isBrowser) {
      describe('in node', function () {
        it('evaluates global.eval if passing global as context - which is a bad idea', function () {
          var res = saferEval('global.eval(9 + 25)', { global: global }) // !!! try to avoid passing global as context this way
          assert.strictEqual(res, 34)
        })
        it('should not be able to exploit a global property', function () {
          global.myglobal = 'test'
          saferEval("(global.myglobal = 'exploited')", { global: clones(global) })
          assert.strictEqual(global.myglobal, 'test')
        })
        it('should not be able to overwrite a global method', function () {
          saferEval('(global.setTimeout = undefined)', { global: clones(global) })
          assert.ok(global.setTimeout !== undefined)
        })
        it('should evaluate', function (done) {
          saferEval(`(function () {
            global.setTimeout(function () {
              global.console.log('hello')
            }, 10)
            global.clearTimeout = undefined
          })()`, { global: clones(global) })
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
          var res = saferEval('window.eval(9 + 25)', { window: window }) // !!! try to avoid passing a global context
          assert.strictEqual(res, 34)
        })
        it('should not be able to exploit into a global property', function () {
          this.timeout(10000)
          try {
            saferEval("(window.myglobal = 'exploited')", clones({ window: window }))
          } catch (e) {
          }
          assert.strictEqual(window.myglobal, undefined)
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
          assert.strictEqual(res.length, 3)
          assert.strictEqual(typeof res[0], 'string')
          assert.strictEqual(typeof res[1], 'number')
          assert.strictEqual(res[2], 'SGVsbG8sIHdvcmxk')
        })
        it('should evaluate', function (done) {
          this.timeout(10000)
          saferEval(`(function () {
            window.setTimeout(function () {
              window.console.log('hello')
            }, 10)
            // window.clearTimeout = undefined // this is harmful!!!
          })()`, { window: window })
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
