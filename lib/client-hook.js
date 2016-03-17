'use strict';
/**
 * @class AMQPClientHook
 * @module client-hook
 */
const Amqputil = require('./amqp-util');
const Amqpuri = require('./amqp-uri');
const Amqp = require('amqplib');
const AMQPSenecaClient = require('./client');

module.exports =
  class AMQPClientHook {
    constructor(seneca) {
      this.seneca = seneca;
      this.utils = seneca.export('transport/utils');
    }

    start(args) {
      return Amqp.connect(args.url, args.socketOptions)
        .then((conn) => conn.createChannel())
        .then((channel) => {
          var ex = args.exchange;
          var qres = args.queues.response;
          var queueName = Amqputil.resolveClientQueue(qres);
          channel.prefetch(1);
          return Promise.props({
            channel,
            exchange: channel.assertExchange(ex.name, ex.type, ex.options),
            queue: channel.assertQueue(queueName, qres.options)
          });
        });
    }

    addClose(transport) {
      return this.seneca.add('role:seneca,cmd:close', function(closeArgs, done) {
        transport.channel.close();
        transport.channel.conn.close();
        this.prior(closeArgs, done);
      });
    }

    createClient(args, transport, done) {
      transport.channel.on('error', done);
      var client = new AMQPSenecaClient(this.seneca, this.transport, args, this.utils);
      return this.utils.make_client(this.seneca, client.callback(), args, done);
    }

    hook() {
      return (args, done) => {
        args.url = Amqpuri.format(args);
        return this.start(args)
          .then((transport) => [this.createClient(args, transport, done),
            this.addClose(transport)
          ]).all().catch(done);
      };
    }
  };
