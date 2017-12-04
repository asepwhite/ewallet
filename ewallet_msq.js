var amqp = require('amqplib/callback_api');
function initPingPublisher() {
  amqp.connect('amqp://sisdis:sisdis@172.17.0.3:5672', function(err, conn) {
    conn.createChannel(function(err, ch) {
      var ex = 'EX_PING';
      var msg = process.argv.slice(2).join(' ') || 'Hello World!';

      ch.assertExchange(ex, 'fanout', {durable: false});
      ch.publish(ex, '', new Buffer(msg));
      console.log(" [x] Sent %s", msg);
    });
  });
}

function sendPingMessage(ch, ex)
{
  setInterval(function(ch, ex){
    var message = "test hahaha"
    ch.publish(ex, '', new Buffer(message));
  }, 5000);
}

function initPingConsumer(){
  amqp.connect('amqp://sisdis:sisdis@172.17.0.3:5672', function(err, conn) {
    conn.createChannel(function(err, ch) {
      var ex = 'EX_PING';
      ch.assertExchange(ex, 'fanout', {durable: false});
      ch.assertQueue('', {exclusive: true}, function(err, q) {
        console.log(" [*] Waiting for messages in %s. To exit press CTRL+C", q.queue);
        ch.bindQueue(q.queue, ex, '');
        ch.consume(q.queue, function(msg) {
          console.log(" [x] %s", msg.content.toString());
        }, {noAck: true});
      });
    });
  });
}
initPingConsumer();
