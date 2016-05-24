var request = require('request')
var cheerio = require('cheerio')
var Twitter = require('twitter-node-client').Twitter;
var credentials = require('./credentials')
var twitter = new Twitter(credentials.data)
var low = require('lowdb')
var storage = require('lowdb/file-sync')
var db = low('db.json', { storage })
var sinceID = db.object.sinceID
var trackSinceID = sinceID
var callCount = 0
var recentCount = 20

var error = function(err, response, body) {
    console.log('ERROR [%s]', err)
    console.log(err)
}

var success = function(data) {
    console.log('Data [%s]', data)
}

var url = 'http://maxrchung.com/projects/clgretweet'

execute()
// Look for retweets every 4 minutes
setInterval(execute, 60 * 5 * 1000)

function execute() {
    request(url, function handleRequest(error, response, html) {
	if (!error) {
	    var users = []
	    var $ = cheerio.load(html)
	    $('div#following li').each(function parseName(i, elem) {
		users.push($(this).text().trim().substr(1))
	    });

	    processUsers(users)
	}
    })
}

function processUsers(users) {
    callCount = users.length
    for (var i = 0; i < callCount; i++) {
	var screenName = users[i]
	twitter.getUserTimeline({ screen_name: screenName, 
				  count: recentCount,
				  trim_user: 1,
				  since_id: sinceID}, error, checkTweet)
    }
}

function checkTweet(tweet) {
    // console.log(JSON.stringify(JSON.parse(tweet), null, 4))
    var parsed = JSON.parse(tweet)
    if (parsed.length > 0) {
	for (var i = parsed.length - 1; i >= 0; i--) {
	    if (!parsed[i]['in_reply_to_user_id_str']) {
		// postCustomApiCall seems to have problems with authentication
		// A workaround uses doPost, source: https://github.com/BoyCook/TwitterJSClient/issues/37
		twitter.doPost(twitter.baseUrl + '/statuses/retweet/' + parsed[i]['id_str'] + '.json?', { trim_user : 1}, error, success);
	    }
	}

	if (parsed[0]['id_str'] > trackSinceID) {
	    trackSinceID = parsed[0]['id_str']
	}
    }

    endCall()
}

function endCall() {
    if (--callCount == 0) {
	if (sinceID != trackSinceID) {
	    sinceID = trackSinceID
	    db.object.sinceID = sinceID
	    db.write()
	}
    }
}
