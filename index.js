const express = require('express')
const app = express()
const axios = require('axios')
var Promise = require("bluebird");
const bodyParser = require('body-parser')
const jsonParser = bodyParser.json();
const ewallet = require('./ewallet')

//API
app.post('/ewallet/ping', jsonParser, function(req, res){
  var output = {}
  output.pong = "1"
  res.status(200).send(output)
})

app.post('/ewallet/register', jsonParser, function(req, res){
  var output = {}
  if(!req.body.user_id || !req.body.nama){
    output.status_register = -99;
    res.status(200).send(output);
  } else {
    ewallet.register(req.body.user_id, req.body.nama).then(function(response){
      output.status_register = response;
      res.status(200).send(output);
    }).catch(function(err){
      output.status_register = err;
      res.status(200).send(output);
    });
  }
})

app.post('/ewallet/getSaldo', jsonParser, function(req, res){
  var output = {}
  if(!req.body.user_id){
    output.nilai_saldo = -99
    res.status(200).send(output)
  } else {
    ewallet.getSaldo(req.body.user_id).then(function(saldo){
      output.nilai_saldo = saldo
      res.send(output)
    }).catch(function(err){
      output.nilai_saldo = saldo
      res.send(output)
    })
  }
})

app.post('/ewallet/transfer', jsonParser, function(req, res){
  var output = {}
  if(!req.body.user_id || req.body.nilai == null){
    output.nilai_saldo = -99
    res.status(200).send(output)
  } else {
    ewallet.transfer(req.body.user_id, req.body.nilai).then(function(saldo){
      output.status_transfer = saldo
      res.send(output)
    }).catch(function(err){
      output.status_transfer = saldo
      res.send(output)
    })
  }
})

app.get('/test', function(req, res){
   ewallet.checkQuorum().then(function(response){
     res.send(response)
   })
})


app.listen(3000, function(){
  console.log('app listen on port 3000')
})
