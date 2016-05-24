'use strict'

import shimmer from 'shimmer'
let debug = require('debug')('trail')

module.exports = {
    wrap(agent, redis = require('redis')) {
        this.redis = redis
        // TODO: how to proper indent multiline arguments?
        shimmer.wrap(this.redis.RedisClient.prototype, 'send_command', function (original) { // eslint-disable-line
            return function (...args) {
                let command = args[0]
                let last = args[args.length - 1]

                let span = agent.fork(command)
                span.setTag('host', this.address)
                span.setTag('protocol', 'redis')

                let wrappedCallback = function (originalCallback) {
                    return function (err) {
                        span.setTag('status', err ? 1 : 0)
                        span.finish()

                        return originalCallback.apply(this, arguments)
                    }
                }

                if (last && typeof last === 'function') {
                    args[args.length - 1] = wrappedCallback(last)
                } else if (Array.isArray(last) && typeof last[last.length - 1] === 'function') { // eslint-disable-line
                    last[last.length - 1] = wrappedCallback(last[last.length - 1]) // eslint-disable-line
                } else {
                    args.push(wrappedCallback(function () { }))
                }

                return original.apply(this, args)
            }
        })
        debug('Instrumented redis.RedisClient.prototype.send_command')

        return redis
    },
    unwrap() {
        shimmer.unwrap(this.redis.RedisClient.prototype, 'send_command')
        debug('Removed instrumentation from redis.RedisClient.prototype.send_command') // eslint-disable-line
    },
}
