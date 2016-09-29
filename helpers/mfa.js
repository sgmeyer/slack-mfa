var Promise = require('bluebird');
var request = Promise.promisify(require('request'));

var mfa = {
  enroll: function startMfaEnrollment(options) {
    return request({ method: 'PATCH',
      url: 'https://' + options.apiDomain + '/api/v2/users/' + options.userId,
      headers: {
        'cache-control': 'no-cache',
        'authorization': 'Bearer ' + options.apiToken,
        'content-type': 'application/json' },
      body: { user_metadata: { slack_mfa_username: options.slack_username, slack_mfa_enrolled: false } },
      json: true });
  },
  verify: function (options) {
    return request({ method: 'PATCH',
      url: 'https://' + options.apiDomain + '/api/v2/users/' + options.userId,
      headers: {
        'cache-control': 'no-cache',
        'authorization': 'Bearer ' + options.apiToken,
        'content-type': 'application/json' },
      body: { user_metadata: { slack_mfa_enrolled: true }  },
      json: true });
  }
};

module.exports = mfa;
