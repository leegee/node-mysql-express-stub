var express 	= require('express');
var app 		= express();

if (!process.env.dbpass){
	app.use(express.logger('dev'));
}

module.exports.Server = Server;

Server.DEFAULT_PORT = 3000;

function Server ( model ){
	console.log( 'Enter new App');
	var self = this;

	if (! model) throw 'Missing Model';
	this.model = model;

	process.on('exit', function () {
		console.log('Express server exiting.');
	});

	// Error handler
	app.use(function(err, req, res, next) {
		console.error(err.stack);
		res.send( 500, err );
	});

	app.get('/', function(req, res){
		self.model.listTables(
			function( rv ){ res.json( rv ) }
		);
	});

	app.get('/:table', function(req, res){
		self.sendChunkedResponse(res, {
			modelMethod: model.select_all,
			modelParams: {
				table: req.params.table
			}
		});
	});

	app.get('/:table/*', function(req, res){
		self.sendChunkedResponse(res, {
			modelMethod: model.select,
			modelParams: {
				table: req.params.table,
				params: req.params.slice(0)[0].split('/') // URL deocde?
			}
		});
	});

	app.delete('/:table/:col/:val', function(req, res){
		self.model.deleteRecord(
			req.params.table,
			req.params.col,
			req.params.val,
			function( rv ){ res.json( rv ) }
		);
	});

	app.use(function(req, res){
		res.send(404, {status:404});
	});

	// Move to method?
	app.set('port', process.env.PORT || Server.DEFAULT_PORT);
	this.server = app.listen( app.get('port') );
	console.log('Express server listening on port ' + app.get('port'));
}

// Part of a view?
Server.prototype.sendChunkedResponse = function( res, args ){
	res.writeHead(200, {
		'Content-Type': 'application/json',
		'Transfer-Encoding': 'chunked'
	});
	res.write('{"results":[');
	var onRow  = function onRow (chunk) { res.write(chunk) };
	var onEnd   = function onEnd (haveResults) {
		res.write("\n],\"status\":"+ (haveResults? 200 : 404) +"}");
		res.end();
	};
	var onError = function onError (err) {
		res.write("\n"+'], "error":'
			+ JSON.stringify( err )
			+ ', "status":500}');
		res.end();
	};

	var params = args.modelParams;
	params.onRow = onRow;
	params.onEnd = onEnd;
	params.onError = onError;
	args.modelMethod.call( this.model, params );
}

Server.prototype.shutdown = function( next ){
	this.server.close();
	this.model.shutdown( next );
}
