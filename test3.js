const express = require('express')
const app = express()

app.post('/ewallet/ping', function(req, res){
  var response = {}
  response.pong = 1;
  res.send(response);
})

app.post('/ewallet/getSaldo', function(req, res){
  var response = {}
  response.nilai_saldo = 1;
  res.send(response);
})

app.listen(4002, function(){
  console.log('app listen on port 4002')
})
