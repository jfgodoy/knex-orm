'use strict';


function geometryToDB(knex, value) {
  if (typeof value === 'string') {
    return knex.postgis.geomFromText(value, this.srid);
  } else {
    return value;
  }
}

function geometryFromDB(knex) {
  return knex.postgis.asEWKT(this.field);
}


module.exports = [
  {
    pattern: /^geometry(?:\((.*?),\s*(\d+)\s*\))?\s*$/i,

    createDef: function(opts) {
      var match = opts.match,
          geomType = match[1],
          srid = +match[2],
          def = opts.def;

      def.type = 'geometry';

      if (geomType) {
        def.geomType = geomType;
      }

      if (srid) {
        def.srid = srid;
      }

      def.toDB = geometryToDB;
      def.fromDB = geometryFromDB;

      return def;
    }
  },
  {
    pattern: /^text|string$/i,
    createDef: function(opts) {
      var def = opts.def;
      def.type = 'text';
      return def;
    }
  },
  {
    pattern: /^integer$/i,
    createDef:function(opts) {
      var def = opts.def;
      def.type = 'integer';
      return def;
    }
  },
  {
    pattern: /^date$/i,
    createDef:function(opts) {
      var def = opts.def;
      def.type = 'date';
      return def;
    }
  }

];
