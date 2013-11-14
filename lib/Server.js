var express 	= require('express');
var app 		= express();

if (!process.env.dbpass){
	app.use(express.logger('dev'));
}

module.exports = Server;

Server.DEFAULT_PORT = 3000;

function Server ( model, view ){
	console.log( 'Enter new App');
	var self = this;

	if (! model) throw 'Missing Model';
	this.model = model;

	if (! view) throw 'Missing View';
	this.view = view;

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
			function( rv ){ res.json(
				self.view.formatResults( rv )
			) }
		);
	});

	app.get('/:table', function(req, res){
		self.view.sendChunkedResponse(res, {
			modelInstance:	self.model,
			modelMethod:	model.select_all,
			modelParams: {
				table: req.params.table
			}
		});
	});

	app.get('/:table/*', function(req, res){
		self.view.sendChunkedResponse(res, {
			modelInstance:	self.model,
			modelMethod:	model.select,
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
			function( rv ){ res.json(
				self.view.formatResults( rv )
			) }
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

Server.prototype.shutdown = function( next ){
	this.server.close();
	this.model.shutdown( next );
}
