Backbone = require('backbone');

(function() {
  var con;

  Backbone.pg_connector = con = {

    config: undefined,

    connect: function(cb){
      if (this.config === undefined) throw new Error("You must define the config");
      var self = this;
      this.config.host = this.config.host || 'localhost'
      var conString = 'pg://' + this.config.user + ':' + this.config.password + '@' + this.config.host + '/' + this.config.name
      var pg = require('pg').native;
      pg.connect(conString, cb);
    },

    read: function(model, options){
      var self = this;
      this.connect(function(err, client){
        client.query('SELECT * FROM ' + model.urlRoot + ' WHERE id = $1', [model.id], function(err, result) {
          if(err) return options.error(model, err);
          if(result.rows.length == 0) return options.error(model, "Not found")
          options.success(result.rows[0]);
        });
      });
    },

    create: function(model, options){
      var keys = [];
      var values = [];
      var dollars = [];
      var dollar_counter = 1;
      for(var key in model.attributes){
        keys.push(key);
        values.push(model.attributes[key]);
        dollars.push('$' + dollar_counter++);
      }
      this.connect(function(err, client){
        client.query('INSERT INTO ' + model.urlRoot + ' (' + keys.join(',') + ') VALUES (' + dollars.join(',') + ') RETURNING *', values, function(err, result) {
          if(err) return options.error(model, err);
          options.success(result.rows[0]);
        });
      });
    },

    update: function(model, options){
      var keys = [];
      var values = [];
      var dollar_counter = 1;
      for(var key in model.attributes){
        if(key != 'id'){
          keys.push(key + ' = $' + dollar_counter ++);
          values.push(model.attributes[key]);
        }
      }
      values.push(model.id);
      this.connect(function(err, client){
        client.query('UPDATE ' + model.urlRoot + ' SET ' + keys.join(', ') + ' WHERE id = $' + dollar_counter + ' RETURNING *', values, function(err, result) {
          if(err) return options.error(model, err);
          if(result.rows.length == 0) return options.error(model, "Not found")
          options.success(result.rows[0]);
        });
      });
    },

    delete: function(model, options){
      this.connect(function(err, client){
        client.query('DELETE FROM ' + model.urlRoot + ' WHERE id = $1 RETURNING id', [model.id], function(err, result) {
          if(err) return options.error(model, err);
          if(result.rows.length == 0) return options.error(model, "Not found")
          options.success();
        });
      });
    },

    read_collection: function(collection, options){
      this.connect(function(err, client){
        client.query('SELECT * FROM ' + collection.urlRoot, [], function(err, result) {
          if(err) return options.error(model, err);
          options.success(result.rows);
          collection.trigger('fetched');
        });
      });
    }
  }

  Backbone.Model.prototype.sync = function(method, model, options){
    return con[method](model, options);
  }

  Backbone.Collection.prototype.sync = function(method, collection, options){
    return con[method + '_collection'](collection, options);
  }

}).call(this);

module.exports = Backbone;

