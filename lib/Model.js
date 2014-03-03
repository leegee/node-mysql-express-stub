/*jslint node: true */

/**
  * @classdesc MySQL DAO Class.
  *
  * @module Model
  * @requires {@link https://github.com/felixge/node-mysql}
  */

"use strict";

var mysql = require('mysql');

module.exports = Model;

Model.VERSION = 0.3;

/**
  * @constructor
  * @alias module:Model
  *  
  * @param config {Object} Options to initiate connection/pool configuration. See {@link https://github.com/felixge/node-mysql}
  * @param config.host {String} MySQL host
  * @param config.user {String} MySQL user name
  * @param config.password {String} MySQL password
  * @param config.database {String} Name of the MySQL database to use.
  * @param config.insecureAuth {Boolean} Required, sadly. 
  * @param config.supportBigNumbers {Int} Usually required.
  * @param config.connectionLimit {Int} Maximum number of connections.
  */
function Model ( config ){
	if (config===null || typeof config != 'object'){
		console.error(
			'Model requires a hash of db config and a callback to format responses. ' + 
			'You supplied arguments: ', arguments
		);
		throw new Error('Missing configuration argument');
	}

	/** 
	The user-supplied configuraiton, only exposed for tests.
	@name Model#config
	*/
	this.config = config;

	/**
	The MySQL connection pool from which to retrieve DBHs.

	@name Model#pool
	*/
	this.pool = module.exports.pool = mysql.createPool( config );
	
	// this.formatResponse = null;
}

/** Shuts down the server. 
  * @param next {function} Next middleware callback.
  * @returns Void.
  */
Model.prototype.shutdown = function (next){
	this.pool.end( function (){
		console.log('MySQL cx pool terminating');
		next();
	});
};

/** Private method to run a select query, accepting callbacks to handle output/return values.
  * @private
  * @param sql {String} The SQL query to execute.
  * @param onRow {function} Called for every row, with an argument of the JSON-stringified result. Useful for immediate rendering of results.
  * @param onEnd {function} Called after all results are gathered, and the DBH is released.
  * @param onError {function} Called with the error, after the DBH has been released.
  */
Model.prototype._select = function (sql,  onRow, onEnd, onError){
	var self = this;
	this.pool.getConnection(function (err, dbh) {
		if (err) onError(err);
		else {
			var firstRow = true;

			dbh.query( sql )
			.on('error', function (err) {
				dbh.release();
				console.log("Error in Model._select, db="+self.config.database+", err=", err);
				onError(err);
			})
			.on('result', function (row) {
				dbh.pause();
				onRow(
					(!firstRow? ",\n":"") +
					JSON.stringify(row)
				);
				firstRow = false;
				dbh.resume();
			})
			.on('end', function () {
				dbh.release();
				onEnd( ! firstRow );
			});
		}
	});
};

/**
  * Lists all tables in the database.
  * @param next {function} Next middleware callback.
  * @returns {Array}
  */
Model.prototype.listTables = function (next){
	var self = this;
	this.pool.getConnection(function (err, dbh) {
		if (err) next(err);
		else dbh.query('SHOW TABLES', function (err, rows, fields) {
			dbh.release();
			var rv = [];
			if (rows === undefined){
				console.log('Nothing to show for this database');
			}
			else {
				var key = Object.keys( rows[0] );
				for (var i in rows){
					rv.push( rows[i][key] );
				}
			}
			return next(rv, err);
		});
	});
};

/** Runs one of two types of select query, returning the results as JSON,
  * and immediately outputs a JSON list of objects resulting from the supplied <code>params</code>.
  * As this stands, I'm not sure how useful this is to anyone but me.
  * @param params {Array} If this is an array with one member, all values of that column will be returned;
  * otherwise, the array is treated as a serialised object (<code>key1, value1, keyN, valueN<c/code>), and 
  * all fields for matching records will be returned. 
  * @param onRow {function} Called for every row, with an argument of the JSON-stringified result. Useful for immediate rendering of results.
  * @param onEnd {function} Called after all results are gathered, and the DBH is released.
  * @param onError {function} Called with the error, after the DBH has been released.
  * @returns Void.
  */
Model.prototype.select = function (args){
	var sql;
	if (args.params.length==1){
		sql = 'SELECT `' + args.params[0] + '` FROM `' + args.table + '`';
	}
	else {
		sql = 'SELECT * FROM `' + args.table + '` WHERE ';
		for (var i=0; i < args.params.length; i+=2){
			sql += '`' + args.params[0] + '` = ' + this.pool.escape( args.params[1] );
			if (i < args.params.length - 2) sql += ' AND ';
		}
	}
	this._select(sql, args.onRow, args.onEnd, args.onError);
};

Model.prototype.select_all = function select_all(args){
	this._select( 'SELECT * FROM `'+args.table+'`', args.onRow, args.onEnd, args.onError);
};

