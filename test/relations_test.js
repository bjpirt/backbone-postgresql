var should      = require('should'),
    Backbone    = require('../backbone-postgresql'),
    table_name  = 'test_rel';

var Test = Backbone.Model.extend({
  urlRoot: '/' + table_name
});

var TestCollection = Backbone.Collection.extend({
  urlRoot: '/reltest/:id/' + table_name,
  model: Test
});

Backbone.pg_connector.config = { db: 'pg://bb_pg:test@localhost/bb_pg_test' };

describe('Backbone PostgreSQL storage adaptor relations', function() {
  var client;

  before(function(done){
    Backbone.Model.column_defs = {};
    Backbone.pg_connector.connect(function(err, client_arg){
      client = client_arg;
      client.query('DROP TABLE ' + table_name, function(err, result){
        client.query('CREATE TABLE ' + table_name + '(id SERIAL, reltest_id INTEGER, one VARCHAR(64))', function(err, result){
          done();
        });
      });
    });
  });

  beforeEach(function(done){
    client.query("TRUNCATE TABLE " + table_name + " CASCADE;", [], function(err, result) {
      done();
    });
  });

  describe('on collections', function(done){
    var test1, test2, test3, test4;
    beforeEach(function(done){
      test1 = new Test({reltest_id: 1, one: 'a'});
      test2 = new Test({reltest_id: 1, one: 'b'});
      test3 = new Test({reltest_id: 2, one: 'b'});
      test4 = new Test({reltest_id: 2, one: 'c'});
      test1.save(null, {success: function(){
        test2.save(null, {success: function(){
          test3.save(null, {success: function(){
            test4.save(null, {success: function(){
            done();
            }});
          }});
        }});
      }});
    });

    describe('filtering', function(){
      it('should use the urlRoot to perform filtering', function(done){
        var coll = new TestCollection();
        coll.urlRoot = '/reltest/1/' + table_name;
        coll.fetch({success: function(){
          coll.models.length.should.eql(2);
          done();
        }});
      });

      it('should still be possible to use a filter parameter as an object', function(done){
        var coll = new TestCollection();
        coll.urlRoot = '/reltest/1/' + table_name;
        coll.fetch({
          filter: {one: 'b'},
          success: function(){
            coll.models.length.should.eql(1);
            done();
          }
        });
      });
 
      it('should still be possible to use a filter parameter as an array', function(done){
        var coll = new TestCollection();
        coll.urlRoot = '/reltest/1/' + table_name;
        coll.fetch({
          filter: ["one = 'b'"],
          success: function(){
            coll.models.length.should.eql(1);
            done();
          }
        });
      });
    });

    describe('adding a model to a collection', function(){
      it('should set the foreign key properly', function(done){
        var coll = new TestCollection();
        coll.urlRoot = '/reltest/1/' + table_name;
        var model = new Test();
        should.not.exist(model.attributes.reltest_id);
        coll.add(model);
        model.attributes.reltest_id.should.eql(1);
        done();
      });
    });

  });

});

