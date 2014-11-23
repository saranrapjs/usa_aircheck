var states = {"AL": "Alabama","AK": "Alaska","AS": "American Samoa","AZ": "Arizona","AR": "Arkansas","CA": "California","CO": "Colorado","CT": "Connecticut","DE": "Delaware","DC": "District Of Columbia","FM": "Federated States Of Micronesia","FL": "Florida","GA": "Georgia","GU": "Guam","HI": "Hawaii","ID": "Idaho","IL": "Illinois","IN": "Indiana","IA": "Iowa","KS": "Kansas","KY": "Kentucky","LA": "Louisiana","ME": "Maine","MH": "Marshall Islands","MD": "Maryland","MA": "Massachusetts","MI": "Michigan","MN": "Minnesota","MS": "Mississippi","MO": "Missouri","MT": "Montana","NE": "Nebraska","NV": "Nevada","NH": "New Hampshire","NJ": "New Jersey","NM": "New Mexico","NY": "New York","NC": "North Carolina","ND": "North Dakota","MP": "Northern Mariana Islands","OH": "Ohio","OK": "Oklahoma","OR": "Oregon","PW": "Palau","PA": "Pennsylvania","PR": "Puerto Rico","RI": "Rhode Island","SC": "South Carolina","SD": "South Dakota","TN": "Tennessee","TX": "Texas","UT": "Utah","VT": "Vermont","VI": "Virgin Islands","VA": "Virginia","WA": "Washington","WV": "West Virginia","WI": "Wisconsin","WY": "Wyoming"}

var sqlite3 = require('sqlite3'),
	request = require('request'),
	cheerio = require('cheerio'),
	moment = require('moment'),
	Twit = require('twit'),
	db = new sqlite3.Database('callsigns.db'),
	tokens = require('./tokens.js'),
	run_in_background = process.argv[2] === 'background';
 
var T = new Twit({
  consumer_key: tokens.consumer_key,
  consumer_secret: tokens.consumer_secret,
  access_token: tokens.access_token,
  access_token_secret: tokens.access_token_secret
});

var frequencies = ['AM', 'FM'];

var sql_statement = "SELECT * FROM callsigns WHERE fac_callsign != '' AND comm_city != '' AND comm_state != ''" 
	sql_statement += " AND fac_country = 'US'"
	sql_statement += " AND fac_callsign != 'NEW'"
	sql_statement += " AND fac_service in (\""+ frequencies.join("\", \"") +"\")"
	sql_statement += " ORDER BY RANDOM() LIMIT 1;"

// grab random one from sqlite database, excluding expired or not-yet-real FCC licenses

function one_from_database(cb) {
	db.get(sql_statement ,function(err,row) {
		if (row.fac_callsign[0] === 'D' || row.fac_callsign[0] === 'N' || isNaN(row.fac_callsign[0]) === false) { // no longer valid callsign
			one_from_database(cb); // go again
		} else {
			cb(row);
		}
	});
}

// for a given FM/AM callsign, ask Wikipedia if there's any supplementary information to be gotten

function get_station_info(callsign, spectrum, cb) {
	var keys = {
		'Branding' : true,
		'Slogan' : true,
		'Format' : true
	}
	request({
		url: 'http://en.wikipedia.org/wiki/'+callsign,
	    headers: {
	        'User-Agent': 'User-Agent	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.65 Safari/537.36'
	    }	
	}, function(err, response, body) {
		var meta = {};
	    if (!err) {
		    $ = cheerio.load(body)
		    $("tr").each(function() {
		    	var $th = $(this).find('th'),
		    		$td = $(this).find('td'),
		    		key, value;
		    	if ($th.length &&  $td.length) {
		    		key = $th.text();
		    		value = $td.text();
		    		if (keys[key] === true) {
		    			meta[key] = value;
		    			// console.log(key,':',value)
		    		}
		    	}
		    })
	    }
	    cb(meta);
	})
}

// turn station info into a speech-like sentence

// "This is WXXX, Anytown," but not "This is WXXX, based in Anytown"
// per http://en.wikipedia.org/wiki/Station_identification#United_States

function format_station(city, state, callsign, frequency, spectrum, meta) {
	var text = '',
		prefix = 'This is ',
		time_prefix = ', and you\'re listening to ';
	var current_time_at_hour = time_at_hour();

	frequency_split = frequency.split('.');
	frequency = frequency_split[0];
	if (spectrum === 'FM' && frequency_split[1][0] !== '0') {
		frequency = frequency + '.' + frequency_split[1].substr(0,1);
	}

	if (meta.Branding) {
		meta.Branding = meta.Branding
			.replace(callsign, '')
			.replace(frequency, '')
			.replace(spectrum, '')
			.replace(frequency_split[0], '')
			.replace(/\"/g,"")
			.trim()
		if (meta.Branding.length) {
			if (meta.Branding.length === 1) {
				text += meta.Branding + "-"
			} else {
				text += '"' + meta.Branding + '" '							
			}
		}
	}
	if (spectrum === 'AM') {
		text += spectrum + ' '
	}
	text += frequency;
	if (spectrum ==='FM' && callsign.indexOf('FM') === -1) {
		text += ' ' + spectrum
	}
	state = (states[state]) ? states[state] : state;
	city = city.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
	text += ' ' + callsign + '/' + city + ", " + state;
	if (meta.Slogan) {
		meta.Slogan = meta.Slogan.replace(/\"/g,"")
		text += '... ' + meta.Slogan;
	}
	if (text.length < 140 && (text.length + current_time_at_hour.length) < 140) {
		var time_at_end = Math.random() > 0.5;
		if (time_at_end) {
			text = prefix + text + '. ' + current_time_at_hour + '.';
		} else {
			text = current_time_at_hour + time_prefix + text;			
		}
	} else {
		text = prefix + text;
	}
	return text;
}

function time_at_hour() {
	var current_minutes = new Date().getMinutes(),
		minutes_join = 'past';
	if (current_minutes > 30) {
		current_minutes = 60 - current_minutes;
		minutes_join = 'before';
	}
	return "It's " + current_minutes + " minutes "+minutes_join+" the hour"
}

function tweet(msg, callback) {
	T.post('statuses/update', { status : msg },
	function (err, data) {
	  if (callback) callback();
	});
}


(function random_one() {
	one_from_database(function(row) {
		get_station_info(row.fac_callsign, row.fac_service, function(meta) {
			var text = format_station(row.comm_city, row.comm_state, row.fac_callsign, row.fac_frequency, row.fac_service, meta)
			if (run_in_background === false) {
				console.log(text);
				console.log(text.length + " characters")
			}
			tweet(text, function() {

				var minutes_to_add = ((Math.random() * 15 | 1) + 1) * ((Math.random() > 0.5) ? 1 : -1);

				var future = moment()
					.add(2, 'hours')
				// round to nearest hour
				if (future.minute() > 30) {
					future.add( 60 - future.minute(), 'minutes' );
				} else {
					future.minute(0);
				}
				future.add(minutes_to_add, 'minutes'); // add or subtract random amt of minutes from nearest hour

				var ms_from_now = future - moment();

				if (run_in_background === true) {
					setTimeout(random_one, ms_from_now);
				}
			});
		})
	})
})()