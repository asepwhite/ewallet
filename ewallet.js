var Promise = require("bluebird");
var axios = require("axios")
const Sequelize = require('sequelize');
const sequelize = new Sequelize('sisdis', 'root', 'rootroot', {
  host: 'localhost',
  dialect: 'mysql'
});
const User = sequelize.define('users', {
  npm: { type: Sequelize.INTEGER,  unique: true },
  nama: Sequelize.STRING,
  saldo: Sequelize.INTEGER
});

var registerUser = function registerUser(userId, name){
  return sequelize.sync().then(function(){
    return User.create({
      npm: userId,
      nama: name,
      saldo: 0
    }).then(function(){
      return -1
    }).catch(function(err){
      return -4
    });
  }).catch(function(err){
    return -4;
  });
}

var getSaldo = function(userId){
  return sequelize.sync().then(function(){
    return User.findOne({ where: {npm : userId}}).then(function(user){
      if(user){
        userData = user.dataValues;
        return userData.saldo
      } else {
        return -1
      }
    }).catch(function(err){
      return -4
    });
  }).catch(function(){
    return -4
  })
}

var transferSaldo = function(userId, totalTransfer){
  totalTransfer = parseInt(totalTransfer)
  if(totalTransfer < 0 || totalTransfer > 1000000000){
      return Promise.resolve(-5)
  }
  return sequelize.sync().then(function(){
    return User.findOne({ where: {npm : userId}}).then(function(user){
      if(user){
        userData = user.dataValues;
        updatedSaldo = userData.saldo+totalTransfer
        user.set('saldo', updatedSaldo)
        user.save()
        return 1;
      } else {
        return -1
      }
    }).catch(function(err){
      return -4
    });
  }).catch(function(){
    return -4
  })
}

var pingRequest = function(url){
  return axios.post(url).then(function(response){
    return response.data
  }).catch(function(err){
    return Promise.reject(err)
  })
}

var checkQuorum = function(){
  return axios.get('http://localhost:4000/list').then(function(response){
    var Jobs = []
    var IPdictionaryies = response.data
    var succedPing = 0
    var failedPing = 0
    for (var index in IPdictionaryies) {
      var job = pingRequest(IPdictionaryies[index].ip+"/ewallet/ping").then(function(response){
        succedPing += 1
        return Promise.resolve(1)
      }).catch(function(err){
        failedPing += 1
        return Promise.resolve(1)
      })
      Jobs.push(job)
    }
    return Promise.all(Jobs).then(function(){
      var output = {}
      output.successPing = succedPing
      output.failedPing = failedPing
      return Promise.resolve(output)
    })
  })
}


module.exports = {
  register : registerUser,
  getSaldo : getSaldo,
  transfer : transferSaldo,
  makePingRequest : pingRequest,
  checkQuorum : checkQuorum,
  test : function(){
    return "1"
  }
}
