/*jslint node: true */

/**
  * @classdesc An Express instance with routes and controllers to provide 
  * simple REST access to a MySQL database.
  *
  * @module Server
  * @requires express
  */

"use strict";

var express			= require('express');
var app				= express();

module.exports		= Server;

Server.VERSION		= 0.3;

/** @property {Int} The default port on which to listen */
Server.DEFAULT_PORT	= 3000;

/**
 * An Express server listening on the port defined in the env var <code>PORT</code>
 * or {@link Server.DEFAULT_PORT}.
 * @constructor
 * @alias module:Server
 * @param model {module:Model} An instance of a Model
 * @param view {module:View} An instance of a View
 * @param logger {Log4js.logger} An instance of a Log4js logger
 */
function Server ( model, view, logger ){
	var self = this;

	if (! model) throw new Error('Missing Model');
	this.model = model;

	if (! view) throw new Error('Missing View');

	if (! logger) throw new Error('Missing log4js-type logger');

	process.on('exit', function () {
		logger.info('Express server exiting.');
	});

	app.use(express.urlencoded());
	app.use(express.json());

	// Error handler
	app.use(function(err, req, res, next) {
		logger.error(err.stack);
		res.send( 500, err );
		next();
	});

	// Logging:
	app.use(function(request, response, next) {
		logger.trace(request.method + " " + request.url);
		next();
	});

	app.all('/*', function(req, res, next) {
		res.header("Access-Control-Allow-Origin", "*");
		res.header("Access-Control-Allow-Headers", "X-Requested-With");
		next();
	});

	app.get('/', function(req, res){
		self.model.listTables(
			function( rv ){ 
				res.json(
					view.formatResults( rv )
				);
			}
		);
	});

	app.get('/:table/?', function(req, res){
		if (req.url.match(/\?/)) {
			self.model.meta( req.params.table, function (rv, err) {
				res.json(
					view.formatResults( rv, err  )
				);
			});
		}
		else {
			view.sendChunkedResponse(res, {
				modelInstance:	self.model,
				modelMethod:	model.select_all,
				modelParams: {
					table: req.params.table
				}
			});
		}
	});

	app.get('/:table/*', function(req, res){
		view.sendChunkedResponse(res, {
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
			function (rv) {
				res.json(
					view.formatResults( rv )
				);
			}
		);
	});

	app.post('/:table/?', function(req, res){
		if (req.headers['content-type'].match('json')){
			self.model.create(
				req.params.table,
				req.body,
				function (rv, err){
					res.json(
						view.formatResults( rv, err, err===null? 201 : 500 )
					);
				}
			);
		} else {
			res.json(400,{ status:400, message:'Bad Request - please send JSON' });
		}
	});

	app.put('/:table/*', function(req, res){
		if (req.headers['content-type'].match('json')){
			self.model.update({
				table:	req.params.table,
				where:	req.params.slice(0)[0].split('/'), // URL deocde?
				body:	req.body,
				next:	function (rv, err){
					res.json( 
						view.formatResults( rv, err, err===null? 201: 500 )
					);
				}
			});
		} else {
			res.json(400,{ status:400, message:'Bad Request - please send JSON' });
		}
	});

	// Final entry - fallback
	app.use(function(req, res){
		res.json(404, {status:404});
	});

	// Move to method?
	app.set('port', process.env.PORT || Server.DEFAULT_PORT);
	
	this.server = app.listen( app.get('port') );
	
	logger.info('Express server listening on port ' + app.get('port'));
}


/** Shuts down the server. 
  * @param next {function} Next middleware callback.
  */
Server.prototype.shutdown = function( next ){
	this.server.close();
	this.model.shutdown( next );
};
