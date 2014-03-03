/*jslint node: true */

/**
  * @classdesc View to process JSON over HTTP.
  *
  * @module View
  */

"use strict";

module.exports = View;

/**
  * @constructor
  * @alias module:View
  */
function View () {}

View.VERSION = 0.2;

/** Formats rows of MySQL results as JSON.
  * @param rows {Array} List of results.
  * @param err (Object} Optional error object.
  * @param status {Int} Optional HTTP status code.
  * @returns {String} JSON with keys <code>results</code> to hold rows,
  * <code>status</code> to hold the supplied status, or 500 <code>err</code>
  * is supplied, otherwise <code>200</code> if all is well.
  */
View.prototype.formatResults = function (rows,err,status) {
	if (typeof rows == 'string') rows = [{result: rows}];
	if (! (rows instanceof Array)) {
		rows = [rows];
	}
	var rv = { results : rows };
	if (err) {
		rv.error = err;
		rv.status = status || 500;
	} else {
		rv.status = status || 200;
	}
	return rv;
};

/** Specify a model method and how to call it, and have the results
  * sent as an HTTP chunked response. Complies with {@link formatReults},
  * with the addition that it sets <code>status</code> to 404 if there
  * are no results.
  * @param res {Response} The Response object.
  * @param args {Object} Arguments:
  * @param args.modelInstance {Model} An instnance of the Model.
  * @param args.modelMethod {String} Name of the method to call in the Model
  * @param args.modelParams {Array} Paramters to supply to the above <code>modelMethod</code>.
  * @returns Void.  
  */
View.prototype.sendChunkedResponse = function( res,  args ){
	res.writeHead(200, {
		'Content-Type': 'application/json',
		'Transfer-Encoding': 'chunked'
	});
	res.write('{"results":[');

	var params = args.modelParams;

	params.onRow = function onRow (chunk) {
		res.write(chunk);
	};
	params.onEnd = function onEnd (haveResults) {
		res.write("\n],\"status\":"+ (haveResults? 200 : 404) +"}");
		res.end();
	};
	params.onError = function onError (err) {
		res.write("\n"+'], "error":' + JSON.stringify( err ) + ', "status":500}');
		res.end();
	};

	args.modelMethod.call( args.modelInstance, params );
};
