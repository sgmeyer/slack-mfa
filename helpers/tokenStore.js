var MongoClient = require('mongodb').MongoClient;

var tokenStore = {
  connect: connectToDb,
  find: findToken,
  remove: removeToken,
  save: saveToken
};

function connectToDb(connectionString) {
  return new Promise(function(resolve, reject) {
    return MongoClient.connect(connectionString, function (err, db) {
      if (err) { return reject(error); }
      return resolve(db);
    });
  });
}

function findToken(db, tokenId) {
  return new Promise(function(resolve, reject) {
    return db.collection('UsedToken').findOne({ 'jti': tokenId }, function (err, record) {
      if (err) { return reject(err); }
      return resolve (record);
    });
  });
}

function removeToken(db, tokenId) {
  return new Promise(function (resolve, revoke) {
    return db.collection('UsedToken').remove({ 'jti': tokenId }, function (err, x) {
      if (err) { return reject(err); }
      return resolve(true);
    });
  });
}

function saveToken(db, payload) {
  return new Promise(function (resolve, reject) {
    if (!payload.jti) { return reject('The jwt must have a jti.'); }
    if (!payload.iat || isNaN(payload.iat)) { return reject('The jwt must have a valid iat.'); }

    var issued = new Date(payload.iat * 1000);

    return db.collection('UsedToken').insertOne({ jti: payload.jti, "issued": issued }, function (err, record) {
      if (err) { return reject(err); }
      return resolve(record);
    });
  });
}

module.exports = tokenStore;
