const ewallet = require('./ewallet')
const Sequelize = require('sequelize');
const sequelize = new Sequelize('sisdis', 'root', 'rootroot', {
  host: 'localhost',
  dialect: 'mysql',
  logging: false
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
var transferQueue = []

var getTotalSaldoCounter = 0;
var getTotalSaldoQueue = []
var quourumNpm = ['1406623064', '1406623064', '1406623064', '1406623064', '1406623064']

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
    console.log("SUCCESS SENDING PING");
  }, 5000);
}

function initPingConsumer(){
  amqp.connect('amqp://sisdis:sisdis@172.17.0.3:5672', function(err, conn) {
    conn.createChannel(function(err, ch) {
      var ex = 'EX_PING';
      ch.assertExchange(ex, 'fanout', {durable: false});
      ch.assertQueue('', {exclusive: true}, function(err, q) {
        console.log(" STARTING PING CONSUMER", q.queue);
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
      console.log(" Sent a message with register key %s: and message'%s'", routingKey, message);
    });
  })
}

function initRegisterRespPublisher(routingKey, status_register, ts){
  amqp.connect('amqp://sisdis:sisdis@172.17.0.3:5672', function(err, conn) {
    conn.createChannel(function(err, ch) {
      var message = {};
      message.action = "register";
      message.type = "response";
      message.status_register = status_register;
      message.sender_id = "1406623064";
      message.ts = ts;
      message = JSON.stringify(message);
      var ex = 'EX_REGISTER';
      ch.assertExchange(ex, 'direct', {durable: true});
      ch.publish(ex, routingKey, new Buffer(message));
      console.log(" Sent a message with register key %s: and message'%s'", routingKey, message);
    });
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
        routingKey = 'RESP_1406623064'
        ch.bindQueue(q.queue, ex, routingKey);
        ch.consume(q.queue, function(msg) {
          console.log("Reading message data");
          console.log(" [x] %s: '%s'", msg.fields.routingKey, msg.content.toString());
          var strMessage = msg.content.toString();
          try{
            var message = JSON.parse(strMessage)
            if(message.type == 'response'){
              console.log('REPONSE FROM ???, STATUS REGISTER IS', message.status_register)
            } else if(message.type == 'request')  {
              ewallet.register(message.user_id, message.nama).then(function(res){
                  var currTime = new Date(Date.now());
                  currTime = moment(currTime).format("YYYY-MM-DD HH:mm:ss");
                  initRegisterRespPublisher("RESP_"+message.sender_id, res, currTime);
              }).catch(function(err){
                  console.log("ini log error dengan message error ", err)
                  var currTime = new Date(Date.now());
                  currTime = moment(currTime).format("YYYY-MM-DD HH:mm:ss");
                  initRegisterRespPublisher("RESP_"+message.sender_id, res, currTime);
              })
            }
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

function initGetSaldoPublisher(routingKey, userID, senderID){
  amqp.connect('amqp://sisdis:sisdis@172.17.0.3:5672', function(err, conn) {
    conn.createChannel(function(err, ch) {
      var message = {};
      message.action = "get_saldo";
      message.user_id = userID;
      message.sender_id = senderID;
      message.type = "request";
      var currTime = new Date(Date.now());
      currTime = moment(currTime).format("YYYY-MM-DD HH:mm:ss");
      message.ts = currTime;
      message = JSON.stringify(message);
      var ex = 'EX_GET_SALDO';
      ch.assertExchange(ex, 'direct', {durable: true});
      ch.publish(ex, routingKey, new Buffer(message));
      // console.log(" Sent a message with register key %s: and message'%s'", routingKey, message);
    });
  })
}

function initGetSaldoRespPublisher(routingKey, nilai_saldo, ts){
  amqp.connect('amqp://sisdis:sisdis@172.17.0.3:5672', function(err, conn) {
    conn.createChannel(function(err, ch) {
      var message = {};
      message.action = "get_saldo";
      message.type = "response";
      message.nilai_saldo = nilai_saldo;
      message.sender_id = "1406623064";
      message.ts = ts;
      message = JSON.stringify(message);
      var ex = 'EX_GET_SALDO';
      ch.assertExchange(ex, 'direct', {durable: true});
      ch.publish(ex, routingKey, new Buffer(message));
      // console.log(" Sent a message with register key %s: and message'%s'", routingKey, message);
    });
  })
}


function initGetSaldoConsumer(){
  amqp.connect('amqp://sisdis:sisdis@172.17.0.3:5672', function(err, conn) {
    conn.createChannel(function(err, ch) {
      var ex = 'EX_GET_SALDO';
      var routingKey = 'REQ_1406623064'
      ch.assertExchange(ex, 'direct', {durable: true});
      ch.assertQueue('', {exclusive: true}, function(err, q) {
        console.log(' [*] Waiting for logs. To exit press CTRL+C');
        ch.bindQueue(q.queue, ex, routingKey);
        routingKey = 'RESP_1406623064'
        ch.bindQueue(q.queue, ex, routingKey);
        ch.consume(q.queue, function(msg) {
          console.log("Reading message data");
          console.log(" [x] %s: '%s'", msg.fields.routingKey, msg.content.toString());
          var strMessage = msg.content.toString();
          try{
            var message = JSON.parse(strMessage)
            if(message.type == 'response'){
              if(getTotalSaldoCounter > 0){
                if(getTotalSaldoCounter % 5 == 0){
                  getTotalSaldoQueue[parseInt(getTotalSaldoCounter/5) - 1] = getTotalSaldoQueue[parseInt(getTotalSaldoCounter/5)] + message.nilai_saldo
                } else {
                    getTotalSaldoQueue[parseInt(getTotalSaldoCounter/5)] = getTotalSaldoQueue[parseInt(getTotalSaldoCounter/5)] + message.nilai_saldo
                }
                getTotalSaldoCounter = getTotalSaldoCounter - 1
                if(getTotalSaldoCounter % 5 == 0){
                  console.log("TOTAL SALDO ADALAH "+getTotalSaldoQueue[parseInt(getTotalSaldoCounter/5)])
                  console.log(getTotalSaldoQueue)
                  var currTime = new Date(Date.now());
                  currTime = moment(currTime).format("YYYY-MM-DD HH:mm:ss");
                  initGetTotalSaldoRespPublisher("RESP_1406623064", "1406623064", getTotalSaldoCounter, currTime)
                  getTotalSaldoQueue[parseInt(getTotalSaldoCounter/5)] = 0;
                }
              } else {
                console.log('REPONSE FROM ???, GET SALDO IS', message.nilai_saldo)
              }
            } else if(message.type == 'request')  {
              console.log("test 123")
              ewallet.getSaldo(message.user_id).then(function(res){
                  var currTime = new Date(Date.now());
                  currTime = moment(currTime).format("YYYY-MM-DD HH:mm:ss");
                  initGetSaldoRespPublisher("RESP_"+message.sender_id, res, currTime);
              }).catch(function(err){
                  console.log("ini log error dengan message error ", err)
                  var currTime = new Date(Date.now());
                  currTime = moment(currTime).format("YYYY-MM-DD HH:mm:ss");
                  initGetSaldoRespPublisher("RESP_"+message.sender_id, res, currTime);
              })
            }
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

function initTransferPublisher(routingKey, userID, senderID, nilai){
  amqp.connect('amqp://sisdis:sisdis@172.17.0.3:5672', function(err, conn) {
    conn.createChannel(function(err, ch) {
      var message = {};
      message.action = "transfer";
      message.user_id = userID;
      message.sender_id = senderID;
      message.nilai = nilai;
      message.type = "request";
      var currTime = new Date(Date.now());
      currTime = moment(currTime).format("YYYY-MM-DD HH:mm:ss");
      message.ts = currTime;
      message = JSON.stringify(message);
      var ex = 'EX_TRANSFER';
      ch.assertExchange(ex, 'direct', {durable: true});
      ch.publish(ex, routingKey, new Buffer(message));
      transferQueue.push(nilai)
      console.log(" Sent a message with register key %s: and message'%s'", routingKey, message);
    });
  })
}

function initTransferRespPublisher(routingKey, status_transfer, ts){
  amqp.connect('amqp://sisdis:sisdis@172.17.0.3:5672', function(err, conn) {
    conn.createChannel(function(err, ch) {
      var message = {};
      message.action = "transfer";
      message.type = "response";
      message.status_transfer = status_transfer;
      message.ts = ts;
      message = JSON.stringify(message);
      var ex = 'EX_TRANSFER';
      ch.assertExchange(ex, 'direct', {durable: true});
      ch.publish(ex, routingKey, new Buffer(message));
      console.log(" Sent a message with register key %s: and message'%s'", routingKey, message);
    });
  })
}

function initTransferConsumer(){
  amqp.connect('amqp://sisdis:sisdis@172.17.0.3:5672', function(err, conn) {
    conn.createChannel(function(err, ch) {
      var ex = 'EX_TRANSFER';
      var routingKey = 'REQ_1406623064'
      ch.assertExchange(ex, 'direct', {durable: true});
      ch.assertQueue('', {exclusive: true}, function(err, q) {
        console.log(' [*] Waiting for logs. To exit press CTRL+C');
        ch.bindQueue(q.queue, ex, routingKey);
        routingKey = 'RESP_1406623064'
        ch.bindQueue(q.queue, ex, routingKey);
        ch.consume(q.queue, function(msg) {
          console.log("Reading message data");
          console.log(" [x] %s: '%s'", msg.fields.routingKey, msg.content.toString());
          var strMessage = msg.content.toString();
          try{
            var message = JSON.parse(strMessage)
            if(message.type == 'response'){
              console.log("Status Transfer adalah "+ message.status_transfer)
              if(message.status_transfer == 1){
                var nilaiTransfer = transferQueue.shift();
                ewallet.decreaseSaldo("1406623064", nilaiTransfer).then(function(res){
                  console.log("Saldo pada user "+ "1406623064" +" telah berhasil dikurangi sebanyak "+nilaiTransfer)
                }).catch(function(err){
                  console.log("*************")
                  console.log("Pengurangan saldo gagal, dengan user 1406623064 "+" dan saldo "+ nilaiTransfer)
                  console.log("*************")
                });
              }
            } else if(message.type == 'request')  {
              ewallet.transfer(message.user_id, message.nilai).then(function(res){
                  var currTime = new Date(Date.now());
                  currTime = moment(currTime).format("YYYY-MM-DD HH:mm:ss");
                  initTransferRespPublisher("RESP_"+message.sender_id, res, currTime);
              }).catch(function(err){
                  console.log("ini log error dengan message error ", err)
                  var currTime = new Date(Date.now());
                  currTime = moment(currTime).format("YYYY-MM-DD HH:mm:ss");
                  initTransferRespPublisher("RESP_"+message.sender_id, res, currTime);
              })
            }
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

function initGetTotalSaldoPublisher(routingKey, userID, senderID){
  amqp.connect('amqp://sisdis:sisdis@172.17.0.3:5672', function(err, conn) {
    conn.createChannel(function(err, ch) {
      var message = {};
      message.action = "get_total_saldo";
      message.user_id = userID;
      message.sender_id = senderID;
      message.type = "request";
      var currTime = new Date(Date.now());
      currTime = moment(currTime).format("YYYY-MM-DD HH:mm:ss");
      message.ts = currTime;
      message = JSON.stringify(message);
      var ex = 'EX_GET_TOTAL_SALDO';
      ch.assertExchange(ex, 'direct', {durable: true});
      ch.publish(ex, routingKey, new Buffer(message));
      console.log(" Sent a message with register key %s: and message'%s'", routingKey, message);
    });
  })
}

function initGetTotalSaldoRespPublisher(routingKey,senderID, nilai_saldo, ts){
  amqp.connect('amqp://sisdis:sisdis@172.17.0.3:5672', function(err, conn) {
    conn.createChannel(function(err, ch) {
      var message = {};
      message.action = "get_total_saldo";
      message.nilai_saldo = nilai_saldo;
      message.sender_id = senderID;
      message.type = "response";
      message = JSON.stringify(message);
      var ex = 'EX_GET_TOTAL_SALDO';
      ch.assertExchange(ex, 'direct', {durable: true});
      ch.publish(ex, routingKey, new Buffer(message));
      console.log(" Sent a message with register key %s: and message'%s'", routingKey, message);
    });
  })
}

function initGetTotalSaldoConsumer(){
  amqp.connect('amqp://sisdis:sisdis@172.17.0.3:5672', function(err, conn) {
    conn.createChannel(function(err, ch) {
      var ex = 'EX_GET_TOTAL_SALDO';
      var routingKey = 'REQ_1406623064'
      ch.assertExchange(ex, 'direct', {durable: true});
      ch.assertQueue('', {exclusive: true}, function(err, q) {
        console.log(' [*] Waiting for logs. To exit press CTRL+C');
        ch.bindQueue(q.queue, ex, routingKey);
        routingKey = 'RESP_1406623064'
        ch.bindQueue(q.queue, ex, routingKey);
        ch.consume(q.queue, function(msg) {
          console.log("Reading message data");
          console.log(" [x] %s: '%s'", msg.fields.routingKey, msg.content.toString());
          var strMessage = msg.content.toString();
          try{
            var message = JSON.parse(strMessage)
            if(message.type == 'response'){
              console.log("Total Saldo adalah "+ message.nilai_saldo)
            } else if(message.type == 'request')  {
              getTotalSaldoCounter = getTotalSaldoCounter + quourumNpm.length;
              for (var npm in quourumNpm) {
                console.log("walalal")
                initGetSaldoPublisher("REQ_1406623064", "1406623064", "1406623064")
              }
            }
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

var flagTotal = 1;
initGetSaldoConsumer()
initGetTotalSaldoConsumer()
setInterval(function(){
    if(flagTotal == 1) {
        initGetTotalSaldoPublisher("REQ_1406623064", "1406623064", "1406623064", "10000")
        flagTotal = 0
    }

}, 9000);

// initTransferConsumer()
// setInterval(function(){
//     initTransferPublisher("REQ_1406623064", "1406623064", "1406623064", "10000")
// }, 5000);


// initGetSaldoConsumer()
// setInterval(function(){
//     initGetSaldoPublisher("REQ_1406623064", "1406623064", "1406623064")
// }, 5000);

// initRegisterConsumer()
// setInterval(function(){
//     initRegisterPublisher('REQ_1406623064', '1406623064', 'Akbar Septriyan', '1406623064')
// }, 5000);
//
//
// initPingPublisher();
// console.log("init consumer");
// initPingConsumer();
