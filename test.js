const express = require('express')
const app = express()
var fs = require('fs')

app.get('/list', function(req, res){
  fs.readFile('list.json', 'utf8', function(err, data){
    res.send(data)
  })
})

app.post('/ewallet/ping', function(req, res){
  var response = {}
  response.pong = 1;
  res.send(response);
})

app.post('/ewallet/getTotalSaldo', function(req, res){
  var response = {}
  response.nilai_saldo = 777;
  res.send(response);
})

app.post('/ewallet/getSaldo', function(req, res){
  var response = {}
  response.nilai_saldo = 1;
  res.send(response);
})

app.listen(4000, function(){
  console.log('app listen on port 4000')
})
