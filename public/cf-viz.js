// Generated by CoffeeScript 1.3.3
(function() {
  var AppCollection, BaseCollection, DeaCollection, NATSListener, Visual, app_collection, dea_collection, nats_listener,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Visual = (function() {

    function Visual() {}

    Visual.width = 960;

    Visual.height = 500;

    Visual.fill = d3.scale.category10();

    Visual.color = d3.scale.category20();

    Visual.init = function() {
      return this.svg = d3.select("body").append("svg").attr("width", this.width).attr("height", this.height);
    };

    return Visual;

  })();

  BaseCollection = (function() {

    function BaseCollection(node_class) {
      this._items = [];
      this._links = [];
      this._node_class = node_class;
    }

    BaseCollection.prototype.node_class = function() {
      return this._node_class;
    };

    BaseCollection.prototype.items = function() {
      return this._items;
    };

    BaseCollection.prototype.links = function() {
      return this._links;
    };

    BaseCollection.prototype.add_link = function(link) {
      return this._links.push(link);
    };

    BaseCollection.prototype.add = function(item) {
      return this._items.push(item);
    };

    BaseCollection.prototype.remove = function(item_to_remove) {
      var index, links,
        _this = this;
      links = _.filter(this._links, function(l) {
        return l.source === item_to_remove || l.target === item_to_remove;
      });
      _.each(links, function(link) {
        var link_index;
        link_index = _this._links.indexOf(link);
        return _this._links.splice(link_index, 1);
      });
      index = this._items.indexOf(item_to_remove);
      this._items.splice(index, 1);
      return this.clean_up();
    };

    BaseCollection.prototype.force_layout = function(gravity, charge) {
      return d3.layout.force().nodes(this._items).links(this._links).linkStrength(0).size([Visual.width, Visual.height]).gravity(gravity).charge(charge);
    };

    BaseCollection.prototype.clean_up = function() {
      Vis.svg.selectAll("." + this._node_class).data(this._items).exit().remove();
      return Vis.svg.selectAll(".link").data(this._links).exit().remove();
    };

    return BaseCollection;

  })();

  DeaCollection = (function(_super) {

    __extends(DeaCollection, _super);

    function DeaCollection() {
      var _this = this;
      DeaCollection.__super__.constructor.call(this, "dea-node");
      this.force = this.force_layout(.05, -150).on("tick", function(e) {
        return Visual.svg.selectAll("." + (_this.node_class())).attr("cx", function(d) {
          return d.x;
        }).attr("cy", function(d) {
          return d.y;
        }).attr("transform", function(d) {
          return "translate(" + d.x + "," + d.y + ")";
        });
      });
    }

    DeaCollection.prototype.add = function(dea) {
      DeaCollection.__super__.add.call(this, dea);
      return this.update_visual();
    };

    DeaCollection.prototype.remove = function(dea) {
      DeaCollection.__super__.remove.call(this, dea);
      return this.update_visual();
    };

    DeaCollection.prototype.find_by_id = function(id) {
      return _.find(this.items(), function(dea) {
        return dea.dea === id;
      });
    };

    DeaCollection.prototype.update_visual = function() {
      this.force.start();
      return Visual.svg.selectAll("." + (this.node_class())).data(this.items()).enter().append("g").attr("class", this._node_class).attr("id", function(d) {
        return d.dea;
      }).append("svg:circle").attr("r", 20).style("fill", function(d) {
        return Visual.fill(d.index);
      }).style("stroke", function(d) {
        return d3.rgb(Visual.fill(d.index)).darker(5);
      }).style("stroke-width", 1.5);
    };

    return DeaCollection;

  })(BaseCollection);

  AppCollection = (function(_super) {

    __extends(AppCollection, _super);

    function AppCollection() {
      var _this = this;
      AppCollection.__super__.constructor.call(this, "app-node");
      this.force = this.force_layout(.05, -150).on("tick", function(e) {
        var k;
        k = .1 * e.alpha;
        Visual.svg.selectAll(".link").attr("x1", function(d) {
          return d.source.x;
        }).attr("y1", function(d) {
          return d.source.y;
        }).attr("x2", function(d) {
          return d.target.x;
        }).attr("y2", function(d) {
          return d.target.y;
        });
        return Visual.svg.selectAll("." + (_this.node_class())).attr("cx", function(d) {
          return d.x;
        }).attr("cy", function(d) {
          return d.y;
        }).attr("transform", function(d) {
          d.y += (d.dea_node.y - d.y) * k;
          d.x += (d.dea_node.x - d.x) * k;
          return "translate(" + d.x + "," + d.y + ")";
        });
      });
    }

    AppCollection.prototype.add = function(app) {
      var existing_apps,
        _this = this;
      AppCollection.__super__.add.call(this, app);
      existing_apps = this.find_by_app_id(app.app);
      if (existing_apps.length > 1) {
        _.each(existing_apps, function(a) {
          if (app !== a) {
            return _this.add_link({
              source: app,
              target: a
            });
          }
        });
      }
      return this.update_visual();
    };

    AppCollection.prototype.remove = function(app) {
      AppCollection.__super__.remove.call(this, app);
      return this.update_visual();
    };

    AppCollection.prototype.find_by_instance_id = function(id) {
      return _.find(this.items(), function(app) {
        return app.private_instance_id === id;
      });
    };

    AppCollection.prototype.find_by_app_id = function(id) {
      return _.filter(this.items(), function(app) {
        return app.app === id;
      });
    };

    AppCollection.prototype.update_visual = function() {
      var nodes;
      this.force.start();
      nodes = Visual.svg.selectAll("." + (this.node_class())).data(this.items()).enter().append("g").attr("class", this._node_class).attr("id", function(d) {
        return d.private_instance_id;
      });
      nodes.append("svg:circle").attr("r", 10).style("fill", function(d) {
        return Visual.fill(d.app);
      }).style("stroke", function(d) {
        return d3.rgb(Visual.fill(d.index)).darker(5);
      }).style("stroke-width", 1.5);
      nodes.append("text").attr("dx", 12).attr("dy", ".35em").text(function(d) {
        return "" + d.uris[0] + "\n";
      });
      return Visual.svg.selectAll(".link").data(this.links()).enter().append("line").attr("class", "link");
    };

    return AppCollection;

  })(BaseCollection);

  NATSListener = (function() {

    NATSListener.prototype.receive_handlers = [];

    NATSListener.prototype.ignore = ['discover.all', 'vcap.component.discover'];

    NATSListener.prototype.show_nats = true;

    function NATSListener(faye_endpoint) {
      var _this = this;
      this.faye_client = new Faye.Client(faye_endpoint);
      this.faye_client.disable('websocket');
      this.faye_client.subscribe('/nats', function(message) {
        var parsed;
        if (_this.ignore.indexOf(message.sub) === -1) {
          parsed = _this.parse_message(message);
          if (_this.show_nats === true) {
            console.log(parsed);
          }
          return _.each(_this.receive_handlers, function(handler) {
            return handler(parsed);
          });
        }
      });
    }

    NATSListener.prototype.parse_message = function(msg) {
      return {
        data: JSON.parse(msg.msg),
        subscription: msg.sub
      };
    };

    NATSListener.prototype.on_receive = function(handler) {
      return this.receive_handlers.push(handler);
    };

    return NATSListener;

  })();

  Visual.init();

  window.Vis = Visual;

  window.apps = app_collection = new AppCollection;

  window.deas = dea_collection = new DeaCollection;

  window.nl = nats_listener = new NATSListener('http://faye.cloud.gopaas.eu/faye');

  nats_listener.on_receive(function(msg) {
    var app, dea, route;
    switch (msg.subscription) {
      case "dea.heartbeat":
        dea = msg.data;
        if (!(dea_collection.find_by_id(dea.dea) != null)) {
          return dea_collection.add(dea);
        }
        break;
      case "router.register":
        route = msg.data;
        if (route.app != null) {
          if (dea_collection.find_by_id(route.dea) != null) {
            if (!app_collection.find_by_instance_id(route.private_instance_id)) {
              route.dea_node = dea_collection.find_by_id(route.dea);
              return app_collection.add(route);
            }
          }
        }
        break;
      case "router.unregister":
        route = msg.data;
        if (route.app != null) {
          if (dea_collection.find_by_id(route.dea) != null) {
            if (app_collection.find_by_instance_id(route.private_instance_id)) {
              app = app_collection.find_by_instance_id(route.private_instance_id);
              return app_collection.remove(app);
            }
          }
        }
    }
  });

}).call(this);
