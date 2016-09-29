var Promise = require('bluebird');
var request = Promise.promisify(require('request'));

var slack = {
  sendDM: function (options) {
    var text = JSON.stringify([{
      fallback: 'Follow this link to complete login: <' + options.verifyUrl + ' | Complete Login>.',
      title: 'You have attempted to log into a remote site.  Please click the link below to continue.',
      text: '<' + options.verifyUrl + ' | Complete Login>\n\n<' + options.cancelUrl + ' | That\'s not me>',
      color: '#3AA3E3'
    }]);

    var requestUrl = 'https://slack.com/api/chat.postMessage?token='
                   + options.token + '&channel=%40' + options.username
                   + '&attachments=' + require('querystring').escape(text)
                   + '&pretty=1&as_user=true&unfurl_links=false&unfurl_media=false';

    return request({
      method: 'GET',
      url: requestUrl
    });
  }
};

module.exports = slack;
