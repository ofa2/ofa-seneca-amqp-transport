'use strict';
/**
 * @class AMQPSenecaClient
 * @module client
 */
const Amqputil = require('./amqp-util');

module.exports =
  class AMQPSenecaClient {
    constructor(seneca, transport, options, utils) {
      this.seneca = seneca;
      this.transport = transport;
      this.options = options;
      this.utils = utils || seneca.export('transport/utils');
    }

    callback(spec, topic, done) {
      return this.awaitReply()
        .then(() => this.publish)
        .asCallback(done);
    }

    publish(args, done) {
      var outmsg = this.utils.prepare_request(this, args, done);
      var outstr = this.utils.stringifyJSON(this.seneca, 'client-' + this.options.type, outmsg);
      var opts = {
        replyTo: this.transport.queue
      };
      var topic = Amqputil.resolveClientTopic(args);
      this.transport.channel.publish(this.transport.exchange, topic, new Buffer(outstr), opts);
    }

    consumeReply() {
      return (message) => {
        var content = message.content ? message.content.toString() : undefined;
        var input = this.utils.parseJSON(this.seneca, 'client-' + this.options.type, content);
        this.utils.handle_response(this.seneca, input, this.options);
      };
    }

    awaitReply() {
      return this.transport.channel.consume(this.transport.queue,
        this.consumeReply(), {
          noAck: true
        });
    }
  };
