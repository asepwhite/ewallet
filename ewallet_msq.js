var Promise = require("bluebird");
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
var getSaldoQueue = []
var getTotalSaldoValue = 0
var getTotalCounter = 0
var quorum = ['1406623064', '1406623064', '1406623064', '1406623064', '1406623064']


var publishPing = function publishPing() {
  amqp.connect('amqp://sisdis:sisdis@172.17.0.3:5672', function(err, conn) {
    conn.createChannel(function(err, ch) {
      var ex = 'EX_PING';
      ch.assertExchange(ex, 'fanout', {durable: false});
      sendRepeatedPing(ch, ex);
    });
  });
}

var sendRepeatedPing =  function sendRepeatedPing(ch, ex)
{
  setInterval(function(){
    var currTime = new Date(Date.now());
    currTime = moment(currTime).format("YYYY-MM-DD HH:mm:ss");
    var message = '{"action":"ping","npm":"1406623064","ts":"'+currTime+'"}'
    ch.publish(ex, '', new Buffer(message));
  }, 5000);
}

var consumePing = function consumePing(){
  amqp.connect('amqp://sisdis:sisdis@172.17.0.3:5672', function(err, conn) {
    conn.createChannel(function(err, ch) {
      var ex = 'EX_PING';
      ch.assertExchange(ex, 'fanout', {durable: false});
      ch.assertQueue('', {exclusive: true}, function(err, q) {
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

var publishRegister = function publishRegister(routingKey, userID, name){
  amqp.connect('amqp://sisdis:sisdis@172.17.0.3:5672', function(err, conn) {
    conn.createChannel(function(err, ch) {
      var message = {};
      message.action = "register";
      message.user_id = userID;
      message.nama = name;
      message.sender_id = "1406623064";
      message.type = "request";
      var currTime = new Date(Date.now());
      currTime = moment(currTime).format("YYYY-MM-DD HH:mm:ss");
      message.ts = currTime;
      message = JSON.stringify(message);
      var ex = 'EX_REGISTER';
      ch.assertExchange(ex, 'direct', {durable: true});
      ch.publish(ex, routingKey, new Buffer(message));
    });
  })
}

var publishRegisterResponse =  function publishRegisterResponse(routingKey, status_register, ts){
  amqp.connect('amqp://sisdis:sisdis@172.17.0.3:5672', function(err, conn) {
    conn.createChannel(function(err, ch) {
      var message = {};
      message.action = "register";
      message.type = "response";
      message.status_register = status_register;
      message.ts = ts;
      message = JSON.stringify(message);
      var ex = 'EX_REGISTER';
      ch.assertExchange(ex, 'direct', {durable: true});
      ch.publish(ex, routingKey, new Buffer(message));
    });
  })
}

var consumeRegister =  function consumeRegister(){
  amqp.connect('amqp://sisdis:sisdis@172.17.0.3:5672', function(err, conn) {
    conn.createChannel(function(err, ch) {
      var ex = 'EX_REGISTER';
      var routingKey = 'REQ_1406623064'
      ch.assertExchange(ex, 'direct', {durable: true});
      ch.assertQueue('', {exclusive: true}, function(err, q) {
        ch.bindQueue(q.queue, ex, routingKey);
        routingKey = 'RESP_1406623064'
        ch.bindQueue(q.queue, ex, routingKey);
        ch.consume(q.queue, function(msg) {
          var strMessage = msg.content.toString();
          try{
            var message = JSON.parse(strMessage)
            if(message.type == 'response'){
              console.log('STATUS REGISTER : ', message.status_register)
            } else if(message.type == 'request')  {
              ewallet.register(message.user_id, message.nama).then(function(res){
                  var currTime = new Date(Date.now());
                  currTime = moment(currTime).format("YYYY-MM-DD HH:mm:ss");
                  publishRegisterResponse("RESP_"+message.sender_id, res, currTime);
              }).catch(function(err){
                  console.log("Error ketika registrasi, status registrasi : ", err)
                  var currTime = new Date(Date.now());
                  currTime = moment(currTime).format("YYYY-MM-DD HH:mm:ss");
                  publishRegisterResponse("RESP_"+message.sender_id, res, currTime);
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

var publishGetSaldo =  function publishGetSaldo(routingKey, userID){
  amqp.connect('amqp://sisdis:sisdis@172.17.0.3:5672', function(err, conn) {
    conn.createChannel(function(err, ch) {
      var message = {};
      message.action = "get_saldo";
      message.user_id = userID;
      message.sender_id = "1406623064";
      message.type = "request";
      var currTime = new Date(Date.now());
      currTime = moment(currTime).format("YYYY-MM-DD HH:mm:ss");
      message.ts = currTime;
      message = JSON.stringify(message);
      var ex = 'EX_GET_SALDO';
      ch.assertExchange(ex, 'direct', {durable: true});
      ch.publish(ex, routingKey, new Buffer(message));
    });
  })
}

var publishGetSaldoResponse = function publishGetSaldoResponse(routingKey, nilai_saldo, ts){
  amqp.connect('amqp://sisdis:sisdis@172.17.0.3:5672', function(err, conn) {
    conn.createChannel(function(err, ch) {
      var message = {};
      message.action = "get_saldo";
      message.type = "response";
      message.nilai_saldo = nilai_saldo;
      message.ts = ts;
      message = JSON.stringify(message);
      var ex = 'EX_GET_SALDO';
      ch.assertExchange(ex, 'direct', {durable: true});
      ch.publish(ex, routingKey, new Buffer(message));
    });
  })
}


var consumeGetSaldo = function consumeGetSaldo(){
  amqp.connect('amqp://sisdis:sisdis@172.17.0.3:5672', function(err, conn) {
    conn.createChannel(function(err, ch) {
      var ex = 'EX_GET_SALDO';
      var routingKey = 'REQ_1406623064'
      ch.assertExchange(ex, 'direct', {durable: true});
      ch.assertQueue('', {exclusive: true}, function(err, q) {
        ch.bindQueue(q.queue, ex, routingKey);
        routingKey = 'RESP_1406623064'
        ch.bindQueue(q.queue, ex, routingKey);
        ch.consume(q.queue, function(msg) {
          var strMessage = msg.content.toString();
          try{
            strMessage = JSON.stringify(strMessage)
            var message = JSON.parse(strMessage)
            if(message.type == 'response'){
              if(getTotalCounter > 0){
                if(getTotalCounter == 1){
                  getTotalSaldoValue += message.nilai_saldo
                  consumeGetTotalSaldosaldoSaldoResponse("RESP_"+getSaldoQueue[0], getTotalSaldoValue);
                  getSaldoQueue.shift()
                } else if (getTotalCounter % 5 == 1) {
                  getTotalSaldoValue += message.nilai_saldo
                  consumeGetTotalSaldosaldoSaldoResponse("RESP_"+getSaldoQueue[0], getTotalSaldoValue);
                  getSaldoQueue.shift()
                }
                getTotalSaldoValue += message.nilai_saldo
                getTotalCounter -= 1
              } else {
                console.log("Saldo anda : "+message.nilai_saldo)
              }
            } else if(message.type == 'request'){
              ewallet.getSaldo(message.user_id).then(function(res){
                  var currTime = new Date(Date.now());
                  currTime = moment(currTime).format("YYYY-MM-DD HH:mm:ss");
                  publishGetSaldoResponse("RESP_"+message.sender_id, res, currTime);
              }).catch(function(err){
                  console.log("Error ketika get saldo, status : ", err)
                  var currTime = new Date(Date.now());
                  currTime = moment(currTime).format("YYYY-MM-DD HH:mm:ss");
                  publishGetSaldoResponse("RESP_"+message.sender_id, res, currTime);
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

var publishTransfer = function publishTransfer(routingKey, userID, nilai){
  amqp.connect('amqp://sisdis:sisdis@172.17.0.3:5672', function(err, conn) {
    conn.createChannel(function(err, ch) {
      var message = {};
      message.action = "transfer";
      message.user_id = userID;
      message.sender_id = "1406623064";
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
    });
  })
}

var publishTransferResponse = function publishTransferResponse(routingKey, status_transfer, ts){
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
    });
  })
}

var consumeTransfer = function consumeTransfer(){
  amqp.connect('amqp://sisdis:sisdis@172.17.0.3:5672', function(err, conn) {
    conn.createChannel(function(err, ch) {
      var ex = 'EX_TRANSFER';
      var routingKey = 'REQ_1406623064'
      ch.assertExchange(ex, 'direct', {durable: true});
      ch.assertQueue('', {exclusive: true}, function(err, q) {
        ch.bindQueue(q.queue, ex, routingKey);
        routingKey = 'RESP_1406623064'
        ch.bindQueue(q.queue, ex, routingKey);
        ch.consume(q.queue, function(msg) {
          var strMessage = msg.content.toString();
          try{
            var message = JSON.parse(strMessage)
            if(message.type == 'response'){
              console.log("Status Transfer : "+ message.status_transfer)
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
                  publishTransferResponse("RESP_"+message.sender_id, res, currTime);
              }).catch(function(err){
                  console.log("ini log error dengan message error ", err)
                  var currTime = new Date(Date.now());
                  currTime = moment(currTime).format("YYYY-MM-DD HH:mm:ss");
                  publishTransferResponse("RESP_"+message.sender_id, res, currTime);
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

var publishGetTotalSaldo = function publishGetTotalSaldo(routingKey, userID){
  amqp.connect('amqp://sisdis:sisdis@172.17.0.3:5672', function(err, conn) {
    conn.createChannel(function(err, ch) {
      var message = {};
      message.action = "get_total_saldo";
      message.user_id = userID;
      message.sender_id = "1406623064";
      message.type = "request";
      var currTime = new Date(Date.now());
      currTime = moment(currTime).format("YYYY-MM-DD HH:mm:ss");
      message.ts = currTime;
      message = JSON.stringify(message);
      var ex = 'EX_GET_TOTAL_SALDO';
      ch.assertExchange(ex, 'direct', {durable: true});
      ch.publish(ex, routingKey, new Buffer(message));
    });
  })
}

var publishGetTotalSaldoResponse = function publishGetTotalSaldoResponse(routingKey, nilai_saldo, ts){
  amqp.connect('amqp://sisdis:sisdis@172.17.0.3:5672', function(err, conn) {
    conn.createChannel(function(err, ch) {
      var message = {};
      message.action = "get_total_saldo";
      message.type = "response";
      message.sender_id = "1406623064";
      message.nilai_saldo = nilai_saldo;
      message.ts = ts;
      message = JSON.stringify(message);
      var ex = 'EX_GET_TOTAL_SALDO';
      ch.assertExchange(ex, 'direct', {durable: true});
      ch.publish(ex, routingKey, new Buffer(message));
    });
  })
}

var consumeGetTotalSaldo = function consumeGetTotalSaldo(){
  amqp.connect('amqp://sisdis:sisdis@172.17.0.3:5672', function(err, conn) {
    conn.createChannel(function(err, ch) {
      var ex = 'EX_GET_TOTAL_SALDO';
      var routingKey = 'REQ_1406623064'
      ch.assertExchange(ex, 'direct', {durable: true});
      ch.assertQueue('', {exclusive: true}, function(err, q) {
        ch.bindQueue(q.queue, ex, routingKey);
        routingKey = 'RESP_1406623064'
        ch.bindQueue(q.queue, ex, routingKey);
        ch.consume(q.queue, function(msg) {
          var strMessage = msg.content.toString();
          try{
            var message = JSON.parse(strMessage)
            if(message.type == 'response'){
              console.log("Total Saldo : "+ message.nilai_saldo)
            } else if(message.type == 'request')  {
              getSaldoQueue.push(message.sender_id)
              for (var index in quorum) {
                getTotalCounter += 1;
                publishGetSaldo("REQ_"+quorum[index], message.user_id)
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

var initAllConsumer = function initAllConsumer()
{
  consumePing()
  consumeGetSaldo()
  consumeRegister()
  consumeGetTotalSaldo()
  consumeTransfer()
}

module.exports = {
  publishPing : publishPing,
  sendRepeatedPing : sendRepeatedPing,
  consumePing : consumePing,
  publishRegister : publishRegister,
  publishRegisterResponse : publishRegisterResponse,
  consumeRegister : consumeRegister,
  publishGetSaldo : publishGetSaldo,
  publishGetSaldoResponse : publishGetSaldoResponse,
  consumeGetSaldo : consumeGetSaldo,
  publishTransfer : publishTransfer,
  publishTransferResponse : publishTransferResponse,
  consumeTransfer : consumeTransfer,
  publishGetTotalSaldo : publishGetTotalSaldo,
  publishGetTotalSaldoResponse : publishGetTotalSaldoResponse,
  consumeGetTotalSaldo : consumeGetTotalSaldo,
  initAllConsumer : initAllConsumer
}
