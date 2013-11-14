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
	console.log('---->'+method+' '+path);
	http.request({
		hostname:	'localhost',
		port:		Server.Server.DEFAULT_PORT,
		method:		method,
		path:		path
	}, function(res) {
		res.setEncoding('utf8');
	})
	.on('response', function (res) {
		res.should.be.json;
		var rawBody = "";
		res.on('data', function (chunk) {
			rawBody += chunk;
		});
		res.on('end', function(){
			rawBody.should.be.type('string');
			next( JSON.parse(rawBody), res );
		});
	})
	.end();
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
			'id INT(11) AUTO_INCREMENT, ' +
			'text TEXT, ' +
			'PRIMARY KEY (id)' +
		');',
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
	var view = new View.View();
	it('should be defined', function (done) {
		view.should.be.type('function');
		done();
	});
	it('should return expected struct', function(done){
		view( [], null ).should.have.keys('results');
		view( [], {ERROR:true} ).should.have.keys('results','error');
		done();
	});
});

describe('model', function(){
	it('should accept an inline view', function (done) {
		var instance = new Model.Model(dbConfig, function(){} );
		instance.should.be.an.instanceOf(Model.Model);
		instance.formatResponse.should.be.type('function');
		instance.should.have.property('pool');
		done();
	});

	it('should accept a View class', function (done) {
		var instance = new Model.Model( dbConfig, new View.View );
		instance.should.be.an.instanceOf( Model.Model );
		instance.should.have.property('formatResponse');
		instance.formatResponse.should.be.type('function');
		done();
	});
});

describe('app config', function(){
	it('should have a default port of 3000', function(done){
		Server.Server.DEFAULT_PORT.should.equal(3000);
		done();
	});
});

describe('URIs', function(){
	before (function (done) {
		var model = new Model.Model(
			dbConfig,
			new View.View
		);
		if (model==null) throw 'Could not build model';
		APP = new Server.Server( model );
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
				body.results.length.ok;
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

	/*
	it('should delete by column value', function (done) {
		existingRecord.should.be.an.instanceOf( Object );
		var uri = 'http://localhost:3000/'+TEST_TABLE
			+ '/id/' + existingRecord.id;

		testGet(uri, function(body){
			body.should.not.have.property('error');
			body.should.have.property('results');
			body.results.length.ok;
			body.results[0].should.be.an.instanceOf( Object );
			done();
		});

		testGet(uri, function(body){
			body.should.have.property('error');
			done();
		});
	});

	*/

});
