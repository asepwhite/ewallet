const express = require('express')
const app = express()
const axios = require('axios')
var Promise = require("bluebird");
const bodyParser = require('body-parser')
const jsonParser = bodyParser.json();
const ewallet = require('./ewallet')
var stdin = process.openStdin()
//CLi
function callOpeningSentences(){
  console.log("=====Selamat datang di ewallet cabang bank Akbar=====")
  console.log("Berikut adalah beberapa menu yang dapat anda gunakan")
  console.log("1.Ping")
  console.log("2.Register")
  console.log("3.Get Saldo")
  console.log("4.Get Total Saldo")
  console.log("5.Transfer")
  console.log("6.Exit")
}

callOpeningSentences()
var prevCommand = 0
stdin.addListener("data", function(data) {
  var input = data.toString().trim()
  if(prevCommand == 0){
    if(input == 1){
      prevCommand = 1
      console.log("Silahkan masukan IP untuk di ping: ")
    } else if(input == 2){
      prevCommand = 2
      console.log("Silahkan masukan url, npm dan nama untuk di register dengan format (url,npm,nama): ")
    } else if(input == 3){
      prevCommand = 3
      console.log("Silahkan masukan url, dan user_id dengan format (url,user_id): ")
    } else if(input == 4){
      prevCommand = 4
      console.log("Silahkan masukan url, user_id dengan format (url,user_id): ")
    } else if(input == 5){
      prevCommand = 5
      console.log("Silahkan masukan url, nilai dan user_id dengan format (url, nilai, user_id): ")
    }
  } else {
    if(prevCommand == 1){
      axios.post("http://"+input+":80/ewallet/ping").then(function(response){
        console.log(response.data)
        prevCommand = 0
      })
    } else if(prevCommand == 2){
      var params = input.split(',')
      axios.post("http://"+params[0]+":80/ewallet/register", {
        user_id: params[1],
        nama : params[2]
      }).then(function(response){
        console.log(response.data)
        prevCommand = 0
      })
    } else if(prevCommand == 3){
      var params = input.split(',')
      axios.post("http://"+params[0]+":80/ewallet/getSaldo", {
        user_id: params[1]
      }).then(function(response){
        console.log(response.data)
        if(response.data.nilai_saldo == -1){
            prevCommand = 2
            console.log("Silahkan masukan url, npm dan nama untuk di register dengan format (url,npm,nama): ")
        } else {
          prevCommand = 0
        }
      })
    } else if(prevCommand == 5){
      var params = input.split(',')
      axios.post("http://"+params[0]+":80/ewallet/transfer", {
        user_id: params[2],
        nilai: params[1]
      }).then(function(response){
        if(response.data.nilai_saldo == -1){
            prevCommand = 2
            console.log("Silahkan masukan url, npm dan nama untuk di register dengan format (url,npm,nama): ")
        } else if (response.data.nilai_saldo < 0){
            console.log(response.data)
            prevCommand = 0
        } else {
            var statusTransfer = response.data
            ewallet.decreaseSaldo(params[2], params[1]).then(function(response){
              if(response == 1){
                console.log(statusTransfer)
              }
              prevCommand = 0
            }).catch(function(err){
              console.log("error when decreasing saldo")
              console.log(err)
            })
        }
      })
    } else if(prevCommand == 4){
      var params = input.split(',')
      axios.post("http://"+params[0]+":80/ewallet/getTotalSaldo", {
        user_id: params[1]
      }).then(function(response){
        console.log(response.data)
        prevCommand = 0
      }).catch(function(err){
        console.log(err)
      })
    }
  }
});


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
    console.log("param not completed")
    res.status(200).send(output);
  } else {
    ewallet.checkQuorum().then(function(response){
      successPing = response.successPing
      failedPing = response.failedPing
      if(successPing/(successPing+failedPing) >= 0.625){
        ewallet.register(req.body.user_id, req.body.nama).then(function(response){
          output.status_register = response;
          res.status(200).send(output);
        }).catch(function(err){
          output.status_register = err;
          res.status(200).send(output);
        });
      } else {
          output.status_register = -2
          res.send(output)
      }
    })
  }
})

app.post('/ewallet/getSaldo', jsonParser, function(req, res){
  var output = {}
  if(!req.body.user_id){
    output.nilai_saldo = -99
    res.status(200).send(output)
  } else {
    ewallet.checkQuorum().then(function(response){
      successPing = response.successPing
      failedPing = response.failedPing
      if(successPing/(successPing+failedPing) >= 0.625){
        ewallet.getSaldo(req.body.user_id).then(function(saldo){
          output.nilai_saldo = saldo
          res.send(output)
        }).catch(function(err){
          output.nilai_saldo = saldo
          res.send(output)
        })
      } else {
        output.nilai_saldo = -2
        res.send(output)
      }
    })
  }
})

app.post('/ewallet/transfer', jsonParser, function(req, res){
  var output = {}
  if(!req.body.user_id || req.body.nilai == null){
    output.nilai_saldo = -99
    res.status(200).send(output)
  } else {
    ewallet.checkQuorum().then(function(response){
      successPing = response.successPing
      failedPing = response.failedPing
      if(successPing/(successPing+failedPing) >= 0.625){
        ewallet.transfer(req.body.user_id, req.body.nilai).then(function(saldo){
          output.status_transfer = saldo
          res.send(output)
        }).catch(function(err){
          output.status_transfer = saldo
          res.send(output)
        })
      } else {
        output.status_transfer = -2
      }
    })
  }
})

app.post('/ewallet/getTotalSaldo', jsonParser, function(req, res){
  var output = {}
  if(!req.body.user_id){
    output.nilai_saldo = -99
    res.send(output)
  }
  ewallet.checkQuorum().then(function(response){
    successPing = response.successPing
    failedPing = response.failedPing
    if(successPing/(successPing+failedPing) >= 1){
      ewallet.getTotalSaldo(req.body.user_id).then(function(response){
        output.nilai_saldo = response
        res.send(output)
      })
    } else {
      output.nilai_saldo = -2
      res.send(output)
    }
  })

})

app.get('/customQuorum', jsonParser, function(req,res){
  var output = []
  axios.get('http://152.118.31.2/list.php').then(function(response){
    var IPDictionaries = response.data
      for (var index in IPDictionaries) {
          if(IPDictionaries[index].npm == 1406543605 || IPDictionaries[index].npm == 1406574296 || IPDictionaries[index].npm == 1406578275) {
            output.push(IPDictionaries[index])
          }
      }
    res.send(output)
  })
})


app.listen(3000, function(){
  console.log('app listen on port 3000')
})
