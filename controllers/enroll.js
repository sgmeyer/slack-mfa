var express = require('express');
var router = express();

function getEnroll(req, res) {
  res.status(200).send("Thanks for the enrollment.");
}

function postEnroll(res, req) {

}

router.get('/enroll', getEnroll);
router.post('/enroll', postEnroll);

module.exports = router;
