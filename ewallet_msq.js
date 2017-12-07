const Sequelize = require('sequelize');
const sequelize = new Sequelize('sisdis', 'root', 'rootroot', {
  host: 'localhost',
  dialect: 'mysql'
});
const Pings = sequelize.define('pings', {
  npm: { type: Sequelize.INTEGER,  primaryKey: true },
  time: { type: Sequelize.DATE}
});
const User = sequelize.define('users', {
  npm: { type: Sequelize.INTEGER,  unique: true },
  nama: Sequelize.STRING,
  saldo: Sequelize.INTEGER
});
var amqp = require('amqplib/callback_api');
var moment = require('moment')

function initPingPublisher() {
  amqp.connect('amqp://sisdis:sisdis@172.17.0.3:5672', function(err, conn) {
    conn.createChannel(function(err, ch) {
      var ex = 'EX_PING';
      ch.assertExchange(ex, 'fanout', {durable: false});
      sendPingMessage(ch, ex);
    });
  });
}

function sendPingMessage(ch, ex)
{
  setInterval(function(){
    var currTime = new Date(Date.now());
    currTime = moment(currTime).format("YYYY-MM-DD HH:mm:ss");
    var message = '{"action":"ping","npm":"1406623064","ts":"'+currTime+'"}'
    ch.publish(ex, '', new Buffer(message));
    console.log("SUCCES SENDING PING");
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
          var strMessage = msg.content.toString();
          try{
            var message = JSON.parse(strMessage)
            Pings.findOrCreate({where: {npm: message.npm}, defaults: {time: message.ts}})
          } catch(e) {
            console.log("error parsing JSON, logging message")
            console.log("=========")
            console.log(strMessage);
            console.log("*********")
          }
        }, {noAck: true});
      });
    });
  });
}

function initRegisterPublisher(routingKey, userID, name, senderID){
  console.log("--------------------")
  console.log(routingKey)
  console.log(userID)
  console.log(name)
  console.log(senderID)
  console.log("--------------------")
  amqp.connect('amqp://sisdis:sisdis@172.17.0.3:5672', function(err, conn) {
  conn.createChannel(function(err, ch) {
    var message = {};
    message.action = "register";
    message.user_id = userID;
    message.nama = name;
    message.sender_id = senderID;
    message.type = "request";
    var currTime = new Date(Date.now());
    currTime = moment(currTime).format("YYYY-MM-DD HH:mm:ss");
    message.ts = currTime;
    message = JSON.stringify(message);
    var ex = 'EX_REGISTER';
    ch.assertExchange(ex, 'direct', {durable: true});
    ch.publish(ex, routingKey, new Buffer(message));
    console.log(" [x] Sent a message with register key %s: and message'%s'", routingKey, message);
  });
  // setTimeout(function() { conn.close(); process.exit(0) }, 500);
  })
}

function initRegisterConsumer(){
  amqp.connect('amqp://sisdis:sisdis@172.17.0.3:5672', function(err, conn) {
    conn.createChannel(function(err, ch) {
      var ex = 'EX_REGISTER';
      var routingKey = 'REQ_1406623064'
      ch.assertExchange(ex, 'direct', {durable: true});
      ch.assertQueue('', {exclusive: true}, function(err, q) {
        console.log(' [*] Waiting for logs. To exit press CTRL+C');
        ch.bindQueue(q.queue, ex, routingKey);

        ch.consume(q.queue, function(msg) {
          console.log("BERHASIL MASUK KE CONSUMER REGISTER");
          console.log(" [x] %s: '%s'", msg.fields.routingKey, msg.content.toString());
        }, {noAck: true});
      });
    });
  });
}
initRegisterConsumer()
setInterval(function(){
    initRegisterPublisher('REQ_1406623064', '1406623064', 'Akbar Septriyan', '1406623064')
}, 5000);


// initPingPublisher();
// console.log("init consumer");
// initPingConsumer();
