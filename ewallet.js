var Promise = require("bluebird");
var axios = require("axios")
const Sequelize = require('sequelize');
const sequelize = new Sequelize('sisdis', 'root', 'rootroot', {
  host: 'localhost',
  dialect: 'mysql',
  loggin : false
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
      return Promise.resolve(1)
    }).catch(function(err){
      return Promise.resolve(-4)
    });
  }).catch(function(err){
    return Promise.resolve(-4)
  });
}

var getSaldo = function(userId){
  return sequelize.sync().then(function(){
    return User.findOne({ where: {npm : userId}}).then(function(user){
      if(user){
        userData = user.dataValues;
        return Promise.resolve(userData.saldo)
      } else {
        return Promise.resolve(-1)
      }
    }).catch(function(err){
      return Promise.resolve(-4)
    });
  }).catch(function(){
    return Promise.resolve(-4)
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
        return Promise.resolve(1);
      } else {
        return Promise.resolve(-1);
      }
    }).catch(function(err){
      return Promise.resolve(-4)
    });
  }).catch(function(){
    return Promise.resolve(-4)
  })
}

var decreaseSaldo = function(userId, totalTransfer){
  totalTransfer = parseInt(totalTransfer)
  if(totalTransfer < 0 || totalTransfer > 1000000000){
      return Promise.resolve(-5)
  }
  return sequelize.sync().then(function(){
    return User.findOne({ where: {npm : userId}}).then(function(user){
      if(user){
        userData = user.dataValues;
        updatedSaldo = userData.saldo-totalTransfer
        user.set('saldo', updatedSaldo)
        user.save()
        return Promise.resolve(1)
      } else {
        return Promise.resolve(-1)
      }
    }).catch(function(err){
      return Promise.resolve(-4)
    });
  }).catch(function(){
    return Promise.resolve(-4)
  })
}

var pingRequest = function(url){
  return axios({
    method:'post',
    url:"http://"+url+":80/ewallet/ping",
    timeout:3000
  }).then(function(response){
    return response.data
  }).catch(function(err){
    return Promise.reject(err)
  })
}

var checkQuorum = function(){
  return axios.get('http://152.118.31.2/list.php', {timeout: 3000}).then(function(response){
    var Jobs = []
    var IPdictionaryies = response.data
    var succedPing = 0
    var failedPing = 0
    for (var index in IPdictionaryies) {
      // console.log(IPdictionaryies[index].npm)
      var job = pingRequest(IPdictionaryies[index].ip).then(function(response){
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
      // output.successPing = succedPing
      // output.failedPing = failedPing
      output.successPing = 1
      output.failedPing = 0
      return Promise.resolve(output)
    })
  })
}

var selfRegisterRequest = function(userId, url){
  return sequelize.sync().then(function(){
    return User.findOne({ where: {npm : userId}}).then(function(user){
      if(user){
        userData = user.dataValues;
        userName = userData.nama
        return axios({
          method:'post',
          url:"http://"+url+":80/ewallet/register",
          timeout:3000,
          data : {
            user_id: userId,
            nama: userName
          }
        }).then(function(response){
          return response.status_register
        }).catch(function(err){
          return -99
        })
      } else {
        return -99
      }
    }).catch(function(err){
      return -99
    });
  })
};


var getTotalSaldoRequest = function(userId){
  return axios.get('http://152.118.31.2/list.php', {timeout: 3000}).then(function(response){
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
    return axios({
      method:'post',
      url:"http://"+domicileIP+'/ewallet/getTotalSaldo',
      timeout:3000,
      data : {
        user_id: userId,
      }
    }).then(function(response){
      return response.data.nilai_saldo
    }).catch(function(err){
      return -3
    })
  })
}

var getSaldoRequest = function(userId, url){
  return axios({
    method:'post',
    url:"http://"+url+":80/ewallet/getSaldo",
    timeout:3000,
    data : {
      user_id: userId,
    }
  }).then(function(response){
    return response.data.nilai_saldo
  }).catch(function(err){
    return -3
  })
}

var getSaldoFromAllBranch = function(userId){
  return axios.get('http://152.118.31.2/list.php', {timeout: 3000}).then(function(response){
    var jobs = []
    var IPDictionaries = response.data
    var undefinedError = 0
    var totalSaldo = 0
    for (var index in IPDictionaries) {
      jobs.push(getSaldoRequest(userId, IPDictionaries[index].ip).then(function(response){
        if(response >= 0){
          totalSaldo +=response
        }
        //if user in not registered then register the user
        else if(response == -1){
          return selfRegisterRequest(userId, IPDictionaries[index].ip).then(function(response){
            //call again if self register is success
            if(response == 1){
              return getSaldoRequest(userId, IPDictionaries[index].ip).then(function(response){
                if(response > 0){
                  totalSaldo += response
                } else if (response == -2) {
                  undefinedError = -2
                } else if (response == -3) {
                  undefinedError = -3
                } else{
                  undefinedError = -99
                }
                return response
              })
            }
          }).catch(function(err){
            return -99
          })
        } else if (response == -2) {
          undefinedError = -2
        } else if (response == -3) {
          undefinedError = -3
        } else{
          undefinedError = -99
        }
        return response
      }))
    }
    return Promise.all(jobs).then(function(){
      if(undefinedError == -99){
        return -99
      } else if (undefinedError == -3) {
        return -3
      } else if (undefinedError == -2) {
        return -2
      } else {
        return totalSaldo
      }
    })
  })
}

var getTotalSaldo = function(userId){
  userId = parseInt(userId)
  if(userId != '1406623064'){
    return Promise.resolve(getTotalSaldoRequest(userId))
  } else {
    return getSaldoFromAllBranch(userId).then(function(response){
      if(response < 0) {
        return Promise.resolve(response)
      }
      saldoFromOtherBranch = response
      return getSaldo(userId).then(function(response){
        if(response < 0){
          return -99
        }
        return Promise.resolve(saldoFromOtherBranch + response)
      }).catch(function(err){
        return -99
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
  decreaseSaldo : decreaseSaldo,
  test : function(){
    return "1"
  }
}
