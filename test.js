/* mocha tests */

var http				= require('http');
var should				= require('should');

var Server				= require('./lib/Server');
var Model				= require('./lib/Model');
var View				= require('./lib/View');

var CLEANUP_AFTERWARDS	= false;
var TEST_DATABASE		= process.env.dbname || 'test';
var TEST_TABLE			= 'testing';
var DBH					= null;

var dbConfig = {
	host     			: 'localhost',
	user     			: process.env.dbuser || 'root',
	password 			: process.env.dbpass || 'password',
	database 			: TEST_DATABASE,
	insecureAuth		: process.env.dbpass? false : true,
	connectionLimit		: 20,
	supportBigNumbers	: true
};

var APP; // The server instance under test.

function testURI (method, path, next){
	var jsonBody;
	var params = {
		hostname:	'localhost',
		port:		Server.DEFAULT_PORT,
		method:		method
	};
	if (typeof path == 'string'){
		params.path = path;
	} else {
		if (! path.hasOwnProperty('path') || !path.hasOwnProperty('data'))
			throw 'If path arg is an object, supply path and data fields';
		jsonBody = JSON.stringify( path.data );
		params.path = path.path;
		params.headers = {
			'Content-type':		'application/json',
			'Content-length':	jsonBody.length
		}
	}

	var req = http.request( params, function(res) {
		res.setEncoding('utf8');
	});

	if (jsonBody != null){
		req.write( jsonBody );
	}

	req.on('response', function (res) {
		res.should.be.json;
		var rawBody = "";
		res.on('data', function (chunk) {
			rawBody += chunk;
		});
		res.on('end', function(){
			rawBody.should.be.type('string');
			next( JSON.parse(rawBody), res );
		});
	});

	req.end();
};

function setUpFixtures (done) {
	APP.model.pool.getConnection(function(err, dbh) {
	    if (err) {
			console.log('Error',err);
			return;
		}
		DBH = dbh;
		dbh.query('CREATE DATABASE IF NOT EXISTS '+TEST_DATABASE, function(err, result) {
			if (err) {
				console.log(err);
				throw err;
			}
			console.log("Database created or already exists.");
			dbh.query('USE test', function(err, result) {
				if (err) {
					console.log(err);
					throw err;
				}
				createFixtureTable(dbh, done);
			});
		});
	});
}

function dropFixtureTable( dbh, done){
	dbh.query('DROP TABLE '+TEST_TABLE, function(){
		done();
	});
}

function createFixtureTable( dbh, done){
	dbh.query(
		'CREATE TABLE IF NOT EXISTS '+TEST_TABLE+' ('+
			'id INT(11) AUTO_INCREMENT COMMENT "Auto-incrementing ID", ' +
			'text TEXT COMMENT "Description", ' +
			'PRIMARY KEY (id)' +
		') DEFAULT CHARACTER SET utf8 COMMENT "Test table";',
		function(err, result) {
			if (err) {
				console.log(err);
				throw err;
			}
			console.log("Table created");
			dbh.query('TRUNCATE '+TEST_TABLE, function(err,result){
				if (err) {
					console.log("Cannot truncate",err);
					throw err;
				}
				populateFixtures(dbh, done);
			});
		}
	);
}

function populateFixtures(dbh, done, i){
	if (i==null) i=0;
	dbh.query('INSERT INTO '+TEST_TABLE+' (text) VALUES (?)', [ "Testing " + new Date() ], function(err,result){
		if (err) {
			console.log("Error inserting fixture",err);
			throw err;
		}
		if (i<10) populateFixtures(dbh, done, ++i);
		else done();
	});
}


describe('view', function(){
	var view = new View();
	it('should be defined', function (done) {
		view.should.be.type('object');
		done();
	});
	it('should return expected struct', function(done){
		view.formatResults( [], null ).should.have.keys('results', 'status');
		view.formatResults( [], {ERROR:true} ).should.have.keys('results','error','status');
		done();
	});
});

describe('app config', function(){
	it('should have a default port of 3000', function(done){
		Server.DEFAULT_PORT.should.equal(3000);
		done();
	});
});

