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
      return 1
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

var registerRequest = function(userId, url){
  return sequelize.sync().then(function(){
    return User.findOne({ where: {npm : userId}}).then(function(user){
      if(user){
        userData = user.dataValues;
        userName = userData.nama
        return axios.post(url, {
          user_id: userId,
          nama: userName
        }).then(function(response){
          if(response.data.status_register == 1){
            return 1
          } else {
            return -99
          }
        })
      } else {
        return -99
      }
    }).catch(function(err){
      return -99
    });
})
};

var getSaldoRequest = function(userId, url){
  return axios.post(url, {user_id:userId}).then(function(response){
    return response.data.nilai_saldo
  })
}

var getTotalSaldoRequest = function(userId){
  return axios.get('http://localhost:4000/list').then(function(response){
    IPDictionaries = response.data
    var domicileIP = ""
    for (var index in IPDictionaries) {
      if(IPDictionaries[index].npm == userId){
        domicileIP = IPDictionaries[index].ip
      }
    }
    if(!domicileIP){
      return -1;
    }
    return axios.post(domicileIP+'/ewallet/getTotalSaldo', {user_id : userId}).then(function(response){
      return response.data.nilai_saldo
    }).catch(function(err){
      return -3
    })
  })
}

var registerAndGetSaldoRequest = function(userId, url){
  return getSaldoRequest(userId, url+"/ewallet/getSaldo").then(function(response){
    if(response == -1){
      return registerRequest(userId, url+"ewalllet/register").then(function(response){
        if(response.data.status_register != 1){
          return -99
        } else{
          return getSaldoRequest(userId, url+"/ewallet/getSaldo").then(function(response){
            return response
          })
        }
      }).catch(function(err){
        return -99
      })
    }
    return response
  }).catch(function(err){
    return -3
  })
}

var getSaldoFromAllBranch = function(userId){
  return axios.get('http://localhost:4000/list').then(function(response){
    var jobs = []
    var IPDictionaries = response.data
    var undefinedError = 0
    var totalSaldo = 0
    for (var index in IPDictionaries) {
      jobs.push(registerAndGetSaldoRequest(userId, IPDictionaries[index].ip).then(function(response){
        if(response < 0 ){
          if(response == -3){
            undefinedError = -3
          } else {
            undefinedError = -99
          }
        } else {
          totalSaldo += response
        }
      }))
    }
    return Promise.all(jobs).then(function(){
      if(undefinedError == -99){
        return -99
      } else if (undefinedError == -3) {
        return -3
      } else {
        return totalSaldo
      }
    })
  })
}

var getTotalSaldo = function(userId){
  if(userId != '1406623064'){
    return Promise.resolve(getTotalSaldoRequest(userId))
  } else {
    return getSaldoFromAllBranch(userId).then(function(response){
      saldoFromOtherBranch = response
      return getSaldo(userId).then(function(response){
        if(saldoFromOtherBranch < 0){
          return saldoFromOtherBranch
        }
        return Promise.resolve(saldoFromOtherBranch + response)
      })
    })
  }
}


module.exports = {
  register : registerUser,
  getSaldo : getSaldo,
  transfer : transferSaldo,
  makePingRequest : pingRequest,
  checkQuorum : checkQuorum,
  getTotalSaldo: getTotalSaldo,
  test : function(){
    return "1"
  }
}
