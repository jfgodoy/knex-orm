'use strict';

var classExtend = require('class-extend').extend;
var _ = require('lodash');
var types = require('./types');
var Promise = require('bluebird');


function Model(attrs) {
  this.attrs = attrs;
  this.initialize();
}

// instance methods

_.extend(Model.prototype, {

  initialize: function initialize() {
  },

  save: function save() {
    if (this.isNew()) {
      return this.constructor.insert(this.attrs)
        .then(this._mergeResponse);
    } else {
      return this.constructor.udpate(this.attrs).where(this.pkWhere())
        .then(this._mergeResponse);
    }

  },

  destroy: function destroy() {
    return this.constructor.knex.destroy(this.pkWhere());
  },

  isNew: function isNew() {
    return (typeof this.attrs[this.constructor.getPkName()] !== 'undefined');
  },

  pkWhere: function pkWhere() {
    var where = {},
        pkName = this.constructor.getPkName();

    where[pkName] = this.attrs[pkName];

    return where;
  },

  _mergeResponse: function _mergeResponse(response) {
    for (var k in response) {
      this.attrs[k] = response[k];
    }
  },

  toJSON: function() {
    return _.clone(this.attrs);
  }
});

// class methods

_.extend(Model, {
  _buildSchema: function buildSchema() {
    this._normalizeAttributes();

    this.attributeNames =  _.keys(this.attributes);

    this.returning = this.defaultSelect = this._colsFromDB();

    if (this.migrate === 'drop') {
      console.log('migrate drop not supported yet');
    }

  },

  _colsFromDB: function() {
    var knex = this.knex,
        star = true,
        returning;

    returning = _.map(this.attributes, function(def, name) {
      var val = def.fromDB ? def.fromDB(knex) : name;
      if (val !== name) {
        star = false;
      }
      return val;
    });

    if (star) {
      return '*';
    } else {
      return returning;
    }
  },

  _normalizeAttributes: function() {
    var self = this,
        attrs = {};

    _.forEach(this.attributes, function(type, name) {
      attrs[name] = self._mapType(name, type);
    });

    this.attributes = attrs;
  },

  _mapType: function _mapType(name, type) {
    var def;

    if (typeof type === 'object') {
      def = type;
    } else {
      def = {
        type: type
      };
    }

    // normalize field name
    if (!def.field) {
      def.field = name;
    }

    for (var i = 0, n = types.length; i < n; i++) {
      var match = types[i].pattern.exec(def.type);
      if (match) {
        return types[i].createDef({
          match: match,
          def: def
        });
      }
    }


    throw new Error('type \'' + def.type + '\' is not a valid type');
  },

  _prepareValues: function _prepareValues(attrs) {
    var knex, k;

    // insert only attributes defined in attributes object
    attrs = _.pick(attrs, this.attributeNames);

    knex = this.knex;

    // parse values to insert
    for (k in attrs) {
      if (this.attributes[k].toDB) {
        attrs[k] = this.attributes[k].toDB(knex, attrs[k]);
      }
    }

    return attrs;
  },

  query: function query() {
    var self = this;
    var qb = this.knex(this.tableName);

    // replace toSQL function to add default select considering geometry
    // u other special type.
    qb.toSQL = function toSQL() {
      this.grouped = _.groupBy(this._statements, 'grouping');

      if (!this.grouped.columns) {
        this.select(self.defaultSelect);
      } else {
        var statements = this.grouped.columns;
        for (var i = 0, n = statements.length; i < n; i++) {
          var columns = statements[i].value;
          for (var j = 0, nj = columns.length; j < nj; j++) {
            var col = columns[j];
            if (typeof col === 'string') {
              var idx = col.indexOf(self.tableName + '.');
              col = (idx === 0)? col.substring(self.tableName.length + 1) : col;
              var def = self.attributes[col];
              if (def && def.fromDB) {
                columns[j] = def.fromDB(self.knex);
              }
            }
          }
        }
      }

      if (self.debug) {
        console.log(Object.getPrototypeOf(this).toSQL.apply(this, arguments));
      }

      return Object.getPrototypeOf(this).toSQL.apply(this, arguments);
    };

    return qb;
  },

  getPkName: function getPkName() {
    if (!this._pk) {
      this._pk = _.find(this.attributes, function(def) {
        return def.primaryKey;
      });
    }
    return this._pk;
  },

  col: function col(colname) {
    return this.tableName + '.' + colname;
  },

  create: function create(attrs) {
    var self = this;

    this.beforeValidate && this.beforeValidate(attrs);
    this.validate && this.validate(attrs);
    this.afterValidate && this.afterValidate(attrs);
    this.beforeCreate && this.beforeCreate(attrs);

    return this.insert(attrs).then(function(results) {
      self.afterCreate && self.afterCreate(results);
      return new self(results[0]);
    });
  },

  insert: function insert(attrs) {
    attrs = this._prepareValues(attrs);
    return this.query().insert(attrs).returning(this.returning);
  },

  update: function update() {
    var query = this.knex(this.tableName);
    if (arguments.length > 0) {
      query = query.update.apply(query, arguments);
    }
    return query;
  },

  destroy: function destroy(search) {
    var query = this.query().del();
    if (search) {
      query = query.where(search);
    }
    return query;
  },

  find: function find(search) {
    var query = this.query();
    if (search) {
      query = query.where(search);
    }
    return query;
  },

  findOne: function findOne(search) {
    return this.find(search).limit(1).then(function(results) {
      if (results.length === 0) {
        throw new Error('not found');
      } else {
        return results[0];
      }
    });
  }
});

// extend this Class to create a new one inherithing this one.
Model.extend = function extend(props) {
  var newModel = classExtend.call(this, {}, props);
  newModel._buildSchema();
  return newModel;
};

module.exports.Model = Model;
