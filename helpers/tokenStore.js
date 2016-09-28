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

function findToken(db, decodedToken) {
  return new Promise(function(resolve, reject) {
    return db.collection('Token').findOne({ 'jti': decodedToken.jti }, function (err, record) {
      if (err) { return reject(err); }
      return resolve (record);
    });
  });
}

function removeToken(db, decodedToken) {
  return new Promise(function (resolve, revoke) {
    return db.collection('Token').remove({ 'jti': decodedToken.jti }, function (err, x) {
      if (err) { return reject(err); }
      return resolve(true);
    });
  });
}

function saveToken(db, decodedToken) {
  return new Promise(function (resolve, reject) {
    if (!decodedToken.jti) { return reject('The jwt must have a jti.'); }
    if (!decodedToken.iat || isNaN(decodedToken.iat)) { return reject('The jwt must have a valid iat.'); }

    var issuedAt = new Date(decodedToken.iat * 1000);
    var tokenRecord = {
      jti: decodedToken.jti,
      sub: decodedToken.sub,
      iss: decodedToken.iss,
      issued: issuedAt
    };

    var collection = db.collection('Token');
    var upsertFilter = { 'sub': decodedToken.sub, 'iss': decodedToken.iss };
    return collection.update(upsertFilter, tokenRecord, { upsert: true }, function (err, record) {
      if (err) { return reject(err); }
      return resolve(record);
    });
  });
}

module.exports = tokenStore;
