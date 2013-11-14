var mysql = require('mysql');

module.exports = Model;

/*

Arguments:

config: hash of database connection/pool configuration. Eg:

	{
		host     			: 'localhost',
		user     			: 'root',
		password 			: 'password',
		database 			: 'test',
		insecureAuth		: true,
		connectionLimit		: 20,
		supportBigNumbers	: true
	}

*/

function Model ( config ){
	this.pool = module.exports.pool = mysql.createPool( config );
	if (config==null || typeof config != 'object'){
		console.error(
			'Model requires a hash of db config and a callback to format responses. '
			+ 'You supplied arguments: ', arguments
		);
		throw Error('Bad arguments');
	}
	this.config = config;
	this.formatResponse = null; // formatResponse;
};

Model.prototype.shutdown = function (next){
	this.pool.end( function(){
		console.log('MySQL cx pool terminating');
		next();
	});
}

Model.prototype._select = function (sql,  onRow, onEnd, onError){
	var self = this;
	this.pool.getConnection(function(err, dbh) {
		if (err) onError(err);
		else {
			var firstRow = true;

			dbh.query( sql )
			.on('error', function(err) {
				dbh.release();
				console.log("Error in Model._select, db="+self.config.database+", err=", err);
				onError(err);
			})
			.on('result', function(row) {
				dbh.pause();
				onRow(
					(!firstRow? ",\n":"")
					 + JSON.stringify(row)
				);
				firstRow = false;
				dbh.resume();
			})
			.on('end', function() {
				dbh.release();
				onEnd( ! firstRow );
			});
		}
	});
}

Model.prototype.listTables = function(next){
	var self = this;
	this.pool.getConnection(function(err, dbh) {
		if (err) next(err);
		else dbh.query('SHOW TABLES', function(err, rows, fields) {
			dbh.release();
			return next(rows, err)
		});
	});
}

Model.prototype.select = function(args){
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
}

Model.prototype.deleteRecord = function ( table, col, val, next ){
	var self = this;
	this.pool.getConnection(function(err, dbh) {
		if (err) next(err);
		else dbh.query(
			'DELETE FROM `' +table+ '` WHERE `' +col+ '` = ' + self.pool.escape( val ),
			function(err, rows, fields) {
				dbh.release();
				return next(rows, err)
			}
		);
	});
}

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

	this.pool.getConnection(function(err, dbh) {
		if (err) next(err);
		else dbh.query( sql, function(err, rows, fields) {
			dbh.release();
			return next(rows, err)
		});
	});
}


/* table
	where - array of alternating column name/values for WHERE clause
	body - hash of column name/values for to use in update
	next - as always
*/
Model.prototype.update = function (args){
	var sql = 'UPDATE `' +args.table+ '` SET ';
	var first = true;
	for (var i in args.body ){
		if (! first) sql += ',';
		sql += " `"+ i +"` = "+ this.pool.escape( args.body[i]);
		first = false;
	}
	sql += ' WHERE ';
	first = true;
	for (var i=0; i < args.where.length; i+=2 ){
		if (! first) sql += ',';
		sql += " `"+ args.where[i] +"` = ";
		sql += args.where[i+1].match(/^\d+$/) ?
			args.where[i+1]
		:	this.pool.escape( args.where[i+1] );
		first = false;
	}

	this.pool.getConnection(function(err, dbh) {
		if (err) args.next(err);
		else dbh.query( sql, function(err, rows, fields) {
			dbh.release();
			return args.next(rows, err)
		});
	});
}
