var should      = require('should'),
    Backbone    = require('../backbone-postgresql'),
    table_name  = 'test';

var Test = Backbone.Model.extend({
  urlRoot: table_name
});

var TestCollection = Backbone.Collection.extend({
  urlRoot: table_name,
  model: Test
});

Backbone.pg_connector.config = {
  "name":"bb_pg_test",
  "user":"bb_pg",
  "password":"test"
};

var conString = 'pg://' + Backbone.pg_connector.config.user + ':' + Backbone.pg_connector.config.password + '@localhost/' + Backbone.pg_connector.config.name
var pg = require('pg').native;

describe('Backbone PostgreSQL storage adaptor', function() {
  var client;

  before(function(done){
    Backbone.Model.column_defs = {};
    pg.connect(conString, function(err, client_arg){
      client = client_arg;
      client.query('DROP TABLE ' + table_name, function(err, result){
        client.query('CREATE TABLE ' + table_name + '(id SERIAL, one VARCHAR(64), two INTEGER)', function(err, result){
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

  describe('on models', function(done){

    describe("fetching a model", function(done) {
      beforeEach(function(done){
        client.query("INSERT INTO " + table_name + " (id, one, two) VALUES (123, 'one', 2)", [], function(err, result) {
          done();
        });
      });

      it('should return the model correctly if it exists', function(done) {
        var test_model = new Test({id: 123});
        test_model.fetch({success: function(model){
          model.id.should.eql(123);
          model.attributes.should.eql({id: 123, one: 'one', two: 2});
          done();
        }});
      });
  
      it('should return an error message if it does not exist', function(done){
        var test_model = new Test({id: 124});
        test_model.fetch({error: function(model, err){
          err.should.eql("Not found");
          done();
        }});
      });

      it('should allow further filters to be placed on the fetch using an array', function(done){
        var test_model = new Test({id: 123});
        test_model.fetch({
          filter: ["one = 'bad'", "two = 2"],
          error: function(model, err){
            model.id.should.eql(123);
            err.should.eql("Not found");
            test_model.fetch({
              filter: ["one = 'one'", "two = 2"],
              success: function(){
                done();
              }
            });
          }
        });
      });
 
      it('should allow further filters to be placed on the fetch using an object', function(done){
        var test_model = new Test({id: 123});
        test_model.fetch({
          filter: {one: 'bad', two: 2},
          error: function(model, err){
            model.id.should.eql(123);
            err.should.eql("Not found");
            test_model.fetch({
              filter: {one: 'one', two: 2},
              success: function(){
                done();
              }
            });
          }
        });
      });
    });
  
    describe('saving a new model', function(done){
      it('should update the attributes and id', function(done){
        var test_model = new Test({one: 'testone', two: 2});
        should.not.exist(test_model.id);
        test_model.save(null, {success: function(model){
          model.id.should.be.a('number');
          model.attributes.should.eql({id: model.id, one: 'testone', two: 2});
          done();
        }});
      });
  
      it('should not save invalid columns', function(done){
        var test_model = new Test({one: 'one', two: 2, bad: 'bad'});
        test_model.has_attributes = function(){return false;}
        test_model.save(null, {success: function(model){
          var test_model2 = new Test({id: model.id});
          test_model2.fetch({success: function(model2){
            model2.attributes.should.eql({id: model.id, one: 'one', two: 2});
            done();
          }});
        }});
      });

      it('should raise an error if there is a problem saving', function(done){
        var test_model = new Test();
        test_model.urlRoot = 'bad';
        test_model.save(null, {error: function(model, err){
          should.not.exist(model.id);
          err.message.should.eql('relation "bad" does not exist');
          done();
        }});
      });
    });
  
    describe('saving an existing model', function(done){
      var model;
      beforeEach(function(done){
        var test_model = new Test({one: 'testone', two: 2});
        test_model.save(null, {success: function(thismodel){
          model = thismodel;
          done();
        }});
      });
  
      it('should save it correctly', function(done){
        model.isNew().should.be.false;
        model.set('one', 'updated');
        model.save(null, {success: function(thismodel){
          model.attributes.should.eql({id: thismodel.id, one: 'updated', two: 2});
          client.query("SELECT * FROM " + table_name + " WHERE id = $1", [thismodel.id], function(err, result) {
            should.not.exist(err);
            result.rows.length.should.eql(1);
            result.rows[0].should.eql({id: thismodel.id, one: 'updated', two: 2});
            done();
          });
        }});
      });
   
      it("should not save invalid columns if this table doesn't have an hstore column", function(done){
        model.isNew().should.be.false;
        model.has_attributes = function(){return false;}
        model.set({one: 'new_one', bad: 'bad'});
        model.save(null, {success: function(model){
          var model2 = new Test({id: model.id});
          model2.fetch({success: function(){
            model2.attributes.should.eql({id: model.id, one: 'new_one', two: 2});
            done();
          }});
        }});
      });

      it('should raise an error if there was a problem saving it', function(done){
        model.isNew().should.be.false;
        model.urlRoot = 'bad';
        model.save(null, {error: function(model, err){
          err.message.should.eql('syntax error at or near "WHERE"');
          done();
        }});
      });
  
      it("should raise an error if it didn't exist", function(done){
        var test_model = new Test({id: 123});
        test_model.isNew = function(){return false;}
        test_model.set('one', 'updated');
        test_model.save(null, {error: function(deleted_model, err){
          err.should.eql("Not found");
          done();
        }});
      });
    });
  
    describe('deleting a model', function(done){
      it('should delete it correctly', function(done){
        var test_model = new Test({one: 'testone', two: 2});
        test_model.save(null, {success: function(thismodel){
          thismodel.destroy({success: function(deleted_model){
            client.query("SELECT * FROM " + table_name + " WHERE id = $1", [thismodel.id], function(err, result) {
              result.rows.length.should.eql(0);
              done();
            });
          }});
        }});
      });
  
      it("should raise an error if it didn't exist", function(done){
        var test_model = new Test({id: 123});
        test_model.destroy({error: function(deleted_model, err){
          err.should.eql("Not found");
          done();
        }});
      });
    });
  });

  describe('on collections', function(done){
    describe("fetching a collection", function(done) {
      var test_model1, test_model2, collection;

      beforeEach(function(done){
        collection = new TestCollection();
        test_model1 = new Test({one: 'testone1', two: 2});
        test_model2 = new Test({one: 'testone2', two: 2});
        test_model1.save(null, {success: function(){
          test_model2.save(null, {success: function(){
            done();
          }});
        }});
      });

      it('should return the collection correctly', function(done){
        collection.fetch({success: function(){
          collection.models.length.should.eql(2);
          collection.map(function(x){return x.id}).sort().should.eql([test_model1.id, test_model2.id].sort());
          done();
        }});
      });

      it('should filter the collection with a single condition', function(done) {
        collection.fetch({
          filter:["one = 'testone1'"],
          success: function(){
            collection.models.length.should.eql(1);
            collection.map(function(x){return x.id}).should.eql([test_model1.id]);
            done();
        }});
      });

      it('should filter the collection with multiple conditions in an array', function(done) {
        var test_model3 = new Test({one: 'testone1', two: 3});
        test_model3.save(null, {success: function(){
          var collection = new TestCollection();
          collection.fetch({
            filter:["one = 'testone1'", "two = 2"],
            success: function(){
              collection.models.length.should.eql(1);
              collection.map(function(x){return x.id}).should.eql([test_model1.id]);
              done();
          }});
        }});
      });
 
      it('should filter the collection with multiple conditions in an object', function(done) {
        var test_model3 = new Test({one: 'testone1', two: 3});
        test_model3.save(null, {success: function(){
          var collection = new TestCollection();
          collection.fetch({
            filter: {one: 'testone1',two: 2},
            success: function(){
              collection.models.length.should.eql(1);
              collection.map(function(x){return x.id}).should.eql([test_model1.id]);
              done();
          }});
        }});
      });
    });
  });
});