/**
  * Deletes one or more records.
  * @param table {String} Table name.
  * @param col {String} Column name.
  * @param val {String} Literal value by which to restrict column.
  * @param next {function} Next middleware callback.
  * @returns Return value is left to <code>next</code>.
  */
Model.prototype.deleteRecord = function ( table, col, val, next ){
	var self = this;
	this.pool.getConnection(function (err, dbh) {
		if (err) next(err);
		else dbh.query(
			'DELETE FROM `' +table+ '` WHERE `' +col+ '` = ' + self.pool.escape( val ),
			function (err, rows, fields) {
				dbh.release();
				return next(rows, err);
			}
		);
	});
};

/**
  * Inserts a new record.
  * @param table {String} Table name.
  * @param col {String} Column name.
  * @param body {Object} Object representing the new record, where keys are column names.
  * @param next {function} Next middleware callback.
  * @return {Int} The 'last-inserted ID', if possible. 
  */
Model.prototype.create = function (table, body, next){
	var sql = 'INSERT INTO `' +table+ '` (';
	var keyOrder = [];
	var first = true;
	for (var i in body ){
		if (! first) sql += ',';
		sql += " `"+ i +"`";
		keyOrder.push( i );
		first = false;
	}
	sql += ') VALUES (';
	first = true;
	for (i in keyOrder){
		if (! first) sql += ',';
		sql += this.pool.escape( body[ keyOrder[i] ] );
		first = false;
	}
	sql += ')';

	var findPriKeySql = "SELECT `COLUMN_NAME` FROM `information_schema`.`COLUMNS` " + 
		" WHERE (`TABLE_SCHEMA` = '"+ this.config.database +"')" + 
		"  AND (`TABLE_NAME` = '"+ table +"')  AND (`COLUMN_KEY` = 'PRI')";

	this.pool.getConnection(function (err, dbh) {
		if (err) next(err);
		else dbh.query( sql, function (err, row, fields) {
			// If created, return the created row: may only work on single-key columns
			if (row.hasOwnProperty('insertId')){
				var insertId = row.insertId;
				return dbh.query( findPriKeySql, function (err, row, field) {
					if (row && row.length && row[0].hasOwnProperty('COLUMN_NAME')){
						var sql = 'SELECT * FROM `'+table+'` WHERE `'+row[0].COLUMN_NAME+'` = '+ insertId;
						return dbh.query( sql, function (err, rows, fields) {
							dbh.release();
							return next(rows, err);
						});
					}
					else {
						dbh.release();
						return next(row, err);
					}
				});
			}
			else {
				dbh.release();
				return next(row, err);
			}
		});
	});
};


/**
  * Updates one or more records.
  * @param args {Object} Arguments defining the update.
  * @param args.table {String} The name of the table.
  * @param args.where {Array} Array of alternating column name/values for WHERE clause
  * @param args.body {Object} Column name/values for use in update
  * @param args.next {function} Next middleware callback, passed any result rows and error object.
  * @returns Return value is left to <code>args.next</code>.
*/
Model.prototype.update = function (args){
	var i;
	var sqlUpdate = 'UPDATE `' +args.table+ '` SET ';
	var first = true;
	for (i in args.body ){
		if (! first) sqlUpdate += ',';
		sqlUpdate += " `"+ i +"` = "+ this.pool.escape( args.body[i]);
		first = false;
	}
	sqlUpdate += ' WHERE ';
	first = true;
	for (i=0; i < args.where.length; i+=2 ){
		if (! first) sqlUpdate += ',';
		sqlUpdate += " `"+ args.where[i] +"` = ";
		sqlUpdate += args.where[i+1].match(/^\d+$/) ?
			args.where[i+1]
		:	this.pool.escape( args.where[i+1] );
		first = false;
	}

	var sqlSelect = 'SELECT * FROM `'+args.table+'` WHERE ';
	first = true;
	for (i in args.body ){
		if (! first) sqlUpdate += ' AND ';
		sqlSelect += " `"+ i +"` = "+ this.pool.escape( args.body[i]);
		first = false;
	}

	this.pool.getConnection(function (err, dbh) {
		if (err) args.next(err);
		else dbh.query( sqlUpdate, function (err, rows, fields) {
			if (err){
				dbh.release();
				args.next(rows, err);
			}
			else dbh.query( sqlSelect, function (err, rows, fields) {
				dbh.release();
				args.next(rows, err);
			});
		});
	});
};

Model.prototype.meta = function (table, next){
	this.pool.getConnection ( function (err, dbh) {
		if (err) next(err);
		else dbh.query(
			'SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE table_name=?',
			[table],
			function (err, rowsAboutTable, fields) {
				if (err) {
					dbh.release();
					next(err);
				}
				else dbh.query( 'SHOW FULL COLUMNS FROM `'+table+'`',
					function (err, rowsAboutColumns, fields) {
						dbh.release();
						var rv = [{
							table: rowsAboutTable[0],
							columns: rowsAboutColumns
						}];
						next(rv, err );
					});
				}
			);
		}
	);
};
