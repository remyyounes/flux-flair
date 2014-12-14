var merge = require('react/lib/merge');
var arrayToHash = require("../lib/arrayToHash");
var Q = require("q");
var _ = require("underscore");
var Reflux = require('reflux');

var ChainedEmitter = require('chained-emitter').EventEmitter;
// var EventEmitter3 = require('eventemitter3');

var ChecklistClient = require("Checklists/clients/ChecklistClient");
var UML = require("../docs/UML.js");
ChainedEmitter.prototype.parallel = true;
Reflux.setEventEmitter(ChainedEmitter);

var StoreSynchronizer = function(store, parentStore) {
  var synchronizer = _.extend(
    SynchronizerMethods(store, parentStore),
    Reflux.ListenerMethods,
    Reflux.PublisherMethods
  );

  // synchronizer.emitter = new EventEmitter3();
  synchronizer.emitter = ChainedEmitter;
  synchronizer.init();
  return synchronizer;
};

var SynchronizerMethods = function(store, parentStore) {
  var synchronizerMethods = {
    init: function() {
      this.listenTo(store, this.onSyncRequest);
      parentStore && this.listenTo(parentStore, this.onParentSync);
      parentStore && this.listenTo(parentStore, this.onParentCreateSync);
    },
    umlResourceName: function (resource) {
      if (resource === "Synchronizer" )
        return store.getResourceType() + "_synchronizer";
      else
        return resource.getResourceType() + "_store";
    },
    sequenceLog: function(caller, callee, line, description) {
      caller = this.umlResourceName(caller);
      callee = this.umlResourceName(callee);
      UML.log(caller, callee, line, description);
    },
    onSyncRequest: function(eventType, eventData) {
      if (eventType !== "syncRequest") return;
      this.sequenceLog(store, "Synchronizer", "->+", "onSyncRequest");
      var syncRequest = this.syncResource(eventData.parent, eventData.object);
      return syncRequest;
    },
    onParentSync: function(eventType, eventData){
      if (eventType !== "sync") return;
      this.sequenceLog(parentStore, "Synchronizer", "->+", "onParentSync");
      var action = eventData && eventData.action;
      var syncCollectionRequest = null;
      if (action !== "get" && action !== "getCollection") {
        syncCollectionRequest = this.syncCollection(eventData.object);
      }
      syncCollectionRequest = Q.when(syncCollectionRequest).then(function(){
        this.sequenceLog("Synchronizer", parentStore, "->-", "onParentSyncDone");
      }.bind(this));
      return syncCollectionRequest;
    },
    onParentCreateSync: function(eventType, eventData){
      if (eventType !== "syncCreate") return;
      this.sequenceLog(parentStore, "Synchronizer", "->+", "onParentCreateSync");
      return this.replaceCollectionId(eventData.newObject.id, eventData.object.id);
    },
    replaceObjectId: function(parent, object, tempObject ) {
      store.deleteObject(parent, tempObject, true, false);
      store.setObject(parent.id, object);
      store.trigger("change");
    },
    replaceCollectionId: function(collectionId, tempCollectionId) {
      var objects = store.getCollection(tempCollectionId);
      for (var key in objects) {
        var object = objects[key];
        object.parent_id = collectionId;
        object.dbAction = "create";
        objects[object.id] = object;
      }
      store.setCollection(collectionId, objects);
      store.deleteCollection(tempCollectionId, true);
      store.trigger("change");
    },
    syncCollection: function(parent) {
      this.sequenceLog("Synchronizer", "Synchronizer", "->", "syncCollection");
      var collection = store.getCollection(parent.id);
      var syncRequests = _.map(_.values(collection), function(object) {
        return this.syncResource(parent, object);
      }.bind(this));
      syncRequests = Q.allSettled(syncRequests)
      .then(function() { this.sequenceLog("Synchronizer", "Synchronizer", "->", "syncCollectionDone"); }.bind(this));
      return syncRequests;
    },
    syncResource: function(parent, object) {
      this.sequenceLog("Synchronizer", "Synchronizer", "->", "syncResource");
      var syncMethod = ResourceMethods[object.dbAction];
      var syncRequest = syncMethod && syncMethod.call(this, parent, object);
      syncRequest = Q.when(syncRequest);
      syncRequest = syncRequest.then(this.syncResourceCallback(object))
      .then(function() { this.sequenceLog("Synchronizer", "Synchronizer", "->", "syncResourceDone"); }.bind(this));
      return syncRequest;
    },
    syncResourceCallback: function(object) {
      this.sequenceLog("Synchronizer", "Synchronizer", "->", "syncResourceCallback");
      return function(response) {
        if(object.dbAction ==="create") object = response;
        this.sequenceLog("Synchronizer", store, "->+", "emitSync");
        var nestedRequests = store.emitSync(parent, object).then(function(){
          this.sequenceLog(store, "Synchronizer", "->-", "emitSyncDone");
          object.dbAction = null;
          store.trigger("change");
        }.bind(this));
        return nestedRequests;
      }.bind(this);
    }
  };

  var ResourceMethods = {
    create: function(parent, object) {
      var syncRequest = ChecklistClient.addObject(parent, object, store.getResourceType())
      .done(function(newObject){
        this.replaceObjectId(parent, newObject, object);
        store.emitSyncCreate(parent, object, newObject);
      }.bind(this));
      return syncRequest;
    },
    update: function(parent, object) {
      var syncRequest = ChecklistClient.updateObject(parent, object, store.getResourceType())
      .done(function(data){ }.bind(this));
      return syncRequest;
    },
    delete: function(parent, object) {
      var syncRequest = ChecklistClient.deleteObject(parent, object, store.getResourceType())
      .done(function(data){ store.deleteObject(parent, object, true, false); });
      return syncRequest;
    },
    getCollection: function(parent) {
      var collectionId = parent.id;
      var syncRequest = ChecklistClient.getCollection(parent)
      .done(function(collection) {
        store.setCollection(collectionId, arrayToHash(collection, "id"));
      });
      return syncRequest;
    },
    get: function(parent, object) {
      var syncRequest = ChecklistClient.getObject(parent, object.id)
      .done(function(object){
        store.setObject(parent.id, object);
      });
      return syncRequest;
    }
  };

  return synchronizerMethods;
};

module.exports = StoreSynchronizer;
