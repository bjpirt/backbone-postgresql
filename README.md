backbone-postgresql
===================

[![Build Status](https://secure.travis-ci.org/bjpirt/backbone-postgresql.png)](http://travis-ci.org/bjpirt/backbone-postgresql)

This is a sync library for server-side Backbone.js running on node.js that enables it to store data in PostgreSQL. It uses a hybrid approach to the schema whereby you can mix up old-school columns with all of their associated relational integrity and an hstore column that allows you to store arbitrary attributes with no schema changes.

See this article for some more details about hstore, and also the PostgreSQL docs here. To set up your database with the hstore extension you need to log into postgres as an admin and use the database you want to add it to, then run "CREATE EXTENSION hstore". It should then be ready for you to use.

The library uses all of the standard Backbone methods for syncing objects and works with both models and collections. Here's an example, it assumes you've created a database and set it up with the hstore extension and then set up a database with the following schema:

    CREATE TABLE badgers (
      id SERIAL,
      name VARCHAR(128),
      attributes hstore
    );

This won't really run as one script because otherwise it would all have to be nested to make sure things had executed before moving on to the next example, but this way is a lot easier to read.

    // Require the library as Backbone so that it can extend its prototype
    Backbone = require('backbone-postgresql');
    
    // Tell the Postgres connector how to connect to the database
    Backbone.pg_connector.config = {db: ''pg://username:password@localhost/backbone-pg-demo'};
    
    // Define our models and collections. We're using the urlRoot parameter to define the table name
    var Badger = Backbone.Model.extend({
      urlRoot: 'badgers'
    });
    
    var BadgerCollection = Backbone.Collection.extend({
      urlRoot: 'badgers',
      model: Badger
    });
    
    // Let's create a new badger
    var badger = new Badger({name: 'Bodger', age: 2});
    // and save it - with this schema the age attribute will be stored in hstore, whilst the name attribute will go in a proper column
    badger.save();
    // Here we use the event emitter approach
    badger.on('sync', function(model){
      console.log('Badger saved: ' + model.name);
    });
    badger.on('error', function(model, err){
      console.log('Error saving badger');
    });

    //then we could change some attributes - obviously we should really put this in the success callback, but for keeping the examples simple I haven't
    model.set('age', 3);
    // then let's save it again but this time we can use callbacks as an argument
    // the first argument is null because you can pass in new attributes to save. Always catches me out.
    model.save(null, {
      success: function(model){
        console.log('Badger updated: ' + model.name);
      },
      error: function(model, err){
        console.log('Error updating badger');
      }
    });
    
    // Let's say that the id of a badger is 345 - here is how we retrieve it from the database:
    var another_badger = new Badger({id: 345});
    another_badger.fetch({
      success: function(model){
        console.log("Successfully retrieved badger: " + model.attributes.name + " (Age: " + model.attributes.age + ")");
      },
      error: function(model, err){
        console.log('Error retrieving badger');
      }
    });
    
    // If it can't be found, the error callback will be fired and the "err" parameter will be set to "Not found"
    
    // If you want to put some constraints on what you're fetching (e.g. if you want to fetch a resource, but wanted to make sure it was owned by the correct person)
    // you can add a filter parameter like so:
    
    another_badger.fetch({
      filter: {owner_id: 123},
      success: ...
      error: ...
    });
    
    // The filter parameter can be an object, in which case each of the key:value pairs are turned into where constraints ANDed together, e.g.
    // {owner_id: 123, name: 'bob'}
    // will get turned into a snippet of SQL like:
    // WHERE owner_id = 123 AND name = 'bob'
    
    // If you want to apply more complex conditions, you can create a series of conditions which will be ANDed together as well, e.g.
    // ['owner_id = 123', "name = 'bob'"]
    // is equivalent to the same thing:
    // WHERE owner_id = 123 AND name = 'bob'
    
    // And if we wanted to delete it we could just do:
    another_badger.destroy({
      success: function(model){
        console.log("You just destroyed an endangered animal");
      },
      error: function(model, err){
        console.log("No badger was harmed");
      }
    });
    
    // Collections
    
    // Let's make a collection of badgers
    var badgers = new BadgerCollection();
    
    badgers.fetch({
      success: function(collection){
        console.log("Successfully fetched badgers");
      },
      error: function(collection, err){
        console.log("Error fetching badgers");
      }
    });
    
    // You can also apply a filter to this fetch as in the fetch example for Models, e.g.
    
    badgers.fetch({
      filter: {name: 'bob'},
      success: ...
      error: ...
    });
  
    // will return all badgers named bob

# Contributions

The best contribution is a pull request! Let me know if there are things you'd like to see it do. If you do submit a pull request, make sure you add tests. It's pretty well covered so if there are any bugs let me know and I'll get them tested and fixed.

# Credits

Obviously without Backbone this wouldn't even exist so thanks to Jeremy Ashkenas for creating that to begin with. I used the backbone-mongodb module as inspiration for the structure of the code and shamefully stole the hstore serialisation method from backbone-hstore. Thanks all.












