var mysql = require('mysql');

module.exports.Model = Model;

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

formatResponse: a callback accepting rows of db-row hashes, and a possible error objec,
both from node-mysql. Eg:

	formatResponse = function (rows,err){
		var rv = { results : rows };
		if (err) rv.error = err;
		return rv;
	}
*/

function Model ( config, formatResponse ){
	this.pool = module.exports.pool = mysql.createPool( config );
	if (config==null || typeof config != 'object'
		|| formatResponse==null || typeof formatResponse != 'function'
	){
		console.error(
			'Model requires a hash of db config and a callback to format responses. '
			+ 'You supplied arguments: ', arguments
		);
		throw 'Bad arguments';
	}
	this.config = config;
	this.formatResponse = formatResponse;
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
				onEnd();
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
			var rv = self.formatResponse(rows,err);
			if (next) return next(rv)
			else return rv;
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

