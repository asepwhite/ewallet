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

module.exports = {
  register : registerUser,
  getSaldo : getSaldo,
  test : function(){
    return "1"
  }
}
