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

function findToken(db, payload, issuer) {
  return new Promise(function(resolve, reject) {
    return db.collection('Token').findOne({ 'jti': payload.jti }, function (err, record) {
      if (err) { return reject(err); }
      return resolve (record);
    });
  });
}

function removeToken(db, tokenId) {
  return new Promise(function (resolve, revoke) {
    return db.collection('Token').remove({ 'jti': tokenId }, function (err, x) {
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
    var tokenRecord = {
      jti: payload.jti,
      sub: payload.sub,
      iss: payload.iss,
      issued: issued
    };

    return db.collection('Token').insertOne(tokenRecord, function (err, record) {
      if (err) { return reject(err); }
      return resolve(record);
    });
  });
}

module.exports = tokenStore;
