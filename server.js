var app = require('./app.js');
var dotenv = require('dotenv');

dotenv.load();

var port = process.env.PORT || 3000;

app.listen(port, function () {
    console.log('Server started on port', port);
});