describe('URIs', function(){
	before (function (done) {
		var view  = new View();
		if (view==null) throw 'Could not instantiate view';
		var model = new Model(
			dbConfig,
			new View()
		);
		if (model==null) throw 'Could not instantiate model';
		APP = new Server( model, view );
		setUpFixtures( done );
	});

	if (CLEANUP_AFTERWARDS){
		after(function (done) {
			dropFixtureTable( DBH, function(){
				APP.shutdown( done );
			});
		});
	}

	it('should be defined', function (done) {
		APP.should.be.type('object');
		APP.should.be.an.instanceOf(Object);
		APP.should.have.property('model');
		APP.model.should.have.property('pool');
		done();
	});

	it('should be listening at localhost:3333 via http.get method', function (done) {
		http.get('http://localhost:3000/', function (res) {
			res.statusCode.should.be.equal(200);
			done();
		});
	});
	it('should be listening at localhost:3333 via test func', function (done) {
		testURI('GET','/', function (body, res) {
			res.statusCode.should.be.equal(200);
			done();
		});
	});

	it('should error for a non-existant table', function (done) {
		testURI('GET','/Notable'+(new Date().getTime()), function (body,res) {
			res.statusCode.should.be.equal(200);
			body.should.have.property('error');
			body.error.should.have.keys('errno', 'code', 'sqlState', 'index');
			body.error.should.have.property('errno');
			body.error.should.have.property('code').equal('ER_NO_SUCH_TABLE');
			done();
		});
	});

	it('should list tables', function (done) {
		http.get('http://localhost:3000/', function (res) {
			res.statusCode.should.be.equal(200);
			res.on('data', function (raw) {
				var body = JSON.parse(raw.toString('utf8'));
				body.should.not.have.property('error');
				body.should.have.property('results');
				body.results.should.be.an.instanceOf(Array);
				body.results[0].should.have.keys('Tables_in_'+TEST_DATABASE);
				done();
			});
		});
	});

	it('should return wrapped results for an existant table, '+TEST_DATABASE+'.'+TEST_TABLE,
		function (done) {
			testURI('GET','/'+TEST_TABLE, function (body) {
				body.should.not.have.property('error');
				body.should.have.property('results');
				body.results.length.ok;
				done();
			})
		}
	);

	it('should select by column', function (done) {
		var columnName = 'text';
		testURI('GET','/'+TEST_TABLE+'/'+columnName, function(body){
			body.should.not.have.property('error');
			body.should.have.property('results');
			body.results.length.ok;
			body.results[0].should.be.an.instanceOf( Object );
			body.results[0].should.have.keys( columnName );
			done();
		});
	});

	var existingRecord;
	it('should select by column and column value', function (done) {
		var columnName = 'id';
		var columnValue = 1;
		testURI('GET','/'+TEST_TABLE+'/'+columnName+'/'+columnValue, function(body){
			body.should.not.have.property('error');
			body.should.have.property('results');
			body.results.length.ok;
			body.results[0].should.be.an.instanceOf( Object );
			body.results[0].should.have.property('id');
			body.results[0].should.have.property('text');
			existingRecord = body.results[0];
			done();
		});
	});

	it('should select by two column and column value', function (done) {
		existingRecord.should.be.an.instanceOf( Object );
		var path = '/'+TEST_TABLE
			+ '/id/' + existingRecord.id
			+ '/text/' + encodeURI( existingRecord.text );

		testURI('GET', path, function(body){
			body.should.not.have.property('error');
			body.should.have.property('results');
			body.results.length.ok;
			body.results[0].should.be.an.instanceOf( Object );
			done();
		});
	});

	var deletePath = function(existingRecord){
		return '/'+TEST_TABLE + '/id/' + existingRecord.id
	};

	it('should delete by column value', function (done) {
		existingRecord.should.be.an.instanceOf( Object );

		testURI('DELETE', deletePath(existingRecord), function(body, res){
			res.statusCode.should.equal(200);
			body.should.not.have.property('error');
			body.should.have.property('results');
			body.results.should.be.an.instanceOf(Array);
			body.results.length.should.equal(1);
			body.results[0].should.be.an.instanceOf( Object );
			body.results[0].should.have.property('affectedRows');
			body.results[0].affectedRows.should.equal(1);
			done();
		});
	});

	it('should not get a deleted record', function (done) {
		testURI('GET', deletePath(existingRecord), function(body, res){
			res.statusCode.should.equal(200);
			body.should.not.have.property('error');
			body.should.have.property('results');
			body.results.should.be.an.instanceOf(Array);
			body.results.length.should.equal(0);
			body.should.have.property('status');
			body.status.should.be.above(399);
			body.status.should.be.below(499);
			done();
		});
	});

	it('should not delete by table', function (done) {
		testURI('DELETE', '/'+TEST_TABLE, function(body, res){
			res.statusCode.should.equal(404); // should be bad request
			done();
		});
	});

	var insertedId;
	var createMe = { text: 'Created by test case' };
	it('should create a new entry', function(done){
		testURI('POST', {
			path : '/' + TEST_TABLE,
			data : createMe
		}, function (body, res){
			res.statusCode.should.equal(200);
			body.should.have.property('status');
			body.should.have.property('results');
			body.results.length.should.equal(1);
			body.results[0].should.have.keys('id','text');
			body.results[0].id.should.match(/^\d+$/);
			body.results[0].text.should.equal( createMe.text );
			body.status.should.equal(201);
			insertedId = body.results[0].id;
			done();
		});
	});

	it('should get the created entry', function(done){
		insertedId.should.be.ok;
		testURI('GET', '/'+TEST_TABLE+'/id/'+insertedId, function( body, res) {
			res.statusCode.should.equal(200);
			body.should.have.property('status');
			body.status.should.equal(200);
			body.should.have.property('results');
			body.results.length.should.equal(1);
			body.results[0].should.have.property('id');
			body.results[0].id.should.equal( insertedId );
			body.results[0].text.should.equal( createMe.text );
			done();
		});
	});

	var newText = 'Some new text';
	it('should update an entry', function(done){
		insertedId.should.be.ok;
		testURI('PUT', {
			path: '/'+TEST_TABLE+'/id/'+insertedId,
			data: { text: newText }
		}, function( body, res) {
			res.statusCode.should.equal(200);
			body.should.have.property('status');
			body.status.should.equal(201);
			body.should.have.property('results');
			body.results.length.should.equal(1);
			body.results[0].should.have.property('id');
			body.results[0].id.should.equal( insertedId );
			body.results[0].text.should.equal( newText );
			done();
		});
	});

	it('should get the updated entry', function(done){
		insertedId.should.be.ok;
		testURI('GET', '/'+TEST_TABLE+'/id/'+insertedId, function( body, res) {
			res.statusCode.should.equal(200);
			body.should.have.property('status');
			body.status.should.equal(200);
			body.should.have.property('results');
			body.results.length.should.equal(1);
			body.results[0].should.have.property('id');
			body.results[0].id.should.equal( insertedId );
			body.results[0].text.should.equal( newText );
			done();
		});
	});

	it('should describe a table', function(done){
		testURI('TRACE', '/'+TEST_TABLE, function( body, res) {
			console.log( body );
			res.statusCode.should.equal(200);
			body.should.have.property('status');
			body.status.should.equal(200);
			body.should.have.property('results');
			done();
		});
	});

});
