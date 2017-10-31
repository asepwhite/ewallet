const express = require('express')
const app = express()

app.post('/ewallet/ping', function(req, res){
  var response = {}
  response.pong = 1;
  res.send(response);
})

app.listen(4005, function(){
  console.log('app listen on port 4005')
})
